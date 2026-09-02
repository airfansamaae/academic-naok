import React, { useState } from 'react';
import { 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Send,
  X,
  Clock,
  FolderOpen,
  FileCheck2,
  Users,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { 
  User, 
  Assignment, 
  Submission, 
  Announcement, 
  DocumentItem, 
  ActiveTab,
  SchoolProfile 
} from '../types';
import { LegendModal } from './LegendModal';
import { 
  THAI_MONTH_NAMES, 
  THAI_SHORT_DAYS,
  formatThaiDate, 
  formatThaiFullDate, 
  getThaiShortDay,
  formatThaiDateRange 
} from '../lib/dateUtils';

interface DashboardViewProps {
  currentUser: User | null;
  assignments: Assignment[];
  submissions: Submission[];
  announcements: Announcement[];
  documents: DocumentItem[];
  users: User[];
  school?: SchoolProfile;
  onSelectTab?: (tab: ActiveTab) => void;
  onNavigate?: (tab: ActiveTab) => void;
  onOpenAssignmentDetail?: (assignment: Assignment) => void;
  onOpenFilePreview?: (file: any, title?: string, submitter?: string) => void;
  onOpenLegend?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  assignments,
  submissions,
  announcements,
  documents,
  users,
  school,
  onSelectTab,
  onNavigate,
  onOpenAssignmentDetail,
  onOpenFilePreview,
  onOpenLegend,
}) => {
  const handleSelectTab = onSelectTab || onNavigate || (() => {});
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Month and Year state for interactive calendar (defaults to Aug 2026)
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(7); // 0-indexed (7 = August)

  // Selected date pop-up modal state
  const [modalDateData, setModalDateData] = useState<{
    dateStr: string;
    dayNum: number;
    assignments: Assignment[];
    announcements: Announcement[];
  } | null>(null);

  // Dynamic Lookahead for Notice Banner (15 Days) & Upcoming Schedule (30 Days)
  // Base date calculation (handles current calendar date)
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const actualTodayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // Use today's actual date, or academic reference date '2026-08-31'
  const todayStr = '2026-08-31';
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  
  // 15-Day Lookahead for Prominent Notice Banner (แสดงเฉพาะปัจจุบัน และ 15 วันล่วงหน้า หากเลยวันแล้วเอาออกอัตโนมัติ)
  const lookahead15Date = new Date(todayYear, todayMonth - 1, todayDay + 15);
  const lookahead15Str = `${lookahead15Date.getFullYear()}-${pad(lookahead15Date.getMonth() + 1)}-${pad(lookahead15Date.getDate())}`;

  // 30-Day Lookahead for Right Column Upcoming Schedule (แสดงเฉพาะปัจจุบัน และ 30 วันล่วงหน้า)
  const lookahead30Date = new Date(todayYear, todayMonth - 1, todayDay + 30);
  const lookahead30Str = `${lookahead30Date.getFullYear()}-${pad(lookahead30Date.getMonth() + 1)}-${pad(lookahead30Date.getDate())}`;

  interface BannerNotice {
    id: string;
    title: string;
    content: string;
    type: 'deadline' | 'general' | 'urgent';
    date: string;
    dateEnd?: string;
    authorName?: string;
    assignmentId?: string;
  }

  const bannerNotices: BannerNotice[] = [];

  // Filter announcements for Notice Banner: only show if not expired (end >= todayStr) and starts within 15 days (start <= lookahead15Str)
  announcements.forEach((ann) => {
    const start = ann.dateStart || ann.date || todayStr;
    const end = ann.dateEnd || ann.date || start;
    if (end >= todayStr && start <= lookahead15Str) {
      bannerNotices.push({
        id: `ann-${ann.id}`,
        title: ann.title,
        content: ann.content,
        type: ann.type,
        date: start,
        dateEnd: ann.dateEnd,
        authorName: ann.authorName,
      });
    }
  });

  // Filter assignment deadlines for Notice Banner: only show if deadline has not passed (end >= todayStr) and starts within 15 days
  assignments.forEach((a) => {
    const start = a.dueDateStart || a.dueDateEnd;
    const end = a.dueDateEnd;
    if (end && end >= todayStr && start && start <= lookahead15Str) {
      bannerNotices.push({
        id: `assign-${a.id}`,
        title: `กำหนดส่งงาน: ${a.title}`,
        content: a.description || `กำหนดส่งงานวิชาการ ระหว่างวันที่ ${a.dueDateStart || a.dueDateEnd} ถึง ${a.dueDateEnd}`,
        type: 'deadline',
        date: start,
        dateEnd: a.dueDateEnd,
        authorName: 'ฝ่ายบริหารงานวิชาการ',
        assignmentId: a.id,
      });
    }
  });

  // Sort banner notices by closest upcoming date first
  bannerNotices.sort((a, b) => a.date.localeCompare(b.date));

  // Active notices for slider (never show expired notices)
  const activeAnnouncements: BannerNotice[] = bannerNotices.length > 0 ? bannerNotices : [
    {
      id: 'default_up_to_date',
      title: 'ไม่มีกำหนดส่งงานหรือประกาศด่วนในระยะ 15 วันนี้',
      content: 'ระบบงานวิชาการเป็นปัจจุบัน ทุกภารกิจที่ผ่านมาเสร็จสิ้นเรียบร้อย และยังไม่มีกำหนดส่งงานใหม่ในระยะ 15 วันข้างหน้า',
      type: 'general' as const,
      date: todayStr,
      authorName: 'ฝ่ายวิชาการ',
    },
  ];

  const currentNotice = activeAnnouncements[currentNoticeIndex % activeAnnouncements.length];

  const nextNotice = () => {
    setCurrentNoticeIndex((prev) => (prev + 1) % activeAnnouncements.length);
  };

  const prevNotice = () => {
    setCurrentNoticeIndex((prev) => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length);
  };

  const isUserAdmin = currentUser?.role === 'admin';
  const approvedMembers = users.filter((u) => u.status === 'approved' && u.role === 'member');
  const totalApprovedMembersCount = approvedMembers.length > 0 ? approvedMembers.length : 3;

  // Assignments user has submitted
  const userSubmissions = submissions.filter((s) => s.memberId === currentUser?.id);
  const userSubmittedAssignmentIds = new Set(userSubmissions.map((s) => s.assignmentId));

  // Calendar month navigation
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  // Calculate calendar grid for the selected month/year
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const startDayOffset = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sunday
  const thaiBuddhistYear = calendarYear + 543;
  const currentMonthYearLabel = `${THAI_MONTH_NAMES[calendarMonth]} ${thaiBuddhistYear}`;

  // Build days array with Range Analysis (Start, Middle, End, or Single)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    const formattedMonth = (calendarMonth + 1).toString().padStart(2, '0');
    const formattedDay = dayNumber.toString().padStart(2, '0');
    const dateString = `${calendarYear}-${formattedMonth}-${formattedDay}`;

    // Filter assignments matching this date
    const matchedAssignments = assignments.filter((a) => {
      if (a.dueDateEnd === dateString) return true;
      if (a.dueDateStart && a.dueDateEnd && dateString >= a.dueDateStart && dateString <= a.dueDateEnd) return true;
      return false;
    });

    // Filter announcements matching this date (supporting dateStart/dateEnd or date)
    const matchedAnnouncements = announcements.filter((ann) => {
      if (ann.date === dateString) return true;
      if (ann.dateStart && ann.dateEnd && dateString >= ann.dateStart && dateString <= ann.dateEnd) return true;
      return false;
    });

    // Analyze range connections
    let rangeType: 'start' | 'middle' | 'end' | 'single' | 'none' = 'none';
    let statusColor: 'red' | 'green' | 'yellow' | 'none' = 'none';
    let label = '';
    let displayTitle = '';

    if (matchedAssignments.length > 0) {
      const assign = matchedAssignments[0];
      displayTitle = assign.title;
      const start = assign.dueDateStart || assign.dueDateEnd;
      const end = assign.dueDateEnd;

      if (start && end && start !== end) {
        if (dateString === start) rangeType = 'start';
        else if (dateString === end) rangeType = 'end';
        else if (dateString > start && dateString < end) rangeType = 'middle';
      } else {
        rangeType = 'single';
      }

      if (isUserAdmin) {
        const assignSubs = submissions.filter((s) => s.assignmentId === assign.id);
        if (assignSubs.length >= totalApprovedMembersCount) {
          statusColor = 'green';
          label = 'ส่งครบ';
        } else {
          statusColor = 'red';
          label = `${assignSubs.length}/${totalApprovedMembersCount} คน`;
        }
      } else {
        if (userSubmittedAssignmentIds.has(assign.id)) {
          statusColor = 'green';
          label = 'ส่งแล้ว';
        } else {
          statusColor = 'red';
          label = 'กำหนดส่ง';
        }
      }
    } else if (matchedAnnouncements.length > 0) {
      const ann = matchedAnnouncements[0];
      displayTitle = ann.title;
      const start = ann.dateStart || ann.date;
      const end = ann.dateEnd || ann.date;

      if (start && end && start !== end) {
        if (dateString === start) rangeType = 'start';
        else if (dateString === end) rangeType = 'end';
        else if (dateString > start && dateString < end) rangeType = 'middle';
      } else {
        rangeType = 'single';
      }

      statusColor = 'yellow';
      label = 'ประกาศ';
    }

    return {
      day: dayNumber,
      dateString,
      statusColor,
      rangeType,
      label,
      displayTitle,
      assignments: matchedAssignments,
      announcements: matchedAnnouncements,
      isToday: dateString === todayStr,
    };
  });

  // Calculate 30-Day Lookahead Items (From today: 2026-08-31 up to 30 days ahead, sorted by closest date first)
  interface LookaheadItem {
    id: string;
    type: 'assignment' | 'announcement';
    title: string;
    date: string;
    dateEnd?: string;
    status: 'deadline' | 'general';
    rawAssignment?: Assignment;
    rawAnnouncement?: Announcement;
  }

  const lookaheadList: LookaheadItem[] = [];

  // Assignments in 30-day window (must not be expired: dueDateEnd >= todayStr, and starts within 30 days)
  assignments.forEach((a) => {
    const start = a.dueDateStart || a.dueDateEnd;
    const end = a.dueDateEnd;
    if (end && end >= todayStr && start && start <= lookahead30Str) {
      lookaheadList.push({
        id: `assign-${a.id}`,
        type: 'assignment',
        title: a.title,
        date: start,
        dateEnd: a.dueDateEnd,
        status: 'deadline',
        rawAssignment: a,
      });
    }
  });

  // Announcements in 30-day window (must not be expired: end >= todayStr, and starts within 30 days)
  announcements.forEach((ann) => {
    const start = ann.dateStart || ann.date || todayStr;
    const end = ann.dateEnd || ann.date || start;
    if (end >= todayStr && start <= lookahead30Str) {
      lookaheadList.push({
        id: `ann-${ann.id}`,
        type: 'announcement',
        title: ann.title,
        date: start,
        dateEnd: ann.dateEnd,
        status: ann.type === 'deadline' ? 'deadline' : 'general',
        rawAnnouncement: ann,
      });
    }
  });

  // Sort by date ascending (closest date first at the top)
  lookaheadList.sort((a, b) => a.date.localeCompare(b.date));

  const handleDateClick = (dayData: typeof calendarDays[0]) => {
    setModalDateData({
      dateStr: dayData.dateString,
      dayNum: dayData.day,
      assignments: dayData.assignments,
      announcements: dayData.announcements,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. PROMINENT NOTICE BANNER (Mobile & Desktop: Equal fixed dimensions across all notices) */}
      <div
        id="dashboard-main-notice-banner"
        className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-300 shadow-lg sm:shadow-xl relative overflow-hidden min-h-[140px] sm:min-h-[148px] lg:h-[148px] flex flex-col justify-center ${
          currentNotice.type === 'deadline'
            ? 'bg-gradient-to-r from-red-600 via-rose-800 to-red-950 border sm:border-2 border-red-400/50 text-white shadow-red-950/30'
            : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 border sm:border-2 border-amber-300/80 text-slate-950 shadow-orange-950/20'
        }`}
      >
        {/* Decorative backdrop glow */}
        <div className="absolute -right-12 -bottom-12 w-60 h-60 bg-white/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
            {/* Badge Icon */}
            <div
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shrink-0 shadow-md ${
                currentNotice.type === 'deadline'
                  ? 'bg-white/20 text-white backdrop-blur-md border border-white/30'
                  : 'bg-slate-950 text-amber-400 shadow-slate-950/30'
              }`}
            >
              {currentNotice.type === 'deadline' ? (
                <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 animate-pulse" />
              ) : (
                <Bell className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
              )}
            </div>

            {/* Notice Text Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs ${
                    currentNotice.type === 'deadline'
                      ? 'bg-white text-red-700 font-extrabold'
                      : 'bg-slate-950 text-white font-extrabold'
                  }`}
                >
                  {currentNotice.type === 'deadline' ? '🚨 กำหนดส่งงาน' : '📢 ประกาศเพื่อทราบ'}
                </span>
                {currentNotice.date && (
                  <span
                    className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md ${
                      currentNotice.type === 'deadline'
                        ? 'bg-red-950/70 text-red-100 border border-red-400/40'
                        : 'bg-amber-100/90 text-slate-900 border border-amber-600/40'
                    }`}
                  >
                    {getThaiShortDay(currentNotice.date)} {formatThaiDate(currentNotice.date)}
                  </span>
                )}
              </div>

              <h2
                className={`text-base sm:text-lg lg:text-xl font-black mt-1 leading-snug tracking-tight truncate ${
                  currentNotice.type === 'deadline' ? 'text-white' : 'text-slate-950'
                }`}
              >
                {currentNotice.title}
              </h2>

              <p
                className={`text-[11px] sm:text-xs mt-0.5 leading-relaxed line-clamp-1 sm:line-clamp-2 max-w-4xl ${
                  currentNotice.type === 'deadline' ? 'text-red-100' : 'text-slate-900 font-medium'
                }`}
              >
                {currentNotice.content}
              </p>
            </div>
          </div>

          {/* Action Area: Member has button to send/submit; Admin has button to manage/edit */}
          <div className="flex items-center justify-between lg:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/20">
            {/* Member Submit Button (Or Admin Manage Button) */}
            {!isUserAdmin ? (
              <button
                id="notice-banner-submit-btn"
                onClick={() => handleSelectTab('assignments')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 text-xs font-black rounded-xl sm:rounded-2xl transition-all shadow-md transform hover:scale-105 active:scale-95 cursor-pointer ${
                  currentNotice.type === 'deadline'
                    ? 'bg-white text-red-700 hover:bg-red-50 shadow-red-950/40'
                    : 'bg-slate-950 text-white hover:bg-slate-900 shadow-slate-950/30'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งงานที่นี่</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="notice-banner-admin-manage-btn"
                onClick={() => handleSelectTab(currentNotice.type === 'deadline' ? 'tracking' : 'assignments')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 text-xs font-black rounded-xl sm:rounded-2xl transition-all shadow-md transform hover:scale-105 active:scale-95 cursor-pointer ${
                  currentNotice.type === 'deadline'
                    ? 'bg-white text-red-700 hover:bg-red-50 shadow-red-950/40'
                    : 'bg-slate-950 text-white hover:bg-slate-900 shadow-slate-950/30'
                }`}
              >
                <span>{currentNotice.type === 'deadline' ? 'ดูการส่งงาน' : 'จัดการประกาศ/กิจกรรม'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Slider Switcher (< >) */}
            <div
              className={`flex items-center gap-1 rounded-xl sm:rounded-2xl p-1 border backdrop-blur-md ${
                currentNotice.type === 'deadline'
                  ? 'bg-black/40 border-white/25 text-white'
                  : 'bg-white/60 border-black/15 text-slate-900'
              }`}
            >
              <button
                onClick={prevNotice}
                title="รายการก่อนหน้า"
                className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <span className="text-[11px] sm:text-xs font-bold px-1.5 min-w-[2rem] text-center">
                {(currentNoticeIndex % activeAnnouncements.length) + 1}/{activeAnnouncements.length}
              </span>
              <button
                onClick={nextNotice}
                title="รายการถัดไป"
                className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN DASHBOARD CONTENT: 2-COLUMN LAYOUT (CALENDAR + 20-DAY UPCOMING NOTICES) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols): INTERACTIVE ACADEMIC CALENDAR */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-purple-100 p-5 sm:p-6 shadow-xs space-y-5">
          {/* Calendar Header with Navigation Buttons < > and Month/Year Display */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-purple-100 text-purple-700 shadow-2xs">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Dashboard
                  </h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    ปฏิทินวิชาการ
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกวันที่ในปฏิทินเพื่อดูรายละเอียดของงานและกำหนดส่งงาน
                </p>
              </div>
            </div>

            {/* Month Selector with < > buttons & Legend Button */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center bg-slate-100/90 rounded-2xl p-1 border border-slate-200 shadow-2xs">
                <button
                  id="calendar-prev-month-btn"
                  onClick={handlePrevMonth}
                  title="เดือนก่อนหน้า"
                  className="p-2 hover:bg-white text-slate-700 hover:text-purple-700 rounded-xl transition-all shadow-2xs"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-1 text-center min-w-[130px]">
                  <span className="text-sm font-bold text-slate-900 block leading-tight">
                    {currentMonthYearLabel}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    ({calendarYear})
                  </span>
                </div>
                <button
                  id="calendar-next-month-btn"
                  onClick={handleNextMonth}
                  title="เดือนถัดไป"
                  className="p-2 hover:bg-white text-slate-700 hover:text-purple-700 rounded-xl transition-all shadow-2xs"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                id="calendar-legend-btn"
                onClick={() => setIsLegendOpen(true)}
                title="กดเพื่อดูคำอธิบายความหมายของสี"
                className="w-10 h-10 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-black text-sm shadow-2xs hover:scale-105 transition-all"
              >
                !
              </button>
            </div>
          </div>

          {/* Color Indicators Legend Bar */}
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap text-xs font-semibold text-slate-600 px-3.5 py-2 bg-slate-50/80 rounded-2xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              คำอธิบายสี:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-2xs" />
              <span>{isUserAdmin ? 'มีงานที่ยังส่งไม่ครบ' : 'มีงานที่ต้องส่ง'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs" />
              <span>{isUserAdmin ? 'ส่งครบทุกคน' : 'ส่งงานแล้ว'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-2xs" />
              <span>ประกาศแจ้งเตือน</span>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
            <div className="text-rose-500 py-1">อาทิตย์</div>
            <div className="py-1">จันทร์</div>
            <div className="py-1">อังคาร</div>
            <div className="py-1">พุธ</div>
            <div className="py-1">พฤหัสบดี</div>
            <div className="py-1">ศุกร์</div>
            <div className="text-purple-600 py-1">เสาร์</div>
          </div>

          {/* Calendar Grid with Range Connecting Lines & Dots */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty Offset for start day */}
            {Array.from({ length: startDayOffset }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="h-20 sm:h-24 rounded-2xl bg-slate-50/40 border border-slate-100/50"
              />
            ))}

            {/* Calendar Days Cards */}
            {calendarDays.map((day) => {
              const hasEvent = day.statusColor !== 'none';
              const lineColor =
                day.statusColor === 'red'
                  ? 'bg-rose-500'
                  : day.statusColor === 'green'
                  ? 'bg-emerald-500'
                  : day.statusColor === 'yellow'
                  ? 'bg-amber-500'
                  : 'bg-purple-400';

              return (
                <div
                  key={day.dateString}
                  onClick={() => handleDateClick(day)}
                  className={`h-20 sm:h-24 p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group hover:shadow-md hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
                    day.isToday
                      ? 'border-purple-400 bg-purple-50/40 ring-2 ring-purple-200 shadow-2xs'
                      : day.statusColor === 'red'
                      ? 'border-rose-200 bg-rose-50/20 hover:border-rose-400 hover:bg-rose-50/40'
                      : day.statusColor === 'green'
                      ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/40'
                      : day.statusColor === 'yellow'
                      ? 'border-amber-200 bg-amber-50/20 hover:border-amber-400 hover:bg-amber-50/40'
                      : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Range Connection Lines (เส้นเชื่อมช่วงเวลา และหัวท้ายจุด) */}
                  {hasEvent && (
                    <div className="absolute top-2.5 left-0 right-0 h-2 flex items-center pointer-events-none px-1">
                      {/* Left Connector Line */}
                      {(day.rangeType === 'middle' || day.rangeType === 'end') && (
                        <div className={`h-1 flex-1 ${lineColor} opacity-75`} />
                      )}
                      
                      {/* Center Point Dot for Start, End, or Single */}
                      {(day.rangeType === 'start' || day.rangeType === 'end' || day.rangeType === 'single') && (
                        <div className={`w-3 h-3 rounded-full ${lineColor} ring-2 ring-white shrink-0 mx-auto shadow-2xs`} />
                      )}

                      {/* Right Connector Line */}
                      {(day.rangeType === 'middle' || day.rangeType === 'start') && (
                        <div className={`h-1 flex-1 ${lineColor} opacity-75`} />
                      )}
                    </div>
                  )}

                  {/* Day Number */}
                  <div className="flex items-center justify-between z-10">
                    <span
                      className={`text-xs sm:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                        day.isToday
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-700 group-hover:text-purple-700'
                      }`}
                    >
                      {day.day}
                    </span>
                  </div>

                  {/* Title / Label text inside cell */}
                  {day.displayTitle || day.label ? (
                    <div
                      title={day.displayTitle || day.label}
                      className={`text-[9px] sm:text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-bold shadow-2xs z-10 ${
                        day.statusColor === 'red'
                          ? 'bg-rose-500 text-white'
                          : day.statusColor === 'green'
                          ? 'bg-emerald-600 text-white'
                          : day.statusColor === 'yellow'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {day.displayTitle || day.label}
                    </div>
                  ) : (
                    <div className="h-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): 30-DAY UPCOMING SCHEDULE & ANNOUNCEMENTS (ประกาศแจ้งเตือน 30 วันล่วงหน้า) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-purple-100 p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                ประกาศ & กำหนดส่ง 30 วันล่วงหน้า
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              {lookaheadList.length} รายการ
            </span>
          </div>

          <p className="text-xs text-slate-500">
            กำหนดส่งงานและแจ้งเพื่อทราบในระยะ 30 วันนี้ (แสดงเฉพาะปัจจุบันและ 30 วันล่วงหน้า)
          </p>

          {/* List of Uniformly Sized Cards */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[540px] pr-1">
            {lookaheadList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                ไม่มีกำหนดส่งงานหรือประกาศใหม่ในระยะ 30 วันนี้
              </div>
            ) : (
              lookaheadList.map((item) => {
                const shortDay = getThaiShortDay(item.date);
                const isDeadline = item.status === 'deadline';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === 'assignment') {
                        handleSelectTab(isUserAdmin ? 'tracking' : 'assignments');
                      } else {
                        handleSelectTab('assignments');
                      }
                    }}
                    className={`h-[94px] p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group hover:shadow-md ${
                      isDeadline
                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                        : 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    {/* Thai Day Abbreviation Badge (e.g. จ., อ., พ.) */}
                    <div
                      className={`w-11 h-11 rounded-2xl shrink-0 flex flex-col items-center justify-center font-black shadow-2xs ${
                        isDeadline
                          ? 'bg-rose-600 text-white shadow-rose-950/20'
                          : 'bg-amber-500 text-slate-950 shadow-amber-950/20'
                      }`}
                    >
                      <span className="text-sm leading-none">{shortDay || 'วัน'}</span>
                      <span className="text-[9px] opacity-80 mt-0.5 leading-none">
                        {item.date ? item.date.split('-')[2] : ''}
                      </span>
                    </div>

                    {/* Content (Uniform format) */}
                    <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isDeadline
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isDeadline ? 'กำหนดส่งงาน' : 'แจ้งเพื่อทราบ'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatThaiDate(item.date)}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-purple-700 transition-colors">
                        {item.title}
                      </h4>

                      <div className="text-[10px] text-slate-500 truncate">
                        {item.dateEnd && item.dateEnd !== item.date ? (
                          <span>ช่วงเวลา: {formatThaiDateRange(item.date, item.dateEnd)}</span>
                        ) : (
                          <span>กำหนด: {getThaiShortDay(item.date)} {formatThaiDate(item.date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. CALENDAR DATE POP-UP MODAL */}
      {modalDateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 relative max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    รายละเอียดวันที่ {getThaiShortDay(modalDateData.dateStr)} {formatThaiDate(modalDateData.dateStr)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatThaiFullDate(modalDateData.dateStr)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalDateData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Assignments Section */}
              {modalDateData.assignments.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      รายการงานที่เกี่ยวข้อง ({modalDateData.assignments.length})
                    </span>
                  </div>

                  {modalDateData.assignments.map((assignment) => {
                    const assignSubs = submissions.filter((s) => s.assignmentId === assignment.id);
                    const isSubmittedByMe = userSubmittedAssignmentIds.has(assignment.id);

                    return (
                      <div
                        key={assignment.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                  isUserAdmin
                                    ? assignSubs.length >= totalApprovedMembersCount
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                    : isSubmittedByMe
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isUserAdmin
                                  ? `ส่งแล้ว ${assignSubs.length}/${totalApprovedMembersCount} คน`
                                  : isSubmittedByMe
                                  ? 'คุณส่งงานนี้แล้ว ✓'
                                  : 'ยังไม่ได้ส่งงาน ⚠️'}
                              </span>

                              <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-medium border border-purple-200">
                                {assignment.driveFolderName}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {assignment.title}
                            </h4>
                          </div>
                        </div>

                        {assignment.description && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100">
                            {assignment.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>กำหนดส่ง: {getThaiShortDay(assignment.dueDateEnd)} {formatThaiDate(assignment.dueDateEnd)}</span>
                          </span>
                        </div>

                        {/* Action Button */}
                        <div className="pt-1">
                          {!isUserAdmin ? (
                            <button
                              onClick={() => {
                                setModalDateData(null);
                                handleSelectTab('assignments');
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isSubmittedByMe ? 'ดูงานที่ส่ง / แก้ไข' : 'ไปที่หน้าส่งงานนี้'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setModalDateData(null);
                                handleSelectTab('tracking');
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>ดูการตรวจงานและรายชื่อสมาชิก</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Announcements Section */}
              {modalDateData.announcements.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    ประกาศข่าวสารในวันนี้
                  </span>
                  {modalDateData.announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                        <h4 className="text-xs font-bold text-slate-900">{ann.title}</h4>
                      </div>
                      <p className="text-xs text-slate-700 pl-6 leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Empty state if nothing on this date */}
              {modalDateData.assignments.length === 0 && modalDateData.announcements.length === 0 && (
                <div className="text-center py-8 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    ไม่มีกำหนดส่งงานหรือประกาศพิเศษในวันนี้
                  </p>
                  <p className="text-xs text-slate-400">
                    วันที่ {getThaiShortDay(modalDateData.dateStr)} {formatThaiDate(modalDateData.dateStr)} เป็นวันปฏิบัติงานตามปกติ
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setModalDateData(null)}
                className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend Modal */}
      <LegendModal
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
        userRole={currentUser?.role}
      />
    </div>
  );
};
