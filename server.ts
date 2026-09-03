import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(process.cwd(), 'academic_db.json');

// Persistent database store for server-wide real-time sync across all browsers & D1
let serverDataVersion = Date.now();
let serverDataStore: Record<string, any[]> = {
  users: [],
  assignments: [],
  submissions: [],
  documents: [],
  announcements: [],
  lunch_menus: [],
  audit_logs: [],
};
let serverSchoolProfile: any = null;

// Load persisted data if file exists
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.data) serverDataStore = { ...serverDataStore, ...parsed.data };
    if (parsed.school) serverSchoolProfile = parsed.school;
    if (parsed.version) serverDataVersion = parsed.version;
  }
} catch (e) {
  console.warn('Could not read academic_db.json, starting fresh', e);
}

const saveDbToDisk = () => {
  try {
    fs.writeFileSync(
      DB_FILE_PATH,
      JSON.stringify({
        version: serverDataVersion,
        data: serverDataStore,
        school: serverSchoolProfile,
        savedAt: new Date().toISOString(),
      }),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save to academic_db.json:', err);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // SSE Clients list
  const sseClients: { id: string; res: express.Response }[] = [];

  // Health API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Academic Management System API',
      timestamp: new Date().toISOString(),
      serverDataVersion,
      connectedBrowsers: sseClients.length,
      driveConfig: {
        targetFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
        status: 'connected',
      },
    });
  });

  // 4.5 Protected School Lunch Gateway Redirect
  app.get('/api/lunch-redirect', (req, res) => {
    const TARGET_LUNCH_GAS_URL =
      'https://script.google.com/a/macros/krabiedu.go.th/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
    res.redirect(TARGET_LUNCH_GAS_URL);
  });

  // Google Drive File Deletion Relay (Backend safe proxy)
  app.post('/api/drive/delete', async (req, res) => {
    const { fileId, fileIds } = req.body;
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
    
    try {
      if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFiles', fileIds }),
        }).catch(() => {});
      } else if (fileId) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFile', fileId }),
        }).catch(() => {});
      }
      res.json({ success: true, message: 'Google Drive deletion queued safely' });
    } catch {
      res.json({ success: true, message: 'Ignored' });
    }
  });

  // Broadcast helper
  const broadcastSync = (eventType: string, payload: any) => {
    serverDataVersion = Date.now();
    const data = JSON.stringify({ 
      type: eventType, 
      payload, 
      version: serverDataVersion,
      timestamp: Date.now() 
    });
    
    sseClients.forEach((client) => {
      try {
        client.res.write(`data: ${data}\n\n`);
      } catch {
        // Handle disconnected client
      }
    });
  };

  // Real-time SSE Endpoint (Server-Sent Events)
  app.get('/api/sync/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    sseClients.push({ id: clientId, res });

    // Send initial ping with current version and active clients
    res.write(`data: ${JSON.stringify({ 
      type: 'INIT_SYNC', 
      version: serverDataVersion, 
      clientsCount: sseClients.length,
      timestamp: Date.now() 
    })}\n\n`);

    req.on('close', () => {
      const index = sseClients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  });

  // Keep-alive heartbeat every 15s
  setInterval(() => {
    sseClients.forEach((client) => {
      try {
        client.res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', version: serverDataVersion, timestamp: Date.now() })}\n\n`);
      } catch {
        // ignore
      }
    });
  }, 15000);

  // Check version endpoint (High-speed check for polling clients)
  app.get('/api/sync/version', (req, res) => {
    res.json({
      version: serverDataVersion,
      clientsCount: sseClients.length,
      timestamp: Date.now(),
    });
  });

  // Get all data collection
  app.get('/api/data/all', (req, res) => {
    res.json({
      version: serverDataVersion,
      data: serverDataStore,
      school: serverSchoolProfile,
      timestamp: Date.now(),
    });
  });

  // Sync / Mutate endpoint (insert, update, delete, batch)
  app.post('/api/sync', (req, res) => {
    const { table, action, data, school, fullState } = req.body;

    if (fullState) {
      // Full state sync
      if (fullState.users) serverDataStore.users = fullState.users;
      if (fullState.assignments) serverDataStore.assignments = fullState.assignments;
      if (fullState.submissions) serverDataStore.submissions = fullState.submissions;
      if (fullState.documents) serverDataStore.documents = fullState.documents;
      if (fullState.announcements) serverDataStore.announcements = fullState.announcements;
      if (fullState.lunch_menus) serverDataStore.lunch_menus = fullState.lunch_menus;
      if (fullState.audit_logs) serverDataStore.audit_logs = fullState.audit_logs;
      if (fullState.school) serverSchoolProfile = fullState.school;
    } else if (table && serverDataStore[table]) {
      const list = serverDataStore[table];
      if (action === 'insert') {
        const existingIdx = list.findIndex((item) => item.id === data.id);
        if (existingIdx >= 0) {
          list[existingIdx] = data;
        } else {
          list.unshift(data);
        }
      } else if (action === 'update') {
        const idx = list.findIndex((item) => item.id === data.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...data };
        } else {
          list.unshift(data);
        }
      } else if (action === 'delete') {
        const idx = list.findIndex((item) => item.id === data.id);
        if (idx >= 0) {
          list.splice(idx, 1);
        }
      } else if (action === 'setList') {
        serverDataStore[table] = Array.isArray(data) ? data : [];
      }
    }

    if (school) {
      serverSchoolProfile = school;
    }

    saveDbToDisk();

    broadcastSync('DATA_CHANGED', { table, action, dataId: data?.id });

    res.json({
      success: true,
      version: serverDataVersion,
      message: 'Synchronized across all browsers in real-time',
    });
  });

  // API trigger for real-time broadcasts
  app.post('/api/sync/broadcast', (req, res) => {
    const { eventType, payload } = req.body;
    broadcastSync(eventType || 'DATA_CHANGED', payload || {});
    res.json({ success: true, version: serverDataVersion });
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
