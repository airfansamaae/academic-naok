import React, { useEffect, useState, useRef } from 'react';
import { 
  Download, 
  X, 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  File, 
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { UploadedFile } from '../types';
import { triggerDirectDownload, storage } from '../services/storageService';
import { INITIAL_DOCUMENTS, INITIAL_SUBMISSIONS } from '../data/initialData';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import { parseDocxBinary, DocxParsedPage, DocxElement } from '../utils/docxParser';
import { getSafeGoogleDrivePreviewUrl } from '../utils/fileViewer';

/**
 * Helper to split text preview content into structured A4 pages
 * with exact margins, centered headings, and standard paragraph flow.
 */
function createA4PagesFromText(text: string, defaultTitle?: string): DocxParsedPage[] {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: DocxElement[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isTitle = 
      trimmed.startsWith('โครงสร้าง') || 
      trimmed.startsWith('รายงาน') || 
      trimmed.startsWith('คำสั่งโรงเรียน') ||
      trimmed.startsWith('แบบฟอร์ม') ||
      trimmed.startsWith('แบบบันทึก') ||
      trimmed.startsWith('เอกสารแผนการ');

    const isHeading = 
      /^\d+\./.test(trimmed) || 
      trimmed.startsWith('เรื่อง:') || 
      trimmed.startsWith('เรื่อง ') ||
      trimmed.startsWith('บทคัดย่อ:') ||
      trimmed.startsWith('หน่วยที่');

    elements.push({
      type: 'paragraph',
      align: isTitle ? 'center' : 'left',
      runs: [
        {
          text: trimmed,
          bold: isTitle || isHeading,
          fontSizePt: isTitle ? 18 : isHeading ? 15 : 13,
        }
      ]
    });
  }

  // Paginate into A4 pages (max 10-12 items per A4 sheet)
  const pages: DocxParsedPage[] = [];
  let currentPage: DocxParsedPage = { pageNumber: 1, elements: [] };
  const maxPerPage = 11;

  for (const el of elements) {
    currentPage.elements.push(el);
    if (currentPage.elements.length >= maxPerPage) {
      pages.push(currentPage);
      currentPage = { pageNumber: pages.length + 1, elements: [] };
    }
  }

  if (currentPage.elements.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}

export const DedicatedRawFileViewer: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [assignmentTitle, setAssignmentTitle] = useState<string>('');
  const [submitterName, setSubmitterName] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // A4 pagination state
  const [parsedPages, setParsedPages] = useState<DocxParsedPage[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [docxRenderMode, setDocxRenderMode] = useState<'a4-pages' | 'docx-preview'>('a4-pages');

  // Spreadsheet state
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<{ [sheet: string]: any[][] }>({});

  const docxContainerRef = useRef<HTMLDivElement>(null);

  // 1. Multi-tier resolution to guarantee authentic raw file is retrieved without fail
  useEffect(() => {
    let resolvedFile: UploadedFile | null = null;
    let resolvedTitle = '';
    let resolvedSubmitter = '';

    // Tier 1: Check window payload attached by opener
    if (typeof window !== 'undefined') {
      const winPayload = (window as any).__RAW_FILE_PAYLOAD__;
      if (winPayload?.file) {
        resolvedFile = winPayload.file;
        resolvedTitle = winPayload.assignmentTitle || '';
        resolvedSubmitter = winPayload.submitterName || '';
      }

      // Tier 2: Check window.opener memory reference
      if (!resolvedFile && window.opener) {
        try {
          const openerPayload = (window.opener as any).__LAST_ACTIVE_RAW_FILE__;
          if (openerPayload?.file) {
            resolvedFile = openerPayload.file;
            resolvedTitle = openerPayload.assignmentTitle || '';
            resolvedSubmitter = openerPayload.submitterName || '';
          }
        } catch {
          // ignore cross-origin opener
        }
      }

      // Tier 3: Check sessionStorage
      if (!resolvedFile) {
        try {
          const cachedSession = sessionStorage.getItem('academic_active_raw_file');
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession);
            if (parsed?.file) {
              resolvedFile = parsed.file;
              resolvedTitle = parsed.assignmentTitle || '';
              resolvedSubmitter = parsed.submitterName || '';
            }
          }
        } catch {
          // ignore
        }
      }

      // Tier 4: Check localStorage
      if (!resolvedFile) {
        try {
          const cachedLocal = localStorage.getItem('academic_active_raw_file');
          if (cachedLocal) {
            const parsed = JSON.parse(cachedLocal);
            if (parsed?.file) {
              resolvedFile = parsed.file;
              resolvedTitle = parsed.assignmentTitle || '';
              resolvedSubmitter = parsed.submitterName || '';
            }
          }
        } catch {
          // ignore
        }
      }

      // Tier 5: Check URL params with deep storage lookup
      if (!resolvedFile) {
        const params = new URLSearchParams(window.location.search);
        const fileId = params.get('file_id');
        const urlName = params.get('name');
        const urlMime = params.get('mime');
        resolvedTitle = params.get('title') || '';
        resolvedSubmitter = params.get('uploader') || '';

        if (fileId) {
          try {
            // Search in documents
            const docs = storage.getDocuments();
            const foundDoc = docs.find((d) => d.file?.id === fileId);
            if (foundDoc?.file) {
              resolvedFile = foundDoc.file;
              resolvedTitle = resolvedTitle || foundDoc.title || '';
              resolvedSubmitter = resolvedSubmitter || foundDoc.uploaderName || '';
            }

            // Search in submissions
            if (!resolvedFile) {
              const subs = storage.getSubmissions();
              for (const sub of subs) {
                const f = sub.files?.find((item) => item.id === fileId);
                if (f) {
                  resolvedFile = f;
                  resolvedTitle = resolvedTitle || sub.assignmentTitle || '';
                  resolvedSubmitter = resolvedSubmitter || sub.memberName || '';
                  break;
                }
              }
            }

            // Tier 6: Direct Initial Data seeds lookup
            if (!resolvedFile) {
              const initDoc = INITIAL_DOCUMENTS.find((d) => d.file?.id === fileId);
              if (initDoc?.file) {
                resolvedFile = initDoc.file;
                resolvedTitle = resolvedTitle || initDoc.title || '';
                resolvedSubmitter = resolvedSubmitter || initDoc.uploaderName || '';
              }
            }

            if (!resolvedFile) {
              for (const sub of INITIAL_SUBMISSIONS) {
                const f = sub.files?.find((item) => item.id === fileId);
                if (f) {
                  resolvedFile = f;
                  resolvedTitle = resolvedTitle || sub.assignmentTitle || '';
                  resolvedSubmitter = resolvedSubmitter || sub.memberName || '';
                  break;
                }
              }
            }
          } catch (storageErr) {
            console.warn('[DedicatedRawFileViewer] Storage lookup error:', storageErr);
          }
        }

        // Tier 7: If fileId not found in storage, but urlName exists
        if (!resolvedFile && urlName) {
          const lower = urlName.toLowerCase();
          const pType: UploadedFile['previewType'] = 
            lower.endsWith('.pdf') ? 'pdf' :
            lower.endsWith('.docx') || lower.endsWith('.doc') ? 'doc' :
            lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'spreadsheet' :
            lower.match(/\.(png|jpg|jpeg|gif|webp)$/) ? 'image' : 'other';

          resolvedFile = {
            id: fileId || 'url-file',
            name: urlName,
            size: 1024 * 1024,
            mimeType: urlMime || 'application/octet-stream',
            driveFileId: '',
            downloadUrl: '',
            viewUrl: '',
            previewType: pType,
            uploadedAt: new Date().toISOString(),
          };
        }
      }
    }

    if (resolvedFile) {
      setFile(resolvedFile);
      if (resolvedTitle) setAssignmentTitle(resolvedTitle);
      if (resolvedSubmitter) setSubmitterName(resolvedSubmitter);
    } else {
      setError('ไม่พบข้อมูลไฟล์ต้นฉบับที่ต้องการเปิด กรุณากลับไปที่หน้าหลักแล้วลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }, []);

  // 2. Process authentic raw binary data and parse into A4 pages
  useEffect(() => {
    if (!file) return;

    let currentBlobUrl: string | null = null;

    const processFile = async () => {
      setLoading(true);
      setError(null);

      try {
        let rawBase64 = '';
        let mimeType = file.mimeType || 'application/octet-stream';

        if (file.fileDataUrl) {
          if (file.fileDataUrl.startsWith('data:')) {
            const parts = file.fileDataUrl.split(';base64,');
            mimeType = parts[0].replace('data:', '') || mimeType;
            rawBase64 = parts[1] || '';
          } else {
            rawBase64 = file.fileDataUrl;
          }
        }

        const lower = (file.name || '').toLowerCase();
        const isDocx = lower.endsWith('.docx') || mimeType.includes('wordprocessingml') || file.previewType === 'doc';
        const isSheet = lower.endsWith('.xlsx') || lower.endsWith('.xls') || mimeType.includes('spreadsheetml') || mimeType.includes('excel') || file.previewType === 'spreadsheet';
        const isPdf = lower.endsWith('.pdf') || mimeType === 'application/pdf' || file.previewType === 'pdf';

        if (rawBase64) {
          const binaryString = atob(rawBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;

          const blob = new Blob([bytes], { type: mimeType });
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);

          // Render Word Document (.docx) - Authentic A4 Pagination
          if (isDocx) {
            try {
              // Parse directly into authentic A4 pages using our custom parser
              const result = await parseDocxBinary(arrayBuffer);
              if (result && result.pages && result.pages.length > 0) {
                setParsedPages(result.pages);
              } else if (file.previewContent) {
                const textPages = createA4PagesFromText(file.previewContent, file.name);
                setParsedPages(textPages);
              }
            } catch (pErr) {
              console.warn('[DedicatedRawFileViewer] parseDocxBinary error, checking previewContent:', pErr);
              if (file.previewContent) {
                setParsedPages(createA4PagesFromText(file.previewContent, file.name));
              }
            }

            // Also render with docx-preview as secondary DOM container
            if (docxContainerRef.current) {
              docxContainerRef.current.innerHTML = '';
              try {
                await renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
                  className: 'docx-page-canvas',
                  inWrapper: true,
                  ignoreWidth: false,
                  ignoreHeight: false,
                  breakPages: true
                });
              } catch (renderErr) {
                console.warn('[DedicatedRawFileViewer] docx-preview renderAsync failed:', renderErr);
              }
            }
          } else if (isSheet) {
            // Render Excel Spreadsheet (.xlsx / .xls)
            try {
              const workbook = XLSX.read(arrayBuffer, { type: 'array' });
              const sheetsMap: { [sheet: string]: any[][] } = {};
              workbook.SheetNames.forEach((name) => {
                const sheet = workbook.Sheets[name];
                sheetsMap[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
              });
              setSheetNames(workbook.SheetNames);
              setSheetData(sheetsMap);
              if (workbook.SheetNames.length > 0) {
                setActiveSheet(workbook.SheetNames[0]);
              }
            } catch (sheetErr) {
              console.warn('[DedicatedRawFileViewer] XLSX read failed:', sheetErr);
            }
          } else if (isPdf && file.previewContent) {
            // Provide A4 pages from text content alongside the native PDF
            setParsedPages(createA4PagesFromText(file.previewContent, file.name));
          }
        } else if (file.previewContent) {
          // If no raw base64 but previewContent exists (e.g. text documents)
          setParsedPages(createA4PagesFromText(file.previewContent, file.name));
        } else if (file.viewUrl || file.driveFileId) {
          // Clean Google Drive preview URL with minimal parameters (NEVER Google Docs Viewer)
          const safeUrl = getSafeGoogleDrivePreviewUrl(file);
          setBlobUrl(safeUrl || file.viewUrl || null);
        } else {
          setError('ไฟล์นี้ไม่มีข้อมูลไบนารีต้นฉบับในหน่วยความจำ');
        }
      } catch (err: any) {
        console.error('[DedicatedRawFileViewer] Error parsing raw file:', err);
        setError('ไม่สามารถประมวลผลไฟล์ต้นฉบับได้: ' + (err?.message || ''));
      } finally {
        setLoading(false);
      }
    };

    processFile();

    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [file]);

  const lowerName = (file?.name || '').toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || file?.mimeType === 'application/pdf' || file?.previewType === 'pdf';
  const isDocx = lowerName.endsWith('.docx') || file?.previewType === 'doc' || (file?.mimeType && file.mimeType.includes('word'));
  const isSheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || file?.previewType === 'spreadsheet' || (file?.mimeType && file.mimeType.includes('spreadsheet'));
  const isImage = lowerName.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || file?.previewType === 'image' || (file?.mimeType && file.mimeType.includes('image'));

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* INJECTED STYLES FOR AUTHENTIC A4 SIZING & DOCX-PREVIEW PAGINATION */}
      <style>{`
        /* Authentic A4 Dimensions: 210mm × 297mm */
        .a4-page-sheet {
          width: 210mm !important;
          max-width: 100% !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: 'TH Sarabun New', 'Sarabun', Tahoma, -apple-system, BlinkMacSystemFont, sans-serif !important;
          box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
        }

        /* docx-preview wrapper styling to enforce A4 pagination */
        .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
        }
        .docx-wrapper > section.docx {
          width: 210mm !important;
          max-width: 100% !important;
          min-height: 297mm !important;
          padding: 25.4mm 20mm !important;
          margin: 32px auto !important;
          background: white !important;
          color: #0f172a !important;
          box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
          box-sizing: border-box !important;
          position: relative !important;
          font-family: 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif !important;
          line-height: 1.6 !important;
        }
      `}</style>

      {/* HEADER BAR - Single download button, close button, zoom controls (STRICT: NO printer, NO copy, NO Google Docs Viewer) */}
      <header className="h-16 shrink-0 bg-slate-900/95 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 z-20 shadow-md backdrop-blur-md">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80 shrink-0 shadow-inner">
            {isPdf && <FileText className="w-5 h-5 text-rose-400" />}
            {isDocx && <FileText className="w-5 h-5 text-blue-400" />}
            {isSheet && <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
            {isImage && <FileImage className="w-5 h-5 text-amber-400" />}
            {!isPdf && !isDocx && !isSheet && !isImage && <File className="w-5 h-5 text-purple-400" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[240px] sm:max-w-md lg:max-w-lg">
                {file?.name || 'กำลังเปิดไฟล์ต้นฉบับ...'}
              </h1>
              {parsedPages.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/50 shrink-0">
                  ขนาด A4 ({parsedPages.length} หน้า)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate mt-0.5">
              {file?.size ? (
                <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ไฟล์ต้นฉบับแท้
              </span>
              {submitterName && (
                <span className="hidden md:inline text-slate-400 border-l border-slate-700 pl-2">
                  ผู้ส่ง: {submitterName}
                </span>
              )}
              {assignmentTitle && (
                <span className="hidden lg:inline text-slate-400 border-l border-slate-700 pl-2">
                  {assignmentTitle}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: Zoom & View Controls (for A4 pages) */}
        <div className="flex items-center gap-2">
          {(isDocx || parsedPages.length > 0) && (
            <div className="hidden sm:flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(60, prev - 15))}
                title="ย่อขนาด"
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-medium text-slate-300 px-1 min-w-[42px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(150, prev + 15))}
                title="ขยายขนาด"
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="ขนาด A4 พอดี (100%)"
                className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                100% A4
              </button>
            </div>
          )}

          {/* Action Buttons: ONLY ONE Green Download Button & Close Window (STRICT: NO printer, NO copy, NO duplicate buttons) */}
          {file && (
            <button
              type="button"
              id="btn-single-download"
              onClick={() => triggerDirectDownload(file)}
              title="ดาวน์โหลดไฟล์ต้นฉบับ (1 คลิก)"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
            </button>
          )}

          <button
            type="button"
            id="btn-close-window"
            onClick={() => window.close()}
            title="ปิดหน้าต่างนี้"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">ปิดหน้าต่าง</span>
          </button>
        </div>
      </header>

      {/* VIEWER CANVAS - Authentic Raw Original File Display */}
      <main className="flex-1 relative overflow-hidden bg-slate-950 flex flex-col">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-30 gap-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-300">กำลังเปิดอ่านไฟล์ต้นฉบับแท้...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1">ไม่สามารถแสดงตัวอย่างไฟล์ได้</h2>
            <p className="text-sm text-slate-400 max-w-md mb-4">{error}</p>
            {file && (
              <button
                type="button"
                onClick={() => triggerDirectDownload(file)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์แทน</span>
              </button>
            )}
          </div>
        )}

        {!error && file && (
          <>
            {/* 1. AUTHENTIC A4 PAGINATED VIEWER FOR WORD DOCX AND TEXT DOCUMENTS */}
            {isDocx && (
              <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col items-center py-8 px-4 sm:px-8">
                {/* Mode Selector Pill */}
                <div className="mb-6 flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs select-none shadow-sm">
                  <button
                    type="button"
                    onClick={() => setDocxRenderMode('a4-pages')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      docxRenderMode === 'a4-pages'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>การจัดหน้า A4 (แบ่งหน้าชัดเจน)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocxRenderMode('docx-preview')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      docxRenderMode === 'docx-preview'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>มุมมองเค้าโครงเดิม (docx-preview)</span>
                  </button>
                </div>

                {/* Primary Mode: Authentic A4 Sheets with clear page break dividers and exact spacing */}
                {docxRenderMode === 'a4-pages' && parsedPages.length > 0 && (
                  <div 
                    className="flex flex-col items-center w-full transition-transform duration-150 origin-top"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  >
                    {parsedPages.map((page, pageIdx) => (
                      <React.Fragment key={page.pageNumber || pageIdx}>
                        {/* A4 Sheet */}
                        <div 
                          className="a4-page-sheet rounded-xs p-10 sm:p-14 flex flex-col justify-between select-text relative"
                          style={{ minHeight: '297mm' }}
                        >
                          {/* Official Top Watermark / Reference Header */}
                          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-[11px] text-slate-500 select-none">
                            <span className="font-semibold text-slate-700 truncate max-w-[380px]">
                              {assignmentTitle || file.name}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              เอกสารทางวิชาการ • ฉบับจริง
                            </span>
                          </div>

                          {/* Page Content Body */}
                          <div className="flex-1 space-y-3.5 text-slate-900 leading-relaxed text-sm sm:text-base">
                            {page.elements.map((el, elIdx) => {
                              if (el.type === 'paragraph') {
                                const isCenter = el.align === 'center';
                                const isRight = el.align === 'right';
                                const alignClass = isCenter ? 'text-center' : isRight ? 'text-right' : 'text-left';

                                return (
                                  <p 
                                    key={elIdx} 
                                    className={`${alignClass} ${!isCenter && !isRight ? 'indent-8' : ''} leading-relaxed`}
                                  >
                                    {el.runs.map((run, rIdx) => {
                                      const style: React.CSSProperties = {};
                                      if (run.bold) style.fontWeight = 'bold';
                                      if (run.italic) style.fontStyle = 'italic';
                                      if (run.underline) style.textDecoration = 'underline';
                                      if (run.color) style.color = run.color;
                                      if (run.fontSizePt) style.fontSize = `${run.fontSizePt * 1.15}px`;

                                      return (
                                        <span key={rIdx} style={style}>
                                          {run.text}
                                        </span>
                                      );
                                    })}
                                  </p>
                                );
                              }

                              if (el.type === 'table') {
                                return (
                                  <div key={elIdx} className="my-4 overflow-x-auto">
                                    <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm">
                                      <tbody>
                                        {el.rows.map((row, rIdx) => (
                                          <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 font-bold' : ''}>
                                            {row.map((cellText, cIdx) => (
                                              <td 
                                                key={cIdx} 
                                                className="border border-slate-400 p-2.5 align-top text-slate-800"
                                              >
                                                {cellText}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              }

                              if (el.type === 'image' && el.dataUrl) {
                                return (
                                  <div key={elIdx} className="my-3 flex justify-center">
                                    <img 
                                      src={el.dataUrl} 
                                      alt="เอกสารแนบ" 
                                      className="max-w-full max-h-[350px] object-contain border border-slate-300 rounded shadow-xs" 
                                    />
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>

                          {/* Authentic A4 Page Footer with Page Number */}
                          <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 select-none">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.)
                            </span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                              หน้า {page.pageNumber || pageIdx + 1} จาก {parsedPages.length}
                            </span>
                          </div>
                        </div>

                        {/* DISTINCT A4 PAGE SEPARATOR BAR BETWEEN PAGES (มีที่คั่นหรือเว้น ขนาด A4 ชัดเจน) */}
                        {pageIdx < parsedPages.length - 1 && (
                          <div className="w-full max-w-[210mm] my-8 flex items-center justify-center gap-3 select-none">
                            <div className="h-px bg-slate-700/60 flex-1" />
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-slate-300 shadow-md">
                              <FileText className="w-3.5 h-3.5 text-purple-400" />
                              <span>ที่คั่นแบ่งหน้า • สิ้นสุดหน้า {page.pageNumber || pageIdx + 1} (ขนาด A4 210 × 297 มม.)</span>
                            </div>
                            <div className="h-px bg-slate-700/60 flex-1" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Secondary Mode: Standard docx-preview wrapper */}
                <div 
                  className={`w-full flex justify-center ${docxRenderMode === 'docx-preview' ? 'block' : 'hidden'}`}
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  <div 
                    ref={docxContainerRef}
                    className="docx-render-wrapper w-full flex flex-col items-center select-text"
                  />
                </div>
              </div>
            )}

            {/* 2. AUTHENTIC PDF VIEWER (Standardized A4 container with CSS margin/padding, toolbar=0 to disable chrome) */}
            {isPdf && blobUrl && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center bg-slate-950">
                <div 
                  className="w-full max-w-[210mm] transition-transform duration-150 origin-top flex flex-col items-center"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  <div 
                    className="a4-raw-embed-container"
                    style={{
                      width: '210mm',
                      maxWidth: '100%',
                      height: '297mm',
                      minHeight: '297mm',
                      margin: '24px auto',
                      padding: 0,
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 10px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <object
                      data={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      type="application/pdf"
                      className="w-full h-full border-0"
                    >
                      <iframe
                        src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                        className="w-full h-full border-0 bg-white"
                        title={file.name}
                      />
                    </object>
                  </div>
                </div>
              </div>
            )}

            {/* 3. EXCEL / SPREADSHEET VIEWER: Authentic workbook renderer */}
            {isSheet && (
              <div className="flex-1 flex flex-col overflow-hidden bg-white text-slate-900">
                {/* Sheet Tabs Bar */}
                {sheetNames.length > 1 && (
                  <div className="h-10 bg-slate-100 border-b border-slate-300 px-4 flex items-center gap-1 overflow-x-auto shrink-0">
                    {sheetNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setActiveSheet(name)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors cursor-pointer whitespace-nowrap ${
                          activeSheet === name 
                            ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs' 
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Spreadsheet Grid */}
                <div className="flex-1 overflow-auto p-2 bg-slate-50">
                  {activeSheet && sheetData[activeSheet] && sheetData[activeSheet].length > 0 ? (
                    <div className="inline-block min-w-full align-middle bg-white border border-slate-300 shadow-xs rounded">
                      <table className="min-w-full divide-y divide-slate-200 text-xs text-left border-collapse select-text">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                          <tr>
                            <th className="px-2.5 py-2 border-r border-b border-slate-300 bg-slate-200 text-slate-500 font-mono text-[11px] text-center w-12">
                              #
                            </th>
                            {sheetData[activeSheet][0]?.map((_: any, colIdx: number) => (
                              <th 
                                key={colIdx} 
                                className="px-3 py-2 border-r border-b border-slate-300 text-slate-700 font-bold bg-slate-100 text-center min-w-[80px]"
                              >
                                {String.fromCharCode(65 + colIdx)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sheetData[activeSheet].map((row, rowIdx) => (
                            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-2 py-1.5 border-r border-slate-200 text-slate-400 font-mono text-[10px] text-center bg-slate-100">
                                {rowIdx + 1}
                              </td>
                              {row.map((cell: any, colIdx: number) => (
                                <td 
                                  key={colIdx} 
                                  className="px-3 py-1.5 border-r border-slate-200 text-slate-800 whitespace-nowrap text-xs"
                                >
                                  {cell !== null && cell !== undefined ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      ไม่มีข้อมูลตารางในชีตนี้
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. IMAGE VIEWER: Standardized A4 container with CSS margin/padding */}
            {isImage && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center bg-slate-950">
                <div 
                  className="w-full max-w-[210mm] transition-transform duration-150 origin-top flex flex-col items-center"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  <div 
                    className="a4-page-sheet rounded-xs flex flex-col justify-between select-none relative"
                    style={{
                      width: '210mm',
                      maxWidth: '100%',
                      minHeight: '297mm',
                      margin: '24px auto',
                      padding: '25.4mm 20mm',
                      boxSizing: 'border-box',
                      background: '#ffffff',
                      boxShadow: '0 10px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700 truncate max-w-[380px]">
                        {assignmentTitle || file.name}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        ภาพแนบฉบับจริง • มาตรฐาน A4
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4">
                      <img
                        src={file.fileDataUrl || blobUrl || ''}
                        alt={file.name}
                        className="max-w-full max-h-[200mm] object-contain rounded shadow-sm border border-slate-200"
                      />
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.)
                      </span>
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                        หน้า 1 / 1
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. OTHER FILE TYPES: Paginated A4 or Fallback Preview */}
            {!isPdf && !isDocx && !isSheet && !isImage && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-slate-950">
                {parsedPages.length > 0 ? (
                  <div 
                    className="flex flex-col items-center w-full transition-transform duration-150 origin-top"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  >
                    {parsedPages.map((page, pageIdx) => (
                      <React.Fragment key={pageIdx}>
                        <div 
                          className="a4-page-sheet rounded-xs p-10 sm:p-14 flex flex-col justify-between select-text relative"
                          style={{ minHeight: '297mm' }}
                        >
                          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-[11px] text-slate-500 select-none">
                            <span className="font-semibold text-slate-700 truncate max-w-[380px]">
                              {assignmentTitle || file.name}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              เอกสารทางวิชาการ • ฉบับจริง
                            </span>
                          </div>

                          <div className="flex-1 space-y-3 text-slate-900 leading-relaxed">
                            {page.elements.map((el, elIdx) => (
                              <p 
                                key={elIdx} 
                                className={`${el.type === 'paragraph' && el.align === 'center' ? 'text-center' : 'text-left indent-8'} leading-relaxed`}
                              >
                                {el.type === 'paragraph' && el.runs.map((r, rIdx) => (
                                  <span 
                                    key={rIdx} 
                                    style={{ 
                                      fontWeight: r.bold ? 'bold' : 'normal',
                                      fontSize: r.fontSizePt ? `${r.fontSizePt * 1.15}px` : undefined
                                    }}
                                  >
                                    {r.text}
                                  </span>
                                ))}
                              </p>
                            ))}
                          </div>

                          <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 select-none">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.)
                            </span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                              หน้า {pageIdx + 1} จาก {parsedPages.length}
                            </span>
                          </div>
                        </div>

                        {pageIdx < parsedPages.length - 1 && (
                          <div className="w-full max-w-[210mm] my-8 flex items-center justify-center gap-3 select-none">
                            <div className="h-px bg-slate-700/60 flex-1" />
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-slate-300 shadow-md">
                              <FileText className="w-3.5 h-3.5 text-purple-400" />
                              <span>ที่คั่นแบ่งหน้า • สิ้นสุดหน้า {pageIdx + 1} (ขนาด A4 210 × 297 มม.)</span>
                            </div>
                            <div className="h-px bg-slate-700/60 flex-1" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 select-text">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
                      <File className="w-8 h-8 text-purple-400 shrink-0" />
                      <div>
                        <h2 className="text-base font-bold text-white">{file.name}</h2>
                        <p className="text-xs text-slate-400">ประเภท: {file.mimeType || 'ไม่ระบุ'}</p>
                      </div>
                    </div>
                    {file.previewContent ? (
                      <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800/80 leading-relaxed overflow-x-auto">
                        {file.previewContent}
                      </pre>
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-sm text-slate-400 mb-4">ไฟล์ต้นฉบับพร้อมสำหรับการดาวน์โหลดเพื่อเปิดในแอปพลิเคชันของคุณ</p>
                        <button
                          type="button"
                          onClick={() => triggerDirectDownload(file)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
