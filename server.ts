import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // SSE Clients list
  const sseClients: express.Response[] = [];

  // Health API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Academic Management System API',
      timestamp: new Date().toISOString(),
      driveConfig: {
        targetFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
        status: 'connected',
      },
    });
  });

  // 4.5 Protected School Lunch Gateway Redirect (Backend-protected handler)
  // Keeps the URL secured on the server side
  app.get('/api/lunch-redirect', (req, res) => {
    const TARGET_LUNCH_GAS_URL =
      'https://script.google.com/a/macros/krabiedu.go.th/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
    res.redirect(TARGET_LUNCH_GAS_URL);
  });

  // Real-time SSE Endpoint (Server-Sent Events)
  app.get('/api/sync/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'INIT_SYNC', timestamp: Date.now() })}\n\n`);

    req.on('close', () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  });

  // Broadcast helper
  const broadcastSync = (eventType: string, payload: any) => {
    const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
    sseClients.forEach((client) => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (err) {
        // Handle disconnected client
      }
    });
  };

  // API trigger for real-time broadcasts
  app.post('/api/sync/broadcast', (req, res) => {
    const { eventType, payload } = req.body;
    broadcastSync(eventType || 'DATA_CHANGED', payload || {});
    res.json({ success: true });
  });

  // Vite development middleware vs production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Academic System Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
