import { UploadedFile } from '../types';

export interface RawFilePayload {
  file: UploadedFile;
  assignmentTitle?: string;
  submitterName?: string;
  openedAt: number;
}

/**
 * Standardized CSS definitions enforcing an authentic A4 viewing experience:
 * - Exact ISO 216 dimensions: 210mm × 297mm
 * - CSS Margin: 24px/32px vertical margin with auto-centering
 * - CSS Padding: 25.4mm vertical (1 inch) × 20mm horizontal standard academic margins
 * - Blocks all external UI overlays, floating toolbars, print dialogs, and copy popups
 */
export const STANDARDIZED_A4_CONTAINER_CSS = `
  /* ISO 216 Standard A4 Dimensions: 210mm × 297mm */
  :root {
    --a4-width: 210mm;
    --a4-min-height: 297mm;
    --a4-margin-v: 24px;
    --a4-margin-h: auto;
    --a4-padding-v: 25.4mm; /* Standard 1-inch official margin */
    --a4-padding-h: 20.0mm; /* Standard 20mm official margin */
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    background-color: #020617;
    color: #0f172a;
    font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* Fixed Navigation Header - ONLY 1 SINGLE GREEN DOWNLOAD BUTTON & CLOSE BUTTON */
  .a4-viewer-header {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 60px;
    background: rgba(15, 23, 42, 0.95);
    border-bottom: 1px solid #334155;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 1000;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .file-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .file-title {
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 450px;
  }

  .a4-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #c084fc;
    background: rgba(88, 28, 135, 0.35);
    border: 1px solid rgba(168, 85, 247, 0.35);
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Exactly 1 Single Green Download Button */
  .btn-single-download {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #059669;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s ease, transform 0.05s ease;
    white-space: nowrap;
  }
  .btn-single-download:hover {
    background: #10b981;
  }
  .btn-single-download:active {
    transform: scale(0.98);
  }

  .btn-close-window {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #334155;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .btn-close-window:hover {
    background: #334155;
    color: #ffffff;
  }

  /* VIEWPORT STAGE: Centers and scrolls the standardized A4 pages */
  .a4-stage-viewport {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 16px 48px 16px;
    box-sizing: border-box;
    background-color: #020617;
    overflow-y: auto;
  }

  /* STANDARDIZED CONTAINER WITH CSS MARGIN AND PADDING FORCING AN A4-LIKE VIEWING EXPERIENCE */
  .a4-standardized-container {
    width: 210mm !important;
    max-width: calc(100vw - 32px) !important;
    min-height: 297mm !important;
    margin: 24px auto !important;
    padding: 25.4mm 20mm !important; /* Standard 1-inch official padding */
    box-sizing: border-box !important;
    background: #ffffff !important;
    color: #0f172a !important;
    box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    border-radius: 2px !important;
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
  }

  /* STANDARDIZED A4 CONTAINER FOR DIRECT RAW EMBEDS (PDF, NATIVE OBJECTS) */
  .a4-raw-embed-container {
    width: 210mm !important;
    max-width: calc(100vw - 32px) !important;
    height: 297mm !important;
    min-height: 297mm !important;
    margin: 24px auto !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    border-radius: 2px !important;
    overflow: hidden !important;
    position: relative !important;
  }

  /* STANDARDIZED A4 CONTAINER FOR IMAGES */
  .a4-image-container {
    width: 210mm !important;
    max-width: calc(100vw - 32px) !important;
    min-height: 297mm !important;
    margin: 24px auto !important;
    padding: 20mm !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    border-radius: 2px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: space-between !important;
  }

  /* A4 Page Separator with Clear Dimension Label */
  .a4-page-separator {
    width: 100%;
    max-width: 210mm;
    margin: 24px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    user-select: none;
  }
  .a4-page-separator::before,
  .a4-page-separator::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #334155;
  }
  .a4-page-separator-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 9999px;
    color: #cbd5e1;
  }

  /* STRICTLY BLOCK ALL UI OVERLAYS, FLOATING TOOLBARS, PRINT DIALOGS, COPY POPUPS */
  .ui-overlay-blocker,
  .goog-inline-block,
  .drive-viewer-toolstrip,
  .ndfHFb-c4YZDc,
  [class*="overlay"],
  [id*="overlay"],
  #print-button,
  #copy-button,
  button[title*="Print"],
  button[title*="Copy"],
  .print-dialog-overlay,
  .companion-collapsed-pill,
  .floating-toolbar {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

/**
 * Returns a clean Google Drive preview URL with minimal parameters
 * strictly stripping Google Drive top chrome, print, and copy UI.
 * NEVER routes through Google Docs Viewer (docs.google.com/viewer) which causes white screen issues.
 */
export function getSafeGoogleDrivePreviewUrl(file: UploadedFile): string {
  if (!file) return '';
  
  let driveId = file.driveFileId;
  if (!driveId && file.viewUrl) {
    const match = file.viewUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) driveId = match[1];
  }

  if (driveId) {
    // rm=minimal strips Google Drive navigation bar, print menu, and pop-out
    return `https://drive.google.com/file/d/${driveId}/preview?rm=minimal&embedded=true`;
  }

  if (file.viewUrl && !file.viewUrl.includes('docs.google.com/viewer')) {
    if (file.viewUrl.includes('/view')) {
      return file.viewUrl.replace('/view', '/preview?rm=minimal&embedded=true');
    }
    return file.viewUrl;
  }

  return '';
}

