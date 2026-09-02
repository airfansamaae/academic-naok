import React, { useState, useEffect } from 'react';
import { 
  TopHeader 
} from './components/TopHeader';
import { 
  Sidebar 
} from './components/Sidebar';
import { 
  BottomNav 
} from './components/BottomNav';
import { 
  DashboardView 
} from './components/DashboardView';
import { 
  AssignmentsView 
} from './components/AssignmentsView';
import { 
  TrackingView 
} from './components/TrackingView';
import { 
  DocumentCenterView 
} from './components/DocumentCenterView';
import { 
  LunchView 
} from './components/LunchView';
import { 
  SettingsView 
} from './components/SettingsView';
import { 
  FilePreviewModal 
} from './components/FilePreviewModal';
import { 
  LegendModal 
} from './components/LegendModal';
import { 
  AuthModal 
} from './components/AuthModal';
import { 
  Code, 
  Copy, 
  Check, 
  Terminal, 
  Server, 
  X,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { 
  NavTab, 
  User, 
  SchoolProfile, 
  Assignment, 
  Submission, 
  DocumentItem, 
  Announcement, 
  UploadedFile 
} from './types';
import { storage } from './services/storageService';
import { GAS_CODE_SNIPPET, D1_SCHEMA_SQL } from './services/gasCodeGenerator';
import Swal from 'sweetalert2';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Application Data States - Starts at Login Page every time website is opened
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [school, setSchool] = useState<SchoolProfile>(storage.getSchoolProfile());
  const [assignments, setAssignments] = useState<Assignment[]>(storage.getAssignments());
  const [submissions, setSubmissions] = useState<Submission[]>(storage.getSubmissions());
  const [documents, setDocuments] = useState<DocumentItem[]>(storage.getDocuments());
  const [announcements, setAnnouncements] = useState<Announcement[]>(storage.getAnnouncements());
  const [users, setUsers] = useState<User[]>(storage.getUsers());

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLegendModalOpen, setIsLegendModalOpen] = useState(false);
  const [isDevCodeModalOpen, setIsDevCodeModalOpen] = useState(false);
  const [devCodeTab, setDevCodeTab] = useState<'gas' | 'd1'>('gas');
  const [copiedCode, setCopiedCode] = useState(false);

  // File Preview Modal State
  const [previewModalData, setPreviewModalData] = useState<{
    isOpen: boolean;
    file: UploadedFile | null;
    assignmentTitle?: string;
    uploaderName?: string;
  }>({
    isOpen: false,
    file: null,
  });

  // Load and refresh state helper
  const refreshAllData = () => {
    setCurrentUser(storage.getCurrentUser());
    setSchool(storage.getSchoolProfile());
    setAssignments(storage.getAssignments());
    setSubmissions(storage.getSubmissions());
    setDocuments(storage.getDocuments());
    setAnnouncements(storage.getAnnouncements());
    setUsers(storage.getUsers());
  };

  // 15-Minute Inactivity / Tab Switching Auto-Logout Timer (900,000 ms)
  useEffect(() => {
    if (!currentUser) return;

    let lastActivityTime = Date.now();
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    // User activity listeners (mouse movement, clicks, typing, touch, scrolling)
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, updateActivity, { passive: true });
    });

    const triggerAutoLogout = () => {
      storage.logout();
      setCurrentUser(null);
      setActiveTab('dashboard');
      Swal.fire({
        icon: 'warning',
        title: 'ออกจากระบบอัตโนมัติ (Session Timeout)',
        text: 'ไม่มีการเคลื่อนไหวหรือไปหน้าอื่นเกิน 15 นาที ระบบจึงนำท่านกลับสู่หน้าเข้าสู่ระบบอัตโนมัติเพื่อความปลอดภัย',
        confirmButtonColor: '#7C3AED',
        confirmButtonText: 'เข้าสู่ระบบอีกครั้ง',
      });
    };

    // Check on returning to tab if 15 minutes have elapsed
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (Date.now() - lastActivityTime >= INACTIVITY_LIMIT_MS) {
          triggerAutoLogout();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check interval
    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityTime >= INACTIVITY_LIMIT_MS) {
        triggerAutoLogout();
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  // Subscribe to storage changes & optional SSE events
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      refreshAllData();
    });

    // Optional SSE connection for live updates across browser tabs
    let sseSource: EventSource | null = null;
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        sseSource = new EventSource('/api/sync/sse');
        sseSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && parsed.type === 'DATA_CHANGED') {
              refreshAllData();
            }
          } catch {
            // Safe ignore
          }
        };
        sseSource.onerror = () => {
          // Quietly close if SSE is unavailable or in static/preview mode
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
        };
      }
    } catch {
      // SSE graceful fallback
    }

    return () => {
      unsubscribe();
      if (sseSource) {
        try {
          sseSource.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Open Preview Modal
  const handleOpenFilePreview = (
    file: UploadedFile,
    assignmentTitle?: string,
    uploaderName?: string
  ) => {
    setPreviewModalData({
      isOpen: true,
      file,
      assignmentTitle,
      uploaderName,
    });
  };

  // Handle Logout
  const handleLogout = () => {
    Swal.fire({
      title: 'ต้องการออกจากระบบ?',
      text: 'คุณต้องการลงชื่อออกจากระบบงานวิชาการใช่หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#94A3B8',
      confirmButtonText: 'ใช่, ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
    }).then((res) => {
      if (res.isConfirmed) {
        storage.logout();
        setCurrentUser(null);
        setActiveTab('dashboard');
        Swal.fire({
          icon: 'success',
          title: 'ออกจากระบบสำเร็จ',
          timer: 1400,
          showConfirmButton: false,
        });
      }
    });
  };

  // Handle Switch User Profile (Quick demo switch between Admin and Teachers)
  const handleSwitchUser = (user: User) => {
    storage.setCurrentUser(user);
    setCurrentUser(user);
    Swal.fire({
      icon: 'success',
      title: `สลับผู้ใช้เป็น "${user.fullName}"`,
      text: `สิทธิ์: ${user.role === 'admin' ? 'Master Admin' : 'สมาชิก (Member)'}`,
      toast: true,
      position: 'top-end',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // Copy Code in Dev Inspector
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Pending user badge count for Admin
  const pendingMembersCount = users.filter((u) => u.status === 'pending').length;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <AuthModal
          isOpen={true}
          isFullScreen={true}
          onLoginSuccess={refreshAllData}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col selection:bg-purple-600 selection:text-white font-sans antialiased">
      {/* 1. TOP HEADER (Sticky, Glassmorphism, Logo, System Clock, Notifications, Profile) */}
      <TopHeader
        currentUser={currentUser}
        school={school}
        activeTab={activeTab}
        announcements={announcements}
        users={users}
        onOpenLoginModal={() => setIsAuthModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        onSelectTab={setActiveTab}
        onNavigate={setActiveTab}
      />

      {/* Main Container with Sticky Sidebar (Desktop) and Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col md:flex-row gap-6">
        {/* 2. STICKY SIDEBAR (Desktop) */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onNavigate={setActiveTab}
          currentUser={currentUser}
          school={school}
          pendingCount={pendingMembersCount}
          onOpenLegend={() => setIsLegendModalOpen(true)}
        />

        {/* 3. MAIN CONTENT ROUTER VIEW */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              school={school}
              assignments={assignments}
              submissions={submissions}
              documents={documents}
              users={users}
              announcements={announcements}
              onSelectTab={setActiveTab}
              onNavigate={setActiveTab}
              onOpenFilePreview={handleOpenFilePreview}
              onOpenLegend={() => setIsLegendModalOpen(true)}
            />
          )}

          {activeTab === 'assignments' && (
            <AssignmentsView
              currentUser={currentUser}
              assignments={assignments}
              submissions={submissions}
              users={users}
              announcements={announcements}
              onOpenFilePreview={handleOpenFilePreview}
            />
          )}

          {activeTab === 'tracking' && (
            <TrackingView
              currentUser={currentUser}
              assignments={assignments}
              submissions={submissions}
              onOpenFilePreview={handleOpenFilePreview}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentCenterView
              currentUser={currentUser}
              documents={documents}
              onOpenFilePreview={handleOpenFilePreview}
            />
          )}

          {activeTab === 'lunch' && (
            <LunchView
              currentUser={currentUser}
              school={school}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              school={school}
              users={users}
              onRefreshData={refreshAllData}
            />
          )}
        </main>
      </div>

      {/* 4. FIXED BOTTOM NAVIGATION BAR (Mobile Only) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNavigate={setActiveTab}
        pendingCount={pendingMembersCount}
      />

      {/* FOOTER BAR */}
      <footer className="bg-white/80 border-t border-purple-100 py-3 px-4 text-center text-xs text-slate-500 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">{school?.name || 'โรงเรียนสาธิตเทศบาลวิชาการ'}</span>
            <span>•</span>
            <span>ระบบบริหารจัดการงานวิชาการและศูนย์เอกสาร</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-slate-400">
              สถานะ: <span className="font-medium text-emerald-600">เชื่อมต่อคลาวด์ไดรฟ์ปลอดภัย</span>
            </span>
          </div>
        </div>
      </footer>

      {/* 5. MODALS */}

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={previewModalData.isOpen}
        file={previewModalData.file}
        assignmentTitle={previewModalData.assignmentTitle}
        submitterName={previewModalData.uploaderName}
        onClose={() => setPreviewModalData({ isOpen: false, file: null })}
      />

      {/* Legend Modal (สีม่วง vs สีเขียว) */}
      <LegendModal
        isOpen={isLegendModalOpen}
        onClose={() => setIsLegendModalOpen(false)}
      />

      {/* Auth / Bypass Login Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={refreshAllData}
      />

      {/* Developer / GAS & Cloudflare D1 Code Viewer Modal */}
      {isDevCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-purple-500/30 relative flex flex-col max-h-[85vh]">
            <button
              onClick={() => setIsDevCodeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Backend Architecture & Deployment Artifacts
                </h3>
                <p className="text-xs text-purple-300">
                  Google Apps Script (GAS) Web App & Cloudflare D1 SQL Schema
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-700 pb-3 mb-3">
              <button
                onClick={() => setDevCodeTab('gas')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  devCodeTab === 'gas'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Google Apps Script Code (Code.gs)</span>
              </button>

              <button
                onClick={() => setDevCodeTab('d1')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  devCodeTab === 'd1'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Cloudflare D1 SQL Schema</span>
              </button>

              <div className="ml-auto">
                <button
                  onClick={() => handleCopyCode(devCodeTab === 'gas' ? GAS_CODE_SNIPPET : D1_SCHEMA_SQL)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 rounded-lg transition-all"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกโค้ด</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code container */}
            <div className="flex-1 overflow-y-auto bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs text-purple-200/90 leading-relaxed selection:bg-purple-500 selection:text-white">
              <pre className="whitespace-pre-wrap break-words">
                {devCodeTab === 'gas' ? GAS_CODE_SNIPPET : D1_SCHEMA_SQL}
              </pre>
            </div>

            {/* GAS Rule Banner */}
            <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>กฎเหล็ก GAS:</strong> ห้ามลบโฟลเดอร์หลักหรือโฟลเดอร์ย่อยใน Google Drive โดยอัตโนมัติเด็ดขาด ลบเฉพาะไฟล์เดี่ยวที่ระบุเท่านั้น
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
