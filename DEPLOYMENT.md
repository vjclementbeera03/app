# Deployment Guide - Thu.Go.Zi Local Food Hub

This guide covers deploying the application to:
- **Backend**: Render
- **Frontend**: Vercel
- **Database**: MongoDB Atlas

---

## Prerequisites

1. **MongoDB Atlas Account** - [Create account](https://www.mongodb.com/cloud/atlas)
2. **Render Account** - [Create account](https://render.com)
3. **Vercel Account** - [Create account](https://vercel.com)
4. **Firebase Project** - [Firebase Console](https://console.firebase.google.com)
5. **Google Cloud Project** (for Vision API) - [Google Cloud Console](https://console.cloud.google.com)

---

## Step 1: MongoDB Atlas Setup

1. Create a new cluster (free tier available)
2. Create a database user with read/write access
3. Whitelist IP addresses:
   - Add `0.0.0.0/0` for Render (or specific IPs)
4. Get your connection string:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/food_hub_db?retryWrites=true&w=majority
   ```

---

## Step 2: Firebase Setup

### Firebase Project Configuration
1. Go to Firebase Console → Create/Select Project
2. Enable **Phone Authentication**:
   - Authentication → Sign-in method → Phone → Enable
3. Add your domains:
   - Authentication → Settings → Authorized domains
   - Add your Vercel deployment domain

### Get Firebase Web Config (for Frontend)
1. Project Settings → General → Your apps
2. Add web app if not exists
3. Copy the config values:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`

### Get Firebase Admin SDK (for Backend)
1. Project Settings → Service accounts
2. Click "Generate new private key"
3. Save as `firebase-admin.json` in your backend folder

---

## Step 3: Google Vision API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Cloud Vision API**
4. Create credentials:
   - APIs & Services → Credentials → Create Credentials → API Key
5. (Optional) Restrict the key to only Cloud Vision API

---

## Step 4: Deploy Backend to Render

### Create Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. New → Web Service
3. Connect your GitHub repository
4. Configure:
   - **Name**: `thu-go-zi-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Add Environment Variables
In Render dashboard, add these environment variables:

| Key | Value |
|-----|-------|
| `MONGO_URL` | Your MongoDB Atlas connection string |
| `DB_NAME` | `food_hub_db` |
| `JWT_SECRET` | A secure random string (32+ chars) |
| `GOOGLE_VISION_API_KEY` | Your Vision API key |
| `FIREBASE_ADMIN_SDK_PATH` | `./firebase-admin.json` |

### Upload Firebase Admin SDK
**Option A**: Include in repo (not recommended for public repos)
- Add `firebase-admin.json` to backend folder

**Option B**: Use Secret File
1. Render → Your Service → Environment → Secret Files
2. Add content of `firebase-admin.json`
3. Mount path: `/etc/secrets/firebase-admin.json`
4. Update env var: `FIREBASE_ADMIN_SDK_PATH=/etc/secrets/firebase-admin.json`

### Deploy
1. Click "Create Web Service"
2. Wait for build to complete
3. Note your backend URL: `https://your-app.onrender.com`

---

## Step 5: Deploy Frontend to Vercel

### Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Add New → Project
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build` (default)
   - **Output Directory**: `build`

### Add Environment Variables
In Vercel dashboard → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | Your Render backend URL (e.g., `https://your-app.onrender.com`) |
| `REACT_APP_FIREBASE_API_KEY` | Your Firebase API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `REACT_APP_FIREBASE_APP_ID` | Your Firebase app ID |

### Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Note your frontend URL: `https://your-app.vercel.app`

---

## Step 6: Post-Deployment Configuration

### Update Firebase Authorized Domains
1. Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain: `your-app.vercel.app`

### Seed Initial Data
Run the seed script to populate initial menu items:
```bash
# Locally with your production MONGO_URL
MONGO_URL="your-atlas-connection-string" python backend/seed_data.py
```

### Test the Deployment
1. Visit your frontend URL
2. Test user registration with phone OTP
3. Test admin login (default: `admin` / `admin@123`)
4. **Important**: Change admin password immediately after first login

---

## Environment Variables Summary

### Backend (Render)
```
MONGO_URL=mongodb+srv://...
DB_NAME=food_hub_db
JWT_SECRET=your-secure-secret
GOOGLE_VISION_API_KEY=your-key
FIREBASE_ADMIN_SDK_PATH=./firebase-admin.json
```

### Frontend (Vercel)
```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_APP_ID=...
```

---

## Troubleshooting

### Backend Issues
- **500 errors**: Check Render logs for stack traces
- **MongoDB connection failed**: Verify IP whitelist and connection string
- **Firebase auth errors**: Ensure `firebase-admin.json` is accessible

### Frontend Issues
- **API calls failing**: Verify `REACT_APP_BACKEND_URL` is correct
- **CORS errors**: Backend already configured to allow all origins
- **Firebase OTP not working**: Check authorized domains in Firebase

### Common Fixes
1. **Rebuild**: Trigger manual deploy in Render/Vercel
2. **Check logs**: Render → Logs, Vercel → Functions logs
3. **Clear cache**: Vercel → Deployments → Redeploy with cache cleared

---

## Custom Domain Setup

### Vercel (Frontend)
1. Vercel → Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Render (Backend)
1. Render → Service → Settings → Custom Domains
2. Add your API subdomain (e.g., `api.yourdomain.com`)
3. Update DNS records as instructed

### Update Environment Variables
After custom domain setup:
1. Update `REACT_APP_BACKEND_URL` in Vercel to your custom API domain
2. Add custom domain to Firebase authorized domains

---

## Security Checklist

- [ ] Change default admin password after first login
- [ ] Use strong JWT_SECRET (32+ random characters)
- [ ] Restrict Google Vision API key to specific APIs
- [ ] Enable MongoDB Atlas authentication
- [ ] Configure proper IP whitelisting for MongoDB
- [ ] Keep Firebase Admin SDK private (never commit to public repos)
