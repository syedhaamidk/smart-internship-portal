/**
 * API Client
 * Centralized frontend ↔ backend communication
 * All fetch calls go through here for consistent auth & error handling
 */

const API_BASE = 'http://localhost:5000/api';

// ─── Core fetch wrapper ────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      // Auto-logout on 401
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login.html';
        return;
      }
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// ─── Auth API ─────────────────────────────────────────────────
const AuthAPI = {
  signup: (data)  => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login:  (data)  => apiFetch('/auth/login',  { method: 'POST', body: JSON.stringify(data) }),
  me:     ()      => apiFetch('/auth/me'),
};

// ─── Student API ──────────────────────────────────────────────
const StudentAPI = {
  getProfile:    ()     => apiFetch('/students/profile'),
  updateProfile: (data) => apiFetch('/students/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateSkills:  (data) => apiFetch('/students/skills',  { method: 'PUT', body: JSON.stringify(data) }),
  getDashboard:  ()     => apiFetch('/students/dashboard'),
  getNotifications: () => apiFetch('/students/notifications'),
  markNotifRead: (id)   => apiFetch(`/students/notifications/${id}/read`, { method: 'PUT' }),

  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/students/resume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return res.json();
  }
};

// ─── Internships API ──────────────────────────────────────────
const InternshipAPI = {
  list:       (params = {}) => apiFetch('/internships?' + new URLSearchParams(params)),
  get:        (id)          => apiFetch(`/internships/${id}`),
  create:     (data)        => apiFetch('/internships', { method: 'POST', body: JSON.stringify(data) }),
  update:     (id, data)    => apiFetch(`/internships/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:     (id)          => apiFetch(`/internships/${id}`, { method: 'DELETE' }),
  save:       (id)          => apiFetch(`/internships/${id}/save`, { method: 'POST' }),
  getSaved:   ()            => apiFetch('/internships/saved'),
  getRecommended: ()        => apiFetch('/internships/recommended'),
  getSkills:  ()            => apiFetch('/internships/skills'),
};

// ─── Applications API ─────────────────────────────────────────
const ApplicationAPI = {
  apply:          (data)        => apiFetch('/applications', { method: 'POST', body: JSON.stringify(data) }),
  getMine:        ()            => apiFetch('/applications/mine'),
  getForCompany:  (params = {}) => apiFetch('/applications/company?' + new URLSearchParams(params)),
  updateStatus:   (id, status)  => apiFetch(`/applications/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  withdraw:       (id)          => apiFetch(`/applications/${id}`, { method: 'DELETE' }),
};

// ─── Company API ──────────────────────────────────────────────
const CompanyAPI = {
  getProfile:    ()     => apiFetch('/companies/profile'),
  updateProfile: (data) => apiFetch('/companies/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getDashboard:  ()     => apiFetch('/companies/dashboard'),
  getInternships: ()    => apiFetch('/companies/internships'),
};

// ─── AI API ───────────────────────────────────────────────────
const AIAPI = {
  analyzeResume:   (resumeText)                => apiFetch('/ai/analyze-resume',  { method: 'POST', body: JSON.stringify({ resumeText }) }),
  matchScore:      (resumeText, internshipId)  => apiFetch('/ai/match-score',     { method: 'POST', body: JSON.stringify({ resumeText, internshipId }) }),
  chat:            (messages, studentProfile)  => apiFetch('/ai/chat',            { method: 'POST', body: JSON.stringify({ messages, studentProfile }) }),
  recommendJobs:   (data)                      => apiFetch('/ai/recommend-jobs',  { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Admin API ────────────────────────────────────────────────
const AdminAPI = {
  getDashboard:     ()     => apiFetch('/admin/dashboard'),
  getUsers:         (p)    => apiFetch('/admin/users?' + new URLSearchParams(p)),
  updateUser:       (id,d) => apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  getInternships:   (p)    => apiFetch('/admin/internships?' + new URLSearchParams(p)),
  approveInternship:(id)   => apiFetch(`/admin/internships/${id}/approve`, { method: 'PUT' }),
  rejectInternship: (id)   => apiFetch(`/admin/internships/${id}/reject`, { method: 'PUT' }),
  deleteInternship: (id)   => apiFetch(`/admin/internships/${id}`, { method: 'DELETE' }),
};

// ─── Utility helpers ──────────────────────────────────────────
function formatStipend(min, max) {
  if (!min && !max) return 'Unpaid';
  if (!max || min === max) return `₹${(min/1000).toFixed(0)}K/mo`;
  return `₹${(min/1000).toFixed(0)}K–${(max/1000).toFixed(0)}K/mo`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
}

function statusBadge(status) {
  const map = {
    applied:     '<span class="badge badge-applied">Applied</span>',
    shortlisted: '<span class="badge badge-shortlisted">⭐ Shortlisted</span>',
    hired:       '<span class="badge badge-hired">🎉 Hired</span>',
    rejected:    '<span class="badge badge-rejected">Rejected</span>',
    active:      '<span class="badge badge-active">Active</span>',
    closed:      '<span class="badge badge-closed">Closed</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function requireAuth(allowedRoles) {
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');
  if (!token) { window.location.href = '/login.html'; return false; }
  if (allowedRoles && !allowedRoles.includes(role)) {
    window.location.href = `/${role}/dashboard.html`;
    return false;
  }
  return true;
}

function logout() {
  localStorage.clear();
  window.location.href = '/login.html';
}
