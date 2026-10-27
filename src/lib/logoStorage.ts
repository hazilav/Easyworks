import fs from 'node:fs';
import path from 'node:path';
import { getDatabaseFilePath } from './db/database';

/**
 * Directory for permanent server-side logo files.
 * Placed in 'data/uploads/logos' alongside 'easyworks.db' so it is preserved with DB data.
 */
export function getPersistentLogoDir(): string {
  const dbPath = getDatabaseFilePath();
  const dbDir = path.dirname(dbPath);
  const uploadsDir = path.join(dbDir, 'uploads', 'logos');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[logoStorage] Failed to create persistent logo directory:', err);
  }
  return uploadsDir;
}

/**
 * Public uploads directory for direct static serving if available.
 */
export function getPublicLogoDir(): string {
  const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
  try {
    if (!fs.existsSync(publicUploadsDir)) {
      fs.mkdirSync(publicUploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[logoStorage] Failed to create public logo directory:', err);
  }
  return publicUploadsDir;
}

/**
 * Determines file extension from mime type.
 */
export function getExtensionFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
  }
}

/**
 * Determines mime type from file extension.
 */
export function getMimeFromExtension(ext: string): string {
  switch (ext.toLowerCase().replace('.', '')) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

export interface SavedLogoUrls {
  logoUrl: string;
  logoOriginalUrl: string;
  logoProcessedUrl: string;
  originalPath: string;
  processedPath: string;
  activePath: string;
}

/**
 * Saves original and processed logos to persistent server storage.
 */
export function saveLogoToStorage(
  userId: string,
  originalBuffer: Buffer,
  originalMime: string,
  processedBuffer: Buffer,
  activeMode: 'transparent' | 'original' = 'transparent'
): SavedLogoUrls {
  const persistentDir = getPersistentLogoDir();
  const publicDir = getPublicLogoDir();

  const origExt = getExtensionFromMime(originalMime);
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // File names
  const origFileName = `${safeUserId}-original.${origExt}`;
  const procFileName = `${safeUserId}-transparent.png`;
  const activeFileName = `${safeUserId}-active.png`;

  // Persistent file paths
  const persistentOrigPath = path.join(persistentDir, origFileName);
  const persistentProcPath = path.join(persistentDir, procFileName);
  const persistentActivePath = path.join(persistentDir, activeFileName);

  // Write original file
  fs.writeFileSync(persistentOrigPath, originalBuffer);
  // Write processed transparent file
  fs.writeFileSync(persistentProcPath, processedBuffer);
  // Write active file
  const activeBuffer = activeMode === 'original' ? originalBuffer : processedBuffer;
  fs.writeFileSync(persistentActivePath, activeBuffer);

  // Also write to public folder for static serving if accessible
  try {
    fs.writeFileSync(path.join(publicDir, origFileName), originalBuffer);
    fs.writeFileSync(path.join(publicDir, procFileName), processedBuffer);
    fs.writeFileSync(path.join(publicDir, activeFileName), activeBuffer);
  } catch (publicErr) {
    console.warn('[logoStorage] Note: Could not write to public folder (ignored):', publicErr);
  }

  const v = Date.now();
  const baseUrl = `/api/business/logo/file?userId=${encodeURIComponent(userId)}`;

  return {
    logoUrl: `${baseUrl}&type=active&v=${v}`,
    logoOriginalUrl: `${baseUrl}&type=original&v=${v}`,
    logoProcessedUrl: `${baseUrl}&type=transparent&v=${v}`,
    originalPath: persistentOrigPath,
    processedPath: persistentProcPath,
    activePath: persistentActivePath,
  };
}

/**
 * Switches the active logo file between transparent and original.
 */
export function switchActiveLogoFile(
  userId: string,
  mode: 'transparent' | 'original'
): { success: boolean; activeUrl: string } {
  const persistentDir = getPersistentLogoDir();
  const publicDir = getPublicLogoDir();
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const procPath = path.join(persistentDir, `${safeUserId}-transparent.png`);
  // Find original file with any extension
  const files = fs.existsSync(persistentDir) ? fs.readdirSync(persistentDir) : [];
  const origMatch = files.find(f => f.startsWith(`${safeUserId}-original.`));
  const origPath = origMatch ? path.join(persistentDir, origMatch) : null;

  const targetPath = mode === 'original' ? origPath : procPath;
  const activeFileName = `${safeUserId}-active.png`;

  if (targetPath && fs.existsSync(targetPath)) {
    const data = fs.readFileSync(targetPath);
    fs.writeFileSync(path.join(persistentDir, activeFileName), data);
    try {
      fs.writeFileSync(path.join(publicDir, activeFileName), data);
    } catch {}
  }

  const v = Date.now();
  return {
    success: true,
    activeUrl: `/api/business/logo/file?userId=${encodeURIComponent(userId)}&type=active&v=${v}`,
  };
}

/**
 * Reads a logo file from disk.
 */
export function getLogoFileFromStorage(
  userId: string,
  type: 'active' | 'original' | 'transparent'
): { buffer: Buffer; mimeType: string } | null {
  const persistentDir = getPersistentLogoDir();
  const publicDir = getPublicLogoDir();
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Search in persistentDir first, then publicDir
  const searchDirs = [persistentDir, publicDir];

  for (const dir of searchDirs) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) continue;

    if (type === 'active') {
      const activePath = path.join(dir, `${safeUserId}-active.png`);
      if (fs.existsSync(/*turbopackIgnore: true*/ activePath)) {
        return { buffer: fs.readFileSync(/*turbopackIgnore: true*/ activePath), mimeType: 'image/png' };
      }
    } else if (type === 'transparent') {
      const transPath = path.join(dir, `${safeUserId}-transparent.png`);
      if (fs.existsSync(/*turbopackIgnore: true*/ transPath)) {
        return { buffer: fs.readFileSync(/*turbopackIgnore: true*/ transPath), mimeType: 'image/png' };
      }
    } else if (type === 'original') {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ dir);
      const match = files.find(f => f.startsWith(`${safeUserId}-original.`));
      if (match) {
        const fullPath = path.join(/*turbopackIgnore: true*/ dir, match);
        const ext = path.extname(match);
        return { buffer: fs.readFileSync(/*turbopackIgnore: true*/ fullPath), mimeType: getMimeFromExtension(ext) };
      }
    }
  }

  return null;
}

/**
 * Deletes logo files from disk for a user.
 */
export function deleteLogoFiles(userId: string): void {
  const persistentDir = getPersistentLogoDir();
  const publicDir = getPublicLogoDir();
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const dirs = [persistentDir, publicDir];
  for (const dir of dirs) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) continue;
    try {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ dir);
      for (const file of files) {
        if (file.startsWith(`${safeUserId}-`)) {
          fs.unlinkSync(/*turbopackIgnore: true*/ path.join(dir, file));
        }
      }
    } catch (e) {
      console.warn('[logoStorage] Error cleaning logo files:', e);
    }
  }
}
