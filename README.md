# YouTube → iOS Ringtone Maker

A small Next.js (React + Tailwind) app that generates an **iOS ringtone (.m4r)** from a YouTube video.

It runs `yt-dlp` to download audio and `ffmpeg` to trim + fade + transcode.

## Features
- YouTube URL input (validated and sanitized)
- Start time input (seconds, `mm:ss`, or `hh:mm:ss`)
- Duration slider (1–30 seconds)
- Returns a downloadable `ringtone.m4r`

## Security notes (important)
- The server never executes a shell with user-controlled input.
- We extract and validate a YouTube **video id** (`^[A-Za-z0-9_-]{11}$`) and only use a canonical URL.
- The backend uses `spawn()` with explicit argument arrays (`shell: false`).

## Local development
### Prereqs
You need `ffmpeg` and `yt-dlp` installed locally for the API route to work.

```bash
npm install
npm run dev
```

App will run on: http://localhost:9878

## Docker
```bash
docker build -t youtube-ringtone-maker .
docker run --rm -p 9878:9878 youtube-ringtone-maker
```

Open: http://localhost:9878

## API
`POST /api/ringtone`

JSON body:
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "startSeconds": 40,
  "durationSeconds": 30
}
```

Response: `audio/mp4` attachment `ringtone.m4r`
