export function parseSingleByteRange(header, totalSize) {
  const size = Number(totalSize);
  const invalid = () => {
    const error = new Error("range_not_satisfiable");
    error.status = 416;
    error.contentRange = `bytes */${Number.isSafeInteger(size) && size >= 0 ? size : "*"}`;
    return error;
  };

  if (typeof header !== "string" || !header.trim()) return null;
  if (!Number.isSafeInteger(size) || size <= 0) throw invalid();

  // Multiple ranges are intentionally not supported; PDF.js requests one range at a time.
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) throw invalid();

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw invalid();
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      throw invalid();
    }
    end = Math.min(end, size - 1);
  }

  return { start, end, length: end - start + 1, totalSize: size };
}
