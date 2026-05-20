# ⚡ NexusCollab – Real-time Collaboration Platform

A full-stack, role-based real-time collaboration platform built with React, Node.js, Socket.IO, and native WebRTC APIs.

---

## 🏗 Architecture

```
collab-platform/
├── backend/                   # Node.js + Express + Socket.IO
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── sockets/
│   ├── models/
│   ├── config/                # DB connection + admin seed
│   └── server.js
│
└── frontend/                  # React 18 + Zustand
    └── src/
        ├── components/
        ├── pages/
        ├── hooks/
        ├── store/
        └── services/
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend
```bash
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET
npm install
npm run dev
```
Runs on **http://localhost:5000**

### 2. Frontend
```bash
cd frontend
npm install
npm start
```
Runs on **http://localhost:3000**

### Default Admin Account
On first start, if no admin exists, one is auto-created:
- **Email:** admin@nexuscollab.com
- **Password:** Admin@123

Change these in `backend/.env` before deploying.

---

## ☁️ Deployment

### Architecture
| Service | Platform | Why |
|---|---|---|
| Frontend (React) | **Vercel** | Free, fast CDN, auto-deploy from Git |
| Backend (Node/Socket.IO) | **Render.com** | Free tier, supports WebSockets + persistent server |
| Database | **MongoDB Atlas** | Free 512MB cluster |

> ⚠️ **Vercel cannot host the backend** — it's serverless with 10s timeout. Socket.IO needs persistent connections.

---

## 📋 Step-by-Step Deployment

### Step 1 — MongoDB Atlas (Database)

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) → Sign up free
2. Create a new **Free Cluster** (M0 Sandbox)
3. Under **Database Access** → Add a database user (username + password)
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all — needed for Render)
5. Click **Connect** → **Connect your application** → Copy the connection string
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/collab_platform?retryWrites=true&w=majority
   ```
6. Save this — you'll need it for Render

---

### Step 2 — Push to GitHub

```bash
# From the collab-platform root
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nexuscollab.git
git push -u origin main
```

---

### Step 3 — Deploy Backend on Render.com

