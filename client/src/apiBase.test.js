import assert from "node:assert/strict";
import test from "node:test";
import { buildApiUrl, apiUrl } from "./apiBase.js";

test("web API calls use the versioned Express route", () => {
  assert.equal(apiUrl("/auth/login"), "/api/v1/auth/login");
  assert.equal(apiUrl("/catalog/universities"), "/api/v1/catalog/universities");
});

test("native API calls use the configured origin and versioned route", () => {
  assert.equal(
    buildApiUrl("/auth/login", "https://i-facuniversite.vercel.app"),
    "https://i-facuniversite.vercel.app/api/v1/auth/login"
  );
});

test("a configured API prefix is not duplicated", () => {
  assert.equal(
    buildApiUrl("/auth/login", "https://i-facuniversite.vercel.app/api/v1/"),
    "https://i-facuniversite.vercel.app/api/v1/auth/login"
  );
});

test("infrastructure paths that already begin with /api remain unchanged", () => {
  assert.equal(apiUrl("/api/health"), "/api/health");
});
