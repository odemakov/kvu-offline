import { defineMiddleware } from './middleware';
import fetch from 'node-fetch';

export default defineMiddleware({
  name: 'proxy',
  handler: async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/proxy') {
      try {
        const body = await req.json();
        const { url } = body;
        
        if (!url || typeof url !== 'string') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid URL' }));
        }

        // Validate URL is from knigavuhe.org
        if (!url.includes('knigavuhe.org')) {
          res.statusCode = 403;
          return res.end(JSON.stringify({ error: 'Only knigavuhe.org URLs are allowed' }));
        }

        // Fetch the content from the provided URL
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        if (!response.ok) {
          res.statusCode = response.status;
          return res.end(JSON.stringify({ error: `Failed to fetch content: ${response.statusText}` }));
        }

        const content = await response.text();
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(content);
      } catch (error) {
        console.error('Proxy error:', error);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }

    // If not a POST request to /api/proxy, continue to the next middleware
    return undefined;
  },
});