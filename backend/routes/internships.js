/**
 * Internship Routes
 * GET    /api/internships          — list all (with filters + external API)
 * POST   /api/internships          — create (company only)
 * GET    /api/internships/:id      — get single internship
 * PUT    /api/internships/:id      — update (company only)
 * DELETE /api/internships/:id      — delete (company only)
 * POST   /api/internships/:id/save — toggle save/unsave
 * GET    /api/internships/saved    — get saved jobs
 * GET    /api/internships/recommended — AI-recommended internships
 * GET    /api/internships/skills   — list all skills (for filters)
 */
const router        = require('express').Router();
const db            = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const jobApiService = require('../services/jobApiService');

// ─── GET /skills ──────────────────────────────────────────────
router.get('/skills', async (req, res) => {
  try {
    const [skills] = await db.query('SELECT * FROM skills ORDER BY category, name');
    res.json({ success: true, data: skills });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch skills' });
  }
});

// ─── GET /saved ───────────────────────────────────────────────
router.get('/saved', authenticate, authorize('student'), async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const [rows] = await db.query(`
      SELECT i.*, c.company_name, c.logo_url,
             sj.saved_at,
             1 AS is_saved
      FROM saved_jobs sj
      JOIN internships i ON sj.internship_id = i.id
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE sj.student_id = ?
      ORDER BY sj.saved_at DESC
    `, [students[0].id]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch saved jobs' });
  }
});

