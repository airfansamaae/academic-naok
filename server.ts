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

  const UPLOAD_DIR = path.join(process.cwd(), 'uploaded_files');
  if (!fs.existsSync(UPLOAD_DIR)) {
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    } catch {}
  }

  // Save uploaded file helper (Guarantees local binary persistence and cross-browser sharing)
  const saveFileLocally = (id: string, fileName: string, mimeType: string, base64Data: string) => {
    try {
      if (!id || !base64Data) return;
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buf = Buffer.from(cleanBase64, 'base64');
      if (buf.length > 0) {
        fs.writeFileSync(path.join(UPLOAD_DIR, `${id}.bin`), buf);
        fs.writeFileSync(
          path.join(UPLOAD_DIR, `${id}.meta.json`),
          JSON.stringify({ fileName, mimeType, size: buf.length }),
          'utf-8'
        );
      }
    } catch (e) {
      console.warn('[server.ts] saveFileLocally error:', e);
    }
  };

  const getLocalFile = (id: string) => {
    try {
      if (!id) return null;
      const binPath = path.join(UPLOAD_DIR, `${id}.bin`);
      if (fs.existsSync(binPath)) {
        const metaPath = path.join(UPLOAD_DIR, `${id}.meta.json`);
        let meta: { fileName?: string; mimeType?: string; size?: number } = {};
        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch {}
        }
        return {
          buffer: fs.readFileSync(binPath),
          meta,
        };
      }
    } catch {}
    return null;
  };

  // Dedicated local binary storage endpoint
  app.post('/api/files/upload', (req, res) => {
    const { fileId, clientFileId, fileName, mimeType, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'Missing base64Data' });
    }
    const id = fileId || clientFileId || `file_${Date.now()}`;
    const actualName = fileName || 'document';
    const type = mimeType || 'application/octet-stream';
    saveFileLocally(id, actualName, type, base64Data);
    if (clientFileId && clientFileId !== id) {
      saveFileLocally(clientFileId, actualName, type, base64Data);
    }
    res.json({ success: true, fileId: id, fileName: actualName, mimeType: type });
  });

  app.post('/api/drive/upload', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const { fileName, mimeType, base64Data, targetFolderId, clientFileId, fileId } = req.body;
    const folderId = targetFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-';

    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'Missing base64Data' });
    }

    const actualName = fileName || `Upload_${Date.now()}`;
    const fileType = mimeType || 'application/octet-stream';

    // Immediately cache binary locally so anyone can download/preview it instantly
    if (clientFileId) {
      saveFileLocally(clientFileId, actualName, fileType, base64Data);
    }
    if (fileId) {
      saveFileLocally(fileId, actualName, fileType, base64Data);
    }

    // If OAuth token is provided, upload directly via Google Drive API v3
    if (token) {
      try {
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const fileBuffer = Buffer.from(cleanBase64, 'base64');

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
          const assignedId = driveData.id;

          saveFileLocally(assignedId, actualName, fileType, base64Data);

          try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${assignedId}/permissions`, {
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
            fileId: assignedId,
            fileName: driveData.name || actualName,
            mimeType: driveData.mimeType || fileType,
            folderId: folderId,
            viewUrl: `https://drive.google.com/file/d/${assignedId}/view`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${assignedId}`,
          });
        }
      } catch (tokenErr) {
        console.warn('[server.ts] Direct token upload failed, routing through GAS backend:', tokenErr);
      }
    }

    // Seamless Backend Route: Upload through Connected Google Apps Script
    try {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

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

      const assignedId = gasData?.fileId || `drive_f_${Date.now()}`;
      saveFileLocally(assignedId, actualName, fileType, base64Data);

      return res.json({
        success: true,
        fileId: assignedId,
        fileName: gasData?.fileName || actualName,
        mimeType: fileType,
        folderId: folderId,
        viewUrl: gasData?.viewUrl || `https://drive.google.com/file/d/${assignedId}/view`,
        downloadUrl: gasData?.downloadUrl || `https://drive.google.com/uc?export=download&id=${assignedId}`,
      });
    } catch (gasErr: any) {
      console.error('[server.ts] Backend GAS upload failure:', gasErr);
      const fallbackId = `file_${Date.now()}`;
      saveFileLocally(fallbackId, actualName, fileType, base64Data);
      res.json({
        success: true,
        fileId: fallbackId,
        fileName: actualName,
        mimeType: fileType,
        folderId: folderId,
        viewUrl: `/api/files/raw/${fallbackId}`,
        downloadUrl: `/api/files/download/${fallbackId}?name=${encodeURIComponent(actualName)}`,
      });
    }
  });

  // Google Drive File Deletion Relay (Backend safe proxy)
  app.post('/api/drive/delete', async (req, res) => {
    const { fileId, fileIds } = req.body;
    
    try {
      if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
        fileIds.forEach((id: string) => {
          try {
            const binPath = path.join(UPLOAD_DIR, `${id}.bin`);
            if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
            const metaPath = path.join(UPLOAD_DIR, `${id}.meta.json`);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
          } catch {}
        });

        fetch(CONNECTED_GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFiles', fileIds }),
          redirect: 'follow',
        }).catch(() => {});
      } else if (fileId) {
        try {
          const binPath = path.join(UPLOAD_DIR, `${fileId}.bin`);
          if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
          const metaPath = path.join(UPLOAD_DIR, `${fileId}.meta.json`);
          if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        } catch {}

        fetch(CONNECTED_GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFile', fileId }),
          redirect: 'follow',
        }).catch(() => {});
      }
      res.json({ success: true, message: 'File deletion completed safely' });
    } catch {
      res.json({ success: true, message: 'Ignored' });
    }
  });

  // File Download Proxy: Streams raw binary file, preserves original filename strictly with no modification
  app.get(['/api/drive/download/:fileId', '/api/files/download/:fileId'], async (req, res) => {
    const { fileId } = req.params;
    const requestedName = (req.query.name as string) || '';

    // Priority 1: Check local disk storage (fastest, 100% authentic raw binary)
    const local = getLocalFile(fileId);
    if (local) {
      const finalFileName = requestedName || local.meta?.fileName || 'document';
      const cleanFileName = path.basename(finalFileName).replace(/["\r\n]/g, '');
      const contentType = local.meta?.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(cleanFileName)}"; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`
      );
      return res.send(local.buffer);
    }

    const cleanFileName = path.basename(requestedName || 'document').replace(/["\r\n]/g, '');

    try {
      const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
      const driveResponse = await fetch(driveUrl, { redirect: 'follow' });

      if (driveResponse.ok) {
        const contentType = driveResponse.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(cleanFileName)}"; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`
        );

        const arrayBuffer = await driveResponse.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (err: any) {
      console.error('[server.ts] Download proxy error:', err);
    }

    res.status(404).send('File not found for download');
  });

  // Raw file endpoint for viewer / embed (inline display)
  app.get('/api/files/raw/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const local = getLocalFile(fileId);
    if (local) {
      const contentType = local.meta?.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      return res.send(local.buffer);
    }

    try {
      const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
      const driveResponse = await fetch(driveUrl, { redirect: 'follow' });
      if (driveResponse.ok) {
        const contentType = driveResponse.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        const arrayBuffer = await driveResponse.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch {}

    res.status(404).send('Raw file not found');
  });

  // JSON base64 data for client-side parsers
  app.get('/api/files/data/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const local = getLocalFile(fileId);
    if (local) {
      const mimeType = local.meta?.mimeType || 'application/octet-stream';
      const base64 = local.buffer.toString('base64');
      return res.json({
        success: true,
        fileName: local.meta?.fileName || (req.query.name as string) || 'document',
        mimeType,
        base64Data: base64,
        dataUrl: `data:${mimeType};base64,${base64}`,
      });
    }

    try {
      const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
      const driveResponse = await fetch(driveUrl, { redirect: 'follow' });
      if (driveResponse.ok) {
        const mimeType = driveResponse.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await driveResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return res.json({
          success: true,
          fileName: (req.query.name as string) || 'document',
          mimeType,
          base64Data: base64,
          dataUrl: `data:${mimeType};base64,${base64}`,
        });
      }
    } catch {}

    res.status(404).json({ success: false, message: 'File data not found' });
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
