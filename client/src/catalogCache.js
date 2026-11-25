const CACHE_PREFIX = "ifac_catalog_v1:";

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Returns null when no valid cache exists; an empty array is a valid cached response.
export function readCatalogCache(path, storage) {
  if (typeof path !== "string" || !path) return null;
  try {
    const target = resolveStorage(storage);
    if (!target) return null;
    const raw = target.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCatalogCache(path, data, storage) {
  if (typeof path !== "string" || !path || !Array.isArray(data)) return false;
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(CACHE_PREFIX + path, JSON.stringify({ savedAt: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}
