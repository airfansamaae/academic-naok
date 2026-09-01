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
    <aside className="hidden md:flex w-72 bg-white border border-purple-100 rounded-3xl flex-col justify-between shrink-0 h-[calc(100vh-6rem)] sticky top-20 select-none shadow-xs overflow-hidden">
      {/* Upper Navigation Section */}
      <div className="p-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                  ? 'bg-purple-50/90 text-purple-900 font-medium shadow-2xs border border-purple-200/80 glow-purple'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors shrink-0 mt-0.5 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-700'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold whitespace-nowrap leading-tight text-slate-900 group-hover:text-purple-900">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap ${
                        item.badgeColor || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 group-hover:text-slate-500 truncate mt-0.5 leading-none">
                  {item.sublabel}
                </p>
              </div>

              {isActive && (
                <div className="w-1.5 h-6 bg-purple-600 rounded-full absolute right-2 top-1/2 -translate-y-1/2" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom User/Drive Status Card */}
      <div className="p-4 border-t border-purple-50 bg-slate-50/60">
        <div className="bg-white rounded-xl p-3 border border-purple-100 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>สิทธิ์การใช้งาน</span>
            </div>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                currentUser?.role === 'admin'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {currentUser?.role === 'admin' ? 'Master Admin' : 'อาจารย์ผู้สอน'}
            </span>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p className="truncate">
              <strong className="text-slate-700">ผู้ใช้:</strong> {currentUser?.fullName || 'ผู้เยี่ยมชม'}
            </p>
            <p className="truncate text-[11px]">
              <strong className="text-slate-700">สังกัด:</strong> {currentUser?.department || '-'}
            </p>
          </div>

          <a
            href={`https://drive.google.com/drive/folders/${school?.primaryDriveFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-100"
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>โฟลเดอร์ Google Drive</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
          </a>
        </div>
      </div>
    </aside>
  );
};
