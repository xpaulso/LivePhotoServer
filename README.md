# LivePhoto Server

A Node.js/Express server for receiving and storing Live Photo uploads from the LivePhoto4all iOS app.

## Features

- Receives Live Photo uploads (photo + video pairs)
- **Gallery organization** with custom names
- **Password-protected galleries** for easy sharing
- Automatic HEIC to JPEG conversion for browser compatibility
- Web gallery interface with mobile-friendly video playback
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

## Web Interface

### Gallery List
```
GET /gallery
```
Browse all galleries with photo counts and last updated dates.

### Single Gallery
```
GET /gallery/:galleryId?p=PASSWORD
```
View photos in a gallery. If the gallery has a view password, include it as the `p` query parameter for access.

**Features:**
- Desktop: Hover over photos to play Live Photo videos
- Mobile: Videos autoplay when scrolled into view, tap to play/pause
- Download links for individual photos and videos

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
- gallery_id: (optional) Gallery UUID
- gallery_name: (optional) Gallery display name
- gallery_delete_password: (optional) Password for deleting gallery
- gallery_view_password: (optional) Password for viewing gallery
```

### List All Galleries
```
GET /api/photos/galleries

Response:
{
  "galleries": [
    {
      "id": "uuid",
      "name": "My Gallery",
      "photoCount": 5,
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

### List Photos
```
GET /api/photos
GET /api/photos?gallery=GALLERY_ID

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
  "photoFile": "abc123_photo.jpg",
  "videoFile": "abc123_video.mov",
  "photoUrl": "/files/gallery-id/abc123_photo.jpg",
  "videoUrl": "/files/gallery-id/abc123_video.mov",
  ...
}
```

### Delete Photo
```
DELETE /api/photos/:id
Content-Type: application/json

Body:
{
  "password": "DELETE_PASSWORD"
}

Response:
{
  "success": true,
  "deleted": "abc123..."
}
```

### Delete Gallery
```
DELETE /api/gallery/:galleryId
Content-Type: application/json

Body:
{
  "password": "DELETE_PASSWORD"
}

Response:
{
  "success": true,
  "deleted": "gallery-uuid"
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
GET /files/:galleryId/:filename
```

## File Structure

Uploaded files are organized by gallery:
```
uploads/
├── gallery-uuid-1/
│   ├── abc123_photo.jpg
│   ├── abc123_video.mov
│   └── abc123_metadata.json
└── gallery-uuid-2/
    └── ...
```

## Sharing Galleries

Each gallery can have a view password for easy sharing:

1. Upload photos to a gallery with a view password
2. Share the URL: `http://your-server/gallery/GALLERY-ID?p=PASSWORD`
3. Recipients can view photos without needing the delete password

## License

MIT
