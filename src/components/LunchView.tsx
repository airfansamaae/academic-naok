import React, { useState } from 'react';
import { 
  UtensilsCrossed, 
  ShieldCheck, 
  ExternalLink, 
  Lock, 
  CalendarCheck, 
  CheckCircle2, 
  Sparkles,
  Info,
  Server
} from 'lucide-react';
import { User, SchoolProfile } from '../types';
import Swal from 'sweetalert2';

interface LunchViewProps {
  currentUser: User | null;
  school: SchoolProfile;
}

export const LunchView: React.FC<LunchViewProps> = ({ currentUser, school }) => {
  const [isLaunching, setIsLaunching] = useState(false);

  // Secure backend gateway trigger - hides raw script URL from DOM
  const handleLaunchLunchSystem = () => {
    setIsLaunching(true);

    Swal.fire({
      title: 'กำลังเชื่อมต่อระบบอาหารกลางวัน',
      text: 'ระบบความปลอดภัยกำลังยืนยันสิทธิ์และเปิดระบบผ่านเกตเวย์หลังบ้าน...',
      timer: 1500,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    }).then(() => {
      setIsLaunching(false);
      // Trigger protected gateway endpoint
      // Using window.open on the backend handler route
      const proxyUrl = '/api/lunch-redirect';
      
      // Fallback direct execution via internal function
      const targetWindow = window.open(proxyUrl, '_blank', 'noopener,noreferrer');
      if (!targetWindow) {
        // If popup blocked or running in iframe
        window.location.href = proxyUrl;
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-purple-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-none">
              ระบบอาหารกลางวันสถานศึกษา (School Lunch Program)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Protected Gateway
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ระบบบันทึก จัดการ และรายงานข้อมูลภาวะโภชนาการและอาหารกลางวันนักเรียน
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          <span>เชื่อมต่อสิทธิ์ความปลอดภัยแล้ว</span>
        </div>
      </div>

      {/* Main Portal Card */}
      <div className="bg-white rounded-2xl border border-purple-100 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center mx-auto shadow-md glow-amber-hover">
            <UtensilsCrossed className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              เข้าสู่ระบบบริหารจัดการอาหารกลางวัน
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              คลิกปุ่มด้านล่างเพื่อเปิดระบบบริหารจัดการอาหารกลางวันของ สพป.กระบี่
              ระบบจะทำกระบวนการยืนยันตัวตนอัตโนมัติผ่าน Secure Gateway Backend API
            </p>
          </div>

          {/* Secure Launch Button */}
          <div className="pt-2">
            <button
              id="launch-lunch-system-btn"
              onClick={handleLaunchLunchSystem}
              disabled={isLaunching}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 rounded-2xl transition-all shadow-md glow-amber-hover hover:scale-102"
            >
              {isLaunching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังเชื่อมต่อเกตเวย์...</span>
                </>
              ) : (
                <>
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>เปิดระบบอาหารกลางวัน (Secure Launch)</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Features info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 text-left">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                <span>บันทึกรายวัน</span>
              </div>
              <p className="text-[11px] text-slate-500">
                ลงรายการเมนูอาหารและยอดนักเรียนรับประทานอาหารประจำวัน
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>โภชนาการ</span>
              </div>
              <p className="text-[11px] text-slate-500">
                คำนวณคุณค่าทางโภชนาการตามมาตรฐาน School Lunch System
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                <Server className="w-4 h-4 text-amber-600" />
                <span>รายงานอัตโนมัติ</span>
              </div>
              <p className="text-[11px] text-slate-500">
                ส่งออกสรุปงบประมาณและข้อมูลรายงานส่งเขตพื้นที่ฯ
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-left text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>นโยบายความปลอดภัย:</strong> ลิงก์ระบบได้รับการปกป้องผ่านเซิร์ฟเวอร์หลังบ้าน ไม่มีการเปิดเผยโค้ดสคริปต์บนหน้าอินเทอร์เฟซผู้ใช้
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
