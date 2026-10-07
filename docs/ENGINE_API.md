# Connect the existing Python engine

Khami's web application is a GUI. The Python ML program described in the product
brief was not included in this repository. `backend/` provides a real local HTTP
bridge and an explicit integration boundary; it does not substitute fake ML
results. The frontend's sample workspace is independent of this bridge.

## Start locally

Use the virtual environment that already contains your Python engine and its
scikit-learn/TensorFlow dependencies. From this repository's root:

```bash
# Activate your existing Python environment first.
python -m pip install -r backend/requirements.txt
python -m backend
```

The service binds to `127.0.0.1:8000`, uses one process, and disables request access
logs. With no adapter configured, `GET /health` returns
`{"status":"ok","engine_ready":false}`. Operations return a friendly
`ENGINE_UNAVAILABLE` error. This is the expected state until the real engine is
connected; a running HTTP server alone does not make the ML engine ready.

The browser app defaults to `http://localhost:8000` in Settings. CORS accepts
`http://localhost:5173` and `http://127.0.0.1:5173` by default. For a different local
frontend port, set an explicit comma-separated list before starting the bridge:

```bash
KHAMI_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 python -m backend
```

Only list trusted browser origins. Wildcards are refused. Origin checks reject
other browser pages, and Host checks protect the loopback service from DNS
rebinding. There is no network user authentication; this service is intended for
one trusted local user, and must remain bound to loopback. All browser users who
can access this local process share its connections and jobs. Frontend owner
settings are not a server-side authorization system.

## Write a small adapter

Copy `backend/adapter_template.py` to a Python module such as
`khami_local_adapter.py` alongside this README or in your engine's importable
package. Implement its three methods using your existing Python program.
`create_adapter()` must initialize and return that adapter; the template refuses
to initialize until you replace its placeholders.

The shape is deliberately small:

```python
from backend.adapter import EngineError
from your_engine_package import ExistingKhamiEngine  # replace with your package

class Adapter:
    def __init__(self):
        self.engine = ExistingKhamiEngine()

    def test_connection(self, config: dict) -> dict:
        # Call your existing connection + schema inspection functions.
        # Map their output to the Connection response below.
        # Use EngineError("ERR_2") for unreachable DB or ERR_3 for denied access.
        raise NotImplementedError("Connect existing functions here")

    def run_analysis(self, request: dict, report_progress) -> dict:
        # Run your existing full pipeline. Report progress in plain language.
        # Return EngineOutcome below, using the actual validation outcome.
        raise NotImplementedError("Connect existing functions here")

    def predict(self, request: dict) -> dict:
        # Score with the model cached under request["analysis_id"].
        # Return PredictionResult below, with a truthful database-check flag.
        raise NotImplementedError("Connect existing functions here")

def create_adapter():
    return Adapter()
```

Then run:

```bash
KHAMI_ENGINE_MODULE=khami_local_adapter python -m backend
```

The value is an importable module name, not a file path or arbitrary command.
The bridge imports it once at startup and calls `create_adapter()` with no
arguments. It checks that all three synchronous methods exist. Import,
initialization, or interface errors leave `engine_ready` false; raw exceptions are
not logged or returned because driver errors can contain credentials. Readiness
means the adapter initialized, not that a database or model has been validated.
Restart the bridge after changing adapter configuration.

The adapter is trusted Python code with the same permissions as the local user.
Do not load untrusted modules. Adapter calls are serialized on a dedicated worker
thread so existing engine/connection state does not have to be thread safe. HTTP
health and analysis polling continue while training runs. A long analysis may
queue connection tests and predictions. Engine implementations should configure
their own database timeouts and bounded pipeline retries.

The bridge holds job and public schema metadata in memory. It never stores
database passwords, exports CSVs, or writes prediction data itself. Connection
credentials reach only `test_connection`; the engine owns secure connection
handles and their lifetime. Do not put passwords in IDs, progress messages,
exceptions, result text, local storage, or logs. Prefer a database account with
read-only access. The engine owns data profiling, best-five algorithm-set
selection, CSV conversion, light cleaning, exploration, deeper cleaning/feature
engineering, re-exploration, training or interpretation, model caching, retries,
and prediction comparison against the database.

