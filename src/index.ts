import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from 'dotenv';
import { uploadRouter } from './routes/upload';
import { photosRouter } from './routes/photos';
import { galleryRouter } from './routes/gallery';
import { ensureUploadDir } from './utils/storage';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure upload directory exists
ensureUploadDir();

// Serve uploaded files statically
app.use('/files', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads')));

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/photos', photosRouter);
app.use('/api/gallery', galleryRouter);  // API endpoints
app.use('/gallery', galleryRouter);       // HTML pages

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'LivePhoto Server',
    version: '1.2.1',
    endpoints: {
      upload: 'POST /api/upload',
      photos: 'GET /api/photos',
      photo: 'GET /api/photos/:id',
      health: 'GET /health',
      files: 'GET /files/:date/:filename'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`LivePhoto Server running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${process.env.UPLOAD_DIR || './uploads'}`);
});
