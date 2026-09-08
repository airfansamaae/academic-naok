import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileCheck2, 
  FileSearch, 
  FolderGit2, 
  UtensilsCrossed, 
  Settings, 
  Code2,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  FolderOpen
} from 'lucide-react';
import { ActiveTab, User, SchoolProfile } from '../types';
import { isGoogleDriveConnected, googleSignIn, addAuthListener } from '../services/googleAuthService';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onNavigate?: (tab: ActiveTab) => void;
  currentUser: User | null;
  school?: SchoolProfile;
  pendingCount?: number;
  onOpenLegend?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onNavigate,
  currentUser,
  school,
  pendingCount = 0,
  onOpenLegend
}) => {
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(isGoogleDriveConnected());
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const unsub = addAuthListener((_user, token) => {
      setIsDriveConnected(!!token);
    });
    return () => unsub();
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await googleSignIn();
    } catch {
      // handled
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectTab = onSelectTab || onNavigate || (() => {});
  const LUNCH_SCRIPT_URL = 'https://script.google.com/a/macros/krabiedu.go.th/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      sublabel: 'Dashboard & ปฏิทินส่งงาน',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'assignments' as ActiveTab,
      label: 'มอบหมายงาน & ส่งงาน',
      sublabel: currentUser?.role === 'admin' ? 'สร้างงานและตรวจสอบการส่ง' : 'ส่งงานและดูงานที่มอบหมาย',
      icon: FileCheck2,
      badge: null,
    },
    {
      id: 'tracking' as ActiveTab,
      label: 'ติดตามงาน & ตรวจงาน',
      sublabel: 'ตรวจเช็คไฟล์และดาวน์โหลด',
      icon: FileSearch,
      badge: null,
    },
    {
      id: 'documents' as ActiveTab,
      label: 'ศูนย์เอกสาร & คำสั่ง',
      sublabel: 'เอกสารตัวอย่างและคำสั่งโรงเรียน',
      icon: FolderGit2,
      badge: null,
    },
    {
      id: 'lunch' as ActiveTab,
      label: 'ระบบอาหารกลางวัน',
      sublabel: 'ระบบบันทึกและรายงานอาหาร (ลิงก์ตรง)',
      icon: UtensilsCrossed,
      isExternalLink: true,
      url: LUNCH_SCRIPT_URL,
      badge: 'เปิดระบบ ↗',
      badgeColor: 'bg-amber-100 text-amber-800',
    },
  ];

  return (
    <aside className="hidden md:flex w-72 bg-purple-50/60 backdrop-blur-sm border border-purple-200/80 rounded-3xl flex-col justify-between shrink-0 h-[calc(100vh-6rem)] sticky top-20 select-none shadow-sm overflow-hidden">
      {/* Upper Navigation Section */}
      <div className="p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-purple-800/80">
          เมนูหลักระบบวิชาการ
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => {
                if (item.isExternalLink && item.url) {
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                } else {
                  handleSelectTab(item.id);
                }
              }}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-white text-purple-950 font-semibold shadow-xs border border-purple-200/90'
                  : 'text-slate-600 hover:bg-purple-100/70 hover:text-purple-950 border border-transparent'
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-colors shrink-0 mt-0.5 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white/80 text-purple-700 group-hover:bg-purple-600 group-hover:text-white border border-purple-200/60 shadow-2xs'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm font-bold whitespace-nowrap leading-tight ${isActive ? 'text-purple-950' : 'text-slate-800 group-hover:text-purple-950'}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold whitespace-nowrap ${
                        item.badgeColor || 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 leading-none ${isActive ? 'text-purple-600/90' : 'text-slate-500 group-hover:text-purple-700'}`}>
                  {item.sublabel}
                </p>
              </div>

              {isActive && (
                <div className="w-1.5 h-6 bg-purple-600 rounded-full absolute right-2 top-1/2 -translate-y-1/2 shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom User/Drive Status Card */}
      <div className="p-4 border-t border-purple-200/70 bg-purple-100/40">
        <div className="bg-white/95 rounded-2xl p-3.5 border border-purple-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>สิทธิ์การใช้งาน</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                currentUser?.role === 'admin'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {currentUser?.role === 'admin' ? 'Master Admin' : 'อาจารย์ผู้สอน'}
            </span>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="truncate">
              <strong className="text-slate-900">ผู้ใช้:</strong> {currentUser?.fullName || 'ผู้เยี่ยมชม'}
            </p>
            <p className="truncate text-[11px]">
              <strong className="text-slate-900">สังกัด:</strong> {currentUser?.department || '-'}
            </p>
          </div>

          <a
            href={`https://drive.google.com/drive/folders/${school?.primaryDriveFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-purple-900 bg-purple-100/80 hover:bg-purple-200 hover:text-purple-950 rounded-xl transition-all border border-purple-200/90 shadow-2xs group cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-purple-700 group-hover:scale-105 transition-transform" />
              <span>โฟลเดอร์ Google Drive</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {!isDriveConnected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-purple-900 bg-white hover:bg-purple-50 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>{isConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ Google Drive'}</span>
            </button>
          ) : (
            <div className="mt-2 flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>เชื่อมต่อ Google Drive เรียบร้อย</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
