import { createHash, createPrivateKey, createSign } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

const OUTPUT_DIR = path.resolve("dist");
const OTA_DIR = path.join(OUTPUT_DIR, "ota");
const BUNDLES_DIR = path.join(OTA_DIR, "bundles");
const PUBLIC_ORIGIN = "https://i-facuniversite.vercel.app";
const NATIVE_COMPATIBILITY = "ifac-android-live-update-v1";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[n] = value >>> 0;
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function createZipArchive(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const { time, day } = zipDateTime();

  for (const entry of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const name = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name || name.split("/").some(part => part === "..")) {
      throw new Error("Invalid OTA archive path.");
    }
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const flags = 0x0800;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(day, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(day, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt32LE(0, 36);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBuffer);

    localOffset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  const entryCount = centralParts.filter(part => part.length >= 4 && part.readUInt32LE(0) === 0x02014b50).length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function collectWebAssets(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "ota") continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = prefix ? prefix + "/" + entry.name : entry.name;

    if (entry.isDirectory()) {
      files.push(...await collectWebAssets(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({ name: relativePath, data: await readFile(absolutePath) });
    }
  }
  return files;
}

async function buildProductionOtaBundle() {
  if (process.env.VERCEL_ENV !== "production") {
    console.info("[iFac OTA] Publication ignorée hors production.");
    return;
  }

  const rawPrivateKey = process.env.OTA_SIGNING_PRIVATE_KEY;
  if (!rawPrivateKey) {
    throw new Error("OTA_SIGNING_PRIVATE_KEY must be configured as a sensitive Vercel Production environment variable.");
  }

  const privateKey = createPrivateKey(rawPrivateKey.replace(/\\n/g, "\n"));
  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error("OTA signing key must be an RSA private key.");
  }

  const files = await collectWebAssets(OUTPUT_DIR);
  if (!files.some(file => file.name === "index.html")) {
    throw new Error("Cannot create OTA bundle: dist/index.html is missing.");
  }

  const archive = createZipArchive(files);
  const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA || "").toLowerCase();
  const bundleId = /^[a-f0-9]{40,64}$/.test(commitSha)
    ? commitSha
    : createHash("sha256").update(archive).digest("hex");
  const checksum = createHash("sha256").update(archive).digest("hex");
  const signer = createSign("RSA-SHA256");
  signer.update(archive);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64");

  await mkdir(BUNDLES_DIR, { recursive: true });
  await writeFile(path.join(BUNDLES_DIR, bundleId + ".zip"), archive, { mode: 0o644 });

  const manifest = {
    schemaVersion: 1,
    platform: "android",
    nativeCompatibility: NATIVE_COMPATIBILITY,
    bundleId,
    createdAt: new Date().toISOString(),
    url: PUBLIC_ORIGIN + "/ota/bundles/" + bundleId + ".zip",
    checksum,
    signature
  };
  await writeFile(path.join(OTA_DIR, "latest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o644 });
  console.info("[iFac OTA] Bundle de production signé et publié :", bundleId);
}

await buildProductionOtaBundle();
