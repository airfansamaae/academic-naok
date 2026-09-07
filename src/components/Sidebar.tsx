import React from 'react';
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
    <aside className="hidden md:flex w-72 bg-[#21063d] border border-purple-900/60 rounded-3xl flex-col justify-between shrink-0 h-[calc(100vh-6rem)] sticky top-20 select-none shadow-xl overflow-hidden">
      {/* Upper Navigation Section */}
      <div className="p-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-purple-300/80">
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
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-purple-800/90 text-white font-medium shadow-md border border-purple-600/60'
                  : 'text-purple-200 hover:bg-purple-900/50 hover:text-white border border-transparent'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors shrink-0 mt-0.5 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-900/70 text-purple-300 group-hover:bg-purple-800 group-hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm font-semibold whitespace-nowrap leading-tight ${isActive ? 'text-white font-bold' : 'text-purple-100 group-hover:text-white'}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap ${
                        item.badgeColor || 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 leading-none ${isActive ? 'text-purple-200' : 'text-purple-300/70 group-hover:text-purple-200'}`}>
                  {item.sublabel}
                </p>
              </div>

              {isActive && (
                <div className="w-1.5 h-6 bg-purple-400 rounded-full absolute right-2 top-1/2 -translate-y-1/2 shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom User/Drive Status Card */}
      <div className="p-4 border-t border-purple-900/70 bg-[#19042e]">
        <div className="bg-[#2b0c4f] rounded-xl p-3 border border-purple-800/70 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>สิทธิ์การใช้งาน</span>
            </div>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                currentUser?.role === 'admin'
                  ? 'bg-purple-800/90 text-purple-200 border border-purple-700/60'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
              }`}
            >
              {currentUser?.role === 'admin' ? 'Master Admin' : 'อาจารย์ผู้สอน'}
            </span>
          </div>

          <div className="text-xs text-purple-300/90 space-y-1">
            <p className="truncate">
              <strong className="text-purple-100">ผู้ใช้:</strong> {currentUser?.fullName || 'ผู้เยี่ยมชม'}
            </p>
            <p className="truncate text-[11px]">
              <strong className="text-purple-100">สังกัด:</strong> {currentUser?.department || '-'}
            </p>
          </div>

          <a
            href={`https://drive.google.com/drive/folders/${school?.primaryDriveFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium text-purple-200 bg-[#1e0538] hover:bg-purple-900 hover:text-white rounded-lg transition-colors border border-purple-700/50"
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-purple-300" />
              <span>โฟลเดอร์ Google Drive</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
          </a>
        </div>
      </div>
    </aside>
  );
};