1. Go to [https://render.com](https://render.com) → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repo → select it
4. Configure:
   - **Name:** `nexuscollab-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `MONGODB_URI` | *(your Atlas connection string)* |
   | `JWT_SECRET` | *(any long random string)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | *(your Vercel URL — add after Step 4)* |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_EMAIL` | `admin@nexuscollab.com` |
   | `ADMIN_PASSWORD` | *(your chosen password)* |

6. Click **Create Web Service** → wait for deploy (~2 min)
7. Copy your backend URL: `https://nexuscollab-backend.onrender.com`

---

### Step 4 — Deploy Frontend on Vercel

1. Go to [https://vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → Import your GitHub repo
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `REACT_APP_API_URL` | `https://nexuscollab-backend.onrender.com/api` |
   | `REACT_APP_SOCKET_URL` | `https://nexuscollab-backend.onrender.com` |

5. Click **Deploy** → wait (~1 min)
6. Copy your frontend URL: `https://nexuscollab.vercel.app`

---

### Step 5 — Update CORS on Render

1. Go back to Render → your backend service → **Environment**
2. Update `CLIENT_URL` to your Vercel URL:
   ```
   https://nexuscollab.vercel.app
   ```
3. Render will auto-redeploy

---

### Step 6 — Test

1. Open your Vercel URL
2. Log in with the default admin credentials
3. Create rooms, add users, test video calls ✅

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port | No (default 5000) |
| `MONGODB_URI` | MongoDB connection string | **Yes** |
| `JWT_SECRET` | JWT signing secret | **Yes** |
| `JWT_EXPIRES_IN` | Token expiry | No (default 7d) |
| `CLIENT_URL` | Frontend URL for CORS | **Yes** |
| `NODE_ENV` | Environment | No |
| `ADMIN_USERNAME` | Default admin username | No (default: admin) |
| `ADMIN_EMAIL` | Default admin email | No |
| `ADMIN_PASSWORD` | Default admin password | No (default: Admin@123) |

### Frontend (Vercel Environment Variables)

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Backend API base URL |
| `REACT_APP_SOCKET_URL` | Backend Socket.IO URL |

---

## 👥 Roles & Permissions

| Feature | User | Moderator | Admin |
|---|:---:|:---:|:---:|
| Join assigned rooms | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ |
| Video/audio call | ✅ | ✅ | ✅ |
| Screen share (if allowed) | ✅ | ✅ | ✅ |
| Create rooms | ❌ | ✅ | ✅ |
| Delete rooms | ❌ | ✅ | ✅ |
| Mute users | ❌ | ✅ | ✅ |
| Kick users | ❌ | ✅ | ✅ |
| Lock rooms | ❌ | ✅ | ✅ |
| Control screen sharing | ❌ | ✅ | ✅ |
| Manage participants | ❌ | ✅ | ✅ |
| Admin dashboard | ❌ | ❌ | ✅ |
| User management | ❌ | ❌ | ✅ |
| Change user roles | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |

---

## 🔌 REST API

### Auth
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |

### Rooms
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/rooms` | Authenticated |
| GET | `/api/rooms/:id` | Authenticated |
| POST | `/api/rooms` | Admin/Moderator |
| PATCH | `/api/rooms/:id` | Admin/Moderator |
| DELETE | `/api/rooms/:id` | Admin/Moderator |
| POST | `/api/rooms/:id/participants` | Admin/Mod/Owner |
| DELETE | `/api/rooms/:id/participants/:userId` | Admin/Mod/Owner |

### Users
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/users` | Admin/Moderator |
| GET | `/api/users/active` | Authenticated |
| POST | `/api/users` | Admin |
| PATCH | `/api/users/profile` | Authenticated |
| PATCH | `/api/users/:id/role` | Admin |
| PATCH | `/api/users/:id/activate` | Admin |
| DELETE | `/api/users/:id/deactivate` | Admin |
| DELETE | `/api/users/:id` | Admin |

### Admin
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/admin/dashboard` | Admin |
| POST | `/api/admin/sync-rooms` | Admin |

---

## 📡 Socket Events

### Client → Server
| Event | Payload |
|---|---|
| `join-room` | `{ roomId }` |
| `leave-room` | `{ roomId }` |
| `message` | `{ roomId, content }` |
| `typing` | `{ roomId, isTyping }` |
| `offer` | `{ targetSocketId, offer, roomId }` |
| `answer` | `{ targetSocketId, answer }` |
| `ice-candidate` | `{ targetSocketId, candidate }` |
| `call-start` | `{ roomId }` |
| `call-join` | `{ roomId }` |
| `call-leave` | `{ roomId }` |
| `screen-share-start` | `{ roomId }` |
| `screen-share-stop` | `{ roomId }` |
| `mute-user` | `{ targetUserId, roomId }` |
| `kick-user` | `{ targetUserId, roomId }` |
| `toggle-room-lock` | `{ roomId, isLocked }` |
| `toggle-screen-sharing` | `{ roomId, enabled }` |

---

## 🔒 Security

- **Helmet.js** — HTTP security headers
- **Rate limiting** — 200 req/15min globally, 30 req/15min for auth
- **CORS** — Locked to frontend origin only
- **JWT** — All routes and socket connections validated
- **bcrypt** — Password hashing, 12 rounds
- **Input sanitization** — HTML stripped from all user inputs
- **Role middleware** — Every sensitive endpoint checks role

---

## 🎥 WebRTC Flow

```
User A joins call → emits call-join
  ↓
Server broadcasts peer-joined-call to room
  ↓
User B creates RTCPeerConnection → sends offer
  ↓
User A receives offer → sends answer
  ↓
Both exchange ICE candidates
  ↓
P2P connection established ✅
```

STUN: `stun:stun.l.google.com:19302`

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Zustand, CSS Modules |
| Backend | Node.js 18, Express.js |
| Realtime | Socket.IO 4 |
| Video | Native WebRTC (RTCPeerConnection, getUserMedia, getDisplayMedia) |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Security | Helmet, express-rate-limit, express-validator |
| Deployment | Vercel (frontend) + Render (backend) + MongoDB Atlas |
