import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getUploadDir, LivePhotoMetadata, GalleryInfo } from '../utils/storage';

const router = Router();

// List all galleries HTML page
router.get('/', async (req: Request, res: Response) => {
  try {
    const uploadDir = getUploadDir();
    const galleries: GalleryInfo[] = [];

    if (fs.existsSync(uploadDir)) {
      const galleryDirs = fs.readdirSync(uploadDir).filter(dir => {
        const fullPath = path.join(uploadDir, dir);
        return fs.statSync(fullPath).isDirectory();
      });

      for (const galleryDir of galleryDirs) {
        const dirPath = path.join(uploadDir, galleryDir);
        const files = fs.readdirSync(dirPath);
        const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

        let galleryName = galleryDir;
        let lastUpdated = new Date(0).toISOString();

        if (metadataFiles.length > 0) {
          const firstMetadata = path.join(dirPath, metadataFiles[0]);
          const content = fs.readFileSync(firstMetadata, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;
          galleryName = metadata.galleryName || galleryDir;

          for (const file of metadataFiles) {
            const metadataPath = path.join(dirPath, file);
            const metaContent = fs.readFileSync(metadataPath, 'utf-8');
            const meta = JSON.parse(metaContent) as LivePhotoMetadata;
            if (new Date(meta.uploadDate) > new Date(lastUpdated)) {
              lastUpdated = meta.uploadDate;
            }
          }
        }

        galleries.push({
          id: galleryDir,
          name: galleryName,
          photoCount: metadataFiles.length,
          lastUpdated
        });
      }

      galleries.sort((a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      );
    }

    const html = renderGalleryListPage(galleries);
    res.type('html').send(html);
  } catch (error) {
    console.error('Error rendering gallery list:', error);
    res.status(500).send('Error loading galleries');
  }
});

// Single gallery HTML page
router.get('/:galleryId', async (req: Request, res: Response) => {
  try {
    const { galleryId } = req.params;
    const uploadDir = getUploadDir();
    const galleryPath = path.join(uploadDir, galleryId);
    const photos: (LivePhotoMetadata & { photoUrl: string; videoUrl: string })[] = [];
    let galleryName = galleryId;

    if (fs.existsSync(galleryPath)) {
      const files = fs.readdirSync(galleryPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(galleryPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.galleryName) {
            galleryName = metadata.galleryName;
          }

          photos.push({
            ...metadata,
            photoUrl: `/files/${galleryId}/${metadata.photoFile}`,
            videoUrl: `/files/${galleryId}/${metadata.videoFile}`
          });
        }
      }

      photos.sort((a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );
    }

    const html = renderGalleryPage(galleryName, photos);
    res.type('html').send(html);
  } catch (error) {
    console.error('Error rendering gallery:', error);
    res.status(500).send('Error loading gallery');
  }
});

function renderGalleryListPage(galleries: GalleryInfo[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Photo Galleries</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      font-weight: 300;
      font-size: 2em;
    }
    .count {
      text-align: center;
      color: #888;
      margin-bottom: 30px;
    }
    .galleries {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .gallery-card {
      background: #2a2a2a;
      border-radius: 12px;
      padding: 24px;
      transition: transform 0.2s, background 0.2s;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .gallery-card:hover {
      transform: scale(1.02);
      background: #333;
    }
    .gallery-name {
      font-size: 1.4em;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .gallery-stats {
      color: #888;
      font-size: 14px;
    }
    .gallery-date {
      color: #666;
      font-size: 13px;
      margin-top: 8px;
    }
    .empty {
      text-align: center;
      color: #666;
      padding: 60px 20px;
    }
  </style>
</head>
<body>
  <h1>Live Photo Galleries</h1>
  <p class="count">${galleries.length} galler${galleries.length !== 1 ? 'ies' : 'y'}</p>

  ${galleries.length === 0 ? '<p class="empty">No galleries yet</p>' : `
  <div class="galleries">
    ${galleries.map(gallery => `
      <a href="/gallery/${gallery.id}" class="gallery-card">
        <div class="gallery-name">${escapeHtml(gallery.name)}</div>
        <div class="gallery-stats">${gallery.photoCount} photo${gallery.photoCount !== 1 ? 's' : ''}</div>
        <div class="gallery-date">Last updated: ${new Date(gallery.lastUpdated).toLocaleDateString()}</div>
      </a>
    `).join('')}
  </div>
  `}
</body>
</html>`;
}

function renderGalleryPage(galleryName: string, photos: (LivePhotoMetadata & { photoUrl: string; videoUrl: string })[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(galleryName)} - Live Photos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .back-link {
      color: #4a9eff;
      text-decoration: none;
      font-size: 14px;
      display: inline-block;
      margin-bottom: 15px;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    h1 {
      font-weight: 300;
      font-size: 2em;
      margin-bottom: 10px;
    }
    .count {
      color: #888;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .photo-card {
      background: #2a2a2a;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s;
    }
    .photo-card:hover {
      transform: scale(1.02);
    }
    .media-container {
      position: relative;
      aspect-ratio: 4/3;
      background: #000;
      cursor: pointer;
    }
    .media-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .media-container video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .media-container.playing video {
      opacity: 1;
    }
    @media (hover: hover) {
      .media-container:hover video {
        opacity: 1;
      }
    }
    .live-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .photo-info {
      padding: 15px;
    }
    .photo-date {
      color: #888;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .photo-size {
      color: #666;
      font-size: 12px;
    }
    .empty {
      text-align: center;
      color: #666;
      padding: 60px 20px;
    }
    .download-links {
      margin-top: 10px;
      display: flex;
      gap: 10px;
    }
    .download-links a {
      color: #4a9eff;
      text-decoration: none;
      font-size: 13px;
    }
    .download-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="/gallery" class="back-link">&larr; All Galleries</a>
    <h1>${escapeHtml(galleryName)}</h1>
    <p class="count">${photos.length} photo${photos.length !== 1 ? 's' : ''}</p>
  </div>

  ${photos.length === 0 ? '<p class="empty">No photos in this gallery yet</p>' : `
  <div class="gallery">
    ${photos.map(photo => `
      <div class="photo-card">
        <div class="media-container" data-video="${photo.videoUrl}">
          <img src="${photo.photoUrl}" alt="Live Photo" loading="lazy">
          <video src="${photo.videoUrl}" muted loop playsinline></video>
          <span class="live-badge">LIVE</span>
        </div>
        <div class="photo-info">
          <div class="photo-date">${new Date(photo.uploadDate).toLocaleString()}</div>
          <div class="photo-size">Photo: ${formatSize(photo.photoSize)} • Video: ${formatSize(photo.videoSize)}</div>
          <div class="download-links">
            <a href="${photo.photoUrl}" download>Download Photo</a>
            <a href="${photo.videoUrl}" download>Download Video</a>
          </div>
        </div>
      </div>
    `).join('')}
  </div>
  `}

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const containers = document.querySelectorAll('.media-container');

      containers.forEach(container => {
        const video = container.querySelector('video');

        container.addEventListener('mouseenter', () => {
          container.classList.add('playing');
          video.play();
        });

        container.addEventListener('mouseleave', () => {
          container.classList.remove('playing');
          video.pause();
          video.currentTime = 0;
        });

        container.addEventListener('click', (e) => {
          if (e.target.tagName === 'A') return;

          if (container.classList.contains('playing')) {
            container.classList.remove('playing');
            video.pause();
            video.currentTime = 0;
          } else {
            containers.forEach(c => {
              if (c !== container) {
                c.classList.remove('playing');
                c.querySelector('video').pause();
                c.querySelector('video').currentTime = 0;
              }
            });
            container.classList.add('playing');
            video.play();
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export { router as galleryRouter };
