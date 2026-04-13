/**
 * Admin Routes
 * GET  /api/admin/dashboard     — platform-wide analytics
 * GET  /api/admin/users         — all users
 * PUT  /api/admin/users/:id     — activate/deactivate user
 * GET  /api/admin/internships   — all internships (approve/reject)
 * PUT  /api/admin/internships/:id/approve
 * PUT  /api/admin/internships/:id/reject
 * DELETE /api/admin/internships/:id
 */
const router = require('express').Router();
const db     = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

// ─── GET /dashboard ───────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    // Platform stats — multiple aggregate queries
    const [[users]]        = await db.query('SELECT COUNT(*) AS total, SUM(role="student") AS students, SUM(role="company") AS companies FROM users');
    const [[internships]]  = await db.query('SELECT COUNT(*) AS total, SUM(status="active") AS active, SUM(status="closed") AS closed FROM internships');
    const [[applications]] = await db.query('SELECT COUNT(*) AS total, AVG(s.cgpa) AS avg_cgpa FROM applications a JOIN students s ON a.student_id = s.id');

    // Top companies by applications
    const [topCompanies] = await db.query(`
      SELECT
        c.company_name, c.industry,
        COUNT(a.id) AS total_applications,
        COUNT(DISTINCT i.id) AS total_internships
      FROM companies c
      LEFT JOIN internships i ON c.id = i.company_id
      LEFT JOIN applications a ON i.id = a.internship_id
      GROUP BY c.id
      ORDER BY total_applications DESC
      LIMIT 5
    `);

    // Applications trend (last 7 days)
    const [trend] = await db.query(`
      SELECT
        DATE(applied_at) AS date,
        COUNT(*) AS applications
      FROM applications
      WHERE applied_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(applied_at)
      ORDER BY date ASC
    `);

    // Top skills in demand
    const [topSkills] = await db.query(`
      SELECT sk.name, COUNT(*) AS demand_count
      FROM internship_skills is2
      JOIN skills sk ON is2.skill_id = sk.id
      JOIN internships i ON is2.internship_id = i.id
      WHERE i.status = 'active'
      GROUP BY sk.id
      ORDER BY demand_count DESC
      LIMIT 8
    `);

    res.json({
      success: true,
      data: {
        users: { total: users.total, students: users.students, companies: users.companies },
        internships: { total: internships.total, active: internships.active, closed: internships.closed },
        applications: { total: applications.total, avgCgpa: parseFloat(applications.avg_cgpa || 0).toFixed(2) },
        topCompanies,
        applicationTrend: trend,
        topSkillsInDemand: topSkills
      }
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
});

// ─── GET /users ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = '';
    const params = [];
    if (role) { where = 'WHERE role = ?'; params.push(role); }

    const [rows] = await db.query(
      `SELECT id, email, role, is_active, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${where}`, params);

    res.json({ success: true, data: rows, pagination: { page: parseInt(page), total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// ─── PUT /users/:id — Toggle active status ────────────────────
router.put('/users/:id', async (req, res) => {
  const { isActive } = req.body;
  try {
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    res.json({ success: true, message: `User ${isActive ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// ─── GET /internships ─────────────────────────────────────────
router.get('/internships', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let where = '';
    const params = [];
    if (status) { where = 'WHERE i.status = ?'; params.push(status); }

    const [rows] = await db.query(`
      SELECT i.*, c.company_name,
        COUNT(a.id) AS application_count
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN applications a ON i.id = a.internship_id
      ${where}
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch internships' });
  }
});

// ─── PUT /internships/:id/approve ────────────────────────────
router.put('/internships/:id/approve', async (req, res) => {
  try {
    await db.query('UPDATE internships SET status = "active" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Internship approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
});

// ─── PUT /internships/:id/reject ─────────────────────────────
router.put('/internships/:id/reject', async (req, res) => {
  try {
    await db.query('UPDATE internships SET status = "closed" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Internship rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject' });
  }
});

// ─── DELETE /internships/:id ──────────────────────────────────
router.delete('/internships/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM internships WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Internship deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
});

module.exports = router;
