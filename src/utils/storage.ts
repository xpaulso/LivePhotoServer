import fs from 'fs';
import path from 'path';

export interface LivePhotoMetadata {
  id: string;
  photoFile: string;
  videoFile: string;
  photoSize: number;
  videoSize: number;
  creationDate: string;
  uploadDate: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  videoUrl?: string;
  galleryId?: string;
  galleryName?: string;
  galleryDeletePassword?: string;
  galleryViewPassword?: string;
}

export interface GalleryInfo {
  id: string;
  name: string;
  photoCount: number;
  lastUpdated: string;
}

export function getUploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
}

export function ensureUploadDir(): void {
  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
}

export async function saveMetadata(filePath: string, metadata: LivePhotoMetadata): Promise<void> {
  const jsonContent = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
