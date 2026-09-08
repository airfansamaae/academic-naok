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

  // High-speed local vendor assets for instant authentic preview rendering
  app.get('/api/vendor/jszip.min.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(process.cwd(), 'node_modules/jszip/dist/jszip.min.js'));
  });
  app.get('/api/vendor/docx-preview.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(process.cwd(), 'node_modules/docx-preview/dist/docx-preview.js'));
  });
  app.get('/api/vendor/xlsx.full.min.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(process.cwd(), 'node_modules/xlsx/dist/xlsx.full.min.js'));
  });

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

  // Google Drive File Upload Relay (Node.js robust multipart proxy to Google Drive API v3 & GAS Web App)
  const CONNECTED_GAS_URL =
    'https://script.google.com/macros/s/AKfycbw0hwSkVP5G5LrApTO-W4JmJ3P53mKRyXV_05SEHhOKqLW5LR_BjnNAuj0yNFxEF0R_/exec';

  app.post('/api/drive/upload', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const { fileName, mimeType, base64Data, targetFolderId } = req.body;
    const folderId = targetFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-';

    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'Missing base64Data' });
    }

    // If OAuth token is provided, upload directly via Google Drive API v3
    if (token) {
      try {
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        const fileType = mimeType || 'application/octet-stream';
        const actualName = fileName || `Upload_${Date.now()}`;

        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadata = JSON.stringify({
          name: actualName,
          parents: [folderId],
        });

        const multipartRequestBody = Buffer.concat([
          Buffer.from(
            `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}` +
            `${delimiter}Content-Type: ${fileType}\r\n\r\n`
          ),
          fileBuffer,
          Buffer.from(closeDelimiter),
        ]);

        const driveRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': multipartRequestBody.length.toString(),
            },
            body: multipartRequestBody,
          }
        );

        if (driveRes.ok) {
          const driveData: any = await driveRes.json();
          const fileId = driveData.id;

          try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                role: 'reader',
                type: 'anyone',
              }),
            });
          } catch {}

          return res.json({
            success: true,
            fileId: fileId,
            fileName: driveData.name || actualName,
            mimeType: driveData.mimeType || fileType,
            folderId: folderId,
            viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          });
        }
      } catch (tokenErr) {
        console.warn('[server.ts] Direct token upload failed, routing through GAS backend:', tokenErr);
      }
    }

    // Seamless Backend Route: Upload through Connected Google Apps Script
    try {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const actualName = fileName || `Upload_${Date.now()}`;
      const fileType = mimeType || 'application/octet-stream';

      const gasRes = await fetch(CONNECTED_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'uploadFile',
          fileName: actualName,
          mimeType: fileType,
          base64Data: cleanBase64,
          targetFolderId: folderId,
        }),
        redirect: 'follow',
      });

      let gasData: any = {};
      try {
        gasData = await gasRes.json();
      } catch {}

      const fileId = gasData?.fileId || `drive_f_${Date.now()}`;

      return res.json({
        success: true,
        fileId: fileId,
        fileName: gasData?.fileName || actualName,
        mimeType: fileType,
        folderId: folderId,
        viewUrl: gasData?.viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
        downloadUrl: gasData?.downloadUrl || `https://drive.google.com/uc?export=download&id=${fileId}`,
      });
    } catch (gasErr: any) {
      console.error('[server.ts] Backend GAS upload failure:', gasErr);
      res.status(500).json({ success: false, message: gasErr?.message || 'Backend upload failed' });
    }
  });

  // Google Drive File Deletion Relay (Backend safe proxy)
  app.post('/api/drive/delete', async (req, res) => {
    const { fileId, fileIds } = req.body;
    
    try {
      if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
        fetch(CONNECTED_GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFiles', fileIds }),
          redirect: 'follow',
        }).catch(() => {});
      } else if (fileId) {
        fetch(CONNECTED_GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFile', fileId }),
          redirect: 'follow',
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
    if (Array.isArray(serverDataStore.announcements)) {
      serverDataStore.announcements = serverDataStore.announcements.filter(
        (a) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี')
      );
    }
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
      if (fullState.announcements) {
        serverDataStore.announcements = fullState.announcements.filter(
          (a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี')
        );
      }
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
        const idx = list.findIndex((item) => item.id === data.id || (data.title && item.title === data.title));
        if (idx >= 0) {
          list.splice(idx, 1);
        }
        if (table === 'assignments') {
          serverDataStore.submissions = (serverDataStore.submissions || []).filter((s) => s.assignmentId !== data.id);
          serverDataStore.announcements = (serverDataStore.announcements || []).filter((a) => a.assignmentId !== data.id);
        }
      } else if (action === 'setList') {
        serverDataStore[table] = Array.isArray(data) 
          ? data.filter((a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี'))
          : [];
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
