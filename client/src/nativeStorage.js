import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Directory, Filesystem } from "@capacitor/filesystem";

const native = Capacitor.isNativePlatform();
const PREFIX = "ifac-universite";
const INDEX_KEY = "offline_documents_index";
let initialized;

async function ensureNativeStorage() {
  if (!native) return false;
  if (!initialized) initialized = SecureStorage.setKeyPrefix(PREFIX);
  await initialized;
  return true;
}

export function isNativeApp() {
  return native;
}

async function readSecureValue(key, fallback = null) {
  if (!(await ensureNativeStorage())) return fallback;
  try {
    return (await SecureStorage.get(key)) ?? fallback;
  } catch (error) {
    // The plugin reports invalidData when one encrypted entry is corrupted.
    // Remove only that entry; never clear the whole Android Keystore namespace.
    if (error?.code === "invalidData") {
      try { await SecureStorage.remove(key); } catch {}
      return fallback;
    }
    throw error;
  }
}

export async function getNativeSession() {
  return (await readSecureValue("session_token", null)) || null;
}

export async function saveNativeSession(token, email) {
  if (!(await ensureNativeStorage())) return;
  await SecureStorage.set("session_token", token);
  if (email) await SecureStorage.set("account_email", email);
}

export async function getNativeSavedEmail() {
  return (await readSecureValue("account_email", "")) || "";
}

export async function clearNativeSession() {
  if (!(await ensureNativeStorage())) return;
  await SecureStorage.remove("session_token");
}

async function readIndex() {
  const value = await readSecureValue(INDEX_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeDocumentKey(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function cacheNativeDocument(id, title, blob, kind = "class") {
  if (!(await ensureNativeStorage())) throw new Error("Cette fonction est réservée à l’application native.");
  const key = safeDocumentKey(`${kind}-${id}`);
  const path = `documents/${key}.pdf`;
  await Filesystem.writeFile({
    path,
    data: toBase64(await blob.arrayBuffer()),
    directory: Directory.Cache,
    recursive: true
  });
  const index = await readIndex();
  index[key] = { id: String(id), kind, title: title || `Document ${id}`, path, cachedAt: new Date().toISOString() };
  await SecureStorage.set(INDEX_KEY, index);
  return index[key];
}

export async function getCachedNativeDocument(id, kind = "class") {
  if (!(await ensureNativeStorage())) return null;
  const key = safeDocumentKey(`${kind}-${id}`);
  const index = await readIndex();
  const entry = index[key];
  if (!entry) return null;
  try {
    const result = await Filesystem.readFile({ path: entry.path, directory: Directory.Cache });
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ...entry, blob: new Blob([bytes], { type: "application/pdf" }) };
  } catch {
    delete index[key];
    await SecureStorage.set(INDEX_KEY, index);
    return null;
  }
}

export async function listCachedNativeDocuments() {
  const index = await readIndex();
  return Object.values(index);
}
