# PaseoLive Server

Backend server for PaseoLive Android app.

## Quick Deploy to Render.com (Easiest!)

1. **Create GitHub repo:**
   - Go to https://github.com
   - Create new repository (make it Public)
   - Name it: `paseolive-server`

2. **Upload this folder to GitHub:**
   - Use GitHub Desktop app (easiest!)
   - Or use git commands

3. **Deploy on Render:**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Render will auto-detect and deploy!

4. **Get your URL:**
   - Render gives you: `https://your-app.onrender.com`
   - Update `DEFAULT_PUBLIC_SERVER_URL` in Android app

## Files Needed

- ✅ `server.js` - Main server file
- ✅ `package.json` - Dependencies
- ✅ `service-account-key.json` - Firebase service account (add this yourself)

## Environment

- Node.js 14+ required
- Port: Automatically set by cloud platform (uses `process.env.PORT`)

## Endpoints

- `GET /health` - Health check
- `POST /register-walker` - Register walker FCM token
- `POST /register-owner` - Register owner FCM token
- `POST /notify-walkers` - Send notification to walkers
- `POST /notify-owners` - Send notification to owners
- `GET /tokens` - View registered tokens
- `POST /create-daily-room` - Create Daily.co room
- `POST /create-daily-token` - Create Daily.co token
