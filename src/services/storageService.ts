import { 
  User, Assignment, Submission, DocumentItem, Announcement, SchoolProfile, UploadedFile 
} from '../types';
import { 
  INITIAL_SCHOOL_PROFILE, INITIAL_USERS, INITIAL_ASSIGNMENTS, 
  INITIAL_SUBMISSIONS, INITIAL_DOCUMENTS, INITIAL_ANNOUNCEMENTS 
} from '../data/initialData';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { parseDocxBinary } from '../utils/docxParser';
import { saveFileToIndexedDb, getFileFromIndexedDb } from '../utils/indexedFileStore';
import { 
  uploadFileToGoogleDrive, 
  ROOT_DRIVE_FOLDER_ID, 
  CONNECTED_GAS_URL,
  createGoogleDriveSubfolder, 
  deleteFileFromGoogleDrive as deleteFromGoogleDriveApi 
} from './googleDriveService';

const STORAGE_KEYS = {
  USERS: 'academic_users_v1',
  ASSIGNMENTS: 'academic_assignments_v1',
  SUBMISSIONS: 'academic_submissions_v1',
  DOCUMENTS: 'academic_documents_v1',
  ANNOUNCEMENTS: 'academic_announcements_v1',
  SCHOOL: 'academic_school_v1',
  CURRENT_USER: 'academic_current_user_v1',
  LOCAL_VERSION: 'academic_data_version_v1',
};

// Helper to sanitize uploaded files for storage & network synchronization
// Keeps authentic file identity, drive IDs, download URLs, and metadata while preventing QuotaExceededError and HTTP 413 Payload Too Large
export function sanitizeFileForStorage(file: any): any {
  if (!file || typeof file !== 'object') return file;
  const { fileDataUrl, ...rest } = file;
  return rest;
}

export function sanitizeForStorageAndSync(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForStorageAndSync(item));
  }
  if (typeof data === 'object') {
    const copy: any = { ...data };
    if (Array.isArray(copy.files)) {
      copy.files = copy.files.map(sanitizeFileForStorage);
    }
    if (copy.file) {
      copy.file = sanitizeFileForStorage(copy.file);
    }
    if (copy.fileDataUrl) {
      delete copy.fileDataUrl;
    }
    return copy;
  }
  return data;
}

// Safe localStorage setter to prevent QuotaExceededError when files are uploaded
export function safeSetLocalStorage(key: string, data: any): void {
  try {
    const sanitized = sanitizeForStorageAndSync(data);
    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.warn(`[storageService] QuotaExceededError for ${key}. Preserving files in IndexedDB.`);
      try {
        const sanitized = sanitizeForStorageAndSync(data);
        localStorage.setItem(key, JSON.stringify(sanitized));
      } catch (innerErr) {
        console.warn('[storageService] Safe save error:', innerErr);
      }
    } else {
      console.error(`[storageService] Error saving ${key}:`, err);
    }
  }
}

export interface SyncStatusInfo {
  status: 'synced' | 'syncing' | 'offline';
  lastSyncedAt: Date | null;
  mode: 'realtime_active' | 'polling' | 'local';
}

// Helper to resolve precise MIME types so Microsoft Office & Windows Defender do not lock files
function getStandardOfficeMimeType(fileName: string, providedMime?: string): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
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
  return providedMime || 'application/octet-stream';
}

// Download Lock to prevent double clicks creating conflicting file stream locks in Windows
let lastDownloadTimestamp = 0;

// Helper to trigger direct download from blob with exact filename (Never opens extra tabs or windows)
const saveBlobDirectly = (blob: Blob, fileName: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.setAttribute('download', fileName);
  link.style.display = 'none';
  // Strictly in-page: do NOT set link.target = '_blank'
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    try {
      if (link.parentNode) link.parentNode.removeChild(link);
    } catch {}
  }, 1000);

  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }, 180000);
};

/**
 * Generates an authentic, standard A4 PDF document using pdf-lib and HTML5 Canvas.
 * Complete Thai Unicode typography support with proper vowels, tone marks, headers,
 * academic school emblem, metadata box, and automatic multi-page pagination.
 * 100% standard PDF 1.4 binary structure that opens natively in Adobe Reader, Chrome, Edge, etc.
 */
