import { UploadedFile } from '../types';

export interface RawFilePayload {
  file: UploadedFile;
  assignmentTitle?: string;
  submitterName?: string;
  openedAt: number;
}

/**
 * Returns the direct Google Drive view URL for an uploaded file
 */
export function getGoogleDriveFileUrl(file: UploadedFile): string {
  if (!file) return 'https://drive.google.com';
  if (file.viewUrl && file.viewUrl.startsWith('http')) {
    return file.viewUrl;
  }
  if (file.driveFileId) {
    return `https://drive.google.com/file/d/${file.driveFileId}/view`;
  }
  if (file.driveFolderId) {
    return `https://drive.google.com/drive/folders/${file.driveFolderId}`;
  }
  return 'https://drive.google.com';
}

/**
 * Utility to open authentic attached files in a dedicated new tab/window.
 * Strictly renders the authentic raw file (PDF, Word docx, Excel xlsx, Images, etc.)
 * with zero clutter:
 * - NO printer icon/button
 * - NO copy text icon/button
 * - NO duplicate buttons (only 1 single download button)
 * - NO Google Drive links
 */
export function openAuthenticFileInNewTab(
  file: UploadedFile,
  assignmentTitle?: string,
  submitterName?: string
) {
  if (!file) return;

  const payload: RawFilePayload = {
    file,
    assignmentTitle: assignmentTitle || '',
    submitterName: submitterName || '',
    openedAt: Date.now(),
  };

  // 1. Open new window immediately inside the user click handler to bypass pop-up blockers
  const url = `/?view_raw_file=1&file_id=${encodeURIComponent(file.id || '')}`;
  const newTab = window.open(url, '_blank');

  if (newTab) {
    try {
      (newTab as any).__RAW_FILE_PAYLOAD__ = payload;
    } catch {
      // ignore cross-window security error if any
    }
  }

  // 2. Set on window (parent window) so child can access via window.opener
  try {
    (window as any).__LAST_ACTIVE_RAW_FILE__ = payload;
  } catch {
    // ignore
  }

  // 3. Cache in sessionStorage
  try {
    sessionStorage.setItem('academic_active_raw_file', JSON.stringify(payload));
  } catch {
    // ignore
  }

  // 4. Cache in localStorage with size-safe try/catch
  try {
    localStorage.setItem('academic_active_raw_file', JSON.stringify(payload));
  } catch (err) {
    console.warn('[fileViewer] Could not cache raw file in localStorage:', err);
  }

  // 5. Fallback if pop-up was completely blocked
  if (!newTab) {
    window.location.href = url;
  }
}
