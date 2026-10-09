import { useState } from "react";
import {
  CheckCircle2,
  Database,
  FlaskConical,
  PlugZap,
  Server,
  Terminal,
  XCircle,
} from "lucide-react";
import { api, errorMessage, normalizeEngineUrl } from "../api";
import type { Settings as SettingsType } from "../types";
import { Badge, Button } from "./UI";

export default function Settings({
  settings,
  onSave,
}: {
  settings: SettingsType;
  onSave: (settings: SettingsType) => boolean;
}) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function test() {
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const result = await api.health(draft.engineUrl);
      if (result.status !== "ok")
        throw new Error("The local service is running but is not ready yet.");
      setStatus(
        result.engine_ready
          ? "Connected. Your engine is ready."
          : "The API is running. Connect your Python program using the adapter to analyze your data.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function save() {
    try {
      const engineUrl = normalizeEngineUrl(draft.engineUrl);
      const success = onSave({ ...draft, engineUrl });
      if (success) {
        setDraft({ ...draft, engineUrl });
        setSaved(true);
        setError("");
      }
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  return (
    <div className="settings-layout">
      <div className="settings-main">
        <section className="card settings-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <span className="soft-icon">
                <Server size={20} />
              </span>
              <div>
                <h3>Engine connection</h3>
                <p>Connect Khami to your Python program.</p>
              </div>
            </div>
            <Badge tone="gray">Owner settings</Badge>
          </div>
          <div className="settings-body">
            <label className="field">
              Engine address
              <input
                type="url"
                value={draft.engineUrl}
                onChange={(event) => {
                  setDraft({ ...draft, engineUrl: event.target.value });
                  setSaved(false);
                  setStatus("");
                }}
                placeholder="http://localhost:8000"
              />
              <span className="field-help">
                Use http://localhost:8000 for an engine running on this machine.
              </span>
            </label>
            <Button variant="secondary" loading={busy} onClick={test}>
              <PlugZap size={16} />
              Test engine connection
            </Button>
            {status && (
              <div className="success-note" role="status">
                <CheckCircle2 size={17} />
                {status}
              </div>
            )}
            {error && (
              <div className="error-note" role="alert">
                <XCircle size={17} />
                {error}
              </div>
            )}
          </div>
        </section>
        <section className="card settings-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <span className="soft-icon">
                <FlaskConical size={20} />
              </span>
              <div>
                <h3>Sample data</h3>
              </div>
            </div>
          </div>
          <div className="settings-body">
            <div className="toggle-row">
              <div>
                <strong>Use sample data</strong>
                <p>Try the app with a fictional retail business.</p>
              </div>
              <button
                role="switch"
                aria-checked={draft.demo}
                aria-label="Use sample data"
                className={`toggle ${draft.demo ? "on" : ""}`}
                onClick={() => {
                  setDraft({ ...draft, demo: !draft.demo });
                  setSaved(false);
                }}
              >
                <span />
              </button>
            </div>
            <div className="helper-note">
              <Database size={16} />
              Sample data and your connected data are kept separate.
            </div>
          </div>
        </section>
        <div className="settings-save">
          <span>
            {saved && (
              <>
                <CheckCircle2 size={16} />
                Settings saved
              </>
            )}
          </span>
          <Button onClick={save}>{saved ? "Saved" : "Save settings"}</Button>
        </div>
      </div>
      <aside>
        <div className="local-promise">
          <h3>Where your data goes</h3>
          <p>
            Connection details and prediction files are sent to the engine
            address you choose. Use a local address to process them on your
            machine.
          </p>
          <p>Database passwords aren’t saved in this browser.</p>
        </div>
        <div className="setup-guide">
          <Terminal size={19} />
          <h4>Start your engine</h4>
          <p>
            The included API needs an adapter for your Python program before it
            can analyze real data.
          </p>
          <code>python -m uvicorn backend.app:app</code>
          <small>See README.md and docs/ENGINE_API.md in your project.</small>
        </div>
      </aside>
    </div>
  );
}
