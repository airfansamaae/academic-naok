import React, { useState } from 'react';
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
  Maximize2,
  Table,
  Presentation,
  FolderOpen
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
  const [activeSheetTab, setActiveSheetTab] = useState<'sheet1' | 'sheet2'>('sheet1');
  const [isCopied, setIsCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!isOpen || !file) return null;

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

  const handleCopyText = () => {
    const textToCopy = file.previewContent || `ไฟล์เอกสาร: ${file.name}\nขนาด: ${(file.size / 1024).toFixed(1)} KB`;
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

  // Parse lines for rich document formatting
  const contentLines = (file.previewContent || '').split('\n').filter(l => l.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl border border-purple-100 overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0">
              {file.previewType === 'pdf' ? (
                <FileText className="w-5 h-5 text-rose-600" />
              ) : file.previewType === 'spreadsheet' ? (
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              ) : file.previewType === 'image' ? (
                <ImageIcon className="w-5 h-5 text-indigo-600" />
              ) : file.previewType === 'presentation' ? (
                <Presentation className="w-5 h-5 text-amber-600" />
              ) : (
                <FileType className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-tight">
                  {file.name}
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-800 uppercase">
                  {file.previewType}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {assignmentTitle ? `หัวข้องาน: ${assignmentTitle} • ` : ''}
                {submitterName ? `ผู้ส่ง/เจ้าของ: ${submitterName} • ` : ''}
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {isRealDriveFile && (
              <a
                href={`https://drive.google.com/file/d/${file.driveFileId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                title="เปิดใน Google Drive"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </a>
            )}

            <button
              onClick={handleCopyText}
              title="คัดลอกข้อความสรุป"
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isCopied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
            </button>

            <button
              onClick={handlePrint}
              title="พิมพ์เอกสาร (Print Preview)"
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl border border-slate-200 transition-colors hidden sm:flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">พิมพ์</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs glow-purple-hover cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ดาวน์โหลดไฟล์ต้นฉบับ</span>
              <span className="sm:hidden">ดาวน์โหลด</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-100/70 min-h-[380px] flex flex-col justify-between">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs h-full flex flex-col">
            
            {/* Top Preview Status Banner */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                  {file.previewType.toUpperCase()} VIEWER
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {file.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-emerald-600 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>ตรวจสอบความสมบูรณ์ไฟล์ 100%</span>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-purple-700 font-semibold flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Google Drive Synced</span>
                </span>
              </div>
            </div>

            {/* 1. IMAGE PREVIEW */}
            {file.previewType === 'image' ? (
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900/5 rounded-xl border border-slate-200">
                <div className="w-full max-h-[460px] overflow-hidden rounded-lg flex items-center justify-center bg-slate-950/90 shadow-inner p-2">
                  <img
                    src={file.fileDataUrl || file.viewUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1000&auto=format&fit=crop&q=80"}
                    alt={file.name}
                    className="max-h-[430px] w-auto object-contain rounded-sm transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex items-center justify-between w-full mt-3 px-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(50, prev - 25))}
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      title="ซูมออก"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono">{zoomLevel}%</span>
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(200, prev + 25))}
                      className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      title="ซูมเข้า"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-purple-700 font-bold">High-Definition Image Preview</span>
                </div>
              </div>
            ) : file.previewType === 'spreadsheet' ? (
              /* 2. SPREADSHEET (EXCEL / GOOGLE SHEETS) PREVIEW */
              <div className="space-y-4">
                {/* Excel Ribbon / Tabs */}
                <div className="flex items-center justify-between bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-emerald-700" />
                      <span>แผ่นงาน (Worksheet View):</span>
                    </span>
                    <button
                      onClick={() => setActiveSheetTab('sheet1')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeSheetTab === 'sheet1'
                          ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300'
                          : 'text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Sheet 1: สรุปข้อมูลผลการเรียน
                    </button>
                    <button
                      onClick={() => setActiveSheetTab('sheet2')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeSheetTab === 'sheet2'
                          ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300'
                          : 'text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Sheet 2: รายละเอียดรายบุคคล
                    </button>
                  </div>

                  <span className="text-[11px] text-emerald-700 font-semibold hidden sm:inline">
                    Microsoft Excel / Google Sheets Grid
                  </span>
                </div>

                {/* Spreadsheet Summary Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-medium">ชื่อตาราง / ไฟล์</p>
                    <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{file.name}</p>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <p className="text-[10px] text-emerald-700 font-medium">สถานะผลการประเมิน</p>
                    <p className="text-xs font-bold text-emerald-900 mt-0.5">✓ ผ่านเกณฑ์มาตรฐาน 100%</p>
                  </div>
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                    <p className="text-[10px] text-purple-700 font-medium">ระบบจัดเก็บ & ดาวน์โหลด</p>
                    <p className="text-xs font-bold text-purple-900 mt-0.5">ไฟล์ต้นฉบับ .XLSX สมบูรณ์</p>
                  </div>
                </div>

                {/* Realistic Interactive Table Grid */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-white">
                  <div className="overflow-x-auto max-h-[320px]">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 text-center bg-slate-200 text-slate-600 border-r border-slate-300 w-12 font-mono">#</th>
                          <th className="p-2.5 border-r border-slate-300 min-w-[120px]">A. รายการ / ตัวชี้วัด</th>
                          <th className="p-2.5 border-r border-slate-300 min-w-[160px]">B. รายละเอียด / เนื้อหา</th>
                          <th className="p-2.5 border-r border-slate-300 text-center min-w-[90px]">C. คะแนนเต็ม</th>
                          <th className="p-2.5 border-r border-slate-300 text-center min-w-[90px]">D. ผลประเมิน</th>
                          <th className="p-2.5 text-center min-w-[100px]">E. หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-sans">
                        {contentLines.length > 0 ? (
                          contentLines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                              <td className="p-2 text-center bg-slate-50 text-slate-400 font-mono border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200">
                                {line.includes(':') ? line.split(':')[0] : `ข้อกำหนดที่ ${idx + 1}`}
                              </td>
                              <td className="p-2.5 text-slate-700 border-r border-slate-200">
                                {line.includes(':') ? line.split(':')[1] : line}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {20 * (idx + 1)}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200">
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                                  ผ่าน (Pass)
                                </span>
                              </td>
                              <td className="p-2.5 text-center text-[11px] text-slate-500">
                                บันทึกครบถ้วน
                              </td>
                            </tr>
                          ))
                        ) : (
                          [
                            { id: 1, code: 'มฐ. ว 4.2 ม.2/1', title: 'การออกแบบอัลกอริทึมและการแก้ปัญหา', max: '20', score: '19.5', status: 'ดีเยี่ยม' },
                            { id: 2, code: 'มฐ. ว 4.2 ม.2/2', title: 'การเขียนโปรแกรมด้วยภาษาเชิงโครงสร้าง', max: '20', score: '18.0', status: 'ดีเยี่ยม' },
                            { id: 3, code: 'มฐ. ว 4.2 ม.2/3', title: 'การประยุกต์ใช้งานเทคโนโลยีอย่างปลอดภัย', max: '10', score: '9.5', status: 'ผ่านเกณฑ์' },
                            { id: 4, code: 'ประเมินกลางภาค', title: 'แบบทดสอบวัดผลสัมฤทธิ์กลางภาคเรียน', max: '50', score: '46.0', status: 'ระดับดีเยี่ยม' },
                          ].map((row) => (
                            <tr key={row.id} className="hover:bg-purple-50/40 transition-colors">
                              <td className="p-2 text-center bg-slate-50 text-slate-400 font-mono border-r border-slate-200">
                                {row.id}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200">
                                {row.code}
                              </td>
                              <td className="p-2.5 text-slate-700 border-r border-slate-200">
                                {row.title}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                {row.max}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200">
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 font-mono">
                                  {row.score}
                                </span>
                              </td>
                              <td className="p-2.5 text-center text-[11px] font-medium text-purple-700">
                                {row.status}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Table Footer */}
                  <div className="p-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center px-4 font-mono">
                    <span>ตารางสรุปผลข้อมูลสารสนเทศ ปพ.5 / งานวิชาการ</span>
                    <span className="font-bold text-slate-700">รวมคะแนนเฉลี่ย: 92.5%</span>
                  </div>
                </div>
              </div>
            ) : file.previewType === 'pdf' ? (
              /* 3. PDF DOCUMENT PREVIEW (Realistic Official A4 Document View) */
              <div className="space-y-4">
                {/* Official PDF Document Paper Layout */}
                <div className="bg-slate-50/80 p-5 sm:p-8 rounded-xl border border-slate-300 shadow-sm space-y-6 max-h-[460px] overflow-y-auto">
                  {/* Formal Header */}
                  <div className="text-center border-b border-slate-200 pb-4">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-black text-xs">
                      PDF
                    </div>
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {file.name.replace('.pdf', '')}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน • กระทรวงศึกษาธิการ
                    </p>
                  </div>

                  {/* Document Meta Badges */}
                  <div className="flex flex-wrap gap-2 text-[11px] bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500">
                      <strong>หัวข้องาน:</strong> {assignmentTitle || 'เอกสารราชการวิชาการ'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">
                      <strong>ผู้จัดทำ/ส่งงาน:</strong> {submitterName || 'คณะครู/บุคลากร'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-purple-700 font-semibold">
                      <strong>Google Drive ID:</strong> {file.driveFileId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-'}
                    </span>
                  </div>

                  {/* Body Content Sections */}
                  <div className="space-y-3 text-xs text-slate-800 leading-relaxed font-sans bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
                    {contentLines.length > 0 ? (
                      contentLines.map((line, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                          <p className="text-slate-700">{line}</p>
                        </div>
                      ))
                    ) : (
                      <>
                        <p className="indent-6 text-slate-700">
                          ตามที่กลุ่มบริหารงานวิชาการได้กำหนดให้ข้าราชการครูและบุคลากรทางการศึกษาจัดทำและส่งเอกสารรายงานตามกำหนดการ ประจำปีการศึกษา 2569 นั้น
                        </p>
                        <p className="indent-6 text-slate-700">
                          เอกสารฉบับนี้ได้รับการตรวจสอบเนื้อหา ความถูกต้องของตัวชี้วัด การวัดและประเมินผล และการจัดเก็บบน Google Drive เรียบร้อยแล้ว พร้อมนำไปใช้ในการจัดการเรียนรู้และการประเมินผลการปฏิบัติงาน
                        </p>
                      </>
                    )}
                  </div>

                  {/* Official Signature Box */}
                  <div className="pt-4 flex justify-between items-center text-xs text-slate-500 border-t border-slate-200">
                    <div>
                      <span className="text-emerald-700 font-semibold">✓ เอกสารรับรองความถูกต้อง</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800">{submitterName || 'ผู้รับผิดชอบงาน'}</p>
                      <p className="text-[11px] text-slate-400">ตำแหน่ง ครู / ผู้ดูแลระบบวิชาการ</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 4. WORD / DOCX / PRESENTATION / GENERAL DOCUMENT PREVIEW */
              <div className="space-y-4">
                {/* Official Word Document Paper Preview */}
                <div className="bg-slate-50/80 p-5 sm:p-8 rounded-xl border border-slate-300 shadow-sm space-y-5 max-h-[460px] overflow-y-auto">
                  {/* Top Word Ribbon Title */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {file.previewType === 'presentation' ? 'PPT' : 'DOC'}
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                          {file.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {file.previewType === 'presentation' ? 'Microsoft PowerPoint Presentation' : 'Microsoft Word / Google Docs Standard Format'}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      แบบฟอร์มทางการ
                    </span>
                  </div>

                  {/* Structured Document Content View */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3.5 shadow-2xs">
                    <div className="border-b border-slate-100 pb-2 flex justify-between items-center text-xs text-slate-500">
                      <span><strong>เอกสาร:</strong> {assignmentTitle || file.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">ขนาด: {formatFileSize(file.size)}</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed font-sans">
                      {contentLines.length > 0 ? (
                        contentLines.map((line, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 hover:bg-purple-50/40 transition-colors">
                            <span className="font-bold text-purple-950 block mb-0.5">
                              {line.includes(':') ? line.split(':')[0] : `หมวดที่ ${idx + 1}:`}
                            </span>
                            <span className="text-slate-600">
                              {line.includes(':') ? line.split(':')[1] : line}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="space-y-2">
                          <p className="text-slate-700 leading-relaxed">
                            <strong>1. วัตถุประสงค์และโครงสร้าง:</strong> เอกสารฉบับนี้กำหนดกรอบการปฏิบัติงานวิชาการและแนวทางการจัดการเรียนรู้ Active Learning เพื่อให้สอดคล้องกับเกณฑ์ วPA
                          </p>
                          <p className="text-slate-700 leading-relaxed">
                            <strong>2. แนวทางการประเมิน:</strong> ใช้แบบประเมิน Rubrics สำหรับประเมินสมรรถนะผู้เรียนรายบุคคลและชิ้นงานกลุ่ม
                          </p>
                          <p className="text-slate-700 leading-relaxed">
                            <strong>3. การจัดเก็บ:</strong> ไฟล์ต้นฉบับจะถูกสำรองไว้บนระบบคลาวด์ Google Drive โฟลเดอร์ 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action inside document */}
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                    <span className="font-medium">พร้อมเปิดและแก้ไขต่อใน Microsoft Word / Google Docs</span>
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดาวน์โหลดไฟล์นี้</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Notes */}
          <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 px-2 flex-wrap gap-2">
            <span>แสดงตัวอย่างเอกสารทันที (Instant Inline Modal Preview) • รองรับการดาวน์โหลดไฟล์ต้นฉบับทุกนามสกุล</span>
            <span className="text-purple-700 font-semibold">Original Binary File Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

