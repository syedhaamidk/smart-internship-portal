/**
 * Applications Routes
 * POST /api/applications            — apply for internship (student)
 * GET  /api/applications/mine       — student's applications
 * GET  /api/applications/company    — company's received applications
 * PUT  /api/applications/:id/status — update status (company)
 * DELETE /api/applications/:id      — withdraw application (student)
 */
const router       = require('express').Router();
const db           = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const emailService = require('../services/emailService');

// ─── POST / — Apply for internship ───────────────────────────
router.post('/', authenticate, authorize('student'), async (req, res) => {
  const { internshipId, coverLetter } = req.body;
  if (!internshipId) return res.status(400).json({ success: false, message: 'internshipId is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get student
    const [students] = await conn.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Student profile not found' }); }
    const studentId = students[0].id;

    // Verify internship exists and is active
    const [internships] = await conn.query(
      'SELECT id, title, company_id, deadline FROM internships WHERE id = ? AND status = "active"',
      [internshipId]
    );
    if (!internships.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Internship not found or closed' }); }
    const internship = internships[0];

    // Check deadline
    if (internship.deadline && new Date(internship.deadline) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });
    }

    // Check duplicate
    const [[existing]] = await conn.query(
      'SELECT id FROM applications WHERE student_id = ? AND internship_id = ?',
      [studentId, internshipId]
    );
    if (existing) { await conn.rollback(); return res.status(409).json({ success: false, message: 'Already applied for this internship' }); }

    // Insert application
    const [result] = await conn.query(
      'INSERT INTO applications (student_id, internship_id, cover_letter) VALUES (?, ?, ?)',
      [studentId, internshipId, coverLetter || null]
    );

    // Notify company
    if (internship.company_id) {
      const [companies] = await conn.query('SELECT user_id FROM companies WHERE id = ?', [internship.company_id]);
      if (companies.length) {
        await conn.query(
          'INSERT INTO notifications (user_id, type, message) VALUES (?, "application_received", ?)',
          [companies[0].user_id, `New application received for "${internship.title}"`]
        );
      }
    }

    await conn.commit();

    // Send confirmation email (async, don't block response)
    const [userData] = await db.query(
      `SELECT u.email, CONCAT(s.first_name, ' ', s.last_name) AS name
       FROM users u JOIN students s ON u.id = s.user_id WHERE u.id = ?`,
      [req.user.id]
    );
    if (userData.length) {
      emailService.sendApplicationConfirmation(
        userData[0].email,
        userData[0].name,
        internship.title
      ).catch(console.error);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      applicationId: result.insertId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Apply error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  } finally {
    conn.release();
  }
});

// ─── GET /mine — Student's applications ───────────────────────
router.get('/mine', authenticate, authorize('student'), async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const [rows] = await db.query(`
      SELECT
        a.id, a.status, a.applied_at, a.cover_letter,
        i.id AS internship_id, i.title, i.location, i.stipend_min, i.stipend_max,
        i.duration_months, i.type, i.external_url,
        c.company_name, c.logo_url
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE a.student_id = ?
      ORDER BY a.applied_at DESC
    `, [students[0].id]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get applications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// ─── GET /company — Company's applicants ─────────────────────
router.get('/company', authenticate, authorize('company'), async (req, res) => {
  const { internshipId, status } = req.query;

  try {
    const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });

    let query = `
      SELECT
        ad.*,
        a.cover_letter,
        a.updated_at AS status_updated_at
      FROM application_details ad
      JOIN applications a ON ad.application_id = a.id
      WHERE ad.company_id = ?
    `;
    const params = [companies[0].id];

    if (internshipId) { query += ' AND ad.internship_id = ?'; params.push(internshipId); }
    if (status) { query += ' AND ad.status = ?'; params.push(status); }
    query += ' ORDER BY ad.applied_at DESC';

    const [rows] = await db.query(query, params);

    // Application stats per internship — GROUP BY aggregate
    const [stats] = await db.query(`
      SELECT
        i.id, i.title,
        COUNT(a.id) AS total_applications,
        SUM(a.status = 'shortlisted') AS shortlisted,
        SUM(a.status = 'rejected') AS rejected,
        SUM(a.status = 'hired') AS hired,
        AVG(s.cgpa) AS avg_cgpa
      FROM internships i
      LEFT JOIN applications a ON i.id = a.internship_id
      LEFT JOIN students s ON a.student_id = s.id
      WHERE i.company_id = ?
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [companies[0].id]);

    res.json({ success: true, data: rows, stats });
  } catch (err) {
    console.error('Company applications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// ─── PUT /:id/status — Update application status ──────────────
router.put('/:id/status', authenticate, authorize('company'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['applied', 'shortlisted', 'rejected', 'hired'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    const [companies] = await db.query('SELECT id FROM companies WHERE user_id = ?', [req.user.id]);
    if (!companies.length) return res.status(404).json({ success: false, message: 'Company not found' });

    // Verify ownership
    const [rows] = await db.query(`
      SELECT a.id, a.student_id, i.title, u.email,
             CONCAT(s.first_name, ' ', s.last_name) AS student_name,
             s.user_id AS student_user_id
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE a.id = ? AND i.company_id = ?
    `, [req.params.id, companies[0].id]);

    if (!rows.length) return res.status(403).json({ success: false, message: 'Not authorized' });

    await db.query('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id]);

    const app = rows[0];

    // Notify student
    await db.query(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, "status_update", ?)',
      [app.student_user_id, `Your application for "${app.title}" has been updated to: ${status}`]
    );

    // Send status update email
    emailService.sendStatusUpdate(app.email, app.student_name, app.title, status).catch(console.error);

    res.json({ success: true, message: `Application status updated to ${status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// ─── DELETE /:id — Withdraw application ──────────────────────
router.delete('/:id', authenticate, authorize('student'), async (req, res) => {
  try {
    const [students] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!students.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const [result] = await db.query(
      'DELETE FROM applications WHERE id = ? AND student_id = ? AND status = "applied"',
      [req.params.id, students[0].id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Cannot withdraw — application not found or already processed' });
    }

    res.json({ success: true, message: 'Application withdrawn successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to withdraw application' });
  }
});

module.exports = router;
