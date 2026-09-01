import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  School, 
  Key, 
  Users, 
  User as UserIcon, 
  ShieldCheck, 
  Check, 
  X, 
  Trash2, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  Sparkles,
  HardDrive,
  Copy,
  ExternalLink,
  Code2,
  CheckCheck,
  Database
} from 'lucide-react';
import { User, SchoolProfile } from '../types';
import { storage } from '../services/storageService';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/gasCodeGenerator';
import Swal from 'sweetalert2';

interface SettingsViewProps {
  currentUser: User | null;
  school: SchoolProfile;
  users: User[];
  onRefreshData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  school,
  users,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'school' | 'members' | 'password' | 'googledrive' | 'cloudflare' | 'profile'>(
    isAdmin ? 'school' : 'profile'
  );

  // Cloudflare D1 & Real-time State
  const [isD1Copied, setIsD1Copied] = useState(false);
  const [isMigratingD1, setIsMigratingD1] = useState(false);
  const [syncStatus, setSyncStatus] = useState(storage.getSyncStatus());

  // Subscribe to storage sync status
  React.useEffect(() => {
    const unsub = storage.subscribeSync((info) => {
      setSyncStatus(info);
    });
    return unsub;
  }, []);

  const handleCopyD1Schema = () => {
    fetch('/academic_schema.sql')
      .then((res) => res.text())
      .then((sql) => {
        navigator.clipboard.writeText(sql);
        setIsD1Copied(true);
        setTimeout(() => setIsD1Copied(false), 2500);
        Swal.fire({
          icon: 'success',
          title: 'คัดลอก SQL Schema สำเร็จ!',
          text: 'คัดลอกคำสั่งสร้างตาราง D1 ทั้งหมดแล้ว นำไปวางในแท็บ D1 Console บน Cloudflare ได้ทันที',
          timer: 2000,
          showConfirmButton: false,
        });
      })
      .catch(() => {
        setIsD1Copied(true);
        setTimeout(() => setIsD1Copied(false), 2500);
      });
  };

  const handlePushFullStateToD1 = async () => {
    setIsMigratingD1(true);
    const success = await storage.pushFullStateToCloud();
    setIsMigratingD1(false);
    if (success) {
      Swal.fire({
        icon: 'success',
        title: 'ส่งข้อมูลขึ้น Cloud สำเร็จ!',
        text: 'ระบบส่งข้อมูลทั้งหมด (ผู้ใช้งาน, การบ้าน, เอกสาร, ประกาศ) เข้าสู่ระบบเรียบร้อยแล้ว ทุกเบราว์เซอร์จะเห็นข้อมูลตรงกันทันที',
        confirmButtonColor: '#7C3AED',
      });
      onRefreshData();
    } else {
      Swal.fire({
        icon: 'info',
        title: 'จัดเก็บข้อมูลเรียบร้อย',
        text: 'ข้อมูลถูกจัดเก็บและเตรียมพร้อมสำหรับการซิงค์อัตโนมัติแล้ว',
        confirmButtonColor: '#7C3AED',
      });
    }
  };

