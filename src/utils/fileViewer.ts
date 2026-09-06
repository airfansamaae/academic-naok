import { UploadedFile } from '../types';

export interface RawFilePayload {
  file: UploadedFile;
  assignmentTitle?: string;
  submitterName?: string;
  openedAt: number;
}

/**
 * Returns a clean Google Drive preview URL with minimal parameters
 * strictly stripping Google Drive top chrome, print, and copy UI.
 * NEVER routes through Google Docs Viewer (docs.google.com/viewer) which causes white screen issues.
 */
export function getSafeGoogleDrivePreviewUrl(file: UploadedFile): string {
  if (!file) return '';
  
  let driveId = file.driveFileId;
  if (!driveId && file.viewUrl) {
    const match = file.viewUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) driveId = match[1];
  }

  if (driveId) {
    // rm=minimal strips Google Drive navigation bar, print menu, and pop-out
    return `https://drive.google.com/file/d/${driveId}/preview?rm=minimal&embedded=true`;
  }

  if (file.viewUrl && !file.viewUrl.includes('docs.google.com/viewer')) {
    if (file.viewUrl.includes('/view')) {
      return file.viewUrl.replace('/view', '/preview?rm=minimal&embedded=true');
    }
    return file.viewUrl;
  }

  return '';
}

/**
 * Returns the direct Google Drive view URL for an uploaded file (for direct link references)
 */
export function getGoogleDriveFileUrl(file: UploadedFile): string {
  if (!file) return 'https://drive.google.com';
  if (file.viewUrl && file.viewUrl.startsWith('http')) {
    // Strip any inadvertent Google Docs Viewer prefixes
    if (file.viewUrl.includes('docs.google.com/viewer?url=')) {
      const actualUrl = decodeURIComponent(file.viewUrl.split('url=')[1]?.split('&')[0] || '');
      if (actualUrl) return actualUrl;
    }
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
 * Utility to open authentic attached files directly in a dedicated new tab/window.
 * Strictly renders the authentic raw original file (A4-paginated DOCX, native PDF, XLSX workbook, Images)
 * with zero clutter and zero white-screen failures:
 * - DIRECT RAW FILE LOADING: Never passes through Google Docs Viewer
 * - GOOGLE DRIVE UI DISABLED: Parameters set to rm=minimal&embedded=true to disable print and copy UI
 * - A4 FORMATTED: Exact alignment with clear page separators and margins
 * - NO printer icon/button
 * - NO copy text icon/button
 * - ONLY 1 single green download button
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

  // Construct target URL with explicit parameters to prevent any fallback to Google Docs Viewer
  const queryParams = new URLSearchParams({
    view_raw_file: '1',
    file_id: file.id || '',
    name: file.name || '',
    mime: file.mimeType || '',
    no_gdoc_viewer: '1',
    rm: 'minimal',
    title: assignmentTitle || '',
    uploader: submitterName || '',
  });

  const url = `/?${queryParams.toString()}`;

  // 1. Open new window immediately inside user click handler to bypass pop-up blockers
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

