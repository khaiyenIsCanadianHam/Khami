import { useState } from "react";
import {
  CheckCircle2,
  Database,
  FlaskConical,
  LockKeyhole,
  PlugZap,
  Server,
  ShieldCheck,
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
          ? "Connected. Your Python engine is ready to work."
          : "The local API is running. Connect your Python engine adapter to start analyzing real data.",
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
                <h3>Your local engine</h3>
                <p>The connection between Khami and your Python program.</p>
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
                The API runs on the same machine as this app.
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
                <h3>Make yourself at home</h3>
                <p>Explore Khami before connecting your business data.</p>
              </div>
            </div>
          </div>
          <div className="settings-body">
            <div className="toggle-row">
              <div>
                <strong>Use demo workspace</strong>
                <p>
                  Try every step with a fictional retail business and sample
                  results.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={draft.demo}
                aria-label="Use demo workspace"
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
              Demo and live data are kept in separate workspaces.
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
          <Button onClick={save}>{saved ? "Saved" : "Save changes"}</Button>
        </div>
      </div>
      <aside>
        <div className="local-promise">
          <span className="promise-icon">
            <LockKeyhole size={24} />
          </span>
          <h3>
            Your business.
            <br />
            Your data. Your machine.
          </h3>
          <p>
            Your database credentials and business data stay between this
            browser and your local Python engine.
          </p>
          <ul>
            <li>
              <ShieldCheck size={15} />
              No cloud data uploads
            </li>
            <li>
              <ShieldCheck size={15} />
              No passwords stored in this browser
            </li>
            <li>
              <ShieldCheck size={15} />
              You control the connection
            </li>
          </ul>
        </div>
        <div className="setup-guide">
          <Terminal size={19} />
          <h4>Connecting your Python engine</h4>
          <p>
            Start the included local API, then connect your existing program
            with its adapter. The setup guide walks through each step.
          </p>
          <code>python -m uvicorn backend.app:app</code>
          <small>See README.md and docs/ENGINE_API.md in your project.</small>
        </div>
      </aside>
    </div>
  );
}
