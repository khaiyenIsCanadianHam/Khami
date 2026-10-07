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
      title: "Your repeat customers are your best customers",
      description:
        "Returning customers generate 68% of your revenue. A little appreciation could go a long way.",
      tone: "positive",
    },
    {
      title: "Electronics is having a moment",
      description:
        "Sales are up 23% this quarter, making electronics your fastest-growing category.",
      tone: "info",
    },
    {
      title: "A few orders deserve a second look",
      description:
        "12 orders look different from your usual pattern. Reviewing them could help keep your data accurate.",
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
    title: "Getting to know your data",
    description: "Checking columns, dates, and the meaning behind your labels.",
  },
  {
    title: "Tidying things up",
    description: "Taking care of empty entries and duplicate records.",
  },
  {
    title: "Looking for the bigger picture",
    description: "Exploring trends, relationships, and interesting patterns.",
  },
  {
    title: "Preparing the details",
    description: "Refining your data so every comparison is a fair one.",
  },
  {
    title: "Connecting the dots",
    description:
      "Finding the most useful way to answer your business questions.",
  },
  {
    title: "Double-checking our work",
    description: "Making sure the findings are consistent and reliable.",
  },
];
