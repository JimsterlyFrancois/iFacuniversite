import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createGeneralAdminRouter, normalizePlatformAnnouncement } from "./generalAdmin.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => {
    req.user = { id: 1, role: "admin" };
    next();
  };
  app.use(createGeneralAdminRouter({ pool, requireAuth }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("announcement normalization accepts a platform-wide audience and selected roles", () => {
  const result = normalizePlatformAnnouncement({
    title: "Information officielle",
    body: "Message aux responsables.",
    target: { roles: ["university_admin", "faculty_manager"] }
  });
  assert.deepEqual(result, {
    title: "Information officielle",
    body: "Message aux responsables.",
    universityId: null,
    facultyId: null,
    optionId: null,
    studyLevelId: null,
    roles: ["university_admin", "faculty_manager"]
  });
});

test("announcement normalization rejects invalid academic hierarchy and unknown roles", () => {
  assert.equal(normalizePlatformAnnouncement({
    title: "Titre", body: "Texte", target: { optionId: 2 }
  }), null);
  assert.equal(normalizePlatformAnnouncement({
    title: "Titre", body: "Texte", target: { roles: ["owner"] }
  }), null);
});

test("Super Admin can publish an announcement after the server validates its university hierarchy", async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
      if (sql.includes("LEFT JOIN faculties f")) return { rows: [{ id: 10 }], rowCount: 1 };
      if (sql.includes("INSERT INTO platform_announcements")) return { rows: [{ id: 25, title: "Avis", body: "Texte", is_active: true, created_at: "2026-11-25T12:00:00.000Z" }], rowCount: 1 };
      if (sql.includes("INSERT INTO platform_announcement_targets")) return { rows: [{ id: 26 }], rowCount: 1 };
      if (sql.includes("INSERT INTO admin_audit_logs")) return { rows: [{ id: 27 }], rowCount: 1 };
      throw new Error("Unexpected query: " + sql);
    },
    release() {}
  };
  const pool = { connect: async () => client };

  await withApi(pool, async base => {
    const response = await fetch(base + "/general-admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Avis",
        body: "Texte",
        target: { universityId: 3, facultyId: 7, roles: ["university_admin"] }
      })
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.announcement.id, 25);
    assert.match(body.message, /ciblage choisi/i);
    assert.deepEqual(calls.find(call => call.sql.includes("INSERT INTO platform_announcement_targets")).params, [25,3,7,null,null,["university_admin"]]);
    assert.equal(calls.some(call => call.sql.includes("INSERT INTO admin_audit_logs")), true);
  });
});
