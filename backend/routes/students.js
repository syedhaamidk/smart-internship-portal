/**
 * Student Routes
 * GET/PUT  /api/students/profile          — view/update own profile
 * PUT      /api/students/skills           — update skills
 * POST     /api/students/resume           — upload resume
 * GET      /api/students/dashboard        — analytics dashboard
 * GET      /api/students/notifications    — notification list
 * PUT      /api/students/notifications/:id/read
 */
const router   = require('express').Router();
const multer   = require('multer');
const path     = require('path');
const db       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// ─── File Upload Config ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `resume_${req.user.id}_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF/DOC/DOCX files allowed'));
  }
});

// All student routes require authentication + student role
router.use(authenticate, authorize('student'));

// ─── GET /profile ─────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*,
        u.email,
        JSON_ARRAYAGG(
          IF(sk.id IS NOT NULL,
            JSON_OBJECT('id', sk.id, 'name', sk.name, 'category', sk.category, 'level', ss.level),
            NULL)
        ) AS skills
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN student_skills ss ON s.id = ss.student_id
      LEFT JOIN skills sk ON ss.skill_id = sk.id
      WHERE s.user_id = ?
      GROUP BY s.id
    `, [req.user.id]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Profile not found' });

    const profile = rows[0];
    // Clean null values from skills array
    if (Array.isArray(profile.skills)) {
      profile.skills = profile.skills.filter(s => s !== null && s.id);
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ─── PUT /profile ─────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  const {
    firstName, lastName, phone, college, degree,
    branch, graduationYear, cgpa, bio, linkedinUrl, githubUrl
  } = req.body;

  try {
    await db.query(`
      UPDATE students SET
        first_name = COALESCE(?, first_name),
        last_name  = COALESCE(?, last_name),
        phone      = COALESCE(?, phone),
        college    = COALESCE(?, college),
        degree     = COALESCE(?, degree),
        branch     = COALESCE(?, branch),
        graduation_year = COALESCE(?, graduation_year),
        cgpa       = COALESCE(?, cgpa),
        bio        = COALESCE(?, bio),
        linkedin_url = COALESCE(?, linkedin_url),
        github_url = COALESCE(?, github_url)
      WHERE user_id = ?
    `, [firstName, lastName, phone, college, degree, branch,
        graduationYear, cgpa, bio, linkedinUrl, githubUrl, req.user.id]);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ─── POST /resume ─────────────────────────────────────────────
router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const resumeUrl = `/uploads/${req.file.filename}`;
  try {
    await db.query('UPDATE students SET resume_url = ? WHERE user_id = ?', [resumeUrl, req.user.id]);
    res.json({ success: true, resumeUrl, message: 'Resume uploaded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save resume' });
  }
});

// ─── PUT /skills ──────────────────────────────────────────────
router.put('/skills', async (req, res) => {
  const { skills } = req.body; // [{ skillId, level }]
  if (!Array.isArray(skills)) {
    return res.status(400).json({ success: false, message: 'skills must be an array' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get student id
    const [students] = await conn.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (students.length === 0) throw new Error('Student not found');
    const studentId = students[0].id;

    // Clear old skills
    await conn.query('DELETE FROM student_skills WHERE student_id = ?', [studentId]);

    // Insert new skills
    if (skills.length > 0) {
      const values = skills.map(s => [studentId, s.skillId, s.level || 'beginner']);
      await conn.query(
        'INSERT INTO student_skills (student_id, skill_id, level) VALUES ?',
        [values]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Skills updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Update skills error:', err);
    res.status(500).json({ success: false, message: 'Failed to update skills' });
  } finally {
    conn.release();
  }
});

// ─── GET /dashboard ───────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (students.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    const studentId = students[0].id;

    // Applications by status — aggregate query
    const [appStats] = await db.query(`
      SELECT
        status,
        COUNT(*) AS count
      FROM applications
      WHERE student_id = ?
      GROUP BY status
    `, [studentId]);

    // Recent applications
    const [recentApps] = await db.query(`
      SELECT
        a.id, a.status, a.applied_at,
        i.title, i.location, i.stipend_min, i.stipend_max,
        c.company_name
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE a.student_id = ?
      ORDER BY a.applied_at DESC
      LIMIT 5
    `, [studentId]);

    // Saved jobs count
    const [[savedCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM saved_jobs WHERE student_id = ?',
      [studentId]
    );

    // Total applications count
    const [[totalApps]] = await db.query(
      'SELECT COUNT(*) AS count FROM applications WHERE student_id = ?',
      [studentId]
    );

    // Unread notifications
    const [[unreadCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        totalApplications:  totalApps.count,
        savedJobs:          savedCount.count,
        unreadNotifications: unreadCount.count,
        applicationsByStatus: appStats,
        recentApplications:  recentApps
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// ─── GET /notifications ───────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// ─── PUT /notifications/:id/read ─────────────────────────────
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
});

module.exports = router;
