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

test("platform announcement feed uses the authenticated account and enforces active role and academic scope matching in SQL", async () => {
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
    assert.match(calls[0].sql, /WITH user_roles\(role\) AS/);
    assert.match(calls[0].sql, /user_scopes\(university_id,faculty_id,option_id,study_level_id\) AS/);
    assert.match(calls[0].sql, /CARDINALITY\(t.target_roles\)=0/);
    assert.match(calls[0].sql, /t\.study_level_id=s\.study_level_id/);
    assert.match(calls[0].sql, /un\.is_active=TRUE/);
    assert.match(calls[0].sql, /s\.faculty_id IS NULL AND EXISTS/);
  });
});
