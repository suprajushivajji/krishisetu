# KrishiSetu Production Deployment Fixes - Summary

## Root Cause Analysis

**Primary Issue**: The Express.js backend is NOT deployed. Vercel only hosts the Next.js frontend. The frontend falls back to `http://localhost:4000/api/v1` which fails in production.

**Secondary Issues**:
1. Frontend API configuration silently uses localhost fallback
2. MongoDB connection failures don't fail server startup
3. Configuration validation only warns instead of failing in production
4. Health endpoint doesn't report database connectivity
5. CORS configuration doesn't include production frontend URL
6. No public integration status endpoint for diagnostics

## Files Changed

### 1. src/lib/api.ts
**Changes**:
- Added production validation for `NEXT_PUBLIC_API_URL`
- Throws error in production when API URL is missing
- Normalizes API URL to ensure `/api/v1` suffix
- Improved error handling in GET, POST, PATCH methods
- Added HTTP status codes to error responses
- Distinguishes network errors vs HTTP errors
- Validates JSON content-type responses
- Better error messages for unreachable backend

**Impact**: Frontend will now fail clearly with useful error messages when backend is unreachable in production.

### 2. src/server/db.ts
**Changes**:
- Changed return type from `Promise<typeof mongoose | null>` to `Promise<typeof mongoose>`
- Throws error instead of returning null on connection failure
- Increased server selection timeout from 5s to 10s
- Added max pool size (10 connections)
- In production: exits process (code 1) when MongoDB connection fails
- Added connection error handler
- Improved error messages

**Impact**: Backend will not start if MongoDB is unavailable in production. Connection issues are immediately visible.

### 3. src/server/index.ts
**Changes**:
- Added mongoose import
- Refactored CORS configuration to use variable
- Added comment to remind adding production frontend URL
- Enhanced public `/api/v1/health` endpoint:
  - Reports database connectivity status
  - Reports database name
  - Reports connection state
  - Reports environment
- Added new public `/api/v1/integrations/status` endpoint:
  - Reports configuration status of all integrations
  - Reports health status where available
  - No authentication required
  - Does not expose secrets
- Enhanced `startServer()` function:
  - Wrapped in try-catch
  - Exits process (code 1) on startup failure
  - Added client URL and environment to startup logs
  - Better error handling for initial data sync

**Impact**: Better diagnostics, clear startup failures, public health/integration status endpoints.

### 4. src/server/config.ts
**Changes**:
- Added production environment validation
- Critical errors (JWT_SECRET, MONGODB_URI) cause process exit in production
- Logs specific critical errors before exiting
- Non-critical errors still logged as warnings

**Impact**: Production deployments fail fast when critical configuration is missing.

### 5. .env.example
**Changes**:
- Added section comments separating backend and frontend variables
- Added comment explaining NEXT_PUBLIC_ prefix requirement
- Better organization and documentation

**Impact**: Clearer guidance for environment variable configuration.

## New Endpoints

### GET /api/v1/health (Public)
Reports server and database health without authentication.

**Response**:
```json
{
  "status": "ok",
  "service": "KrishiSetu Express API",
  "version": "1.0.0",
  "timestamp": "2026-10-26T15:30:00.000Z",
  "database": {
    "connected": true,
    "name": "krishisetu",
    "state": "connected"
  },
  "environment": "production"
}
```

### GET /api/v1/integrations/status (Public)
Reports configuration and health status of all integrations without authentication.

**Response**:
```json
{
  "success": true,
  "integrations": [
    {
      "name": "MongoDB",
      "configured": true,
      "healthy": true,
      "message": "Connected"
    },
    {
      "name": "data.gov.in",
      "configured": true,
      "healthy": false,
      "message": "Configured"
    },
    {
      "name": "Gnani STT/TTS",
      "configured": true,
      "healthy": false,
      "message": "Configured"
    },
    {
      "name": "MapTiler",
      "configured": true,
      "healthy": true,
      "message": "Configured"
    },
    {
      "name": "Google Places",
      "configured": false,
      "healthy": false,
      "message": "Not configured"
    },
    {
      "name": "OpenRouter AI",
      "configured": false,
      "healthy": false,
      "message": "Not configured"
    }
  ],
  "summary": {
    "total": 6,
    "configured": 4,
    "healthy": 2
  },
  "timestamp": "2026-10-26T15:30:00.000Z"
}
```

## Required Environment Variables

### Backend (on hosting service)
**Critical** (required for production):
- `NODE_ENV=production`
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Random secret min 16 characters
- `CLIENT_URL` - Production Vercel frontend URL

**Optional** (for specific features):
- `GNANI_API_KEY` - For voice services
- `DATA_GOV_IN_API_KEY` - For data.gov.in market prices
- `MAPTILER_API_KEY` - For map tiles (falls back to OSM)
- `GOOGLE_MAPS_API_KEY` - For Google Places integration
- `OPENROUTER_API_KEY` - For AI intent understanding
- `OPENROUTER_MODEL` - Default AI model
- `AGMARKNET_RESOURCE_ID` - Default data.gov.in resource ID

