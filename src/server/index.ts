import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint
app.post('/api/proxy', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Validate URL is from knigavuhe.org
    if (!url.includes('knigavuhe.org')) {
      return res.status(403).json({ error: 'Only knigavuhe.org URLs are allowed' });
    }

    // Fetch the content from the provided URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch content: ${response.statusText}` });
    }

    const content = await response.text();
    
    // Send the HTML content back to the client
    res.type('text/html');
    res.send(content);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;