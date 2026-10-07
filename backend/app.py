"""Loopback-only FastAPI service. Run with: python -m backend"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from copy import deepcopy
import csv
import io
import os
from threading import RLock
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .adapter import EngineAdapter, EngineError, ERROR_MESSAGES, load_adapter
from .models import (
    AnalysisJob, AnalysisRequest, Connection, ConnectionRequest, EngineOutcome,
    PredictionRequest, PredictionResult, Progress,
)

_AUTO_LOAD = object()


def failure(code: str, status: int = 400, message: str | None = None) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message or ERROR_MESSAGES[code]})


def create_app(adapter: EngineAdapter | None | object = _AUTO_LOAD) -> FastAPI:
    connections: dict[str, Connection] = {}
    jobs: dict[str, AnalysisJob] = {}
    state_lock = RLock()
    pending: set[asyncio.Task] = set()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.adapter = load_adapter() if adapter is _AUTO_LOAD else adapter
        # One worker protects existing engines with non-thread-safe DB/model state.
        # HTTP polling remains responsive while a training task runs here.
        app.state.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="khami-engine")
        try:
            yield
        finally:
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            app.state.executor.shutdown(wait=True, cancel_futures=True)

    app = FastAPI(title="Khami local engine bridge", version="1.0.0", lifespan=lifespan)
    origins = [origin.strip().rstrip("/") for origin in os.environ.get(
        "KHAMI_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()]
    if "*" in origins:
        raise ValueError("KHAMI_ALLOWED_ORIGINS must list exact trusted origins; '*' is not supported.")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]"])

    @app.middleware("http")
    async def restrict_browser_origin(request: Request, call_next):
        # CORS alone hides responses but does not reject unwanted browser requests.
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse(status_code=403, content={"detail": {
                "code": "ERR_3", "message": "This browser address isn't allowed to use your local engine."
            }})
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_credentials=False,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, _error):
        # FastAPI's default includes rejected input, which may contain passwords.
        return JSONResponse(status_code=422, content={"detail": {
            "code": "ERR_1", "message": ERROR_MESSAGES["ERR_1"]
        }})

    def require_engine() -> EngineAdapter:
        engine = app.state.adapter
        if engine is None:
            raise failure("ENGINE_UNAVAILABLE", 503)
        return engine

    async def call_engine(fn, *args):
        return await asyncio.get_running_loop().run_in_executor(app.state.executor, fn, *args)

    @app.get("/health")
    async def health():
        return {"status": "ok", "engine_ready": app.state.adapter is not None}

    @app.post("/connections/test", response_model=Connection)
    async def test_connection(request: ConnectionRequest):
        engine = require_engine()
        with state_lock:
            if len(connections) >= 100:
                raise failure("ERR_1", 429, "There are too many connections open. Restart your local engine to start fresh.")
        try:
            connection = Connection.model_validate(await call_engine(engine.test_connection, request.engine_payload()))
        except EngineError as exc:
            raise failure(exc.code, 400) from None
        except Exception:
            raise failure("ERR_2", 502) from None
        with state_lock:
            # Only public schema metadata is retained by the bridge.
            connections[connection.connection_id] = connection
        return connection

    def run_job(engine: EngineAdapter, job_id: str, request: AnalysisRequest):
        def report_progress(update: dict):
            progress = Progress.model_validate(update)
            with state_lock:
                if jobs[job_id].status in {"completed", "failed"}:
                    return
                jobs[job_id] = jobs[job_id].model_copy(update=progress.model_dump())

        report_progress({"status": "running", "step": 0, "progress": 0, "message": "Getting your data ready."})
        try:
            payload = request.model_dump()
            payload["analysis_id"] = job_id
            outcome = EngineOutcome.model_validate(engine.run_analysis(payload, report_progress))
            if not outcome.validation_passed:
                raise EngineError("ANALYSIS_FAILED")
            if request.mode == "supervised" and (outcome.accuracy is None or outcome.accuracy < 0.60):
                with state_lock:
                    jobs[job_id] = jobs[job_id].model_copy(update={
                        "status": "failed", "result": None, "accuracy": None,
                        "message": "Your results weren't reliable enough to share. Try adding more complete data, then run the analysis again.",
                    })
                return
            # Normalize duplicate result fields so a mismatched engine ID/score
            # cannot bypass the gate or make prediction requests use another job.
            score = outcome.accuracy if request.mode == "supervised" else None
            result = outcome.result.model_copy(update={"id": job_id, "accuracy": score})
            with state_lock:
                jobs[job_id] = AnalysisJob(
                    id=job_id, status="completed", step=5, progress=100,
                    message="Your analysis is ready.", accuracy=score, result=result,
                )
        except Exception:
            with state_lock:
                jobs[job_id] = jobs[job_id].model_copy(update={
                    "status": "failed", "result": None, "accuracy": None,
                    "message": ERROR_MESSAGES["ANALYSIS_FAILED"],
                })

    @app.post("/analyses", status_code=202)
    async def create_analysis(request: AnalysisRequest):
        engine = require_engine()
        with state_lock:
            connection = connections.get(request.connection_id)
            if connection is None:
                raise failure("ERR_1", 400, "Reconnect your database before starting an analysis.")
            available = {table.name for table in connection.tables}
            if len(set(request.tables)) != len(request.tables) or not set(request.tables).issubset(available):
                raise failure("ERR_1", 400, "Choose valid tables from your connected database.")
            if request.mode == "supervised":
                targets = {col.name for table in connection.tables if table.name in request.tables for col in table.columns}
                if request.target not in targets:
                    raise failure("ERR_1", 400, "Choose a prediction column from your selected tables.")
            if sum(job.status in {"queued", "running", "retrying"} for job in jobs.values()) >= 10:
                raise failure("ANALYSIS_FAILED", 429, "Several analyses are already waiting. Let one finish before starting another.")
            # Retain the latest 100 jobs, removing only finished jobs when full.
            if len(jobs) >= 100:
                oldest = next((key for key, job in jobs.items() if job.status in {"completed", "failed"}), None)
                if oldest:
                    del jobs[oldest]
            job_id = str(uuid4())
            jobs[job_id] = AnalysisJob(id=job_id, status="queued", step=0, progress=0, message="Your analysis is in line.")

        task = asyncio.create_task(call_engine(run_job, engine, job_id, request))
        pending.add(task)
        task.add_done_callback(pending.discard)
        return {"id": job_id}

    @app.get("/analyses/{job_id}", response_model=AnalysisJob)
    async def get_analysis(job_id: str):
        with state_lock:
            job = jobs.get(job_id)
            if job is None:
                raise failure("ERR_1", 404, "This analysis is no longer available. Run it again to get fresh results.")
            return deepcopy(job)

    @app.post("/predictions", response_model=PredictionResult)
    async def predictions(request: PredictionRequest):
        engine = require_engine()
        with state_lock:
            job = jobs.get(request.analysis_id)
            if job is None or job.status != "completed":
                raise failure("ERR_1", 400, "Finish a reliable analysis before adding prediction data.")
        try:
            reader = csv.reader(io.StringIO(request.csv), strict=True)
            header = next(reader, [])
            first_row = next(reader, [])
            if not header or not first_row or len(set(header)) != len(header) or any(not item.strip() for item in header):
                raise ValueError("CSV requires distinct headers and data.")
            if len(first_row) != len(header):
                raise ValueError("CSV row width mismatch.")
            for row in reader:
                if len(row) != len(header):
                    raise ValueError("CSV row width mismatch.")
        except (csv.Error, ValueError):
            raise failure("ERR_1", 400, "Choose a CSV with column names in the first row and matching data below them.") from None
        try:
            return PredictionResult.model_validate(await call_engine(engine.predict, request.model_dump()))
        except EngineError as exc:
            raise failure(exc.code, 400) from None
        except Exception:
            raise failure("ANALYSIS_FAILED", 502) from None

    return app


app = create_app()
