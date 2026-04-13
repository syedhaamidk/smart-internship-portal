/**
 * Company Routes
 * GET/PUT /api/companies/profile      — view/update company profile
 * GET     /api/companies/dashboard    — analytics dashboard
 * GET     /api/companies/internships  — own internship listings
 */
const router = require('express').Router();
const db     = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('company'));

// ─── GET /profile ─────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT c.*, u.email FROM companies c JOIN users u ON c.user_id = u.id WHERE c.user_id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ─── PUT /profile ─────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  const { companyName, industry, website, description, city, state, country } = req.body;
  try {
    await db.query(`
      UPDATE companies SET
        company_name = COALESCE(?, company_name),
        industry     = COALESCE(?, industry),
        website      = COALESCE(?, website),
        description  = COALESCE(?, description),
        city         = COALESCE(?, city),
        state        = COALESCE(?, state),
        country      = COALESCE(?, country)
      WHERE user_id = ?
    `, [companyName, industry, website, description, city, state, country, req.user.id]);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ─── GET /dashboard — Analytics ───────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });
    const companyId = companies[0].id;

    // Total internships
    const [[internshipCount]] = await db.query(
      'SELECT COUNT(*) AS total, SUM(status="active") AS active FROM internships WHERE company_id = ?',
      [companyId]
    );

    // Applications per internship — GROUP BY with aggregate
    const [applicationsPerJob] = await db.query(`
      SELECT
        i.id, i.title, i.status AS internship_status,
        COUNT(a.id) AS total_applications,
        SUM(a.status = 'shortlisted') AS shortlisted,
        SUM(a.status = 'hired') AS hired,
        SUM(a.status = 'rejected') AS rejected,
        AVG(s.cgpa) AS avg_applicant_cgpa
      FROM internships i
      LEFT JOIN applications a ON i.id = a.internship_id
      LEFT JOIN students s ON a.student_id = s.id
      WHERE i.company_id = ?
      GROUP BY i.id
      ORDER BY total_applications DESC
    `, [companyId]);

    // Recent applicants
    const [recentApplicants] = await db.query(`
      SELECT
        ad.application_id, ad.student_name, ad.student_email,
        ad.internship_title, ad.status, ad.applied_at, ad.cgpa, ad.college
      FROM application_details ad
      WHERE ad.company_id = ?
      ORDER BY ad.applied_at DESC
      LIMIT 10
    `, [companyId]);

    // Total counts
    const [[totalApplicants]] = await db.query(`
      SELECT COUNT(a.id) AS total
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = ?
    `, [companyId]);

    res.json({
      success: true,
      data: {
        internshipCount:   internshipCount.total,
        activeInternships: internshipCount.active,
        totalApplicants:   totalApplicants.total,
        applicationsPerJob,
        recentApplicants
      }
    });
  } catch (err) {
    console.error('Company dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
});

// ─── GET /internships — Own listings ─────────────────────────
router.get('/internships', async (req, res) => {
  try {
    const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });

    const [rows] = await db.query(`
      SELECT
        i.*,
        COUNT(a.id) AS application_count,
        GROUP_CONCAT(sk.name SEPARATOR ', ') AS skills_required
      FROM internships i
      LEFT JOIN applications a ON i.id = a.internship_id
      LEFT JOIN internship_skills is2 ON i.id = is2.internship_id
      LEFT JOIN skills sk ON is2.skill_id = sk.id
      WHERE i.company_id = ?
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [companies[0].id]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch internships' });
  }
});

module.exports = router;
