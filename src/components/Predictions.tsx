import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
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
      setError("This file is too large. Use a CSV under 5 MB.");
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
              "Less likely to return",
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
          title="Run an analysis first"
          description="Choose “Predict an outcome” in a new analysis. Once it passes the quality check, you can use it to predict outcomes for new records."
          action={
            <Button onClick={onNew}>
              New analysis
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
            <h3>Generate predictions</h3>
            <p>Choose a completed analysis and upload new records.</p>
          </div>
        </div>
        <div className="prediction-form">
          <label className="field">
            1. Choose an analysis
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
          <label className="field-label">2. Upload new records</label>
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
                Choose CSV file
              </Button>
              {settings.demo && (
                <button
                  className="text-button"
                  onClick={() => loadCsv(exampleCsv, "sample-customers.csv")}
                >
                  Use sample file
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
                <small>{preview.length.toLocaleString()} rows ready</small>
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
              {settings.demo
                ? "Sample predictions only"
                : "Sent to your configured engine"}
            </span>
            <Button
              disabled={!csv || !analysisId}
              loading={busy}
              onClick={predict}
            >
              {busy ? "Generating predictions…" : "Generate predictions"}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </div>
        </div>
      </div>
      <aside className="prediction-guide">
        <h3>Prepare your CSV</h3>
        <div className="guide-step">
          <span>1</span>
          <div>
            <strong>Use matching columns</strong>
            <p>Use the same column names as your analyzed data.</p>
          </div>
        </div>
        <div className="guide-step">
          <span>2</span>
          <div>
            <strong>Leave out the outcome</strong>
            <p>You can omit the column you want to predict.</p>
          </div>
        </div>
        <div className="guide-step">
          <span>3</span>
          <div>
            <strong>Review the predictions</strong>
            <p>
              Check the results before using them to make business decisions.
            </p>
          </div>
        </div>
      </aside>
      {(result || busy) && (
        <section className="card prediction-results">
          <div className="card-heading">
            <div>
              <h3>{busy ? "Generating predictions…" : "Prediction results"}</h3>
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
              <p>
                {settings.demo
                  ? "Preparing sample predictions."
                  : "Processing the new records."}
              </p>
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
