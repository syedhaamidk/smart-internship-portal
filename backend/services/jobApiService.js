/**
 * Job API Service
 * Fetches external internships from Adzuna API
 * Falls back to cached DB results or mock data if API fails
 */
const axios = require('axios');
const db    = require('../config/db');

const CACHE_TTL_HOURS = 6;

/**
 * Fetch internships from Adzuna API with DB caching + fallback
 * @param {string} query - Search keyword
 * @param {string} location - Location filter
 */
async function fetchJobs(query = 'internship', location = '') {
  const cacheKey = `jobs_${query}_${location}`.toLowerCase().replace(/\s+/g, '_');

  // 1️⃣ Try DB cache first
  try {
    const [[cached]] = await db.query(
      'SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > NOW()',
      [cacheKey]
    );
    if (cached) {
      console.log(`📦 Cache hit: ${cacheKey}`);
      return JSON.parse(cached.data);
    }
  } catch (err) {
    console.warn('Cache read error:', err.message);
  }

  // 2️⃣ Try Adzuna API
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_ID !== 'your_adzuna_app_id') {
    try {
      const country  = process.env.ADZUNA_COUNTRY || 'in';
      const searchQ  = `${query} internship ${location}`.trim();
      const url      = `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;

      const response = await axios.get(url, {
        params: {
          app_id:        process.env.ADZUNA_APP_ID,
          app_key:       process.env.ADZUNA_APP_KEY,
          what:          searchQ,
          results_per_page: 6,
          content_type:  'application/json'
        },
        timeout: 5000
      });

      const jobs = (response.data.results || []).map(job => ({
        id:           `ext_${job.id}`,
        title:        job.title,
        company_name: job.company?.display_name || 'External Company',
        location:     job.location?.display_name || 'Remote',
        description:  job.description?.substring(0, 300) || '',
        stipend_min:  job.salary_min ? Math.round(job.salary_min / 12) : 0,
        stipend_max:  job.salary_max ? Math.round(job.salary_max / 12) : 0,
        external_url: job.redirect_url,
        type:         'external',
        source:       'adzuna',
        created_at:   job.created
      }));

      // Cache the results
      await cacheJobs(cacheKey, jobs);

      // Also store in internships table for search
      await persistExternalJobs(jobs);

      return jobs;
    } catch (err) {
      console.warn(`⚠️ Adzuna API error: ${err.message} — using fallback`);
    }
  }

  // 3️⃣ Fallback: Check DB for cached external jobs
  try {
    const [dbExternal] = await db.query(`
      SELECT id, title, location, description, stipend_min, stipend_max,
             external_url, external_source AS source, created_at,
             'external' AS type
      FROM internships
      WHERE type = 'external' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 6
    `);

    if (dbExternal.length > 0) return dbExternal;
  } catch (err) {
    console.warn('DB external fallback error:', err.message);
  }

  // 4️⃣ Final fallback: Mock data
  return getMockJobs(query);
}

/**
 * Cache jobs in api_cache table
 */
async function cacheJobs(cacheKey, data) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
  try {
    await db.query(
      `INSERT INTO api_cache (cache_key, data, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
      [cacheKey, JSON.stringify(data), expiresAt]
    );
  } catch (err) {
    console.warn('Cache write error:', err.message);
  }
}

/**
 * Persist external jobs to internships table (hybrid data)
 */
async function persistExternalJobs(jobs) {
  for (const job of jobs) {
    try {
      await db.query(`
        INSERT IGNORE INTO internships
          (title, description, location, stipend_min, stipend_max, type,
           external_url, external_source, external_id, status)
        VALUES (?, ?, ?, ?, ?, 'external', ?, 'adzuna', ?, 'active')
      `, [
        job.title, job.description, job.location,
        job.stipend_min, job.stipend_max,
        job.external_url, job.id
      ]);
    } catch {}
  }
}

/**
 * Mock internships — always available as last resort
 */
function getMockJobs(query) {
  const mockJobs = [
    {
      id: 'mock_1', title: 'Software Engineering Intern', company_name: 'Google (via LinkedIn)',
      location: 'Bangalore / Remote', description: 'Work on large-scale infrastructure, write clean code, and collaborate with world-class engineers.',
      stipend_min: 50000, stipend_max: 80000, external_url: 'https://linkedin.com/jobs/search/?keywords=software+engineering+intern',
      type: 'external', source: 'linkedin', created_at: new Date().toISOString()
    },
    {
      id: 'mock_2', title: 'Data Science Intern', company_name: 'Amazon (via Internshala)',
      location: 'Hyderabad', description: 'Analyze petabyte-scale data, build ML models, and generate insights for business decisions.',
      stipend_min: 40000, stipend_max: 60000, external_url: 'https://internshala.com/internships/data-science-internship',
      type: 'external', source: 'internshala', created_at: new Date().toISOString()
    },
    {
      id: 'mock_3', title: 'Product Management Intern', company_name: 'Flipkart (via LinkedIn)',
      location: 'Bangalore', description: 'Define product roadmap, work with engineering and design teams, and ship features used by millions.',
      stipend_min: 35000, stipend_max: 55000, external_url: 'https://linkedin.com/jobs/search/?keywords=product+management+intern',
      type: 'external', source: 'linkedin', created_at: new Date().toISOString()
    },
    {
      id: 'mock_4', title: 'Machine Learning Intern', company_name: 'Microsoft Research',
      location: 'Hyderabad / Remote', description: 'Research and implement cutting-edge ML algorithms. Publish papers and file patents.',
      stipend_min: 60000, stipend_max: 90000, external_url: 'https://careers.microsoft.com/students',
      type: 'external', source: 'company_site', created_at: new Date().toISOString()
    },
    {
      id: 'mock_5', title: 'UI/UX Design Intern', company_name: 'Swiggy',
      location: 'Bangalore / Remote', description: 'Design intuitive user experiences for millions of daily users. Work with Figma and conduct user research.',
      stipend_min: 20000, stipend_max: 35000, external_url: 'https://internshala.com/internships/ui-ux-design-internship',
      type: 'external', source: 'internshala', created_at: new Date().toISOString()
    },
    {
      id: 'mock_6', title: 'DevOps Intern', company_name: 'Razorpay',
      location: 'Bangalore', description: 'Work on CI/CD pipelines, Kubernetes, and cloud infrastructure. Learn industry-grade DevOps practices.',
      stipend_min: 25000, stipend_max: 40000, external_url: 'https://linkedin.com/jobs/search/?keywords=devops+intern',
      type: 'external', source: 'linkedin', created_at: new Date().toISOString()
    }
  ];

  // Simple filter based on query
  if (query && query !== 'internship') {
    return mockJobs.filter(j =>
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      j.description.toLowerCase().includes(query.toLowerCase())
    );
  }
  return mockJobs;
}

module.exports = { fetchJobs };