## HTTP and adapter contract

All request/response bodies are JSON. `backend/models.py` is the authoritative
validated contract; the live API also provides `/docs` and `/openapi.json`.
Extra fields are rejected to catch integration mistakes. Numbers must be finite.
The samples below illustrate response shapes, not actual analysis findings.

### Connection

`POST /connections/test` calls `adapter.test_connection(config)` with:

```json
{
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "business",
  "username": "khami_reader",
  "password": "provided transiently by the user"
}
```

Supported type values are `postgresql`, `mysql`, and `sqlite`. For SQLite,
`database` is the file path and host, port, and credentials may be omitted. The
adapter chooses the actual database driver; none is bundled or guessed here.

Return:

```json
{
  "connection_id": "opaque-engine-owned-id",
  "name": "Business database",
  "tables": [
    {
      "name": "sales",
      "rows": 1250,
      "columns": [{ "name": "amount", "type": "number" }]
    }
  ]
}
```

Use actual row counts and schema information. Return only tables the user may
read. The connection ID must resolve to an engine-owned connection; the bridge
does not retain the original credentials or echo them. A maximum of 100
connections is retained for each bridge process.

### Start and poll analysis

`POST /analyses` validates the connection, selected tables, and supervised target,
then immediately returns HTTP 202 with `{"id":"bridge-generated-job-id"}`.
Request:

```json
{
  "connection_id": "opaque-engine-owned-id",
  "tables": ["sales"],
  "labels": { "sales": "Sales data", "amount": "Price" },
  "mode": "supervised",
  "target": "amount"
}
```

`mode` is `supervised` or `unsupervised`. Supervised requests require a target
column from a selected table. Labels are user-supplied hints; the engine must
profile the actual types and determine whether the hints are compatible. A new
POST creates a fresh job and should re-read and re-profile the current database,
while the engine may reuse a valid algorithm cache. Multi-table join rules and
ambiguous column names must be resolved or rejected by the existing engine;
the bridge does not guess how to join business data.

The bridge invokes:

```python
outcome = adapter.run_analysis(
    {**request, "analysis_id": "bridge-generated-job-id"},
    report_progress,
)
```

The additional `analysis_id` must be used by the engine to associate the trained
model with later prediction requests. The callback takes a dictionary:

```python
report_progress({
    "status": "running",  # or "retrying"
    "step": 2,
    "progress": 45,
    "message": "Looking for patterns in your data.",
})
```

Steps are 0 = prepare data, 1 = first cleaning, 2 = first exploration,
3 = deeper cleaning/features, 4 = second exploration, 5 = train/interpret and
validate. `progress` is between 0 and 100. Messages must be business language
without model/algorithm jargon or secrets. When the engine retries, emit
`retrying` and the current step/progress; the engine owns its retry limit. The
bridge does not generate fake stages or spin an unbounded retry loop.

Return this `EngineOutcome` after the engine has finished its checks/retries:

```json
{
  "validation_passed": true,
  "accuracy": 0.82,
  "result": {
    "id": "bridge-generated-job-id",
    "name": "Sales analysis",
    "rows": 1250,
    "quality": 94.2,
    "accuracy": 0.82,
    "insights": [
      {
        "title": "Engine-derived finding",
        "description": "Plain-language explanation",
        "tone": "info"
      }
    ],
    "revenue": [{ "month": "Jan", "actual": 1200, "forecast": 1250 }],
    "categories": [{ "name": "Retail", "value": 70 }],
    "segments": [
      { "name": "Returning customers", "value": 55, "color": "#759F5E" }
    ],
    "metrics": { "revenue": 1200, "customers": 120, "orderValue": 10 },
    "updatedAt": "2026-01-01T00:00:00Z"
  }
}
```

`validation_passed` must be a real boolean from a meaningful engine assessment;
the string `"true"` is refused. `quality` is an engine-derived percentage (0–100)
or null. Unknown/unavailable metrics and series values are null, and unavailable
chart collections are empty arrays. Never derive a sales metric for a dataset
that has no sales data. Insight tones are `positive`, `info`, or `warning`.

