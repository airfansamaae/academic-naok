import { UploadedFile } from '../types';

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

  try {
    localStorage.setItem(
      'academic_active_raw_file',
      JSON.stringify({
        file,
        assignmentTitle: assignmentTitle || '',
        submitterName: submitterName || '',
        openedAt: Date.now()
      })
    );
  } catch (err) {
    console.warn('[fileViewer] Could not cache raw file in localStorage:', err);
  }

  const url = `/?view_raw_file=1&file_id=${encodeURIComponent(file.id || '')}`;
  const newTab = window.open(url, '_blank');
  
  if (!newTab) {
    // If pop-up blocker intervened, navigate or open
    window.location.href = url;
  }
}
