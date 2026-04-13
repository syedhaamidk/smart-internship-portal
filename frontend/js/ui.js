/**
 * Shared UI helpers used across all dashboard pages
 * - Sidebar rendering
 * - Toast notifications
 * - Chatbot
 * - Common components
 */

// ─── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }[type] || '';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ─── Student Sidebar ───────────────────────────────────────────
function renderStudentSidebar(activePage) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const name = profile.first_name ? `${profile.first_name} ${profile.last_name}` : localStorage.getItem('email') || 'Student';

  const navItems = [
    { icon: '🏠', label: 'Dashboard',    href: 'dashboard.html',    key: 'dashboard' },
    { icon: '🔍', label: 'Browse Jobs',  href: 'internships.html',  key: 'internships' },
    { icon: '📩', label: 'Applications', href: 'applications.html', key: 'applications' },
    { icon: '🔖', label: 'Saved Jobs',   href: 'saved.html',        key: 'saved' },
    { icon: '🤖', label: 'AI Tools',     href: 'ai-tools.html',     key: 'ai' },
    { icon: '👤', label: 'My Profile',   href: 'profile.html',      key: 'profile' },
  ];

  return `
    <div class="sidebar-brand">
      <div class="sidebar-logo">SI</div>
      <span>Smart Internship<small>Student Portal</small></span>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar">${getInitials(name)}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${name}</div>
        <div class="sidebar-user-role">Student</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Menu</div>
      ${navItems.map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          ${item.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="#" class="nav-item" onclick="logout()">
        <span class="nav-icon">🚪</span> Sign Out
      </a>
    </div>`;
}

// ─── Company Sidebar ───────────────────────────────────────────
function renderCompanySidebar(activePage) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const name = profile.company_name || localStorage.getItem('email') || 'Company';

  const navItems = [
    { icon: '🏠', label: 'Dashboard',     href: 'dashboard.html',    key: 'dashboard' },
    { icon: '📋', label: 'My Internships',href: 'internships.html',  key: 'internships' },
    { icon: '👥', label: 'Applicants',    href: 'applicants.html',   key: 'applicants' },
    { icon: '➕', label: 'Post Internship',href: 'post-job.html',    key: 'post' },
    { icon: '🏢', label: 'Company Profile',href: 'profile.html',     key: 'profile' },
  ];

  return `
    <div class="sidebar-brand">
      <div class="sidebar-logo">SI</div>
      <span>Smart Internship<small>Recruiter Portal</small></span>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar">${getInitials(name)}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name truncate">${name}</div>
        <div class="sidebar-user-role">Company</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Recruiter</div>
      ${navItems.map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          ${item.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="#" class="nav-item" onclick="logout()">
        <span class="nav-icon">🚪</span> Sign Out
      </a>
    </div>`;
}

// ─── Admin Sidebar ─────────────────────────────────────────────
function renderAdminSidebar(activePage) {
  const navItems = [
    { icon: '📊', label: 'Analytics',    href: 'dashboard.html',   key: 'dashboard' },
    { icon: '👥', label: 'Users',        href: 'users.html',       key: 'users' },
    { icon: '📋', label: 'Internships',  href: 'internships.html', key: 'internships' },
  ];

  return `
    <div class="sidebar-brand">
      <div class="sidebar-logo">SI</div>
      <span>Smart Internship<small>Admin Panel</small></span>
    </div>
    <nav class="sidebar-nav" style="margin-top:16px;">
      <div class="sidebar-section-label">Admin</div>
      ${navItems.map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          ${item.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="#" class="nav-item" onclick="logout()">
        <span class="nav-icon">🚪</span> Sign Out
      </a>
    </div>`;
}

// ─── Chatbot ───────────────────────────────────────────────────
let chatMessages = [];
let chatOpen = false;

