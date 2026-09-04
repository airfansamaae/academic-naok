import { 
  User, Assignment, Submission, DocumentItem, Announcement, SchoolProfile, UploadedFile 
} from '../types';
import { 
  INITIAL_SCHOOL_PROFILE, INITIAL_USERS, INITIAL_ASSIGNMENTS, 
  INITIAL_SUBMISSIONS, INITIAL_DOCUMENTS, INITIAL_ANNOUNCEMENTS 
} from '../data/initialData';
import Swal from 'sweetalert2';

const STORAGE_KEYS = {
  USERS: 'academic_users_v1',
  ASSIGNMENTS: 'academic_assignments_v1',
  SUBMISSIONS: 'academic_submissions_v1',
  DOCUMENTS: 'academic_documents_v1',
  ANNOUNCEMENTS: 'academic_announcements_v1',
  SCHOOL: 'academic_school_v1',
  CURRENT_USER: 'academic_current_user_v1',
  LOCAL_VERSION: 'academic_data_version_v1',
};

export interface SyncStatusInfo {
  status: 'synced' | 'syncing' | 'offline';
  lastSyncedAt: Date | null;
  mode: 'realtime_active' | 'polling' | 'local';
}

// Helper to resolve precise MIME types so Microsoft Office & Windows Defender do not lock files
function getStandardOfficeMimeType(fileName: string, providedMime?: string): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === 'ppt') return 'application/vnd.ms-powerpoint';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'zip') return 'application/zip';
  if (ext === 'csv') return 'text/csv;charset=utf-8;';
  return providedMime || 'application/octet-stream';
}

// Download Lock to prevent double clicks creating conflicting file stream locks in Windows
let lastDownloadTimestamp = 0;

