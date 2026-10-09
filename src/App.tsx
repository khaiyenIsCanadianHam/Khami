import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  X,
  XCircle,
} from "lucide-react";
import { api, downloadFile, errorMessage } from "./api";
import {
  pipelineSteps,
  sampleAnalyses,
  sampleConnection,
  sampleResult,
} from "./data";
import type {
  AnalysisInput,
  AnalysisJob,
  AnalysisRecord,
  Connection,
  Insight,
  Page,
  Settings as SettingsType,
} from "./types";
import AnalysisWizard from "./components/AnalysisWizard";
import Dashboard, { AnalysesTable } from "./components/Dashboard";
import Predictions from "./components/Predictions";
import Settings from "./components/Settings";
import {
  Badge,
  Brand,
  Button,
  EmptyState,
  Modal,
  Select,
} from "./components/UI";

const navigation = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "sources" as const, label: "Data sources", icon: Database },
  { id: "analyses" as const, label: "Analyses", icon: ChartNoAxesCombined },
  { id: "predictions" as const, label: "Predictions", icon: Sparkles },
];
const pageNames: Record<Page, string> = {
  overview: "Overview",
  sources: "Data sources",
  analyses: "Analyses",
  predictions: "Predictions",
  settings: "Settings",
};

function loadSettings(): SettingsType {
  try {
    const saved = JSON.parse(localStorage.getItem("khami-settings") ?? "null");
    if (
      saved &&
      typeof saved.engineUrl === "string" &&
      typeof saved.demo === "boolean"
    )
      return saved;
  } catch {
    /* Storage is optional in private browser sessions. */
  }
  return { engineUrl: "http://localhost:8000", demo: true };
}

