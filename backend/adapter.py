"""Trusted, in-process extension point for the user's existing ML engine."""

import importlib
import inspect
import os
from typing import Callable, Protocol


ERROR_MESSAGES = {
    "ERR_1": "Some connection or dataset details are missing or invalid. Check them and try again.",
    "ERR_2": "We couldn't reach your database. Check the server address and that the database is running.",
    "ERR_3": "Your database didn't allow access. Check the sign-in details and permission to read these tables.",
    "ENGINE_UNAVAILABLE": "Your local analysis engine isn't connected yet. Start it and check the engine address in Settings.",
    "ANALYSIS_FAILED": "We couldn't finish this analysis reliably. Check your data and try again.",
}


class EngineError(Exception):
    """Raise only a public error code; raw driver/engine errors never reach the UI."""

    def __init__(self, code: str):
        self.code = code if code in ERROR_MESSAGES else "ANALYSIS_FAILED"
        super().__init__(ERROR_MESSAGES[self.code])


class EngineAdapter(Protocol):
    def test_connection(self, config: dict) -> dict:
        """Validate access and return connection_id, name, and table metadata."""
        ...

    def run_analysis(self, request: dict, report_progress: Callable[[dict], None]) -> dict:
        """Run the existing pipeline and return EngineOutcome, including validity."""
        ...

    def predict(self, request: dict) -> dict:
        """Score CSV using request.analysis_id; return predictions + DB check status."""
        ...


def load_adapter() -> EngineAdapter | None:
    module_name = os.environ.get("KHAMI_ENGINE_MODULE", "").strip()
    if not module_name:
        return None
    try:
        module = importlib.import_module(module_name)
        adapter = module.create_adapter()
        for method_name in ("test_connection", "run_analysis", "predict"):
            method = getattr(adapter, method_name, None)
            if not callable(method) or inspect.iscoroutinefunction(method):
                return None
        return adapter
    except Exception:
        # Import/init errors may contain credentials or local file contents.
        # Never expose their repr or traceback in an HTTP response or log.
        return None
