import { getAccessToken, googleSignIn } from './googleAuthService';

export const ROOT_DRIVE_FOLDER_ID = '1IpsaGJhJqtuYHTLiHmT2kqOe7CBq4as-';

export interface DriveUploadResult {
  fileId: string;
  viewUrl: string;
  downloadUrl: string;
  folderId: string;
}

/**
 * Upload a file directly to Google Drive API v3
 */
export async function uploadFileToGoogleDrive(
  file: File,
  targetFolderId: string = ROOT_DRIVE_FOLDER_ID,
  onProgress?: (percent: number) => void
): Promise<DriveUploadResult> {
  let token = await getAccessToken();

  // If not authenticated with Google yet, trigger Google Sign-in popup
  if (!token) {
    try {
      const authRes = await googleSignIn();
      if (authRes?.accessToken) {
        token = authRes.accessToken;
      }
    } catch (authErr: any) {
      console.warn('[googleDriveService] Google Sign-in not completed:', authErr);
      throw new Error(
        'จำเป็นต้องเชื่อมต่อบัญชี Google เพื่อให้ไฟล์อัปโหลดเข้าสู่ Google Drive ของโรงเรียนโดยตรง'
      );
    }
  }

  if (!token) {
    throw new Error('ไม่พบสิทธิ์การเชื่อมต่อ Google Drive');
  }

  if (onProgress) onProgress(10);

  const folderToUse = targetFolderId || ROOT_DRIVE_FOLDER_ID;

  // Method 1: Google Drive Resumable Upload (Highly robust for all file sizes)
  try {
    const metadata = {
      name: file.name,
      parents: [folderToUse],
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
          'X-Upload-Content-Length': file.size.toString(),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      if (initRes.status === 401) {
        // Token expired, retry auth once
        const retryAuth = await googleSignIn();
        if (retryAuth?.accessToken) {
          return uploadFileToGoogleDrive(file, targetFolderId, onProgress);
        }
      }
      throw new Error(`เริ่มต้นการอัปโหลดไป Google Drive ไม่สำเร็จ (${initRes.status})`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google Drive ไม่ได้ส่ง URL สำหรับอัปโหลด');
    }

    if (onProgress) onProgress(25);

    // Upload the file content via XMLHttpRequest to track accurate progress
    const uploadedDriveData = await new Promise<{ id: string; name: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 65) + 25;
            onProgress(Math.min(pct, 90));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve({ id: 'file_' + Date.now(), name: file.name });
          }
        } else {
          reject(new Error(`อัปโหลดไฟล์ไป Google Drive ขัดข้อง (สถานะ: ${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('การเชื่อมต่อกับ Google Drive ขัดข้อง'));
      xhr.send(file);
    });

    if (onProgress) onProgress(92);

    const driveFileId = uploadedDriveData.id;

    // Set permission to reader (so anyone in school or with link can view/download)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permErr) {
      console.warn('[googleDriveService] Set permission warning:', permErr);
    }

    // Retrieve full links
    let viewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
    let downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,webViewLink,webContentLink`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.webViewLink) viewUrl = meta.webViewLink;
        if (meta.webContentLink) downloadUrl = meta.webContentLink;
      }
    } catch {
      // Keep defaults
    }

    if (onProgress) onProgress(100);

    return {
      fileId: driveFileId,
      viewUrl,
      downloadUrl,
      folderId: folderToUse,
    };
  } catch (error: any) {
    console.error('[googleDriveService] Upload failed:', error);
    throw error;
  }
}

/**
 * Create a subfolder inside Google Drive
 */
export async function createGoogleDriveSubfolder(
  folderName: string,
  parentFolderId: string = ROOT_DRIVE_FOLDER_ID
): Promise<{ folderId: string; folderName: string }> {
  let token = await getAccessToken();
  if (!token) {
    return {
      folderId: `${parentFolderId}_${Date.now()}`,
      folderName,
    };
  }

  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId || ROOT_DRIVE_FOLDER_ID],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        folderId: data.id,
        folderName: data.name || folderName,
      };
    }
  } catch (err) {
    console.warn('[googleDriveService] Folder creation fallback:', err);
  }

  return {
    folderId: `${parentFolderId}_${Date.now()}`,
    folderName,
  };
}

/**
 * Delete a file from Google Drive (Requires user confirmation prior to call)
 */
export async function deleteFileFromGoogleDrive(fileId: string): Promise<boolean> {
  if (!fileId || fileId.startsWith('mock_') || fileId.startsWith('drive_f_')) {
    return true;
  }

  const token = await getAccessToken();
  if (!token) {
    // If no direct OAuth token, relay through server proxy
    try {
      await fetch('/api/drive/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn('[googleDriveService] Delete file error:', err);
    return false;
  }
}
