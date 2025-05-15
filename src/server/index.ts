import cors from "cors";
import express from "express";
import { createServer } from "http";
import { handleProxyRequest } from "../utils/proxyUtils";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint - POST only
app.post("/api/proxy", async (req, res) => {
  const { url } = req.body;

  const result = await handleProxyRequest(url);

  Object.entries(result.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.status(result.status).send(result.body);
});

// Health check endpoint
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// Start the server
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