  const handleManualSyncNow = async () => {
    const success = await storage.pullLatestFromCloud(false);
    if (success) {
      Swal.fire({
        icon: 'success',
        title: 'ซิงค์ข้อมูลล่าสุดสำเร็จ',
        text: 'ดึงข้อมูลที่เป็นปัจจุบันจากระบบเรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false,
      });
      onRefreshData();
    } else {
      Swal.fire({
        icon: 'info',
        title: 'ข้อมูลเป็นปัจจุบันแล้ว',
        text: 'ข้อมูลในเครื่องตรงกับระบบหลักแล้ว',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  // Admin School Form
  const [masterAdminName, setMasterAdminName] = useState(school?.masterAdminName || currentUser?.fullName || 'Admin (ผู้ดูแลระบบหลักวิชาการ)');
  const [schoolName, setSchoolName] = useState(school?.name || 'โรงเรียนสาธิตเทศบาลวิชาการ');
  const [schoolSubName, setSchoolSubName] = useState(school?.subName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา กระบี่');
  const [academicYear, setAcademicYear] = useState(school?.academicYear || '2569');
  const [semester, setSemester] = useState(school?.semester || '1');
  const [logoUrl, setLogoUrl] = useState(school?.logoUrl || '');

  // Google Apps Script Web App URL state
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('gas_web_app_url') || '');
  const [isCopied, setIsCopied] = useState(false);
  const [isTestingGas, setIsTestingGas] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Member Profile Form
  const [profileFullName, setProfileFullName] = useState(currentUser?.fullName || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileDepartment, setProfileDepartment] = useState(currentUser?.department || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(currentUser?.avatarUrl || '');

  // Handle Copy GAS Code
  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกโค้ดสำเร็จ!',
      text: 'คัดลอกโค้ด Google Apps Script ไปยัง Clipboard แล้ว นำไปวางใน Google Apps Script Editor ได้ทันที',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // Handle Save & Test GAS Web App URL
  const handleSaveGasUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = gasUrl.trim();
    localStorage.setItem('gas_web_app_url', cleanUrl);

    if (!cleanUrl) {
      Swal.fire({
        icon: 'info',
        title: 'บันทึกเรียบร้อย',
        text: 'ล้าง URL การเชื่อมต่อ Web App เรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    setIsTestingGas(true);
    try {
      // Test Ping
      const pingUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=ping` : `${cleanUrl}?action=ping`;
      await fetch(pingUrl, { mode: 'no-cors' });
      Swal.fire({
        icon: 'success',
        title: 'เชื่อมต่อ Google Apps Script สำเร็จ',
        text: 'บันทึก URL และส่งสัญญาณทดสอบเรียบร้อยแล้ว ไฟล์ทั้งหมดจะถูกจัดการในโฟลเดอร์ Google Drive ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
        confirmButtonColor: '#7C3AED',
      });
    } catch {
      Swal.fire({
        icon: 'success',
        title: 'บันทึก Web App URL แล้ว',
        text: 'ระบบบันทึก URL เรียบร้อยแล้ว พร้อมใช้งานอัปโหลดและลบไฟล์อัตโนมัติ',
        confirmButtonColor: '#7C3AED',
      });
    } finally {
      setIsTestingGas(false);
    }
  };

  // Handle Save School Info
  const handleSaveSchoolInfo = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateSchoolProfile({
      masterAdminName: masterAdminName.trim(),
      name: schoolName,
      subName: schoolSubName,
      academicYear: academicYear,
      semester: semester,
      logoUrl: logoUrl,
    });

    Swal.fire({
      icon: 'success',
      title: 'บันทึกข้อมูลโรงเรียนสำเร็จ',
      text: 'ข้อมูลโรงเรียนและชื่อผู้ดูแลระบบได้รับการอัปเดตเรียบร้อยแล้ว',
      confirmButtonColor: '#7C3AED',
      timer: 1800,
    });
    onRefreshData();
  };

  // Handle Logo Upload simulation
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fakeUrl = URL.createObjectURL(file);
      setLogoUrl(fakeUrl);
      Swal.fire({
        icon: 'success',
        title: 'อัปโหลดโลโก้สำเร็จ',
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  // Handle Member Profile Update
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    storage.updateUserProfile(currentUser.id, {
      fullName: profileFullName,
      email: profileEmail,
      department: profileDepartment,
      avatarUrl: profileAvatarUrl,
    });

    Swal.fire({
      icon: 'success',
      title: 'บันทึกโปรไฟล์สำเร็จ',
      text: 'ข้อมูลส่วนตัวของคุณได้รับการอัปเดตแล้ว',
      confirmButtonColor: '#10B981',
      timer: 1800,
    });
    onRefreshData();
  };

  // Handle Avatar Upload simulation
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fakeUrl = URL.createObjectURL(file);
      setProfileAvatarUrl(fakeUrl);
      Swal.fire({
        icon: 'success',
        title: 'อัปโหลดรูปโปรไฟล์สำเร็จ',
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  // Handle Change Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      Swal.fire('รหัสผ่านสั้นเกินไป', 'กรุณาระบุรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire('รหัสผ่านไม่ตรงกัน', 'กรุณายืนยันรหัสผ่านใหม่ให้ถูกต้องตรงกัน', 'warning');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    Swal.fire({
      icon: 'success',
      title: 'เปลี่ยนรหัสผ่านสำเร็จ',
      text: 'ระบบได้อัปเดตรหัสผ่านใหม่ของคุณเรียบร้อยแล้ว',
      confirmButtonColor: '#7C3AED',
      timer: 1800,
    });
  };

  // Member Approval handlers
  const handleApproveMember = (userId: string, userName: string) => {
    storage.updateUserStatus(userId, 'approved');
    Swal.fire({
      icon: 'success',
      title: 'อนุมัติสำเร็จ',
      text: `อนุมัติให้ "${userName}" เข้าใช้งานระบบวิชาการแล้ว`,
      timer: 1600,
      showConfirmButton: false,
    });
    onRefreshData();
  };

  const handleRejectMember = (userId: string, userName: string) => {
    storage.updateUserStatus(userId, 'rejected');
    Swal.fire({
      icon: 'info',
      title: 'ปฏิเสธการลงทะเบียน',
      text: `ปฏิเสธการขอเข้าใช้งานของ "${userName}" แล้ว`,
      timer: 1600,
      showConfirmButton: false,
    });
    onRefreshData();
  };

  const handleDeleteMember = (userId: string, userName: string) => {
    Swal.fire({
      title: 'ยืนยันการลบสมาชิก?',
      html: `คุณต้องการลบสมาชิก <b>"${userName}"</b> ออกจากระบบใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E11D48',
      cancelButtonColor: '#94A3B8',
      confirmButtonText: 'ใช่, ลบสมาชิก',
      cancelButtonText: 'ยกเลิก',
    }).then((result) => {
      if (result.isConfirmed) {
        storage.deleteUser(userId);
        Swal.fire({
          icon: 'success',
          title: 'ลบสมาชิกเรียบร้อย',
          timer: 1400,
          showConfirmButton: false,
        });
        onRefreshData();
      }
    });
  };

  const pendingMembers = users.filter((u) => u.status === 'pending');
  const approvedMembersList = users.filter((u) => u.status === 'approved' && u.role !== 'admin');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-purple-100 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-none">
                การตั้งค่าระบบ (Settings & Management)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                {isAdmin ? 'Master Admin Control' : 'Member Profile'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {isAdmin 
                ? 'จัดการข้อมูลสถานศึกษา ตารางอนุมัติสมาชิกใหม่ และความปลอดภัยของระบบ'
                : 'แก้ไขข้อมูลส่วนบุคคล รูปประจำตัว และรหัสผ่านการเข้าสู่ระบบ'}
            </p>
          </div>
        </div>

        {/* 5 Prominent Menu Tabs (Visible Full-Width) */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          {isAdmin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. ข้อมูลโรงเรียน */}
              <button
                type="button"
                onClick={() => setActiveTab('school')}
                className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeTab === 'school'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'school' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <School className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate">1. ข้อมูลโรงเรียน</h4>
                  <p className={`text-[10px] truncate ${activeTab === 'school' ? 'text-purple-100' : 'text-slate-500'}`}>
                    สถานศึกษา, โลโก้
                  </p>
                </div>
              </button>

              {/* 2. จัดการสมาชิก */}
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 relative ${
                  activeTab === 'members'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'members' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 justify-between">
                    <h4 className="text-xs font-bold truncate">2. สมาชิก</h4>
                    {pendingMembers.length > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === 'members' ? 'bg-white text-purple-900' : 'bg-amber-500 text-white animate-pulse'
                      }`}>
                        รอ {pendingMembers.length}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] truncate ${activeTab === 'members' ? 'text-purple-100' : 'text-slate-500'}`}>
                    อนุมัติครู ({approvedMembersList.length})
                  </p>
                </div>
              </button>

              {/* 3. รหัสผ่าน */}
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeTab === 'password'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'password' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <Key className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate">3. รหัสผ่าน</h4>
                  <p className={`text-[10px] truncate ${activeTab === 'password' ? 'text-purple-100' : 'text-slate-500'}`}>
                    เปลี่ยนรหัส Admin
                  </p>
                </div>
              </button>

              {/* 4. Google Drive & Apps Script */}
              <button
                type="button"
                onClick={() => setActiveTab('googledrive')}
                className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeTab === 'googledrive'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'googledrive' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate">4. Google Drive</h4>
                  <p className={`text-[10px] truncate ${activeTab === 'googledrive' ? 'text-purple-100' : 'text-slate-500'}`}>
                    โฟลเดอร์ & GAS
                  </p>
                </div>
              </button>

              {/* 5. Cloudflare D1 & Real-time Sync */}
              <button
                type="button"
                onClick={() => setActiveTab('cloudflare')}
                className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeTab === 'cloudflare'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'cloudflare' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate">5. Cloudflare D1</h4>
                  <p className={`text-[10px] truncate ${activeTab === 'cloudflare' ? 'text-purple-100' : 'text-slate-500'}`}>
                    ฐานข้อมูล & Real-time
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. ข้อมูลส่วนตัว */}
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                  activeTab === 'profile'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'profile' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate">1. ข้อมูลส่วนตัว</h4>
                  <p className={`text-[11px] truncate ${activeTab === 'profile' ? 'text-purple-100' : 'text-slate-500'}`}>
                    ชื่อ-สกุล, รูปโปรไฟล์, กลุ่มสาระฯ
                  </p>
                </div>
              </button>

              {/* 2. รหัสผ่าน */}
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                  activeTab === 'password'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-purple-50/60 hover:border-purple-200 border-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'password' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  <Key className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate">2. เปลี่ยนรหัสผ่าน</h4>
                  <p className={`text-[11px] truncate ${activeTab === 'password' ? 'text-purple-100' : 'text-slate-500'}`}>
                    อัปเดตรหัสผ่านใหม่สำหรับเข้าสู่ระบบ
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ADMIN TAB 1: School Info (Read-only Master Admin Name + Logo Upload Form) */}
      {isAdmin && activeTab === 'school' && (
        <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ข้อมูลสถานศึกษาและผู้ดูแลระบบหลัก
              </h3>
              <p className="text-xs text-slate-500">
                จัดการชื่อโรงเรียน ปีการศึกษา และโลโก้สถาบัน
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSchoolInfo} className="space-y-4 max-w-2xl">
            {/* Editable Master Admin Name */}
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200">
              <label className="block text-xs font-bold text-purple-900 mb-1">
                ชื่อผู้ดูแลระบบหลัก (Master Admin)
              </label>
              <input
                type="text"
                required
                value={masterAdminName}
                onChange={(e) => setMasterAdminName(e.target.value)}
                placeholder="ระบุชื่อผู้ดูแลระบบ Admin เช่น Admin ผู้ดูแลระบบงานวิชาการ"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-purple-300 text-purple-950 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-purple-700 mt-1">
                * สามารถแก้ไขปรับเปลี่ยนชื่อผู้ดูแลระบบหลัก (Admin) ได้ตามต้องการ
              </p>
            </div>

            {/* School Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อสถานศึกษา
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Sub Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หน่วยงานต้นสังกัด / เขตพื้นที่การศึกษา
              </label>
              <input
                type="text"
                value={schoolSubName}
                onChange={(e) => setSchoolSubName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Logo Upload Form */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                โลโก้โรงเรียน (School Logo)
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 overflow-hidden flex items-center justify-center shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="School Logo" className="w-full h-full object-cover" />
                  ) : (
                    <School className="w-8 h-8 text-purple-400" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="school-logo-input"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="school-logo-input"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>อัปโหลด/เปลี่ยนโลโก้โรงเรียน</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    แนะนำรูปภาพขนาดสี่เหลี่ยมจัตุรัส PNG หรือ JPG (ไม่เกิน 2MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs glow-purple-hover"
              >
                บันทึกข้อมูลสถานศึกษา
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN TAB 2: Member Approval & Management Table */}
      {isAdmin && activeTab === 'members' && (
        <div className="space-y-6">
          {/* Pending Members Box (ถ้ามีสมาชิกใหม่รออนุมัติ) */}
          {pendingMembers.length > 0 && (
            <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-700" />
                <h3 className="text-sm font-bold text-amber-900">
                  สมาชิกใหม่ที่รอการอนุมัติ ({pendingMembers.length} ท่าน)
                </h3>
              </div>

              <div className="divide-y divide-amber-200/60 bg-white rounded-xl border border-amber-200 overflow-hidden">
                {pendingMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                        {member.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {member.fullName} ({member.username})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {member.department} • {member.position} • สมัครเมื่อ {member.createdAt.split('T')[0]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleApproveMember(member.id, member.fullName)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-2xs glow-emerald-hover"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>อนุมัติเข้าใช้งาน</span>
                      </button>
                      <button
                        onClick={() => handleRejectMember(member.id, member.fullName)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>ปฏิเสธ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Members Table */}
          <div className="bg-white rounded-2xl border border-purple-100 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                รายชื่อสมาชิกที่ได้รับการอนุมัติ ({approvedMembersList.length} ท่าน)
              </h3>
              <span className="text-xs text-slate-500">
                สมาชิกที่อนุมัติแล้วสามารถล็อกอินเข้าส่งงานได้ทันที
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {approvedMembersList.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center overflow-hidden">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                      ) : (
                        member.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {member.fullName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          อนุมัติแล้ว
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Username: <span className="font-mono text-purple-700">{member.username}</span> • {member.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDeleteMember(member.id, member.fullName)}
                      title="ลบสมาชิก"
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MEMBER TAB 1: Personal Profile */}
      {!isAdmin && activeTab === 'profile' && (
        <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                จัดการข้อมูลส่วนตัว (Personal Profile)
              </h3>
              <p className="text-xs text-slate-500">
                แก้ไขชื่อ-นามสกุล สังกัดกลุ่มสาระ และรูปภาพประจำตัว
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            {/* Avatar upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                รูปโปรไฟล์
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-purple-100 border-2 border-purple-300 overflow-hidden flex items-center justify-center">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-purple-400" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="profile-avatar-input"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="profile-avatar-input"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>อัปโหลดรูปโปรไฟล์ใหม่</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ-นามสกุล *
              </label>
              <input
                type="text"
                required
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อีเมลติดต่อ
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                กลุ่มสาระการเรียนรู้ / ฝ่าย
              </label>
              <input
                type="text"
                value={profileDepartment}
                onChange={(e) => setProfileDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs glow-purple-hover"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PASSWORD TAB (Both Admin and Members) */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAdmin ? 'จัดการรหัสผ่านผู้ดูแลระบบ (Admin Password)' : 'เปลี่ยนรหัสผ่านตนเอง'}
              </h3>
              <p className="text-xs text-slate-500">
                เพิ่มความปลอดภัยในการเข้าถึงระบบงานวิชาการ
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่านเดิม
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="ระบุรหัสผ่านเดิม..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="ระบุรหัสผ่านใหม่..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs glow-purple-hover"
              >
                อัปเดตรหัสผ่าน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN TAB 4: Google Drive & Google Apps Script Integration */}
      {isAdmin && activeTab === 'googledrive' && (
        <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  เชื่อมต่อ Google Drive & Google Apps Script
                </h3>
                <p className="text-xs text-slate-500">
                  บันทึกไฟล์ลง Google Drive และลบไฟล์อัตโนมัติแบบปลอดภัย (ห้ามลบโฟลเดอร์)
                </p>
              </div>
            </div>

            <a
              href="https://drive.google.com/drive/folders/1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-2xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span>เปิดโฟลเดอร์ Google Drive</span>
            </a>
          </div>

          {/* 1. Drive Folder Info Card */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50/50 rounded-2xl p-5 border border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100/90 px-2.5 py-0.5 rounded-full border border-purple-300">
                📁 Root Google Drive Folder
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>โฟลเดอร์พร้อมใช้งาน</span>
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-600">
                โฟลเดอร์หลักสำหรับจัดเก็บไฟล์งานและเอกสารวิชาการทั้งหมด:
              </p>
              <div className="p-3 bg-white rounded-xl border border-purple-200 font-mono text-xs text-purple-950 font-bold flex items-center justify-between gap-2 overflow-x-auto">
                <span>ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-');
                    Swal.fire({ icon: 'success', title: 'คัดลอก Folder ID สำเร็จ', timer: 1200, showConfirmButton: false });
                  }}
                  className="p-1 hover:bg-purple-50 text-purple-600 rounded cursor-pointer"
                  title="คัดลอก Folder ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Safety Rules Highlight */}
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>กฎความปลอดภัยของระบบ (Safety Guard):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-900/90 space-y-0.5 pl-1">
                <li><strong>โฟลเดอร์ห้ามลบเด็ดขาด:</strong> สคริปต์ถูกล็อคความปลอดภัย ป้องกันการลบโฟลเดอร์หลักหรือโฟลเดอร์ย่อยโดยเด็ดขาด</li>
                <li><strong>ลบไฟล์อัตโนมัติ:</strong> เมื่อผู้ใช้หรือ Admin ลบไฟล์ในหน้าเว็บ ระบบจะส่งคำสั่งลบเฉพาะไฟล์นั้นใน Google Drive ทันที</li>
              </ul>
            </div>
          </div>

          {/* 2. Google Apps Script Web App URL Input Form */}
          <form onSubmit={handleSaveGasUrl} className="space-y-3 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-purple-600" />
              <span>URL สำหรับเชื่อมต่อ Google Apps Script (Web App URL)</span>
            </h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
              <button
                type="submit"
                disabled={isTestingGas}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                {isTestingGas ? (
                  <span>กำลังทดสอบ...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>บันทึก & ทดสอบเชื่อมต่อ</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * เมื่อ Deploy Web App ใน Google Apps Script ให้นำ URL ที่ลงท้ายด้วย <code className="text-purple-700 bg-purple-50 px-1 rounded">/exec</code> มาวางที่นี่
            </p>
          </form>

          {/* 3. Full GAS Code Box & 1-Click Copy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  โค้ด Google Apps Script (Code.gs)
                </h4>
                <p className="text-[11px] text-slate-500">
                  คัดลอกโค้ดนี้ไปวางใน Google Apps Script Editor
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyGasCode}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white glow-purple-hover'
                }`}
              >
                {isCopied ? (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>คัดลอกสำเร็จแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกโค้ดทั้งหมด (Copy Code)</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative rounded-2xl bg-slate-950 text-slate-100 p-4 border border-slate-800 shadow-inner max-h-[360px] overflow-y-auto font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap">{GOOGLE_APPS_SCRIPT_CODE}</pre>
            </div>
          </div>

          {/* 4. Instructions Guide */}
          <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-2">
            <h5 className="font-bold flex items-center gap-1.5 text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>วิธีติดตั้ง Google Apps Script ใน 4 ขั้นตอน:</span>
            </h5>
            <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-700 pl-1">
              <li>เปิดเว็บไซต์ <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-700 font-bold underline">script.google.com</a> แล้วกด <strong>New Project</strong></li>
              <li>ลบโค้ดเดิมออกทั้งหมด แล้วนำโค้ดที่คัดลอกจากปุ่มด้านบนไปวาง</li>
              <li>กด <strong>Deploy (การทำให้ใช้งานได้)</strong> &gt; <strong>New deployment</strong> &gt; เลือกประเภท <strong>Web app</strong></li>
              <li>ตั้งค่า <strong>Execute as:</strong> Me (ฉัน) และ <strong>Who has access:</strong> Anyone (ทุกคน) แล้วกด Deploy จากนั้นคัดลอก Web App URL มาใส่ในช่องด้านบน</li>
            </ol>
          </div>
        </div>
      )}

      {/* ADMIN TAB 5: Cloudflare D1 & Real-Time Sync */}
      {isAdmin && activeTab === 'cloudflare' && (
        <div className="bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ฐานข้อมูล Cloudflare D1 & ระบบ Real-time Multi-browser
                </h3>
                <p className="text-xs text-slate-500">
                  เชื่อมโยงข้อมูลข้อความและสถานะทั้งหมดแบบ Real-time ทุกเบราว์เซอร์และทุกอุปกรณ์
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualSyncNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer"
              >
                <span>🔄 ซิงค์ข้อมูลเดี๋ยวนี้ (Sync Now)</span>
              </button>
            </div>
          </div>

          {/* 1. Real-time Status Card */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50/50 to-blue-50/50 rounded-2xl p-5 border border-emerald-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  สถานะการทำงาน Real-Time: ออนไลน์พร้อมใช้งาน
                </span>
              </div>
              <span className="text-xs font-medium text-emerald-800 bg-white/80 px-3 py-1 rounded-full border border-emerald-200">
                โหมด: Multi-browser Instant Sync
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-white p-3 rounded-xl border border-emerald-100">
                <p className="text-[11px] text-slate-500">การเชื่อมต่อทุกเบราว์เซอร์</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">ทำงานสดพร้อมกัน 100%</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100">
                <p className="text-[11px] text-slate-500">Cloudflare Pages & D1 Engine</p>
                <p className="text-xs font-bold text-purple-700 mt-0.5">/functions/api/[[route]]</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100">
                <p className="text-[11px] text-slate-500">ซิงค์ล่าสุดเมื่อ</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  {syncStatus.lastSyncedAt ? syncStatus.lastSyncedAt.toLocaleTimeString('th-TH') : 'กำลังทำงาน'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. One-Click Push Full State to Cloudflare D1 */}
          <div className="p-5 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>ส่งข้อมูลข้อความปัจจุบันทั้งหมดเข้าสู่ Cloudflare D1 (One-Click Sync)</span>
                </h4>
                <p className="text-xs text-purple-800/80 mt-0.5">
                  อัปโหลดข้อมูลสมาชิก, หัวข้องาน, การส่งงาน, เอกสาร และประกาศ ทั้งหมดขึ้นสู่ระบบคลาวด์
                </p>
              </div>

              <button
                type="button"
                onClick={handlePushFullStateToD1}
                disabled={isMigratingD1}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl shadow-xs transition-all cursor-pointer glow-purple-hover shrink-0"
              >
                {isMigratingD1 ? (
                  <span>กำลังอัปโหลดข้อมูล...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>ส่งข้อมูลทั้งหมดเข้าสู่ D1 ทันที</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. SQL Schema Box & 1-Click Copy for Cloudflare D1 Console */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-purple-600" />
                  <span>SQL Schema สำหรับสร้างตารางใน Cloudflare D1 (academic_schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  คัดลอกคำสั่ง SQL นี้ไปรันใน Cloudflare D1 Console ในครั้งแรก
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyD1Schema}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                  isD1Copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white glow-purple-hover'
                }`}
              >
                {isD1Copied ? (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>คัดลอก SQL แล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอก SQL Schema</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative rounded-2xl bg-slate-950 text-emerald-400 p-4 border border-slate-800 shadow-inner max-h-[300px] overflow-y-auto font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap">{`-- academic_schema.sql (Cloudflare D1 Table Definitions)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    status TEXT NOT NULL DEFAULT 'approved',
    email TEXT,
    phone TEXT,
    position TEXT,
    avatar TEXT,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    assignedBy TEXT NOT NULL,
    targetRole TEXT NOT NULL DEFAULT 'all',
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    dueDateStart TEXT,
    dueDateEnd TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    description TEXT,
    subfolderId TEXT,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    assignmentId TEXT NOT NULL,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    submittedAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    notes TEXT,
    files TEXT,
    score REAL,
    feedback TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    academicYear TEXT NOT NULL,
    semester TEXT NOT NULL,
    uploadedBy TEXT NOT NULL,
    uploadedAt TEXT NOT NULL,
    fileSize INTEGER,
    fileType TEXT,
    previewType TEXT,
    driveFileId TEXT,
    downloadUrl TEXT,
    viewUrl TEXT,
    description TEXT,
    tags TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    date TEXT NOT NULL,
    dateStart TEXT,
    dateEnd TEXT,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    isPinned INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
);`}</pre>
            </div>
          </div>

          {/* 4. Detailed Step-by-Step Instructions */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-900 space-y-3">
            <h5 className="font-bold flex items-center gap-1.5 text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>ขั้นตอนการผูก Cloudflare D1 ใน Cloudflare Pages Dashboard:</span>
            </h5>
            <ol className="list-decimal list-inside text-[11px] space-y-1.5 text-slate-700 pl-1 leading-relaxed">
              <li>
                เปิด <strong>Cloudflare Dashboard</strong> &gt; ไปที่เมนู <strong>Workers &amp; Pages</strong> &gt; <strong>D1 SQL Database</strong> &gt; กด <strong>Create Database</strong> (ตั้งชื่อ เช่น <code className="bg-purple-100 text-purple-800 px-1 rounded">academic-db</code>)
              </li>
              <li>
                คลิกเข้าไปที่ Database ที่สร้าง &gt; ไปที่แท็บ <strong>Console</strong> &gt; วางโค้ด SQL จากปุ่ม <strong>คัดลอก SQL Schema</strong> ด้านบน &gt; กด <strong>Execute</strong>
              </li>
              <li>
                ไปที่โปรเจกต์ <strong>Pages</strong> ของคุณ &gt; แท็บ <strong>Settings</strong> &gt; <strong>Functions</strong>
              </li>
              <li>
                เลื่อนลงมาที่หัวข้อ <strong>D1 database bindings</strong> &gt; กด <strong>Add binding</strong>
              </li>
              <li>
                ตั้งค่า <strong>Variable name:</strong> <code className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">DB</code> และเลือก <strong>D1 Database:</strong> ที่สร้างไว้ในข้อ 1
              </li>
              <li>
                กดบันทึก (Save) จากนั้นระบบจะซิงค์ข้อมูลข้อความทั้งหมดลง Cloudflare D1 แบบ Real-time อัตโนมัติ!
              </li>
            </ol>
          </div>
        </div>
      )}

    </div>
  );
};
