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
  Maximize2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Eye
} from 'lucide-react';
import { UploadedFile } from '../types';
import { triggerDirectDownload, storage } from '../services/storageService';
import { INITIAL_DOCUMENTS, INITIAL_SUBMISSIONS } from '../data/initialData';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import { parseDocxBinary, DocxParsedPage, DocxElement } from '../utils/docxParser';
import { getSafeGoogleDrivePreviewUrl, openAuthenticFileInNewTab } from '../utils/fileViewer';
import { getActivePreviewFromIndexedDb, getFileFromIndexedDb } from '../utils/indexedFileStore';

/**
 * Enhanced helper to split text preview content into structured A4 pages
 * with exact margins, centered headings, authentic paragraph flow,
 * and automatic parsing of embedded tables (| col 1 | col 2 |).
 */
function createA4PagesFromText(text: string, defaultTitle?: string): DocxParsedPage[] {
  const effectiveText = text || '';
  if (!effectiveText.trim()) return [];

  const rawLines = effectiveText
    .split('\n')
    .filter(l => {
      const trimmed = l.trim();
      return !trimmed.startsWith('Google Drive File ID:') &&
             !trimmed.startsWith('จัดเก็บในโฟลเดอร์หลัก ID:') &&
             !trimmed.startsWith('ขนาดไฟล์: ') &&
             !trimmed.includes('อัปโหลดเข้าสู่ Google Drive Folder ID:') &&
             !trimmed.includes('เอกสารนี้ได้รับการจัดเก็บอย่างปลอดภัย');
    })
    .map(l => {
      return l
        .replace(/\[ไฟล์ที่จัดเก็บบน Google Drive\]:\s*/g, '')
        .replace(/\[ไฟล์ที่เลือกเตรียมส่ง\]:\s*/g, '')
        .replace(/\[เนื้อหาของไฟล์:\s*[^\]]+\]/g, '');
    });
  const elements: DocxElement[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if table row (e.g. '| col 1 | col 2 |' or separated by tabs)
    if (line.startsWith('|') || (line.includes('|') && line.split('|').length >= 3) || line.includes('\t')) {
      const stringRows: string[][] = [];
      const structuredRows: any[] = [];
      while (i < rawLines.length) {
        const curLine = rawLines[i].trim();
        if (!curLine) break;
        // Check if markdown separator line like |---|---|
        if (/^\|?(\s*:?-+:?\s*\|)+\s*$/.test(curLine)) {
          i++;
          continue;
        }
        if (curLine.includes('|') || curLine.includes('\t')) {
          const cells = curLine.includes('|')
            ? curLine.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - (curLine.endsWith('|') ? 1 : 0) ? true : c.length > 0)
            : curLine.split('\t').map(c => c.trim());
          if (cells.length > 0) {
            const isHeader = structuredRows.length === 0;
            stringRows.push(cells);
            structuredRows.push({
              isHeader,
              cells: cells.map((c, cIdx) => ({
                text: c,
                align: isHeader ? 'center' : cIdx === 0 ? 'left' : 'left',
                bgColor: isHeader ? '#F1F5F9' : undefined,
                bold: isHeader || (cIdx === 0 && !isHeader),
                fontSizePt: isHeader ? 14 : 13,
                runs: [{ text: c, bold: isHeader || (cIdx === 0 && !isHeader) }]
              }))
            });
          }
          i++;
        } else {
          break;
        }
      }
      if (stringRows.length > 0) {
        elements.push({
          type: 'table',
          rows: stringRows,
          tableRows: structuredRows,
          borderColors: {
            outer: '#475569',
            inner: '#94A3B8'
          }
        });
      }
      continue;
    }

    // Normal paragraph
    const isTitle = 
      line.startsWith('โครงสร้าง') || 
      line.startsWith('รายงาน') || 
      line.startsWith('คำสั่งโรงเรียน') ||
      line.startsWith('แบบฟอร์ม') ||
      line.startsWith('แบบบันทึก') ||
      line.startsWith('เอกสารแผนการ') ||
      line.startsWith('แผนการจัดการเรียนรู้') ||
      line.startsWith('แบบประเมิน');

    const isHeading = 
      /^\d+\./.test(line) || 
      line.startsWith('เรื่อง:') || 
      line.startsWith('เรื่อง ') ||
      line.startsWith('บทคัดย่อ:') ||
      line.startsWith('หน่วยที่') ||
      line.startsWith('มาตรฐาน') ||
      line.startsWith('ตัวชี้วัด') ||
      line.startsWith('จุดประสงค์') ||
      line.startsWith('สาระสำคัญ');

    const hasIndent = rawLines[i].startsWith('\t') || rawLines[i].startsWith('    ') || rawLines[i].startsWith('   ');

    elements.push({
      type: 'paragraph',
      align: isTitle ? 'center' : 'left',
      isIndented: hasIndent,
      runs: [
        {
          text: line,
          bold: isTitle || isHeading,
          fontSizePt: isTitle ? 20 : isHeading ? 18 : 16,
        }
      ]
    });
    i++;
  }

  // If elements is empty, return empty list
  if (elements.length === 0) {
    if (defaultTitle) {
      elements.push({
        type: 'paragraph',
        align: 'center',
        isIndented: false,
        runs: [{ text: defaultTitle, bold: true, fontSizePt: 18 }]
      });
    } else {
      return [];
    }
  }

  // Paginate into realistic A4 pages (~10-12 elements per A4 page, tables count based on rows)
  const pages: DocxParsedPage[] = [];
  let currentPage: DocxParsedPage = { pageNumber: 1, elements: [] };
  let currentCost = 0;
  const maxCostPerPage = 12;

  for (const el of elements) {
    const cost = el.type === 'table' ? Math.max(3, el.rows.length) : 1;
    if (currentCost + cost > maxCostPerPage && currentPage.elements.length > 0) {
      pages.push(currentPage);
      currentPage = { pageNumber: pages.length + 1, elements: [] };
      currentCost = 0;
    }
    currentPage.elements.push(el);
    currentCost += cost;
  }

  if (currentPage.elements.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}

