import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getUploadDir, LivePhotoMetadata, GalleryInfo } from '../utils/storage';

const router = Router();

// Get all galleries
router.get('/galleries', async (req: Request, res: Response) => {
  try {
    const uploadDir = getUploadDir();
    const galleries: GalleryInfo[] = [];

    if (!fs.existsSync(uploadDir)) {
      return res.json({ galleries: [], count: 0 });
    }

    // Read all gallery directories (excluding .temp)
    const galleryDirs = fs.readdirSync(uploadDir).filter(dir => {
      if (dir === '.temp') return false;
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const galleryDir of galleryDirs) {
      const dirPath = path.join(uploadDir, galleryDir);
      const files = fs.readdirSync(dirPath);
      const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

      let galleryName = galleryDir;
      let lastUpdated = new Date(0).toISOString();

      // Get gallery name from first metadata file
      if (metadataFiles.length > 0) {
        const firstMetadata = path.join(dirPath, metadataFiles[0]);
        const content = fs.readFileSync(firstMetadata, 'utf-8');
        const metadata = JSON.parse(content) as LivePhotoMetadata;
        galleryName = metadata.galleryName || galleryDir;

        // Find latest upload date
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

    // Sort by last updated, newest first
    galleries.sort((a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    res.json({
      galleries,
      count: galleries.length
    });
  } catch (error) {
    console.error('Error listing galleries:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all photos (optionally filtered by gallery)
// When filtering by gallery, requires view password via ?p= query param
router.get('/', async (req: Request, res: Response) => {
  try {
    const uploadDir = getUploadDir();
    const galleryId = req.query.gallery as string | undefined;
    const providedPassword = req.query.p as string | undefined;
    const photos: LivePhotoMetadata[] = [];

    if (!fs.existsSync(uploadDir)) {
      return res.json({ photos: [], count: 0 });
    }

    // Read gallery directories (or just one if filtered, excluding .temp)
    let galleryDirs = fs.readdirSync(uploadDir).filter(dir => {
      if (dir === '.temp') return false;
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    if (galleryId) {
      galleryDirs = galleryDirs.filter(dir => dir === galleryId);

      // Check view password for specific gallery
      if (galleryDirs.length > 0) {
        const dirPath = path.join(uploadDir, galleryDirs[0]);
        const files = fs.readdirSync(dirPath);
        const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

        if (metadataFiles.length > 0) {
          const firstMetadata = path.join(dirPath, metadataFiles[0]);
          const content = fs.readFileSync(firstMetadata, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.galleryViewPassword) {
            if (!providedPassword) {
              return res.status(401).json({ error: 'Password required', needsPassword: true });
            }
            if (providedPassword.toUpperCase() !== metadata.galleryViewPassword.toUpperCase()) {
              return res.status(403).json({ error: 'Invalid password' });
            }
          }
        }
      }
    }

    // Collect all metadata files
    for (const galleryDir of galleryDirs) {
      const dirPath = path.join(uploadDir, galleryDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          // Add file URLs
          photos.push({
            ...metadata,
            photoUrl: `/files/${galleryDir}/${metadata.photoFile}`,
            videoUrl: `/files/${galleryDir}/${metadata.videoFile}`
          });
        }
      }
    }

    // Sort by upload date, newest first
    photos.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );

    res.json({
      photos,
      count: photos.length
    });
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single photo by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const uploadDir = getUploadDir();

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Search through gallery directories (excluding .temp)
    const galleryDirs = fs.readdirSync(uploadDir).filter(dir => {
      if (dir === '.temp') return false;
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const galleryDir of galleryDirs) {
      const dirPath = path.join(uploadDir, galleryDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.id === id || metadata.id.startsWith(id)) {
            return res.json({
              ...metadata,
              photoUrl: `/files/${galleryDir}/${metadata.photoFile}`,
              videoUrl: `/files/${galleryDir}/${metadata.videoFile}`
            });
          }
        }
      }
    }

    res.status(404).json({ error: 'Photo not found' });
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete photo by ID (requires gallery password)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const uploadDir = getUploadDir();

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const galleryDirs = fs.readdirSync(uploadDir).filter(dir => {
      if (dir === '.temp') return false;
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const galleryDir of galleryDirs) {
      const dirPath = path.join(uploadDir, galleryDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.id === id || metadata.id.startsWith(id)) {
            // Verify password
            if (!metadata.galleryDeletePassword) {
              return res.status(403).json({ error: 'Photo does not have a delete password configured' });
            }

            if (password.toUpperCase() !== metadata.galleryDeletePassword.toUpperCase()) {
              return res.status(403).json({ error: 'Invalid password' });
            }

            // Delete all related files
            const photoPath = path.join(dirPath, metadata.photoFile);
            const videoPath = path.join(dirPath, metadata.videoFile);

            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            fs.unlinkSync(metadataPath);

            console.log(`Deleted photo: ${metadata.id} from gallery ${metadata.galleryName}`);

            return res.json({ success: true, deleted: metadata.id });
          }
        }
      }
    }

    res.status(404).json({ error: 'Photo not found' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as photosRouter };
