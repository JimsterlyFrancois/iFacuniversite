import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import test from "node:test";
import { createZipArchive, crc32 } from "./build-ota-release.mjs";

test("CRC-32 matches the standard reference vector", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("OTA ZIP archive stores valid compressed web assets and a central directory", () => {
  const sourceFiles = [
    { name: "index.html", data: Buffer.from("<html>iFac</html>") },
    { name: "assets/app.js", data: Buffer.from("console.log('iFac OTA');") }
  ];
  const archive = createZipArchive(sourceFiles);

  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  let offset = 0;
  const decoded = [];

  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(offset + 18);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const fileName = archive.subarray(offset + 30, offset + 30 + fileNameLength).toString("utf8");
    const bytes = inflateRawSync(archive.subarray(dataStart, dataStart + compressedSize));
    decoded.push({ fileName, bytes: bytes.toString("utf8") });
    offset = dataStart + compressedSize;
  }

  assert.deepEqual(decoded, [
    { fileName: "assets/app.js", bytes: "console.log('iFac OTA');" },
    { fileName: "index.html", bytes: "<html>iFac</html>" }
  ]);
  assert.equal(archive.readUInt32LE(offset), 0x02014b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.equal(archive.readUInt16LE(archive.length - 12), 2);
});
