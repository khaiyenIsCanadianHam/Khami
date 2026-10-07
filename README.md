# Khami

A local-first business analytics workspace. React + TypeScript provide a guided
GUI; a FastAPI bridge connects it to your existing Python Khami engine.

## Run the app

Requires Node.js 20.19+ or 22.12+ (tested with Node 24), npm, and Python 3.10+.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite (port 5173). The first launch opens a
clearly labeled **demo workspace** with fictional retail data. You can explore
the dashboard, run both guided analysis modes, upload prediction CSVs, and
download reports without a database. Demo predictions illustrate the interface;
they are not produced by a trained model.

### Start the local Python API

If your existing engine already has a virtual environment, activate that
environment and install the bridge requirements there. To test the bridge on
its own, create a new environment:

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m backend
```

The API binds to `127.0.0.1:8000`. In the app's **Settings**, leave the engine
address as `http://localhost:8000`, test the connection, turn off **Use demo
workspace**, and save.

**The existing Python ML engine was not included in this repository.** The API
therefore reports `engine_ready: false` until an adapter is configured. It does
not generate fake live results. Connect the engine's existing functions using
[the adapter template](backend/adapter_template.py) and the
[engine integration guide](docs/ENGINE_API.md):

```bash
KHAMI_ENGINE_MODULE=your_adapter_module python -m backend
```

The adapter has three operations: test a database connection and return table
metadata, run an analysis with progress updates, and score new CSV data. Your
Python engine retains responsibility for the database, profiling, best-five
algorithm-set selection, CSV conversion, cleaning and exploration, training,
validity checks, bounded retries, algorithm/model caching, and database checks
on predictions.

## What works

- Responsive dashboard with revenue history, customer groups, category
  breakdowns, data quality, plain-language insights, and recent analyses.
- Database setup for PostgreSQL, MySQL, or SQLite through the local engine.
  Connection and access failures have clear, safe messages.
- Table selection, business labels, and outcome-focused or exploratory goals.
- Background analysis progress, retry states, and a validation gate. Supervised
  results require a real score of at least 0.60 and a successful validity check.
  Unsupervised results require a validity check without inventing an accuracy.
- Re-analysis on demand; new requests tell the engine to read current data.
- CSV predictions, input validation, readable result tables, formula-safe CSV
  export, and an explicit database comparison status.
- Configurable local API address; separate sample and live workspaces.

Algorithm names stay out of the business workflow. The bridge's JSON contract
and API documentation are intended for the person connecting the Python engine.
Unknown live metrics remain empty; they are never replaced with demo values.

## Local state and privacy

Only the engine URL and demo preference persist in browser storage. Passwords
are used transiently for a connection request and cleared afterward. Connections,
analysis history, and uploads are session data; refresh requires reconnecting.
Export a report to keep results. The bridge also keeps its job metadata in memory;
the Python engine owns any persistent model cache.

The app is a single-user local workspace. “Owner settings” identifies its
configuration area; it is not a multi-user authentication or authorization system.
Use the default loopback API binding. The API accepts browser requests only from
explicitly configured frontend origins (localhost/127.0.0.1 on port 5173 by
default). See the integration guide for `KHAMI_ALLOWED_ORIGINS` if you change the
frontend port.

## Validate

```bash
npm run build
python -m pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/tests -v
npm run test:e2e
```

Browser tests use system Chromium when `/usr/bin/chromium` exists. Otherwise
install a Playwright browser with `npx playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable. The test runner
starts development servers when needed. Its API fixtures test the GUI contract;
they do not validate your actual ML engine.

## Production build

```bash
npm run build
npm run preview -- --port 5173
```

Keep the Python API running separately. Do not expose its database and prediction
operations to an untrusted network.

## Project layout

```text
src/                  React GUI, API client, and clearly labeled sample data
src/components/       Dashboard, charts, setup wizard, predictions, settings
backend/              FastAPI bridge, typed contract, and engine adapter template
backend/tests/        API and validation-gate tests with controlled engine fixtures
docs/ENGINE_API.md    Existing Python engine integration instructions
tests/                Browser workflow tests
```
