"""Copy outside backend/, then connect these methods to the existing engine.

This file deliberately refuses to initialize until real engine integration exists.
No data, predictions, algorithm selection, or accuracy is fabricated here.
See docs/ENGINE_API.md for every response shape.
"""

from collections.abc import Callable


class KhamiAdapter:
    def __init__(self, engine):
        self.engine = engine

    def test_connection(self, config: dict) -> dict:
        # config includes a plaintext password in memory. Do not print/store it.
        # Return an opaque connection_id and public table/column metadata.
        raise NotImplementedError("Map the existing engine's database validation here.")

    def run_analysis(self, request: dict, report_progress: Callable[[dict], None]) -> dict:
        # request.analysis_id is supplied by the bridge. Keep the trained model
        # associated with this ID so predict() can use precisely that model.
        # The engine owns profiling, best-five selection, CSV conversion,
        # cleaning/exploration, training/interpretation, validity, and retries.
        raise NotImplementedError("Map the existing engine's complete pipeline here.")

    def predict(self, request: dict) -> dict:
        # Use request.analysis_id + request.csv. Report whether the engine
        # actually checked predictions against the connected database.
        raise NotImplementedError("Map the existing engine's prediction function here.")


def create_adapter() -> KhamiAdapter:
    # Import and initialize the user's real engine here, then return
    # KhamiAdapter(engine) after implementing all three methods above.
    raise NotImplementedError("Connect the existing Python engine before enabling this adapter.")
