import assert from "node:assert/strict";
import test from "node:test";
import { createApiRequest } from "./apiRequest.js";

const ok = data => ({
  ok: true,
  status: 200,
  json: async () => data
});

const unavailable = status => ({
  ok: false,
  status,
  json: async () => ({ error: `temporary_${status}` })
});

test("public GET requests do not send an unnecessary JSON content type", async () => {
  let captured;
  const request = createApiRequest({
    urlForPath: path => `https://ifac.example${path}`,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return ok({ data: [] });
    }
  });

  await request("/catalog/universities");

  assert.equal(captured.url, "https://ifac.example/catalog/universities");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.headers.Accept, "application/json");
  assert.equal(captured.options.headers["Content-Type"], undefined);
});

test("JSON mutations keep the content type and bearer token", async () => {
  let captured;
  const request = createApiRequest({
    urlForPath: path => `https://ifac.example${path}`,
    fetchImpl: async (_url, options) => {
      captured = options;
      return ok({ token: "test-token" });
    }
  });

  await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "student@example.com" })
  });

  assert.equal(captured.headers["Content-Type"], "application/json");
});

test("read-only requests retry once after a network interruption", async () => {
  let calls = 0;
  const request = createApiRequest({
    urlForPath: path => path,
    retryDelayMs: 0,
    waitImpl: async () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary network loss");
      return ok({ data: ["cached-on-server"] });
    }
  });

  assert.deepEqual(await request("/catalog/universities"), { data: ["cached-on-server"] });
  assert.equal(calls, 2);
});

test("read-only requests retry temporary server responses once", async () => {
  let calls = 0;
  const request = createApiRequest({
    urlForPath: path => path,
    retryDelayMs: 0,
    waitImpl: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? unavailable(503) : ok({ data: [] });
    }
  });

  assert.deepEqual(await request("/catalog/universities"), { data: [] });
  assert.equal(calls, 2);
});

test("mutating requests are not retried after a network interruption", async () => {
  let calls = 0;
  const request = createApiRequest({
    urlForPath: path => path,
    retryDelayMs: 0,
    waitImpl: async () => {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error("connection lost");
    }
  });

  await assert.rejects(
    request("/auth/login", { method: "POST", body: "{}" }),
    error => error.message === "network_unreachable"
  );
  assert.equal(calls, 1);
});