For supervised work, `accuracy` must be a real score from 0 to 1, at least 0.60,
and `validation_passed` must be true. Do not use a training score as held-out
accuracy, or rename an incompatible regression/error metric as accuracy. The
existing engine must provide a suitable evaluation criterion for its task (for
example a defined, held-out prediction success rate). If it cannot, return a
failed validation instead of inventing a score. The bridge normalizes the nested
result score from the top-level checked score.

For unsupervised work, return null accuracy and use a meaningful validity check
appropriate to the analysis. The bridge never applies classification accuracy
to unsupervised output and always exposes null accuracy in that mode.

`GET /analyses/{id}` returns:

```json
{
  "id": "bridge-generated-job-id",
  "status": "running",
  "step": 2,
  "progress": 45,
  "message": "Looking for patterns in your data.",
  "accuracy": null,
  "result": null
}
```

States are `queued`, `running`, `retrying`, `completed`, and `failed`. Only
completed, validated jobs expose a result. A low score, false/missing validation,
invalid output, or exception produces `failed` with a friendly message and null
result/accuracy. A failed job cannot be used for predictions. Poll about once a
second and stop on completion/failure. The bridge caps active/queued analyses at
10 and retains the latest 100 jobs, evicting finished jobs first.

### Predictions

`POST /predictions` calls `adapter.predict(request)`:

```json
{
  "analysis_id": "bridge-generated-job-id",
  "csv": "amount,date\n12,2026-01-01\n"
}
```

The referenced analysis must have completed successfully. The bridge verifies
CSV has distinct nonempty headers, data, consistent row widths, and at most
5,000,000 characters. The engine must additionally validate expected fields,
types, trained-model compatibility, and the appropriate scoring operation.

Return:

```json
{
  "rows": [{ "customer": "Example", "predicted_spend": 123.45 }],
  "summary": "Your engine's plain-language summary.",
  "checked_against_database": true
}
```

Values may be strings, numbers, or null. Set `checked_against_database` true only
if the engine actually compared the predictions with the connected database.
Returning predictions alone does not imply a successful database check. This
operation should read/check the database, not write predictions into it without
an explicit, separately implemented user action.

### Friendly errors

HTTP errors have this stable shape:

```json
{
  "detail": {
    "code": "ERR_2",
    "message": "We couldn't reach your database. Check the server address and that the database is running."
  }
}
```

| Code                 | Meaning                                                         |
| -------------------- | --------------------------------------------------------------- |
| `ERR_1`              | Missing/invalid connection, table, target, or prediction input  |
| `ERR_2`              | Database unavailable or connection validation failed            |
| `ERR_3`              | Database authentication/read permission refused                 |
| `ENGINE_UNAVAILABLE` | Adapter not configured or failed to initialize                  |
| `ANALYSIS_FAILED`    | Pipeline, validation, or prediction could not complete reliably |

Raise `backend.adapter.EngineError(code)` for a known, user-actionable adapter
failure. The bridge supplies the safe message. Never put raw database exception
text in the public response. Request-validation errors also omit rejected input
to protect passwords.

## Testing and lifecycle

```bash
python -m pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/tests -v
```

Tests use a clearly named in-memory fixture adapter, not the real engine. They
verify absent-engine behavior, connection error mapping and credential masking,
supervised 60% gating, explicit unsupervised validity, blocked predictions from
failed jobs, CSV checks, responsive polling during background training, and
browser origin/Host protections. Real database/ML integration remains to be
validated once the existing engine is supplied.

Do not enable multiple Uvicorn workers: each would have separate in-memory
connections/jobs/models. Restarting clears bridge state, so reconnect and rerun
analysis afterward. Graceful shutdown waits for in-flight synchronous engine
work; Python cannot safely interrupt an arbitrary model-training thread. There
is no job-cancel API. Implement bounded operations in your engine and stop the
local process if an engine operation is irrecoverably stuck.