export interface DedicatedRawFileViewerProps {
  initialFile?: UploadedFile | null;
  initialTitle?: string;
  initialSubmitter?: string;
  onClose?: () => void;
  isModalMode?: boolean;
}

export const DedicatedRawFileViewer: React.FC<DedicatedRawFileViewerProps> = ({
  initialFile,
  initialTitle,
  initialSubmitter,
  onClose,
  isModalMode = false
}) => {
  const [file, setFile] = useState<UploadedFile | null>(initialFile || null);
  const [assignmentTitle, setAssignmentTitle] = useState<string>(initialTitle || '');
  const [submitterName, setSubmitterName] = useState<string>(initialSubmitter || '');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // A4 pagination & Word doc state
  const [parsedPages, setParsedPages] = useState<DocxParsedPage[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [docxArrayBuffer, setDocxArrayBuffer] = useState<ArrayBuffer | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Scroll Page Tracking (เมื่อเลื่อนลงมา ก็จะมีหน้าให้เห็นว่า อยู่หน้าที่เท่าไร)
  const [currentPageInView, setCurrentPageInView] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageDomMap = useRef<Map<number, HTMLDivElement>>(new Map());

  // Spreadsheet state
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<{ [sheet: string]: any[][] }>({});

  // Register page ref for scroll tracking
  const registerPageRef = (pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageDomMap.current.set(pageNum, el);
    } else {
      pageDomMap.current.delete(pageNum);
    }
  };

  // Scroll listener to update active page as user scrolls down
  const handleContainerScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const triggerPoint = containerRect.top + 180; // 180px below container top

    let activePage = 1;
    pageDomMap.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= triggerPoint && rect.bottom >= containerRect.top) {
        activePage = pageNum;
      }
    });

    setCurrentPageInView(activePage);
  };

  const scrollToPage = (pageNum: number) => {
    const targetEl = pageDomMap.current.get(pageNum);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPageInView(pageNum);
    }
  };

  // 1. Multi-tier resolution to guarantee authentic raw file is retrieved without fail
  useEffect(() => {
    let isCancelled = false;

    const resolveFile = async () => {
      if (initialFile) {
        let activeFile = initialFile;
        if (!activeFile.fileDataUrl && activeFile.id) {
          try {
            const idbRecord = await getFileFromIndexedDb(activeFile.id);
            if (idbRecord?.dataUrl) {
              activeFile = { ...activeFile, fileDataUrl: idbRecord.dataUrl };
            }
          } catch {}
        }
        if (!isCancelled) {
          setFile(activeFile);
          if (initialTitle) setAssignmentTitle(initialTitle);
          if (initialSubmitter) setSubmitterName(initialSubmitter);
        }
        return;
      }

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

        // Tier 5: Check IndexedDB active preview
        if (!resolvedFile) {
          try {
            const idbPayload = await getActivePreviewFromIndexedDb();
            if (idbPayload?.file) {
              resolvedFile = idbPayload.file;
              resolvedTitle = idbPayload.assignmentTitle || '';
              resolvedSubmitter = idbPayload.submitterName || '';
            }
          } catch (e) {
            console.warn('[DedicatedRawFileViewer] IDB active preview lookup:', e);
          }
        }

        // Tier 6: Check URL params with deep storage & IndexedDB lookup
        if (!resolvedFile) {
          const params = new URLSearchParams(window.location.search);
          const fileId = params.get('file_id');
          const urlName = params.get('name');
          const urlMime = params.get('mime');
          resolvedTitle = params.get('title') || '';
          resolvedSubmitter = params.get('uploader') || '';

          if (fileId) {
            // Check IndexedDB by fileId first
            try {
              const idbFile = await getFileFromIndexedDb(fileId);
              if (idbFile) {
                const fileName = idbFile.metadata?.name || urlName || 'document';
                const lowerFileName = fileName.toLowerCase();
                const guessedPreviewType = lowerFileName.endsWith('.pdf')
                  ? 'pdf'
                  : lowerFileName.match(/\.(xlsx|xls)$/)
                  ? 'spreadsheet'
                  : lowerFileName.match(/\.(png|jpg|jpeg|webp)$/)
                  ? 'image'
                  : 'doc';

                resolvedFile = {
                  id: fileId,
                  name: fileName,
                  size: idbFile.metadata?.size || 1024 * 1024,
                  mimeType: idbFile.metadata?.mimeType || urlMime || 'application/octet-stream',
                  driveFileId: '',
                  downloadUrl: '',
                  viewUrl: '',
                  previewType: guessedPreviewType,
                  fileDataUrl: idbFile.dataUrl,
                  uploadedAt: new Date().toISOString(),
                };
              }
            } catch (e) {
              console.warn('[DedicatedRawFileViewer] IDB lookup error:', e);
            }

            if (!resolvedFile) {
              try {
                // Search in documents
                const docs = storage.getDocuments();
                const foundDoc = docs.find((d) => d.file?.id === fileId || d.id === fileId);
                if (foundDoc?.file) {
                  resolvedFile = foundDoc.file;
                  if (!resolvedTitle) resolvedTitle = foundDoc.title;
                  if (!resolvedSubmitter) resolvedSubmitter = foundDoc.uploaderName;
                }

                // Search in submissions
                if (!resolvedFile) {
                  const subs = storage.getSubmissions();
                  for (const sub of subs) {
                    const found = sub.files.find((f) => f.id === fileId);
                    if (found) {
                      resolvedFile = found;
                      if (!resolvedTitle) resolvedTitle = sub.assignmentTitle;
                      if (!resolvedSubmitter) resolvedSubmitter = sub.memberName;
                      break;
                    }
                  }
                }

                // Search in INITIAL_DOCUMENTS
                if (!resolvedFile) {
                  const initDoc = INITIAL_DOCUMENTS.find((d) => d.file?.id === fileId || d.id === fileId);
                  if (initDoc?.file) {
                    resolvedFile = initDoc.file;
                    if (!resolvedTitle) resolvedTitle = initDoc.title;
                    if (!resolvedSubmitter) resolvedSubmitter = initDoc.uploaderName;
                  }
                }

                // Search in INITIAL_SUBMISSIONS
                if (!resolvedFile) {
                  for (const sub of INITIAL_SUBMISSIONS) {
                    const found = sub.files.find((f) => f.id === fileId);
                    if (found) {
                      resolvedFile = found;
                      if (!resolvedTitle) resolvedTitle = sub.assignmentTitle;
                      if (!resolvedSubmitter) resolvedSubmitter = sub.memberName;
                      break;
                    }
                  }
                }
              } catch (e) {
                console.warn('[DedicatedRawFileViewer] storage lookup error:', e);
              }
            }
          }

          // Tier 7: Construct minimal UploadedFile from URL parameters if available
          if (!resolvedFile && urlName) {
            const pType = params.get('preview_type') as any || 'other';
            const driveId = params.get('drive_id') || '';
            resolvedFile = {
              id: fileId || 'url-resolved-file',
              name: urlName,
              size: 1024 * 1024,
              mimeType: urlMime || 'application/octet-stream',
              driveFileId: driveId,
              downloadUrl: driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : '',
              viewUrl: driveId ? `https://drive.google.com/file/d/${driveId}/view` : '',
              previewType: pType,
              uploadedAt: new Date().toISOString(),
            };
          }
        }
      }

      // If resolved file is missing binary dataUrl, check IndexedDB & Server endpoint for binary
      if (resolvedFile && !resolvedFile.fileDataUrl) {
        if (resolvedFile.id) {
          try {
            const idbRecord = await getFileFromIndexedDb(resolvedFile.id);
            if (idbRecord?.dataUrl) {
              resolvedFile = { ...resolvedFile, fileDataUrl: idbRecord.dataUrl };
            }
          } catch {}
        }
        if (!resolvedFile.fileDataUrl) {
          const fetchId = resolvedFile.id || resolvedFile.driveFileId;
          if (fetchId) {
            try {
              const res = await fetch(`/api/files/data/${encodeURIComponent(fetchId)}?name=${encodeURIComponent(resolvedFile.name)}`);
              if (res.ok) {
                const dataJson = await res.json();
                if (dataJson?.dataUrl || dataJson?.base64Data) {
                  resolvedFile = {
                    ...resolvedFile,
                    fileDataUrl: dataJson.dataUrl || `data:${dataJson.mimeType || 'application/octet-stream'};base64,${dataJson.base64Data}`,
                    mimeType: dataJson.mimeType || resolvedFile.mimeType,
                  };
                }
              }
            } catch {}
          }
        }
      }

      if (isCancelled) return;

      if (resolvedFile) {
        setFile(resolvedFile);
        if (resolvedTitle) setAssignmentTitle(resolvedTitle);
        if (resolvedSubmitter) setSubmitterName(resolvedSubmitter);
      } else {
        setError('ไม่พบข้อมูลไฟล์ต้นฉบับที่ต้องการเปิด กรุณากลับไปที่หน้าหลักแล้วลองใหม่อีกครั้ง');
        setLoading(false);
      }
    };

    resolveFile();

    return () => {
      isCancelled = true;
    };
  }, [initialFile, initialTitle, initialSubmitter]);

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

        // If rawBase64 is still missing, fetch from server endpoints
        if (!rawBase64 && (file.id || file.driveFileId)) {
          const fetchId = file.id || file.driveFileId;
          if (fetchId) {
            try {
              const res = await fetch(`/api/files/data/${encodeURIComponent(fetchId)}?name=${encodeURIComponent(file.name)}`);
              if (res.ok) {
                const dataJson = await res.json();
                if (dataJson?.base64Data) {
                  rawBase64 = dataJson.base64Data;
                  if (dataJson.mimeType) mimeType = dataJson.mimeType;
                }
              }
            } catch {}
          }
          if (!rawBase64 && file.driveFileId && file.driveFileId !== fetchId) {
            try {
              const res = await fetch(`/api/files/data/${encodeURIComponent(file.driveFileId)}?name=${encodeURIComponent(file.name)}`);
              if (res.ok) {
                const dataJson = await res.json();
                if (dataJson?.base64Data) {
                  rawBase64 = dataJson.base64Data;
                  if (dataJson.mimeType) mimeType = dataJson.mimeType;
                }
              }
            } catch {}
          }
          if (!rawBase64 && fetchId) {
            try {
              const rawRes = await fetch(`/api/files/raw/${encodeURIComponent(fetchId)}`);
              if (rawRes.ok) {
                const ab = await rawRes.arrayBuffer();
                if (ab && ab.byteLength > 0) {
                  const u8 = new Uint8Array(ab);
                  let bStr = '';
                  for (let i = 0; i < u8.length; i++) {
                    bStr += String.fromCharCode(u8[i]);
                  }
                  rawBase64 = btoa(bStr);
                }
              }
            } catch {}
          }
          if (!rawBase64 && file.driveFileId) {
            try {
              const driveRes = await fetch(`/api/drive/download/${encodeURIComponent(file.driveFileId)}?name=${encodeURIComponent(file.name)}`);
              if (driveRes.ok) {
                const ab = await driveRes.arrayBuffer();
                if (ab && ab.byteLength > 0) {
                  const u8 = new Uint8Array(ab);
                  let bStr = '';
                  for (let i = 0; i < u8.length; i++) {
                    bStr += String.fromCharCode(u8[i]);
                  }
                  rawBase64 = btoa(bStr);
                }
              }
            } catch {}
          }
        }

        const lower = (file.name || '').toLowerCase();
        const isDocx = lower.endsWith('.docx') || lower.endsWith('.doc') || mimeType.includes('word') || mimeType.includes('officedocument') || file.previewType === 'doc';
        const isSheet = lower.endsWith('.xlsx') || lower.endsWith('.xls') || mimeType.includes('spreadsheetml') || mimeType.includes('excel') || file.previewType === 'spreadsheet';
        const isPdf = lower.endsWith('.pdf') || mimeType === 'application/pdf' || file.previewType === 'pdf';
        const isImage = file.mimeType?.startsWith('image/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg');

        if (isPdf) {
          mimeType = 'application/pdf';
        } else if (isDocx) {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (isSheet) {
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

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

          // Render Word Document (.docx)
          if (isDocx) {
            setDocxArrayBuffer(arrayBuffer);
            try {
              const result = await parseDocxBinary(arrayBuffer);
              if (result && result.pages && result.pages.length > 0) {
                setParsedPages(result.pages);
              }
            } catch (pErr) {
              console.warn('[DedicatedRawFileViewer] parseDocxBinary error:', pErr);
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
          }
        } else if (file.previewContent) {
          setParsedPages(createA4PagesFromText(file.previewContent, file.name));
        } else if (file.viewUrl || file.driveFileId) {
          const safeUrl = getSafeGoogleDrivePreviewUrl(file);
          setBlobUrl(safeUrl || file.viewUrl || null);
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
  const isDocx = lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || file?.previewType === 'doc' || (file?.mimeType && file.mimeType.includes('word'));
  const isSheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || file?.previewType === 'spreadsheet' || (file?.mimeType && file.mimeType.includes('spreadsheet'));
  const isImage = lowerName.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || file?.previewType === 'image' || (file?.mimeType && file.mimeType.includes('image'));
  const totalPages = parsedPages.length || (isPdf ? 1 : 1);

  // Render Word document via docx-preview if arrayBuffer is present
  useEffect(() => {
    let isMounted = true;
    if (isDocx && docxArrayBuffer && docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
      renderAsync(docxArrayBuffer, docxContainerRef.current, undefined, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      }).catch(async (err) => {
        if (!isMounted) return;
        console.warn('[DedicatedRawFileViewer] docx-preview renderAsync failed:', err);
        try {
          const result = await parseDocxBinary(docxArrayBuffer);
          if (result && result.pages && result.pages.length > 0) {
            setParsedPages(result.pages);
          }
        } catch {}
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isDocx, docxArrayBuffer]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (typeof window !== 'undefined') {
      if (window.opener) {
        window.close();
      } else {
        window.history.back();
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      {/* INJECTED STYLES FOR AUTHENTIC A4 SIZING, SARABUN FONT, EXACT MARGINS, & TABLE GRIDS */}
      <style>{`
        /* Authentic A4 Dimensions: 210mm × 297mm */
        /* Exact margins: Top 25mm, Bottom 20mm, Left 25mm, Right 20mm */
        .a4-page-sheet {
          width: 210mm !important;
          max-width: 100% !important;
          min-height: 297mm !important;
          margin: 24px auto !important;
          padding: 25mm 20mm 20mm 25mm !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #111827 !important;
          font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif !important;
          font-size: 16pt !important;
          line-height: 1.6 !important;
          box-shadow: 0 12px 35px -5px rgba(0, 0, 0, 0.5), 0 4px 12px -2px rgba(0, 0, 0, 0.3) !important;
        }

        /* docx-preview wrapper styling to enforce A4 pagination and Sarabun font */
        .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
        }
        .docx-wrapper > section.docx {
          width: 210mm !important;
          max-width: 100% !important;
          min-height: 297mm !important;
          padding: 25mm 20mm 20mm 25mm !important;
          margin: 24px auto !important;
          background: #ffffff !important;
          color: #111827 !important;
          box-shadow: 0 12px 35px -5px rgba(0, 0, 0, 0.5), 0 4px 12px -2px rgba(0, 0, 0, 0.3) !important;
          box-sizing: border-box !important;
          position: relative !important;
          font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif !important;
          font-size: 16pt !important;
          line-height: 1.6 !important;
        }

        /* Print media standard */
        @media print {
          body {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .a4-page-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
          }
        }
      `}</style>

      {/* HEADER BAR - Strict raw file controls, 1 download button, close button, zoom controls */}
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
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg">
                {file?.name || 'กำลังเปิดไฟล์ต้นฉบับ...'}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ไฟล์ต้นฉบับแท้
              </span>
              {submitterName && (
                <span className="hidden md:inline text-slate-400 border-l border-slate-700 pl-2">
                  ผู้ส่ง: {submitterName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right: Zoom Controls, Download, Close */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls (for Word, Sheet, Image) */}
          {(isDocx || isSheet || isImage) && (
            <div className="hidden md:flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 gap-1">
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
                title="ขนาดพอดี (100%)"
                className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                100%
              </button>
            </div>
          )}

          {/* Action Button: Single Green Download Button */}
          {file && (
            <button
              type="button"
              id="btn-single-download"
              onClick={() => triggerDirectDownload(file)}
              title="ดาวน์โหลดไฟล์ต้นฉบับ"
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">ดาวน์โหลดไฟล์ต้นฉบับ</span>
              <span className="sm:hidden">ดาวน์โหลด</span>
            </button>
          )}

          {/* Close Window / Close Modal Button */}
          <button
            type="button"
            id="btn-close-window"
            onClick={handleClose}
            title={isModalMode ? "ปิดหน้าต่างแสดงตัวอย่าง" : "ปิดหน้าต่างนี้"}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">ปิด</span>
          </button>
        </div>
      </header>

      {/* VIEWER CANVAS - Authentic Raw Original File Display in ONE SINGLE VIEW */}
      <main 
        ref={scrollContainerRef}
        onScroll={handleContainerScroll}
        className="flex-1 relative overflow-y-auto bg-slate-950 flex flex-col items-center w-full"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-30 gap-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-200">กำลังเปิดอ่านไฟล์ต้นฉบับ...</p>
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
                <span>ดาวน์โหลดไฟล์ต้นฉบับแทน</span>
              </button>
            )}
          </div>
        )}

        {!error && file && (
          <>
            {/* 1. AUTHENTIC PDF: Displayed in full native viewer */}
            {isPdf && (
              <div className="w-full flex-1 flex flex-col p-2 sm:p-4 h-[calc(100vh-68px)]">
                {blobUrl ? (
                  <iframe
                    src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                    className="w-full h-full border-0 bg-white rounded-xl shadow-2xl"
                    title={file.name}
                  />
                ) : file.driveFileId || file.viewUrl ? (
                  <iframe
                    src={getSafeGoogleDrivePreviewUrl(file) || file.viewUrl}
                    className="w-full h-full border-0 bg-white rounded-xl shadow-2xl"
                    title={file.name}
                    allow="autoplay"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 rounded-xl">
                    <FileText className="w-12 h-12 text-rose-400 mb-3" />
                    <p className="text-white font-bold text-base mb-3">{file.name}</p>
                    <button
                      type="button"
                      onClick={() => triggerDirectDownload(file)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm cursor-pointer"
                    >
                      ดาวน์โหลดไฟล์ต้นฉบับ
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. AUTHENTIC WORD DOCX (.docx): Rendered via docx-preview or authentic parsed pages */}
            {isDocx && (
              <div className="w-full flex-1 flex flex-col items-center py-6 px-4 overflow-y-auto">
                <div
                  ref={docxContainerRef}
                  className="docx-render-stage w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-sm select-text"
                  style={{ minHeight: '297mm', transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                />
                {parsedPages.length > 0 && (!docxContainerRef.current || docxContainerRef.current.children.length === 0) && (
                  <div 
                    className="flex flex-col items-center w-full transition-transform duration-150 origin-top"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  >
                    {parsedPages.map((page, pageIdx) => {
                      const pageNum = page.pageNumber || pageIdx + 1;
                      return (
                        <div 
                          key={pageNum}
                          ref={(el) => registerPageRef(pageNum, el)}
                          data-page-index={pageNum}
                          className="a4-page-sheet flex flex-col justify-start select-text relative mb-6"
                        >
                          <div className="flex-1 space-y-3.5 text-slate-900 leading-relaxed font-sarabun">
                            {page.elements.map((el, elIdx) => {
                              if (el.type === 'paragraph') {
                                const isCenter = el.align === 'center';
                                const isRight = el.align === 'right';
                                const isIndented = el.isIndented || false;
                                const alignClass = isCenter ? 'text-center' : isRight ? 'text-right' : 'text-left';
                                const indentClass = !isCenter && !isRight && isIndented ? 'indent-10' : '';

                                return (
                                  <p 
                                    key={elIdx} 
                                    className={`${alignClass} ${indentClass} leading-relaxed my-1.5`}
                                    style={{ fontSize: '16pt' }}
                                  >
                                    {el.runs.map((run, rIdx) => (
                                      <span 
                                        key={rIdx} 
                                        style={{
                                          fontWeight: run.bold ? 'bold' : undefined,
                                          fontStyle: run.italic ? 'italic' : undefined,
                                          textDecoration: run.underline ? 'underline' : undefined,
                                          color: run.color || undefined,
                                          fontSize: run.fontSizePt ? `${run.fontSizePt}pt` : undefined
                                        }}
                                      >
                                        {run.text}
                                      </span>
                                    ))}
                                  </p>
                                );
                              }

                              if (el.type === 'table') {
                                const tableRows = el.tableRows || (el.rows ? el.rows.map((row, rIdx) => ({
                                  isHeader: rIdx === 0,
                                  cells: row.map((c: any, cIdx: number) => {
                                    const text = typeof c === 'string' ? c : c?.text || '';
                                    return {
                                      text,
                                      align: rIdx === 0 ? 'center' : 'left',
                                      bgColor: rIdx === 0 ? '#F1F5F9' : undefined,
                                      bold: rIdx === 0 || (cIdx === 0 && rIdx > 0),
                                      fontSizePt: rIdx === 0 ? 14 : 13,
                                      runs: [{ text, bold: rIdx === 0 || (cIdx === 0 && rIdx > 0) }]
                                    };
                                  })
                                })) : []);

                                const outerBorder = el.borderColors?.outer || '#475569';
                                const innerBorder = el.borderColors?.inner || '#94A3B8';

                                return (
                                  <div key={elIdx} className="my-4 overflow-x-auto w-full">
                                    <table 
                                      className="w-full border-collapse font-sarabun text-[14pt] leading-normal my-2 table-auto"
                                      style={{ border: `1.5px solid ${outerBorder}` }}
                                    >
                                      <tbody>
                                        {tableRows.map((row, rIdx) => {
                                          const isHeader = row.isHeader || rIdx === 0;
                                          return (
                                            <tr key={rIdx} className={isHeader ? 'font-bold' : ''}>
                                              {row.cells.map((cell, cIdx) => (
                                                <td 
                                                  key={cIdx} 
                                                  colSpan={cell.colSpan}
                                                  rowSpan={cell.rowSpan}
                                                  className={`p-2.5 text-slate-900 align-top ${cell.align === 'center' ? 'text-center' : 'text-left'}`}
                                                  style={{
                                                    backgroundColor: cell.bgColor || (isHeader ? '#F1F5F9' : undefined),
                                                    border: `1px solid ${innerBorder}`,
                                                    fontSize: cell.fontSizePt ? `${cell.fontSizePt}pt` : isHeader ? '14pt' : '13pt',
                                                    fontWeight: cell.bold || isHeader ? 700 : 400
                                                  }}
                                                >
                                                  {cell.text}
                                                </td>
                                              ))}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. AUTHENTIC EXCEL SPREADSHEET (.xlsx / .xls): Direct table of sheet cells */}
            {isSheet && (
              <div className="w-full flex-1 flex flex-col items-center py-4 px-3 sm:px-6 overflow-y-auto">
                {sheetNames.length > 1 && (
                  <div className="mb-3 bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1.5 overflow-x-auto max-w-full">
                    {sheetNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setActiveSheet(name)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          activeSheet === name 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                <div 
                  className="w-full max-w-6xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-300 my-2"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  <div className="overflow-x-auto max-h-[calc(100vh-140px)]">
                    {activeSheet && sheetData[activeSheet] && sheetData[activeSheet].length > 0 ? (() => {
                      const rawRows = sheetData[activeSheet];
                      const headerRow = rawRows[0] || [];
                      const bodyRows = rawRows.slice(1);
                      return (
                        <table className="w-full border-collapse font-sarabun text-[14pt] table-auto select-text">
                          <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr className="border-b border-slate-300">
                              <th className="px-3 py-2 text-center text-slate-500 font-semibold border-r border-slate-300 text-xs w-12 bg-slate-200">#</th>
                              {headerRow.map((col: any, idx: number) => (
                                <th key={idx} className="px-3 py-2.5 text-left font-bold text-slate-800 border-r border-slate-300 last:border-r-0 whitespace-nowrap">
                                  {String(col ?? '')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bodyRows.map((r: any[], rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-slate-50 border-b border-slate-200 last:border-b-0">
                                <td className="px-3 py-1.5 text-center text-slate-400 text-xs border-r border-slate-200 bg-slate-50 font-mono">
                                  {rIdx + 1}
                                </td>
                                {headerRow.map((_: any, cIdx: number) => (
                                  <td key={cIdx} className="px-3 py-2 text-slate-800 border-r border-slate-200 last:border-r-0 whitespace-pre-wrap">
                                    {r[cIdx] !== null && r[cIdx] !== undefined ? String(r[cIdx]) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })() : (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        ไม่มีข้อมูลตารางในชีตนี้
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. AUTHENTIC IMAGE VIEWER */}
            {isImage && (
              <div className="w-full flex-1 flex items-center justify-center p-4 overflow-auto">
                <img
                  src={file.fileDataUrl || blobUrl || ''}
                  alt={file.name}
                  className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl bg-white"
                />
              </div>
            )}

            {/* 5. TEXT / PREVIEW CONTENT ONLY (When no binary parser matched) */}
            {!isPdf && !isDocx && !isSheet && !isImage && file.previewContent && (
              <div className="w-full flex-1 flex flex-col items-center py-6 px-4 overflow-y-auto">
                <div 
                  className="a4-page-sheet flex flex-col justify-start select-text p-8 bg-white text-slate-900 rounded shadow-2xl max-w-[210mm] w-full"
                  style={{ minHeight: '297mm' }}
                >
                  <pre className="font-sarabun text-[15pt] leading-relaxed whitespace-pre-wrap text-slate-900 font-sans">
                    {file.previewContent}
                  </pre>
                </div>
              </div>
            )}

            {/* 6. GOOGLE DRIVE EMBED OR CLEAN DIRECT DOWNLOAD CARD */}
            {!isPdf && !isDocx && !isSheet && !isImage && !file.previewContent && (
              file.driveFileId || file.viewUrl ? (
                <div className="w-full flex-1 flex flex-col p-2 sm:p-4 h-[calc(100vh-68px)]">
                  <iframe
                    src={getSafeGoogleDrivePreviewUrl(file) || file.viewUrl}
                    className="w-full h-full border-0 bg-white rounded-xl shadow-2xl"
                    title={file.name}
                    allow="autoplay"
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 text-purple-400 flex items-center justify-center mb-4 shadow-lg border border-slate-700">
                    <File className="w-8 h-8" />
                  </div>
                  <h2 className="text-lg font-bold text-white mb-2">{file.name}</h2>
                  <p className="text-sm text-slate-400 mb-6">{(file.size / 1024).toFixed(1)} KB • {file.mimeType || 'เอกสาร'}</p>
                  <button
                    type="button"
                    onClick={() => triggerDirectDownload(file)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* FLOATING SCROLL PAGE INDICATOR (for multi-page Word documents) */}
      {!loading && !error && file && isDocx && totalPages > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 bg-slate-900/95 border border-purple-500/50 text-white rounded-full shadow-2xl backdrop-blur-md transition-all select-none">
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => scrollToPage(currentPageInView - 1)}
              disabled={currentPageInView <= 1}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white"
              title="เลื่อนไปหน้าก่อนหน้า"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <FileText className="w-4 h-4 text-purple-400 shrink-0" />
            <span>หน้า</span>
            <span className="font-bold text-amber-300 text-sm sm:text-base px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
              {currentPageInView}
            </span>
            <span className="text-slate-400">/ {totalPages}</span>
          </div>

          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => scrollToPage(currentPageInView + 1)}
              disabled={currentPageInView >= totalPages}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white"
              title="เลื่อนไปหน้าถัดไป"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
