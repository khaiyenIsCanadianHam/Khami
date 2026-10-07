import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CircleHelp,
  Database,
  Fingerprint,
  FolderSearch,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  XCircle,
} from "lucide-react";
import { api, errorMessage } from "../api";
import { sampleConnection } from "../data";
import type {
  AnalysisInput,
  Connection,
  ConnectionInput,
  Mode,
  Settings,
} from "../types";
import { Badge, Button, Modal, Select, StepCheck } from "./UI";

type Props = {
  settings: Settings;
  connections: Connection[];
  onClose: () => void;
  onConnect: (connection: Connection) => void;
  onRun: (input: AnalysisInput, name: string) => Promise<void>;
  sourceOnly?: boolean;
};

export default function AnalysisWizard({
  settings,
  connections,
  onClose,
  onConnect,
  onRun,
  sourceOnly,
}: Props) {
  const [step, setStep] = useState(0);
  const [connection, setConnection] = useState<Connection | null>(
    connections[0] ?? null,
  );
  const [addSource, setAddSource] = useState(
    connections.length === 0 || !!sourceOnly,
  );
  const [input, setInput] = useState<ConnectionInput>({
    type: "postgresql",
    host: "localhost",
    port: "5432",
    database: "",
    username: "",
    password: "",
  });
  const [tables, setTables] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>("supervised");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("My business overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const columns = useMemo(
    () => [
      ...new Set(
        connection?.tables
          .filter((t) => tables.includes(t.name))
          .flatMap((t) => t.columns.map((c) => c.name)) ?? [],
      ),
    ],
    [connection, tables],
  );

  async function testConnection() {
    setError("");
    if (
      !input.database.trim() ||
      (input.type !== "sqlite" &&
        (!input.host.trim() || !input.username.trim()))
    ) {
      setError(
        "Add your database name, host, and username so we can find your data.",
      );
      return;
    }
    setBusy(true);
    try {
      if (settings.demo) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const demoConnection = {
          ...sampleConnection,
          connection_id: `demo-${Date.now()}`,
          name: `${input.database} (sample)`,
          type: input.type,
        };
        setConnection(demoConnection);
        onConnect(demoConnection);
      } else {
        const result = await api.connect(settings.engineUrl, input);
        if (!result.connection_id || !Array.isArray(result.tables))
          throw new Error(
            "The engine could not describe this database. Check your adapter configuration.",
          );
        setConnection({ ...result, type: input.type });
        onConnect({ ...result, type: input.type });
      }
      setInput((previous) => ({ ...previous, password: "" }));
      setAddSource(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setError("");
    if (step === 0) {
      if (!connection) return;
      if (sourceOnly) {
        onClose();
        return;
      }
      if (!tables.length) {
        const selected = connection.tables
          .slice(0, 2)
          .map((table) => table.name);
        setTables(selected);
        setLabels(
          Object.fromEntries(
            connection.tables.map((table) => [
              table.name,
              /sale|order|revenue/.test(table.name)
                ? "Sales & transactions"
                : /customer|user|client/.test(table.name)
                  ? "Customers & people"
                  : "Products & inventory",
            ]),
          ),
        );
      }
    }
    if (step === 1 && !tables.length) {
      setError("Choose at least one table to explore.");
      return;
    }
    if (
      step === 2 &&
      mode === "supervised" &&
      (!target || !columns.includes(target))
    ) {
      setError("Choose what you’d like to understand or predict.");
      return;
    }
    setStep(step + 1);
  }

  async function run() {
    if (!connection || !name.trim()) {
      setError("Give this analysis a name so you can find it later.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRun(
        {
          connection_id: connection.connection_id,
          tables,
          labels,
          mode,
          ...(mode === "supervised" ? { target } : {}),
        },
        name.trim(),
      );
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={sourceOnly ? "Connect your data" : "Let’s find your next insight"}
      subtitle={
        sourceOnly
          ? "A secure connection to the data you already have."
          : "A few simple choices. We’ll take care of the rest."
      }
      onClose={busy ? () => {} : onClose}
      wide
    >
      {!sourceOnly && (
        <div className="wizard-steps">
          {["Your data", "Give it context", "Your goal", "Ready to go"].map(
            (label, index) => (
              <div
                className={`wizard-step ${index === step ? "current" : ""}`}
                key={label}
              >
                <StepCheck
                  active={index === step}
                  complete={index < step}
                  number={index + 1}
                />
                <span>{label}</span>
              </div>
            ),
          )}
        </div>
      )}
      <div className="wizard-body">
        {settings.demo && (
          <div className="demo-notice">
            <Sparkles size={15} />
            <span>You’re in demo mode. This flow uses sample data.</span>
          </div>
        )}
        {step === 0 && (
          <>
            <div className="section-heading">
              <h3>Where does your data live?</h3>
              <p>Choose a connected source, or add your business database.</p>
            </div>
            {!addSource && (
              <div className="source-choices">
                {connections.map((source) => (
                  <button
                    key={source.connection_id}
                    className={`source-choice ${connection?.connection_id === source.connection_id ? "selected" : ""}`}
                    onClick={() => {
                      setConnection(source);
                      setTables([]);
                    }}
                  >
                    <span className="source-symbol">
                      <Database size={22} />
                    </span>
                    <span>
                      <strong>{source.name}</strong>
                      <small>
                        {source.type || "Database"} · {source.tables.length}{" "}
                        tables
                      </small>
                    </span>
                    {connection?.connection_id === source.connection_id ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <span className="radio-circle" />
                    )}
                  </button>
                ))}
                {connection &&
                  !connections.some(
                    (c) => c.connection_id === connection.connection_id,
                  ) && (
                    <div className="success-note">
                      <CheckCircle2 size={18} />
                      Connected to {connection.name}
                    </div>
                  )}
                <button
                  className="add-source-link"
                  onClick={() => {
                    setAddSource(true);
                    setError("");
                  }}
                >
                  + Connect another database
                </button>
              </div>
            )}
            {addSource && (
              <div className="connection-form">
                <label className="field">
                  Database type
                  <Select
                    value={input.type}
                    onChange={(event) =>
                      setInput({
                        ...input,
                        type: event.target.value,
                        port: event.target.value === "mysql" ? "3306" : "5432",
                      })
                    }
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                  </Select>
                </label>
                {input.type !== "sqlite" && (
                  <div className="form-row">
                    <label className="field">
                      Host
                      <input
                        placeholder="localhost"
                        value={input.host}
                        onChange={(event) =>
                          setInput({ ...input, host: event.target.value })
                        }
                      />
                    </label>
                    <label className="field field-small">
                      Port
                      <input
                        inputMode="numeric"
                        value={input.port}
                        onChange={(event) =>
                          setInput({ ...input, port: event.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                <label className="field">
                  {input.type === "sqlite"
                    ? "Database file path"
                    : "Database name"}
                  <input
                    placeholder={
                      input.type === "sqlite"
                        ? "/path/to/your/database.db"
                        : "e.g. my_business"
                    }
                    value={input.database}
                    onChange={(event) =>
                      setInput({ ...input, database: event.target.value })
                    }
                  />
                </label>
                {input.type !== "sqlite" && (
                  <div className="form-row">
                    <label className="field">
                      Username
                      <input
                        autoComplete="off"
                        placeholder="Database username"
                        value={input.username}
                        onChange={(event) =>
                          setInput({ ...input, username: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Password
                      <div className="input-icon">
                        <KeyRound size={15} />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Database password"
                          value={input.password}
                          onChange={(event) =>
                            setInput({ ...input, password: event.target.value })
                          }
                        />
                      </div>
                    </label>
                  </div>
                )}
                <div className="form-actions">
                  {connections.length > 0 && (
                    <Button variant="ghost" onClick={() => setAddSource(false)}>
                      Back to sources
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={testConnection}
                  >
                    <Database size={16} />
                    {settings.demo
                      ? "Try sample connection"
                      : "Test connection"}
                  </Button>
                </div>
              </div>
            )}
            <div className="privacy-note">
              <LockKeyhole size={16} />
              <span>
                Your data stays on your machine. Credentials are sent only to
                your local engine and aren’t saved in this browser.
              </span>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="section-heading">
              <h3>A little context goes a long way</h3>
              <p>
                Select your tables and tell us what they contain. Khami will
                work out the details.
              </p>
            </div>
            <div className="table-choices">
              {connection?.tables.map((table) => (
                <div
                  className={`table-choice ${tables.includes(table.name) ? "selected" : ""}`}
                  key={table.name}
                >
                  <label className="table-choice-label">
                    <input
                      type="checkbox"
                      checked={tables.includes(table.name)}
                      onChange={() =>
                        setTables((previous) =>
                          previous.includes(table.name)
                            ? previous.filter((name) => name !== table.name)
                            : [...previous, table.name],
                        )
                      }
                    />
                    <span className="table-icon">
                      <Table2 size={19} />
                    </span>
                    <span>
                      <strong>{table.name}</strong>
                      <small>
                        {table.rows.toLocaleString()} rows ·{" "}
                        {table.columns.length} columns
                      </small>
                    </span>
                  </label>
                  <Select
                    aria-label={`Category for ${table.name}`}
                    value={labels[table.name] || "Other business data"}
                    onChange={(event) =>
                      setLabels({ ...labels, [table.name]: event.target.value })
                    }
                  >
                    {[
                      "Sales & transactions",
                      "Customers & people",
                      "Products & inventory",
                      "Dates & events",
                      "Categories & groups",
                      "Other business data",
                    ].map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </Select>
                  {tables.includes(table.name) && (
                    <div className="column-preview">
                      {table.columns.map((column) => (
                        <span key={column.name}>
                          {column.name}
                          <small>{column.type}</small>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="helper-note">
              <CircleHelp size={16} />
              Not sure about a column? That’s okay. We also check the actual
              data.
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="section-heading">
              <h3>What would you like to learn?</h3>
              <p>
                Pick the approach that best fits your question. No technical
                knowledge needed.
              </p>
            </div>
            <div className="mode-choices">
              <button
                className={`mode-choice ${mode === "supervised" ? "selected" : ""}`}
                onClick={() => setMode("supervised")}
              >
                <span className="mode-icon">
                  <Target size={25} />
                </span>
                <span className="mode-choice-top">
                  <strong>Understand a specific outcome</strong>
                  {mode === "supervised" && <CheckCircle2 size={19} />}
                </span>
                <p>Find what drives a result and use it to make predictions.</p>
                <small>“What affects our sales?” · “Who might return?”</small>
              </button>
              <button
                className={`mode-choice ${mode === "unsupervised" ? "selected" : ""}`}
                onClick={() => setMode("unsupervised")}
              >
                <span className="mode-icon">
                  <FolderSearch size={25} />
                </span>
                <span className="mode-choice-top">
                  <strong>Discover something new</strong>
                  {mode === "unsupervised" && <CheckCircle2 size={19} />}
                </span>
                <p>
                  Find natural groups, hidden patterns, and unusual activity.
                </p>
                <small>
                  “Who are our customer groups?” · “What stands out?”
                </small>
              </button>
            </div>
            {mode === "supervised" && (
              <label className="field target-field">
                What outcome should we focus on?
                <Select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Choose a column</option>
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
                <span className="field-help">
                  Choose the value you want to better understand or predict.
                </span>
              </label>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <div className="review-hero">
              <span>
                <Sparkles size={26} />
              </span>
              <h3>Your next good decision starts here.</h3>
              <p>
                We’ll clean, explore, and double-check your data. You’ll get
                clear findings you can actually use.
              </p>
            </div>
            <label className="field">
              Analysis name
              <input
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="review-summary">
              <div>
                <Database size={17} />
                <span>Data source</span>
                <strong>{connection?.name}</strong>
              </div>
              <div>
                <Table2 size={17} />
                <span>Tables</span>
                <strong>{tables.join(", ")}</strong>
              </div>
              <div>
                <Fingerprint size={17} />
                <span>Your goal</span>
                <strong>
                  {mode === "supervised"
                    ? `Understand ${target.replaceAll("_", " ")}`
                    : "Discover patterns"}
                </strong>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Quality check</span>
                <strong>
                  {mode === "supervised"
                    ? "At least 60% predictive accuracy"
                    : "Patterns checked for consistency"}
                </strong>
              </div>
            </div>
            <div className="helper-note">
              <Check size={16} />
              Only findings that pass our checks will appear on your dashboard.
            </div>
          </>
        )}
        {error && (
          <div className="error-note" role="alert">
            <XCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>
      <footer className="modal-footer">
        <div>
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
          ) : (
            <Badge tone="gray">
              <ShieldCheck size={13} />
              Private by design
            </Badge>
          )}
        </div>
        {step < 3 ? (
          <Button
            onClick={next}
            disabled={busy || (step === 0 && (!connection || addSource))}
          >
            {sourceOnly ? "Done" : "Continue"}
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={run} loading={busy}>
            <BarChart3 size={16} />
            Start analysis
          </Button>
        )}
      </footer>
    </Modal>
  );
}