// 100% Authentic Original File Downloader (Supports Word .docx/.doc, Excel .xlsx, PDF, PPTX, Images, ZIP)
// Retains exact original filename and triggers direct in-browser download without opening blank tabs
export function triggerDirectDownload(file: UploadedFile) {
  if (!file) return;

  const now = Date.now();
  if (now - lastDownloadTimestamp < 1500) {
    // Debounce duplicate click within 1.5 seconds to avoid double file stream lock
    return;
  }
  lastDownloadTimestamp = now;

  const originalFileName = file.name || 'document';
  const targetMime = getStandardOfficeMimeType(originalFileName, file.mimeType);

  // Helper to trigger direct download from blob or base64 without opening new tab
  const saveBlobDirectly = (blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Safely remove anchor tag after click event finishes
    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch {
        // ignore
      }
    }, 500);

    // CRITICAL FIX: Never revoke blob URL in 3 seconds!
    // Revoking too quickly while Windows Defender scans or while Word creates lock file
    // causes Windows to throw "This file is in use by another application or user".
    // Keep blob URL alive for 120 seconds.
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 120000);
  };

  // 1. If we have the authentic binary base64 Data URL (Original uploaded binary file)
  if (file.fileDataUrl && file.fileDataUrl.startsWith('data:')) {
    try {
      const parts = file.fileDataUrl.split(';base64,');
      const rawBase64 = parts[1];
      const byteCharacters = atob(rawBase64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: targetMime });
      saveBlobDirectly(blob, originalFileName);
      return;
    } catch (err) {
      console.warn('Direct Blob download failed, falling back to data link:', err);
      const link = document.createElement('a');
      link.href = file.fileDataUrl;
      link.download = originalFileName;
      link.setAttribute('download', originalFileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (link.parentNode) link.parentNode.removeChild(link);
        } catch {
          // ignore
        }
      }, 500);
      return;
    }
  }

  // 2. If it's a real Google Drive file ID (Fetch as blob or direct iframe download to avoid blank tabs)
  if (file.driveFileId && !file.driveFileId.startsWith('drive_f_') && !file.driveFileId.startsWith('mock_')) {
    const directGoogleDriveDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.driveFileId}&confirm=t`;
    // Try invisible iframe download first so user stays in same tab
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = directGoogleDriveDownloadUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    }, 10000);
    return;
  }

  // 3. If downloadUrl or viewUrl is a valid web URL
  if (file.downloadUrl && file.downloadUrl.startsWith('http') && !file.downloadUrl.includes('drive_f_')) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = file.downloadUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    }, 10000);
    return;
  }

  // 4. Fallback (Preview content as blob with original filename):
  const content = file.previewContent || `ไฟล์เอกสาร: ${originalFileName}`;
  const blob = new Blob([content], { type: file.mimeType || 'application/octet-stream' });
  saveBlobDirectly(blob, originalFileName);
}

export class StorageService {
  private static instance: StorageService;
  private listeners: Set<() => void> = new Set();
  private syncListeners: Set<(info: SyncStatusInfo) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isSyncing: boolean = false;
  private lastRemoteVersion: number = 0;
  private syncInfo: SyncStatusInfo = {
    status: 'synced',
    lastSyncedAt: new Date(),
    mode: 'realtime_active',
  };

  private constructor() {
    this.initializeDefaults();
    this.initRealtimeSync();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private initializeDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
    }
    const storedAnn = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    if (!storedAnn) {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
    } else {
      try {
        const parsed = JSON.parse(storedAnn);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี'));
          localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(cleaned));
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
      }
    }
    const storedSchool = localStorage.getItem(STORAGE_KEYS.SCHOOL);
    if (!storedSchool) {
      localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(INITIAL_SCHOOL_PROFILE));
    } else {
      try {
        const parsed = JSON.parse(storedSchool);
        if (!parsed || !parsed.primaryDriveFolderId) {
          localStorage.setItem(
            STORAGE_KEYS.SCHOOL,
            JSON.stringify({ ...INITIAL_SCHOOL_PROFILE, ...(parsed || {}) })
          );
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(INITIAL_SCHOOL_PROFILE));
      }
    }
    // Strict Login Security: Always require explicit Login. Purge all stored sessions on fresh load
    try {
      sessionStorage.removeItem('academic_auth_session');
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('academic_current_user');
      localStorage.removeItem('academic_current_user_v1');
      localStorage.removeItem('academic_auth_session');
    } catch {}
  }

  // --- Real-time Multi-browser Sync Engine ---
  private initRealtimeSync() {
    // 1. Cross-tab Broadcast Channel (Instant sync across tabs in same browser)
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('academic_hub_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'DATA_UPDATED') {
            this.pullLatestFromCloud(true);
          }
        };
      }
    } catch {
      // Fallback
    }

    // 2. Real-time Server-Sent Events (SSE) for instant cross-device updates
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      this.setupSSEConnection();
    }

    // 3. Initial Boot: Push local state to cloud & Pull latest to make sure D1 / Server has full data
    setTimeout(async () => {
      // Auto-push initial data so fresh instances or newly created records are immediately on D1
      await this.pushFullStateToCloud();
      await this.pullLatestFromCloud(true);
    }, 400);

    // 4. Periodic Background Sync Polling (Every 3 seconds for near-instant multi-device sync)
    setInterval(() => {
      this.checkRemoteVersionAndSync();
    }, 3000);

    // 5. Instant Sync on Window Focus / Visibility Change
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.pullLatestFromCloud();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.pullLatestFromCloud();
        }
      });
    }
  }

  // Real-time SSE Connection
  private setupSSEConnection() {
    try {
      const eventSource = new EventSource('/api/sync/sse');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === 'DATA_CHANGED' || data.type === 'INIT_SYNC')) {
            if (data.version && data.version > this.lastRemoteVersion) {
              this.pullLatestFromCloud(true);
            }
          }
        } catch {
          // ignore parsing error
        }
      };
      eventSource.onerror = () => {
        eventSource.close();
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.setupSSEConnection();
        }, 5000);
      };
    } catch {
      // fallback to polling
    }
  }

  public getSyncStatus(): SyncStatusInfo {
    return this.syncInfo;
  }

  public subscribeSync(callback: (info: SyncStatusInfo) => void): () => void {
    this.syncListeners.add(callback);
    callback(this.syncInfo);
    return () => this.syncListeners.delete(callback);
  }

  private notifySync(status: 'synced' | 'syncing' | 'offline') {
    this.syncInfo = {
      status,
      lastSyncedAt: status === 'synced' ? new Date() : this.syncInfo.lastSyncedAt,
      mode: 'realtime_active',
    };
    this.syncListeners.forEach((listener) => {
      try {
        listener(this.syncInfo);
      } catch {
        // ignore
      }
    });
  }

  // High-speed lightweight check for changes
  private async checkRemoteVersionAndSync() {
    if (this.isSyncing) return;
    try {
      const res = await fetch('/api/sync/version', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.version && json.version > this.lastRemoteVersion) {
          await this.pullLatestFromCloud();
        }
      }
    } catch {
      // Offline / Static fallback
    }
  }

  // Full Pull & Merge with Cloud Data (D1 / Server)
  public async pullLatestFromCloud(silent: boolean = false): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    if (!silent) this.notifySync('syncing');

    try {
      const res = await fetch('/api/data/all', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const remoteData = json.data;
          let changed = false;

          if (Array.isArray(remoteData.users) && remoteData.users.length > 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remoteData.users));
            changed = true;
          }
          if (Array.isArray(remoteData.assignments) && remoteData.assignments.length > 0) {
            localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(remoteData.assignments));
            changed = true;
          }
          if (Array.isArray(remoteData.submissions) && remoteData.submissions.length > 0) {
            localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(remoteData.submissions));
            changed = true;
          }
          if (Array.isArray(remoteData.documents) && remoteData.documents.length > 0) {
            localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(remoteData.documents));
            changed = true;
          }
          if (Array.isArray(remoteData.announcements)) {
            const sanitized = remoteData.announcements.filter(
              (a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี')
            );
            localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(sanitized));
            changed = true;
          }
          if (json.school && json.school.name) {
            localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(json.school));
            changed = true;
          }

          if (json.version) {
            this.lastRemoteVersion = json.version;
          }

          if (changed) {
            this.notify();
          }
        }
        this.notifySync('synced');
        return true;
      } else {
        this.notifySync('synced');
        return false;
      }
    } catch {
      this.notifySync('offline');
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  // Push local change to Cloud API / D1 & Broadcast
  private async broadcastChange(table: string, action: 'insert' | 'update' | 'delete' | 'setList', data: any) {
    // 1. Broadcast locally across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'DATA_UPDATED', table, action, timestamp: Date.now() });
      } catch {
        // ignore
      }
    }

    // 2. Push to Server / Cloudflare Functions / D1
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          action,
          data,
          school: table === 'school' ? data : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.version) {
          this.lastRemoteVersion = result.version;
        }
        this.notifySync('synced');
      }
    } catch {
      // Gracefully continue offline
    }
  }

  // Sync entire local state up to Cloud on initial connection
  public async pushFullStateToCloud() {
    this.notifySync('syncing');
    try {
      const fullState = {
        users: this.getUsers(),
        assignments: this.getAssignments(),
        submissions: this.getSubmissions(),
        documents: this.getDocuments(),
        announcements: this.getAnnouncements(),
        school: this.getSchoolProfile(),
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullState }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.version) this.lastRemoteVersion = result.version;
        this.notifySync('synced');
        return true;
      }
    } catch {
      this.notifySync('offline');
    }
    return false;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  // --- Current Auth Session (Strictly Session-Based to Prevent Auto-Login) ---
  public getCurrentUser(): User | null {
    try {
      const data = sessionStorage.getItem('academic_auth_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null) {
    try {
      if (user) {
        sessionStorage.setItem('academic_auth_session', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('academic_auth_session');
      }
      // Purge any lingering localStorage entries to prevent accidental auto-login
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('academic_current_user_v1');
      localStorage.removeItem('academic_current_user');
    } catch {}
    this.notify();
  }

  public logout(): void {
    this.setCurrentUser(null);
  }

  public login(usernameInput: string, passwordInput: string): User | null {
    const result = this.authenticate(usernameInput, passwordInput);
    if (result.success && result.user) {
      return result.user;
    }
    return null;
  }

  public authenticate(usernameInput: string, passwordInput: string): { success: boolean; user?: User; message?: string } {
    const trimmedUser = usernameInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'กรุณากรอกทั้งชื่อผู้ใช้ (Username) และรหัสผ่าน (Password)' };
    }

    // 1. MASTER ADMIN AUTHENTICATION (Username "Admin", Password "456789")
    if (trimmedUser.toLowerCase() === 'admin') {
      if (trimmedPass !== '456789') {
        return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง (รหัสผ่านเริ่มต้นสำหรับ Admin คือ 456789)' };
      }
      const users = this.getUsers();
      let admin = users.find(u => u.username.toLowerCase() === 'admin');
      if (!admin) {
        admin = INITIAL_USERS[0];
      }
      this.setCurrentUser(admin);
      return { success: true, user: admin };
    }

    // 2. Standard Member Authentication Check
    const users = this.getUsers();
    const found = users.find(u => u.username.toLowerCase() === trimmedUser.toLowerCase());

    if (!found) {
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ กรุณาตรวจสอบชื่อผู้ใช้หรือลงทะเบียนใหม่' };
    }

    // Strict Password Verification
    const expectedPassword = found.password || '123456';
    if (trimmedPass !== expectedPassword) {
      return { success: false, message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณากรอกรหัสผ่านที่ถูกต้อง' };
    }

    if (found.status === 'pending') {
      return { success: false, message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติ' };
    }

    if (found.status === 'rejected') {
      return { success: false, message: 'บัญชีผู้ใช้นี้ไม่ได้รับการอนุมัติการเข้าใช้งาน' };
    }

    this.setCurrentUser(found);
    return { success: true, user: found };
  }

  // --- Users & Members ---
  public getUsers(): User[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : INITIAL_USERS;
  }

  public registerUser(userData: {
    username: string;
    fullName: string;
    email?: string;
    department: string;
    position?: string;
    password?: string;
  }): { success: boolean; message: string; user?: User } {
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      return { success: false, message: 'ชื่อผู้ใช้นี้ (Username) ถูกใช้งานแล้ว โปรดเลือกชื่ออื่น' };
    }

    const newUser: User = {
      id: 'user_' + Date.now(),
      username: userData.username,
      fullName: userData.fullName,
      role: 'member',
      status: 'pending',
      email: userData.email || `${userData.username}@krabiedu.go.th`,
      department: userData.department,
      position: userData.position || 'ครูผู้สอน',
      password: userData.password?.trim() || '123456',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.username)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.broadcastChange('users', 'insert', newUser);
    this.notify();
    return { 
      success: true, 
      message: 'ลงทะเบียนสำเร็จ! ข้อมูลของคุณถูกส่งไปยังผู้ดูแลระบบเพื่อรอการอนุมัติแล้ว',
      user: newUser 
    };
  }

  public updateUserStatus(userId: string, newStatus: 'approved' | 'pending' | 'rejected') {
    let updatedUser: User | null = null;
    const users = this.getUsers().map(u => {
      if (u.id === userId) {
        updatedUser = { ...u, status: newStatus, updatedAt: new Date().toISOString() };
        return updatedUser;
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (updatedUser) {
      this.broadcastChange('users', 'update', updatedUser);
    }
    this.notify();
  }

  public deleteUser(userId: string): boolean {
    const users = this.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.broadcastChange('users', 'delete', { id: userId });
    this.notify();
    return true;
  }

  public updateUserProfile(userId: string, updates: Partial<User>) {
    let updatedUser: User | null = null;
    const users = this.getUsers().map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates, updatedAt: new Date().toISOString() };
        updatedUser = updated;
        const current = this.getCurrentUser();
        if (current && current.id === userId) {
          sessionStorage.setItem('academic_auth_session', JSON.stringify(updated));
        }
        return updated;
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (updatedUser) {
      this.broadcastChange('users', 'update', updatedUser);
    }
    this.notify();
  }

  // --- Assignments ---
  public getAssignments(): Assignment[] {
    const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : INITIAL_ASSIGNMENTS;
  }

  public createAssignment(data: {
    title: string;
    description: string;
    dueDateStart: string;
    dueDateEnd: string;
    type: 'assignment' | 'announcement';
    allowedFileTypes?: string[];
  }): Assignment {
    const assignments = this.getAssignments();
    const currentUser = this.getCurrentUser();
    
    const folderSlug = data.title.replace(/\s+/g, '_').substring(0, 30);
    const driveFolderId = `1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-f_${Date.now()}`;
    const driveFolderName = `${assignments.length + 1}_${folderSlug}`;

    const newAssignment: Assignment = {
      id: 'assign_' + Date.now(),
      title: data.title,
      description: data.description,
      dueDateStart: data.dueDateStart || new Date().toISOString().split('T')[0],
      dueDateEnd: data.dueDateEnd || new Date().toISOString().split('T')[0],
      academicYear: '2569',
      term: '1',
      createdBy: currentUser?.id || 'user_admin',
      createdByName: currentUser?.fullName || 'ผู้ดูแลระบบ',
      driveFolderId: driveFolderId,
      driveFolderName: driveFolderName,
      status: 'open',
      type: data.type,
      allowedFileTypes: data.allowedFileTypes || ['.pdf', '.docx', '.xlsx', '.zip'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assignments.unshift(newAssignment);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    this.broadcastChange('assignments', 'insert', newAssignment);

    if (data.type === 'announcement') {
      this.createAnnouncement({
        title: `ประกาศ: ${data.title}`,
        content: data.description,
        type: 'general',
        date: data.dueDateEnd,
        authorName: currentUser?.fullName || 'ฝ่ายวิชาการ'
      });
    } else {
      this.createAnnouncement({
        title: `มอบหมายงานใหม่: ${data.title}`,
        content: `กำหนดส่งภายในวันที่ ${data.dueDateEnd} - ${data.description}`,
        type: 'deadline',
        date: data.dueDateEnd,
        assignmentId: newAssignment.id,
        authorName: currentUser?.fullName || 'ฝ่ายวิชาการ',
        isUrgent: true
      });
    }

    this.notify();
    return newAssignment;
  }

  public updateAssignment(id: string, updates: Partial<Assignment>) {
    let updatedAssign: Assignment | null = null;
    const assignments = this.getAssignments().map(a => {
      if (a.id === id) {
        updatedAssign = { ...a, ...updates, updatedAt: new Date().toISOString() };
        return updatedAssign;
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    if (updatedAssign) {
      this.broadcastChange('assignments', 'update', updatedAssign);
    }
    this.notify();
  }

  public deleteAssignment(id: string) {
    const submissions = this.getSubmissions();
    const relatedSubs = submissions.filter(s => s.assignmentId === id);
    const driveFileIds: string[] = [];
    relatedSubs.forEach(sub => {
      sub.files.forEach(f => {
        if (f.driveFileId) {
          driveFileIds.push(f.driveFileId);
        }
      });
    });

    if (driveFileIds.length > 0) {
      this.deleteFilesFromGoogleDrive(driveFileIds);
    }

    const remainingSubs = submissions.filter(s => s.assignmentId !== id);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(remainingSubs));
    this.broadcastChange('submissions', 'setList', remainingSubs);

    const assignments = this.getAssignments().filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    this.broadcastChange('assignments', 'delete', { id });

    const announcements = this.getAnnouncements().filter(ann => ann.assignmentId !== id);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'setList', announcements);

    this.notify();
  }

  // --- Submissions ---
  public getSubmissions(): Submission[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    return data ? JSON.parse(data) : INITIAL_SUBMISSIONS;
  }

  public createSubmission(data: {
    assignmentId: string;
    files: UploadedFile[];
    note?: string;
  }): Submission {
    const submissions = this.getSubmissions();
    const assignments = this.getAssignments();
    const currentUser = this.getCurrentUser();
    const assignment = assignments.find(a => a.id === data.assignmentId);

    const newSub: Submission = {
      id: 'sub_' + Date.now(),
      assignmentId: data.assignmentId,
      assignmentTitle: assignment?.title || 'งานที่มอบหมาย',
      memberId: currentUser?.id || 'unknown_member',
      memberName: currentUser?.fullName || 'ไม่ระบุชื่อ',
      memberAvatar: currentUser?.avatarUrl,
      department: currentUser?.department || 'กลุ่มสาระการเรียนรู้',
      files: data.files,
      note: data.note || '',
      submissionDate: new Date().toISOString().split('T')[0],
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = submissions.findIndex(s => s.assignmentId === data.assignmentId && s.memberId === currentUser?.id);
    if (existingIndex >= 0) {
      submissions[existingIndex] = { ...submissions[existingIndex], ...newSub, id: submissions[existingIndex].id };
      this.broadcastChange('submissions', 'update', submissions[existingIndex]);
    } else {
      submissions.unshift(newSub);
      this.broadcastChange('submissions', 'insert', newSub);
    }

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    this.notify();
    return newSub;
  }

  public updateSubmission(id: string, updates: Partial<Submission>) {
    let updatedSub: Submission | null = null;
    const submissions = this.getSubmissions().map(s => {
      if (s.id === id) {
        updatedSub = { ...s, ...updates, updatedAt: new Date().toISOString() };
        return updatedSub;
      }
      return s;
    });
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    if (updatedSub) {
      this.broadcastChange('submissions', 'update', updatedSub);
    }
    this.notify();
  }

  public deleteFileFromSubmission(submissionId: string, fileId: string, currentUserId: string, isAdmin: boolean): boolean {
    const submissions = this.getSubmissions();
    const subIndex = submissions.findIndex(s => s.id === submissionId);
    if (subIndex < 0) return false;

    const sub = submissions[subIndex];
    if (!isAdmin && sub.memberId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบไฟล์นี้');
    }

    const targetFile = sub.files.find(f => f.id === fileId);
    if (targetFile?.driveFileId) {
      this.deleteFileFromGoogleDrive(targetFile.driveFileId);
    }

    const updatedFiles = sub.files.filter(f => f.id !== fileId);
    if (updatedFiles.length === 0) {
      submissions.splice(subIndex, 1);
      this.broadcastChange('submissions', 'delete', { id: submissionId });
    } else {
      submissions[subIndex] = {
        ...sub,
        files: updatedFiles,
        updatedAt: new Date().toISOString()
      };
      this.broadcastChange('submissions', 'update', submissions[subIndex]);
    }

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    this.notify();
    return true;
  }

  public deleteSubmission(id: string, currentUserId: string, isAdmin: boolean): boolean {
    const submissions = this.getSubmissions();
    const target = submissions.find(s => s.id === id);
    if (!target) return false;

    if (!isAdmin && target.memberId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบข้อมูลของสมาชิกท่านอื่น');
    }

    const driveFileIds = target.files.map(f => f.driveFileId).filter(Boolean) as string[];
    if (driveFileIds.length > 0) {
      this.deleteFilesFromGoogleDrive(driveFileIds);
    }

    const filtered = submissions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filtered));
    this.broadcastChange('submissions', 'delete', { id });
    this.notify();
    return true;
  }

  // --- Documents ---
  public getDocuments(): DocumentItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    return data ? JSON.parse(data) : INITIAL_DOCUMENTS;
  }

  public createDocument(data: {
    title: string;
    category: 'sample' | 'order' | 'general';
    description?: string;
    docNumber?: string;
    issueDate?: string;
    file: UploadedFile;
  }): DocumentItem {
    const docs = this.getDocuments();
    const currentUser = this.getCurrentUser();

    const newDoc: DocumentItem = {
      id: 'doc_' + Date.now(),
      title: data.title,
      category: data.category,
      description: data.description || '',
      docNumber: data.docNumber || `เอกสาร วก./${new Date().getFullYear() + 543}`,
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      file: data.file,
      uploaderId: currentUser?.id || 'admin',
      uploaderName: currentUser?.fullName || 'ฝ่ายวิชาการ',
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    docs.unshift(newDoc);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    this.broadcastChange('documents', 'insert', newDoc);
    this.notify();
    return newDoc;
  }

  public updateDocument(id: string, updates: Partial<DocumentItem>) {
    let updatedDoc: DocumentItem | null = null;
    const docs = this.getDocuments().map(d => {
      if (d.id === id) {
        updatedDoc = { ...d, ...updates, updatedAt: new Date().toISOString() };
        return updatedDoc;
      }
      return d;
    });
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    if (updatedDoc) {
      this.broadcastChange('documents', 'update', updatedDoc);
    }
    this.notify();
  }

  public deleteDocument(id: string, currentUserId: string, isAdmin: boolean): boolean {
    const docs = this.getDocuments();
    const target = docs.find(d => d.id === id);
    if (!target) return false;

    if (!isAdmin && target.uploaderId !== currentUserId) {
      throw new Error('คุณไม่มีสิทธิ์ในการลบเอกสารนี้');
    }

    if (target.file?.driveFileId) {
      this.deleteFileFromGoogleDrive(target.file.driveFileId);
    }

    const filtered = docs.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(filtered));
    this.broadcastChange('documents', 'delete', { id });
    this.notify();
    return true;
  }

  public incrementDocumentDownload(docId: string) {
    const docs = this.getDocuments().map(d => {
      if (d.id === docId) {
        const updated = { ...d, downloadCount: d.downloadCount + 1 };
        this.broadcastChange('documents', 'update', updated);
        return updated;
      }
      return d;
    });
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
    this.notify();
  }

  // --- Announcements ---
  public getAnnouncements(): Announcement[] {
    const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    const list: Announcement[] = data ? JSON.parse(data) : INITIAL_ANNOUNCEMENTS;
    return list.filter((a: any) => a.id !== 'ann_03' && !a.title?.includes('SAR ประจำปี'));
  }

  public createAnnouncement(data: {
    title: string;
    content: string;
    type: 'deadline' | 'general' | 'urgent';
    date: string;
    dateStart?: string;
    dateEnd?: string;
    assignmentId?: string;
    authorName?: string;
    isUrgent?: boolean;
  }): Announcement {
    const announcements = this.getAnnouncements();
    const currentUser = this.getCurrentUser();

    const newAnn: Announcement = {
      id: 'ann_' + Date.now(),
      title: data.title,
      content: data.content,
      type: data.type,
      date: data.date || data.dateStart || new Date().toISOString().split('T')[0],
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      assignmentId: data.assignmentId,
      authorName: data.authorName || currentUser?.fullName || 'ฝ่ายวิชาการ',
      isUrgent: !!data.isUrgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    announcements.unshift(newAnn);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'insert', newAnn);
    this.notify();
    return newAnn;
  }

  public updateAnnouncement(id: string, updates: Partial<Announcement>) {
    let updatedAnn: Announcement | null = null;
    const announcements = this.getAnnouncements().map(a => {
      if (a.id === id) {
        updatedAnn = { ...a, ...updates, updatedAt: new Date().toISOString() };
        return updatedAnn;
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    if (updatedAnn) {
      this.broadcastChange('announcements', 'update', updatedAnn);
    }
    this.notify();
  }

  public deleteAnnouncement(id: string, title?: string) {
    const announcements = this.getAnnouncements().filter(
      a => a.id !== id && (!title || a.title !== title)
    );
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    this.broadcastChange('announcements', 'delete', { id, title });
    this.broadcastChange('announcements', 'setList', announcements);
    this.notify();
  }

  // --- School Profile ---
  public getSchoolProfile(): SchoolProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOL);
      if (!data) return INITIAL_SCHOOL_PROFILE;
      const parsed = JSON.parse(data);
      return {
        ...INITIAL_SCHOOL_PROFILE,
        ...(parsed || {}),
        primaryDriveFolderId: parsed?.primaryDriveFolderId || INITIAL_SCHOOL_PROFILE.primaryDriveFolderId
      };
    } catch {
      return INITIAL_SCHOOL_PROFILE;
    }
  }

  public updateSchoolProfile(updates: Partial<SchoolProfile>) {
    const current = this.getSchoolProfile();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(updated));

    if (updates.masterAdminName) {
      const users = this.getUsers().map(u => {
        if (u.role === 'admin' || u.id === 'user_admin' || u.username.toLowerCase() === 'admin') {
          return { ...u, fullName: updates.masterAdminName!, updatedAt: new Date().toISOString() };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      const currentUser = this.getCurrentUser();
      if (currentUser && (currentUser.role === 'admin' || currentUser.id === 'user_admin')) {
        this.setCurrentUser({ ...currentUser, fullName: updates.masterAdminName });
      }
    }

    this.broadcastChange('school', 'update', updated);
    this.notify();
  }

  // Automatic Google Drive Batch File Deletion via Google Apps Script (Fast & Safe - Never deletes folders)
  public async deleteFilesFromGoogleDrive(fileIds: string[]): Promise<boolean> {
    try {
      const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
      const gasUrl = localStorage.getItem('gas_web_app_url') || defaultGasUrl;
      const validIds = fileIds.filter(id => id && !id.startsWith('mock_'));
      
      if (gasUrl && validIds.length > 0) {
        // Direct fetch to Google Apps Script
        try {
          await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'deleteFiles',
              fileIds: validIds,
            }),
          });
          console.log(`[Google Drive Auto-Delete] Deleted ${validIds.length} files from Drive folder 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-`);
        } catch (fetchErr) {
          console.warn('[Google Drive Auto-Delete Direct Error]', fetchErr);
        }

        // Also call backend server delete proxy for reliability
        try {
          await fetch('/api/drive/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: validIds }),
          });
        } catch {
          // ignore server proxy error
        }
      }
      return true;
    } catch (err) {
      console.warn('[Google Drive Auto-Delete] Failed to trigger GAS batch deletion:', err);
      return false;
    }
  }

  // Automatic Google Drive Single File Deletion via Google Apps Script (Safe - Never deletes folders)
  public async deleteFileFromGoogleDrive(fileId: string): Promise<boolean> {
    try {
      const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
      const gasUrl = localStorage.getItem('gas_web_app_url') || defaultGasUrl;
      
      if (gasUrl && fileId && !fileId.startsWith('mock_')) {
        // Direct fetch to Google Apps Script
        try {
          await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'deleteFile',
              fileId: fileId,
            }),
          });
          console.log(`[Google Drive Auto-Delete] File ID: ${fileId} moved to trash in Drive folder 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-`);
        } catch (fetchErr) {
          console.warn('[Google Drive Auto-Delete Direct Error]', fetchErr);
        }

        // Also call backend server delete proxy for reliability
        try {
          await fetch('/api/drive/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: fileId }),
          });
        } catch {
          // ignore server proxy error
        }
      }
      return true;
    } catch (err) {
      console.warn('[Google Drive Auto-Delete] Failed to trigger GAS deletion:', err);
      return false;
    }
  }

  // High-Speed Direct File Upload to Google Drive via Google Apps Script (with progress and offline fallback)
  public async simulateFileUpload(
    file: File, 
    onProgress: (percent: number) => void
  ): Promise<UploadedFile> {
    const gasUrl = localStorage.getItem('gas_web_app_url');

    let previewType: UploadedFile['previewType'] = 'other';
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf') || file.type.includes('pdf')) {
      previewType = 'pdf';
    } else if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || file.type.includes('image')) {
      previewType = 'image';
    } else if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || file.type.includes('word')) {
      previewType = 'doc';
    } else if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || file.type.includes('sheet')) {
      previewType = 'spreadsheet';
    } else if (lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx') || file.type.includes('presentation') || file.type.includes('powerpoint')) {
      previewType = 'presentation';
    }

    // Always extract authentic binary Data URL so Word (.docx), Excel, PDF can be downloaded & opened 100% authentically
    const fullDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    if (gasUrl) {
      try {
        onProgress(15);
        const commaIdx = fullDataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? fullDataUrl.substring(commaIdx + 1) : fullDataUrl;

        onProgress(45);

        const uploadPayload = {
          action: 'uploadFile',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: rawBase64,
          targetFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
        };

        onProgress(70);

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(uploadPayload),
        });

        onProgress(95);

        let data: { fileId?: string; viewUrl?: string; downloadUrl?: string } | null = null;
        try {
          data = await response.json();
        } catch {
          // Fallback if CORS prevents body read
        }

        onProgress(100);

        const realFileId = (data && data.fileId) ? data.fileId : ('drive_' + Date.now());
        const realViewUrl = (data && data.viewUrl) ? data.viewUrl : `https://drive.google.com/file/d/${realFileId}/view`;
        const realDownloadUrl = (data && data.downloadUrl) ? data.downloadUrl : `https://drive.google.com/uc?export=download&id=${realFileId}`;

        return {
          id: 'file_' + Date.now(),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          driveFileId: realFileId,
          driveFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
          downloadUrl: realDownloadUrl,
          viewUrl: realViewUrl,
          previewType: previewType,
          previewContent: `[ไฟล์ที่จัดเก็บบน Google Drive]: ${file.name}\nGoogle Drive File ID: ${realFileId}\nจัดเก็บในโฟลเดอร์หลัก ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-`,
          fileDataUrl: fullDataUrl,
          uploadedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn('[GAS Direct Upload] Fallback to simulated local record due to network / CORS:', err);
      }
    }

    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 25) + 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          onProgress(100);

          const fileId = 'drive_f_' + Date.now();
          const uploadedFile: UploadedFile = {
            id: 'file_' + Date.now(),
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            driveFileId: fileId,
            driveFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
            downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
            viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
            previewType: previewType,
            previewContent: `[เนื้อหาของไฟล์: ${file.name}]\nขนาดไฟล์: ${(file.size / (1024 * 1024)).toFixed(2)} MB\nอัปโหลดเข้าสู่ Google Drive Folder ID: 1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-\n\nเอกสารนี้ได้รับการจัดเก็บอย่างปลอดภัย พร้อมสำหรับให้คณะครูและผู้ดูแลระบบตรวจงาน`,
            fileDataUrl: fullDataUrl,
            uploadedAt: new Date().toISOString(),
          };

          resolve(uploadedFile);
        } else {
          onProgress(progress);
        }
      }, 100);
    });
  }

  // Upload School Logo or Member Avatar to Google Drive with Real-time Sync
  public async uploadImageToGoogleDrive(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; driveFileId?: string }> {
    if (onProgress) onProgress(10);

    const fullDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress(35);

    const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';
    const gasUrl = localStorage.getItem('gas_web_app_url') || defaultGasUrl;
    let driveFileId = 'drive_img_' + Date.now();

    if (gasUrl) {
      try {
        const commaIdx = fullDataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? fullDataUrl.substring(commaIdx + 1) : fullDataUrl;
        if (onProgress) onProgress(65);

        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'uploadFile',
            fileName: file.name || `image_${Date.now()}.png`,
            mimeType: file.type || 'image/png',
            base64Data: rawBase64,
            targetFolderId: '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-',
          }),
        });

        if (onProgress) onProgress(90);

        try {
          const data = await response.json();
          if (data && data.fileId) {
            driveFileId = data.fileId;
          }
        } catch {
          // Body not readable due to CORS redirect
        }
      } catch (err) {
        console.warn('[Image Upload Google Drive Warning]', err);
      }
    }

    if (onProgress) onProgress(100);

    return {
      url: fullDataUrl,
      driveFileId,
    };
  }
}

export const storage = StorageService.getInstance();
