import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Database,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type {
  AnalysisRecord,
  AnalysisResult,
  Connection,
  Insight,
} from "../types";
import { Badge, Button, EmptyState, Select } from "./UI";
import { CategoryChart, CustomerChart, RevenueChart } from "./Charts";

const money = (value: number | null, digits = 0) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: digits,
      }).format(value);

export function AnalysesTable({
  analyses,
  onSelect,
  compact = false,
}: {
  analyses: AnalysisRecord[];
  onSelect: (analysis: AnalysisRecord) => void;
  compact?: boolean;
}) {
  return (
    <div className="data-table-scroll">
      <table
        className={`data-table analysis-table ${compact ? "compact" : ""}`}
      >
        <thead>
          <tr>
            <th>Analysis</th>
            <th>Goal</th>
            <th>Records</th>
            <th>Status</th>
            <th>Created</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id} onClick={() => onSelect(analysis)}>
              <td>
                <button
                  className="table-title-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(analysis);
                  }}
                >
                  <span className="analysis-mini-icon">
                    {analysis.mode === "supervised" ? (
                      <ChartNoAxesCombined size={17} />
                    ) : (
                      <Layers3 size={17} />
                    )}
                  </span>
                  <span>
                    {analysis.name}
                    <small>
                      {analysis.demo ? "Sample data" : "Local data"}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                {analysis.mode === "supervised"
                  ? "Predict an outcome"
                  : "Find patterns"}
              </td>
              <td>
                {analysis.result
                  ? analysis.result.rows.toLocaleString()
                  : analysis.tables.join(", ")}
              </td>
              <td>
                <Badge
                  tone={
                    analysis.status === "completed"
                      ? "green"
                      : analysis.status === "failed"
                        ? "amber"
                        : "blue"
                  }
                >
                  {analysis.status === "completed" && (
                    <CheckCircle2 size={12} />
                  )}
                  {analysis.status === "completed"
                    ? "Completed"
                    : analysis.status === "failed"
                      ? "Needs attention"
                      : "In progress"}
                </Badge>
              </td>
              <td>
                {new Date(analysis.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td>
                <ArrowUpRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DashboardProps = {
  result?: AnalysisResult;
  analyses: AnalysisRecord[];
  connections: Connection[];
  demo: boolean;
  onNew: () => void;
  onSelect: (analysis: AnalysisRecord) => void;
  onAllAnalyses: () => void;
  onSources: () => void;
  onExport: () => void;
  onRerun: () => void;
  onInsight: (insight: Insight) => void;
  running: boolean;
};

export default function Dashboard({
  result,
  analyses,
  connections,
  demo,
  onNew,
  onSelect,
  onAllAnalyses,
  onSources,
  onExport,
  onRerun,
  onInsight,
  running,
}: DashboardProps) {
  const [months, setMonths] = useState(6);
  const revenue = result?.revenue.slice(-months) ?? [];
  const actualRevenue = revenue.filter((point) => point.actual !== null);
  const periodRevenue =
    result && months < 6
      ? actualRevenue.length
        ? actualRevenue.reduce((sum, point) => sum + (point.actual ?? 0), 0)
        : null
      : (result?.metrics.revenue ?? null);
  const updated = result ? new Date(result.updatedAt) : null;
  const dateLabel =
    updated && !Number.isNaN(updated.getTime())
      ? updated.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Date unavailable";
  const stats = [
    {
      title: "Total revenue",
      value: money(periodRevenue),
      description:
        months === 6
          ? "Across the analysis period"
          : `Last ${months === 1 ? "month" : `${months} months`}`,
      info: "The total revenue in the selected period.",
    },
    {
      title: "Active customers",
      value: result?.metrics.customers?.toLocaleString() ?? "—",
      description: "In this dataset",
      info: "Customers represented in this analysis.",
    },
    {
      title: "Average order value",
      value: money(result?.metrics.orderValue ?? null, 2),
      description: "Per order",
      info: "The average amount spent per order.",
    },
    {
      title: "Data quality",
      value: result?.quality == null ? "—" : `${result.quality.toFixed(1)}%`,
      description: "Records passing quality checks",
      info: "The percentage of records that passed the engine’s quality checks.",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>
            {result
              ? "Review your results and decide what to explore next."
              : "Connect your data to run your first analysis."}
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={onExport} disabled={!result}>
            <ArrowDownToLine size={16} />
            Export report
          </Button>
          <Button onClick={onNew}>
            <Plus size={17} />
            New analysis
          </Button>
        </div>
      </div>
      {!result ? (
        <section className="card welcome-card">
          <EmptyState
            icon={<ChartNoAxesCombined size={30} />}
            title="No analysis results yet"
            description="Connect a database, choose the tables to use, and tell Khami what you want to learn."
            action={
              <Button onClick={onNew}>
                Create your first analysis
                <ArrowRight size={16} />
              </Button>
            }
          />
          <div className="welcome-note">
            <ShieldCheck size={16} />
            Your local Python engine processes the data.
          </div>
        </section>
      ) : (
        <>
          <div className="report-context">
            <div>
              <h2>{result.name}</h2>
              <div className="report-source">
                <button onClick={onSources}>
                  <Database size={15} />
                  {connections[0]?.name || "Data sources"}
                  <ChevronDown size={13} />
                </button>
                <span className="context-separator">/</span>
                {demo ? (
                  <Badge tone="amber">Sample data</Badge>
                ) : (
                  <span>Local data</span>
                )}
              </div>
            </div>
            <div className="report-refresh">
              <span>Last analyzed {dateLabel}</span>
              <Button variant="secondary" onClick={onRerun} disabled={running}>
                <RefreshCw size={14} className={running ? "spin" : ""} />
                Analyze again
              </Button>
            </div>
          </div>
          <div className="metrics-grid" aria-label="Analysis summary">
            {stats.map((stat) => (
              <section className="metric-card" key={stat.title}>
                <div className="metric-label">
                  <span>{stat.title}</span>
                  <span title={stat.info}>
                    <CircleHelp size={13} />
                  </span>
                </div>
                <strong className="metric-value">{stat.value}</strong>
                <p>
                  {stat.value === "—"
                    ? "Not available for this analysis"
                    : stat.description}
                </p>
              </section>
            ))}
          </div>

          <section
            className="analysis-report"
            aria-label="Detailed analysis results"
          >
            <div className="report-main-grid">
              <section className="revenue-panel">
                <div className="section-header">
                  <div>
                    <h3>Revenue over time</h3>
                    <p>Actual revenue and the expected trend.</p>
                  </div>
                  <Select
                    aria-label="Revenue period"
                    value={months}
                    onChange={(event) => setMonths(Number(event.target.value))}
                  >
                    <option value={6}>Last 6 months</option>
                    <option value={3}>Last 3 months</option>
                    <option value={1}>Last month</option>
                  </Select>
                </div>
                <div className="chart-legend">
                  <span>
                    <i />
                    Actual revenue
                  </span>
                  <span>
                    <i className="dashed" />
                    Expected trend
                  </span>
                </div>
                {revenue.length ? (
                  <RevenueChart data={revenue} />
                ) : (
                  <div className="chart-empty">
                    No revenue history is available for this dataset.
                  </div>
                )}
              </section>
              <section className="findings-panel">
                <div className="section-header">
                  <div>
                    <h3>What the data shows</h3>
                    <p>
                      {result.insights.length
                        ? `${result.insights.length} findings from this analysis`
                        : "No findings returned for this analysis"}
                    </p>
                  </div>
                </div>
                <div className="findings-list">
                  {result.insights.map((insight, index) => (
                    <button
                      key={`${insight.title}-${index}`}
                      className={`finding-row finding-${insight.tone}`}
                      onClick={() => onInsight(insight)}
                    >
                      <span className="finding-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{insight.title}</strong>
                        <p>{insight.description}</p>
                        <span className="finding-link">
                          View details
                          <ArrowRight size={13} />
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="report-breakdowns">
              <section className="category-panel">
                <div className="section-header">
                  <div>
                    <h3>Revenue by category</h3>
                    <p>Compare the categories in your data.</p>
                  </div>
                </div>
                {result.categories.length ? (
                  <CategoryChart data={result.categories} />
                ) : (
                  <div className="chart-empty">
                    No category breakdown is available.
                  </div>
                )}
              </section>
              <section className="customer-panel">
                <div className="section-header">
                  <div>
                    <h3>Customer groups</h3>
                    <p>How customers are grouped in this analysis.</p>
                  </div>
                </div>
                {result.segments.length ? (
                  <CustomerChart
                    data={result.segments}
                    total={result.metrics.customers}
                  />
                ) : (
                  <div className="chart-empty">
                    No customer groups are available.
                  </div>
                )}
              </section>
            </div>
            <div className="report-validation">
              <ShieldCheck size={17} />
              <span>
                <strong>{result.rows.toLocaleString()}</strong> records analyzed
              </span>
              <span className="validation-divider" />
              <span>
                {result.accuracy == null ? (
                  "Pattern consistency checks passed"
                ) : (
                  <>
                    <strong>{(result.accuracy * 100).toFixed(1)}%</strong>{" "}
                    predictive accuracy
                  </>
                )}
              </span>
              {demo && (
                <span className="report-sample-note">
                  Illustrative sample results
                </span>
              )}
            </div>
          </section>
          <section className="recent-section">
            <div className="section-header">
              <h2>Recent analyses</h2>
              <button className="text-button" onClick={onAllAnalyses}>
                View all analyses
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="card">
              <AnalysesTable
                analyses={analyses.slice(0, 3)}
                onSelect={onSelect}
                compact
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}
