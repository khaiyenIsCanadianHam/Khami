import { useId } from "react";
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisResult } from "../types";
import "./charts.css";

const shortMoney = (value: number) => `$${value / 1000}k`;
const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function RevenueChart({
  data,
  currency = "USD",
}: {
  data: AnalysisResult["revenue"];
  currency?: string;
}) {
  const gradientId = `revenue-${useId().replace(/:/g, "")}`;

  return (
    <div
      className="khami-revenue-chart"
      role="img"
      aria-label="Monthly revenue chart comparing actual revenue with the expected trend"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 14, right: 7, left: -16, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7aa58b" stopOpacity={0.21} />
              <stop offset="100%" stopColor="#7aa58b" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0ec"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tickMargin={13}
            tick={{ fill: "#8a918c", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tickCount={5}
            tickFormatter={shortMoney}
            tick={{ fill: "#8a918c", fontSize: 10 }}
          />
          <Tooltip
            cursor={{ stroke: "#b6c9bb", strokeDasharray: "4 4" }}
            contentStyle={{
              background: "#fff",
              border: "1px solid #e6ebe5",
              borderRadius: 10,
              boxShadow: "0 5px 20px #233b2910",
              fontSize: 12,
              padding: "10px 14px",
            }}
            labelStyle={{ color: "#26392c", fontWeight: 600, marginBottom: 6 }}
            formatter={(value: number, name: string) => [
              money(value, currency),
              name === "actual" ? "Actual revenue" : "Expected revenue",
            ]}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#266e57"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#a8bfad"
            strokeWidth={1.8}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const categoryColors = ["#39775d", "#5b9072", "#86ab8b", "#aac4a4", "#cbd9bf"];

export function CategoryChart({
  data,
}: {
  data: AnalysisResult["categories"];
}) {
  const maximum = Math.max(...data.map((item) => item.value), 1);

  return (
    <div
      className="khami-category-chart"
      role="img"
      aria-label="Revenue by product category"
    >
      <div className="khami-category-rows">
        {data.map((category, index) => (
          <div className="khami-category-row" key={category.name}>
            <span className="khami-category-label" title={category.name}>
              {category.name}
            </span>
            <div className="khami-category-track">
              <div
                className="khami-category-bar"
                style={{
                  width: `${Math.max(0, (category.value / maximum) * 100)}%`,
                  backgroundColor:
                    categoryColors[index % categoryColors.length],
                }}
              />
            </div>
            <span className="khami-category-value">
              ${(category.value / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>
      <div className="khami-category-caption">Revenue by category</div>
    </div>
  );
}

export function CustomerChart({
  data,
  total = null,
}: {
  data: AnalysisResult["segments"];
  total?: number | null;
}) {
  const segmentTotal = data.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="khami-customer-chart">
      <div
        className="khami-customer-ring"
        role="img"
        aria-label={`${total == null ? "Your" : total.toLocaleString()} customers grouped by relationship with your business`}
      >
        <PieChart width={155} height={155}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={54}
            outerRadius={76}
            startAngle={90}
            endAngle={-270}
            stroke="#fff"
            strokeWidth={3}
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((segment) => (
              <Cell key={segment.name} fill={segment.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e6ebe5",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              `${segmentTotal ? Math.round((value / segmentTotal) * 100) : 0}%`,
              "Share",
            ]}
          />
        </PieChart>
        <div className="khami-customer-total">
          <strong>{total == null ? "—" : total.toLocaleString()}</strong>
          <span>customers</span>
        </div>
      </div>
      <div className="khami-customer-legend">
        {data.map((segment) => (
          <div className="khami-customer-legend-row" key={segment.name}>
            <span
              className="khami-chart-dot"
              style={{ backgroundColor: segment.color }}
            />
            <span>{segment.name}</span>
            <strong>
              {segmentTotal
                ? Math.round((segment.value / segmentTotal) * 100)
                : 0}
              %
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
