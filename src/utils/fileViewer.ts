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
 * Utility to open authentic attached files directly in Google Drive in a full-screen new tab.
 * Ensures 100% fidelity to the original file, zero CORS/scrambling issues on Cloudflare,
 * and directly matches the user's intent to view the file in Google Drive.
 */
export function openAuthenticFileInNewTab(
  file: UploadedFile,
  _assignmentTitle?: string,
  _submitterName?: string
) {
  if (!file) return;

  const driveUrl = getGoogleDriveFileUrl(file);
  const newTab = window.open(driveUrl, '_blank', 'noopener,noreferrer');
  if (!newTab) {
    alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิดดูตัวอย่างไฟล์ใน Google Drive');
  }
}
