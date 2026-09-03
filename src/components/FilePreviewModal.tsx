import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
  FileType,
  Printer,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Table,
  Presentation,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  FileCheck,
  Award,
  BookOpen,
  Calendar,
  User as UserIcon,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  FileCode,
  HardDrive
} from 'lucide-react';
import { UploadedFile } from '../types';
import { triggerDirectDownload } from '../services/storageService';
import Swal from 'sweetalert2';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: UploadedFile | null;
  assignmentTitle?: string;
  submitterName?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  assignmentTitle,
  submitterName
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'original' | 'structured'>('original');
  const [activeSheetTab, setActiveSheetTab] = useState<'scores' | 'stats' | 'traits'>('scores');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [isCopied, setIsCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; value: string }>({
    row: 1,
    col: 'E',
    value: '78.4'
  });
  const [spreadsheetSearch, setSpreadsheetSearch] = useState('');
  
  // Real File Data States
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<string[][] | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  // When file changes, parse real binary data URL into Blob URL or decode Text/CSV
  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      setTextContent(null);
      setParsedCsv(null);
      return;
    }

    setZoomLevel(100);
    setRotation(0);
    setCurrentPage(1);
    setCurrentSlide(1);
    setIsIframeLoading(true);

    // Default to 'original' view mode when real file data or image/pdf exists
    setActiveViewMode('original');

    if (file.fileDataUrl && file.fileDataUrl.startsWith('data:')) {
      try {
        const parts = file.fileDataUrl.split(';base64,');
        const contentType = parts[0].replace('data:', '') || file.mimeType || 'application/octet-stream';
        const rawBase64 = parts[1];
        
        if (rawBase64) {
          const byteCharacters = atob(rawBase64);
          const byteNumbers = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteNumbers], { type: contentType });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);

          // Check if file is text/csv/json/md/code
          const lowerName = file.name.toLowerCase();
          const isTextType = contentType.includes('text') || 
            contentType.includes('json') || 
            contentType.includes('csv') ||
            lowerName.endsWith('.txt') ||
            lowerName.endsWith('.csv') ||
            lowerName.endsWith('.json') ||
            lowerName.endsWith('.md') ||
            lowerName.endsWith('.html') ||
            lowerName.endsWith('.xml') ||
            lowerName.endsWith('.js') ||
            lowerName.endsWith('.ts');

          if (isTextType) {
            const decodedText = new TextDecoder('utf-8').decode(byteNumbers);
            setTextContent(decodedText);

            if (lowerName.endsWith('.csv') || contentType.includes('csv')) {
              const rows = decodedText
                .split(/\r?\n/)
                .filter(r => r.trim().length > 0)
                .map(r => r.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));
              if (rows.length > 0) {
                setParsedCsv(rows);
              }
            }
          }

          return () => {
            URL.revokeObjectURL(url);
          };
        }
      } catch (err) {
        console.warn('[FilePreviewModal] Error creating Blob URL from file data:', err);
      }
    } else {
      setBlobUrl(null);
      setTextContent(file.previewContent || null);
      setParsedCsv(null);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const totalPages = file.previewType === 'pdf' ? 3 : file.previewType === 'doc' ? 2 : 1;
  const totalSlides = 4;

  const handleDownload = () => {
    Swal.fire({
      icon: 'success',
      title: 'กำลังดาวน์โหลดไฟล์ต้นฉบับ',
      text: `ดาวน์โหลด ${file.name} เรียบร้อยแล้ว (Original Binary File)`,
      timer: 1800,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });

    triggerDirectDownload(file);
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    } else if (file.fileDataUrl) {
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${file.fileDataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    } else if (file.viewUrl) {
      window.open(file.viewUrl, '_blank');
    } else {
      handleDownload();
    }
  };

  const handleCopyText = () => {
    const textToCopy = textContent || file.previewContent || `ไฟล์เอกสาร: ${file.name}\nขนาด: ${(file.size / 1024).toFixed(1)} KB\nผู้ส่ง: ${submitterName || 'ฝ่ายวิชาการ'}`;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกข้อความแล้ว',
      toast: true,
      position: 'top-end',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isRealDriveFile = Boolean(
    file.driveFileId && 
    !file.driveFileId.startsWith('drive_f_') && 
    !file.driveFileId.startsWith('mock_') &&
    !file.driveFileId.startsWith('1IpsaGJ-sample-') &&
    !file.driveFileId.startsWith('1IpsaGJ-doc-')
  );

  const isPdf = file.previewType === 'pdf' || file.name.toLowerCase().endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'));
  const isImage = file.previewType === 'image' || file.name.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) || (file.mimeType && file.mimeType.includes('image'));
  const isSpreadsheet = file.previewType === 'spreadsheet' || file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/i) || (file.mimeType && file.mimeType.includes('sheet'));
  const isPresentation = file.previewType === 'presentation' || file.name.toLowerCase().match(/\.(pptx|ppt)$/i) || (file.mimeType && file.mimeType.includes('presentation'));
  const isDoc = file.previewType === 'doc' || file.name.toLowerCase().match(/\.(docx|doc)$/i) || (file.mimeType && file.mimeType.includes('word'));

  // Determine sub-type for customized authentic layouts
  const isOrderDoc = file.name.includes('คำสั่ง') || file.name.toLowerCase().includes('order');
  const isResearchDoc = file.name.includes('วิจัย') || file.name.toLowerCase().includes('research');
  const isLessonPlan = file.name.includes('แผน') || file.name.toLowerCase().includes('plan') || file.name.toLowerCase().includes('active');

  // Student Score Mock List (for structured excel view)
  const studentScores = [
    { no: 1, code: '6901', name: 'เด็กชายกิตติศักดิ์ พรหมมินทร์', mid: 18.5, keep: 28.0, final: 27.5, trait: 19.0, total: 93.0, grade: '4.0', status: 'ผ่าน' },
    { no: 2, code: '6902', name: 'เด็กชายจิรภัทร เจริญศิลป์', mid: 17.0, keep: 26.5, final: 25.0, trait: 18.5, total: 87.0, grade: '4.0', status: 'ผ่าน' },
    { no: 3, code: '6903', name: 'เด็กหญิงชวัลรัตน์ สิทธิโชค', mid: 19.0, keep: 29.0, final: 28.5, trait: 20.0, total: 96.5, grade: '4.0', status: 'ผ่าน' },
    { no: 4, code: '6904', name: 'เด็กหญิงณัชชา เลิศวิริยะ', mid: 16.5, keep: 25.0, final: 24.5, trait: 18.0, total: 84.0, grade: '4.0', status: 'ผ่าน' },
    { no: 5, code: '6905', name: 'เด็กชายธนกร เกียรติอนันต์', mid: 15.0, keep: 24.0, final: 23.0, trait: 17.0, total: 79.0, grade: '3.5', status: 'ผ่าน' },
    { no: 6, code: '6906', name: 'เด็กหญิงนภัสสร อริยทรัพย์', mid: 18.0, keep: 27.5, final: 26.5, trait: 19.5, total: 91.5, grade: '4.0', status: 'ผ่าน' },
    { no: 7, code: '6907', name: 'เด็กชายปิติพัฒน์ แสงสว่าง', mid: 14.5, keep: 23.0, final: 22.0, trait: 16.5, total: 76.0, grade: '3.5', status: 'ผ่าน' },
    { no: 8, code: '6908', name: 'เด็กหญิงภัทรวดี มงคลกุล', mid: 19.5, keep: 29.5, final: 29.0, trait: 20.0, total: 98.0, grade: '4.0', status: 'ผ่าน' },
    { no: 9, code: '6909', name: 'เด็กชายวรเมธ ศิริวัฒน์', mid: 15.5, keep: 24.5, final: 23.5, trait: 17.5, total: 81.0, grade: '4.0', status: 'ผ่าน' },
    { no: 10, code: '6910', name: 'เด็กหญิงศศิธร สุวรรณรัตน์', mid: 16.0, keep: 25.5, final: 24.0, trait: 18.0, total: 83.5, grade: '4.0', status: 'ผ่าน' },
    { no: 11, code: '6911', name: 'เด็กชายสรวิชญ์ บรรดาศักดิ์', mid: 14.0, keep: 22.5, final: 21.0, trait: 16.0, total: 73.5, grade: '3.0', status: 'ผ่าน' },
    { no: 12, code: '6912', name: 'เด็กหญิงอริสา วงศ์สวรรค์', mid: 17.5, keep: 27.0, final: 26.0, trait: 19.0, total: 89.5, grade: '4.0', status: 'ผ่าน' },
  ].filter(s => s.name.includes(spreadsheetSearch) || s.code.includes(spreadsheetSearch));

  // Determine if we have real binary data or real drive preview
  const hasRealBinaryData = Boolean(blobUrl || file.fileDataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-6xl w-full flex flex-col h-[94vh] max-h-[950px] shadow-2xl border border-purple-200/80 overflow-hidden select-none">
        
        {/* TOP APPLICATION TOOLBAR */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${
              isPdf ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              isSpreadsheet ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              isImage ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
              isPresentation ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {isPdf ? <FileText className="w-5 h-5" /> :
               isSpreadsheet ? <FileSpreadsheet className="w-5 h-5" /> :
               isImage ? <ImageIcon className="w-5 h-5" /> :
               isPresentation ? <Presentation className="w-5 h-5" /> :
               <FileType className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                  {file.name}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-500/30 text-purple-300 border border-purple-400/40 uppercase tracking-wider">
                  {file.previewType}
                </span>
                {hasRealBinaryData && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span>ไฟล์จริง (Original Binary)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-2">
                <span>{submitterName ? `ผู้จัดทำ: ${submitterName}` : (assignmentTitle || 'เอกสารวิชาการ')}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Google Drive Sync</span>
                </span>
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            
            {/* View Mode Toggle (Original vs Structured) */}
            {(isDoc || isSpreadsheet || isPresentation || isPdf) && (
              <div className="hidden sm:flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('original')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeViewMode === 'original'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="ดูไฟล์ต้นฉบับจริง"
                >
                  {isPdf ? 'ไฟล์ PDF จริง' : isImage ? 'รูปภาพจริง' : 'พรีวิวไฟล์'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('structured')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeViewMode === 'structured'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="ดูรายละเอียดโครงสร้างเอกสาร"
                >
                  โครงสร้างเนื้อหา
                </button>
              </div>
            )}

            {/* Image Controls (Zoom & Rotate) */}
            {isImage && (
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs text-slate-200">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(40, prev - 20))}
                  className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                  title="ย่อรูป"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 font-mono text-[11px]">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(300, prev + 20))}
                  className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                  title="ขยายรูป"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1 hover:bg-slate-700 rounded cursor-pointer border-l border-slate-700 pl-1.5"
                  title="หมุนภาพ 90 องศา"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Structured Page Navigation (for Word/PDF simulated pages) */}
            {activeViewMode === 'structured' && (isPdf || isDoc) && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs text-slate-200">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-mono text-[11px]">
                  หน้า {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Structured Slide Navigation (for Presentation) */}
            {activeViewMode === 'structured' && isPresentation && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs text-slate-200">
                <button
                  type="button"
                  disabled={currentSlide <= 1}
                  onClick={() => setCurrentSlide(prev => Math.max(1, prev - 1))}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="สไลด์ก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-mono text-[11px]">
                  สไลด์ {currentSlide} / {totalSlides}
                </span>
                <button
                  type="button"
                  disabled={currentSlide >= totalSlides}
                  onClick={() => setCurrentSlide(prev => Math.min(totalSlides, prev + 1))}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="สไลด์ถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Open in New Window / Tab */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              title="เปิดดูไฟล์เต็มจอในแท็บใหม่"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer hidden sm:block"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Copy Text */}
            <button
              type="button"
              onClick={handleCopyText}
              title="คัดลอกข้อความสรุป"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              title="พิมพ์เอกสาร"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer hidden sm:block"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* 1-Click Binary Download */}
            <button
              type="button"
              onClick={handleDownload}
              title="ดาวน์โหลดไฟล์ต้นฉบับตรง (Original Binary)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-md glow-purple-hover cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ดาวน์โหลดไฟล์</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN DOCUMENT VIEWER CANVAS */}
        <div className="flex-1 bg-slate-900/95 p-2 sm:p-4 overflow-y-auto flex flex-col items-center justify-start relative">
          
          {/* ========================================================================= */}
          {/* 1. REAL PDF VIEWER (Direct Embedded PDF Iframe / Object with Native Tools) */}
          {/* ========================================================================= */}
          {isPdf && activeViewMode === 'original' && (
            <div className="w-full h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative min-h-[550px] sm:min-h-[720px]">
              
              {/* PDF Top Sub-bar */}
              <div className="bg-slate-800/90 px-4 py-2 flex items-center justify-between border-b border-slate-700 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-white truncate max-w-sm">{file.name}</span>
                  <span className="text-[11px] text-slate-400">({formatFileSize(file.size)})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดเต็มจอ (Fullscreen)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด PDF</span>
                  </button>
                </div>
              </div>

              {/* Native PDF Embedded Iframe */}
              <div className="flex-1 w-full h-full relative bg-slate-800 flex items-center justify-center">
                {hasRealBinaryData ? (
                  <iframe
                    src={`${blobUrl || file.fileDataUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full min-h-[550px] sm:min-h-[700px] border-0 bg-white"
                    title={file.name}
                    onLoad={() => setIsIframeLoading(false)}
                  />
                ) : isRealDriveFile ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${file.driveFileId}/preview`}
                    className="w-full h-full min-h-[550px] sm:min-h-[700px] border-0 bg-white"
                    title={file.name}
                    onLoad={() => setIsIframeLoading(false)}
                  />
                ) : (
                  /* Fallback to Structured PDF Document View if no raw binary data */
                  <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl p-8 my-4 text-slate-900 leading-relaxed font-sans space-y-6">
                    <div className="text-center pb-4 border-b border-slate-200">
                      <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-700 mx-auto flex items-center justify-center mb-2">
                        <FileText className="w-7 h-7" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">{file.name}</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        ผู้ส่ง: {submitterName || 'ฝ่ายวิชาการ'} • ขนาดไฟล์: {formatFileSize(file.size)}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      {file.previewContent || 'เอกสาร PDF ได้รับการบันทึกลงในระบบคลาวด์ Google Drive เรียบร้อยแล้ว สามารถกดดาวน์โหลดเพื่อเปิดดูผ่านโปรแกรม PDF Reader ได้โดยตรง'}
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                      <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลดไฟล์ PDF ต้นฉบับ</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. REAL IMAGE VIEWER (Zoom, Rotate, Pan & High-res Display) */}
          {/* ========================================================================= */}
          {isImage && (
            <div className="w-full h-full flex flex-col items-center justify-center p-2">
              <div className="max-w-4xl w-full bg-slate-900/90 rounded-2xl p-4 shadow-2xl border border-slate-700 flex flex-col items-center justify-center overflow-hidden min-h-[450px]">
                <div className="overflow-auto max-h-[680px] max-w-full flex items-center justify-center p-4">
                  <img
                    src={blobUrl || file.fileDataUrl || file.viewUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&auto=format&fit=crop&q=80"}
                    alt={file.name}
                    className="max-h-[600px] max-w-full object-contain rounded-lg transition-transform duration-200 shadow-lg"
                    style={{ 
                      transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center'
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="w-full flex items-center justify-between border-t border-slate-800 pt-3 px-2 text-xs text-slate-400">
                  <span>{file.name} ({formatFileSize(file.size)})</span>
                  <div className="flex items-center gap-3">
                    <span>ซูม: {zoomLevel}%</span>
                    <span>หมุน: {rotation}°</span>
                    <button
                      onClick={handleDownload}
                      className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดรูปภาพ</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. CSV / TEXT / CODE VIEWER (Real Uploaded Text Parsing) */}
          {/* ========================================================================= */}
          {parsedCsv && (
            <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-300 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="bg-emerald-800 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-300" />
                  <span className="font-bold text-xs sm:text-sm">ตารางข้อมูลไฟล์ CSV: {file.name}</span>
                </div>
                <span className="text-xs bg-emerald-700 px-2.5 py-0.5 rounded-full font-mono">
                  {parsedCsv.length} แถว
                </span>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-xs text-left border-collapse select-text">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 text-center bg-slate-200 text-slate-600 border-r border-slate-300 w-12">#</th>
                      {parsedCsv[0]?.map((col, idx) => (
                        <th key={idx} className="p-2.5 border-r border-slate-300">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedCsv.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-emerald-50/50">
                        <td className="p-2 text-center bg-slate-50 text-slate-400 font-mono border-r border-slate-200">
                          {rIdx + 1}
                        </td>
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="p-2.5 border-r border-slate-200">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Plain Text or Code Viewer (if text decoded and not CSV) */}
          {!parsedCsv && textContent && !isPdf && !isImage && activeViewMode === 'original' && (
            <div className="w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col text-slate-100">
              <div className="bg-slate-800 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-mono">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <span>{file.name}</span>
                </div>
                <button
                  onClick={handleCopyText}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกข้อความ</span>
                </button>
              </div>
              <pre className="p-6 text-xs font-mono overflow-auto max-h-[600px] leading-relaxed select-text whitespace-pre-wrap text-emerald-400 bg-slate-950">
                {textContent}
              </pre>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. REAL GOOGLE DRIVE PREVIEW (If file is real Google Drive file) */}
          {/* ========================================================================= */}
          {isRealDriveFile && !isPdf && activeViewMode === 'original' && (
            <div className="w-full h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative min-h-[550px] sm:min-h-[720px]">
              <iframe
                src={`https://drive.google.com/file/d/${file.driveFileId}/preview`}
                className="w-full h-full min-h-[550px] sm:min-h-[700px] border-0 bg-white"
                title={file.name}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. WORD / EXCEL / PPT REAL FILE CARD & STRUCTURED VIEWER */}
          {/* ========================================================================= */}
          {(!isPdf || activeViewMode === 'structured') && !parsedCsv && (!textContent || activeViewMode === 'structured') && !isImage && (!isRealDriveFile || activeViewMode === 'structured') && (
            <div className="w-full flex flex-col items-center gap-4">

              {/* Real Binary File Inspection Header Card */}
              {hasRealBinaryData && (
                <div className="w-full max-w-4xl bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 border border-slate-700 shadow-xl flex flex-wrap items-center justify-between gap-3 text-white text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{file.name}</h4>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                          ไฟล์จริงพร้อมดาวน์โหลด
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        ขนาด: {formatFileSize(file.size)} • ชนิด: {file.mimeType || file.previewType} • บันทึกบน Google Drive
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดไฟล์ต้นฉบับตรง</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SPREADSHEET (EXCEL .XLSX) STRUCTURED SHEET VIEWER */}
              {isSpreadsheet && (
                <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-300 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                  {/* Excel Ribbon & Sheet Tabs Header */}
                  <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="px-2.5 py-1 bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs">
                        <Table className="w-3.5 h-3.5" />
                        <span>Microsoft Excel (.XLSX)</span>
                      </div>

                      {/* Sheet Tabs */}
                      <div className="flex items-center gap-1 bg-slate-200/90 p-0.5 rounded-xl border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setActiveSheetTab('scores')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            activeSheetTab === 'scores'
                              ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300'
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          Sheet 1: คะแนน ปพ.5
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSheetTab('stats')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            activeSheetTab === 'stats'
                              ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300'
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          Sheet 2: สรุปสถิติ & เกรด
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSheetTab('traits')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            activeSheetTab === 'traits'
                              ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300'
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          Sheet 3: คุณลักษณะ 8 ประการ
                        </button>
                      </div>
                    </div>

                    {/* Formula Bar Search */}
                    <div className="flex items-center gap-2 flex-1 max-w-xs sm:max-w-sm justify-end">
                      <div className="relative w-full max-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={spreadsheetSearch}
                          onChange={(e) => setSpreadsheetSearch(e.target.value)}
                          placeholder="ค้นหานักเรียน..."
                          className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Formula Bar Row */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 text-xs font-mono">
                    <div className="w-14 px-2 py-0.5 bg-white border border-slate-300 rounded font-bold text-center text-slate-700">
                      {selectedCell.col}{selectedCell.row}
                    </div>
                    <div className="text-slate-400 font-sans font-bold">fx</div>
                    <div className="flex-1 px-2.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 truncate">
                      {selectedCell.value.startsWith('=') ? selectedCell.value : `=VALUE("${selectedCell.value}")`}
                    </div>
                  </div>

                  {/* SHEET 1: SCORES TABLE */}
                  {activeSheetTab === 'scores' && (
                    <div className="overflow-x-auto max-h-[520px]">
                      <table className="w-full text-xs text-left border-collapse select-text">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 font-mono">
                          <tr>
                            <th className="p-2.5 text-center bg-slate-200 text-slate-600 border-r border-slate-300 w-12">#</th>
                            <th className="p-2.5 border-r border-slate-300 w-20 text-center">A. รหัส</th>
                            <th className="p-2.5 border-r border-slate-300 min-w-[200px] font-sans">B. ชื่อ - นามสกุล นักเรียน</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-24">C. เก็บ (30)</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-24">D. กลางภาค (20)</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-24">E. ปลายภาค (30)</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-24">F. คุณลักษณะ (20)</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-24 bg-emerald-50 text-emerald-900">G. รวม (100)</th>
                            <th className="p-2.5 border-r border-slate-300 text-center w-20 bg-purple-50 text-purple-900">H. เกรด</th>
                            <th className="p-2.5 text-center w-24 font-sans">I. ผลประเมิน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-sans">
                          {studentScores.map((s, idx) => (
                            <tr
                              key={s.no}
                              onClick={() => setSelectedCell({ row: idx + 1, col: 'G', value: String(s.total) })}
                              className={`hover:bg-emerald-50/50 cursor-pointer transition-colors ${
                                selectedCell.row === idx + 1 ? 'bg-emerald-50/70 ring-1 ring-emerald-400 inset-0' : ''
                              }`}
                            >
                              <td className="p-2 text-center bg-slate-50 text-slate-400 font-mono border-r border-slate-200">
                                {s.no}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                                {s.code}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200">
                                {s.name}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {s.keep.toFixed(1)}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {s.mid.toFixed(1)}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {s.final.toFixed(1)}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {s.trait.toFixed(1)}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-800 bg-emerald-50/30 border-r border-slate-200">
                                {s.total.toFixed(1)}
                              </td>
                              <td className="p-2.5 text-center font-mono font-black text-purple-900 bg-purple-50/30 border-r border-slate-200">
                                {s.grade}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-flex px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                                  ✓ {s.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 font-mono text-slate-800 sticky bottom-0">
                          <tr>
                            <td colSpan={3} className="p-3 text-center border-r border-slate-300 font-sans">
                              ค่าเฉลี่ยรวมระดับชั้น (X̄ / Average Summary)
                            </td>
                            <td className="p-3 text-center border-r border-slate-300">26.2</td>
                            <td className="p-3 text-center border-r border-slate-300">17.1</td>
                            <td className="p-3 text-center border-r border-slate-300">25.8</td>
                            <td className="p-3 text-center border-r border-slate-300">18.6</td>
                            <td className="p-3 text-center border-r border-slate-300 text-emerald-800 bg-emerald-100">87.7</td>
                            <td className="p-3 text-center border-r border-slate-300 text-purple-900 bg-purple-100">3.82</td>
                            <td className="p-3 text-center text-emerald-700 font-sans">ผ่าน 100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* SHEET 2: STATS */}
                  {activeSheetTab === 'stats' && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-center">
                          <p className="text-xs text-purple-700 font-bold">จำนวนนักเรียนทั้งหมด</p>
                          <p className="text-2xl font-black text-purple-950 mt-1">35 คน</p>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                          <p className="text-xs text-emerald-700 font-bold">ร้อยละที่ผ่านเกณฑ์</p>
                          <p className="text-2xl font-black text-emerald-950 mt-1">100.0%</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                          <p className="text-xs text-blue-700 font-bold">คะแนนเฉลี่ยรวม (X̄)</p>
                          <p className="text-2xl font-black text-blue-950 mt-1">87.70</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                          <p className="text-xs text-amber-700 font-bold">ส่วนเบี่ยงเบนมาตรฐาน (S.D.)</p>
                          <p className="text-2xl font-black text-amber-950 mt-1">5.42</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-900 mb-3">
                          ตารางแจกแจงความถี่ระดับผลการเรียน (Grade Distribution)
                        </h4>
                        <div className="space-y-2.5 text-xs font-sans">
                          {[
                            { grade: 'เกรด 4.0 (80-100 คะแนน)', count: 24, percent: 68.6, color: 'bg-emerald-500' },
                            { grade: 'เกรด 3.5 (75-79 คะแนน)', count: 8, percent: 22.9, color: 'bg-blue-500' },
                            { grade: 'เกรด 3.0 (70-74 คะแนน)', count: 3, percent: 8.5, color: 'bg-amber-500' },
                            { grade: 'เกรด 2.5 - 0.0', count: 0, percent: 0.0, color: 'bg-slate-300' },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-44 font-semibold text-slate-700 shrink-0">{item.grade}</span>
                              <div className="flex-1 bg-slate-200 h-4 rounded-full overflow-hidden">
                                <div className={`${item.color} h-full rounded-full transition-all`} style={{ width: `${item.percent}%` }} />
                              </div>
                              <span className="w-20 font-mono text-right text-slate-600 font-bold">{item.count} คน ({item.percent}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SHEET 3: TRAITS */}
                  {activeSheetTab === 'traits' && (
                    <div className="p-6 space-y-4">
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                        <strong>การประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ:</strong> รักชาติ ศาสน์ กษัตริย์, ซื่อสัตย์สุจริต, มีวินัย, ใฝ่เรียนรู้, อยู่อย่างพอเพียง, มุ่งมั่นในการทำงาน, รักความเป็นไทย, มีจิตสาธารณะ
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                            <tr>
                              <th className="p-3">คุณลักษณะที่ประเมิน</th>
                              <th className="p-3 text-center">ระดับดีเยี่ยม (3)</th>
                              <th className="p-3 text-center">ระดับดี (2)</th>
                              <th className="p-3 text-center">ระดับผ่าน (1)</th>
                              <th className="p-3 text-center">ร้อยละที่ผ่าน</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {['1. รักชาติ ศาสน์ กษัตริย์', '2. ซื่อสัตย์สุจริต', '3. มีวินัย', '4. ใฝ่เรียนรู้', '5. อยู่อย่างพอเพียง', '6. มุ่งมั่นในการทำงาน', '7. รักความเป็นไทย', '8. มีจิตสาธารณะ'].map((t, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-semibold text-slate-800">{t}</td>
                                <td className="p-3 text-center font-mono text-emerald-700 font-bold">32 คน (91.4%)</td>
                                <td className="p-3 text-center font-mono text-blue-700">3 คน (8.6%)</td>
                                <td className="p-3 text-center font-mono text-slate-400">0 คน (0%)</td>
                                <td className="p-3 text-center font-mono font-bold text-emerald-700">100%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WORD (.DOCX) A4 STRUCTURED DOCUMENT VIEWER */}
              {(isDoc || (isPdf && activeViewMode === 'structured')) && (
                <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-300 p-8 sm:p-12 text-slate-900 leading-relaxed font-sans space-y-6 relative transition-transform duration-200 select-text">
                  
                  {/* Official Header */}
                  <div className="flex flex-col items-center justify-center text-center pb-4 border-b-2 border-slate-900/80">
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mb-3 shadow-inner">
                      {isOrderDoc ? (
                        <span className="font-black text-rose-700 text-lg">ครุฑ</span>
                      ) : (
                        <BookOpen className="w-8 h-8 text-purple-700" />
                      )}
                    </div>

                    {isOrderDoc ? (
                      <>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                          คำสั่งโรงเรียนสาธิตเทศบาลวิชาการ
                        </h2>
                        <p className="text-sm font-bold text-slate-800 mt-1">
                          ที่ ๑๔๒ / ๒๕๖๙
                        </p>
                        <p className="text-base font-bold text-slate-900 mt-2">
                          เรื่อง {file.name.replace('.pdf', '').replace('.docx', '')}
                        </p>
                      </>
                    ) : isResearchDoc ? (
                      <>
                        <span className="px-3 py-1 text-xs font-black rounded-full bg-purple-100 text-purple-800 mb-2">
                          รายงานการวิจัยในชั้นเรียน (Classroom Action Research)
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight max-w-xl">
                          {file.name.replace('.pdf', '').replace('.docx', '')}
                        </h2>
                        <p className="text-xs font-semibold text-slate-600 mt-1">
                          กลุ่มบริหารงานวิชาการ • ภาคเรียนที่ ๑ ปีการศึกษา ๒๕๖๙
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="px-3 py-1 text-xs font-black rounded-full bg-purple-100 text-purple-800 mb-2">
                          แผนการจัดการเรียนรู้บูรณาการ Active Learning
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight max-w-xl">
                          {assignmentTitle || file.name.replace('.pdf', '').replace('.docx', '')}
                        </h2>
                        <p className="text-xs font-semibold text-slate-600 mt-1">
                          หลักสูตรสถานศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑ (ฉบับปรับปรุง ๒๕๖๐)
                        </p>
                      </>
                    )}
                  </div>

                  {/* Document Meta Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">ผู้จัดทำ / ผู้ส่ง</span>
                      <strong className="text-slate-900">{submitterName || 'นายสมชาย รักเรียน'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">กลุ่มสาระการเรียนรู้</span>
                      <strong className="text-slate-900">วิทยาศาสตร์และเทคโนโลยี</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ระดับชั้น / ภาคเรียน</span>
                      <strong className="text-slate-900">มัธยมศึกษาปีที่ ๒ (๑/๒๕๖๙)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Google Drive File ID</span>
                      <strong className="text-purple-700 font-mono text-[11px] truncate block">{file.driveFileId || '1IpsaGJ-sample-file-01'}</strong>
                    </div>
                  </div>

                  {/* Document Content */}
                  <div className="space-y-4 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                      <h4 className="font-bold text-purple-950 mb-1">๑. มาตรฐานการเรียนรู้และตัวชี้วัด</h4>
                      <p className="text-slate-700">
                        <strong>มาตรฐาน ว ๔.๒:</strong> เข้าใจและใช้แนวคิดเชิงคำนวณในการแก้ปัญหาที่พบในชีวิตจริงอย่างเป็นขั้นตอนและเป็นระบบ ใช้เทคโนโลยีสารสนเทศและการสื่อสารในการเรียนรู้ การทำงาน และการแก้ปัญหาได้อย่างมีประสิทธิภาพ รู้เท่าทัน และมีจริยธรรม
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">๒. สาระสำคัญ / ความคิดรวบยอด (Key Concept)</h4>
                      <p className="text-slate-700 indent-6">
                        แนวคิดเชิงคำนวณ (Computational Thinking) ประกอบด้วย ๔ องค์ประกอบหลัก ได้แก่ การแบ่งปัญหาใหญ่เป็นปัญหาย่อย (Decomposition), การจดจำรูปแบบ (Pattern Recognition), การคิดเชิงนามธรรม (Abstraction) และการออกแบบอัลกอริทึม (Algorithm Design) ซึ่งเป็นทักษะพื้นฐานสำคัญในการประยุกต์ใช้เพื่อแก้ปัญหาในชีวิตประจำวัน
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">๓. จุดประสงค์การเรียนรู้ (K-P-A)</h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
                        <li><strong>ด้านความรู้ (K):</strong> ผู้เรียนสามารถอธิบายหลักการและขั้นตอนของแนวคิดเชิงคำนวณได้ถูกต้อง (ร้อยละ ๘๐ ขึ้นไป)</li>
                        <li><strong>ด้านทักษะ/กระบวนการ (P):</strong> ผู้เรียนสามารถเขียนผังงาน (Flowchart) และจำลองการแก้ปัญหาได้อย่างเป็นระบบ</li>
                        <li><strong>ด้านคุณลักษณะอันพึงประสงค์ (A):</strong> ผู้เรียนมีความมุ่งมั่นในการทำงานร่วมกันเป็นทีม</li>
                      </ul>
                    </div>

                    {/* Official Signatures */}
                    <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
                      <div>
                        <p className="font-bold text-slate-900">(ลงชื่อ)........................................................</p>
                        <p className="mt-1 font-semibold text-slate-800">({submitterName || 'นายสมชาย รักเรียน'})</p>
                        <p className="text-slate-500">ครูผู้สอน / ผู้รับผิดชอบรายวิชา</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">(ลงชื่อ)........................................................</p>
                        <p className="mt-1 font-semibold text-slate-800">(Admin ผู้ดูแลระบบวิชาการ)</p>
                        <p className="text-slate-500">หัวหน้ากลุ่มบริหารงานวิชาการ</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>โรงเรียนสาธิตเทศบาลวิชาการ • กระทรวงศึกษาธิการ</span>
                    <span>หน้าที่ {currentPage} จากทั้งหมด {totalPages} หน้า</span>
                  </div>
                </div>
              )}

              {/* POWERPOINT (.PPTX) SLIDE VIEWER */}
              {isPresentation && (
                <div className="w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                  <div className="aspect-video w-full bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 p-8 sm:p-14 flex flex-col justify-between text-white relative">
                    <div className="flex items-center justify-between border-b border-white/20 pb-3">
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Presentation className="w-4 h-4" />
                        <span>Academic Slide Deck • โรงเรียนสาธิตเทศบาลวิชาการ</span>
                      </span>
                      <span className="text-xs font-mono text-white/60">Slide {currentSlide} of {totalSlides}</span>
                    </div>

                    {currentSlide === 1 && (
                      <div className="space-y-4 my-auto">
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/30">
                          การนำเสนอผลการปฏิบัติงานที่เป็นเลิศ (Best Practice)
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                          {file.name.replace('.pptx', '').replace('.ppt', '')}
                        </h2>
                        <p className="text-sm sm:text-base text-purple-200 max-w-2xl">
                          การยกระดับผลสัมฤทธิ์ทางการเรียนผ่านนวัตกรรมการสอน Active Learning และเครื่องมือดิจิทัล
                        </p>
                        <p className="text-xs text-slate-400 pt-2">ผู้นำเสนอ: {submitterName || 'นายสมชาย รักเรียน'} • ภาคเรียนที่ ๑/๒๕๖๙</p>
                      </div>
                    )}

                    {currentSlide === 2 && (
                      <div className="space-y-4 my-auto">
                        <h3 className="text-xl sm:text-3xl font-bold text-white">วัตถุประสงค์และเป้าหมายการดำเนินงาน</h3>
                        <ul className="space-y-3 text-sm text-purple-100 pl-4">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                            <span>เพื่อพัฒนาทักษะการคิดเชิงคำนวณและการแก้ปัญหาของผู้เรียน</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                            <span>เพื่อเพิ่มผลสัมฤทธิ์ทางการเรียนในรายวิชาวิทยาการคำนวณให้สูงกว่าเกณฑ์ร้อยละ ๘๐</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {currentSlide === 3 && (
                      <div className="space-y-4 my-auto">
                        <h3 className="text-xl sm:text-3xl font-bold text-white">รูปแบบกระบวนการจัดกิจกรรม Active Learning</h3>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                            <strong className="text-purple-300 block text-sm mb-1">1. Hands-On</strong>
                            <span>เน้นการลงมือปฏิบัติจริงผ่านแบบฝึกหัดและการเขียนโค้ด</span>
                          </div>
                          <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                            <strong className="text-purple-300 block text-sm mb-1">2. Teamwork</strong>
                            <span>การทำงานร่วมกันเป็นทีมผ่านการคิดโครงงานสะเต็ม</span>
                          </div>
                          <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                            <strong className="text-purple-300 block text-sm mb-1">3. Evaluation</strong>
                            <span>การประเมินตามสภาพจริงด้วยเกณฑ์ Rubrics</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentSlide === 4 && (
                      <div className="space-y-4 my-auto text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/30">
                          <Check className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl sm:text-3xl font-bold text-white">สรุปผลการดำเนินงาน</h3>
                        <p className="text-sm text-purple-200 max-w-xl mx-auto">
                          นักเรียนชั้น ม.๒ มีผลสัมฤทธิ์ทางการเรียนผ่านเกณฑ์ 100% มีความพึงพอใจต่อการจัดการเรียนรู้ในระดับดีเยี่ยม
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-white/20 pt-3 text-xs text-slate-400">
                      <span>PowerPoint Presentation View</span>
                      <span>กดปุ่มลูกศรเพื่อเลื่อนสไลด์</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* BOTTOM FOOTER BAR */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">ระบบแสดงตัวอย่างไฟล์ทันที (Instant 1-Click Preview)</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              {hasRealBinaryData ? 'แสดงไฟล์จริงจากข้อมูลที่อัปโหลด' : 'แสดงข้อมูลไฟล์จาก Google Drive'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด {file.name}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