export default function App() {
  const [settings, setSettings] = useState<SettingsType>(loadSettings);
  const [page, setPage] = useState<Page>("overview");
  const [connections, setConnections] = useState<Connection[]>([
    sampleConnection,
  ]);
  const [records, setRecords] = useState<AnalysisRecord[]>(sampleAnalyses);
  const [selectedId, setSelectedId] = useState("demo-retail");
  const [wizard, setWizard] = useState<"analysis" | "source" | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [runningInfo, setRunningInfo] = useState<{
    id: string;
    name: string;
    input: AnalysisInput;
    demo: boolean;
  } | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [engine, setEngine] = useState<
    "ready" | "offline" | "unconfigured" | "checking"
  >("checking");
  const [toast, setToast] = useState("");
  const [help, setHelp] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [notificationRead, setNotificationRead] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisFilter, setAnalysisFilter] = useState("all");
  const [sourceDetail, setSourceDetail] = useState<Connection | null>(null);
  const [disconnect, setDisconnect] = useState<Connection | null>(null);
  const inputs = useRef<Record<string, AnalysisInput>>({});
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const activeConnections = connections.filter(
    (connection) => !!connection.demo === settings.demo,
  );
  const activeRecords = records.filter(
    (record) => record.demo === settings.demo,
  );
  const selected =
    activeRecords.find(
      (record) => record.id === selectedId && record.status === "completed",
    ) ?? activeRecords.find((record) => record.status === "completed");
  const result = selected?.result;
  const running =
    !!job && ["queued", "running", "retrying"].includes(job.status);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 4500);
  }, []);

  useEffect(() => {
    if (settings.demo) return;
    let current = true;
    setEngine("checking");
    api
      .health(settings.engineUrl)
      .then((result) => {
        if (current) setEngine(result.engine_ready ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (current) setEngine("offline");
      });
    return () => {
      current = false;
    };
  }, [settings.engineUrl, settings.demo]);

  useEffect(() => {
    if (!runningInfo) return;
    const info = runningInfo;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    let cancelled = false;
    const finish = (updatedJob: AnalysisJob) => {
      if (cancelled) return;
      if (
        updatedJob.status === "completed" &&
        (!updatedJob.result ||
          (info.input.mode === "supervised" &&
            (typeof updatedJob.result.accuracy !== "number" ||
              !Number.isFinite(updatedJob.result.accuracy) ||
              updatedJob.result.accuracy < 0.6 ||
              updatedJob.result.accuracy > 1)))
      ) {
        updatedJob = {
          ...updatedJob,
          status: "failed",
          result: undefined,
          message:
            "These findings didn’t meet our reliability checks. Your results are hidden. Try a clearer outcome or more complete data.",
        };
      }
      setJob(updatedJob);
      if (updatedJob.status === "completed" || updatedJob.status === "failed") {
        const success = updatedJob.status === "completed";
        setRecords((previous) =>
          previous.map((record) =>
            record.id === info.id
              ? {
                  ...record,
                  status: success ? "completed" : "failed",
                  result:
                    success && updatedJob.result
                      ? { ...updatedJob.result, name: info.name }
                      : undefined,
                }
              : record,
          ),
        );
        if (success) {
          setSelectedId(info.id);
          setNotificationRead(false);
          notify(
            "Your analysis is complete. View the results on the overview page.",
          );
        }
        setRunningInfo(null);
      }
    };
    if (info.demo) {
      let step = 0;
      const advance = () => {
        if (cancelled) return;
        if (step < pipelineSteps.length) {
          setJob({
            id: info.id,
            status: "running",
            step,
            progress: Math.round(((step + 0.4) / 6) * 100),
            message: pipelineSteps[step].description,
          });
          step += 1;
          timer = setTimeout(advance, 850);
        } else
          finish({
            id: info.id,
            status: "completed",
            step: 5,
            progress: 100,
            message: "Your sample analysis is ready.",
            accuracy: info.input.mode === "supervised" ? 0.942 : null,
            result: {
              ...sampleResult,
              id: info.id,
              name: info.name,
              accuracy: info.input.mode === "supervised" ? 0.942 : null,
              updatedAt: new Date().toISOString(),
            },
          });
      };
      timer = setTimeout(advance, 200);
    } else {
      let failures = 0;
      const poll = async () => {
        try {
          const update = await api.job(
            settings.engineUrl,
            info.id,
            controller.signal,
          );
          failures = 0;
          finish(update);
          if (!cancelled && !["completed", "failed"].includes(update.status))
            timer = setTimeout(poll, 1000);
        } catch (error) {
          if (cancelled) return;
          failures += 1;
          if (failures < 3) {
            setJob((previous) =>
              previous
                ? {
                    ...previous,
                    message:
                      "Reconnecting to your engine. Your analysis may still be running.",
                  }
                : previous,
            );
            timer = setTimeout(poll, 2000);
          } else
            finish({
              id: info.id,
              status: "failed",
              progress: 0,
              step: 0,
              message: errorMessage(error),
            });
        }
      };
      void poll();
    }
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [runningInfo, settings.engineUrl, notify]);

  async function runAnalysis(input: AnalysisInput, name: string) {
    if (running) {
      setShowProgress(true);
      return;
    }
    const response = settings.demo
      ? { id: `demo-${Date.now()}` }
      : await api.analyze(settings.engineUrl, input);
    inputs.current[response.id] = input;
    setRecords((previous) => [
      {
        id: response.id,
        name,
        mode: input.mode,
        tables: input.tables,
        createdAt: new Date().toISOString(),
        status: "running",
        demo: settings.demo,
      },
      ...previous,
    ]);
    setJob({
      id: response.id,
      status: "queued",
      step: 0,
      progress: 0,
      message: "Getting everything ready.",
    });
    setRunningInfo({ id: response.id, name, input, demo: settings.demo });
    setWizard(null);
    setShowProgress(true);
  }

  function navigate(next: Page) {
    setPage(next);
    setMobileNav(false);
    setWorkspaceMenu(false);
    setNotifications(false);
  }
  function newAnalysis() {
    if (running) setShowProgress(true);
    else setWizard("analysis");
  }
  function selectAnalysis(record: AnalysisRecord) {
    if (record.status === "running") {
      setShowProgress(true);
      return;
    }
    if (record.status === "failed") {
      if (job?.id === record.id) setShowProgress(true);
      else
        notify(
          "This analysis didn’t pass its checks. Create a new analysis with more complete data.",
        );
      return;
    }
    setSelectedId(record.id);
    navigate("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function saveSettings(next: SettingsType) {
    if (
      running &&
      (settings.demo !== next.demo || settings.engineUrl !== next.engineUrl)
    ) {
      notify(
        "Let the current analysis finish before changing workspaces or engine addresses.",
      );
      return false;
    }
    if (settings.engineUrl !== next.engineUrl) {
      setConnections((previous) =>
        previous.filter((connection) => connection.demo),
      );
      setRecords((previous) => previous.filter((record) => record.demo));
    }
    setSettings(next);
    try {
      localStorage.setItem("khami-settings", JSON.stringify(next));
    } catch {
      notify(
        "Settings are active for this session. Browser storage is unavailable.",
      );
    }
    return true;
  }
  function exportReport() {
    if (!result) return;
    downloadFile(
      `khami-${result.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
      JSON.stringify(
        {
          workspace: settings.demo
            ? "Sample data — illustrative only"
            : "Local business data",
          generatedAt: new Date().toISOString(),
          analysis: result,
        },
        null,
        2,
      ),
      "application/json",
    );
    notify("Report downloaded.");
  }
  function rerun() {
    if (!selected || !activeConnections.length) {
      newAnalysis();
      return;
    }
    const input =
      inputs.current[selected.id] ??
      (settings.demo
        ? {
            connection_id: activeConnections[0].connection_id,
            tables: selected.tables,
            labels: {
              sales: "Sales & transactions",
              customers: "Customers & people",
            },
            mode: selected.mode,
            ...(selected.mode === "supervised" ? { target: "revenue" } : {}),
          }
        : undefined);
    if (!input) {
      newAnalysis();
      return;
    }
    void runAnalysis(input, selected.name).catch((error) =>
      notify(errorMessage(error)),
    );
  }

  const filteredRecords = activeRecords.filter(
    (record) =>
      record.name.toLowerCase().includes(analysisSearch.toLowerCase()) &&
      (analysisFilter === "all" || record.status === analysisFilter),
  );
  return (
    <div className="app-shell">
      {mobileNav && (
        <div className="sidebar-backdrop" onClick={() => setMobileNav(false)} />
      )}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a
          className="brand-link"
          href="#"
          aria-label="Khami home"
          onClick={(event) => {
            event.preventDefault();
            navigate("overview");
          }}
        >
          <Brand />
        </a>
        <div className="workspace-selector-wrap">
          <button
            className="workspace-selector"
            aria-expanded={workspaceMenu}
            onClick={() => setWorkspaceMenu(!workspaceMenu)}
          >
            <span className="workspace-avatar">
              <Database size={17} />
            </span>
            <span>
              <strong>
                {settings.demo ? "Northstar workspace" : "My workspace"}
              </strong>
              <small>{settings.demo ? "Sample data" : "Local data"}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {workspaceMenu && (
            <div className="popover workspace-popover">
              <p>YOUR WORKSPACE</p>
              <button onClick={() => navigate("settings")}>
                <FlaskConical size={15} />
                {settings.demo
                  ? "Switch to your live data"
                  : "Switch to sample data"}
                <ArrowRight size={14} />
              </button>
              <button onClick={() => navigate("settings")}>
                <Settings2 size={15} />
                Workspace settings
              </button>
            </div>
          )}
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "analyses" && activeRecords.length > 0 && (
                <span className="nav-count">{activeRecords.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <LockKeyhole size={16} />
            <span>Local processing</span>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} strokeWidth={1.7} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} strokeWidth={1.7} />
            <span>Help</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-home">
              <LayoutDashboard size={15} />
              Workspace
            </span>
            <ChevronRight size={13} />
            <span>{pageNames[page]}</span>
          </div>
          <div className="topbar-actions">
            {running && (
              <button
                className="running-pill"
                onClick={() => setShowProgress(true)}
              >
                <Loader2 size={13} className="spin" />
                Analysis in progress
              </button>
            )}
            <button
              className={`environment-badge ${settings.demo ? "demo" : ""}`}
              onClick={() => navigate("settings")}
            >
              {settings.demo ? (
                <FlaskConical size={13} />
              ) : (
                <span
                  className={`status-dot ${engine === "ready" ? "" : "amber"}`}
                />
              )}
              {settings.demo
                ? "Demo workspace"
                : engine === "ready"
                  ? "Engine connected"
                  : "Local workspace"}
            </button>
            <span className="topbar-divider" />
            <div className="notifications-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(!notifications);
                  setNotificationRead(true);
                }}
              >
                <Bell size={19} strokeWidth={1.7} />
                {!notificationRead && <span />}
              </button>
              {notifications && (
                <div className="popover notifications-popover">
                  <div className="popover-heading">
                    <strong>Recent updates</strong>
                    <button
                      className="icon-button"
                      aria-label="Close notifications"
                      onClick={() => setNotifications(false)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {activeRecords.length ? (
                    activeRecords.slice(0, 3).map((record) => (
                      <button
                        key={record.id}
                        onClick={() => {
                          selectAnalysis(record);
                          setNotifications(false);
                        }}
                      >
                        <span className="notification-icon">
                          <CheckCircle2 size={17} />
                        </span>
                        <span>
                          <strong>{record.name}</strong>
                          <small>
                            {record.status === "completed"
                              ? "Analysis complete."
                              : record.status === "running"
                                ? "Analysis in progress."
                                : "This analysis needs attention."}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="popover-empty">
                      No updates yet. Analysis updates will appear here.
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              className="icon-button workspace-settings-button"
              aria-label="Open workspace settings"
              onClick={() => navigate("settings")}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {page === "overview" && (
            <Dashboard
              result={result}
              analyses={activeRecords}
              connections={activeConnections}
              demo={settings.demo}
              onNew={newAnalysis}
              onSelect={selectAnalysis}
              onAllAnalyses={() => navigate("analyses")}
              onSources={() => navigate("sources")}
              onExport={exportReport}
              onRerun={rerun}
              onInsight={setInsight}
              running={running}
            />
          )}
          {page === "sources" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Data sources</h1>
                  <p>Manage the databases Khami uses for analysis.</p>
                </div>
                <Button onClick={() => setWizard("source")}>
                  <Plus size={17} />
                  Connect database
                </Button>
              </div>
              {settings.demo && (
                <div className="demo-banner">
                  <FlaskConical size={18} />
                  <div>
                    <strong>You’re viewing sample data.</strong>
                    <span>
                      These are sample sources. Switch to your live workspace in
                      Settings to connect your own data.
                    </span>
                  </div>
                  <button onClick={() => navigate("settings")}>
                    Open settings
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <div className="sources-grid">
                {activeConnections.map((connection) => (
                  <article
                    className="card source-card"
                    key={connection.connection_id}
                  >
                    <div className="source-card-top">
                      <span className="large-database">
                        <Database size={26} strokeWidth={1.6} />
                      </span>
                      <Badge tone="green">
                        <span className="status-dot" />
                        {connection.demo ? "Sample source" : "Connected"}
                      </Badge>
                    </div>
                    <h3>{connection.name}</h3>
                    <p>
                      {connection.type || "Business database"}
                      <span>·</span>
                      {connection.tables.length} tables available
                    </p>
                    <div className="source-tables">
                      {connection.tables.slice(0, 4).map((table) => (
                        <div key={table.name}>
                          <Table2 size={14} />
                          <span>{table.name}</span>
                          <small>{table.rows.toLocaleString()} rows</small>
                        </div>
                      ))}
                    </div>
                    <div className="source-card-footer">
                      <button
                        className="text-button"
                        onClick={() => setSourceDetail(connection)}
                      >
                        Explore tables
                        <ArrowRight size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${connection.name}`}
                        onClick={() => setDisconnect(connection)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </article>
                ))}
                <button
                  className="new-source-card"
                  onClick={() => setWizard("source")}
                >
                  <span>
                    <Plus size={24} strokeWidth={1.5} />
                  </span>
                  <strong>Connect another database</strong>
                  <p>Add a source for your analyses.</p>
                </button>
              </div>
              <div className="sources-privacy">
                <ShieldCheck size={20} />
                <div>
                  <strong>Processed by your local engine</strong>
                  <p>
                    Khami reads through your local Python engine. Database
                    access and data processing happen on your machine.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "analyses" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Analyses</h1>
                  <p>Run a new analysis or review previous results.</p>
                </div>
                <Button onClick={newAnalysis}>
                  <Plus size={17} />
                  New analysis
                </Button>
              </div>
              <div className="analysis-summary-grid">
                <div>
                  <span className="soft-icon">
                    <ChartNoAxesCombined size={20} />
                  </span>
                  <span>
                    <strong>{activeRecords.length}</strong>
                    <small>Total analyses</small>
                  </span>
                </div>
                <div>
                  <span className="soft-icon">
                    <CheckCircle2 size={20} />
                  </span>
                  <span>
                    <strong>
                      {
                        activeRecords.filter(
                          (record) => record.status === "completed",
                        ).length
                      }
                    </strong>
                    <small>Completed</small>
                  </span>
                </div>
                <div>
                  <span className="soft-icon gold">
                    <Activity size={20} />
                  </span>
                  <span>
                    <strong>
                      {
                        activeRecords.filter(
                          (record) => record.status === "running",
                        ).length
                      }
                    </strong>
                    <small>In progress</small>
                  </span>
                </div>
              </div>
              <section className="card all-analyses">
                <div className="analyses-toolbar">
                  <div className="search-input">
                    <Search size={17} />
                    <input
                      aria-label="Search analyses"
                      placeholder="Find an analysis…"
                      value={analysisSearch}
                      onChange={(event) =>
                        setAnalysisSearch(event.target.value)
                      }
                    />
                  </div>
                  <Select
                    aria-label="Filter analyses"
                    value={analysisFilter}
                    onChange={(event) => setAnalysisFilter(event.target.value)}
                  >
                    <option value="all">All analyses</option>
                    <option value="completed">Completed</option>
                    <option value="running">In progress</option>
                    <option value="failed">Needs attention</option>
                  </Select>
                </div>
                {filteredRecords.length ? (
                  <AnalysesTable
                    analyses={filteredRecords}
                    onSelect={selectAnalysis}
                  />
                ) : (
                  <EmptyState
                    icon={<ChartNoAxesCombined size={27} />}
                    title={
                      activeRecords.length
                        ? "No matching analyses"
                        : "No analyses yet"
                    }
                    description={
                      activeRecords.length
                        ? "Try a different name or filter."
                        : "Choose your data and tell Khami what you’d like to learn."
                    }
                    action={
                      !activeRecords.length && (
                        <Button onClick={newAnalysis}>
                          Create an analysis
                          <ArrowRight size={15} />
                        </Button>
                      )
                    }
                  />
                )}
              </section>
            </>
          )}
          {page === "predictions" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Predictions</h1>
                  <p>
                    Upload new records to use what your analysis has learned.
                  </p>
                </div>
                <Badge tone="gray">
                  <LockKeyhole size={13} />
                  Locally processed
                </Badge>
              </div>
              <Predictions
                key={String(settings.demo)}
                settings={settings}
                analyses={activeRecords}
                onNew={newAnalysis}
              />
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Settings</h1>
                  <p>Configure your local engine and workspace.</p>
                </div>
              </div>
              <Settings settings={settings} onSave={saveSettings} />
            </>
          )}
        </main>
      </div>
      {wizard && (
        <AnalysisWizard
          settings={settings}
          connections={activeConnections}
          onClose={() => setWizard(null)}
          onConnect={(connection) =>
            setConnections((previous) =>
              previous.some(
                (item) => item.connection_id === connection.connection_id,
              )
                ? previous
                : [...previous, { ...connection, demo: settings.demo }],
            )
          }
          onRun={runAnalysis}
          sourceOnly={wizard === "source"}
        />
      )}
      {showProgress && job && (
        <Modal
          title={
            job.status === "completed"
              ? "Analysis complete"
              : job.status === "failed"
                ? "Analysis needs attention"
                : "Analysis in progress"
          }
          subtitle={
            settings.demo
              ? "Demo run using sample data"
              : "Your data is being processed on your machine."
          }
          onClose={() => setShowProgress(false)}
        >
          <div className="progress-body">
            {job.status === "failed" ? (
              <>
                <span className="progress-status-icon failed">
                  <XCircle size={30} />
                </span>
                <h3>This analysis didn’t pass the quality check.</h3>
                <p className="progress-message" role="alert">
                  {job.message}
                </p>
                <div className="helper-note">
                  <ShieldCheck size={17} />
                  Unreliable findings are kept off your dashboard. More complete
                  data or a different goal can help.
                </div>
              </>
            ) : job.status === "completed" ? (
              <>
                <span className="progress-status-icon">
                  <CheckCircle2 size={32} />
                </span>
                <h3>Your results are ready.</h3>
                <p className="progress-message">
                  This analysis has passed the quality checks.
                </p>
                <div className="completion-summary">
                  <div>
                    <strong>{job.result?.rows.toLocaleString()}</strong>
                    <span>records analyzed</span>
                  </div>
                  <div>
                    <strong>{job.result?.insights.length}</strong>
                    <span>findings</span>
                  </div>
                  <div>
                    <strong>
                      {job.result?.accuracy == null
                        ? "Passed"
                        : `${(job.result.accuracy * 100).toFixed(1)}%`}
                    </strong>
                    <span>
                      {job.result?.accuracy == null
                        ? "consistency check"
                        : "predictive accuracy"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="progress-overview">
                  <span className="progress-brand">
                    <Brand small />
                  </span>
                  <div>
                    <strong>
                      {job.status === "retrying"
                        ? "Checking the data again"
                        : pipelineSteps[Math.min(5, Math.max(0, job.step))]
                            .title}
                    </strong>
                    <p>{job.message}</p>
                  </div>
                  <span>{Math.round(job.progress)}%</span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, job.progress))}%`,
                    }}
                  />
                </div>
                {job.status === "retrying" && (
                  <div className="retry-note">
                    The results need another check. The engine is preparing the
                    data and trying again.
                  </div>
                )}
                <div className="pipeline-steps">
                  {pipelineSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className={`pipeline-step ${index < job.step ? "done" : index === job.step ? "current" : ""}`}
                    >
                      <span>
                        {index < job.step ? (
                          <Check size={15} />
                        ) : index === job.step ? (
                          <Loader2 size={15} className="spin" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <strong>{step.title}</strong>
                        {index === job.step && <p>{step.description}</p>}
                      </div>
                      {index < job.step && <small>Done</small>}
                    </div>
                  ))}
                </div>
                <div className="helper-note">
                  <LockKeyhole size={15} />
                  You can continue using Khami while this analysis runs.
                </div>
              </>
            )}
          </div>
          <footer className="modal-footer">
            <Badge tone="gray">
              <ShieldCheck size={12} />
              Local processing
            </Badge>
            {job.status === "completed" ? (
              <Button
                onClick={() => {
                  setShowProgress(false);
                  navigate("overview");
                }}
              >
                View results
                <ArrowRight size={16} />
              </Button>
            ) : job.status === "failed" ? (
              <Button
                onClick={() => {
                  setShowProgress(false);
                  setWizard("analysis");
                }}
              >
                Try a new analysis
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowProgress(false)}
              >
                Continue in background
              </Button>
            )}
          </footer>
        </Modal>
      )}
      {insight && (
        <Modal
          title="Insight details"
          subtitle={
            settings.demo ? "From your sample retail analysis" : result?.name
          }
          onClose={() => setInsight(null)}
        >
          <div className="insight-detail">
            <span className="detail-insight-icon">
              <Sparkles size={27} />
            </span>
            <Badge tone={insight.tone === "warning" ? "amber" : "green"}>
              {insight.tone === "warning" ? "Review suggested" : "Finding"}
            </Badge>
            <h3>{insight.title}</h3>
            <p>{insight.description}</p>
            <div className="insight-next-step">
              <LightbulbIcon />
              <div>
                <strong>How to use this finding</strong>
                <p>
                  Check this result against your business records before making
                  a decision.
                </p>
              </div>
            </div>
            <div className="helper-note">
              <ShieldCheck size={16} />
              {settings.demo
                ? "This is an illustrative insight from sample data."
                : "This insight was returned by your local engine after validation."}
            </div>
          </div>
          <footer className="modal-footer">
            <Button
              variant="ghost"
              onClick={() => {
                exportReport();
              }}
            >
              Export report
              <FileText size={15} />
            </Button>
            <Button onClick={() => setInsight(null)}>
              Close
              <Check size={16} />
            </Button>
          </footer>
        </Modal>
      )}
      {sourceDetail && (
        <Modal
          title={sourceDetail.name}
          subtitle="The tables your local engine found in this source."
          onClose={() => setSourceDetail(null)}
          wide
        >
          <div className="source-detail-body">
            {sourceDetail.tables.map((table) => (
              <section key={table.name}>
                <div className="source-detail-heading">
                  <Table2 size={18} />
                  <h3>{table.name}</h3>
                  <Badge tone="gray">{table.rows.toLocaleString()} rows</Badge>
                </div>
                <div className="column-preview">
                  {table.columns.map((column) => (
                    <span key={column.name}>
                      {column.name}
                      <small>{column.type}</small>
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <footer className="modal-footer">
            <Badge tone="gray">
              <LockKeyhole size={12} />
              Local connection
            </Badge>
            <Button
              onClick={() => {
                setSourceDetail(null);
                newAnalysis();
              }}
            >
              Analyze this data
              <ArrowRight size={16} />
            </Button>
          </footer>
        </Modal>
      )}
      {disconnect && (
        <Modal
          title="Remove this source from your workspace?"
          subtitle={disconnect.name}
          onClose={() => setDisconnect(null)}
        >
          <div className="confirm-body">
            <p>
              This removes the connection from this browser session. Your
              database and completed analysis results stay intact.
            </p>
          </div>
          <footer className="modal-footer">
            <Button variant="secondary" onClick={() => setDisconnect(null)}>
              Keep source
            </Button>
            <Button
              onClick={() => {
                setConnections((previous) =>
                  previous.filter(
                    (connection) =>
                      connection.connection_id !== disconnect.connection_id,
                  ),
                );
                setDisconnect(null);
                notify("Source removed from this workspace.");
              }}
            >
              Remove source
            </Button>
          </footer>
        </Modal>
      )}
      {help && (
        <Modal
          title="Help"
          subtitle="How to connect data, run an analysis, and use the results."
          onClose={() => setHelp(false)}
        >
          <div className="help-body">
            <div>
              <span>
                <Database size={22} />
              </span>
              <section>
                <h3>Connect your data</h3>
                <p>
                  Connect a database, choose a few tables, and tell us what they
                  contain. Use the demo workspace to try it first.
                </p>
              </section>
            </div>
            <div>
              <span>
                <ChartNoAxesCombined size={22} />
              </span>
              <section>
                <h3>Choose your goal</h3>
                <p>
                  Focus on an outcome you want to understand, or let Khami
                  discover customer groups and interesting patterns.
                </p>
              </section>
            </div>
            <div>
              <span>
                <ShieldCheck size={22} />
              </span>
              <section>
                <h3>Understand the quality checks</h3>
                <p>
                  The engine checks results before sharing them. Predictions
                  need at least 60% accuracy; discovered patterns must pass
                  consistency checks.
                </p>
              </section>
            </div>
            <div>
              <span>
                <BookOpen size={22} />
              </span>
              <section>
                <h3>Need to connect your Python program?</h3>
                <p>
                  Your project’s README and engine API guide explain how to
                  start the local service and connect your existing engine.
                </p>
              </section>
            </div>
          </div>
          <footer className="modal-footer">
            <span className="help-footer"></span>
            <Button
              onClick={() => {
                setHelp(false);
                navigate("settings");
              }}
            >
              Open settings
              <ArrowRight size={15} />
            </Button>
          </footer>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function LightbulbIcon() {
  return <CircleHelp size={20} />;
}
