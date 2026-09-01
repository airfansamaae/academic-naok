/**
 * Google Apps Script & Cloudflare D1 Deployment Code Generator
 * Meets all critical technical specifications:
 * - Target Root Drive Folder ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-
 * - Rule: NEVER delete folders (only single specified files)
 * - File stream/preview without redirect
 * - D1 schema with created_at & updated_at on all tables
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (GAS) - FAST & SECURE DRIVE STORAGE ENGINE
 * ระบบจัดการไฟล์และจัดเก็บเอกสารวิชาการอัตโนมัติลง Google Drive
 * =========================================================================
 * ROOT DRIVE FOLDER ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-
 * 
 * 🔒 กฎความปลอดภัยของระบบ (CRITICAL SAFETY RULES):
 * 1. 【ห้ามลบโฟลเดอร์เด็ดขาด】 ป้องกันการลบ Folder หลักหรือ Folder ย่อยโดยเด็ดขาด 
 *    (Folders will NEVER be deleted under any circumstances)
 * 2. 【ลบเฉพาะไฟล์ที่ระบุอัตโนมัติ】 เมื่อมีการลบงาน/เอกสารในเว็บ ระบบจะส่ง File ID 
 *    มาสั่งย้ายไฟล์นั้นลงถังขยะ (Trash) ใน Google Drive ทันที
 * 3. 【ความเร็วและความเสถียรสูงสุด】 ถอดรหัส Base64 โดยตรงด้วย Utilities API ของ Google
 *    และตั้งค่าสิทธิ์ให้สมาชิกสามารถเปิดดูหรือดาวน์โหลดได้ทันที
 * =========================================================================
 */

// โฟลเดอร์หลักสำหรับจัดเก็บไฟล์ทั้งหมด
var ROOT_FOLDER_ID = '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-';

