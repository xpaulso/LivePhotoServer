import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getUploadDir, LivePhotoMetadata } from '../utils/storage';

const router = Router();

// Get all photos
router.get('/', async (req: Request, res: Response) => {
  try {
    const uploadDir = getUploadDir();
    const photos: LivePhotoMetadata[] = [];

    if (!fs.existsSync(uploadDir)) {
      return res.json({ photos: [], count: 0 });
    }

    // Read all date directories
    const dateDirs = fs.readdirSync(uploadDir).filter(dir => {
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    // Collect all metadata files
    for (const dateDir of dateDirs) {
      const dirPath = path.join(uploadDir, dateDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          // Add file URLs
          photos.push({
            ...metadata,
            photoUrl: `/files/${dateDir}/${metadata.photoFile}`,
            videoUrl: `/files/${dateDir}/${metadata.videoFile}`
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

    // Search through date directories
    const dateDirs = fs.readdirSync(uploadDir).filter(dir => {
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const dateDir of dateDirs) {
      const dirPath = path.join(uploadDir, dateDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.id === id || metadata.id.startsWith(id)) {
            return res.json({
              ...metadata,
              photoUrl: `/files/${dateDir}/${metadata.photoFile}`,
              videoUrl: `/files/${dateDir}/${metadata.videoFile}`
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

// Delete photo by ID
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const uploadDir = getUploadDir();

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const dateDirs = fs.readdirSync(uploadDir).filter(dir => {
      const fullPath = path.join(uploadDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const dateDir of dateDirs) {
      const dirPath = path.join(uploadDir, dateDir);
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('_metadata.json')) {
          const metadataPath = path.join(dirPath, file);
          const content = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as LivePhotoMetadata;

          if (metadata.id === id || metadata.id.startsWith(id)) {
            // Delete all related files
            const photoPath = path.join(dirPath, metadata.photoFile);
            const videoPath = path.join(dirPath, metadata.videoFile);

            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            fs.unlinkSync(metadataPath);

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
