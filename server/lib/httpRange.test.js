import assert from "node:assert/strict";
import test from "node:test";
import { parseSingleByteRange } from "./httpRange.js";

test("parses a bounded PDF byte range", () => {
  assert.deepEqual(parseSingleByteRange("bytes=0-65535", 150000), {
    start: 0, end: 65535, length: 65536, totalSize: 150000
  });
});

test("supports open-ended and suffix byte ranges", () => {
  assert.deepEqual(parseSingleByteRange("bytes=64000-", 70000), {
    start: 64000, end: 69999, length: 6000, totalSize: 70000
  });
  assert.deepEqual(parseSingleByteRange("bytes=-100", 70000), {
    start: 69900, end: 69999, length: 100, totalSize: 70000
  });
});

test("clips a range that extends beyond the end of the PDF", () => {
  assert.deepEqual(parseSingleByteRange("bytes=90-200", 100), {
    start: 90, end: 99, length: 10, totalSize: 100
  });
});

test("rejects multiple, malformed, and unsatisfiable ranges with HTTP 416 metadata", () => {
  for (const value of ["bytes=0-10,20-30", "items=0-10", "bytes=100-", "bytes=20-10"]) {
    assert.throws(
      () => parseSingleByteRange(value, 100),
      error => error.status === 416 && error.contentRange === "bytes */100"
    );
  }
});