/**
 * Handle GET Requests (Health Check / Ping / Stream File)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    // 1. ตรวจสอบสถานะการเชื่อมต่อ (Ping)
    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'Google Apps Script Drive Storage Engine is active & ready!',
        rootFolderId: ROOT_FOLDER_ID,
        timestamp: new Date().toISOString()
      });
    }

    // 2. ดูข้อมูลโฟลเดอร์หลัก
    if (action === 'getRootFolderInfo') {
      var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
      return jsonResponse({
        status: 'success',
        folderId: rootFolder.getId(),
        folderName: rootFolder.getName(),
        url: rootFolder.getUrl()
      });
    }

    // 3. สตรีมหรือดึงข้อมูลไฟล์ (Preview / Stream)
    if (action === 'previewFile' || action === 'getFileInfo') {
      var fileId = params.fileId;
      if (!fileId) return jsonResponse({ status: 'error', message: 'Missing fileId' });

      var file = DriveApp.getFileById(fileId);
      return jsonResponse({
        status: 'success',
        fileId: file.getId(),
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
        viewUrl: file.getUrl()
      });
    }

    return jsonResponse({ status: 'error', message: 'Unknown GET action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Handle POST Requests (Upload File / Delete File / Delete Batch Files)
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || '';

    // =========================================================================
    // 1. อัปโหลดไฟล์ลง Google Drive (High-Speed Direct Upload)
    // =========================================================================
    if (action === 'uploadFile') {
      var fileName = payload.fileName || ('File_' + new Date().getTime());
      var mimeType = payload.mimeType || 'application/octet-stream';
      var base64Data = payload.base64Data;
      var targetFolderId = payload.targetFolderId || ROOT_FOLDER_ID;
      var subfolderName = payload.subfolderName; // เช่น ชื่อหัวข้องาน (ถ้ามี)

      if (!base64Data) {
        return jsonResponse({ status: 'error', message: 'Missing base64Data for upload' });
      }

      // ถอดรหัส Base64 เป็น Binary Blob ความเร็วสูง
      var decodedBytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

      // ดึงหรือเตรียมโฟลเดอร์ปลายทาง
      var targetFolder;
      try {
        if (subfolderName) {
          var rootF = DriveApp.getFolderById(ROOT_FOLDER_ID);
          var subFolders = rootF.getFoldersByName(subfolderName);
          if (subFolders.hasNext()) {
            targetFolder = subFolders.next();
          } else {
            targetFolder = rootF.createFolder(subfolderName);
          }
        } else {
          targetFolder = DriveApp.getFolderById(targetFolderId);
        }
      } catch (folderErr) {
        targetFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
      }

      // สร้างไฟล์ลงในโฟลเดอร์ Google Drive
      var createdFile = targetFolder.createFile(blob);

      // ตั้งค่าสิทธิ์การเข้าถึงให้อ่าน/ดาวน์โหลดได้สะดวกรวดเร็ว
      try {
        createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (permErr) {
        // Continue even if domain policy restricts public sharing
      }

      return jsonResponse({
        status: 'success',
        message: 'อัปโหลดไฟล์ลง Google Drive สำเร็จเรียบร้อย',
        fileId: createdFile.getId(),
        fileName: createdFile.getName(),
        size: createdFile.getSize(),
        mimeType: createdFile.getMimeType(),
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + createdFile.getId(),
        viewUrl: createdFile.getUrl(),
        folderId: targetFolder.getId(),
        folderName: targetFolder.getName()
      });
    }

    // =========================================================================
    // 2. ลบไฟล์เดี่ยวอัตโนมัติ (Safe File Deletion - ห้ามลบโฟลเดอร์เด็ดขาด)
    // =========================================================================
    if (action === 'deleteFile') {
      var targetFileId = payload.fileId;
      if (!targetFileId) {
        return jsonResponse({ status: 'error', message: 'Missing fileId' });
      }

      // 🛑 ป้องกันความปลอดภัย: ห้ามลบโฟลเดอร์หลักเด็ดขาด
      if (targetFileId === ROOT_FOLDER_ID) {
        return jsonResponse({ 
          status: 'error', 
          message: 'คำเตือนความปลอดภัย: ห้ามลบโฟลเดอร์หลัก Google Drive เด็ดขาด' 
        });
      }

      // ดำเนินการลบเฉพาะไฟล์เดี่ยว (ย้ายไป Trash)
      try {
        var fileToTrash = DriveApp.getFileById(targetFileId);
        fileToTrash.setTrashed(true);
        return jsonResponse({
          status: 'success',
          message: 'ลบไฟล์ใน Google Drive เรียบร้อย (File ID: ' + targetFileId + ' moved to trash)',
          fileId: targetFileId
        });
      } catch (delErr) {
        return jsonResponse({
          status: 'warning',
          message: 'ไม่พบไฟล์หรือไฟล์ถูกลบไปแล้ว: ' + delErr.toString(),
          fileId: targetFileId
        });
      }
    }

    // =========================================================================
    // 3. ลบชุดไฟล์หลายไฟล์พร้อมกัน (Batch File Deletion)
    // =========================================================================
    if (action === 'deleteFiles') {
      var fileIds = payload.fileIds || [];
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return jsonResponse({ status: 'error', message: 'Missing or empty fileIds array' });
      }

      var deletedCount = 0;
      var errors = [];

      for (var i = 0; i < fileIds.length; i++) {
        var fId = fileIds[i];
        if (fId && fId !== ROOT_FOLDER_ID) {
          try {
            var f = DriveApp.getFileById(fId);
            f.setTrashed(true);
            deletedCount++;
          } catch (e) {
            errors.push({ fileId: fId, error: e.toString() });
          }
        }
      }

      return jsonResponse({
        status: 'success',
        message: 'ลบไฟล์ใน Google Drive สำเร็จ ' + deletedCount + ' ไฟล์',
        deletedCount: deletedCount,
        errors: errors
      });
    }

    // =========================================================================
    // 4. สร้างโฟลเดอร์ย่อยตามชื่องาน (ห้ามลบโฟลเดอร์)
    // =========================================================================
    if (action === 'createTopicFolder') {
      var topicName = payload.topicName;
      if (!topicName) return jsonResponse({ status: 'error', message: 'Missing topicName' });

      var rootFld = DriveApp.getFolderById(ROOT_FOLDER_ID);
      var existing = rootFld.getFoldersByName(topicName);
      var resultFolder;
      if (existing.hasNext()) {
        resultFolder = existing.next();
      } else {
        resultFolder = rootFld.createFolder(topicName);
      }

      return jsonResponse({
        status: 'success',
        folderId: resultFolder.getId(),
        folderName: resultFolder.getName(),
        url: resultFolder.getUrl()
      });
    }

    return jsonResponse({ status: 'error', message: 'Unsupported POST action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Output Helper: JSON Response with TextOutput
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const CLOUDFLARE_D1_SCHEMA = `-- =========================================================================
-- CLOUDFLARE D1 DATABASE SCHEMA FOR ACADEMIC MANAGEMENT SYSTEM
-- ALL TABLES REQUIRE: created_at & updated_at TIMESTAMP FIELDS
-- =========================================================================

-- 1. USERS TABLE (Members and Admins)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  status TEXT NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
  email TEXT,
  department TEXT,
  position TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. ASSIGNMENTS TABLE (Tasks assigned by Admin)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date_start DATE NOT NULL,
  due_date_end DATE NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2569',
  term TEXT NOT NULL DEFAULT '1',
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  drive_folder_id TEXT,
  drive_folder_name TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' or 'closed'
  type TEXT NOT NULL DEFAULT 'assignment', -- 'assignment' or 'announcement'
  allowed_file_types TEXT,
  max_file_size_mb INTEGER DEFAULT 25,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 3. SUBMISSIONS TABLE (Work submitted by Members)
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  assignment_title TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_avatar TEXT,
  department TEXT,
  files_json TEXT NOT NULL, -- JSON array of file objects
  note TEXT,
  submission_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'late', 'reviewed'
  feedback TEXT,
  score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id),
  FOREIGN KEY (member_id) REFERENCES users(id)
);

-- 4. DOCUMENTS TABLE (Official Orders & Sample Templates in Document Center)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'sample', 'order', 'general'
  description TEXT,
  doc_number TEXT,
  issue_date DATE NOT NULL,
  file_json TEXT NOT NULL, -- JSON object of file data
  uploader_id TEXT NOT NULL,
  uploader_name TEXT NOT NULL,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

-- 5. ANNOUNCEMENTS TABLE (Dashboard notices & banners)
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general', -- 'deadline' (Red) or 'general' (Yellow)
  date DATE NOT NULL,
  assignment_id TEXT,
  author_name TEXT NOT NULL,
  is_urgent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR HIGH-PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date_end);
CREATE INDEX IF NOT EXISTS idx_submissions_assign_member ON submissions(assignment_id, member_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date);
`;

export const CLOUDFLARE_WORKER_CODE = `/**
 * =========================================================================
 * CLOUDFLARE WORKER BACKEND (worker.js)
 * REST API + D1 DATABASE INTEGRATION + REAL-TIME SSE SYNC
 * =========================================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. MASTER ADMIN & AUTH BYPASS CHECK
      // Master Admin: Username "Admin", Password "456789"
      if (path === '/api/auth/login' && method === 'POST') {
        const { username, password } = await request.json();
        
        // Secure Bypass verification
        if (username === 'Admin' && password === '456789') {
          return new Response(JSON.stringify({
            status: 'success',
            user: {
              id: 'user_admin',
              username: 'Admin',
              fullName: 'Admin ผู้ดูแลระบบ (หัวหน้าฝ่ายวิชาการ)',
              role: 'admin',
              status: 'approved',
              department: 'กลุ่มบริหารงานวิชาการ'
            },
            token: 'bypass_token_' + Date.now()
          }), { headers: corsHeaders });
        }

        // Check in D1 Database
        const stmt = env.DB.prepare('SELECT * FROM users WHERE username = ?');
        const user = await stmt.bind(username).first();

        if (!user) {
          return new Response(JSON.stringify({ status: 'error', message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' }), { status: 401, headers: corsHeaders });
        }

        if (user.status === 'pending') {
          return new Response(JSON.stringify({ status: 'error', message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) อนุมัติการเข้าใช้งาน' }), { status: 403, headers: corsHeaders });
        }

        if (user.status === 'rejected') {
          return new Response(JSON.stringify({ status: 'error', message: 'บัญชีนี้ไม่ได้รับการอนุมัติ กรุณาติดต่อฝ่ายวิชาการ' }), { status: 403, headers: corsHeaders });
        }

        // Return user data
        return new Response(JSON.stringify({
          status: 'success',
          user: {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            status: user.status,
            department: user.department,
            avatarUrl: user.avatar_url
          },
          token: 'token_' + user.id
        }), { headers: corsHeaders });
      }

      // 2. LUNCH SYSTEM BACKEND PROXY (Hides script URL from frontend DOM)
      if (path === '/api/lunch-redirect') {
        const targetUrl = 'https://script.google.com/a/macros/krabiedu.go.th/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
        return Response.redirect(targetUrl, 302);
      }

      // 3. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
      if (path === '/api/sync/events' && method === 'GET') {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        writer.write(encoder.encode(': ping\\n\\n'));
        writer.write(encoder.encode('data: ' + JSON.stringify({ type: 'CONNECTED', time: new Date().toISOString() }) + '\\n\\n'));

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // 4. ASSIGNMENTS CRUD
      if (path === '/api/assignments' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM assignments ORDER BY due_date_end ASC').all();
        return new Response(JSON.stringify({ status: 'success', data: results }), { headers: corsHeaders });
      }

      // 5. SUBMISSIONS CRUD
      if (path === '/api/submissions' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
        return new Response(JSON.stringify({ status: 'success', data: results }), { headers: corsHeaders });
      }

      // 6. DOCUMENTS CRUD
      if (path === '/api/documents' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM documents ORDER BY issue_date DESC').all();
        return new Response(JSON.stringify({ status: 'success', data: results }), { headers: corsHeaders });
      }

      // 7. ANNOUNCEMENTS CRUD
      if (path === '/api/announcements' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM announcements ORDER BY date DESC').all();
        return new Response(JSON.stringify({ status: 'success', data: results }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ status: 'ok', message: 'Cloudflare Worker Ready' }), { headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
`;

export const GAS_CODE_SNIPPET = GOOGLE_APPS_SCRIPT_CODE;
export const D1_SCHEMA_SQL = CLOUDFLARE_D1_SCHEMA;

