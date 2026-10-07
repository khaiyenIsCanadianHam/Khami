import type {
  AnalysisInput,
  AnalysisJob,
  Connection,
  ConnectionInput,
  PredictionResult,
} from "./types";

export class EngineError extends Error {
  code: string;
  constructor(message: string, code = "ERR_3") {
    super(message);
    this.code = code;
  }
}

export function normalizeEngineUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new EngineError(
      "Enter a complete engine address, such as http://localhost:8000.",
      "ERR_1",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new EngineError(
      "Use an HTTP or HTTPS address without credentials, query parameters, or a fragment.",
      "ERR_1",
    );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new EngineError(
      "Khami runs locally. Use localhost or 127.0.0.1 for your engine address.",
      "ERR_1",
    );
  return url.toString().replace(/\/$/, "");
}

async function request<T>(
  base: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(20000);
  try {
    const response = await fetch(`${normalizeEngineUrl(base)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new EngineError(
        "The engine sent a response we could not read. Check that this is the Khami API address.",
      );
    }
    if (!response.ok) {
      const detail = payload?.detail;
      throw new EngineError(
        typeof detail?.message === "string"
          ? detail.message
          : typeof detail === "string"
            ? detail
            : "Something interrupted this request. Please check your connection and try again.",
        detail?.code ?? "ERR_3",
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof EngineError) throw error;
    if (signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    throw new EngineError(
      "We couldn’t reach your local engine. Make sure it’s running, then check the address in Settings.",
      "ENGINE_UNAVAILABLE",
    );
  }
}

export const api = {
  health: (url: string) =>
    request<{ status: string; engine_ready: boolean }>(url, "/health"),
  connect: (url: string, input: ConnectionInput) =>
    request<Connection>(url, "/connections/test", input),
  analyze: (url: string, input: AnalysisInput) =>
    request<{ id: string }>(url, "/analyses", input),
  job: (url: string, id: string, signal?: AbortSignal) =>
    request<AnalysisJob>(
      url,
      `/analyses/${encodeURIComponent(id)}`,
      undefined,
      signal,
    ),
  predict: (url: string, id: string, csv: string) =>
    request<PredictionResult>(url, "/predictions", { analysis_id: id, csv }),
};

export function downloadFile(
  name: string,
  content: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
