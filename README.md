# LivePhoto Server

A Node.js/Express server for receiving and storing Live Photo uploads from the LivePhoto4all iOS app.

## Features

- Receives Live Photo uploads (photo + video pairs)
- Organizes files by date
- Stores metadata as JSON
- REST API for listing, retrieving, and deleting photos
- Serves uploaded files statically

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Environment variables:
- `PORT` - Server port (default: 3000)
- `UPLOAD_DIR` - Directory for uploaded files (default: ./uploads)
- `MAX_FILE_SIZE` - Maximum file size in bytes (default: 100MB)

## Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## API Endpoints

### Upload Live Photo
```
POST /api/upload
Content-Type: multipart/form-data

Fields:
- photo: Image file (HEIC, JPEG, PNG)
- video: Video file (MOV, MP4)
- id: (optional) Asset ID
- creation_date: (optional) Original creation date
- latitude: (optional) GPS latitude
- longitude: (optional) GPS longitude
```

### List All Photos
```
GET /api/photos

Response:
{
  "photos": [...],
  "count": 10
}
```

### Get Single Photo
```
GET /api/photos/:id

Response:
{
  "id": "abc123",
  "photoFile": "abc123_photo.HEIC",
  "videoFile": "abc123_video.MOV",
  "photoUrl": "/files/2024-01-15/abc123_photo.HEIC",
  "videoUrl": "/files/2024-01-15/abc123_video.MOV",
  ...
}
```

### Delete Photo
```
DELETE /api/photos/:id

Response:
{
  "success": true,
  "deleted": "abc123..."
}
```

### Health Check
```
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Access Files
```
GET /files/:date/:filename
```

## File Structure

Uploaded files are organized by date:
```
uploads/
├── 2024-01-15/
│   ├── abc123_photo.HEIC
│   ├── abc123_video.MOV
│   └── abc123_metadata.json
└── 2024-01-16/
    └── ...
```

## License

MIT
