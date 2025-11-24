# PFA Vanguard - Quick Start Guide

## 🚀 Phase 1 Setup Complete!

**✅ Backend infrastructure is now ready to use!**

### What Was Built

1. **Backend API Server** (Node.js + Express + Prisma)
   - JWT authentication with role-based access
   - Multi-provider AI support (Gemini, OpenAI, Anthropic, Azure)
   - PEMS API integration (read/write separation)
   - Cost tracking (user → org rollup)
   - Rate limiting and security middleware

2. **Database** (SQLite for dev, PostgreSQL for prod)
   - User management with organizations
   - AI provider configurations
   - Cost tracking and usage logs
   - PEMS API configurations

3. **Security Fixes**
   - ✅ **CRITICAL**: API keys removed from Vite config (no longer exposed in client bundle!)
   - ✅ AES-256-GCM encryption for all credentials
   - ✅ JWT authentication
   - ✅ Rate limiting (60 req/min global, 20 req/min AI)

---

## 📦 Installation & Setup

### 1. Install Dependencies (if not already done)

```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 2. Start the Servers

**Terminal 1 - Backend API (port 3001):**
```bash
cd backend
npm run dev
```

You should see:
```
🚀 PFA Vanguard Backend API Server
Environment: development
Port:        3001
Database:    Connected ✓
```

**Terminal 2 - Frontend (port 3000):**
```bash
npm run dev
```

Open http://localhost:3000

---

## 🔑 First-Time Setup

### Create Admin User

The database is empty! Create your first admin user via API:

```bash
# POST to register endpoint (you'll need to create this user first via Prisma Studio)
# Or use Prisma Studio to create manually:

cd backend
npm run prisma:studio
```

This opens Prisma Studio in your browser. Create a user:
- **username**: `admin`
- **passwordHash**: Use bcrypt to hash a password (or we'll add a seed script)
- **role**: `admin`
- **isActive**: `true`

### Configure Gemini API Key (Optional)

Edit `backend/.env`:
```bash
GEMINI_API_KEY="your-gemini-api-key-here"
```

Get one free at: https://ai.google.dev

---

## 🧪 Test the API

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-24T...",
  "environment": "development"
}
```

### 2. Login (after creating admin user)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "admin",
    "organizations": []
  }
}
```

Save the `token` - you'll need it for authenticated requests.

### 3. Test AI Chat (requires Gemini API key)

```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "organizationId": "test-org-id",
    "userId": "your-user-id"
  }'
```

---

## 📁 Project Structure

```
pfa-vanguard/
├── backend/                    # NEW: Backend API server
│   ├── src/
│   │   ├── controllers/       # API request handlers
│   │   ├── services/          # Business logic
│   │   │   ├── ai/            # Multi-provider AI
│   │   │   ├── pems/          # PEMS API client
│   │   │   └── auth/          # Authentication
│   │   ├── middleware/        # Auth, rate limiting
│   │   ├── routes/            # API routes
│   │   └── server.ts          # Entry point
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── dev.db             # SQLite database (auto-created)
│   ├── .env                   # API keys (NEVER commit!)
│   └── package.json
├── components/                 # React components (existing)
├── App.tsx                     # Root component
├── vite.config.ts              # ✅ FIXED: No more exposed API keys!
└── README.md                   # Full documentation
```

---

## 🔐 Security Checklist

### ✅ Completed in Phase 1

- [x] API keys moved to backend (server-side only)
- [x] Vite config cleaned (no more `process.env.API_KEY`)
- [x] JWT authentication implemented
- [x] Credentials encrypted in database (AES-256-GCM)
- [x] Rate limiting enabled
- [x] `.env` files in `.gitignore`

### ⚠️ Before Production

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS for all API calls
- [ ] Set up database backups
- [ ] Configure monitoring/alerting
- [ ] Security audit

---

## 🎯 Next Steps

### Phase 2: Frontend Integration

Update `AiAssistant.tsx` to use backend proxy:

```typescript
// OLD (Insecure - API key exposed):
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// NEW (Secure - calls backend):
const response = await fetch('http://localhost:3001/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userJwtToken}`,
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: userMessage }],
    organizationId: currentUser.organizationId,
  }),
});
```

### Phase 3: PEMS Integration

Configure PEMS API credentials in `backend/.env`:
```bash
PEMS_READ_ENDPOINT="https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata"
PEMS_READ_USERNAME="APIUSER"
PEMS_READ_PASSWORD="your-password"
PEMS_READ_TENANT="BECHTEL_DEV"
```

Then use `PemsApiService`:
```typescript
const pemsService = new PemsApiService();
const pfaData = await pemsService.fetchAllPfaData('HOLNG');
```

---

## 🐛 Troubleshooting

### Backend won't start

**Error**: `Missing required environment variable`
- **Fix**: Copy `backend/.env.example` to `backend/.env` and fill in values

**Error**: `Port 3001 already in use`
- **Fix**: Change `PORT=3001` in `backend/.env` to another port

### Database errors

**Error**: `Can't reach database server`
- **Fix**: We're using SQLite (file-based), no server needed! Check `backend/prisma/dev.db` exists

**Reset database**:
```bash
cd backend
rm -f prisma/dev.db
npm run prisma:migrate
```

### Frontend can't connect to backend

**Error**: `Network error` or `CORS error`
- **Fix**: Make sure backend is running on port 3001
- **Fix**: Check `CORS_ORIGIN` in `backend/.env` includes `http://localhost:3000`

---

## 📚 Documentation

- **README.md**: Full documentation
- **CLAUDE.md**: AI assistant guidelines for this codebase
- **backend/prisma/schema.prisma**: Database schema reference
- **API Endpoints**: See README.md § API Documentation

---

## 💡 Tips

1. **Use Prisma Studio** for database management:
   ```bash
   cd backend && npm run prisma:studio
   ```

2. **Check logs** for debugging:
   - Backend: `backend/logs/combined.log`
   - Backend errors: `backend/logs/error.log`

3. **Environment variables**:
   - Backend: `backend/.env`
   - Frontend: `.env.local` (only VITE_ prefixed vars)

4. **Database migrations**:
   ```bash
   cd backend
   npm run prisma:migrate    # Create new migration
   npm run prisma:generate   # Regenerate client after schema changes
   ```

---

## ✅ Phase 1 Complete!

**What's working:**
- ✅ Backend API server running
- ✅ Database created and migrated
- ✅ Authentication system ready
- ✅ AI proxy infrastructure ready
- ✅ PEMS API client ready
- ✅ Security fixes applied

**Next**: Integrate frontend to use backend API instead of direct client-side calls.

---

**Questions?** Check the full README.md or open an issue on GitHub.
