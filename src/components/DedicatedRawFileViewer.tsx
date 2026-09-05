import React, { useEffect, useState, useRef } from 'react';
import { 
  Download, 
  X, 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  File, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UploadedFile } from '../types';
import { triggerDirectDownload } from '../services/storageService';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';

export const DedicatedRawFileViewer: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [assignmentTitle, setAssignmentTitle] = useState<string>('');
  const [submitterName, setSubmitterName] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Spreadsheet state
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<{ [sheet: string]: any[][] }>({});

  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Load file data from localStorage cache or fallback
  useEffect(() => {
    try {
      const cached = localStorage.getItem('academic_active_raw_file');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.file) {
          setFile(parsed.file);
          if (parsed.assignmentTitle) setAssignmentTitle(parsed.assignmentTitle);
          if (parsed.submitterName) setSubmitterName(parsed.submitterName);
          return;
        }
      }

      // Check URL search params for file_id
      const params = new URLSearchParams(window.location.search);
      const fileId = params.get('file_id');
      if (fileId) {
        // Look up in documents or submissions
        const docsRaw = localStorage.getItem('academic_documents_v1');
        if (docsRaw) {
          const docs = JSON.parse(docsRaw);
          const found = docs.find((d: any) => d.file && d.file.id === fileId);
          if (found) {
            setFile(found.file);
            setAssignmentTitle(found.title || '');
            setSubmitterName(found.uploaderName || '');
            return;
          }
        }
        const subsRaw = localStorage.getItem('academic_submissions_v1');
        if (subsRaw) {
          const subs = JSON.parse(subsRaw);
          for (const s of subs) {
            const f = s.files?.find((fileItem: any) => fileItem.id === fileId);
            if (f) {
              setFile(f);
              setAssignmentTitle(s.assignmentTitle || '');
              setSubmitterName(s.memberName || '');
              return;
            }
          }
        }
      }

      setError('ไม่พบข้อมูลไฟล์ที่ต้องการแสดง กรุณากลับไปที่หน้าหลักแล้วคลิกดูใหม่อีกครั้ง');
    } catch (e: any) {
      setError('เกิดข้อผิดพลาดในการโหลดไฟล์: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  // When file is loaded, process its authentic raw binary
  useEffect(() => {
    if (!file) return;

    let currentBlobUrl: string | null = null;

    const processFile = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!file.fileDataUrl || !file.fileDataUrl.startsWith('data:')) {
          // If no data URL, check if there is an embeddable viewUrl
          if (file.viewUrl) {
            setBlobUrl(file.viewUrl);
          } else {
            setError('ไฟล์นี้ไม่มีข้อมูลไบนารีต้นฉบับในหน่วยความจำ');
          }
          setLoading(false);
          return;
        }

        // Convert base64 data URL to ArrayBuffer & Blob
        const parts = file.fileDataUrl.split(';base64,');
        const mimeType = parts[0].replace('data:', '') || file.mimeType || 'application/octet-stream';
        const rawBase64 = parts[1];

        if (!rawBase64) {
          throw new Error('ไม่พบข้อมูล Base64 ในไฟล์ต้นฉบับ');
        }

        const binaryString = atob(rawBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        const blob = new Blob([bytes], { type: mimeType });
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);

        const lower = (file.name || '').toLowerCase();
        const isDocx = lower.endsWith('.docx') || mimeType.includes('wordprocessingml');
        const isSheet = lower.endsWith('.xlsx') || lower.endsWith('.xls') || mimeType.includes('spreadsheetml') || mimeType.includes('excel');

        if (isDocx && docxContainerRef.current) {
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
            console.warn('[DedicatedRawFileViewer] docx-preview parse failed, falling back:', renderErr);
          }
        } else if (isSheet) {
          try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetsMap: { [sheet: string]: any[][] } = {};
            workbook.SheetNames.forEach(name => {
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
  const isPdf = lowerName.endsWith('.pdf') || file?.previewType === 'pdf';
  const isDocx = lowerName.endsWith('.docx') || file?.previewType === 'doc';
  const isSheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || file?.previewType === 'spreadsheet';
  const isImage = lowerName.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || file?.previewType === 'image';

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
      {/* HEADER BAR - Clean, authoritative, strictly conforming to user constraints */}
      <header className="h-16 shrink-0 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
            {isPdf && <FileText className="w-5 h-5 text-rose-400" />}
            {isDocx && <FileText className="w-5 h-5 text-blue-400" />}
            {isSheet && <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
            {isImage && <FileImage className="w-5 h-5 text-amber-400" />}
            {!isPdf && !isDocx && !isSheet && !isImage && <File className="w-5 h-5 text-purple-400" />}
          </div>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-md lg:max-w-xl">
              {file?.name || 'กำลังโหลดไฟล์ต้นฉบับ...'}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              {file?.size && (
                <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              )}
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                ไฟล์ต้นฉบับที่อัปโหลด
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

        {/* Right Action: Strictly ONLY ONE Download Button & Close Window (No printer, No copy, No duplicate buttons) */}
        <div className="flex items-center gap-3 shrink-0">
          {file && (
            <button
              type="button"
              onClick={() => triggerDirectDownload(file)}
              title="ดาวน์โหลดไฟล์ต้นฉบับตรง"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์ต้นฉบับ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.close()}
            title="ปิดหน้าต่างนี้"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">ปิดหน้าต่าง</span>
          </button>
        </div>
      </header>

      {/* VIEWER CANVAS - Authentic Raw Original File Display */}
      <main className="flex-1 relative overflow-hidden bg-slate-950 flex flex-col">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 gap-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-300">กำลังเปิดอ่านไฟล์ต้นฉบับแท้...</p>
          </div>
        )}

        {error && (
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

        {!loading && !error && file && (
          <>
            {/* 1. PDF VIEWER: Authentic PDF native engine via iframe Blob URL */}
            {isPdf && blobUrl && (
              <div className="w-full h-full bg-slate-900">
                <iframe
                  src={`${blobUrl}#toolbar=1`}
                  className="w-full h-full border-0 bg-slate-100"
                  title={file.name}
                />
              </div>
            )}

            {/* 2. DOCX VIEWER: Authentic Word rendering via docx-preview */}
            {isDocx && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900 flex justify-center">
                <div 
                  ref={docxContainerRef}
                  className="docx-render-wrapper max-w-4xl w-full bg-white text-slate-900 shadow-2xl rounded-sm min-h-[800px] p-6 sm:p-10 select-text font-serif leading-relaxed"
                />
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

            {/* 4. IMAGE VIEWER: Authentic high-res image canvas */}
            {isImage && (
              <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-slate-950">
                <img
                  src={file.fileDataUrl || blobUrl || ''}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-800"
                />
              </div>
            )}

            {/* 5. OTHER FILE TYPES: Text or Fallback Preview */}
            {!isPdf && !isDocx && !isSheet && !isImage && (
              <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-950">
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
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
