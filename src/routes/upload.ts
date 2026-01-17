import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getUploadDir, saveMetadata, LivePhotoMetadata } from '../utils/storage';

// Dynamic import for heic-convert (ESM module)
let heicConvert: any = null;
async function getHeicConvert() {
  if (!heicConvert) {
    heicConvert = (await import('heic-convert')).default;
  }
  return heicConvert;
}

// Convert HEIC to JPEG
async function convertHeicToJpeg(heicPath: string): Promise<string> {
  const convert = await getHeicConvert();
  const inputBuffer = fs.readFileSync(heicPath);
  const outputBuffer = await convert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.92
  });
  const jpegPath = heicPath.replace(/\.heic$/i, '.jpg');
  fs.writeFileSync(jpegPath, outputBuffer);
  // Remove original HEIC file
  fs.unlinkSync(heicPath);
  return jpegPath;
}

const router = Router();

// Temp directory for initial uploads (files moved to gallery folder after parsing)
const tempUploadDir = path.join(getUploadDir(), '.temp');

// Configure multer to upload to temp directory first
// (req.body isn't fully parsed when destination callback runs)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(tempUploadDir)) {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    }
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique temp filename
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'photo' ? 'photo' : 'video';
    cb(null, `${uuidv4()}_${prefix}${ext}`);
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

    const photoFile = files.photo[0];
    const videoFile = files.video[0];

    // Now req.body is fully parsed, get gallery info
    const galleryId = req.body.gallery_id || 'default';
    const galleryName = req.body.gallery_name || 'Default Gallery';
    const assetId = (req.body.id as string)?.substring(0, 8) || uuidv4().substring(0, 8);

    console.log(`Processing upload for gallery: ${galleryId} (${galleryName})`);

    // Create gallery directory
    const galleryPath = path.join(getUploadDir(), galleryId);
    if (!fs.existsSync(galleryPath)) {
      fs.mkdirSync(galleryPath, { recursive: true });
    }

    // Move photo from temp to gallery folder with proper name
    const photoExt = path.extname(photoFile.originalname);
    let finalPhotoFilename = `${assetId}_photo${photoExt}`;
    let finalPhotoPath = path.join(galleryPath, finalPhotoFilename);
    fs.renameSync(photoFile.path, finalPhotoPath);
    let finalPhotoSize = fs.statSync(finalPhotoPath).size;

    // Convert HEIC to JPEG for browser compatibility
    if (finalPhotoFilename.toLowerCase().endsWith('.heic')) {
      try {
        const jpegPath = await convertHeicToJpeg(finalPhotoPath);
        finalPhotoFilename = path.basename(jpegPath);
        finalPhotoPath = jpegPath;
        finalPhotoSize = fs.statSync(jpegPath).size;
        console.log(`Converted HEIC to JPEG: ${finalPhotoFilename}`);
      } catch (err) {
        console.error('HEIC conversion failed, keeping original:', err);
      }
    }

    // Move video from temp to gallery folder with proper name
    const videoExt = path.extname(videoFile.originalname);
    const finalVideoFilename = `${assetId}_video${videoExt}`;
    const finalVideoPath = path.join(galleryPath, finalVideoFilename);
    fs.renameSync(videoFile.path, finalVideoPath);

    // Extract metadata from form data
    const metadata: LivePhotoMetadata = {
      id: req.body.id || uuidv4(),
      photoFile: finalPhotoFilename,
      videoFile: finalVideoFilename,
      photoSize: finalPhotoSize,
      videoSize: videoFile.size,
      creationDate: req.body.creation_date || new Date().toISOString(),
      uploadDate: new Date().toISOString(),
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : undefined,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : undefined,
      galleryId: galleryId,
      galleryName: galleryName
    };

    // Save metadata JSON
    const metadataPath = path.join(galleryPath, `${assetId}_metadata.json`);
    await saveMetadata(metadataPath, metadata);

    console.log(`Received Live Photo: ${metadata.id} -> Gallery: ${galleryName} (${galleryId})`);
    console.log(`  Photo: ${finalPhotoFilename} (${(finalPhotoSize / 1024).toFixed(1)} KB)`);
    console.log(`  Video: ${finalVideoFilename} (${(videoFile.size / 1024).toFixed(1)} KB)`);

    res.status(201).json({
      success: true,
      id: metadata.id,
      galleryId: galleryId,
      files: {
        photo: `/files/${galleryId}/${finalPhotoFilename}`,
        video: `/files/${galleryId}/${finalVideoFilename}`,
        metadata: `/files/${galleryId}/${path.basename(metadataPath)}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as uploadRouter };
