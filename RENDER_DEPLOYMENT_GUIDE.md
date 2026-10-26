# KrishiSetu Backend - Render Deployment Guide

## Prerequisites

1. MongoDB Atlas account with a database
2. Render account (free tier available)
3. Git repository (already have this)

## Step 1: Prepare MongoDB Atlas

1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Go to **Network Access** → **IP Access List**
3. Click **Add IP Address**
4. Select **Allow Access from Anywhere** (0.0.0.0/0) - This is required for Render's dynamic IPs
5. Click **Confirm**
6. Go to **Database Access** → Create a database user if you don't have one
7. Click **Connect** → Choose **Drivers** → Node.js version 6.0 or later
8. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/databaseName`)
9. Replace `<password>` with your actual password
10. **Important**: Save this connection string for Step 3

## Step 2: Prepare Environment Variables

You'll need the following values:

### Required
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `CLIENT_URL` - Your Vercel frontend URL (e.g., https://krishisetu.vercel.app)
- `JWT_SECRET` - A random secret (Render can generate this)

### Optional (for specific features)
- `GNANI_API_KEY` - From vachana.ai for voice services
- `DATA_GOV_IN_API_KEY` - From data.gov.in for market prices
- `MAPTILER_API_KEY` - From maptiler.com for map tiles
- `GOOGLE_MAPS_API_KEY` - From Google Cloud for Places API
- `OPENROUTER_API_KEY` - From openrouter.ai for AI features

## Step 3: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Make sure `render.yaml` is in your repository root
2. Log in to [Render](https://render.com)
3. Click **New +** → **Blueprint**
4. Connect your GitHub repository
5. Select the repository
6. Render will detect `render.yaml` and show the service configuration
7. Click **Apply** to deploy

### Option B: Manual Setup

1. Log in to [Render](https://render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:

   **Name**: `krishisetu-backend`
   
   **Region**: Choose closest to MongoDB (Singapore for India)
   
   **Branch**: `main`
   
   **Root Directory**: Leave empty (uses repo root)
   
   **Runtime**: `Node`
   
   **Build Command**: `npm install`
   
   **Start Command**: `npx tsx src/server/index.ts`

7. **Environment Variables** (Add these one by one):

   Click **Advanced** → **Add Environment Variable**

   | Variable | Value | Required |
   |----------|-------|----------|
   | `NODE_ENV` | `production` | Yes |
   | `PORT` | `4000` | Yes |
   | `CLIENT_URL` | Your Vercel URL | Yes |
   | `MONGODB_URI` | Your MongoDB connection string | Yes |
   | `JWT_SECRET` | Generate random or set your own | Yes |
   | `GNANI_API_KEY` | Your Gnani key | No |
   | `DATA_GOV_IN_API_KEY` | Your data.gov.in key | No |
   | `MAPTILER_API_KEY` | Your MapTiler key | No |
   | `GOOGLE_MAPS_API_KEY` | Your Google key | No |
   | `OPENROUTER_API_KEY` | Your OpenRouter key | No |

8. Click **Create Web Service**

## Step 4: Troubleshooting Render Deployment

### Issue: Deployment stuck in "Build in progress"

**Cause**: Often due to missing dependencies or incorrect start command.

**Solutions**:

1. **Check Build Logs**:
   - Go to your service in Render
   - Click the **Logs** tab
   - Look for specific error messages

2. **Add tsx to dependencies**:
   The issue might be that `npx tsx` needs to be in dependencies. Update package.json:
   ```json
   "dependencies": {
     "tsx": "^4.23.15",
     ...
   }
   ```

3. **Use npm scripts instead**:
   If `npx tsx` fails, add this to package.json scripts:
   ```json
   "scripts": {
     "start:prod": "tsx src/server/index.ts"
   }
   ```
   Then use `npm run start:prod` as the start command.

### Issue: "Module not found" errors

**Solution**: Ensure all dependencies are installed by checking the build logs. Add any missing packages to package.json.

### Issue: MongoDB connection timeout

**Solution**: 
1. Verify MongoDB Atlas allows access from anywhere (0.0.0.0/0)
2. Check the connection string format
3. Verify username and password are correct

### Issue: Application crashes immediately

**Solution**:
1. Check the logs for the actual error
2. Ensure MONGODB_URI is set correctly
3. Ensure JWT_SECRET is at least 16 characters

## Step 5: Verify Deployment

Once deployment is complete:

1. **Get your backend URL**:
   - Go to your service in Render
   - Copy the URL (e.g., https://krishisetu-backend.onrender.com)

2. **Test health endpoint**:
   ```
   https://your-backend-url.onrender.com/api/v1/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "service": "KrishiSetu Express API",
     "version": "1.0.0",
     "database": {
       "connected": true,
       "name": "krishisetu",
       "state": "connected"
     }
   }
   ```

3. **Test integration status**:
   ```
   https://your-backend-url.onrender.com/api/v1/integrations/status
   ```

## Step 6: Update Vercel Frontend

1. Go to your Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://your-backend-url.onrender.com/api/v1`
4. Vercel will auto-redeploy

## Step 7: Update Backend CORS

1. Edit `src/server/index.ts`
2. Add your Vercel URL to allowed origins:
   ```typescript
   const allowedOrigins = [
     config.CLIENT_URL,
     "http://localhost:3000",
     "http://127.0.0.1:3000",
     "https://your-vercel-app.vercel.app", // Add this
   ];
   ```
3. Commit and push
4. Render will auto-redeploy

## Alternative: Use Docker (More Reliable)

If Render YAML or manual setup fails, use Docker:

### Create Dockerfile

Create `Dockerfile` in repository root:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Install tsx globally for production
RUN npm install -g tsx

# Expose port
EXPOSE 4000

# Start server
CMD ["tsx", "src/server/index.ts"]
```

### Update Render Start Command

- **Dockerfile Path**: `Dockerfile`
- **Context**: `.`
- **Docker Command**: Leave empty (uses CMD from Dockerfile)

## Quick Start Checklist

- [ ] MongoDB Atlas allows access from anywhere (0.0.0.0/0)
- [ ] MongoDB connection string copied
- [ ] Render account created
- [ ] render.yaml in repository (OR manual setup ready)
- [ ] MONGODB_URI added to Render environment variables
- [ ] CLIENT_URL added to Render environment variables
- [ ] JWT_SECRET added to Render environment variables
- [ ] Backend deployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] Database shows as connected
- [ ] Vercel NEXT_PUBLIC_API_URL updated
- [ ] Backend CORS updated with Vercel URL
- [ ] Frontend works with backend

## Support

If deployment still fails:

1. **Check Render Logs**: Always the first step - look for specific errors
2. **Check MongoDB Atlas Logs**: See if connection attempts are being made
3. **Verify Environment Variables**: Ensure no typos in variable names or values
4. **Test Locally**: Run `npm run start:server` locally to ensure code works
5. **Render Community**: https://community.render.com

## Common Render Errors and Solutions

### "Spawn build failed"
- Add `tsx` to dependencies in package.json
- Use full npm script instead of npx

### "Connection refused"
- MongoDB Atlas not allowing Render's IP
- Wrong MongoDB connection string

### "Cannot find module"
- Missing dependency in package.json
- Run `npm install` locally first to ensure everything works

### "Timeout during build"
- Build taking too long - consider using Docker
- Remove unnecessary dependencies

## Success Indicators

When deployment is successful, you'll see:

✅ Render dashboard shows "Live" status
✅ Health endpoint returns 200 OK with database connected
✅ Integration status endpoint works
✅ Vercel frontend can reach backend
✅ Market prices load in frontend
✅ Voice assistant can record and submit
