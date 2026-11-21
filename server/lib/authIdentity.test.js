import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthUserId } from "./authIdentity.js";

test("password reset reuses a linked Auth identity without a lookup", async () => {
  const calls = [];
  const id = "a2e3d11c-726c-4b1c-9c21-6a8a2e1f0001";
  const client = { async query(...args) { calls.push(args); return { rows: [] }; } };
  assert.equal(await resolveAuthUserId(client, 12, id), id);
  assert.equal(calls.length, 0);
});

test("password reset links an unlinked Neon profile through the server-side Auth API", async () => {
  const id = "a2e3d11c-726c-4b1c-9c21-6a8a2e1f0002";
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT email,auth_user_id")) return { rows: [{ email: "Student@Example.com", auth_user_id: null }] };
      if (sql.startsWith("UPDATE users SET auth_user_id")) return { rows: [{ auth_user_id: id }] };
      throw new Error("Unexpected SQL query");
    }
  };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, async json() { return { users: [
      { id: "other-user", email: "other@example.com" },
      { id, email: "student@example.com" }
    ] }; } };
  };
  assert.equal(await resolveAuthUserId(client, 13, null, {
    supabaseUrl: "https://auth.example.test", secretKey: "server-only-test-key", fetchImpl
  }), id);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/auth\/v1\/admin\/users\?page=1&per_page=1000$/);
  assert.equal(requests[0].options.headers.apikey, "server-only-test-key");
  assert.deepEqual(calls[1].params, [id, 13]);
});

test("password reset returns null when an unlinked profile has no matching Auth identity", async () => {
  const client = { async query() { return { rows: [{ email: "missing@example.com", auth_user_id: null }] }; } };
  const result = await resolveAuthUserId(client, 14, null, {
    supabaseUrl: "https://auth.example.test",
    secretKey: "server-only-test-key",
    fetchImpl: async () => ({ ok: true, async json() { return { users: [] }; } })
  });
  assert.equal(result, null);
});

test("password reset surfaces Auth administration failures", async () => {
  const client = { async query() { return { rows: [{ email: "student@example.com", auth_user_id: null }] }; } };
  await assert.rejects(resolveAuthUserId(client, 15, null, {
    supabaseUrl: "https://auth.example.test",
    secretKey: "server-only-test-key",
    fetchImpl: async () => ({ ok: false, status: 403, async json() { return {}; } })
  }), /supabase_auth_user_lookup_failed/);
});
