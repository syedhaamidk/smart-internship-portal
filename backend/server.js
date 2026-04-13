/**
 * Smart Internship Portal — Express Server
 * Entry point for the backend API
 */
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const fs          = require('fs');

const app = express();

// ─── Ensure uploads directory exists ─────────────────────────
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Rate Limiting ────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

// ─── Core Middleware ──────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ─── Request Logger (dev only) ────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/companies',     require('./routes/companies'));
app.use('/api/internships',   require('./routes/internships'));
app.use('/api/applications',  require('./routes/applications'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/ai',            require('./services/aiService'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Smart Internship Portal API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║    Smart Internship Portal API                ║
║    Server: http://localhost:${PORT}             ║
║    Env: ${(process.env.NODE_ENV || 'development').padEnd(34)} ║
╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
