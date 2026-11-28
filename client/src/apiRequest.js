import { apiUrl } from "./apiBase.js";

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_RETRY_DELAY_MS = 900;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * Low-bandwidth API client.
 * - Public GET requests remain simple CORS requests (no unnecessary Content-Type).
 * - Read-only requests get one bounded retry for temporary network/server failures.
 * - Mutating requests are never retried automatically.
 */
export function createApiRequest({
  fetchImpl = (...args) => globalThis.fetch(...args),
  urlForPath = apiUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  waitImpl = wait
} = {}) {
  return async function request(path, { token, ...options } = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers = {
      Accept: "application/json",
      ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };
    const canRetry = method === "GET" || method === "HEAD";
    const maxAttempts = canRetry ? 2 : 1;
    const url = urlForPath(path);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let data;

      try {
        response = await fetchImpl(url, {
          ...options,
          method,
          headers,
          signal: controller.signal
        });
        data = response.status === 204 ? null : await response.json().catch(() => ({}));
      } catch (cause) {
        clearTimeout(timeout);
        const error = new Error(controller.signal.aborted ? "network_timeout" : "network_unreachable");
        error.cause = cause;
        if (attempt + 1 < maxAttempts) {
          await waitImpl(retryDelayMs);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const error = new Error(data?.message || data?.error || `http_${response.status}`);
        error.status = response.status;
        if (canRetry && RETRYABLE_STATUS_CODES.has(response.status) && attempt + 1 < maxAttempts) {
          await waitImpl(retryDelayMs);
          continue;
        }
        throw error;
      }

      return data;
    }

    throw new Error("network_unreachable");
  };
}

export const request = createApiRequest();
