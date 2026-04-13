/**
 * Authentication Routes
 * POST /api/auth/signup  — register student or company
 * POST /api/auth/login   — login any role
 * GET  /api/auth/me      — get current user profile
 */
const router    = require('express').Router();
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db        = require('../config/db');
const { authenticate } = require('../middleware/auth');

const SALT_ROUNDS = 10;

// ─── Validation Rules ────────────────────────────────────────
const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
  body('role').isIn(['student', 'company']).withMessage('Role must be student or company'),
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('companyName').optional().trim().notEmpty(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// ─── POST /signup ─────────────────────────────────────────────
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password, role, firstName, lastName, companyName } = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Check duplicate email
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const [userResult] = await conn.query(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, role]
    );
    const userId = userResult.insertId;

    // Create role-specific profile
    if (role === 'student') {
      await conn.query(
        'INSERT INTO students (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [userId, firstName || '', lastName || '']
      );
    } else if (role === 'company') {
      await conn.query(
        'INSERT INTO companies (user_id, company_name) VALUES (?, ?)',
        [userId, companyName || '']
      );
    }

    await conn.commit();

    // Generate JWT
    const token = generateToken({ id: userId, email, role });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: { id: userId, email, role }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    conn.release();
  }
});

// ─── POST /login ──────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT id, email, password, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Fetch profile data
    let profile = null;
    if (user.role === 'student') {
      const [rows] = await db.query('SELECT * FROM students WHERE user_id = ?', [user.id]);
      profile = rows[0] || null;
    } else if (user.role === 'company') {
      const [rows] = await db.query('SELECT * FROM companies WHERE user_id = ?', [user.id]);
      profile = rows[0] || null;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role },
      profile
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ─── GET /me ──────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    let profile = null;

    if (user.role === 'student') {
      const [rows] = await db.query(`
        SELECT s.*,
          GROUP_CONCAT(JSON_OBJECT('id', sk.id, 'name', sk.name, 'level', ss.level)) AS skills_json
        FROM students s
        LEFT JOIN student_skills ss ON s.id = ss.student_id
        LEFT JOIN skills sk ON ss.skill_id = sk.id
        WHERE s.user_id = ?
        GROUP BY s.id
      `, [user.id]);
      profile = rows[0] || null;
      if (profile && profile.skills_json) {
        try {
          profile.skills = JSON.parse(`[${profile.skills_json}]`).filter(s => s.id);
        } catch { profile.skills = []; }
        delete profile.skills_json;
      }
    } else if (user.role === 'company') {
      const [rows] = await db.query('SELECT * FROM companies WHERE user_id = ?', [user.id]);
      profile = rows[0] || null;
    }

    res.json({ success: true, user, profile });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ─── Helper ───────────────────────────────────────────────────
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = router;
