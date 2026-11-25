import test from "node:test";
import assert from "node:assert/strict";
import { readCatalogCache, writeCatalogCache } from "./catalogCache.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test("catalog cache stores and restores a public list by its exact API path", () => {
  const storage = memoryStorage();
  const rows = [{ id: 1, code: "UPNCH", name: "UPNCH" }];
  assert.equal(writeCatalogCache("/catalog/universities", rows, storage), true);
  assert.deepEqual(readCatalogCache("/catalog/universities", storage), rows);
  assert.equal(readCatalogCache("/catalog/faculties?universityId=1", storage), null);
});

test("an empty catalog is distinguishable from a missing cache", () => {
  const storage = memoryStorage();
  assert.equal(writeCatalogCache("/catalog/role-universities", [], storage), true);
  assert.deepEqual(readCatalogCache("/catalog/role-universities", storage), []);
});

test("invalid cache content is ignored without breaking the app", () => {
  const storage = memoryStorage({ "ifac_catalog_v1:/catalog/universities": "{bad json" });
  assert.equal(readCatalogCache("/catalog/universities", storage), null);
  assert.equal(writeCatalogCache("/catalog/universities", null, storage), false);
});

test("unavailable local storage never blocks catalog requests", () => {
  const storage = {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage full"); }
  };
  assert.equal(readCatalogCache("/catalog/universities", storage), null);
  assert.equal(writeCatalogCache("/catalog/universities", [{ id: 1 }], storage), false);
});