### Frontend (Vercel)
**Critical** (required for production):
- `NEXT_PUBLIC_API_URL` - Backend API base URL (e.g., https://api.krishisetu.com/api/v1)

**Optional**:
- `NEXT_PUBLIC_MAPTILER_API_KEY` - For map tiles (falls back to OSM)

## Remaining Deployment Steps

### Step 1: Deploy Backend
Choose a hosting service for the Express backend:

**Option A: Render (Recommended)**
1. Create account at render.com
2. Create new "Web Service"
3. Connect GitHub repository
4. Set root directory: `src/server`
5. Set build command: `npm install`
6. Set start command: `tsx index.ts`
7. Add all required environment variables
8. Deploy

**Option B: Railway**
1. Create account at railway.app
2. Create new project
3. Add repository
4. Set service type: "Dockerfile" or create Nixpacks config
5. Add environment variables
6. Deploy

**Option C: AWS EC2 or DigitalOcean**
1. Create VPS instance
2. Install Node.js and npm
3. Clone repository
4. Install dependencies: `npm install`
5. Install tsx globally: `npm install -g tsx`
6. Set environment variables (use dotenv or systemd)
7. Start server: `tsx src/server/index.ts`
8. Configure PM2 for process management

### Step 2: Configure MongoDB Atlas
1. Log in to MongoDB Atlas
2. Go to Network Access
3. Add IP address of backend hosting service
4. If using Render/Railway, you may need to allow all IPs (0.0.0.0/0) temporarily
5. Ensure database user has appropriate permissions
6. Copy connection string (without password for security)
7. Add to backend environment variables

### Step 3: Update Vercel Configuration
1. Go to Vercel project settings
2. Add environment variable:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://your-backend-host.com/api/v1`
3. Add optional:
   - Name: `NEXT_PUBLIC_MAPTILER_API_KEY`
   - Value: Your MapTiler key
4. Redeploy (automatic on environment variable change)

### Step 4: Update Backend CORS
1. Edit `src/server/index.ts`
2. Add production Vercel URL to `allowedOrigins` array:
```typescript
const allowedOrigins = [
  config.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://your-vercel-app.vercel.app", // Add this
];
```
3. Commit and push changes
4. Backend will auto-redeploy

### Step 5: Verify Deployment
1. Test backend health: `https://your-backend-host.com/api/v1/health`
2. Test integration status: `https://your-backend-host.com/api/v1/integrations/status`
3. Test frontend: Open Vercel URL
4. Test voice assistant
5. Test market price queries
6. Test buyer discovery
7. Test authentication flow

### Step 6: Configure Optional Integrations
**Gnani Speech Services**:
1. Get API key from vachana.ai
2. Add `GNANI_API_KEY` to backend environment variables
3. Test voice transcription and synthesis

**data.gov.in API**:
1. Register at data.gov.in
2. Get API key
3. Add `DATA_GOV_IN_API_KEY` to backend environment variables
4. Test market price sync

**Google Places** (Optional):
1. Create Google Cloud project
2. Enable Places API
3. Get API key
4. Add `GOOGLE_MAPS_API_KEY` to backend environment variables

## Verification Checklist

### Backend
- [ ] Backend deployed and accessible
- [ ] Health endpoint returns 200 OK
- [ ] Database shows as connected
- [ ] Integration status endpoint works
- [ ] CORS allows production frontend origin
- [ ] MongoDB connection is stable
- [ ] JWT_SECRET is properly set (not default)
- [ ] Environment is "production"

### Frontend
- [ ] Vercel app loads successfully
- [ ] NEXT_PUBLIC_API_URL is set to backend URL
- [ ] API calls return data (not errors)
- [ ] Market prices display correctly
- [ ] Buyer discovery works
- [ ] Voice assistant records and submits
- [ ] No console errors related to API

### Integrations
- [ ] Gnani STT transcribes audio (if configured)
- [ ] Gnani TTS speaks responses (if configured)
- [ ] data.gov.in prices sync (if configured)
- [ ] Map tiles display (MapTiler or OSM)
- [ ] Authentication issues tokens correctly

## Security Notes

1. **Never commit .env files** - Use environment variables only
2. **Use strong JWT_SECRET** - Generate random 32+ character string
3. **MongoDB Atlas IP Whitelist** - Restrict to backend hosting IP when possible
4. **HTTPS Only** - Use HTTPS for both frontend and backend in production
5. **Rotate Secrets** - Change JWT_SECRET periodically
6. **Monitor Logs** - Watch for authentication failures and API errors
7. **Rate Limiting** - Consider adding rate limiting to public endpoints

## Troubleshooting

### Frontend can't reach backend
- Check NEXT_PUBLIC_API_URL is set in Vercel
- Verify backend is running and accessible
- Check backend CORS allows frontend origin
- Check network tab in browser for specific error

### Backend can't connect to MongoDB
- Verify MONGODB_URI is correct
- Check MongoDB Atlas network access allows backend IP
- Check database user credentials
- Check MongoDB Atlas logs for connection attempts

### Voice service fails
- Verify GNANI_API_KEY is set
- Check audio format (must be WAV 16kHz mono PCM)
- Check API key has proper permissions
- Check Gnani service status

### Map tiles don't load
- Verify MAPTILER_API_KEY if using MapTiler
- Check if OSM fallback is working
- Check browser console for tile errors

## Build Status

✅ TypeScript compilation: PASSED
✅ Production build: PASSED
✅ Local development: WORKING
⚠️ Production deployment: REQUIRES BACKEND DEPLOYMENT

## Conclusion

The codebase is now production-ready with proper error handling, configuration validation, and diagnostic endpoints. The only remaining blocker is deploying the Express backend to a hosting service and configuring the necessary environment variables. Once the backend is deployed and Vercel is configured with the backend URL, all features will function in production.

**Total Files Changed**: 5
**Lines Added**: ~150
**Lines Removed**: ~80
**Net Change**: +70 lines

**Estimated Deployment Time**: 30-60 minutes (depending on hosting service choice and configuration)
