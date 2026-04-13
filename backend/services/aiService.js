/**
 * AI Service
 * Uses Groq API for:
 * 1. Resume analysis — skills extraction, improvement suggestions
 * 2. Job recommendation explanations
 * 3. Career guidance chatbot
 * 4. Keyword matching score
 *
 * Model: llama-3.3-70b-versatile  (free tier, fast, great quality)
 * SDK:   groq-sdk  (npm install groq-sdk)
 * Free tier: ~14,400 requests/day — more than enough for a college demo
 */
const Groq    = require('groq-sdk');
const router  = require('express').Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─── Helper: strip markdown fences and parse JSON ─────────────
function parseJSON(raw, fallback = {}) {
  const clean = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}

// ─── POST /ai/analyze-resume ──────────────────────────────────
// Body: { resumeText: "..." }
router.post('/analyze-resume', authenticate, authorize('student'), async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText || resumeText.trim().length < 50) {
    return res.status(400).json({ success: false, message: 'Paste at least 50 characters of your resume' });
  }

  try {
    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a professional career counselor and resume expert specializing in tech internships for college students in India.
Analyze resumes and provide structured, actionable feedback.
IMPORTANT: Respond with valid JSON only. No preamble, no markdown fences, no extra text whatsoever. Start your response directly with { and end with }.`
        },
        {
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
        }
      ]
    });

    const rawText = response.choices[0].message.content;
    const analysis = parseJSON(rawText, {
      overallScore: 70,
      summary: rawText,
      strengths: [],
      improvements: [],
      missingSkills: [],
      extractedSkills: [],
      keywordScore: 65
    });

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

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 800,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a recruitment AI. Respond with valid JSON only. No preamble, no markdown fences. Start directly with { and end with }.'
        },
        {
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
        }
      ]
    });

    const raw = response.choices[0].message.content;
    const result = parseJSON(raw, { matchScore: 0, recommendation: raw });

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

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10) // Last 10 messages for context
      ]
    });

    res.json({
      success: true,
      reply: response.choices[0].message.content
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
    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 800,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You are a career advisor. Respond with valid JSON only. No preamble, no markdown fences. Start directly with { and end with }.'
        },
        {
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
        }
      ]
    });

    const raw = response.choices[0].message.content;
    const result = parseJSON(raw, { tips: raw });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Recommend jobs error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate recommendations' });
  }
});

module.exports = router;
