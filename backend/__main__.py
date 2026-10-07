"""Safe default launcher; a single local process owns all engine state."""

import uvicorn


if __name__ == "__main__":
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, workers=1, access_log=False)
