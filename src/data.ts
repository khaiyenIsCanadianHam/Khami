import type { AnalysisRecord, AnalysisResult, Connection } from "./types";

export const sampleConnection: Connection = {
  connection_id: "demo-northstar",
  name: "Northstar Retail",
  type: "PostgreSQL",
  demo: true,
  tables: [
    {
      name: "sales",
      rows: 24892,
      columns: [
        { name: "order_id", type: "identifier" },
        { name: "order_date", type: "date" },
        { name: "customer_id", type: "identifier" },
        { name: "category", type: "category" },
        { name: "revenue", type: "number" },
        { name: "quantity", type: "number" },
      ],
    },
    {
      name: "customers",
      rows: 3842,
      columns: [
        { name: "customer_id", type: "identifier" },
        { name: "name", type: "text" },
        { name: "age", type: "number" },
        { name: "region", type: "category" },
        { name: "joined_at", type: "date" },
      ],
    },
    {
      name: "products",
      rows: 486,
      columns: [
        { name: "product_id", type: "identifier" },
        { name: "product_name", type: "text" },
        { name: "category", type: "category" },
        { name: "price", type: "number" },
      ],
    },
  ],
};

export const sampleResult: AnalysisResult = {
  id: "demo-retail",
  name: "Retail performance overview",
  rows: 24892,
  quality: 98.4,
  accuracy: 0.942,
  updatedAt: new Date().toISOString(),
  metrics: { revenue: 128430, customers: 3842, orderValue: 86.42 },
  revenue: [
    { month: "Apr", actual: 12200, forecast: 14000 },
    { month: "May", actual: 18500, forecast: 16800 },
    { month: "Jun", actual: 15900, forecast: 19100 },
    { month: "Jul", actual: 24130, forecast: 22400 },
    { month: "Aug", actual: 22800, forecast: 27500 },
    { month: "Sep", actual: 34900, forecast: 33100 },
  ],
  categories: [
    { name: "Electronics", value: 42600 },
    { name: "Home & living", value: 32100 },
    { name: "Clothing", value: 26400 },
    { name: "Beauty", value: 17800 },
    { name: "Other", value: 9530 },
  ],
  segments: [
    { name: "Returning customers", value: 58, color: "#266e57" },
    { name: "New customers", value: 28, color: "#a9c8ac" },
    { name: "At-risk customers", value: 14, color: "#e9c88f" },
  ],
  insights: [
    {
      title: "Returning customers generate most revenue",
      description: "Returning customers account for 68% of revenue.",
      tone: "positive",
    },
    {
      title: "Electronics sales increased",
      description:
        "Sales increased 23% this quarter, the largest increase of any category.",
      tone: "info",
    },
    {
      title: "12 orders need review",
      description:
        "These orders differ from the usual pattern. Check them for errors or unusual activity.",
      tone: "warning",
    },
  ],
};

export const sampleAnalyses: AnalysisRecord[] = [
  {
    id: "demo-retail",
    name: "Retail performance overview",
    mode: "supervised",
    tables: ["sales", "customers"],
    createdAt: new Date().toISOString(),
    status: "completed",
    result: sampleResult,
    demo: true,
  },
  {
    id: "demo-customers",
    name: "Understanding our customers",
    mode: "unsupervised",
    tables: ["customers"],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: "completed",
    result: {
      ...sampleResult,
      id: "demo-customers",
      name: "Understanding our customers",
      rows: 3842,
      accuracy: null,
    },
    demo: true,
  },
  {
    id: "demo-sales",
    name: "Monthly sales health check",
    mode: "supervised",
    tables: ["sales"],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    status: "completed",
    result: {
      ...sampleResult,
      id: "demo-sales",
      name: "Monthly sales health check",
    },
    demo: true,
  },
];

export const pipelineSteps = [
  {
    title: "Inspect data",
    description: "Check column types and the categories you selected.",
  },
  {
    title: "Clean records",
    description: "Handle missing values and duplicate records.",
  },
  {
    title: "Explore trends",
    description: "Look for trends and relationships in the data.",
  },
  {
    title: "Prepare data",
    description: "Prepare the data for analysis and check it again.",
  },
  {
    title: "Find patterns",
    description: "Learn from past records or find groups, based on your goal.",
  },
  {
    title: "Check results",
    description: "Check the results before showing them on your dashboard.",
  },
];
