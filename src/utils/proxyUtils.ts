// Shared proxy logic
export async function handleProxyRequest(url: string | null | undefined): Promise<{
  body: any;
  status: number;
  headers: Record<string, string>;
}> {
  if (!url || typeof url !== "string") {
    return {
      body: JSON.stringify({ error: "Invalid URL" }),
      status: 400,
      headers: { "Content-Type": "application/json" },
    };
  }

  // Validate URL is from knigavuhe.org
  if (!url.includes("knigavuhe.org")) {
    return {
      body: JSON.stringify({ error: "Only knigavuhe.org URLs are allowed" }),
      status: 403,
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return {
        body: JSON.stringify({ error: `Failed to fetch: ${response.statusText}` }),
        status: response.status,
        headers: { "Content-Type": "application/json" },
      };
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("audio")) {
      const arrayBuffer = await response.arrayBuffer();
      return {
        body: Buffer.from(arrayBuffer),
        status: 200,
        headers: { "Content-Type": contentType },
      };
    } else {
      const content = await response.text();
      return {
        body: content,
        status: 200,
        headers: { "Content-Type": contentType || "text/html" },
      };
    }
  } catch (error) {
    console.error("Proxy error:", error);
    return {
      body: JSON.stringify({ error: "Internal server error" }),
      status: 500,
      headers: { "Content-Type": "application/json" },
    };
  }
}

/**
 * Makes a request through the proxy server
 * @param url - The URL to proxy (must be from knigavuhe.org)
 * @returns The proxied response
 */
export async function proxyRequest(url: string): Promise<Response> {
  const response = await fetch("/kvu-offline/api/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Proxy request failed");
  }

  return response;
}

/**
 * Fetches HTML content through the proxy
 * @param url - The URL to fetch
 * @returns The HTML content as a string
 */
export async function fetchProxiedHTML(url: string): Promise<string> {
  const response = await proxyRequest(url);
  return response.text();
}

/**
 * Fetches and parses JSON through the proxy
 * @param url - The URL to fetch
 * @returns The parsed JSON data
 */
export async function fetchProxiedJSON(url: string): Promise<any> {
  const response = await proxyRequest(url);
  return response.json();
}

/**
 * Downloads audio/binary data through the proxy
 * @param url - The URL to download
 * @returns The binary data as a Blob
 */
export async function downloadProxiedFile(url: string): Promise<Blob> {
  const response = await proxyRequest(url);
  return response.blob();
}
