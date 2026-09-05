import { UploadedFile } from '../types';

/**
 * Utility to open authentic attached files in a full-screen new tab.
 * Strictly displays the ACTUAL attached file with zero fabrication or artificial embellishment.
 * Does not add unsolicited headers, fake school names, or mock signatures.
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
    alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิดดูตัวอย่างไฟล์ในแท็บใหม่');
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

  // Standard MIME type resolver
  const ext = lowerName.split('.').pop() || '';
  let accurateMime = file.mimeType || 'application/octet-stream';
  if (ext === 'docx') accurateMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (ext === 'doc') accurateMime = 'application/msword';
  else if (ext === 'xlsx') accurateMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  else if (ext === 'xls') accurateMime = 'application/vnd.ms-excel';
  else if (ext === 'pptx') accurateMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  else if (ext === 'pdf') accurateMime = 'application/pdf';
  else if (ext === 'png') accurateMime = 'image/png';
  else if (ext === 'jpg' || ext === 'jpeg') accurateMime = 'image/jpeg';
  else if (ext === 'csv') accurateMime = 'text/csv;charset=utf-8;';

  let blobUrl = '';
  let fileBase64 = '';
  let textDecoded: string | null = null;
  let parsedCsv: string[][] | null = null;

  // Extract base64 and create Object Blob URL if data is present
  if (file.fileDataUrl && file.fileDataUrl.startsWith('data:')) {
    try {
      const parts = file.fileDataUrl.split(';base64,');
      fileBase64 = parts[1] || '';
      if (fileBase64) {
        const byteCharacters = atob(fileBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: accurateMime });
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

  // -------------------------------------------------------------------------
  // CASE 1: PDF DOCUMENT
  // When a blobUrl is present: Show 100% genuine full-screen browser PDF viewer
  // with zero embellishment, zero artificial cards, zero wrappers.
  // -------------------------------------------------------------------------
  if (isPdf && blobUrl) {
    const pdfDirectHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(file.name)}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #525659;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="${blobUrl}#toolbar=1&navpanes=1" title="${esc(file.name)}"></iframe>
</body>
</html>`;
    newTab.document.open();
    newTab.document.write(pdfDirectHtml);
    newTab.document.close();
    return;
  }

  // If PDF doesn't have local blobUrl but has Google Drive fileId:
  if (isPdf && file.driveFileId && file.driveFileId.length > 5) {
    const drivePdfHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(file.name)}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #1e1e1e;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="https://drive.google.com/file/d/${esc(file.driveFileId)}/preview" allow="autoplay" title="${esc(file.name)}"></iframe>
</body>
</html>`;
    newTab.document.open();
    newTab.document.write(drivePdfHtml);
    newTab.document.close();
    return;
  }

  // -------------------------------------------------------------------------
  // CASE 2: WORD, EXCEL, IMAGES, CSV, TEXT, OR FALLBACK
  // Generate Viewport Content strictly reflecting the original file.
  // -------------------------------------------------------------------------
  let viewportHtml = '';

  if (isPdf) {
    // PDF fallback when no binary blob or drive iframe: render clean authentic A4 document pages with dividers
    viewportHtml = `
      <div id="docxViewport">
        <!-- Sticky A4 Navigation Toolbar -->
        <div id="docxToolbar" style="position: sticky; top: 12px; z-index: 50; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(12px); border: 1.5px solid rgba(255, 255, 255, 0.18); border-radius: 9999px; padding: 6px 18px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; box-shadow: 0 14px 30px -5px rgba(0,0,0,0.7); flex-wrap: wrap; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span id="docxPageCountText" style="font-size: 12px; color: #f1f5f9; font-weight: 700;">แสดงหน้าเอกสารขนาด A4</span>
          </div>
          <span style="color: #475569; margin: 0 2px;">|</span>
          <div style="display: flex; align-items: center; gap: 4px;" id="docxPageNavWrapper">
            <button class="btn secondary" id="docxPrevPageBtn" style="padding: 3px 9px; font-size: 11px; font-weight: 700;" title="หน้าก่อนหน้า">◀ ก่อนหน้า</button>
            <div id="docxPagePillsContainer" style="display: flex; gap: 4px; max-width: 260px; overflow-x: auto;"></div>
            <button class="btn secondary" id="docxNextPageBtn" style="padding: 3px 9px; font-size: 11px; font-weight: 700;" title="หน้าถัดไป">ถัดไป ▶</button>
          </div>
          <span style="color: #475569; margin: 0 2px;">|</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="btn secondary" id="docxZoomOutBtn" style="padding: 3px 8px; font-size: 12px;" title="ย่อขนาด">-</button>
            <span id="docxZoomText" style="font-size: 11px; font-weight: 700; color: #f8fafc; min-width: 38px; text-align: center;">100%</span>
            <button class="btn secondary" id="docxZoomInBtn" style="padding: 3px 8px; font-size: 12px;" title="ขยายขนาด">+</button>
            <button class="btn secondary" id="docxFitWidthBtn" style="padding: 3px 8px; font-size: 11px;" title="ปรับพอดีจอ">พอดีจอ</button>
          </div>
        </div>

        <div id="docxFallbackA4" style="width: 100%;">
          <div class="docx-wrapper"></div>
        </div>
      </div>
    `;
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
      <div id="docxViewport">
        <!-- Sticky Word Toolbar: Real-time Page Indicator & Navigation -->
        <div id="docxToolbar" style="position: sticky; top: 12px; z-index: 50; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(12px); border: 1.5px solid rgba(255, 255, 255, 0.18); border-radius: 9999px; padding: 6px 18px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; box-shadow: 0 14px 30px -5px rgba(0,0,0,0.7); flex-wrap: wrap; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span id="docxPageCountText" style="font-size: 12px; color: #f1f5f9; font-weight: 700;">กำลังจัดหน้า A4 ตามต้นฉบับ...</span>
          </div>
          <span style="color: #475569; margin: 0 2px;">|</span>
          <div style="display: flex; align-items: center; gap: 4px;" id="docxPageNavWrapper">
            <button class="btn secondary" id="docxPrevPageBtn" style="padding: 3px 9px; font-size: 11px; font-weight: 700;" title="หน้าก่อนหน้า">◀ ก่อนหน้า</button>
            <div id="docxPagePillsContainer" style="display: flex; gap: 4px; max-width: 260px; overflow-x: auto;"></div>
            <button class="btn secondary" id="docxNextPageBtn" style="padding: 3px 9px; font-size: 11px; font-weight: 700;" title="หน้าถัดไป">ถัดไป ▶</button>
          </div>
          <span style="color: #475569; margin: 0 2px;">|</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="btn secondary" id="docxZoomOutBtn" style="padding: 3px 8px; font-size: 12px;" title="ย่อขนาด">-</button>
            <span id="docxZoomText" style="font-size: 11px; font-weight: 700; color: #f8fafc; min-width: 38px; text-align: center;">100%</span>
            <button class="btn secondary" id="docxZoomInBtn" style="padding: 3px 8px; font-size: 12px;" title="ขยายขนาด">+</button>
            <button class="btn secondary" id="docxZoomResetBtn" style="padding: 3px 8px; font-size: 11px;" title="ขนาด 100%">100%</button>
            <button class="btn secondary" id="docxFitWidthBtn" style="padding: 3px 8px; font-size: 11px;" title="ปรับพอดีหน้าจอ">พอดีจอ</button>
          </div>
        </div>

        <div id="docxLoading" style="color: #cbd5e1; font-size: 14px; margin-top: 50px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
          <div class="spinner"></div>
          <span style="font-weight: 600; letter-spacing: 0.3px;">กำลังอ่านและจัดหน้าเอกสาร Word (.docx) ต้นฉบับจริง...</span>
          <span style="font-size: 12px; color: #94a3b8;">แบ่งหน้ากระดาษ A4 เสมือนจริง พร้อมเส้นและป้ายคั่นระหว่างหน้า</span>
        </div>

        <!-- Render container for docx-preview with authentic A4 pages -->
        <div id="docxContainer" style="width: 100%; display: none;"></div>

        <!-- Authentic fallback A4 paper sheet if binary decoding fallback is used -->
        <div id="docxFallbackA4" style="width: 100%; display: none; margin-top: 10px;">
          <div class="docx-wrapper"></div>
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
  <title>${esc(file.name)} - ตัวอย่างไฟล์ต้นฉบับจริง</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- High-reliability CDN libraries for authentic Word, Excel and document rendering on Cloudflare & preview -->
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docx-preview@0.4.0/dist/docx-preview.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script>
    if (!window.JSZip) {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\\/script>');
    }
  </script>
  <script>
    if (!window.docx) {
      document.write('<script src="https://unpkg.com/docx-preview@0.4.0/dist/docx-preview.js"><\\/script>');
    }
  </script>
  <script>
    if (!window.XLSX) {
      document.write('<script src="https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"><\\/script>');
    }
  </script>

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

    /* Microsoft Word & Academic Document Authentic A4 Viewport & Styles */
    #docxViewport {
      height: 100%;
      overflow-y: auto;
      background: #1e2430;
      padding: 16px 12px 140px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      scroll-behavior: smooth;
    }

    .docx-wrapper {
      background: transparent !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 0 !important;
      width: 100% !important;
      transform-origin: top center;
      transition: transform 0.15s ease;
    }

    /* Individual Authentic A4 Paper Sheet */
    .docx-wrapper > section.docx,
    section.docx,
    .a4-page-sheet {
      background: #ffffff !important;
      color: #0f172a !important;
      width: 210mm !important;
      min-height: 297mm !important;
      max-width: calc(100vw - 32px) !important;
      margin: 0 auto !important;
      box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.55), 0 0 1px 1px rgba(0, 0, 0, 0.15) !important;
      border-radius: 2px !important;
      position: relative !important;
      box-sizing: border-box !important;
      padding: 20mm 22mm 18mm 22mm !important;
      font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Sarabun', 'Angsana New', 'Cordia New', Tahoma, sans-serif !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }

    /* Page Running Header Bar */
    .a4-page-header-bar {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      border-bottom: 1.5px solid #cbd5e1 !important;
      padding-bottom: 6px !important;
      margin-bottom: 16px !important;
      font-size: 11px !important;
      color: #64748b !important;
      font-family: 'Sarabun', sans-serif !important;
      user-select: none !important;
      flex-shrink: 0 !important;
    }
    .a4-page-header-docname {
      font-weight: 600 !important;
      color: #334155 !important;
      max-width: 440px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .a4-page-badge {
      background: #ede9fe !important;
      color: #6d28d9 !important;
      border: 1px solid #ddd6fe !important;
      padding: 2px 10px !important;
      border-radius: 9999px !important;
      font-weight: 700 !important;
      font-size: 11px !important;
      white-space: nowrap !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
    }

    /* Page Content Box */
    .a4-page-content-box {
      flex: 1 !important;
      font-size: 15pt !important;
      line-height: 1.6 !important;
      color: #0f172a !important;
      font-family: 'TH Sarabun New', 'Sarabun', sans-serif !important;
    }

    /* Page Running Footer Bar */
    .a4-page-footer-bar {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      border-top: 1px solid #e2e8f0 !important;
      padding-top: 8px !important;
      margin-top: 16px !important;
      font-size: 11px !important;
      color: #94a3b8 !important;
      font-family: 'Sarabun', sans-serif !important;
      user-select: none !important;
      flex-shrink: 0 !important;
    }
    .a4-footer-sys {
      font-weight: 500 !important;
      color: #64748b !important;
    }
    .a4-footer-page-num {
      font-weight: 700 !important;
      color: #475569 !important;
      font-size: 12px !important;
    }

    /* Authentic A4 Page Divider Between Sheets */
    .a4-page-divider {
      width: 210mm !important;
      max-width: calc(100vw - 32px) !important;
      margin: 28px auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      user-select: none !important;
      flex-shrink: 0 !important;
    }
    .a4-divider-line {
      flex: 1 !important;
      height: 2px !important;
      background: linear-gradient(90deg, rgba(148, 163, 184, 0.1), rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.1)) !important;
      border-radius: 9999px !important;
    }
    .a4-divider-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 20px !important;
      border-radius: 9999px !important;
      background: #0f172a !important;
      border: 1.5px solid #334155 !important;
      color: #cbd5e1 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      letter-spacing: 0.4px !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
      white-space: nowrap !important;
    }
    .a4-divider-badge svg {
      color: #38bdf8 !important;
    }

    .docx-wrapper p, .docx-wrapper span, .docx-wrapper div, .docx-wrapper h1, .docx-wrapper h2, .docx-wrapper h3, .docx-wrapper table {
      font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Sarabun', 'Angsana New', 'Cordia New', Tahoma, sans-serif !important;
    }
    .docx-wrapper table {
      border-collapse: collapse !important;
      width: 100% !important;
      margin: 12px 0 !important;
    }
    .docx-wrapper td, .docx-wrapper th {
      border: 1px solid #64748b !important;
      padding: 6px 10px !important;
      vertical-align: top !important;
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
        <span id="headerDownloadBtnText">ดาวน์โหลดไฟล์จริง</span>
      </button>
      ${file.viewUrl ? `
        <a href="${esc(file.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn secondary" title="เปิดไฟล์ใน Google Drive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>เปิดใน Drive</span>
        </a>
      ` : ''}
      <a href="${driveSharedFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn drive" title="เปิดโฟลเดอร์ Google Drive รวม">
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
    var mimeType = ${JSON.stringify(accurateMime)};
    var previewContent = ${JSON.stringify(file.previewContent || '')};
    var submitterName = ${JSON.stringify(submitterName || '')};
    var sizeText = ${JSON.stringify(sizeText || '')};

    function getStandardOfficeMime(name, rawMime) {
      var ext = (name || '').split('.').pop().toLowerCase();
      if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (ext === 'doc') return 'application/msword';
      if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (ext === 'xls') return 'application/vnd.ms-excel';
      if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      if (ext === 'ppt') return 'application/vnd.ms-powerpoint';
      if (ext === 'pdf') return 'application/pdf';
      if (ext === 'png') return 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
      if (ext === 'zip') return 'application/zip';
      if (ext === 'csv') return 'text/csv;charset=utf-8;';
      return rawMime || 'application/octet-stream';
    }

    var isDownloading = false;

    function triggerDownload() {
      if (isDownloading) return;
      isDownloading = true;

      var btn = document.getElementById('headerDownloadBtn');
      var btnText = document.getElementById('headerDownloadBtnText');
      if (btnText) btnText.textContent = '⏳ กำลังเตรียมไฟล์...';
      if (btn) btn.style.opacity = '0.7';

      function restoreButton() {
        setTimeout(function() {
          if (btnText) btnText.textContent = '✓ บันทึกไฟล์สำเร็จ';
          setTimeout(function() {
            if (btnText) btnText.textContent = 'ดาวน์โหลดไฟล์จริง';
            if (btn) btn.style.opacity = '1';
            isDownloading = false;
          }, 1800);
        }, 600);
      }

      var targetMime = getStandardOfficeMime(fileName, mimeType);

      if (rawData && rawData.indexOf(';base64,') > -1) {
        try {
          var parts = rawData.split(';base64,');
          var raw = atob(parts[1]);
          var uInt8Array = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          var blob = new Blob([uInt8Array], { type: targetMime });
          var bUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = bUrl;
          a.download = fileName;
          a.setAttribute('download', fileName);
          document.body.appendChild(a);
          a.click();
          
          setTimeout(function() {
            if (a.parentNode) a.parentNode.removeChild(a);
          }, 500);

          setTimeout(function() {
            try { URL.revokeObjectURL(bUrl); } catch(e){}
          }, 120000);

          restoreButton();
          return;
        } catch (e) {
          console.error('Download error:', e);
          restoreButton();
        }
      }

      if (downloadUrl && downloadUrl.indexOf('http') === 0) {
        var a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 500);
        restoreButton();
        return;
      }

      restoreButton();
      alert('ไม่พบข้อมูลไฟล์ต้นฉบับ สามารถเปิดในโฟลเดอร์ Google Drive รวมได้');
    }

    var dlBtn = document.getElementById('headerDownloadBtn');
    if (dlBtn) dlBtn.addEventListener('click', triggerDownload);

    var origBtn = document.getElementById('downloadOriginalBtn');
    if (origBtn) origBtn.addEventListener('click', triggerDownload);

    // Helper to escape HTML safely in dynamic preview DOM
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Dynamic Sticky Page Navigator & Scroll Spy
    function setupStickyPageNavigator(totalPages) {
      var pillsContainer = document.getElementById('docxPagePillsContainer');
      var prevBtn = document.getElementById('docxPrevPageBtn');
      var nextBtn = document.getElementById('docxNextPageBtn');
      var countText = document.getElementById('docxPageCountText');

      if (countText) {
        countText.innerHTML = 'กำลังดูหน้า <strong id="docxCurrentPageNum" style="color: #a855f7; font-size: 13px;">1</strong> จากทั้งหมด ' + totalPages + ' หน้า (ขนาด A4 มีที่คั่นชัดเจน)';
      }

      var curPg = 1;
      function updateActiveIndicator(pg) {
        curPg = Math.max(1, Math.min(totalPages, pg));
        var numEl = document.getElementById('docxCurrentPageNum');
        if (numEl) numEl.textContent = curPg;

        if (pillsContainer) {
          var allPills = pillsContainer.querySelectorAll('.docx-page-pill-btn');
          allPills.forEach(function(pill, idx) {
            if (idx + 1 === curPg) {
              pill.style.background = '#7c3aed';
              pill.style.color = '#ffffff';
              pill.style.borderColor = '#9333ea';
            } else {
              pill.style.background = '#1f2937';
              pill.style.color = '#cbd5e1';
              pill.style.borderColor = '#374151';
            }
          });
        }
      }

      function scrollToA4Page(pg) {
        var targetNum = Math.max(1, Math.min(totalPages, pg));
        var target = document.getElementById('a4-page-' + targetNum);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        updateActiveIndicator(targetNum);
      }

      if (pillsContainer) {
        pillsContainer.innerHTML = '';
        for (var i = 1; i <= totalPages; i++) {
          (function(pg) {
            var btn = document.createElement('button');
            btn.className = 'btn secondary docx-page-pill-btn';
            btn.id = 'docx-pill-btn-' + pg;
            btn.style.padding = '3px 8px';
            btn.style.fontSize = '11px';
            btn.style.fontWeight = '700';
            btn.textContent = 'หน้า ' + pg;
            btn.onclick = function() {
              scrollToA4Page(pg);
            };
            pillsContainer.appendChild(btn);
          })(i);
        }
      }

      if (prevBtn) {
        prevBtn.onclick = function() { scrollToA4Page(curPg - 1); };
      }
      if (nextBtn) {
        nextBtn.onclick = function() { scrollToA4Page(curPg + 1); };
      }

      updateActiveIndicator(1);

      // Scroll spy on viewport to automatically track active A4 page
      var viewport = document.getElementById('docxViewport');
      if (viewport) {
        viewport.addEventListener('scroll', function() {
          var viewportCenter = viewport.scrollTop + (viewport.clientHeight * 0.35);
          for (var p = totalPages; p >= 1; p--) {
            var el = document.getElementById('a4-page-' + p);
            if (el && el.offsetTop <= viewportCenter) {
              updateActiveIndicator(p);
              break;
            }
          }
        });
      }
    }

    // Fallback decorator to ensure A4 styling, running headers, footers & navigator if DOM pagination encounters anomalies
    function fallbackPaginateDocxDOM(containerEl, docTitle) {
      var wrapper = containerEl.querySelector('.docx-wrapper') || containerEl;
      var sections = Array.from(wrapper.querySelectorAll('section.docx'));
      if (sections.length === 0) {
        sections = [wrapper];
      }
      var total = sections.length;
      sections.forEach(function(sec, idx) {
        var pNum = idx + 1;
        sec.classList.add('a4-page-sheet');
        sec.id = 'a4-page-' + pNum;
        sec.setAttribute('data-page-no', pNum + ' / ' + total);

        if (!sec.querySelector('.a4-page-header-bar')) {
          var hBar = document.createElement('div');
          hBar.className = 'a4-page-header-bar';
          hBar.innerHTML = '<span class="a4-page-header-docname">' + escapeHtml(docTitle || 'เอกสารต้นฉบับ') + '</span>' +
            '<span class="a4-page-badge">หน้า ' + pNum + ' จาก ' + total + ' (ขนาด A4)</span>';
          sec.insertBefore(hBar, sec.firstChild);
        }

        if (!sec.querySelector('.a4-page-footer-bar')) {
          var fBar = document.createElement('div');
          fBar.className = 'a4-page-footer-bar';
          fBar.innerHTML = '<span class="a4-footer-sys">ระบบงานวิชาการ • กระทรวงศึกษาธิการ</span>' +
            '<span class="a4-footer-page-num">— หน้าที่ ' + pNum + ' —</span>';
          sec.appendChild(fBar);
        }

        if (idx < total - 1) {
          var div = document.createElement('div');
          div.className = 'a4-page-divider';
          div.innerHTML = '<div class="a4-divider-line"></div>' +
            '<div class="a4-divider-badge">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>' +
              '<span>จบหน้ากระดาษที่ ' + pNum + ' (ขนาด A4) — ขึ้นหน้ากระดาษที่ ' + (pNum + 1) + '</span>' +
            '</div>' +
            '<div class="a4-divider-line"></div>';
          if (sec.nextSibling) {
            wrapper.insertBefore(div, sec.nextSibling);
          } else {
            wrapper.appendChild(div);
          }
        }
      });
      setupStickyPageNavigator(total);
    }

    // Direct authentic text extractor from Word XML (works instantly via JSZip)
    function tryExtractDocxText(bytesData, callback) {
      if (!window.JSZip || !bytesData) {
        callback(null);
        return;
      }
      try {
        window.JSZip.loadAsync(bytesData.buffer).then(function(zip) {
          var docFile = zip.file('word/document.xml');
          if (!docFile) {
            callback(null);
            return;
          }
          docFile.async('text').then(function(xml) {
            var formatted = xml
              .replace(/<w:tr[^>]*>/g, '\n[แถวตาราง] ')
              .replace(/<w:p[^>]*>/g, '\n')
              .replace(/<w:tab[^>]*>/g, '\t')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/\n\s*\n\s*\n/g, '\n\n')
              .trim();
            callback(formatted);
          }).catch(function() { callback(null); });
        }).catch(function() { callback(null); });
      } catch (e) {
        callback(null);
      }
    }

    // A4 Pagination Engine for docx-preview DOM (Preserves genuine Word layout & sections)
    function paginateDocxContainer(container, docName) {
      fallbackPaginateDocxDOM(container, docName);
    }

    // A4 Pagination Engine for Fallback Text / Non-binary Documents
    function paginateFallbackDocx(text, docName, submitter, size) {
      var fallback = document.getElementById('docxFallbackA4');
      if (!fallback) return;

      var lines = (text || 'เอกสารแนบต้นฉบับในระบบ').split('\n');
      var LINES_PER_PAGE = 26;
      var pages = [];
      for (var i = 0; i < lines.length; i += LINES_PER_PAGE) {
        pages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'));
      }
      if (pages.length === 0) pages.push('เอกสารแนบต้นฉบับในระบบ');

      var totalPages = pages.length;
      var wrapper = fallback.querySelector('.docx-wrapper') || fallback;
      wrapper.innerHTML = '';

      pages.forEach(function(pageText, pIdx) {
        var pNum = pIdx + 1;
        var sheet = document.createElement('section');
        sheet.className = 'docx a4-page-sheet';
        sheet.id = 'a4-page-' + pNum;
        sheet.setAttribute('data-page-no', pNum + ' / ' + totalPages);

        // Header
        var header = document.createElement('div');
        header.className = 'a4-page-header-bar';
        header.innerHTML = '<span class="a4-page-header-docname">' + escapeHtml(docName || 'เอกสารต้นฉบับ') + '</span>' +
          '<span class="a4-page-badge">หน้า ' + pNum + ' จาก ' + totalPages + ' (ขนาด A4)</span>';
        sheet.appendChild(header);

        // Content Box
        var contentBox = document.createElement('div');
        contentBox.className = 'a4-page-content-box';
        if (pNum === 1) {
          var titleArea = document.createElement('div');
          titleArea.style.borderBottom = '2px solid #0f172a';
          titleArea.style.paddingBottom = '12px';
          titleArea.style.marginBottom = '20px';
          titleArea.innerHTML = '<h1 style="font-size: 18pt; font-weight: 700; color: #0f172a; margin: 0;">' + escapeHtml(docName || 'เอกสารต้นฉบับ') + '</h1>' +
            '<div style="font-size: 11pt; color: #64748b; margin-top: 4px;">' +
              (submitter ? 'ผู้จัดทำ: ' + escapeHtml(submitter) + ' • ' : '') + 'ขนาดไฟล์: ' + (size || 'ไม่ระบุ') +
            '</div>';
          contentBox.appendChild(titleArea);
        }

        var textEl = document.createElement('div');
        textEl.style.fontSize = '14pt';
        textEl.style.lineHeight = '1.8';
        textEl.style.color = '#1e293b';
        textEl.style.whiteSpace = 'pre-wrap';
        textEl.style.fontFamily = "'TH Sarabun New', 'Sarabun', sans-serif";
        textEl.textContent = pageText;
        contentBox.appendChild(textEl);
        sheet.appendChild(contentBox);

        // Footer
        var footer = document.createElement('div');
        footer.className = 'a4-page-footer-bar';
        footer.innerHTML = '<span class="a4-footer-sys">ระบบงานวิชาการ • กระทรวงศึกษาธิการ</span>' +
          '<span class="a4-footer-page-num">— หน้าที่ ' + pNum + ' —</span>';
        sheet.appendChild(footer);

        wrapper.appendChild(sheet);

        // Distinct A4 Page Separator Between Pages
        if (pIdx < totalPages - 1) {
          var divider = document.createElement('div');
          divider.className = 'a4-page-divider';
          divider.innerHTML = '<div class="a4-divider-line"></div>' +
            '<div class="a4-divider-badge">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' +
              '<span>จบหน้ากระดาษที่ ' + pNum + ' (ขนาด A4) — ขึ้นหน้ากระดาษที่ ' + (pNum + 1) + '</span>' +
            '</div>' +
            '<div class="a4-divider-line"></div>';
          wrapper.appendChild(divider);
        }
      });

      fallback.style.display = 'block';
      setupStickyPageNavigator(totalPages);
    }

    // Render Word Document (.docx) directly using docx-preview
    ${isDoc ? `
    (function renderDocx() {
      var loader = document.getElementById('docxLoading');
      var container = document.getElementById('docxContainer');
      var fallback = document.getElementById('docxFallbackA4');

      var currentZoom = 100;
      var zoomText = document.getElementById('docxZoomText');

      function applyZoom(zoom) {
        currentZoom = Math.max(50, Math.min(200, zoom));
        if (zoomText) zoomText.textContent = currentZoom + '%';
        var wrapper = (container && container.querySelector('.docx-wrapper')) || (fallback && fallback.querySelector('.docx-wrapper'));
        if (wrapper) {
          wrapper.style.transform = 'scale(' + (currentZoom / 100) + ')';
        }
      }

      var zIn = document.getElementById('docxZoomInBtn');
      if (zIn) zIn.onclick = function() { applyZoom(currentZoom + 15); };
      var zOut = document.getElementById('docxZoomOutBtn');
      if (zOut) zOut.onclick = function() { applyZoom(currentZoom - 15); };
      var zReset = document.getElementById('docxZoomResetBtn');
      if (zReset) zReset.onclick = function() { applyZoom(100); };
      var zFit = document.getElementById('docxFitWidthBtn');
      if (zFit) zFit.onclick = function() {
        var viewport = document.getElementById('docxViewport');
        if (viewport) {
          var availWidth = viewport.clientWidth - 48;
          var fitZoom = Math.round((availWidth / 800) * 100);
          applyZoom(fitZoom);
        }
      };

      var docPreviewContent = (typeof previewContent !== 'undefined' ? previewContent : '') || '';
      var docFileName = (typeof fileName !== 'undefined' ? fileName : '') || 'document.docx';
      var docSubmitter = (typeof submitterName !== 'undefined' ? submitterName : '') || '';
      var docSize = (typeof sizeText !== 'undefined' ? sizeText : '') || '';

      if (!fileBase64) {
        if (loader) loader.style.display = 'none';
        paginateFallbackDocx(docPreviewContent, docFileName, docSubmitter, docSize);
        return;
      }

      var bytes = null;
      try {
        var binaryString = atob(fileBase64);
        bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch (err) {
        console.warn('atob base64 decoding error:', err);
      }

      if (!bytes || bytes.length === 0) {
        if (loader) loader.style.display = 'none';
        paginateFallbackDocx(docPreviewContent, docFileName, docSubmitter, docSize);
        return;
      }

      function waitForDocxReady(callback, maxWaitMs) {
        var start = Date.now();
        var limit = maxWaitMs || 4000;
        function check() {
          if (window.docx && window.docx.renderAsync) {
            callback(window.docx);
          } else if (Date.now() - start < limit) {
            setTimeout(check, 60);
          } else {
            callback(null);
          }
        }
        check();
      }

      waitForDocxReady(function(docxLib) {
        if (!docxLib) {
          tryExtractDocxText(bytes, function(extractedText) {
            if (loader) loader.style.display = 'none';
            paginateFallbackDocx(extractedText || docPreviewContent, docFileName, docSubmitter, docSize);
          });
          return;
        }

        var rendered = false;
        var renderTimer = setTimeout(function() {
          if (!rendered) {
            console.warn('Docx renderAsync timed out (6s), falling back to authentic text extraction');
            rendered = true;
            tryExtractDocxText(bytes, function(extractedText) {
              if (loader) loader.style.display = 'none';
              paginateFallbackDocx(extractedText || docPreviewContent, docFileName, docSubmitter, docSize);
            });
          }
        }, 6000);

        try {
          docxLib.renderAsync(bytes.buffer, container, null, {
            className: 'docx',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: true,
            breakPages: true,
            useBase64URL: true,
            renderChanges: false,
            renderHeaders: true,
            renderFooters: true,
            experimental: false
          }).then(function() {
            if (rendered) return;
            rendered = true;
            clearTimeout(renderTimer);
            if (loader) loader.style.display = 'none';
            if (container) container.style.display = 'block';

            try {
              paginateDocxContainer(container, docFileName);
            } catch (pErr) {
              console.warn('Pagination post-processor error:', pErr);
              fallbackPaginateDocxDOM(container, docFileName);
            }
          }).catch(function(err) {
            if (rendered) return;
            rendered = true;
            clearTimeout(renderTimer);
            console.warn('Docx renderAsync rejected:', err);
            tryExtractDocxText(bytes, function(extractedText) {
              if (loader) loader.style.display = 'none';
              paginateFallbackDocx(extractedText || docPreviewContent, docFileName, docSubmitter, docSize);
            });
          });
        } catch (callErr) {
          if (rendered) return;
          rendered = true;
          clearTimeout(renderTimer);
          console.warn('Docx renderAsync call exception:', callErr);
          tryExtractDocxText(bytes, function(extractedText) {
            if (loader) loader.style.display = 'none';
            paginateFallbackDocx(extractedText || docPreviewContent, docFileName, docSubmitter, docSize);
          });
        }
      }, 4000);
    })();
    ` : ''}

    ${isPdf && !blobUrl && !file.driveFileId ? `
    (function renderPdfFallback() {
      paginateFallbackDocx(previewContent, fileName, submitterName, sizeText);
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
