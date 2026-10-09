import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: false })
    .click();
}

async function chooseGoal(page: Page, mode: "supervised" | "unsupervised") {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByLabel("Category for sales")).toBeVisible();
  await dialog
    .getByLabel("Category for sales")
    .selectOption("Sales & transactions");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  if (mode === "supervised") {
    // The guided flow must explain the missing outcome before moving on.
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Choose the column you want to predict.",
    );
    await dialog.getByLabel("Column to predict").selectOption("revenue");
  } else {
    await dialog.getByRole("button", { name: "Find patterns" }).click();
    await expect(dialog.getByLabel("Column to predict")).toHaveCount(0);
  }
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
}

async function useLiveWorkspace(page: Page) {
  await page
    .getByRole("button", { name: "Open workspace settings", exact: true })
    .click();
  await page.getByLabel("Engine address").fill("http://127.0.0.1:8000");
  await page.getByRole("switch", { name: "Use sample data" }).click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Use sample data" }),
  ).not.toBeChecked();
}

test("demo dashboard explores insights, filters analyses, and changes actual revenue period", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const revenue = page
    .locator(".metric-card")
    .filter({ hasText: "Total revenue" });
  await expect(revenue).toContainText("$128,430");
  await page.getByLabel("Revenue period").selectOption("3");
  await expect(revenue).toContainText("$81,830");
  await page.getByLabel("Revenue period").selectOption("1");
  await expect(revenue).toContainText("$34,900");

  await page
    .getByRole("button", {
      name: /Returning customers generate most revenue/,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Insight details" }),
  ).toContainText("illustrative insight");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await navigate(page, "Data sources");
  await expect(
    page.getByRole("heading", { name: "Northstar Retail" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore tables" }).click();
  await expect(page.getByRole("dialog")).toContainText("customer_id");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await navigate(page, "Analyses");
  await page.getByLabel("Search analyses").fill("monthly");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText(
    "Monthly sales health check",
  );
  await page.getByLabel("Filter analyses").selectOption("failed");
  await expect(
    page.getByRole("heading", { name: "No matching analyses" }),
  ).toBeVisible();
});

for (const mode of ["supervised", "unsupervised"] as const) {
  test(`guided ${mode} analysis completes with the correct reliability message`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "New analysis", exact: false })
      .click();
    await chooseGoal(page, mode);
    const name =
      mode === "supervised"
        ? "Sales forecast review"
        : "Customer pattern review";
    await page.getByLabel("Analysis name").fill(name);
    await expect(page.getByRole("dialog")).toContainText(
      mode === "supervised"
        ? "Prediction score of at least 60%"
        : "Patterns checked for consistency",
    );
    await page.getByRole("button", { name: "Start analysis" }).click();
    const completed = page.getByRole("dialog", {
      name: "Analysis complete",
    });
    await expect(completed).toBeVisible({ timeout: 12_000 });
    await expect(completed).toContainText(
      mode === "supervised" ? "94.2%" : "consistency check",
    );
    if (mode === "unsupervised")
      await expect(completed).not.toContainText("predictive accuracy");
    await completed.getByRole("button", { name: "View results" }).click();
    await expect(
      page.getByRole("button", { name: `${name} Sample data` }),
    ).toBeVisible();
    await expect(page.locator(".report-validation")).toContainText(
      mode === "supervised" ? "94.2%" : "consistency checks",
    );
  });
}

