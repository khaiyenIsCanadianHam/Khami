import copy
import threading
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.adapter import EngineError, load_adapter
from backend.app import create_app


# Deliberately controlled test fixtures, never available to the production app.
RESULT = {
    "id": "fixture", "name": "Fixture analysis", "rows": 20,
    "quality": 90, "accuracy": 0.8,
    "insights": [{"title": "Fixture", "description": "Controlled test data", "tone": "info"}],
    "revenue": [], "categories": [], "segments": [],
    "metrics": {"revenue": None, "customers": None, "orderValue": None},
    "updatedAt": "2026-01-01T00:00:00Z",
}
CONFIG = {"type": "sqlite", "database": ":memory:", "password": "do-not-expose-this"}


class FixtureAdapter:
    def __init__(self, score=0.8, valid=True):
        self.score = score
        self.valid = valid
        self.last_prediction = None
        self.last_connection = None

    def test_connection(self, request):
        self.last_connection = request
        return {
            "connection_id": "fixture-connection", "name": "Fixture database",
            "tables": [{"name": "sales", "rows": 20, "columns": [
                {"name": "amount", "type": "number"}, {"name": "date", "type": "date"},
            ]}],
        }

    def run_analysis(self, request, report_progress):
        report_progress({"status": "retrying", "step": 1, "progress": 25, "message": "Checking the data again."})
        return {"validation_passed": self.valid, "accuracy": self.score, "result": copy.deepcopy(RESULT)}

    def predict(self, request):
        self.last_prediction = request
        return {"rows": [{"amount": 12.5}], "summary": "Fixture prediction", "checked_against_database": False}


