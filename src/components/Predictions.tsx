import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import type { AnalysisRecord, PredictionResult, Settings } from "../types";
import { api, downloadFile, errorMessage } from "../api";
import { Badge, Button, EmptyState, Select } from "./UI";

const exampleCsv =
  "customer_id,category,quantity,price\nC-1001,Electronics,2,129.00\nC-1002,Home & living,1,45.00\nC-1003,Clothing,3,32.00\nC-1004,Beauty,2,28.50\nC-1005,Electronics,1,249.00";

export default function Predictions({
  settings,
  analyses,
  onNew,
}: {
  settings: Settings;
  analyses: AnalysisRecord[];
  onNew: () => void;
}) {
  const available = analyses.filter(
    (analysis) =>
      analysis.mode === "supervised" && analysis.status === "completed",
  );
  const [analysisId, setAnalysisId] = useState(available[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function loadCsv(text: string, name: string) {
    setError("");
    setResult(null);
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
    });
    if (
      parsed.errors.length ||
      !parsed.meta.fields?.length ||
      !parsed.data.length ||
      parsed.meta.fields.some((field) => !field.trim())
    ) {
      setError(
        "This file needs a header row and at least one complete data row. Please check the CSV and try again.",
      );
      return;
    }
    if (parsed.data.length > 5000) {
      setError(
        "Please use a file with 5,000 rows or fewer for each prediction batch.",
      );
      return;
    }
    setCsv(text);
    setFileName(name);
    setPreview(parsed.data);
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(
        "Choose a CSV file. You can save a spreadsheet as CSV from Excel or Google Sheets.",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("This file is a little large. Please use a CSV under 5 MB.");
      return;
    }
    loadCsv(await file.text(), file.name);
  }

  async function predict() {
    if (!csv || !analysisId) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (settings.demo) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setResult({
          rows: preview.map((row, index) => ({
            ...row,
            predicted_outcome: [
              "Likely to return",
              "May need a nudge",
              "Likely to return",
            ][index % 3],
            confidence: `${[94, 82, 91, 88, 96][index % 5]}%`,
          })),
          summary: `${preview.length} sample predictions generated. These illustrate the workflow and are not based on a trained model.`,
          checked_against_database: false,
        });
      } else setResult(await api.predict(settings.engineUrl, analysisId, csv));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!available.length)
    return (
      <div className="card">
        <EmptyState
          icon={<Sparkles size={28} />}
          title="First, give Khami something to learn from"
          description="Run an analysis focused on a specific outcome. Then use what Khami learns to make predictions about new data."
          action={
            <Button onClick={onNew}>
              Create an analysis
              <ArrowRight size={16} />
            </Button>
          }
        />
      </div>
    );

  return (
    <div className="prediction-layout">
      <div className="card prediction-main">
        <div className="card-heading">
          <div>
            <h3>A little foresight for your next decision</h3>
            <p>Add new data and put your previous analysis to work.</p>
          </div>
          <span className="soft-icon">
            <Sparkles size={20} />
          </span>
        </div>
        <div className="prediction-form">
          <label className="field">
            1. Choose what Khami has learned
            <Select
              value={analysisId}
              onChange={(event) => {
                setAnalysisId(event.target.value);
                setResult(null);
              }}
            >
              {available.map((analysis) => (
                <option key={analysis.id} value={analysis.id}>
                  {analysis.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field-label">
            2. Add the data you’d like to understand
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden-input"
            aria-label="Upload prediction CSV"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          {!fileName ? (
            <div
              className={`drop-zone ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void loadFile(event.dataTransfer.files[0]);
              }}
            >
              <span className="upload-icon">
                <UploadCloud size={29} strokeWidth={1.5} />
              </span>
              <h3>Drop your CSV here</h3>
              <p>Up to 5 MB · 5,000 rows per batch</p>
              <Button
                variant="secondary"
                onClick={() => fileInput.current?.click()}
              >
                Browse files
              </Button>
              {settings.demo && (
                <button
                  className="text-button"
                  onClick={() => loadCsv(exampleCsv, "sample-customers.csv")}
                >
                  Or try a sample file
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          ) : (
            <div className="uploaded-file">
              <span className="source-symbol">
                <FileSpreadsheet size={23} />
              </span>
              <div>
                <strong>{fileName}</strong>
                <small>
                  {preview.length.toLocaleString()} rows ready to explore
                </small>
              </div>
              <button
                className="icon-button"
                aria-label="Remove uploaded file"
                onClick={() => {
                  setCsv("");
                  setFileName("");
                  setPreview([]);
                  setResult(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-note" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="prediction-actions">
            <span>
              <ShieldCheck size={15} />
              Processed on your machine
            </span>
            <Button
              disabled={!csv || !analysisId}
              loading={busy}
              onClick={predict}
            >
              {busy ? "Finding your predictions" : "Generate predictions"}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </div>
        </div>
      </div>
      <aside className="prediction-guide">
        <span className="guide-icon">
          <Lightbulb size={24} />
        </span>
        <h3>From patterns to possibilities.</h3>
        <p>
          Khami uses what it learned from your existing data to help you
          understand what might happen next.
        </p>
        <div className="guide-step">
          <span>1</span>
          <div>
            <strong>Use matching columns</strong>
            <p>
              Your new file should have the same details as the data you
              analyzed.
            </p>
          </div>
        </div>
        <div className="guide-step">
          <span>2</span>
          <div>
            <strong>Leave the answer blank</strong>
            <p>
              You don’t need to include the outcome you’re asking Khami to
              predict.
            </p>
          </div>
        </div>
        <div className="guide-step">
          <span>3</span>
          <div>
            <strong>Keep your judgment in the loop</strong>
            <p>
              Predictions help you decide. Your business experience matters,
              too.
            </p>
          </div>
        </div>
      </aside>
      {(result || busy) && (
        <section className="card prediction-results">
          <div className="card-heading">
            <div>
              <h3>{busy ? "Connecting the dots…" : "Your predictions"}</h3>
              {result && <p>{result.summary}</p>}
            </div>
            {result && (
              <Button
                variant="secondary"
                onClick={() =>
                  downloadFile(
                    "khami-predictions.csv",
                    Papa.unparse(result.rows, { escapeFormulae: true }),
                    "text/csv",
                  )
                }
              >
                <Download size={15} />
                Export CSV
              </Button>
            )}
          </div>
          {busy ? (
            <div className="prediction-loading">
              <Loader2 className="spin" size={28} />
              <p>Your local engine is working through the new data.</p>
            </div>
          ) : (
            result && (
              <>
                <div className="result-badges">
                  {settings.demo && (
                    <Badge tone="amber">
                      <Sparkles size={12} />
                      Sample predictions
                    </Badge>
                  )}
                  <Badge
                    tone={result.checked_against_database ? "green" : "gray"}
                  >
                    {result.checked_against_database ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <ShieldCheck size={12} />
                    )}
                    {result.checked_against_database
                      ? "Checked against your database"
                      : "Not checked against database"}
                  </Badge>
                </div>
                <div className="data-table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {Object.keys(result.rows[0] ?? {}).map((key) => (
                          <th key={key}>{key.replaceAll("_", " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 100).map((row, index) => (
                        <tr key={index}>
                          {Object.keys(result.rows[0] ?? {}).map((key) => (
                            <td key={key}>{String(row[key] ?? "—")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.rows.length > 100 && (
                  <p className="table-footnote">
                    Showing the first 100 of {result.rows.length} rows. Export
                    CSV for the full results.
                  </p>
                )}
              </>
            )
          )}
        </section>
      )}
    </div>
  );
}
