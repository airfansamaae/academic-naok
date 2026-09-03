import { UploadedFile } from '../types';

/**
 * Utility to open authentic attached files in a full-screen new tab.
 * Strictly displays the ACTUAL attached file with zero fabrication or artificial embellishment.
 * Never forces restricted cross-origin Google Drive iframes that produce 'You need access' errors.
 */
export function openAuthenticFileInNewTab(
  file: UploadedFile,
  assignmentTitle?: string,
  submitterName?: string
) {
  if (!file) return;

  // 1. Synchronously open new tab to prevent browser pop-up blockers
  const newTab = window.open('', '_blank');
  if (!newTab) {
    alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิดดูตัวอย่างไฟล์เต็มหน้าจอ');
    return;
  }

  // 2. Prepare file metadata and determine file type
  const lowerName = (file.name || '').toLowerCase();
  const isPdf = file.previewType === 'pdf' || lowerName.endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'));
  const isImage = file.previewType === 'image' || lowerName.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || (file.mimeType && file.mimeType.includes('image'));
  const isCsv = lowerName.endsWith('.csv') || (file.mimeType && file.mimeType.includes('csv'));
  const isText = lowerName.match(/\.(txt|json|md|html|xml|log|js|ts|py|sql)$/) || (file.mimeType && file.mimeType.includes('text'));
  const isDoc = file.previewType === 'doc' || lowerName.match(/\.(docx|doc)$/) || (file.mimeType && file.mimeType.includes('word'));
  const isSpreadsheet = file.previewType === 'spreadsheet' || lowerName.match(/\.(xlsx|xls)$/) || (file.mimeType && file.mimeType.includes('sheet'));
  const isPresentation = file.previewType === 'presentation' || lowerName.match(/\.(pptx|ppt)$/) || (file.mimeType && file.mimeType.includes('presentation'));

  let blobUrl = '';
  let fileBase64 = '';
  let textDecoded: string | null = null;
  let parsedCsv: string[][] | null = null;

  // Extract base64 and create Object Blob URL if data is present
  if (file.fileDataUrl && file.fileDataUrl.startsWith('data:')) {
    try {
      const parts = file.fileDataUrl.split(';base64,');
      const mime = parts[0].replace('data:', '') || file.mimeType || 'application/octet-stream';
      fileBase64 = parts[1] || '';
      if (fileBase64) {
        const byteCharacters = atob(fileBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: mime });
        blobUrl = URL.createObjectURL(blob);

        if (isCsv || isText) {
          try {
            const decoder = new TextDecoder('utf-8');
            textDecoded = decoder.decode(byteNumbers);
            if (isCsv && textDecoded) {
              parsedCsv = textDecoded
                .split(/\r?\n/)
                .filter((r) => r.trim().length > 0)
                .map((row) => row.split(',').map((c) => c.trim().replace(/^["']|["']$/g, '')));
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Failed to construct blob URL for preview:', err);
    }
  }

  // File size text
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const sizeText = file.size > 1024 * 1024 
    ? `${sizeMb} MB` 
    : `${(file.size / 1024).toFixed(1)} KB`;

  // Escape HTML helper
  const esc = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Shared Drive Root Folder
  const driveSharedFolderUrl = 'https://drive.google.com/drive/folders/1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-?usp=sharing';

  // File type badge label & color
  let typeBadge = 'เอกสาร';
  let badgeColor = '#64748b';
  if (isPdf) { typeBadge = 'PDF DOCUMENT'; badgeColor = '#ef4444'; }
  else if (isImage) { typeBadge = 'IMAGE'; badgeColor = '#3b82f6'; }
  else if (isSpreadsheet || isCsv) { typeBadge = 'EXCEL / SPREADSHEET'; badgeColor = '#10b981'; }
  else if (isDoc) { typeBadge = 'WORD DOCUMENT (.DOCX)'; badgeColor = '#2563eb'; }
  else if (isPresentation) { typeBadge = 'POWERPOINT'; badgeColor = '#f97316'; }

  // Generate Viewport Content
  let viewportHtml = '';

  if (isPdf) {
    if (blobUrl) {
      viewportHtml = `
        <iframe 
          id="previewFrame" 
          src="${blobUrl}#toolbar=1&navpanes=1" 
          style="width: 100%; height: 100%; border: none; background: #525659;"
          title="${esc(file.name)}"
        ></iframe>
      `;
    } else {
      viewportHtml = `
        <div class="empty-view">
          <div class="card" style="max-width: 600px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 12px;">📕</div>
            <h3 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">${esc(file.name)}</h3>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
              ขนาดไฟล์: <strong>${sizeText}</strong> • อัปโหลดเมื่อ: <strong>${new Date(file.uploadedAt).toLocaleString('th-TH')}</strong>
            </p>
            <div style="background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <div>📌 <strong>ชื่องาน:</strong> ${esc(assignmentTitle || 'งานวิชาการ')}</div>
              <div>👤 <strong>ผู้ส่ง:</strong> ${esc(submitterName || 'สมาชิก')}</div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button id="downloadOriginalBtn" class="btn primary">⬇️ ดาวน์โหลดไฟล์ PDF</button>
              ${file.viewUrl ? `<a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary">🌐 เปิดใน Google Drive</a>` : ''}
              <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn secondary">📁 เปิดโฟลเดอร์ Google Drive รวม</a>
            </div>
          </div>
        </div>
      `;
    }
  } else if (isImage) {
    const imgSrc = blobUrl || file.fileDataUrl || file.viewUrl || '';
    viewportHtml = `
      <div class="image-viewport" id="imageViewport">
        <img 
          id="mainImg" 
          src="${imgSrc}" 
          alt="${esc(file.name)}"
          style="max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);" 
        />
      </div>
    `;
  } else if (isDoc) {
    viewportHtml = `
      <div id="docxViewport" style="height: 100%; overflow-y: auto; background: #0f172a; padding: 24px 16px; display: flex; flex-direction: column; align-items: center;">
        <div id="docxLoading" style="color: #cbd5e1; font-size: 14px; margin-top: 50px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
          <div class="spinner"></div>
          <span style="font-weight: 600; letter-spacing: 0.3px;">กำลังประมวลผลและเรนเดอร์หน้าเอกสาร Word (.docx) ต้นฉบับจริง...</span>
          <span style="font-size: 12px; color: #94a3b8;">ถอดรหัสเนื้อหา ตาราง และฟอนต์จากไฟล์ที่แนบมา</span>
        </div>
        <div id="docxContainer" style="width: 100%; max-width: 900px; display: none;"></div>
        <div id="docxFallback" style="width: 100%; max-width: 650px; display: none; margin-top: 30px;">
          <div class="card" style="text-align: center;">
            <div style="font-size: 44px; margin-bottom: 12px;">📘</div>
            <h3 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">${esc(file.name)}</h3>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
              ประเภท: <strong>${typeBadge}</strong> • ขนาด: <strong>${sizeText}</strong>
            </p>
            <div style="background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.7;">
              <div>📌 <strong>ชื่องาน:</strong> ${esc(assignmentTitle || 'งานมอบหมายวิชาการ')}</div>
              <div>👤 <strong>ผู้ส่ง:</strong> ${esc(submitterName || 'สมาชิก')}</div>
              <div>⏰ <strong>วันที่อัปโหลด:</strong> ${new Date(file.uploadedAt).toLocaleString('th-TH')}</div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button id="downloadOriginalBtn" class="btn primary">⬇️ ดาวน์โหลดไฟล์ต้นฉบับ (.docx)</button>
              ${file.viewUrl ? `<a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary">🌐 เปิดใน Google Drive</a>` : ''}
              <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn secondary">📁 เปิดโฟลเดอร์ Google Drive รวม</a>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (isSpreadsheet) {
    viewportHtml = `
      <div id="xlsxViewport" style="height: 100%; display: flex; flex-direction: column; background: #0b0f19; overflow: hidden;">
        <div id="xlsxTabs" style="display: flex; gap: 6px; padding: 10px 16px; background: #111827; border-bottom: 1px solid #1f2937; overflow-x: auto; flex-shrink: 0;"></div>
        <div style="padding: 8px 16px; background: #161f30; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; flex-shrink: 0;">
          <span id="xlsxInfo" style="font-size: 13px; color: #38bdf8; font-weight: 600;">📊 ตารางข้อมูลจริงจากไฟล์ Excel</span>
          <input type="text" id="xlsxFilter" placeholder="ค้นหาข้อความในแผ่นงาน..." oninput="filterXlsxTable()" style="padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #fff; font-size: 12px; width: 240px;" />
        </div>
        <div id="xlsxContainer" style="flex: 1; overflow: auto; padding: 16px;">
          <div id="xlsxLoading" style="color: #cbd5e1; font-size: 14px; margin-top: 50px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
            <div class="spinner"></div>
            <span>กำลังอ่านข้อมูลแผ่นงาน Excel...</span>
          </div>
        </div>
        <div id="xlsxFallback" style="display: none; padding: 30px;">
          <div class="card" style="max-width: 600px; margin: 0 auto; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 12px;">📊</div>
            <h3 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">${esc(file.name)}</h3>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
              ประเภท: <strong>Excel (.xlsx)</strong> • ขนาด: <strong>${sizeText}</strong>
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button id="downloadOriginalBtn" class="btn primary">⬇️ ดาวน์โหลดไฟล์ Excel</button>
              ${file.viewUrl ? `<a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary">🌐 เปิดใน Google Drive</a>` : ''}
              <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn secondary">📁 เปิดโฟลเดอร์ Google Drive รวม</a>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (isCsv && parsedCsv && parsedCsv.length > 0) {
    const headerRow = parsedCsv[0];
    const dataRows = parsedCsv.slice(1);
    viewportHtml = `
      <div class="csv-container">
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; color: #94a3b8;">ข้อมูลจริงในไฟล์ CSV (${parsedCsv.length} แถว, ${headerRow.length} คอลัมน์)</span>
          <input type="text" id="csvFilter" placeholder="ค้นหาข้อความในตาราง..." oninput="filterCsvTable()" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #fff; font-size: 12px; width: 220px;" />
        </div>
        <div style="overflow: auto; max-height: calc(100vh - 120px); border: 1px solid #334155; border-radius: 8px;">
          <table id="csvTable" style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #1e293b; position: sticky; top: 0; border-bottom: 2px solid #475569;">
                <th style="padding: 10px 12px; width: 40px; color: #94a3b8; border-right: 1px solid #334155;">#</th>
                ${headerRow.map((col) => `<th style="padding: 10px 12px; color: #e2e8f0; font-weight: 600; border-right: 1px solid #334155;">${esc(col)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${dataRows.map((row, idx) => `
                <tr style="border-bottom: 1px solid #1e293b; background: ${idx % 2 === 0 ? '#0f172a' : '#141e33'};">
                  <td style="padding: 8px 12px; color: #64748b; border-right: 1px solid #334155;">${idx + 1}</td>
                  ${row.map((cell) => `<td style="padding: 8px 12px; color: #cbd5e1; border-right: 1px solid #334155;">${esc(cell)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (isText && textDecoded) {
    viewportHtml = `
      <div class="text-container" style="padding: 24px; overflow: auto; height: 100%; background: #0b1329;">
        <pre style="font-family: 'Courier New', monospace; font-size: 13px; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${esc(textDecoded)}</pre>
      </div>
    `;
  } else {
    // Other file types
    viewportHtml = `
      <div class="empty-view">
        <div class="card" style="max-width: 600px; text-align: center;">
          <div style="width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; font-size: 28px;">
            📄
          </div>
          <h3 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">${esc(file.name)}</h3>
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
            ไฟล์ประเภท: <strong>${typeBadge}</strong> • ขนาด: <strong>${sizeText}</strong>
          </p>

          <div style="background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
            <div>📌 <strong>ชื่องาน:</strong> ${esc(assignmentTitle || 'งานมอบหมายวิชาการ')}</div>
            <div>👤 <strong>ผู้ส่ง:</strong> ${esc(submitterName || 'สมาชิก')}</div>
            <div>⏰ <strong>วันที่อัปโหลด:</strong> ${new Date(file.uploadedAt).toLocaleString('th-TH')}</div>
            <div style="margin-top: 8px; font-size: 12px; color: #38bdf8;">
              ✓ ไฟล์ต้นฉบับแท้ 100% บันทึกเรียบร้อย สามารถดาวน์โหลดไปใช้งานต่อได้ทันที
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button id="downloadOriginalBtn" class="btn primary" style="font-size: 14px; padding: 10px 20px;">
              ⬇️ ดาวน์โหลดไฟล์ต้นฉบับ (.${esc(lowerName.split('.').pop() || 'file')})
            </button>
            ${file.viewUrl ? `
              <a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary" style="font-size: 14px; padding: 10px 20px; text-decoration: none;">
                🌐 เปิดใน Google Drive
              </a>
            ` : ''}
            <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn secondary" style="font-size: 14px; padding: 10px 20px; text-decoration: none;">
              📁 เปิดโฟลเดอร์ Google Drive รวม
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // Construct complete HTML page
  const fullHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(file.name)} - ตัวอย่างไฟล์แนบจริง</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Docx-Preview & JSZip for genuine client-side Word document rendering -->
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js"></script>
  <!-- SheetJS for genuine client-side Excel spreadsheet rendering -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sarabun', system-ui, -apple-system, sans-serif;
      background: #090d16;
      color: #f8fafc;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    header {
      height: 58px;
      background: #111827;
      border-bottom: 1px solid #1f2937;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-shrink: 0;
      z-index: 10;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 4px 9px;
      border-radius: 6px;
      color: #fff;
      background: ${badgeColor};
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .file-meta {
      min-width: 0;
    }
    .file-title {
      font-size: 14px;
      font-weight: 600;
      color: #f3f4f6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 460px;
    }
    .file-sub {
      font-size: 11px;
      color: #9ca3af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 460px;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn {
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      text-decoration: none;
    }
    .btn.primary {
      background: #7c3aed;
      color: #fff;
      border-color: #8b5cf6;
    }
    .btn.primary:hover {
      background: #6d28d9;
    }
    .btn.secondary {
      background: #1f2937;
      color: #e5e7eb;
      border-color: #374151;
    }
    .btn.secondary:hover {
      background: #374151;
      color: #fff;
    }
    .btn.drive {
      background: #047857;
      color: #fff;
      border-color: #059669;
    }
    .btn.drive:hover {
      background: #065f46;
    }
    .main-viewport {
      flex: 1;
      height: calc(100vh - 58px);
      position: relative;
      background: #0b0f19;
      overflow: hidden;
    }
    .empty-view {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .image-viewport {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #060911;
      overflow: auto;
    }
    .csv-container {
      height: 100%;
      padding: 20px;
      background: #0b0f19;
    }
    .spinner {
      width: 38px;
      height: 38px;
      border: 3px solid rgba(124, 58, 237, 0.2);
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    /* Docx container styles */
    .docx-document {
      background: #ffffff !important;
      color: #1e293b !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
      margin-bottom: 24px !important;
      border-radius: 4px !important;
      padding: 40px !important;
    }
    .docx-document section {
      padding: 0 !important;
    }
    .docx-document table {
      border-collapse: collapse !important;
      width: 100% !important;
      margin: 14px 0 !important;
    }
    .docx-document td, .docx-document th {
      border: 1px solid #94a3b8 !important;
      padding: 6px 10px !important;
    }
    /* Spreadsheet table styles */
    #currentSheetTable {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      color: #e2e8f0;
      background: #111827;
    }
    #currentSheetTable th, #currentSheetTable td {
      border: 1px solid #334155;
      padding: 6px 10px;
      text-align: left;
    }
    #currentSheetTable tr:first-child td, #currentSheetTable tr:first-child th {
      background: #1e293b;
      font-weight: 700;
      color: #38bdf8;
      position: sticky;
      top: 0;
    }
    #currentSheetTable tr:hover td {
      background: #1e293b;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <span class="badge">${typeBadge}</span>
      <div class="file-meta">
        <div class="file-title" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="file-sub">
          ขนาด: ${sizeText} • ${submitterName ? 'ผู้ส่ง: ' + esc(submitterName) + ' • ' : ''}${assignmentTitle ? 'หัวข้อ: ' + esc(assignmentTitle) : ''}
        </div>
      </div>
    </div>
    <div class="header-right">
      <button class="btn primary" id="headerDownloadBtn" title="ดาวน์โหลดไฟล์ต้นฉบับ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>ดาวน์โหลดไฟล์จริง</span>
      </button>
      ${file.viewUrl ? `
        <a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary" title="เปิดไฟล์ใน Google Drive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>เปิดใน Drive</span>
        </a>
      ` : ''}
      <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn drive" title="เปิดโฟลเดอร์ Google Drive รวม (ทุกคนที่มีลิงก์)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <span>โฟลเดอร์ Drive รวม</span>
      </a>
      <button class="btn secondary" onclick="window.print()" title="พิมพ์">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        <span>พิมพ์</span>
      </button>
      <button class="btn secondary" onclick="window.close()" title="ปิดแท็บนี้">
        <span>ปิด</span>
      </button>
    </div>
  </header>

  <main class="main-viewport">
    ${viewportHtml}
  </main>

  <script>
    var fileBase64 = ${JSON.stringify(fileBase64 || '')};
    var rawData = ${JSON.stringify(file.fileDataUrl || '')};
    var downloadUrl = ${JSON.stringify(file.downloadUrl || '')};
    var fileName = ${JSON.stringify(file.name || 'document')};
    var mimeType = ${JSON.stringify(file.mimeType || 'application/octet-stream')};

    // Direct Binary Download Handler
    function triggerDownload() {
      if (rawData && rawData.indexOf(';base64,') > -1) {
        try {
          var parts = rawData.split(';base64,');
          var contentType = parts[0].replace('data:', '') || mimeType;
          var raw = atob(parts[1]);
          var uInt8Array = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          var blob = new Blob([uInt8Array], { type: contentType });
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
          return;
        } catch (e) {
          console.error('Download error:', e);
        }
      }

      if (downloadUrl && downloadUrl.indexOf('http') === 0) {
        var a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      alert('ไฟล์นี้พร้อมให้เปิดในโฟลเดอร์ Google Drive รวม');
    }

    var dlBtn = document.getElementById('headerDownloadBtn');
    if (dlBtn) dlBtn.addEventListener('click', triggerDownload);

    var origBtn = document.getElementById('downloadOriginalBtn');
    if (origBtn) origBtn.addEventListener('click', triggerDownload);

    // Render Word Document (.docx) directly using docx-preview
    ${isDoc ? `
    (function renderDocx() {
      var loader = document.getElementById('docxLoading');
      var container = document.getElementById('docxContainer');
      var fallback = document.getElementById('docxFallback');

      if (!fileBase64) {
        if (loader) loader.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
      }

      try {
        var binaryString = atob(fileBase64);
        var bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        if (window.docx && window.docx.renderAsync) {
          window.docx.renderAsync(bytes.buffer, container, null, {
            className: 'docx-document',
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            useBase64URL: true,
            renderChanges: false,
            renderHeaders: true,
            renderFooters: true
          }).then(function() {
            if (loader) loader.style.display = 'none';
            if (container) container.style.display = 'block';
          }).catch(function(err) {
            console.warn('Docx renderAsync failed:', err);
            if (loader) loader.style.display = 'none';
            if (fallback) fallback.style.display = 'block';
          });
        } else {
          if (loader) loader.style.display = 'none';
          if (fallback) fallback.style.display = 'block';
        }
      } catch (err) {
        console.error('Docx parsing error:', err);
        if (loader) loader.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
      }
    })();
    ` : ''}

    // Render Excel Document (.xlsx) directly using SheetJS
    ${isSpreadsheet ? `
    (function renderXlsx() {
      var loader = document.getElementById('xlsxLoading');
      var tabs = document.getElementById('xlsxTabs');
      var container = document.getElementById('xlsxContainer');
      var fallback = document.getElementById('xlsxFallback');

      if (!fileBase64 || !window.XLSX) {
        if (loader) loader.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
      }

      try {
        var binaryString = atob(fileBase64);
        var bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        var workbook = XLSX.read(bytes.buffer, { type: 'array' });
        if (loader) loader.style.display = 'none';

        function showSheet(name) {
          var sheet = workbook.Sheets[name];
          var html = XLSX.utils.sheet_to_html(sheet, { id: 'currentSheetTable' });
          container.innerHTML = html;

          document.querySelectorAll('.xlsx-tab-btn').forEach(function(b) {
            if (b.dataset.sheet === name) {
              b.style.background = '#7c3aed';
              b.style.color = '#fff';
            } else {
              b.style.background = '#1f2937';
              b.style.color = '#9ca3af';
            }
          });
        }

        workbook.SheetNames.forEach(function(name, idx) {
          var btn = document.createElement('button');
          btn.className = 'btn xlsx-tab-btn';
          btn.dataset.sheet = name;
          btn.textContent = '📄 ' + name;
          btn.style.padding = '5px 12px';
          btn.style.fontSize = '12px';
          btn.onclick = function() { showSheet(name); };
          tabs.appendChild(btn);
        });

        if (workbook.SheetNames.length > 0) {
          showSheet(workbook.SheetNames[0]);
        }
      } catch (err) {
        console.error('Xlsx parsing error:', err);
        if (loader) loader.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
      }
    })();
    ` : ''}

    // CSV Table Filter Function
    function filterCsvTable() {
      var input = document.getElementById('csvFilter');
      if (!input) return;
      var filter = input.value.toLowerCase();
      var table = document.getElementById('csvTable');
      if (!table) return;
      var trs = table.getElementsByTagName('tr');
      for (var i = 1; i < trs.length; i++) {
        var text = trs[i].textContent || trs[i].innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
          trs[i].style.display = '';
        } else {
          trs[i].style.display = 'none';
        }
      }
    }

    // XLSX Table Filter Function
    function filterXlsxTable() {
      var input = document.getElementById('xlsxFilter');
      if (!input) return;
      var filter = input.value.toLowerCase();
      var table = document.getElementById('currentSheetTable');
      if (!table) return;
      var trs = table.getElementsByTagName('tr');
      for (var i = 1; i < trs.length; i++) {
        var text = trs[i].textContent || trs[i].innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
          trs[i].style.display = '';
        } else {
          trs[i].style.display = 'none';
        }
      }
    }
  </script>
</body>
</html>`;

  // 3. Write content to newTab
  newTab.document.open();
  newTab.document.write(fullHtml);
  newTab.document.close();
}
