import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { getUploadDir, saveMetadata, LivePhotoMetadata } from '../utils/storage';

// Convert HEIC to JPEG
async function convertHeicToJpeg(heicPath: string): Promise<string> {
  const jpegPath = heicPath.replace(/\.heic$/i, '.jpg');
  await sharp(heicPath)
    .jpeg({ quality: 92 })
    .toFile(jpegPath);
  // Remove original HEIC file
  fs.unlinkSync(heicPath);
  return jpegPath;
}

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organize by date
    const date = new Date().toISOString().split('T')[0];
    const uploadPath = path.join(getUploadDir(), date);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Use asset ID from form if available, otherwise generate UUID
    const assetId = (req.body?.id as string)?.substring(0, 8) || uuidv4().substring(0, 8);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'photo' ? 'photo' : 'video';
    cb(null, `${assetId}_${prefix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '100000000') // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    const allowedMimes = [
      'image/heic',
      'image/heif',
      'image/jpeg',
      'image/png',
      'video/quicktime',
      'video/mp4'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// Upload endpoint - accepts multipart form with photo and video
router.post('/', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.photo || !files.video) {
      return res.status(400).json({
        error: 'Both photo and video files are required'
      });
    }

    let photoFile = files.photo[0];
    const videoFile = files.video[0];

    // Convert HEIC to JPEG for browser compatibility
    let finalPhotoFilename = photoFile.filename;
    let finalPhotoSize = photoFile.size;

    if (photoFile.filename.toLowerCase().endsWith('.heic')) {
      try {
        const jpegPath = await convertHeicToJpeg(photoFile.path);
        finalPhotoFilename = path.basename(jpegPath);
        finalPhotoSize = fs.statSync(jpegPath).size;
        console.log(`Converted HEIC to JPEG: ${finalPhotoFilename}`);
      } catch (err) {
        console.error('HEIC conversion failed, keeping original:', err);
      }
    }

    // Extract metadata from form data
    const metadata: LivePhotoMetadata = {
      id: req.body.id || uuidv4(),
      photoFile: finalPhotoFilename,
      videoFile: videoFile.filename,
      photoSize: finalPhotoSize,
      videoSize: videoFile.size,
      creationDate: req.body.creation_date || new Date().toISOString(),
      uploadDate: new Date().toISOString(),
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : undefined,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : undefined
    };

    // Save metadata JSON
    const date = new Date().toISOString().split('T')[0];
    const metadataPath = path.join(getUploadDir(), date, `${metadata.id.substring(0, 8)}_metadata.json`);
    await saveMetadata(metadataPath, metadata);

    console.log(`Received Live Photo: ${metadata.id}`);
    console.log(`  Photo: ${photoFile.filename} (${(photoFile.size / 1024).toFixed(1)} KB)`);
    console.log(`  Video: ${videoFile.filename} (${(videoFile.size / 1024).toFixed(1)} KB)`);

    res.status(201).json({
      success: true,
      id: metadata.id,
      files: {
        photo: `/files/${date}/${finalPhotoFilename}`,
        video: `/files/${date}/${videoFile.filename}`,
        metadata: `/files/${date}/${path.basename(metadataPath)}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as uploadRouter };