test("CSV prediction preview generates clearly labeled sample results and exports all rows", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Predictions");
  await expect(
    page.getByRole("button", { name: "Generate predictions" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Use sample file" }).click();
  await expect(page.getByText("5 rows ready")).toBeVisible();
  await page.getByRole("button", { name: "Generate predictions" }).click();
  await expect(
    page.getByRole("heading", { name: "Prediction results" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample predictions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not checked against database", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".prediction-results tbody tr")).toHaveCount(5);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("khami-predictions.csv");
  const exported = await readFile((await download.path())!, "utf8");
  expect(exported).toContain("predicted_outcome");
  expect(exported).toContain("C-1005");
  expect(exported.trim().split(/\r?\n/)).toHaveLength(6);
});

test("live workspace keeps demo data hidden and explains the real unconfigured API", async ({
  page,
}) => {
  await page.goto("/");
  await useLiveWorkspace(page);
  await page.getByRole("button", { name: "Test engine connection" }).click();
  await expect(page.getByRole("status")).toContainText(
    "The API is running. Connect your Python program using the adapter",
  );
  await navigate(page, "Overview");
  await expect(
    page.getByRole("heading", { name: "No analysis results yet" }),
  ).toBeVisible();
  await expect(page.getByText("$128,430", { exact: true })).toHaveCount(0);
  await navigate(page, "Analyses");
  await expect(
    page.getByRole("heading", { name: "No analyses yet" }),
  ).toBeVisible();
  await navigate(page, "Predictions");
  await expect(
    page.getByRole("heading", {
      name: "Run an analysis first",
    }),
  ).toBeVisible();
  await navigate(page, "Data sources");
  await expect(
    page.getByRole("heading", { name: "Northstar Retail" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect database", exact: true })
    .click();
  await page.getByLabel("Database name", { exact: true }).fill("business");
  await page.getByLabel("Username", { exact: true }).fill("analyst");
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Your local analysis engine isn't connected yet",
  );
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }),
  ).toBeDisabled();
});

test("a completed live response below 60% cannot expose findings or enable predictions", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("http://127.0.0.1:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/health") return reply({ status: "ok", engine_ready: true });
    if (path === "/connections/test")
      return reply({
        connection_id: "live-1",
        name: "Live sales",
        tables: [
          {
            name: "sales",
            rows: 100,
            columns: [
              { name: "revenue", type: "number" },
              { name: "category", type: "category" },
            ],
          },
        ],
      });
    if (path === "/analyses") {
      submitted = route.request().postDataJSON();
      return reply({ id: "low-quality" });
    }
    if (path === "/analyses/low-quality")
      return reply({
        id: "low-quality",
        status: "completed",
        progress: 100,
        step: 5,
        message: "Done",
        result: {
          id: "low-quality",
          name: "Unsafe report",
          accuracy: 0.59,
          rows: 100,
          quality: 90,
          updatedAt: new Date().toISOString(),
          metrics: { revenue: 9999999, customers: 100, orderValue: 20 },
          revenue: [],
          categories: [],
          segments: [],
          insights: [
            {
              title: "Unreliable finding",
              description: "This must remain hidden",
              tone: "positive",
            },
          ],
        },
      });
    return route.abort();
  });
  await page.goto("/");
  await useLiveWorkspace(page);
  await navigate(page, "Overview");
  await page
    .getByRole("button", { name: "New analysis", exact: false })
    .click();
  await page.getByLabel("Database name", { exact: true }).fill("business");
  await page.getByLabel("Username", { exact: true }).fill("analyst");
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await chooseGoal(page, "supervised");
  await page.getByLabel("Analysis name").fill("Live quality check");
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your results are hidden",
  );
  expect(submitted).toMatchObject({
    connection_id: "live-1",
    tables: ["sales"],
    mode: "supervised",
    target: "revenue",
    labels: { sales: "Sales & transactions" },
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByText("Unreliable finding", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No analysis results yet" }),
  ).toBeVisible();
  await navigate(page, "Analyses");
  await expect(page.locator("tbody tr")).toContainText("Needs attention");
  await navigate(page, "Predictions");
  await expect(
    page.getByRole("heading", {
      name: "Run an analysis first",
    }),
  ).toBeVisible();
});

test("live success handles retries, missing metrics, and database-checked CSV predictions", async ({
  page,
}) => {
  let polls = 0;
  let predictionRequest: Record<string, unknown> | undefined;
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("http://127.0.0.1:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/health") return reply({ status: "ok", engine_ready: true });
    if (path === "/connections/test")
      return reply({
        connection_id: "live-success-source",
        name: "Local business sales",
        tables: [
          {
            name: "sales",
            rows: 217,
            columns: [
              { name: "revenue", type: "number" },
              { name: "category", type: "category" },
              { name: "quantity", type: "number" },
            ],
          },
        ],
      });
    if (path === "/analyses") return reply({ id: "live-success-analysis" });
    if (path === "/analyses/live-success-analysis") {
      polls += 1;
      if (polls === 1)
        return reply({
          id: "live-success-analysis",
          status: "queued",
          progress: 0,
          step: 0,
          message: "Your local analysis is queued.",
        });
      if (polls === 2)
        return reply({
          id: "live-success-analysis",
          status: "retrying",
          progress: 20,
          step: 1,
          message: "Taking another look at incomplete records.",
        });
      return reply({
        id: "live-success-analysis",
        status: "completed",
        progress: 100,
        step: 5,
        message: "Your findings passed the reliability check.",
        result: {
          id: "live-success-analysis",
          name: "Local sales analysis",
          rows: 217,
          quality: null,
          accuracy: 0.81,
          updatedAt: "2026-10-08T01:00:00Z",
          metrics: { revenue: null, customers: null, orderValue: null },
          revenue: [],
          categories: [],
          segments: [
            { name: "Occasional buyers", value: 30, color: "#266e57" },
            { name: "Frequent buyers", value: 70, color: "#a9c8ac" },
          ],
          insights: [
            {
              title: "Order size explains the local sales pattern",
              description:
                "Larger orders account for the strongest results in these 217 records.",
              tone: "positive",
            },
          ],
        },
      });
    }
    if (path === "/predictions") {
      predictionRequest = route.request().postDataJSON();
      return reply({
        rows: [
          { category: "Supplies", quantity: 2, predicted_revenue: 48 },
          { category: "Services", quantity: 1, predicted_revenue: 120 },
        ],
        summary:
          "Two new orders scored and checked against your business database.",
        checked_against_database: true,
      });
    }
    return route.abort();
  });

  await page.goto("/");
  await useLiveWorkspace(page);
  await navigate(page, "Overview");
  await page.getByRole("button", { name: "New analysis" }).click();
  await page.getByLabel("Database name", { exact: true }).fill("business");
  await page.getByLabel("Username", { exact: true }).fill("analyst");
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Local business sales");
  await chooseGoal(page, "supervised");
  await page.getByLabel("Analysis name").fill("Local sales analysis");
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your local analysis is queued.",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Checking the data again",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "The engine is preparing the data and trying again.",
  );
  const completed = page.getByRole("dialog", { name: "Analysis complete" });
  await expect(completed).toBeVisible();
  await expect(completed).toContainText("81.0%");
  await expect(completed).toContainText("217");
  await completed.getByRole("button", { name: "View results" }).click();

  await expect(page.locator(".report-validation")).toContainText("81.0%");
  await expect(
    page.getByText("Order size explains the local sales pattern", {
      exact: true,
    }),
  ).toBeVisible();
  for (const label of [
    "Total revenue",
    "Active customers",
    "Average order value",
    "Data quality",
  ]) {
    await expect(
      page
        .locator(".metric-card")
        .filter({ hasText: label })
        .locator(".metric-value"),
    ).toHaveText("—");
  }
  await expect(page.locator(".khami-customer-total strong")).toHaveText("—");
  await expect(
    page.getByText("Occasional buyers", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("30%", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No revenue history is available for this dataset."),
  ).toBeVisible();
  await expect(
    page.getByText("No category breakdown is available."),
  ).toBeVisible();
  await expect(page.getByText("3,842", { exact: true })).toHaveCount(0);
  await expect(page.getByText("94.2%", { exact: true })).toHaveCount(0);

  await navigate(page, "Predictions");
  const csv = "category,quantity\nSupplies,2\nServices,1\n";
  await page.getByLabel("Upload prediction CSV").setInputFiles({
    name: "new-orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText("2 rows ready")).toBeVisible();
  await page.getByRole("button", { name: "Generate predictions" }).click();
  await expect(
    page.getByRole("heading", { name: "Prediction results" }),
  ).toBeVisible();
  await expect(
    page.getByText("Checked against your database", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample predictions", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".prediction-results tbody tr")).toHaveCount(2);
  await expect(
    page.locator(".prediction-results tbody tr").last(),
  ).toContainText("120");
  expect(predictionRequest).toEqual({
    analysis_id: "live-success-analysis",
    csv,
  });
  expect(polls).toBe(3);
  expect(browserErrors).toEqual([]);
});

test("mobile dashboard and navigation fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
  expect(await overflow()).toBe(false);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await navigate(page, "Predictions");
  await expect(
    page.getByRole("heading", { name: "Predictions", exact: true }),
  ).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await navigate(page, "Overview");
  await page
    .getByRole("button", { name: "New analysis", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await overflow()).toBe(false);
});