function initChatbot() {
  const fab = document.createElement('button');
  fab.className = 'chatbot-fab';
  fab.innerHTML = '💬';
  fab.title = 'CareerBot — AI Career Advisor';
  fab.onclick = toggleChat;
  document.body.appendChild(fab);

  const win = document.createElement('div');
  win.className = 'chatbot-window hidden';
  win.id = 'chatbot-window';
  win.innerHTML = `
    <div class="chat-header">
      <span style="font-size:1.4rem">🤖</span>
      <div>
        <div style="font-weight:600;font-size:.9rem">CareerBot</div>
        <div style="font-size:.72rem;opacity:.8">AI Career Advisor</div>
      </div>
      <button onclick="toggleChat()" style="margin-left:auto;background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer">✕</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-bubble bot">Hi! I'm CareerBot 🤖 I can help with resume tips, interview prep, and finding the right internships. What's on your mind?</div>
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="chat-input" placeholder="Ask me anything about your career..." onkeydown="if(event.key==='Enter')sendChat()">
      <button class="chat-send" onclick="sendChat()">➤</button>
    </div>`;
  document.body.appendChild(win);
}

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatbot-window').classList.toggle('hidden', !chatOpen);
  if (chatOpen) document.getElementById('chat-input').focus();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  addChatBubble(msg, 'user');
  input.value = '';
  chatMessages.push({ role: 'user', content: msg });

  const typing = addChatBubble('...', 'bot');

  try {
    const profile = JSON.parse(localStorage.getItem('profile') || '{}');
    const res = await AIAPI.chat(chatMessages, profile);
    typing.textContent = res.reply;
    chatMessages.push({ role: 'assistant', content: res.reply });
  } catch {
    typing.textContent = 'Sorry, I\'m having trouble connecting. Please try again!';
  }

  const msgs = document.getElementById('chat-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

function addChatBubble(text, who) {
  const msgs = document.getElementById('chat-messages');
  const b = document.createElement('div');
  b.className = `chat-bubble ${who}`;
  b.textContent = text;
  msgs.appendChild(b);
  msgs.scrollTop = msgs.scrollHeight;
  return b;
}

// ─── Job Card renderer ─────────────────────────────────────────
function renderJobCard(job, savedIds = []) {
  const isExternal = job.type === 'external';
  const isSaved    = savedIds.includes(job.id);
  const source     = isExternal
    ? (job.source === 'internshala' ? 'Internshala' : job.source === 'adzuna' ? 'Adzuna' : 'LinkedIn')
    : 'Portal';

  const skills = (job.skills_required || '').split(',').filter(Boolean).slice(0, 3);

  return `
  <div class="job-card ${isExternal ? 'external' : ''}">
    <span class="job-card-source ${isExternal ? 'source-external' : 'source-portal'}">${isExternal ? '🔗 ' + source : '✅ Portal'}</span>
    <div class="job-card-header">
      <div class="job-card-logo">${job.logo_url ? `<img src="${job.logo_url}" alt="">` : (job.company_name||'?')[0]}</div>
      <div>
        <div class="job-card-title">${job.title}</div>
        <div class="job-card-company">${job.company_name || 'External Company'} ${job.location ? '· ' + job.location : ''}</div>
      </div>
    </div>

    <div class="job-card-tags">
      ${job.is_remote ? '<span class="tag accent">🌐 Remote</span>' : ''}
      ${job.duration_months ? `<span class="tag">⏱ ${job.duration_months}mo</span>` : ''}
      ${skills.map(s => `<span class="tag">${s.trim()}</span>`).join('')}
    </div>

    <div class="job-card-footer">
      <div>
        <div class="stipend">${formatStipend(job.stipend_min, job.stipend_max)}</div>
        ${job.deadline ? `<div class="text-sm text-muted">Deadline: ${new Date(job.deadline).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${!isExternal ? `
          <button class="save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave(${job.id}, this)" title="${isSaved?'Unsave':'Save'}">
            ${isSaved ? '🔖' : '🔖'}
          </button>
          <a href="internship-detail.html?id=${job.id}" class="btn btn-primary btn-sm">View</a>
        ` : `
          <a href="${job.external_url || '#'}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Apply Externally ↗</a>
        `}
      </div>
    </div>
  </div>`;
}

async function toggleSave(id, btn) {
  try {
    const res = await InternshipAPI.save(id);
    btn.classList.toggle('saved', res.saved);
    showToast(res.saved ? 'Job saved!' : 'Job unsaved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Mobile hamburger ──────────────────────────────────────────
function initMobileMenu() {
  const btn = document.getElementById('menu-toggle');
  if (btn) btn.addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
}
