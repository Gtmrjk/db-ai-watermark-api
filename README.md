# DB A.I. Watermark API

This project wraps the browser-only DB A.I. Watermark Compositor in a small HTTP API. The API accepts an image plus a language, drives the compositor UI in headless Chromium, captures the browser download, and returns the final JPG.

## API

`POST /watermark`

Multipart form fields:

- `image`: image file
- `language`: `English`, `Hindi`, `Marathi`, or `Gujarati`

Example:

```bash
curl -X POST "$API_URL/watermark" \
  -F "image=@input.png" \
  -F "language=English" \
  --output watermarked.jpg
```

Health check:

```bash
curl "$API_URL/health"
```

## Local Setup

```bash
npm install
npx playwright install chromium
export TOOL_URL="https://melody-pride-56150670.figma.site/"
npm start
```

The server runs on `http://localhost:3000` by default.

## Step 1: Explore The UI Flow

Use the exploration script to inspect the live compositor UI and confirm selectors:

```bash
export TOOL_URL="https://melody-pride-56150670.figma.site/"
npm run explore
```

The expected flow is:

1. Upload an image through the Cover control.
2. Select a language: English, Hindi, Marathi, or Gujarati.
3. Wait for the Download JPG button.
4. Intercept the browser download and return the JPG.

## GitHub

```bash
git init
git add .
git commit -m "Build DB AI watermark API"
git branch -M main
git remote add origin https://github.com/Gtmrjk/db-ai-watermark-api.git
git push -u origin main
```

## Render

This project includes a `Dockerfile` and `render.yaml`, so Render can deploy it as a Docker web service.

Required environment variable:

- `TOOL_URL`: `https://melody-pride-56150670.figma.site/`

Deploy options:

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the GitHub repo.
3. Choose Docker deployment.
4. Set `TOOL_URL`.
5. Deploy.
