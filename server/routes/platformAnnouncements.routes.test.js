import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createPlatformAnnouncementsRouter } from "./platformAnnouncements.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => {
    req.user = { id: 42, role: "student" };
    next();
  };
  app.use(createPlatformAnnouncementsRouter({ pool, requireAuth }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("platform announcement feed derives active roles and scopes together from the authenticated account", async () => {
  const calls = [];
  const items = [{ id: 5, title: "Avis officiel", body: "Message ciblé", created_at: "2026-11-25T12:00:00.000Z" }];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: items, rowCount: items.length };
    }
  };

  await withApi(pool, async base => {
    const response = await fetch(base + "/general-announcements");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, items);
    assert.deepEqual(calls[0].params, [42]);
    assert.match(calls[0].sql, /WITH user_contexts\(role,university_id,faculty_id,option_id,study_level_id\) AS/);
    assert.match(calls[0].sql, /ra\.role,ra\.university_id,ra\.faculty_id,ra\.option_id,ra\.study_level_id/);
    assert.match(calls[0].sql, /uc\.role=ANY\(t\.target_roles\)/);
    assert.match(calls[0].sql, /uc\.university_id=uc\.university_id/);
    assert.match(calls[0].sql, /uc\.role='university_admin'/);
    assert.match(calls[0].sql, /un\.is_active=TRUE/);
    assert.doesNotMatch(calls[0].sql, /WITH user_roles\(role\) AS/);
    assert.doesNotMatch(calls[0].sql, /user_scopes\(/);
  });
});