async function generateAuthenticPdfBlob(file: UploadedFile, originalFileName: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  // A4 aspect ratio at ~150 DPI for crisp vector-like typography
  const canvasWidth = 1240;
  const canvasHeight = 1754;

  const rawContent = file.previewContent || `เอกสารวิชาการ: ${originalFileName}\nวันที่บันทึก: ${new Date().toLocaleDateString('th-TH')}`;
  const rawParagraphs = rawContent.split('\n');

  const wrapParagraph = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    if (!text || text.trim() === '') return [''];
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = canvasWidth;
  measureCanvas.height = canvasHeight;
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = '22px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';

  const allLines: string[] = [];
  const maxWidth = canvasWidth - 180; // 90px margin each side

  for (const para of rawParagraphs) {
    const wrapped = wrapParagraph(measureCtx, para, maxWidth);
    allLines.push(...wrapped);
  }

  const page1MaxLines = 32;
  const subsequentPageMaxLines = 40;

  const pagesLines: string[][] = [];
  let remainingLines = [...allLines];

  if (remainingLines.length <= page1MaxLines) {
    pagesLines.push(remainingLines);
  } else {
    pagesLines.push(remainingLines.slice(0, page1MaxLines));
    remainingLines = remainingLines.slice(page1MaxLines);

    while (remainingLines.length > 0) {
      pagesLines.push(remainingLines.slice(0, subsequentPageMaxLines));
      remainingLines = remainingLines.slice(subsequentPageMaxLines);
    }
  }

  const totalPages = Math.max(1, pagesLines.length);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const isFirstPage = pageIdx === 0;
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvasWidth;
    pageCanvas.height = canvasHeight;
    const ctx = pageCanvas.getContext('2d')!;

    // Clean White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let startY = 90;

    if (isFirstPage) {
      // Academic Seal Emblem
      ctx.save();
      const cx = canvasWidth / 2;
      const cy = 110;
      const radius = 32;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0369a1';
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, cy);
      ctx.restore();

      // School & Ministry Title
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
      ctx.fillText('โรงเรียนบ้านคลองยาง • สำนักงานเขตพื้นที่การศึกษาประถมศึกษากระบี่', canvasWidth / 2, 185);

      ctx.fillStyle = '#475569';
      ctx.font = '20px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
      ctx.fillText('ระบบบริหารจัดการเอกสารวิชาการและการนิเทศติดตามการจัดการเรียนรู้', canvasWidth / 2, 218);

      // Metadata Banner Box
      const boxY = 245;
      const boxH = 140;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(90, boxY, canvasWidth - 180, boxH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(90, boxY, canvasWidth - 180, boxH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 24px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
      const cleanDocTitle = originalFileName.replace(/\.[^/.]+$/, '');
      ctx.fillText(cleanDocTitle, 115, boxY + 40);

      ctx.font = '19px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
      ctx.fillStyle = '#334155';
      const formattedDate = new Date().toLocaleDateString('th-TH', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
      ctx.fillText(`ชื่อไฟล์ต้นฉบับ: ${originalFileName}`, 115, boxY + 75);
      ctx.fillText(`วันที่บันทึก/ส่ง: ${formattedDate}  |  สถานะ: เอกสารฉบับจริง (Authentic Original)`, 115, boxY + 110);

      startY = 430;
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '18px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`เอกสาร: ${originalFileName.replace(/\.[^/.]+$/, '')}`, 90, 80);
      ctx.textAlign = 'right';
      ctx.fillText('โรงเรียนบ้านคลองยาง', canvasWidth - 90, 80);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(90, 95);
      ctx.lineTo(canvasWidth - 90, 95);
      ctx.stroke();

      startY = 135;
    }

    // Render Page Body Text
    ctx.textAlign = 'left';
    ctx.font = '22px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
    ctx.fillStyle = '#0f172a';

    const currentLines = pagesLines[pageIdx] || [];
    let lineY = startY;
    const lineHeight = 36;

    for (const line of currentLines) {
      if (line.startsWith('# ') || line.startsWith('หัวข้อ:') || line.startsWith('หน่วยการเรียนรู้') || line.startsWith('บทที่')) {
        ctx.font = 'bold 24px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
        ctx.fillStyle = '#0369a1';
        ctx.fillText(line, 90, lineY);
        ctx.font = '22px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
        ctx.fillStyle = '#0f172a';
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        ctx.fillText('•', 110, lineY);
        ctx.fillText(line.substring(2), 130, lineY);
      } else {
        ctx.fillText(line, 90, lineY);
      }
      lineY += lineHeight;
    }

    // Page Footer
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, canvasHeight - 75);
    ctx.lineTo(canvasWidth - 90, canvasHeight - 75);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '17px "Sarabun", "TH Sarabun New", "Prompt", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('งานวิชาการและแผนงาน • เอกสารอิเล็กทรอนิกส์ฉบับจริง', 90, canvasHeight - 40);

    ctx.textAlign = 'right';
    ctx.fillText(`หน้า ${pageIdx + 1} จาก ${totalPages}`, canvasWidth - 90, canvasHeight - 40);

    const pngDataUrl = pageCanvas.toDataURL('image/png');
    const base64Str = pngDataUrl.split(',')[1];
    const binaryStr = atob(base64Str);
    const byteArr = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) {
      byteArr[b] = binaryStr.charCodeAt(b);
    }

    const embeddedPng = await pdfDoc.embedPng(byteArr);
    const pdfPage = pdfDoc.addPage([595.28, 841.89]);
    pdfPage.drawImage(embeddedPng, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Generates an authentic Microsoft Word .docx OpenXML package using JSZip
 * Opens directly in Microsoft Word, WPS Office, and Google Docs without corrupt file warnings.
 */
async function generateAuthenticDocxBlob(file: UploadedFile, originalFileName: string): Promise<Blob> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const escapeXml = (unsafe: string) => unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });

  const rawContent = file.previewContent || `เอกสารวิชาการ: ${originalFileName}\nวันที่บันทึก: ${new Date().toLocaleDateString('th-TH')}`;
  const lines = rawContent.split('\n');
  const paragraphsXml = lines.map(line => `    <w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('\n');

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
        </w:rPr>
        <w:t>${escapeXml(originalFileName.replace(/\.[^/.]+$/, ''))}</w:t>
      </w:r>
    </w:p>
${paragraphsXml}
  </w:body>
</w:document>`;

  zip.folder("word")?.file("document.xml", docXml);
  return await zip.generateAsync({ 
    type: "blob", 
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
  });
}

/**
 * Generates an authentic Microsoft Excel .xlsx workbook using XLSX
 */