/**
 * Returns the direct Google Drive view URL for an uploaded file (for direct link references)
 */
export function getGoogleDriveFileUrl(file: UploadedFile): string {
  if (!file) return 'https://drive.google.com';
  if (file.viewUrl && file.viewUrl.startsWith('http')) {
    if (file.viewUrl.includes('docs.google.com/viewer?url=')) {
      const actualUrl = decodeURIComponent(file.viewUrl.split('url=')[1]?.split('&')[0] || '');
      if (actualUrl) return actualUrl;
    }
    return file.viewUrl;
  }
  if (file.driveFileId) {
    return `https://drive.google.com/file/d/${file.driveFileId}/view`;
  }
  if (file.driveFolderId) {
    return `https://drive.google.com/drive/folders/${file.driveFolderId}`;
  }
  return 'https://drive.google.com';
}

/**
 * Generates direct raw Blob URL from UploadedFile dataURL if available
 */
export function createRawFileBlobUrl(file: UploadedFile): string | null {
  if (!file) return null;
  try {
    let rawBase64 = '';
    let mime = file.mimeType || 'application/octet-stream';
    if (file.fileDataUrl) {
      if (file.fileDataUrl.startsWith('data:')) {
        const parts = file.fileDataUrl.split(';base64,');
        mime = parts[0].replace('data:', '') || mime;
        rawBase64 = parts[1] || '';
      } else {
        rawBase64 = file.fileDataUrl;
      }
    }
    if (rawBase64) {
      const binaryString = atob(rawBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('[fileViewer] createRawFileBlobUrl error:', err);
  }
  return null;
}

/**
 * Builds standalone HTML that strictly forces the standardized A4 container with CSS margin/padding,
 * serving the raw file content directly and blocking all UI overlays.
 */
export function buildStandardizedA4ViewerHtml(
  file: UploadedFile,
  assignmentTitle?: string,
  submitterName?: string
): string {
  const fileName = file.name || 'เอกสารทางวิชาการ';
  const rawSrc = file.fileDataUrl || file.viewUrl || '';
  const lower = fileName.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || file.mimeType === 'application/pdf' || file.previewType === 'pdf';
  const isImage = lower.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || file.previewType === 'image' || (file.mimeType && file.mimeType.includes('image'));
  const isDocx = lower.endsWith('.docx') || file.previewType === 'doc';
  const isSheet = lower.endsWith('.xlsx') || lower.endsWith('.xls') || file.previewType === 'spreadsheet';

  const drivePreviewUrl = getSafeGoogleDrivePreviewUrl(file);
  const displayTitle = assignmentTitle || fileName;
  const authorInfo = submitterName ? `ส่งโดย: ${submitterName}` : 'เอกสารทางการ';

  // Construct raw file content body inside standardized A4 container
  let rawContentHtml = '';

  if (isPdf) {
    const pdfUrl = rawSrc || drivePreviewUrl;
    rawContentHtml = `
      <div class="a4-raw-embed-container">
        <object
          data="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH"
          type="application/pdf"
          style="width: 100%; height: 100%; border: none; display: block;"
        >
          <iframe
            src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH"
            style="width: 100%; height: 100%; border: none; background: #ffffff;"
            title="${fileName}"
          ></iframe>
        </object>
      </div>
    `;
  } else if (isImage) {
    rawContentHtml = `
      <div class="a4-image-container">
        <div style="width: 100%; display: flex; justify-content: space-between; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
          <span style="font-weight: 600; color: #334155;">${displayTitle}</span>
          <span>ภาพแนบฉบับจริง • มาตรฐาน A4</span>
        </div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%;">
          <img
            src="${rawSrc}"
            alt="${fileName}"
            style="max-width: 100%; max-height: 220mm; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);"
          />
        </div>
        <div style="width: 100%; display: flex; justify-content: space-between; padding-top: 12px; margin-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          <span>ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.)</span>
          <span style="font-weight: 600; color: #334155; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">หน้า 1 / 1</span>
        </div>
      </div>
    `;
  } else if (file.previewContent) {
    // Render text or parsed content inside standardized A4 sheets with page separators
    const paragraphs = file.previewContent.split('\n').filter(p => p.trim().length > 0);
    const PARAGRAPHS_PER_PAGE = 8;
    const totalPages = Math.max(1, Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE));

    const pagesHtml: string[] = [];
    for (let p = 0; p < totalPages; p++) {
      const pageParagraphs = paragraphs.slice(p * PARAGRAPHS_PER_PAGE, (p + 1) * PARAGRAPHS_PER_PAGE);
      const isFirst = p === 0;

      const pageHtml = `
        <div class="a4-standardized-container">
          <div style="display: flex; justify-content: space-between; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b; user-select: none;">
            <span style="font-weight: 600; color: #334155;">${displayTitle}</span>
            <span>เอกสารทางวิชาการ • ฉบับจริง</span>
          </div>

          <div style="flex: 1; line-height: 1.7; font-size: 15px; color: #0f172a;">
            ${isFirst ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="font-size: 20px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">${displayTitle}</h1>
                <p style="font-size: 13px; color: #64748b;">${authorInfo}</p>
              </div>
            ` : ''}

            ${pageParagraphs.map(para => `
              <p style="text-indent: 2rem; margin-bottom: 14px; text-align: justify;">${para}</p>
            `).join('')}
          </div>

          <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; user-select: none;">
            <span>ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.)</span>
            <span style="font-weight: 600; color: #334155; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">หน้า ${p + 1} จาก ${totalPages}</span>
          </div>
        </div>
      `;

      pagesHtml.push(pageHtml);

      if (p < totalPages - 1) {
        pagesHtml.push(`
          <div class="a4-page-separator">
            <span class="a4-page-separator-badge">
              ที่คั่นแบ่งหน้า • สิ้นสุดหน้า ${p + 1} (ขนาด A4 210 × 297 มม.)
            </span>
          </div>
        `);
      }
    }
    rawContentHtml = pagesHtml.join('');
  } else if (drivePreviewUrl) {
    // Authentic Google Drive preview embedded directly in the A4 container with all chrome stripped
    rawContentHtml = `
      <div class="a4-raw-embed-container">
        <iframe
          src="${drivePreviewUrl}"
          style="width: 100%; height: 100%; border: none; background: #ffffff;"
          title="${fileName}"
          allow="autoplay"
        ></iframe>
      </div>
    `;
  } else {
    // Fallback card inside standardized A4 container
    rawContentHtml = `
      <div class="a4-standardized-container" style="justify-content: center; align-items: center; text-align: center;">
        <div style="padding: 40px 20px;">
          <h2 style="font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">${fileName}</h2>
          <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">เอกสารขนาด A4 พร้อมสำหรับการดาวน์โหลด</p>
          <button
            onclick="downloadRawFile()"
            class="btn-single-download"
            style="margin: 0 auto;"
          >
            ดาวน์โหลดไฟล์ต้นฉบับ
          </button>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} - ดูไฟล์ต้นฉบับ (ขนาด A4)</title>
  <style>
    ${STANDARDIZED_A4_CONTAINER_CSS}
  </style>
</head>
<body>
  <!-- HEADER BAR: STRICTLY NO PRINTER, NO COPY, ONLY 1 SINGLE DOWNLOAD BUTTON -->
  <header class="a4-viewer-header">
    <div class="file-meta">
      <div class="file-title" title="${fileName}">${fileName}</div>
      <div class="a4-badge">มาตรฐาน A4 (210 × 297 มม.)</div>
    </div>
    <div class="header-actions">
      <button id="btn-single-download" class="btn-single-download" onclick="downloadRawFile()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
      </button>
      <button class="btn-close-window" onclick="window.close()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>ปิดหน้าต่าง</span>
      </button>
    </div>
  </header>

  <!-- STANDARDIZED A4 VIEWPORT STAGE -->
  <main class="a4-stage-viewport">
    ${rawContentHtml}
  </main>

  <script>
    function downloadRawFile() {
      const dataUrl = ${JSON.stringify(file.fileDataUrl || '')};
      const fileName = ${JSON.stringify(fileName)};
      const downloadUrl = ${JSON.stringify(file.downloadUrl || '')};
      const viewUrl = ${JSON.stringify(file.viewUrl || '')};

      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const target = downloadUrl || viewUrl;
      if (target) {
        const a = document.createElement('a');
        a.href = target;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Utility to open authentic attached files directly in a dedicated new tab/window.
 * Strictly renders the authentic raw original file in a standardized container with CSS margin/padding
 * that forces an A4-like viewing experience (210mm × 297mm, 25.4mm × 20mm margins):
 * - STANDARDIZED A4 CONTAINER: CSS margin and padding force standard A4 page layout
 * - DIRECT RAW FILE SERVING: Directly loads raw Blob/Data URL or clean embed without Docs Viewer
 * - ZERO UI OVERLAYS: Strictly blocks printer dialogs, copy badges, and floating toolbars
 * - ONLY 1 SINGLE GREEN DOWNLOAD BUTTON
 */
export function openAuthenticFileInNewTab(
  file: UploadedFile,
  assignmentTitle?: string,
  submitterName?: string
) {
  if (!file) return;

  const payload: RawFilePayload = {
    file,
    assignmentTitle: assignmentTitle || '',
    submitterName: submitterName || '',
    openedAt: Date.now(),
  };

  // 1. Cache in sessionStorage and localStorage for state persistence
  try {
    sessionStorage.setItem('academic_active_raw_file', JSON.stringify(payload));
  } catch {
    // ignore
  }
  try {
    localStorage.setItem('academic_active_raw_file', JSON.stringify(payload));
  } catch (err) {
    console.warn('[fileViewer] Cache storage warning:', err);
  }

  // 2. Build target URL with strict A4 and no-viewer parameters
  const queryParams = new URLSearchParams({
    view_raw_file: '1',
    file_id: file.id || '',
    name: file.name || '',
    mime: file.mimeType || '',
    no_gdoc_viewer: '1',
    rm: 'minimal',
    a4_container: '1',
    title: assignmentTitle || '',
    uploader: submitterName || '',
  });
  const url = `/?${queryParams.toString()}`;

  // 3. Generate standardized container A4 HTML document
  const a4Html = buildStandardizedA4ViewerHtml(file, assignmentTitle, submitterName);

  // 4. Open new window and ensure it uses the standardized container with CSS margin/padding
  let newTab: Window | null = null;
  try {
    newTab = window.open('', '_blank');
    if (newTab && newTab.document) {
      newTab.document.open();
      newTab.document.write(a4Html);
      newTab.document.close();
      try {
        (newTab as any).__RAW_FILE_PAYLOAD__ = payload;
      } catch {
        // ignore
      }
    } else {
      newTab = window.open(url, '_blank');
      if (newTab) {
        try {
          (newTab as any).__RAW_FILE_PAYLOAD__ = payload;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    newTab = window.open(url, '_blank');
    if (newTab) {
      try {
        (newTab as any).__RAW_FILE_PAYLOAD__ = payload;
      } catch {
        // ignore
      }
    }
  }

  // 5. Provide opener references for fallback communication
  try {
    (window as any).__LAST_ACTIVE_RAW_FILE__ = payload;
  } catch {
    // ignore
  }

  // 6. Fallback if pop-up was completely blocked
  if (!newTab) {
    window.location.href = url;
  }
}


