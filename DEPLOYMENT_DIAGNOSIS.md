# KrishiSetu Production Deployment Diagnosis

## Executive Summary

**Root Cause**: The Express.js backend is NOT deployed. Vercel only hosts the Next.js frontend. The frontend is configured to fallback to `http://localhost:4000/api/v1` for API calls, which only works in local development. In production, this causes all API calls, MongoDB queries, voice services, and integrations to fail.

## Architecture Audit

### Current Deployment
- **Frontend**: Next.js 16.4.3 deployed on Vercel ✅
- **Backend**: Express.js 5.3.0 NOT deployed ❌
- **Database**: MongoDB Atlas (configured but inaccessible due to missing backend)
- **API Base URL**: Falls back to `http://localhost:4000/api/v1` in production ❌

### File Analysis

#### Frontend API Client (`src/lib/api.ts`)
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
```
**Issue**: Falls back to localhost when `NEXT_PUBLIC_API_URL` is not set. This will always fail in production.

#### Backend Entry Point (`src/server/index.ts`)
```typescript
export async function startServer() {
  await connectDB();
  const server = app.listen(config.PORT, () => {
    console.log(`🚀 [KrishiSetu Server] Listening at http://localhost:${config.PORT}`);
  });
  return server;
}
```
**Issue**: This backend is not deployed anywhere. It only runs locally with `npm run dev:server` or `npm run start:server`.

#### CORS Configuration (`src/server/index.ts`)
```typescript
app.use(cors({
  origin: [config.CLIENT_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));
```
**Issue**: Only allows localhost origins. When backend is deployed to a separate hosting service, the production Vercel URL must be added.

#### MongoDB Connection (`src/server/db.ts`)
```typescript
export async function connectDB(): Promise<typeof mongoose | null> {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ [MongoDB] Connected to database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error("❌ [MongoDB] Connection error:", (error as Error).message);
    return null; // ⚠️ Returns null instead of failing startup
  }
}
```
**Issue**: Returns null on connection failure instead of terminating the process. The backend appears healthy even when MongoDB is disconnected.

#### Configuration (`src/server/config.ts`)
```typescript
const envSchema = z.object({
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long"),
  // ... other fields
});

if (!parsed.success) {
  console.warn("⚠️ [Config Warning] Environment validation issues:\n" + missingKeys);
}
```
**Issue**: Invalid configuration only logs a warning instead of failing the startup.

#### Health Endpoint (`src/server/index.ts`)
```typescript
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "KrishiSetu Express API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});
```
**Issue**: Health check doesn't verify database connectivity or report configuration status.

#### Admin Health Endpoint (`src/server/routes/admin.ts`)
```typescript
adminRouter.get("/health", authenticate, authorizeRoles("admin"), ...);
```
**Issue**: Requires authentication and admin role. Not publicly accessible for diagnostics.

## Integration Audit

### 1. MongoDB Atlas
- **Required Variable**: `MONGODB_URI`
- **Status**: Likely configured but inaccessible due to missing backend
- **Implementation**: Mongoose with 5s timeout
- **Issue**: Connection failure doesn't fail server startup
- **Production Requirement**: Backend must be deployed with valid MongoDB connection string

### 2. data.gov.in Market-Price API
- **Required Variable**: `DATA_GOV_IN_API_KEY`
- **Implementation**: Adapter with retry logic (3 retries, 2s delay)
- **Endpoint**: `https://api.data.gov.in/resource/{RESOURCE_ID}`
- **Status**: Requires API key
- **Production Limitation**: Requires backend deployment

### 3. AGMARKNET/e-NAM
- **Required Variable**: None (CSV import from local file)
- **Implementation**: CSV adapter for downloaded exports
- **Status**: Works locally with CSV files
- **Production Limitation**: Requires backend deployment for CSV imports

### 4. Gnani Speech Services
- **Required Variable**: `GNANI_API_KEY`
- **STT Endpoint**: `POST https://api.vachana.ai/stt/v3`
- **TTS Endpoint**: `POST https://api.vachana.ai/api/v1/tts/inference`
- **Implementation**: Form-data for STT, JSON for TTS
- **Status**: Requires API key and backend deployment
- **Issue**: STT 400 errors indicate audio format or configuration issues

### 5. OpenRouter AI
- **Required Variable**: `OPENROUTER_API_KEY`
- **Implementation**: Optional LLM for intent understanding
- **Status**: Optional, not critical for basic functionality
- **Production Limitation**: Requires backend deployment

### 6. MapTiler / OpenStreetMap
- **Required Variable**: `MAPTILER_API_KEY` (optional, falls back to OSM)
- **Implementation**: Leaflet map tiles
- **Status**: Works in frontend with MapTiler key or OSM fallback
- **Production**: Frontend-only, no backend required

### 7. Google Places
- **Required Variable**: `GOOGLE_MAPS_API_KEY`
- **Implementation**: Optional business discovery adapter
- **Status**: Not implemented or optional
- **Production Limitation**: Requires backend deployment if enabled

### 8. Authentication
- **Required Variable**: `JWT_SECRET` (min 16 characters)
- **Implementation**: JWT tokens in cookies
- **Status**: Requires backend deployment
- **Issue**: Fallback secret used in development mode is insecure for production

## Required Changes

### 1. Backend Deployment
**Option A**: Deploy Express backend to a hosting service (Render, Railway, AWS, etc.)
**Option B**: Convert to serverless functions on Vercel (requires significant refactoring)
**Option C**: Use Vercel's edge functions or platform-specific deployment

**Recommended**: Deploy backend separately (Option A) as it's the least invasive change.

### 2. Frontend API Configuration
- Remove localhost fallback
- Fail clearly when `NEXT_PUBLIC_API_URL` is missing in production
- Add build-time validation
- Improve error handling in UI

### 3. MongoDB Connection
- Fail server startup when MongoDB connection fails
- Add reconnection logic
- Verify connection in health endpoint

### 4. CORS Configuration
- Add production Vercel URL to allowed origins
- Consider using environment-based origin configuration

### 5. Health & Diagnostics
- Add public health endpoint without authentication
- Report database connectivity status
- Report configuration status without exposing secrets
- Add integration status endpoint

### 6. Environment Variables
- Ensure all required variables are set in production
- Add validation at startup
- Document all required variables

## Recommended Deployment Architecture

```
┌─────────────────────────────────────────┐
│           Vercel (Frontend)              │
│  - Next.js 16.4.3                        │
│  - Static files, React components        │
│  - API: NEXT_PUBLIC_API_URL → Backend   │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ↓
┌─────────────────────────────────────────┐
│   Backend Hosting (Render/Railway/AWS)   │
│  - Express.js 5.3.0                      │
│  - MongoDB Atlas connection              │
│  - All API routes (/api/v1/*)           │
│  - Gnani, data.gov.in integrations       │
└──────────────┬──────────────────────────┘
               │ MongoDB URI
               ↓
┌─────────────────────────────────────────┐
│         MongoDB Atlas                    │
│  - Market prices, users, businesses      │
│  - Geospatial indexes                    │
└─────────────────────────────────────────┘
```

## Required Environment Variables

### Backend (on hosting service)
```bash
NODE_ENV=production
PORT=4000
CLIENT_URL=https://your-vercel-app.vercel.app
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/krishisetu
JWT_SECRET=<random-32-char-secret>
GNANI_API_KEY=<gnani-api-key>
DATA_GOV_IN_API_KEY=<data-gov-in-key>
MAPTILER_API_KEY=<maptiler-key>
GOOGLE_MAPS_API_KEY=<optional>
OPENROUTER_API_KEY=<optional>
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://your-backend-host.com/api/v1
NEXT_PUBLIC_MAPTILER_API_KEY=<maptiler-key>
```

## Next Steps

1. **Choose Backend Hosting**: Select Render, Railway, or AWS for Express backend
2. **Configure MongoDB**: Ensure MongoDB Atlas allows access from backend hosting IP
3. **Deploy Backend**: Deploy Express server with all environment variables
4. **Update Vercel**: Set `NEXT_PUBLIC_API_URL` to deployed backend URL
5. **Update CORS**: Add Vercel frontend URL to backend CORS origins
6. **Deploy Frontend**: Vercel will auto-deploy on push
7. **Test**: Verify all API calls work in production

## Conclusion

The immediate blocker is the missing backend deployment. Once the Express backend is deployed to a hosting service with proper environment variables and CORS configuration, all MongoDB-backed features, voice services, and integrations will function in production.