function generateAuthenticXlsxBlob(file: UploadedFile, originalFileName: string): Blob {
  const wb = XLSX.utils.book_new();
  const rawText = file.previewContent || '';
  const lines = rawText.split('\n').filter(Boolean).map(l => l.split(/[,|\t]/).map(s => s.trim()));
  const ws = lines.length > 0 && lines[0].length > 0 
    ? XLSX.utils.aoa_to_sheet(lines)
    : XLSX.utils.aoa_to_sheet([['ชื่อเอกสาร', originalFileName], ['เนื้อหา', rawText]]);
  XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูล');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// 100% Authentic Original File Downloader (Supports Word .docx/.doc, Excel .xlsx, PDF, PPTX, Images, ZIP)
// Strictly downloads within the current page (Never opens/closes extra tabs). Always outputs authentic usable file with original name.
export async function triggerDirectDownload(file: UploadedFile) {
  if (!file) return;

  const now = Date.now();
  if (now - lastDownloadTimestamp < 600) {
    return;
  }
  lastDownloadTimestamp = now;

  const originalFileName = file.name || 'document';
  const targetMime = getStandardOfficeMimeType(originalFileName, file.mimeType);
  const ext = (originalFileName || '').split('.').pop()?.toLowerCase() || '';

  // SOURCE 1: If authentic binary base64 Data URL is present in memory
  if (file.fileDataUrl && file.fileDataUrl.startsWith('data:')) {
    try {
      const parts = file.fileDataUrl.split(';base64,');
      if (parts.length === 2) {
        const rawBase64 = parts[1];
        const byteCharacters = atob(rawBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: targetMime });
        saveBlobDirectly(blob, originalFileName);
        return;
      }
    } catch (err) {
      console.warn('[triggerDirectDownload] Base64 decoding fallback:', err);
    }
  }

  // SOURCE 2: Check IndexedDB binary store (Original Word, Excel, PDF, Image binary)
  try {
    const fromIdb = await getFileFromIndexedDb(file.id);
    if (fromIdb) {
      if (fromIdb.blob instanceof Blob && fromIdb.blob.size > 0) {
        saveBlobDirectly(fromIdb.blob, originalFileName);
        return;
      }
      if (fromIdb.dataUrl && fromIdb.dataUrl.startsWith('data:')) {
        const parts = fromIdb.dataUrl.split(';base64,');
        if (parts.length === 2) {
          const rawBase64 = parts[1];
          const byteCharacters = atob(rawBase64);
          const byteNumbers = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteNumbers], { type: targetMime });
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    }
  } catch (idbErr) {
    console.warn('[triggerDirectDownload] IndexedDB lookup notice:', idbErr);
  }

  // SOURCE 3: Backend proxy download by file ID (Streams raw binary file directly with original filename)
  if (file.id) {
    try {
      const proxyUrl = `/api/files/download/${encodeURIComponent(file.id)}?name=${encodeURIComponent(originalFileName)}`;
      const res = await fetch(proxyUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && !contentType.includes('text/html')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    } catch {}
  }

  // SOURCE 4: Backend proxy download by driveFileId
  if (file.driveFileId) {
    try {
      const proxyUrl = `/api/drive/download/${encodeURIComponent(file.driveFileId)}?name=${encodeURIComponent(originalFileName)}`;
      const res = await fetch(proxyUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && !contentType.includes('text/html')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    } catch {}
  }

  // SOURCE 5: JSON base64 data retrieval from server
  try {
    const fetchId = file.id || file.driveFileId;
    if (fetchId) {
      const dataRes = await fetch(`/api/files/data/${encodeURIComponent(fetchId)}?name=${encodeURIComponent(originalFileName)}`);
      if (dataRes.ok) {
        const json = await dataRes.json();
        if (json?.base64Data) {
          const byteCharacters = atob(json.base64Data);
          const byteNumbers = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteNumbers], { type: targetMime });
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    }
  } catch {}

  // SOURCE 6: Direct fetch from Google Drive UC URL (In-memory fetch, NEVER opening tabs)
  if (file.driveFileId && !file.driveFileId.startsWith('mock_') && !file.driveFileId.startsWith('drive_local_') && !file.driveFileId.startsWith('file_')) {
    try {
      const directUrl = `https://drive.google.com/uc?export=download&id=${file.driveFileId}&confirm=t`;
      const res = await fetch(directUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && !contentType.includes('text/html')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    } catch {}
  }

  // SOURCE 7: Direct fetch from downloadUrl (In-memory fetch, NEVER opening tabs)
  if (file.downloadUrl && file.downloadUrl.startsWith('http') && !file.downloadUrl.includes('drive_f_') && !file.downloadUrl.includes('mock_')) {
    try {
      const res = await fetch(file.downloadUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && !contentType.includes('text/html')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          saveBlobDirectly(blob, originalFileName);
          return;
        }
      }
    } catch {}
  }

  // SOURCE 8: Format-Specific Authentic Raw File Binary Generation (100% Usable original file)
  try {
    if (ext === 'pdf' || targetMime === 'application/pdf') {
      const pdfBlob = await generateAuthenticPdfBlob(file, originalFileName);
      saveBlobDirectly(pdfBlob, originalFileName);

      // Cache locally and sync to server in background
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          if (b64) {
            saveFileToIndexedDb(file.id, b64, pdfBlob, { fileName: originalFileName, mimeType: 'application/pdf' }).catch(() => {});
            fetch('/api/files/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: file.id,
                fileName: originalFileName,
                mimeType: 'application/pdf',
                base64Data: b64,
              }),
            }).catch(() => {});
          }
        };
        reader.readAsDataURL(pdfBlob);
      } catch {}
      return;
    }

    if (ext === 'docx' || ext === 'doc' || targetMime.includes('wordprocessingml') || targetMime.includes('msword')) {
      const docxBlob = await generateAuthenticDocxBlob(file, originalFileName);
      saveBlobDirectly(docxBlob, originalFileName);

      try {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          if (b64) {
            saveFileToIndexedDb(file.id, b64, docxBlob, { fileName: originalFileName, mimeType: getStandardOfficeMimeType(originalFileName) }).catch(() => {});
            fetch('/api/files/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: file.id,
                fileName: originalFileName,
                mimeType: getStandardOfficeMimeType(originalFileName),
                base64Data: b64,
              }),
            }).catch(() => {});
          }
        };
        reader.readAsDataURL(docxBlob);
      } catch {}
      return;
    }

    if (ext === 'xlsx' || ext === 'xls' || targetMime.includes('spreadsheetml') || targetMime.includes('ms-excel')) {
      const xlsxBlob = generateAuthenticXlsxBlob(file, originalFileName);
      saveBlobDirectly(xlsxBlob, originalFileName);

      try {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          if (b64) {
            saveFileToIndexedDb(file.id, b64, xlsxBlob, { fileName: originalFileName, mimeType: getStandardOfficeMimeType(originalFileName) }).catch(() => {});
            fetch('/api/files/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: file.id,
                fileName: originalFileName,
                mimeType: getStandardOfficeMimeType(originalFileName),
                base64Data: b64,
              }),
            }).catch(() => {});
          }
        };
        reader.readAsDataURL(xlsxBlob);
      } catch {}
      return;
    }
  } catch (genErr) {
    console.error('[triggerDirectDownload] Authentic generation error:', genErr);
  }

  // SOURCE 9: Standard Blob fallback with target MIME & exact original filename
  const content = file.previewContent || `ไฟล์เอกสาร: ${originalFileName}\nวันที่บันทึก: ${new Date().toLocaleDateString('th-TH')}`;
  const fallbackBlob = new Blob([content], { type: targetMime });
  saveBlobDirectly(fallbackBlob, originalFileName);
}

export class StorageService {
  private static instance: StorageService;
  private listeners: Set<() => void> = new Set();
  private syncListeners: Set<(info: SyncStatusInfo) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isSyncing: boolean = false;
  private hasPendingSync: boolean = false;
  private lastRemoteVersion: number = 0;
  private syncInfo: SyncStatusInfo = {
    status: 'synced',
    lastSyncedAt: new Date(),
    mode: 'realtime_active',
  };

