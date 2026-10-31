import app from "../server/index.js";

export default function handler(req, res) {
  // Vercel rewrites all /api/* requests to this function. Restore the original
  // API path so the existing Express routes continue to work unchanged.
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const forwardedPath = requestUrl.searchParams.get("path");

  if (forwardedPath) {
    requestUrl.searchParams.delete("path");
    const query = requestUrl.searchParams.toString();
    req.url = `/api/${forwardedPath}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
