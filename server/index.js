import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT) || 3000;
const here = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ifacuniversite-api" });
});

app.get("/api/info", (_req, res) => {
  res.json({
    name: "iFacuniversite",
    stage: "prototype",
    message: "API de démarrage. Authentification et base de données non configurées."
  });
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(here, "../client/dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`iFacuniversite API disponible sur le port ${port}`);
});