class BridgeTests(unittest.TestCase):
    def client(self, adapter=None):
        return TestClient(create_app(adapter), base_url="http://localhost")

    def connect(self, client):
        response = client.post("/connections/test", json=CONFIG)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["connection_id"]

    def start(self, client, mode="supervised", **changes):
        request = {
            "connection_id": self.connect(client), "tables": ["sales"],
            "labels": {"sales": "sales data"}, "mode": mode,
        }
        if mode == "supervised":
            request["target"] = "amount"
        request.update(changes)
        return client.post("/analyses", json=request)

    def finish(self, client, response):
        self.assertEqual(response.status_code, 202, response.text)
        job_id = response.json()["id"]
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            status = client.get(f"/analyses/{job_id}")
            self.assertEqual(status.status_code, 200)
            job = status.json()
            if job["status"] in {"completed", "failed"}:
                return job
            time.sleep(0.01)
        self.fail("Fixture analysis did not complete in time")

    def test_absent_engine_is_honest_and_actionable(self):
        with self.client() as client:
            self.assertEqual(client.get("/health").json(), {"status": "ok", "engine_ready": False})
            response = client.post("/connections/test", json=CONFIG)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["detail"]["code"], "ENGINE_UNAVAILABLE")

    def test_secrets_pass_only_to_adapter(self):
        adapter = FixtureAdapter()
        with self.client(adapter) as client:
            response = client.post("/connections/test", json=CONFIG)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(adapter.last_connection["password"], CONFIG["password"])
            self.assertNotIn(CONFIG["password"], response.text)

    def test_validation_errors_do_not_reflect_password(self):
        with self.client(FixtureAdapter()) as client:
            response = client.post("/connections/test", json={**CONFIG, "port": {"secret": CONFIG["password"]}})
            self.assertEqual(response.status_code, 422)
            self.assertNotIn(CONFIG["password"], response.text)
            self.assertEqual(response.json()["detail"]["code"], "ERR_1")

    def test_blank_port_is_accepted_for_sqlite(self):
        adapter = FixtureAdapter()
        with self.client(adapter) as client:
            response = client.post("/connections/test", json={**CONFIG, "port": ""})
            self.assertEqual(response.status_code, 200)
            self.assertIsNone(adapter.last_connection["port"])

    def test_driver_error_is_sanitized(self):
        adapter = FixtureAdapter()
        adapter.test_connection = lambda _: (_ for _ in ()).throw(RuntimeError(CONFIG["password"]))
        with self.client(adapter) as client:
            response = client.post("/connections/test", json=CONFIG)
            self.assertEqual(response.status_code, 502)
            self.assertNotIn(CONFIG["password"], response.text)

    def test_known_connection_errors_map_to_public_codes(self):
        for code in ("ERR_1", "ERR_2", "ERR_3"):
            with self.subTest(code=code):
                adapter = FixtureAdapter()
                adapter.test_connection = lambda _, code=code: (_ for _ in ()).throw(EngineError(code))
                with self.client(adapter) as client:
                    response = client.post("/connections/test", json=CONFIG)
                    self.assertEqual(response.json()["detail"]["code"], code)

    def test_reliable_supervised_result_can_be_scored(self):
        adapter = FixtureAdapter()
        with self.client(adapter) as client:
            job = self.finish(client, self.start(client))
            self.assertEqual(job["status"], "completed")
            self.assertEqual(job["accuracy"], 0.8)
            self.assertEqual(job["result"]["id"], job["id"])
            self.assertIsNone(job["result"]["metrics"]["revenue"])
            response = client.post("/predictions", json={"analysis_id": job["id"], "csv": "amount,date\n12,2026-01-01\n"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertFalse(response.json()["checked_against_database"])
            self.assertEqual(adapter.last_prediction["analysis_id"], job["id"])

    def test_low_accuracy_result_is_never_exposed_or_used(self):
        with self.client(FixtureAdapter(score=0.5999)) as client:
            job = self.finish(client, self.start(client))
            self.assertEqual(job["status"], "failed")
            self.assertIsNone(job["result"])
            self.assertIsNone(job["accuracy"])
            response = client.post("/predictions", json={"analysis_id": job["id"], "csv": "amount\n12\n"})
            self.assertEqual(response.status_code, 400)

    def test_accuracy_boundary_is_inclusive(self):
        with self.client(FixtureAdapter(score=0.60)) as client:
            self.assertEqual(self.finish(client, self.start(client))["status"], "completed")

    def test_supervised_requires_a_score_and_explicit_validity(self):
        for score, valid in ((None, True), (0.9, False)):
            with self.subTest(score=score, valid=valid), self.client(FixtureAdapter(score, valid)) as client:
                job = self.finish(client, self.start(client))
                self.assertEqual(job["status"], "failed")
                self.assertIsNone(job["result"])

    def test_unsupervised_uses_validity_without_inventing_accuracy(self):
        with self.client(FixtureAdapter(score=None)) as client:
            job = self.finish(client, self.start(client, mode="unsupervised"))
            self.assertEqual(job["status"], "completed")
            self.assertIsNone(job["accuracy"])
            self.assertIsNone(job["result"]["accuracy"])
        with self.client(FixtureAdapter(score=None, valid=False)) as client:
            job = self.finish(client, self.start(client, mode="unsupervised"))
            self.assertEqual(job["status"], "failed")
            self.assertIsNone(job["result"])

    def test_unsupervised_rejects_string_validation_flag(self):
        with self.client(FixtureAdapter(score=None, valid="true")) as client:
            self.assertEqual(self.finish(client, self.start(client, mode="unsupervised"))["status"], "failed")

    def test_analysis_rejects_bad_connection_tables_and_targets(self):
        with self.client(FixtureAdapter()) as client:
            for changes in ({"connection_id": "missing"}, {"tables": ["private"]}, {"target": "missing"}, {"target": None}):
                with self.subTest(changes=changes):
                    response = self.start(client, **changes)
                    self.assertIn(response.status_code, (400, 422))

    def test_csv_validation_rejects_bad_structure(self):
        with self.client(FixtureAdapter()) as client:
            job = self.finish(client, self.start(client))
            for invalid_csv in ("amount", "amount,amount\n1,2", "amount,date\n1", "amount,date\n1,2\n3", 'amount\n"unterminated'):
                with self.subTest(csv=invalid_csv):
                    response = client.post("/predictions", json={"analysis_id": job["id"], "csv": invalid_csv})
                    self.assertEqual(response.status_code, 400)

    def test_job_polling_and_health_remain_responsive_during_training(self):
        started, release = threading.Event(), threading.Event()
        adapter = FixtureAdapter()
        original = adapter.run_analysis

        def block(request, progress):
            progress({"status": "retrying", "step": 1, "progress": 20, "message": "Checking again."})
            started.set()
            if not release.wait(timeout=3):
                raise RuntimeError("Fixture not released")
            return original(request, progress)

        adapter.run_analysis = block
        with self.client(adapter) as client:
            response = self.start(client)
            try:
                self.assertTrue(started.wait(timeout=1))
                job = client.get(f'/analyses/{response.json()["id"]}').json()
                self.assertEqual(job["status"], "retrying")
                self.assertTrue(client.get("/health").json()["engine_ready"])
            finally:
                release.set()
            self.assertEqual(self.finish(client, response)["status"], "completed")

    def test_browser_origin_and_host_protection(self):
        with self.client(FixtureAdapter()) as client:
            allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
            self.assertEqual(allowed.headers["access-control-allow-origin"], "http://localhost:5173")
            blocked = client.post("/connections/test", json=CONFIG, headers={"Origin": "https://untrusted.example"})
            self.assertEqual(blocked.status_code, 403)
            self.assertEqual(client.get("/health", headers={"Host": "untrusted.example"}).status_code, 400)
            self.assertEqual(allowed.headers["cache-control"], "no-store")

    def test_plugin_failure_does_not_claim_readiness(self):
        with patch.dict("os.environ", {"KHAMI_ENGINE_MODULE": "package_that_does_not_exist"}):
            self.assertIsNone(load_adapter())


if __name__ == "__main__":
    unittest.main()