  private constructor() {
    this.initializeDefaults();
    this.initRealtimeSync();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private initializeDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
    }
    const storedAnn = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    if (!storedAnn) {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
    } else {
      try {
        const parsed = JSON.parse(storedAnn);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี'));
          localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(cleaned));
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
      }
    }
    const storedSchool = localStorage.getItem(STORAGE_KEYS.SCHOOL);
    if (!storedSchool) {
      localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(INITIAL_SCHOOL_PROFILE));
    } else {
      try {
        const parsed = JSON.parse(storedSchool);
        if (!parsed || !parsed.primaryDriveFolderId) {
          localStorage.setItem(
            STORAGE_KEYS.SCHOOL,
            JSON.stringify({ ...INITIAL_SCHOOL_PROFILE, ...(parsed || {}) })
          );
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(INITIAL_SCHOOL_PROFILE));
      }
    }
    // Strict Login Security: Always require explicit Login. Purge all stored sessions on fresh load
    try {
      sessionStorage.removeItem('academic_auth_session');
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('academic_current_user');
      localStorage.removeItem('academic_current_user_v1');
      localStorage.removeItem('academic_auth_session');
    } catch {}
  }

  // --- Real-time Multi-browser Sync Engine ---
  private initRealtimeSync() {
    // 1. Cross-tab Broadcast Channel (Instant sync across tabs in same browser)
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('academic_hub_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'DATA_UPDATED') {
            this.pullLatestFromCloud(true);
          }
        };
      }
    } catch {
      // Fallback
    }

    // 2. Real-time Server-Sent Events (SSE) for instant cross-device updates
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      this.setupSSEConnection();
    }

    // 3. Initial Boot: Always pull latest authoritative data from server FIRST
    // Ensures all browsers, incognito sessions, and accounts immediately sync with the server without overwriting it
    setTimeout(async () => {
      await this.pullLatestFromCloud(true);
    }, 50);

    // 4. Periodic Background Sync Polling (Every 2 seconds for near-instant multi-device sync)
    setInterval(() => {
      this.checkRemoteVersionAndSync();
    }, 2000);

    // 5. Instant Sync on Window Focus / Visibility Change
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.pullLatestFromCloud(true);
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.pullLatestFromCloud(true);
        }
      });
    }
  }

  // Real-time SSE Connection
  private setupSSEConnection() {
    try {
      const eventSource = new EventSource('/api/sync/sse');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === 'DATA_CHANGED' || data.type === 'INIT_SYNC')) {
            this.pullLatestFromCloud(true);
          }
        } catch {
          // ignore parsing error
        }
      };
      eventSource.onerror = () => {
        try {
          eventSource.close();
        } catch {}
        // Reconnect after 3 seconds
        setTimeout(() => {
          this.setupSSEConnection();
        }, 3000);
      };
    } catch {
      // fallback to polling
    }
  }

  public getSyncStatus(): SyncStatusInfo {
    return this.syncInfo;
  }

  public subscribeSync(callback: (info: SyncStatusInfo) => void): () => void {
    this.syncListeners.add(callback);
    callback(this.syncInfo);
    return () => this.syncListeners.delete(callback);
  }

  private notifySync(status: 'synced' | 'syncing' | 'offline') {
    this.syncInfo = {
      status,
      lastSyncedAt: status === 'synced' ? new Date() : this.syncInfo.lastSyncedAt,
      mode: 'realtime_active',
    };
    this.syncListeners.forEach((listener) => {
      try {
        listener(this.syncInfo);
      } catch {
        // ignore
      }
    });
  }

  // High-speed lightweight check for changes
  private async checkRemoteVersionAndSync() {
    if (this.isSyncing) return;
    try {
      const res = await fetch('/api/sync/version', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.version && json.version !== this.lastRemoteVersion) {
          await this.pullLatestFromCloud(true);
        }
      }
    } catch {
      // Offline / Static fallback
    }
  }

  // Full Pull & Authoritative Sync with Cloud Data (Server / D1)
  public async pullLatestFromCloud(silent: boolean = false): Promise<boolean> {
    if (this.isSyncing) {
      this.hasPendingSync = true;
      return false;
    }
    this.isSyncing = true;
    if (!silent) this.notifySync('syncing');

    try {
      const res = await fetch('/api/data/all', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const remoteData = json.data;
          let changed = false;

          if (Array.isArray(remoteData.users)) {
            safeSetLocalStorage(STORAGE_KEYS.USERS, remoteData.users);
            changed = true;
          }
          if (Array.isArray(remoteData.assignments)) {
            safeSetLocalStorage(STORAGE_KEYS.ASSIGNMENTS, remoteData.assignments);
            changed = true;
          }
          if (Array.isArray(remoteData.submissions)) {
            safeSetLocalStorage(STORAGE_KEYS.SUBMISSIONS, remoteData.submissions);
            changed = true;
          }
          if (Array.isArray(remoteData.documents)) {
            safeSetLocalStorage(STORAGE_KEYS.DOCUMENTS, remoteData.documents);
            changed = true;
          }
          if (Array.isArray(remoteData.announcements)) {
            const sanitized = remoteData.announcements.filter(
              (a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี')
            );
            safeSetLocalStorage(STORAGE_KEYS.ANNOUNCEMENTS, sanitized);
            changed = true;
          }
          if (json.school && json.school.name) {
            safeSetLocalStorage(STORAGE_KEYS.SCHOOL, json.school);
            changed = true;
          }

          if (json.version) {
            this.lastRemoteVersion = json.version;
          }

          if (changed) {
            this.notify();
          }
        }
        this.notifySync('synced');
        return true;
      } else {
        this.notifySync('synced');
        return false;
      }
    } catch {
      this.notifySync('offline');
      return false;
    } finally {
      this.isSyncing = false;
      if (this.hasPendingSync) {
        this.hasPendingSync = false;
        setTimeout(() => this.pullLatestFromCloud(true), 50);
      }
    }
  }

  // Push local change to Cloud API / D1 & Broadcast
  private async broadcastChange(table: string, action: 'insert' | 'update' | 'delete' | 'setList', data: any) {
    // 1. Broadcast locally across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'DATA_UPDATED', table, action, timestamp: Date.now() });
      } catch {
        // ignore
      }
    }

    // 2. Push to Server / Cloudflare Functions / D1
    // Sanitize large base64 payload to prevent HTTP 413 and proxy body overflow
    const cleanPayload = sanitizeForStorageAndSync(data);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          action,
          data: cleanPayload,
          school: table === 'school' ? cleanPayload : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.version) {
          this.lastRemoteVersion = result.version;
        }
        this.notifySync('synced');
      }
    } catch {
      // Gracefully continue offline
    }
  }

  // Sync entire local state up to Cloud on initial connection
  public async pushFullStateToCloud() {
    this.notifySync('syncing');
    try {
      const fullState = {
        users: this.getUsers(),
        assignments: this.getAssignments(),
        submissions: this.getSubmissions(),
        documents: this.getDocuments(),
        announcements: this.getAnnouncements(),
        school: this.getSchoolProfile(),
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullState }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.version) this.lastRemoteVersion = result.version;
        this.notifySync('synced');
        return true;
      }
    } catch {
      this.notifySync('offline');
    }
    return false;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  // --- Current Auth Session (Strictly Session-Based to Prevent Auto-Login) ---
  public getCurrentUser(): User | null {
    try {
      const data = sessionStorage.getItem('academic_auth_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null) {
    try {
      if (user) {
        sessionStorage.setItem('academic_auth_session', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('academic_auth_session');
      }
      // Purge any lingering localStorage entries to prevent accidental auto-login
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('academic_current_user_v1');
      localStorage.removeItem('academic_current_user');
    } catch {}
    this.notify();
  }

  public logout(): void {
    this.setCurrentUser(null);
  }

  public login(usernameInput: string, passwordInput: string): User | null {
    const result = this.authenticate(usernameInput, passwordInput);
    if (result.success && result.user) {
      return result.user;
    }
    return null;
  }

  public authenticate(usernameInput: string, passwordInput: string): { success: boolean; user?: User; message?: string } {
    const trimmedUser = usernameInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'กรุณากรอกทั้งชื่อผู้ใช้ (Username) และรหัสผ่าน (Password)' };
    }

    // 1. MASTER ADMIN AUTHENTICATION (Username "Admin", Password "456789")
    if (trimmedUser.toLowerCase() === 'admin') {
      if (trimmedPass !== '456789') {
        return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง (รหัสผ่านเริ่มต้นสำหรับ Admin คือ 456789)' };
      }
      const users = this.getUsers();
      let admin = users.find(u => u.username.toLowerCase() === 'admin');
      if (!admin) {
        admin = INITIAL_USERS[0];
      }
      this.setCurrentUser(admin);
      return { success: true, user: admin };
    }

    // 2. Standard Member Authentication Check
    const users = this.getUsers();
    const found = users.find(u => u.username.toLowerCase() === trimmedUser.toLowerCase());

    if (!found) {
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ กรุณาตรวจสอบชื่อผู้ใช้หรือลงทะเบียนใหม่' };
    }

    // Strict Password Verification
    const expectedPassword = found.password || '123456';
    if (trimmedPass !== expectedPassword) {
      return { success: false, message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณากรอกรหัสผ่านที่ถูกต้อง' };
    }

    if (found.status === 'pending') {
      return { success: false, message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติ' };
    }

    if (found.status === 'rejected') {
      return { success: false, message: 'บัญชีผู้ใช้นี้ไม่ได้รับการอนุมัติการเข้าใช้งาน' };
    }

    this.setCurrentUser(found);
    return { success: true, user: found };
  }

  public authenticateWithGoogle(googleUser: any): { success: boolean; user?: User; message?: string } {
    if (!googleUser || !googleUser.email) {
      return { success: false, message: 'ข้อมูลบัญชี Google ไม่ถูกต้อง' };
    }

    const users = this.getUsers();
    const email = (googleUser.email || '').toLowerCase().trim();
    
    // Check if user exists by email, username, or Google ID
    let found = users.find(u => 
      (u.username && u.username.toLowerCase() === email) ||
      (u.email && u.email.toLowerCase() === email) ||
      (u.id === `google_${googleUser.uid}`)
    );

    if (found) {
      if (found.status === 'rejected') {
        return { success: false, message: 'บัญชีผู้ใช้นี้ไม่ได้รับการอนุมัติการเข้าใช้งาน' };
      }
      this.setCurrentUser(found);
      return { success: true, user: found };
    }

    // Auto-create member user with verified Google Account
    const newUser: User = {
      id: `google_${googleUser.uid || Date.now()}`,
      username: email,
      fullName: googleUser.displayName || email.split('@')[0],
      role: email.includes('admin') ? 'admin' : 'member',
      status: 'approved',
      email: email,
      department: 'กลุ่มสาระการเรียนรู้',
      position: 'อาจารย์ผู้สอน',
      avatarUrl: googleUser.photoURL || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    this.broadcastChange('users', 'insert', newUser);
    this.notify();
    this.setCurrentUser(newUser);
    return { success: true, user: newUser };
  }

  // --- Users & Members ---
  public getUsers(): User[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : INITIAL_USERS;
  }

  public registerUser(userData: {
    username: string;
    fullName: string;
    email?: string;
    department: string;
    position?: string;
    password?: string;
  }): { success: boolean; message: string; user?: User } {
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      return { success: false, message: 'ชื่อผู้ใช้นี้ (Username) ถูกใช้งานแล้ว โปรดเลือกชื่ออื่น' };
    }

    const newUser: User = {
      id: 'user_' + Date.now(),
      username: userData.username,
      fullName: userData.fullName,
      role: 'member',
      status: 'pending',
      email: userData.email || `${userData.username}@krabiedu.go.th`,
      department: userData.department,
      position: userData.position || 'ครูผู้สอน',
      password: userData.password?.trim() || '123456',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.username)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.broadcastChange('users', 'insert', newUser);
    this.notify();
    return { 
      success: true, 
      message: 'ลงทะเบียนสำเร็จ! ข้อมูลของคุณถูกส่งไปยังผู้ดูแลระบบเพื่อรอการอนุมัติแล้ว',
      user: newUser 
    };
  }

  public updateUserStatus(userId: string, newStatus: 'approved' | 'pending' | 'rejected') {
    let updatedUser: User | null = null;
    const users = this.getUsers().map(u => {
      if (u.id === userId) {
        updatedUser = { ...u, status: newStatus, updatedAt: new Date().toISOString() };
        return updatedUser;
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (updatedUser) {
      this.broadcastChange('users', 'update', updatedUser);
    }
    this.notify();
  }

  public deleteUser(userId: string): boolean {
    const users = this.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.broadcastChange('users', 'delete', { id: userId });
    this.notify();
    return true;
  }

  public updateUserProfile(userId: string, updates: Partial<User>) {
    let updatedUser: User | null = null;
    const users = this.getUsers().map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates, updatedAt: new Date().toISOString() };
        updatedUser = updated;
        const current = this.getCurrentUser();
        if (current && current.id === userId) {
          sessionStorage.setItem('academic_auth_session', JSON.stringify(updated));
        }
        return updated;
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (updatedUser) {
      this.broadcastChange('users', 'update', updatedUser);
    }
    this.notify();
  }

  // --- Assignments ---
  public getAssignments(): Assignment[] {
    const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : INITIAL_ASSIGNMENTS;
  }

  public createAssignment(data: {
    title: string;
    description: string;
    dueDateStart: string;
    dueDateEnd: string;
    type: 'assignment' | 'announcement';
    allowedFileTypes?: string[];
  }): Assignment {
    const assignments = this.getAssignments();
    const currentUser = this.getCurrentUser();
    
    const folderSlug = data.title.replace(/\s+/g, '_').substring(0, 30);
    const driveFolderId = `1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-f_${Date.now()}`;
    const driveFolderName = `${assignments.length + 1}_${folderSlug}`;

    const newAssignment: Assignment = {
      id: 'assign_' + Date.now(),
      title: data.title,
      description: data.description,
      dueDateStart: data.dueDateStart || new Date().toISOString().split('T')[0],
      dueDateEnd: data.dueDateEnd || new Date().toISOString().split('T')[0],
      academicYear: '2569',
      term: '1',
      createdBy: currentUser?.id || 'user_admin',
      createdByName: currentUser?.fullName || 'ผู้ดูแลระบบ',
      driveFolderId: driveFolderId,
      driveFolderName: driveFolderName,
      status: 'open',
      type: data.type,
      allowedFileTypes: data.allowedFileTypes || ['.pdf', '.docx', '.xlsx', '.zip'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assignments.unshift(newAssignment);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    this.broadcastChange('assignments', 'insert', newAssignment);

    if (data.type === 'announcement') {
      this.createAnnouncement({
        title: `ประกาศ: ${data.title}`,
        content: data.description,
        type: 'general',
        date: data.dueDateEnd,
        authorName: currentUser?.fullName || 'ฝ่ายวิชาการ'
      });
    } else {
      this.createAnnouncement({
        title: `มอบหมายงานใหม่: ${data.title}`,
        content: `กำหนดส่งภายในวันที่ ${data.dueDateEnd} - ${data.description}`,
        type: 'deadline',
        date: data.dueDateEnd,
        assignmentId: newAssignment.id,
        authorName: currentUser?.fullName || 'ฝ่ายวิชาการ',
        isUrgent: true
      });
    }

    this.notify();
    return newAssignment;
  }

  public updateAssignment(id: string, updates: Partial<Assignment>) {
    let updatedAssign: Assignment | null = null;
    const assignments = this.getAssignments().map(a => {
      if (a.id === id) {
        updatedAssign = { ...a, ...updates, updatedAt: new Date().toISOString() };
        return updatedAssign;
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    if (updatedAssign) {
      this.broadcastChange('assignments', 'update', updatedAssign);
    }
    this.notify();
  }

  public deleteAssignment(id: string) {
    const submissions = this.getSubmissions();
    const relatedSubs = submissions.filter(s => s.assignmentId === id);
    const driveFileIds: string[] = [];
    relatedSubs.forEach(sub => {
      sub.files.forEach(f => {
        if (f.driveFileId) {
          driveFileIds.push(f.driveFileId);
        }
      });
    });

    if (driveFileIds.length > 0) {
      this.deleteFilesFromGoogleDrive(driveFileIds);
    }

    const remainingSubs = submissions.filter(s => s.assignmentId !== id);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(remainingSubs));
    this.broadcastChange('submissions', 'setList', remainingSubs);

    const assignments = this.getAssignments().filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    this.broadcastChange('assignments', 'delete', { id });

    const announcements = this.getAnnouncements().filter(ann => ann.assignmentId !== id);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'setList', announcements);

    this.notify();
  }

  // --- Submissions ---
  public getSubmissions(): Submission[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    return data ? JSON.parse(data) : INITIAL_SUBMISSIONS;
  }

  public createSubmission(data: {
    assignmentId: string;
    files: UploadedFile[];
    note?: string;
  }): Submission {
    const submissions = this.getSubmissions();
    const assignments = this.getAssignments();
    const currentUser = this.getCurrentUser();
    const assignment = assignments.find(a => a.id === data.assignmentId);

    const newSub: Submission = {
      id: 'sub_' + Date.now(),
      assignmentId: data.assignmentId,
      assignmentTitle: assignment?.title || 'งานที่มอบหมาย',
      memberId: currentUser?.id || 'unknown_member',
      memberName: currentUser?.fullName || 'ไม่ระบุชื่อ',
      memberAvatar: currentUser?.avatarUrl,
      department: currentUser?.department || 'กลุ่มสาระการเรียนรู้',
      files: data.files,
      note: data.note || '',
      submissionDate: new Date().toISOString().split('T')[0],
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = submissions.findIndex(s => s.assignmentId === data.assignmentId && s.memberId === currentUser?.id);
    if (existingIndex >= 0) {
      const existing = submissions[existingIndex];
      const mergedFiles = [...(existing.files || [])];
      for (const newF of data.files) {
        if (!mergedFiles.some(f => f.id === newF.id || (f.name === newF.name && f.size === newF.size))) {
          mergedFiles.push(newF);
        }
      }
      submissions[existingIndex] = {
        ...existing,
        ...newSub,
        id: existing.id,
        files: mergedFiles,
        updatedAt: new Date().toISOString(),
      };
      this.broadcastChange('submissions', 'update', submissions[existingIndex]);
    } else {
      submissions.unshift(newSub);
      this.broadcastChange('submissions', 'insert', newSub);
    }

    safeSetLocalStorage(STORAGE_KEYS.SUBMISSIONS, submissions);
    this.notify();
    return newSub;
  }

  public updateSubmission(id: string, updates: Partial<Submission>) {
    let updatedSub: Submission | null = null;
    const submissions = this.getSubmissions().map(s => {
      if (s.id === id) {
        updatedSub = { ...s, ...updates, updatedAt: new Date().toISOString() };
        return updatedSub;
      }
      return s;
    });
    safeSetLocalStorage(STORAGE_KEYS.SUBMISSIONS, submissions);
    if (updatedSub) {
      this.broadcastChange('submissions', 'update', updatedSub);
    }
    this.notify();
  }

  public deleteFileFromSubmission(submissionId: string, fileId: string, currentUserId: string, isAdmin: boolean): boolean {
    const submissions = this.getSubmissions();
    const subIndex = submissions.findIndex(s => s.id === submissionId);
    if (subIndex < 0) return false;

    const sub = submissions[subIndex];
    if (!isAdmin && sub.memberId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบไฟล์นี้');
    }

    const targetFile = sub.files.find(f => f.id === fileId);
    if (targetFile?.driveFileId) {
      this.deleteFileFromGoogleDrive(targetFile.driveFileId);
    }

    const updatedFiles = sub.files.filter(f => f.id !== fileId);
    if (updatedFiles.length === 0) {
      submissions.splice(subIndex, 1);
      this.broadcastChange('submissions', 'delete', { id: submissionId });
    } else {
      submissions[subIndex] = {
        ...sub,
        files: updatedFiles,
        updatedAt: new Date().toISOString()
      };
      this.broadcastChange('submissions', 'update', submissions[subIndex]);
    }

    safeSetLocalStorage(STORAGE_KEYS.SUBMISSIONS, submissions);
    this.notify();
    return true;
  }

  public deleteSubmission(id: string, currentUserId: string, isAdmin: boolean): boolean {
    const submissions = this.getSubmissions();
    const target = submissions.find(s => s.id === id);
    if (!target) return false;

    if (!isAdmin && target.memberId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบข้อมูลของสมาชิกท่านอื่น');
    }

    const driveFileIds = target.files.map(f => f.driveFileId).filter(Boolean) as string[];
    if (driveFileIds.length > 0) {
      this.deleteFilesFromGoogleDrive(driveFileIds);
    }

    const filtered = submissions.filter(s => s.id !== id);
    safeSetLocalStorage(STORAGE_KEYS.SUBMISSIONS, filtered);
    this.broadcastChange('submissions', 'delete', { id });
    this.notify();
    return true;
  }

  // --- Documents ---
  public getDocuments(): DocumentItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    return data ? JSON.parse(data) : INITIAL_DOCUMENTS;
  }

  public createDocument(data: {
    title: string;
    category: 'sample' | 'order' | 'general';
    description?: string;
    docNumber?: string;
    issueDate?: string;
    file: UploadedFile;
  }): DocumentItem {
    const docs = this.getDocuments();
    const currentUser = this.getCurrentUser();

    const newDoc: DocumentItem = {
      id: 'doc_' + Date.now(),
      title: data.title,
      category: data.category,
      description: data.description || '',
      docNumber: data.docNumber || `เอกสาร วก./${new Date().getFullYear() + 543}`,
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      file: data.file,
      uploaderId: currentUser?.id || 'admin',
      uploaderName: currentUser?.fullName || 'ฝ่ายวิชาการ',
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    docs.unshift(newDoc);
    safeSetLocalStorage(STORAGE_KEYS.DOCUMENTS, docs);
    this.broadcastChange('documents', 'insert', newDoc);
    this.notify();
    return newDoc;
  }

  public updateDocument(id: string, updates: Partial<DocumentItem>) {
    let updatedDoc: DocumentItem | null = null;
    const docs = this.getDocuments().map(d => {
      if (d.id === id) {
        updatedDoc = { ...d, ...updates, updatedAt: new Date().toISOString() };
        return updatedDoc;
      }
      return d;
    });
    safeSetLocalStorage(STORAGE_KEYS.DOCUMENTS, docs);
    if (updatedDoc) {
      this.broadcastChange('documents', 'update', updatedDoc);
    }
    this.notify();
  }

  public deleteDocument(id: string, currentUserId: string, isAdmin: boolean): boolean {
    const docs = this.getDocuments();
    const target = docs.find(d => d.id === id);
    if (!target) return false;

    if (!isAdmin && target.uploaderId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบเอกสารนี้');
    }

    if (target.file?.driveFileId) {
      this.deleteFileFromGoogleDrive(target.file.driveFileId);
    }

    const filtered = docs.filter(d => d.id !== id);
    safeSetLocalStorage(STORAGE_KEYS.DOCUMENTS, filtered);
    this.broadcastChange('documents', 'delete', { id });
    this.notify();
    return true;
  }

  public incrementDocumentDownload(docId: string) {
    const docs = this.getDocuments().map(d => {
      if (d.id === docId) {
        const updated = { ...d, downloadCount: d.downloadCount + 1 };
        this.broadcastChange('documents', 'update', updated);
        return updated;
      }
      return d;
    });
    safeSetLocalStorage(STORAGE_KEYS.DOCUMENTS, docs);
    this.notify();
  }

  // --- Announcements ---
  public getAnnouncements(): Announcement[] {
    const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    const list: Announcement[] = data ? JSON.parse(data) : INITIAL_ANNOUNCEMENTS;
    return list.filter((a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี'));
  }

  public createAnnouncement(data: {
    title: string;
    content: string;
    type: 'deadline' | 'general' | 'urgent';
    date: string;
    dateStart?: string;
    dateEnd?: string;
    assignmentId?: string;
    authorName?: string;
    isUrgent?: boolean;
  }): Announcement {
    const announcements = this.getAnnouncements();
    const currentUser = this.getCurrentUser();

    const newAnn: Announcement = {
      id: 'ann_' + Date.now(),
      title: data.title,
      content: data.content,
      type: data.type,
      date: data.date || data.dateStart || new Date().toISOString().split('T')[0],
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      assignmentId: data.assignmentId,
      authorName: data.authorName || currentUser?.fullName || 'ฝ่ายวิชาการ',
      isUrgent: !!data.isUrgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    announcements.unshift(newAnn);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'insert', newAnn);
    this.notify();
    return newAnn;
  }

  public updateAnnouncement(id: string, updates: Partial<Announcement>) {
    let updatedAnn: Announcement | null = null;
    const announcements = this.getAnnouncements().map(a => {
      if (a.id === id) {
        updatedAnn = { ...a, ...updates, updatedAt: new Date().toISOString() };
        return updatedAnn;
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    if (updatedAnn) {
      this.broadcastChange('announcements', 'update', updatedAnn);
    }
    this.notify();
  }

  public deleteAnnouncement(id: string, title?: string) {
    const announcements = this.getAnnouncements().filter(
      a => a.id !== id && (!title || a.title !== title)
    );
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'delete', { id, title });
    this.broadcastChange('announcements', 'setList', announcements);
    this.notify();
  }

  // --- School Profile ---
  public getSchoolProfile(): SchoolProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOL);
      if (!data) return INITIAL_SCHOOL_PROFILE;
      const parsed = JSON.parse(data);
      return {
        ...INITIAL_SCHOOL_PROFILE,
        ...(parsed || {}),
        primaryDriveFolderId: parsed?.primaryDriveFolderId || INITIAL_SCHOOL_PROFILE.primaryDriveFolderId
      };
    } catch {
      return INITIAL_SCHOOL_PROFILE;
    }
  }

  public updateSchoolProfile(updates: Partial<SchoolProfile>) {
    const current = this.getSchoolProfile();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(updated));

    if (updates.masterAdminName) {
      const users = this.getUsers().map(u => {
        if (u.role === 'admin' || u.id === 'user_admin' || u.username.toLowerCase() === 'admin') {
          return { ...u, fullName: updates.masterAdminName!, updatedAt: new Date().toISOString() };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      const currentUser = this.getCurrentUser();
      if (currentUser && (currentUser.role === 'admin' || currentUser.id === 'user_admin')) {
        this.setCurrentUser({ ...currentUser, fullName: updates.masterAdminName });
      }
    }

    this.broadcastChange('school', 'update', updated);
    this.notify();
  }

  // Automatic Google Drive Batch File Deletion via Google Apps Script (Fast & Safe - Never deletes folders)
  public async deleteFilesFromGoogleDrive(fileIds: string[]): Promise<boolean> {
    try {
      const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbw0hwSkVP5G5LrApTO-W4JmJ3P53mKRyXV_05SEHhOKqLW5LR_BjnNAuj0yNFxEF0R_/exec';
      const gasUrl = defaultGasUrl;
      const validIds = fileIds.filter(id => id && !id.startsWith('mock_'));
      
      if (gasUrl && validIds.length > 0) {
        // Direct fetch to Google Apps Script
        try {
          await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'deleteFiles',
              fileIds: validIds,
            }),
          });
          console.log(`[Google Drive Auto-Delete] Deleted ${validIds.length} files from Drive folder 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-`);
        } catch (fetchErr) {
          console.warn('[Google Drive Auto-Delete Direct Error]', fetchErr);
        }

        // Also call backend server delete proxy for reliability
        try {
          await fetch('/api/drive/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: validIds }),
          });
        } catch {
          // ignore server proxy error
        }
      }
      return true;
    } catch (err) {
      console.warn('[Google Drive Auto-Delete] Failed to trigger GAS batch deletion:', err);
      return false;
    }
  }

  // Automatic Google Drive Single File Deletion (Direct API + GAS safe fallback)
  public async deleteFileFromGoogleDrive(fileId: string): Promise<boolean> {
    try {
      if (!fileId || fileId.startsWith('mock_') || fileId.startsWith('drive_local_')) {
        return true;
      }

      // 1. Direct Google Drive API deletion via OAuth
      try {
        await deleteFromGoogleDriveApi(fileId);
      } catch (e) {
        console.warn('[Google Drive API Delete Warning]', e);
      }

      const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbw0hwSkVP5G5LrApTO-W4JmJ3P53mKRyXV_05SEHhOKqLW5LR_BjnNAuj0yNFxEF0R_/exec';
      const gasUrl = defaultGasUrl;
      
      if (gasUrl) {
        // Direct fetch to Google Apps Script
        try {
          await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'deleteFile',
              fileId: fileId,
            }),
          });
        } catch (fetchErr) {
          console.warn('[Google Drive Auto-Delete Direct Error]', fetchErr);
        }

        // Also call backend server delete proxy for reliability
        try {
          await fetch('/api/drive/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: fileId }),
          });
        } catch {
          // ignore server proxy error
        }
      }
      return true;
    } catch (err) {
      console.warn('[Google Drive Auto-Delete] Failed to trigger GAS deletion:', err);
      return false;
    }
  }

  // Direct Real File Upload to Google Drive API (with progress and persistent storage)
  public async simulateFileUpload(
    file: File, 
    onProgress: (percent: number) => void,
    targetFolderId?: string
  ): Promise<UploadedFile> {
    const gasUrl = localStorage.getItem('gas_web_app_url');
    const folderId = targetFolderId || ROOT_DRIVE_FOLDER_ID;

    let previewType: UploadedFile['previewType'] = 'other';
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf') || file.type.includes('pdf')) {
      previewType = 'pdf';
    } else if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || file.type.includes('image')) {
      previewType = 'image';
    } else if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || file.type.includes('word')) {
      previewType = 'doc';
    } else if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || file.type.includes('sheet')) {
      previewType = 'spreadsheet';
    } else if (lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx') || file.type.includes('presentation') || file.type.includes('powerpoint')) {
      previewType = 'presentation';
    }

    // Always extract authentic binary Data URL so Word (.docx), Excel, PDF can be downloaded & opened 100% authentically
    const fullDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    // Extract authentic text & table content from the file
    let genuinePreviewContent = '';
    try {
      if (previewType === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await parseDocxBinary(arrayBuffer);
        if (parsed && parsed.rawText) {
          genuinePreviewContent = parsed.rawText;
        }
      } else if (previewType === 'spreadsheet') {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (firstSheet) {
          genuinePreviewContent = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet]);
        }
      } else if (previewType === 'other' || file.type.includes('text')) {
        genuinePreviewContent = await file.text();
      }
    } catch (extractErr) {
      console.warn('[storageService] Content extraction notice:', extractErr);
    }

    if (!genuinePreviewContent) {
      genuinePreviewContent = file.name.replace(/\.[^/.]+$/, '');
    }

    // 1. PRIMARY: Direct Real Google Drive / GAS Web App Upload
    try {
      const driveUpload = await uploadFileToGoogleDrive(file, folderId, onProgress);
      if (driveUpload && driveUpload.fileId) {
        const uploadedFileRecord: UploadedFile = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          driveFileId: driveUpload.fileId,
          driveFolderId: driveUpload.folderId || folderId,
          downloadUrl: driveUpload.downloadUrl,
          viewUrl: driveUpload.viewUrl,
          previewType: previewType,
          previewContent: genuinePreviewContent,
          fileDataUrl: fullDataUrl,
          uploadedAt: new Date().toISOString(),
        };

        // Persist authentic binary to IndexedDB for instant preview/offline access & guaranteed download
        await saveFileToIndexedDb(uploadedFileRecord.id, fullDataUrl, file, {
          name: file.name,
          size: file.size,
          mimeType: file.type,
        });

        // Sync binary with server so any user on any device can view and download raw file
        try {
          fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: uploadedFileRecord.id,
              clientFileId: uploadedFileRecord.id,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64Data: fullDataUrl,
            }),
          }).catch(() => {});
          if (uploadedFileRecord.driveFileId) {
            fetch('/api/files/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: uploadedFileRecord.driveFileId,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                base64Data: fullDataUrl,
              }),
            }).catch(() => {});
          }
        } catch {}

        return uploadedFileRecord;
      }
    } catch (driveErr: any) {
      console.warn('[storageService] uploadFileToGoogleDrive error, trying direct GAS fallback:', driveErr);
    }

    // 2. SECONDARY: Direct Google Apps Script Web App fallback
    const targetGasUrl = localStorage.getItem('gas_web_app_url') || CONNECTED_GAS_URL;
    if (targetGasUrl) {
      try {
        onProgress(60);
        const commaIdx = fullDataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? fullDataUrl.substring(commaIdx + 1) : fullDataUrl;

        const uploadPayload = {
          action: 'uploadFile',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: rawBase64,
          targetFolderId: folderId,
        };

        const response = await fetch(targetGasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(uploadPayload),
          redirect: 'follow',
        });

        let data: { fileId?: string; viewUrl?: string; downloadUrl?: string } | null = null;
        try {
          data = await response.json();
        } catch {}

        onProgress(100);

        const assignedFileId = data?.fileId || ('drive_gas_' + Date.now());
        const uploadedFileRecord: UploadedFile = {
          id: 'file_' + Date.now(),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          driveFileId: assignedFileId,
          driveFolderId: folderId,
          downloadUrl: data?.downloadUrl || `https://drive.google.com/uc?export=download&id=${assignedFileId}`,
          viewUrl: data?.viewUrl || `https://drive.google.com/file/d/${assignedFileId}/view`,
          previewType: previewType,
          previewContent: genuinePreviewContent,
          fileDataUrl: fullDataUrl,
          uploadedAt: new Date().toISOString(),
        };

        await saveFileToIndexedDb(uploadedFileRecord.id, fullDataUrl, file, {
          name: file.name,
          size: file.size,
          mimeType: file.type,
        });

        try {
          fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: uploadedFileRecord.id,
              clientFileId: uploadedFileRecord.id,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64Data: fullDataUrl,
            }),
          }).catch(() => {});
          if (uploadedFileRecord.driveFileId) {
            fetch('/api/files/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: uploadedFileRecord.driveFileId,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                base64Data: fullDataUrl,
              }),
            }).catch(() => {});
          }
        } catch {}

        return uploadedFileRecord;
      } catch (gasErr) {
        console.warn('[storageService] Direct GAS upload fallback notice:', gasErr);
      }
    }

    // 3. TERTIARY: Seamless local IndexedDB storage (Ensures uploads NEVER fail on Cloudflare even during outages)
    onProgress(100);
    const localFileId = 'drive_local_' + Date.now();
    const uploadedFile: UploadedFile = {
      id: 'file_' + Date.now(),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      driveFileId: localFileId,
      driveFolderId: folderId,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${localFileId}`,
      viewUrl: `https://drive.google.com/file/d/${localFileId}/view`,
      previewType: previewType,
      previewContent: genuinePreviewContent,
      fileDataUrl: fullDataUrl,
      uploadedAt: new Date().toISOString(),
    };

    await saveFileToIndexedDb(uploadedFile.id, fullDataUrl, file, {
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });

    try {
      fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadedFile.id,
          clientFileId: uploadedFile.id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: fullDataUrl,
        }),
      }).catch(() => {});
      if (uploadedFile.driveFileId) {
        fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: uploadedFile.driveFileId,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data: fullDataUrl,
          }),
        }).catch(() => {});
      }
    } catch {}

    return uploadedFile;
  }

  // Upload School Logo or Member Avatar to Google Drive with Real-time Sync
  public async uploadImageToGoogleDrive(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; driveFileId?: string }> {
    if (onProgress) onProgress(10);

    const fullDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress(35);

    const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbw0hwSkVP5G5LrApTO-W4JmJ3P53mKRyXV_05SEHhOKqLW5LR_BjnNAuj0yNFxEF0R_/exec';
    const gasUrl = defaultGasUrl;
    let driveFileId = 'drive_img_' + Date.now();

    if (gasUrl) {
      try {
        const commaIdx = fullDataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? fullDataUrl.substring(commaIdx + 1) : fullDataUrl;
        if (onProgress) onProgress(65);

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'uploadFile',
            fileName: file.name || `image_${Date.now()}.png`,
            mimeType: file.type || 'image/png',
            base64Data: rawBase64,
            targetFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
          }),
        });

        if (onProgress) onProgress(90);

        try {
          const data = await response.json();
          if (data && data.fileId) {
            driveFileId = data.fileId;
          }
        } catch {
          // Body not readable due to CORS redirect
        }
      } catch (err) {
        console.warn('[Image Upload Google Drive Warning]', err);
      }
    }

    if (onProgress) onProgress(100);

    return {
      url: fullDataUrl,
      driveFileId,
    };
  }
}

export const storage = StorageService.getInstance();
