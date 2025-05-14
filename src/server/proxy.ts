import fetch from "node-fetch";
import { defineMiddleware } from "./middleware";

export default defineMiddleware({
  name: "proxy",
  handler: async (req, res) => {
    if (req.method === "POST" && req.url === "/api/proxy") {
      try {
        // If req has a json() method like in your original code
        const body = await req.json();
        const { url } = body;

        if (!url || typeof url !== "string") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid URL" }));
          return;
        }

        // Validate URL is from knigavuhe.org
        if (!url.includes("knigavuhe.org")) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Only knigavuhe.org URLs are allowed" }));
          return;
        }

        // Fetch the content from the provided URL
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        if (!response.ok) {
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: `Failed to fetch content: ${response.statusText}`,
            }),
          );
          return;
        }

        const content = await response.text();

        // Set appropriate headers
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(content);
        return;
      } catch (error) {
        console.error("Proxy error:", error);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
        return;
      }
    }

    // If not a POST request to /api/proxy, continue to the next middleware
    return undefined;
  },
});