// ─── GET /recommended ─────────────────────────────────────────
router.get('/recommended', authenticate, authorize('student'), async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const studentId = students[0].id;

    // Use the internship_skill_match VIEW — recommends by skill overlap
    const [rows] = await db.query(`
      SELECT
        i.*,
        c.company_name,
        c.logo_url,
        m.matched_skills,
        (SELECT COUNT(*) FROM internship_skills is2 WHERE is2.internship_id = i.id) AS total_skills_required
      FROM internship_skill_match m
      JOIN internships i ON m.internship_id = i.id
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE m.student_id = ?
        AND i.status = 'active'
        AND (i.deadline IS NULL OR i.deadline >= CURDATE())
      ORDER BY m.matched_skills DESC, i.stipend_max DESC
      LIMIT 10
    `, [studentId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
});

// ─── GET / — List all internships with filters ────────────────
router.get('/', async (req, res) => {
  const {
    search, location, minStipend, maxStipend, type,
    skill, remote, page = 1, limit = 12
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  let whereClause = 'WHERE i.status = "active" AND (i.deadline IS NULL OR i.deadline >= CURDATE())';

  if (search) {
    whereClause += ' AND (i.title LIKE ? OR i.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (location) {
    whereClause += ' AND i.location LIKE ?';
    params.push(`%${location}%`);
  }
  if (minStipend) {
    whereClause += ' AND i.stipend_max >= ?';
    params.push(parseInt(minStipend));
  }
  if (maxStipend) {
    whereClause += ' AND i.stipend_min <= ?';
    params.push(parseInt(maxStipend));
  }
  if (type && ['portal', 'external'].includes(type)) {
    whereClause += ' AND i.type = ?';
    params.push(type);
  }
  if (remote === 'true') {
    whereClause += ' AND i.is_remote = 1';
  }
  if (skill) {
    whereClause += ' AND i.id IN (SELECT internship_id FROM internship_skills is2 JOIN skills sk ON is2.skill_id = sk.id WHERE sk.name LIKE ?)';
    params.push(`%${skill}%`);
  }

  try {
    // DB internships
    const [rows] = await db.query(`
      SELECT
        i.*,
        c.company_name,
        c.logo_url,
        c.city AS company_city,
        GROUP_CONCAT(sk.name SEPARATOR ', ') AS skills_required
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN internship_skills is2 ON i.id = is2.internship_id
      LEFT JOIN skills sk ON is2.skill_id = sk.id
      ${whereClause}
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await db.query(`
      SELECT COUNT(DISTINCT i.id) AS total
      FROM internships i
      LEFT JOIN internship_skills is2 ON i.id = is2.internship_id
      LEFT JOIN skills sk ON is2.skill_id = sk.id
      ${whereClause}
    `, params);

    // External API internships (only on first page with no heavy filters)
    let externalJobs = [];
    if (parseInt(page) === 1 && type !== 'portal') {
      externalJobs = await jobApiService.fetchJobs(search || 'internship', location);
    }

    res.json({
      success: true,
      data: {
        portalJobs: rows,
        externalJobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('List internships error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch internships' });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        i.*,
        c.company_name, c.logo_url, c.website, c.description AS company_description,
        c.city AS company_city, c.industry,
        GROUP_CONCAT(JSON_OBJECT('id', sk.id, 'name', sk.name)) AS skills_json
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN internship_skills is2 ON i.id = is2.internship_id
      LEFT JOIN skills sk ON is2.skill_id = sk.id
      WHERE i.id = ?
      GROUP BY i.id
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Internship not found' });

    const internship = rows[0];
    if (internship.skills_json) {
      try { internship.skills = JSON.parse(`[${internship.skills_json}]`).filter(s => s.id); }
      catch { internship.skills = []; }
      delete internship.skills_json;
    }

    // Check if student has applied / saved
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'student') {
          const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [decoded.id]);
          if (students.length) {
            const studentId = students[0].id;
            const [[app]] = await db.query(
              'SELECT status FROM applications WHERE student_id = ? AND internship_id = ?',
              [studentId, internship.id]
            );
            const [[saved]] = await db.query(
              'SELECT id FROM saved_jobs WHERE student_id = ? AND internship_id = ?',
              [studentId, internship.id]
            );
            internship.applicationStatus = app?.status || null;
            internship.isSaved = !!saved;
          }
        }
      } catch {}
    }

    res.json({ success: true, data: internship });
  } catch (err) {
    console.error('Get internship error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch internship' });
  }
});

// ─── POST / — Create internship (company only) ────────────────
router.post('/', authenticate, authorize('company'), async (req, res) => {
  const {
    title, description, location, isRemote, stipendMin, stipendMax,
    durationMonths, deadline, openings, skills
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'Title and description are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [companies] = await conn.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const [result] = await conn.query(`
      INSERT INTO internships
        (company_id, title, description, location, is_remote,
         stipend_min, stipend_max, duration_months, deadline, openings, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'portal', 'active')
    `, [companies[0].id, title, description, location || null, isRemote ? 1 : 0,
        stipendMin || 0, stipendMax || 0, durationMonths || 3, deadline || null, openings || 1]);

    const internshipId = result.insertId;

    // Add required skills
    if (Array.isArray(skills) && skills.length > 0) {
      const skillValues = skills.map(skillId => [internshipId, skillId]);
      await conn.query('INSERT IGNORE INTO internship_skills (internship_id, skill_id) VALUES ?', [skillValues]);
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'Internship posted successfully', id: internshipId });
  } catch (err) {
    await conn.rollback();
    console.error('Create internship error:', err);
    res.status(500).json({ success: false, message: 'Failed to create internship' });
  } finally {
    conn.release();
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('company'), async (req, res) => {
  const { title, description, location, isRemote, stipendMin, stipendMax,
          durationMonths, deadline, openings, status, skills } = req.body;

  try {
    const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });

    const [intern] = await db.query(
      'SELECT id FROM internships WHERE id = ? AND company_id = ?',
      [req.params.id, companies[0].id]
    );
    if (!intern.length) return res.status(403).json({ success: false, message: 'Not authorized' });

    await db.query(`
      UPDATE internships SET
        title          = COALESCE(?, title),
        description    = COALESCE(?, description),
        location       = COALESCE(?, location),
        is_remote      = COALESCE(?, is_remote),
        stipend_min    = COALESCE(?, stipend_min),
        stipend_max    = COALESCE(?, stipend_max),
        duration_months = COALESCE(?, duration_months),
        deadline       = COALESCE(?, deadline),
        openings       = COALESCE(?, openings),
        status         = COALESCE(?, status)
      WHERE id = ?
    `, [title, description, location, isRemote != null ? (isRemote ? 1 : 0) : null,
        stipendMin, stipendMax, durationMonths, deadline, openings, status, req.params.id]);

    if (Array.isArray(skills)) {
      await db.query('DELETE FROM internship_skills WHERE internship_id = ?', [req.params.id]);
      if (skills.length) {
        const skillValues = skills.map(id => [req.params.id, id]);
        await db.query('INSERT IGNORE INTO internship_skills (internship_id, skill_id) VALUES ?', [skillValues]);
      }
    }

    res.json({ success: true, message: 'Internship updated successfully' });
  } catch (err) {
    console.error('Update internship error:', err);
    res.status(500).json({ success: false, message: 'Failed to update internship' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('company', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'company') {
      const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
      if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });
      const [intern] = await db.query(
        'SELECT id FROM internships WHERE id = ? AND company_id = ?',
        [req.params.id, companies[0].id]
      );
      if (!intern.length) return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM internships WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Internship deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete internship' });
  }
});

// ─── POST /:id/save ── toggle save/unsave ─────────────────────
router.post('/:id/save', authenticate, authorize('student'), async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const studentId = students[0].id;

    const [[existing]] = await db.query(
      'SELECT id FROM saved_jobs WHERE student_id = ? AND internship_id = ?',
      [studentId, req.params.id]
    );

    if (existing) {
      await db.query('DELETE FROM saved_jobs WHERE student_id = ? AND internship_id = ?', [studentId, req.params.id]);
      res.json({ success: true, saved: false, message: 'Job unsaved' });
    } else {
      await db.query('INSERT INTO saved_jobs (student_id, internship_id) VALUES (?, ?)', [studentId, req.params.id]);
      res.json({ success: true, saved: true, message: 'Job saved' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle save' });
  }
});

module.exports = router;
