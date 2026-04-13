/**
 * AI Service
 * Uses Anthropic Claude API for:
 * 1. Resume analysis — skills extraction, improvement suggestions
 * 2. Job recommendation explanations
 * 3. Career guidance chatbot
 * 4. Keyword matching score
 */
const Anthropic = require('@anthropic-ai/sdk');
const router    = require('express').Router();
const db        = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── POST /ai/analyze-resume ──────────────────────────────────
// Body: { resumeText: "..." }
router.post('/analyze-resume', authenticate, authorize('student'), async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText || resumeText.trim().length < 50) {
    return res.status(400).json({ success: false, message: 'Paste at least 50 characters of your resume' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a professional career counselor and resume expert specializing in tech internships for college students in India.
Analyze resumes and provide structured, actionable feedback.
Always respond with valid JSON only, no preamble.`,
      messages: [{
        role: 'user',
        content: `Analyze this resume and return a JSON object with these exact keys:
{
  "overallScore": <number 0-100>,
  "strengths": [<array of 3-5 strength strings>],
  "improvements": [<array of 3-5 specific improvement strings>],
  "missingSkills": [<array of in-demand skills not found>],
  "extractedSkills": [<array of skills you found>],
  "keywordScore": <number 0-100 for ATS keyword optimization>,
  "summary": "<2-sentence overall assessment>"
}

Resume:
${resumeText.substring(0, 3000)}`
      }]
    });

    const rawText = message.content[0].text.trim();
    // Strip markdown code fences if present
    const jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      // Fallback if Claude doesn't return pure JSON
      analysis = {
        overallScore: 70,
        summary: rawText,
        strengths: [],
        improvements: [],
        missingSkills: [],
        extractedSkills: [],
        keywordScore: 65
      };
    }

    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('Resume analysis error:', err);
    res.status(500).json({ success: false, message: 'AI analysis failed. Please try again.' });
  }
});

// ─── POST /ai/match-score ─────────────────────────────────────
// Body: { resumeText, internshipId }
router.post('/match-score', authenticate, authorize('student'), async (req, res) => {
  const { resumeText, internshipId } = req.body;
  if (!resumeText || !internshipId) {
    return res.status(400).json({ success: false, message: 'resumeText and internshipId required' });
  }

  try {
    const [internships] = await db.query(`
      SELECT i.title, i.description,
        GROUP_CONCAT(sk.name SEPARATOR ', ') AS required_skills
      FROM internships i
      LEFT JOIN internship_skills is2 ON i.id = is2.internship_id
      LEFT JOIN skills sk ON is2.skill_id = sk.id
      WHERE i.id = ?
      GROUP BY i.id
    `, [internshipId]);

    if (!internships.length) return res.status(404).json({ success: false, message: 'Internship not found' });
    const internship = internships[0];

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: 'You are a recruitment AI. Respond with valid JSON only, no extra text.',
      messages: [{
        role: 'user',
        content: `Score how well this resume matches this internship. Return JSON:
{
  "matchScore": <number 0-100>,
  "matchedSkills": [<skills from resume that match>],
  "missingSkills": [<required skills not in resume>],
  "recommendation": "<one sentence advice>"
}

Internship: ${internship.title}
Required Skills: ${internship.required_skills}
Description: ${internship.description.substring(0, 500)}

Resume: ${resumeText.substring(0, 2000)}`
      }]
    });

    const raw = message.content[0].text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let result;
    try { result = JSON.parse(raw); }
    catch { result = { matchScore: 0, recommendation: raw }; }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Match score error:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate match score' });
  }
});

// ─── POST /ai/chat ────────────────────────────────────────────
// AI Career Guidance Chatbot
// Body: { messages: [{role, content}], studentProfile: {...} }
router.post('/chat', authenticate, async (req, res) => {
  const { messages, studentProfile } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'messages array is required' });
  }

  try {
    const systemPrompt = `You are CareerBot, a friendly and knowledgeable career counselor for college students seeking internships in India.
${studentProfile ? `Student context: ${JSON.stringify(studentProfile)}` : ''}
Provide practical, specific advice. Be concise (2-4 sentences per reply). 
Focus on: internship preparation, resume tips, interview advice, skill development, and career paths.
Do not answer questions unrelated to career/internships.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.slice(-10) // Last 10 messages for context
    });

    res.json({
      success: true,
      reply: response.content[0].text
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ success: false, message: 'AI chat unavailable' });
  }
});

// ─── POST /ai/recommend-jobs ──────────────────────────────────
// Body: { skills: ['React', 'Python'], interests: 'web development' }
router.post('/recommend-jobs', authenticate, authorize('student'), async (req, res) => {
  const { skills, interests, cgpa } = req.body;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: 'You are a career advisor. Respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Based on a student's profile, suggest internship types and skills to develop.

Student skills: ${(skills || []).join(', ')}
Interests: ${interests || 'not specified'}
CGPA: ${cgpa || 'not specified'}

Return JSON:
{
  "recommendedRoles": [<array of 5 internship role names>],
  "skillsToLearn": [<array of 4 skills to add>],
  "careerPaths": [<array of 3 potential career paths>],
  "tips": "<one actionable tip specific to this profile>"
}`
      }]
    });

    const raw = message.content[0].text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let result;
    try { result = JSON.parse(raw); }
    catch { result = { tips: raw }; }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Recommend jobs error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate recommendations' });
  }
});

module.exports = router;
