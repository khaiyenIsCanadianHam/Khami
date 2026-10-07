import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Database,
  Ellipsis,
  Layers3,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  AnalysisRecord,
  AnalysisResult,
  Connection,
  Insight,
} from "../types";
import { Badge, Button, EmptyState, Select, Sparkline, Trend } from "./UI";
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
            <th>Analysis name</th>
            <th>Approach</th>
            <th>Data explored</th>
            <th>Status</th>
            <th>Last updated</th>
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
                  <span
                    className={`analysis-mini-icon ${analysis.mode === "unsupervised" ? "sage" : ""}`}
                  >
                    {analysis.mode === "supervised" ? (
                      <ChartNoAxesCombined size={17} />
                    ) : (
                      <Layers3 size={17} />
                    )}
                  </span>
                  <span>
                    {analysis.name}
                    <small>
                      {analysis.demo ? "Sample workspace" : "Local workspace"}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                {analysis.mode === "supervised"
                  ? "Understand an outcome"
                  : "Discover patterns"}
              </td>
              <td>
                {analysis.result
                  ? `${analysis.result.rows.toLocaleString()} rows`
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
                    <CheckCircle2 size={11} />
                  )}
                  {analysis.status === "completed"
                    ? "Ready to explore"
                    : analysis.status === "failed"
                      ? "Needs attention"
                      : "In progress"}
                </Badge>
              </td>
              <td>
                {new Date(analysis.createdAt).toLocaleDateString("en-US", {
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
}: {
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
}) {
  const [months, setMonths] = useState(6);
  const [menu, setMenu] = useState(false);
  const revenue = result?.revenue.slice(-months) ?? [];
  const periodRevenue =
    result && months < 6
      ? revenue.reduce((sum, point) => sum + (point.actual ?? 0), 0)
      : (result?.metrics.revenue ?? null);
  const stats = [
    {
      title: "Total revenue",
      value: money(periodRevenue),
      change: "12.8%",
      description: "vs. previous period",
      icon: <span className="currency-icon">$</span>,
      info: "Total revenue in the selected analysis period.",
    },
    {
      title: "Active customers",
      value: result?.metrics.customers?.toLocaleString() ?? "—",
      change: "8.2%",
      description: "vs. previous period",
      icon: <Users size={17} />,
      info: "Customers represented in this analysis.",
    },
    {
      title: "Average order value",
      value: money(result?.metrics.orderValue ?? null, 2),
      change: "4.3%",
      description: "vs. previous period",
      icon: <ShoppingBag size={17} />,
      info: "The average amount spent per order in this analysis.",
    },
    {
      title: "Data quality",
      value: result?.quality == null ? "—" : `${result.quality.toFixed(1)}%`,
      change: "",
      description: "Clean data. Clearer insights.",
      icon: <ShieldCheck size={17} />,
      info: "The share of records that passed the engine’s data quality checks.",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            THE BIG PICTURE
          </div>
          <h1>
            Business overview<span className="heading-dot">.</span>
          </h1>
          <p>Your data, connected. Your next move, clearer.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={onExport} disabled={!result}>
            <ArrowDownToLine size={15} />
            Export report
          </Button>
          <Button onClick={onNew}>
            <span className="plus-sign">+</span>New analysis
          </Button>
        </div>
      </div>
      {!result ? (
        <div className="card welcome-card">
          <EmptyState
            icon={<ChartNoAxesCombined size={33} />}
            title="Good decisions start with your data."
            description="Connect your business database, tell Khami what you’d like to learn, and let your local engine find the useful details."
            action={
              <Button onClick={onNew}>
                Create your first analysis
                <ArrowRight size={16} />
              </Button>
            }
          />
          <div className="welcome-features">
            <span>
              <Database size={18} />
              Connect your database
            </span>
            <span>
              <Sparkles size={18} />
              Find useful patterns
            </span>
            <span>
              <ShieldCheck size={18} />
              Keep everything local
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="workspace-strip">
            <div className="workspace-source">
              <span className="tiny-database">
                <Database size={16} />
              </span>
              <button onClick={onSources}>
                {connections[0]?.name || "Your business database"}
                <ChevronDown size={13} />
              </button>
              <span className="strip-divider" />
              <span className="source-table-count">
                {connections[0]?.tables.length ?? 0} connected tables
              </span>
              {demo && <span className="sample-tag">Sample data</span>}
            </div>
            <div className="workspace-freshness">
              <span className="status-dot" />
              {demo
                ? "Last analyzed just now"
                : `Analyzed ${new Date(result.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              <button
                className={`icon-button ${running ? "spin" : ""}`}
                title="Re-analyze current data"
                aria-label="Re-analyze current data"
                onClick={onRerun}
                disabled={running}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            {stats.map((stat, index) => (
              <section className="metric-card" key={stat.title}>
                <div className="metric-label">
                  <span>
                    {stat.icon}
                    {stat.title}
                  </span>
                  <span title={stat.info}>
                    <CircleHelp size={13} />
                  </span>
                </div>
                <div className="metric-number-row">
                  <strong>{stat.value}</strong>
                  {demo && <Sparkline variant={index} />}
                </div>
                <div className="metric-detail">
                  {index === 3 ? (
                    <>
                      <span className="quality-dot" />
                      {stat.description}
                    </>
                  ) : demo ? (
                    <>
                      <Trend>{stat.change}</Trend>
                      <span>{stat.description}</span>
                    </>
                  ) : (
                    <span>From your analyzed records</span>
                  )}
                </div>
              </section>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="card revenue-card">
              <div className="card-heading">
                <div>
                  <div className="title-with-icon">
                    <h3>Revenue over time</h3>
                    <span title="Observed revenue alongside the engine’s expected trend.">
                      <CircleHelp size={13} />
                    </span>
                  </div>
                  <p>A little perspective on how business is going.</p>
                </div>
                <Select
                  aria-label="Revenue period"
                  className="period-select"
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
                  Revenue
                </span>
                <span>
                  <i className="dashed" />
                  Expected trend
                </span>
              </div>
              <div className="revenue-chart-wrap">
                {revenue.length ? (
                  <RevenueChart data={revenue} />
                ) : (
                  <div className="chart-empty">
                    No revenue history was returned for this dataset.
                  </div>
                )}
              </div>
              <div className="chart-caption">
                <TrendingUp size={15} />
                <span>
                  {demo ? (
                    <>
                      A healthy direction. Revenue grew <strong>12.8%</strong>{" "}
                      over the previous period.
                    </>
                  ) : (
                    "Explore the relationship between observed results and the expected trend."
                  )}
                </span>
              </div>
            </section>
            <section className="card insights-card">
              <div className="card-heading">
                <div className="title-with-icon">
                  <span className="insights-symbol">
                    <Sparkles size={17} />
                  </span>
                  <h3>The useful bits</h3>
                </div>
                <Badge tone="gray">{result.insights.length} insights</Badge>
              </div>
              <p className="insights-subtitle">
                A few things your data wants you to know.
              </p>
              <div className="insight-list">
                {result.insights.slice(0, 3).map((insight, index) => (
                  <button
                    className={`insight-item insight-${insight.tone}`}
                    key={insight.title}
                    onClick={() => onInsight(insight)}
                  >
                    <span className="insight-item-icon">
                      {index === 0 ? (
                        <TrendingUp size={16} />
                      ) : index === 1 ? (
                        <Lightbulb size={16} />
                      ) : (
                        <CircleHelp size={16} />
                      )}
                    </span>
                    <span>
                      <strong>{insight.title}</strong>
                      <p>{insight.description}</p>
                    </span>
                    <ArrowUpRight size={15} className="insight-arrow" />
                  </button>
                ))}
                {!result.insights.length && (
                  <div className="chart-empty">
                    Your engine hasn’t returned any written insights for this
                    analysis.
                  </div>
                )}
              </div>
              <div className="insights-footer">
                <ShieldCheck size={13} />
                Thoughtfully checked. Simply explained.
              </div>
            </section>
            <section className="card category-card">
              <div className="card-heading">
                <div>
                  <h3>What’s selling</h3>
                  <p>Revenue by product category</p>
                </div>
                <span className="soft-icon neutral">
                  <BarChart3 size={18} />
                </span>
              </div>
              {result.categories.length ? (
                <CategoryChart data={result.categories} />
              ) : (
                <div className="chart-empty">
                  No category breakdown available.
                </div>
              )}
            </section>
            <section className="card customer-card">
              <div className="card-heading">
                <div>
                  <h3>The people behind the numbers</h3>
                  <p>A closer look at your customers</p>
                </div>
                <span className="soft-icon neutral">
                  <Users size={18} />
                </span>
              </div>
              {result.segments.length ? (
                <CustomerChart
                  data={result.segments}
                  total={result.metrics.customers ?? undefined}
                />
              ) : (
                <div className="chart-empty">No customer groups available.</div>
              )}
            </section>
            <section className="analysis-confidence">
              <div className="confidence-top">
                <span>
                  <BadgeCheck size={24} />
                </span>
                <Badge tone="green">Quality checked</Badge>
              </div>
              <p className="confidence-eyebrow">A LITTLE PEACE OF MIND</p>
              <h3>
                Insights you can
                <br />
                feel good about.
              </h3>
              <p>
                Khami checks the details, so you can focus on the decisions.
              </p>
              <div className="confidence-stats">
                <div>
                  <strong>{result.rows.toLocaleString()}</strong>
                  <span>rows explored</span>
                </div>
                <div>
                  <strong>
                    {result.accuracy == null
                      ? "Passed"
                      : `${(result.accuracy * 100).toFixed(1)}%`}
                  </strong>
                  <span>
                    {result.accuracy == null
                      ? "consistency checks"
                      : "predictive accuracy"}
                  </span>
                </div>
              </div>
              <button onClick={onRerun} disabled={running}>
                Give your data a fresh look
                <ArrowRight size={15} />
              </button>
              <div className="confidence-decoration" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </section>
          </div>
          <section className="card recent-card">
            <div className="card-heading">
              <div>
                <h3>Recent analyses</h3>
                <p>Your latest explorations, all in one place.</p>
              </div>
              <button className="text-button" onClick={onAllAnalyses}>
                View all analyses
                <ArrowRight size={14} />
              </button>
              <div className="card-menu-wrapper">
                <button
                  className="icon-button"
                  aria-label="Recent analyses options"
                  onClick={() => setMenu(!menu)}
                >
                  <Ellipsis size={19} />
                </button>
                {menu && (
                  <div className="popover small-popover">
                    <button
                      onClick={() => {
                        onNew();
                        setMenu(false);
                      }}
                    >
                      <Sparkles size={14} />
                      Create new analysis
                    </button>
                    <button
                      onClick={() => {
                        onExport();
                        setMenu(false);
                      }}
                    >
                      <ArrowDownToLine size={14} />
                      Export current report
                    </button>
                  </div>
                )}
              </div>
            </div>
            <AnalysesTable
              analyses={analyses.slice(0, 3)}
              onSelect={onSelect}
              compact
            />
          </section>
          <div className="dashboard-footnote">
            <span>
              <LockIcon />
              Your data stays yours. All analysis happens on your machine.
            </span>
            <span>
              <CalendarDays size={12} />
              {demo
                ? "Showing illustrative sample data"
                : "Connected to your local engine"}
            </span>
          </div>
        </>
      )}
    </>
  );
}

function LockIcon() {
  return <ShieldCheck size={13} />;
}
