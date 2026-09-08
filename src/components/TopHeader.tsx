import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Settings as SettingsIcon, 
  LogOut, 
  UserCheck, 
  School,
  Database,
  Code2,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { User, SchoolProfile, ActiveTab } from '../types';
import { storage, SyncStatusInfo } from '../services/storageService';
import { 
  isGoogleDriveConnected, 
  googleSignIn, 
  googleLogout, 
  addAuthListener, 
  getCachedGoogleUser 
} from '../services/googleAuthService';
import Swal from 'sweetalert2';

interface TopHeaderProps {
  currentUser: User | null;
  school: SchoolProfile;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onNavigate?: (tab: ActiveTab) => void;
  onLogout: () => void;
  onOpenAuth?: () => void;
  onOpenLoginModal?: () => void;
  announcements?: any[];
  users?: any[];
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  school,
  activeTab = 'dashboard',
  onSelectTab,
  onNavigate,
  onLogout,
  onOpenAuth,
  onOpenLoginModal
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(storage.getSyncStatus());
  const [manualSyncing, setManualSyncing] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(isGoogleDriveConnected());
  const [googleUser, setGoogleUser] = useState<any>(getCachedGoogleUser());
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  useEffect(() => {
    const unsub = storage.subscribeSync((info) => {
      setSyncInfo(info);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubscribeAuth = addAuthListener((user, token) => {
      setIsDriveConnected(!!token);
      setGoogleUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      const res = await googleSignIn();
      if (res && res.user) {
        setIsDriveConnected(true);
        setGoogleUser(res.user);
        Swal.fire({
          icon: 'success',
          title: 'เชื่อมต่อ Google Drive สำเร็จ',
          html: `เชื่อมต่อกับบัญชี <b>${res.user.email}</b> เรียบร้อยแล้ว<br/><span class="text-xs text-slate-500">ไฟล์อัปโหลดทั้งหมดจะถูกบันทึกลงโฟลเดอร์ Google Drive ของโรงเรียนโดยตรง</span>`,
          timer: 2200,
          showConfirmButton: false,
        });
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        Swal.fire({
          icon: 'error',
          title: 'เชื่อมต่อ Google ไม่สำเร็จ',
          text: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
        });
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleManualSync = async () => {
    setManualSyncing(true);
    await storage.pullLatestFromCloud(false);
    setTimeout(() => {
      setManualSyncing(false);
    }, 600);
  };

  const handleSelectTab = onSelectTab || onNavigate || (() => {});
  const handleOpenAuth = onOpenAuth || onOpenLoginModal || (() => {});
  const driveFolderId = school?.primaryDriveFolderId || '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-';
  const driveUrl = `https://drive.google.com/drive/folders/${driveFolderId}?usp=sharing`;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-purple-100/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / School Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-xs overflow-hidden">
              {school?.logoUrl ? (
                <img 
                  src={school.logoUrl} 
                  alt="School Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <School className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
                  {school?.name || 'โรงเรียนสาธิตเทศบาลวิชาการ'}
                </h1>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                ระบบงานวิชาการ มอบหมายงาน-ส่งงาน และศูนย์เอกสาร
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Google Drive Status & Connection Indicator */}
            {isDriveConnected ? (
              <div 
                title={`เชื่อมต่อ Google Drive เรียบร้อย (${googleUser?.email || 'บัญชี Google'})`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-2xs"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <FolderOpen className="w-3 h-3 text-emerald-600" />
                  <span className="hidden sm:inline">Drive เชื่อมต่อแล้ว</span>
                  <span className="sm:hidden">Drive</span>
                </span>
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="เปิดโฟลเดอร์ Google Drive ของโรงเรียน"
                  className="text-emerald-700 hover:text-emerald-950 font-bold ml-1 text-[10px] underline"
                >
                  เปิด
                </a>
              </div>
            ) : (
              <button
                id="header-connect-drive-btn"
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                title="คลิกเพื่อเชื่อมต่อ Google Drive ให้ไฟล์อัปโหลดตรงเข้าสู่ Google Drive ของโรงเรียน"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer shadow-2xs group"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span className="text-[11px]">
                  {isConnectingGoogle ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ Google Drive'}
                </span>
              </button>
            )}

            {/* Live Real-time Sync Indicator */}
            <button
              id="header-realtime-sync-btn"
              onClick={handleManualSync}
              title="ซิงค์ข้อมูล Real-time ทุกเบราว์เซอร์อัตโนมัติ (คลิกเพื่อดึงข้อมูลล่าสุด)"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-600 ${syncInfo.status === 'syncing' || manualSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-semibold">
                {syncInfo.status === 'syncing' || manualSyncing ? 'กำลังซิงค์...' : 'Real-time Sync สด'}
              </span>
            </button>

            {/* Active User Pill */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-900 leading-tight">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] text-purple-600 font-medium">
                    {currentUser.role === 'admin' ? 'Master Admin' : currentUser.department}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-medium text-xs overflow-hidden">
                  {currentUser.role === 'admin' ? (
                    school?.logoUrl ? (
                      <img 
                        src={school.logoUrl} 
                        alt="School Logo (Admin)" 
                        className="w-full h-full object-contain p-0.5"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-purple-700" />
                    )
                  ) : currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.fullName} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{currentUser.fullName.charAt(0)}</span>
                  )}
                </div>

                {/* Small Settings Button */}
                <button
                  id="header-settings-btn"
                  onClick={() => handleSelectTab('settings')}
                  title="การตั้งค่าระบบและโปรไฟล์"
                  className={`p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-slate-200 transition-colors ${
                    activeTab === 'settings' ? 'bg-purple-100 text-purple-800 border-purple-300' : ''
                  }`}
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>

                {/* Small Logout Button */}
                <button
                  id="header-logout-btn"
                  onClick={onLogout}
                  title="ออกจากระบบ"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="header-login-btn"
                onClick={handleOpenAuth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all shadow-xs glow-purple-hover"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ / ลงทะเบียน</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

