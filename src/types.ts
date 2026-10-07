export type Page =
  | "overview"
  | "sources"
  | "analyses"
  | "predictions"
  | "settings";
export type Mode = "supervised" | "unsupervised";
export type Insight = {
  title: string;
  description: string;
  tone: "positive" | "info" | "warning";
};
export type AnalysisResult = {
  id: string;
  name: string;
  rows: number;
  quality: number | null;
  accuracy: number | null;
  insights: Insight[];
  revenue: { month: string; actual: number | null; forecast: number | null }[];
  categories: { name: string; value: number }[];
  segments: { name: string; value: number; color: string }[];
  metrics: {
    revenue: number | null;
    customers: number | null;
    orderValue: number | null;
  };
  updatedAt: string;
};
export type Table = {
  name: string;
  rows: number;
  columns: { name: string; type: string }[];
};
export type Connection = {
  connection_id: string;
  name: string;
  tables: Table[];
  type?: string;
  demo?: boolean;
};
export type ConnectionInput = {
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
};
export type AnalysisInput = {
  connection_id: string;
  tables: string[];
  labels: Record<string, string>;
  mode: Mode;
  target?: string;
};
export type AnalysisJob = {
  id: string;
  status: "queued" | "running" | "retrying" | "completed" | "failed";
  step: number;
  progress: number;
  message: string;
  accuracy?: number | null;
  result?: AnalysisResult | null;
};
export type AnalysisRecord = {
  id: string;
  name: string;
  mode: Mode;
  tables: string[];
  createdAt: string;
  status: "completed" | "failed" | "running";
  result?: AnalysisResult;
  demo: boolean;
};
export type PredictionResult = {
  rows: Record<string, string | number | null>[];
  summary: string;
  checked_against_database: boolean;
};
export type Settings = { engineUrl: string; demo: boolean };
