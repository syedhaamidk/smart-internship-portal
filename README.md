# 🎓 Smart Internship Portal
### Full-Stack Web App with AI + Job API Integration

> A production-grade internship platform built for a **college DBMS evaluation** — demonstrating normalized schema design, complex SQL queries, REST APIs, Claude AI integration, and modern frontend development.

---

## 📁 Project Structure

```
smart-internship-portal/
├── backend/
│   ├── config/
│   │   └── db.js                  # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js                # JWT + role-based auth middleware
│   ├── routes/
│   │   ├── auth.js                # Signup / Login / Me
│   │   ├── students.js            # Student profile, skills, dashboard
│   │   ├── companies.js           # Company profile, dashboard
│   │   ├── internships.js         # CRUD + search + save + recommend
│   │   ├── applications.js        # Apply, track, update status
│   │   └── admin.js               # Platform analytics, approvals
│   ├── services/
│   │   ├── aiService.js           # Anthropic Claude AI (resume, chat, match)
│   │   ├── emailService.js        # Nodemailer email notifications
│   │   └── jobApiService.js       # Adzuna API + DB cache + mock fallback
│   ├── uploads/                   # Uploaded resumes (auto-created)
│   ├── server.js                  # Express app entry point
│   ├── package.json
│   └── .env.example               # Environment variable template
│
├── frontend/
│   ├── css/
│   │   └── style.css              # Full design system (CSS variables, components)
│   ├── js/
│   │   ├── api.js                 # Centralized API client (all fetch calls)
│   │   └── ui.js                  # Shared UI: sidebar, chatbot, toast, job cards
│   ├── login.html                 # Auth page (login + signup, role selection)
│   ├── student/
│   │   ├── dashboard.html         # Analytics, stats, recent apps, recommendations
│   │   ├── internships.html       # Browse portal + external jobs with filters
│   │   ├── applications.html      # Application tracking with timeline
│   │   ├── ai-tools.html          # Resume analyzer, match score, career recommender
│   │   ├── saved.html             # Bookmarked internships
│   │   └── profile.html           # Edit profile + skills
│   ├── company/
│   │   ├── dashboard.html         # Analytics, bar charts, recent applicants
│   │   ├── post-job.html          # Create / Edit internship posting
│   │   ├── internships.html       # Manage own listings
│   │   └── applicants.html        # Review applicants + update status
│   └── admin/
│       ├── dashboard.html         # Platform-wide analytics + pending approvals
│       ├── users.html             # User management
│       └── internships.html       # All internship moderation
│
└── database/
    ├── schema.sql                 # Full normalized schema (3NF) + views + stored procedure
    └── sample_data.sql            # Sample data for all tables
```

---

## 🗄 Database Design (3NF)

### Entity Relationship Overview

```
users (1) ──── (1) students
users (1) ──── (1) companies
students (M) ─── (M) skills          [via student_skills]
internships (M) ─ (M) skills         [via internship_skills]
students (1) ──── (M) applications ── (1) internships
students (1) ──── (M) saved_jobs ──── (1) internships
companies (1) ──── (M) internships
users (1) ──── (M) notifications
```

### Key SQL Features Demonstrated

| Feature | Where Used |
|---|---|
| **3NF Normalization** | All 9 tables, no transitive dependencies |
| **Primary Keys** | All tables |
| **Foreign Keys** | With CASCADE / SET NULL |
| **Unique Constraints** | Email, student-internship pair (prevent duplicate apps) |
| **INNER JOIN** | `application_details` view |
| **LEFT JOIN** | Internship listing with optional company |
| **GROUP BY + COUNT** | Company dashboard (applications per internship) |
| **AVG()** | Average CGPA of applicants |
| **SUM() conditional** | Count shortlisted/hired per job |
| **Transactions** | `apply_for_internship` stored procedure |
| **Views** | `application_details`, `internship_skill_match` |
| **Indexes** | On email, location, stipend, status, deadline |
| **Stored Procedure** | Atomic application + notification insert |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8+
- Git

### Step 1: Database Setup
```bash
# Login to MySQL
mysql -u root -p

# Run schema
source /path/to/database/schema.sql

# Load sample data (optional but recommended for demo)
source /path/to/database/sample_data.sql
```

### Step 2: Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your MySQL password, API keys, etc.

# Start the server
npm run dev          # development (with auto-reload)
# OR
npm start            # production
```

> Server starts at **http://localhost:5000**

### Step 3: Frontend Setup
- Open `frontend/login.html` in a browser using VS Code Live Server or any static server
- Recommended: VS Code extension **"Live Server"** — right-click `login.html` → "Open with Live Server"
- OR: `npx serve frontend` from project root

> Frontend default runs at **http://127.0.0.1:5500**

### Step 4: Configure Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_PASSWORD` | ✅ | Your MySQL root password |
| `JWT_SECRET` | ✅ | Any random secret string |
| `ANTHROPIC_API_KEY` | ⭐ | For AI features (resume analysis, chatbot) |
| `ADZUNA_APP_ID` + `KEY` | 🔶 | For external job listings (has fallback mock data) |
| `EMAIL_USER` + `EMAIL_PASS` | 🔶 | Gmail + App Password for email notifications |

> **All AI and external API features have graceful fallbacks** — the app works without them.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Student | alice@student.com | Password@123 |
| Student | priya@student.com | Password@123 |
| Company | hr@techcorp.com | Password@123 |
| Admin | admin@portal.com | Password@123 |

> ⚠️ Sample data uses bcrypt placeholders — run signup to create real accounts with hashed passwords.

---

## 🧩 API Endpoints Reference

### Auth
```
POST /api/auth/signup       — Register (student or company)
POST /api/auth/login        — Login any role
GET  /api/auth/me           — Get current user profile
```

### Internships
```
GET    /api/internships              — List with filters + external API
GET    /api/internships/recommended  — AI skill-match recommendations
GET    /api/internships/saved        — Student's bookmarks
GET    /api/internships/:id          — Single internship detail
POST   /api/internships              — Create (company)
PUT    /api/internships/:id          — Update (company)
DELETE /api/internships/:id          — Delete
POST   /api/internships/:id/save     — Toggle bookmark
```

### Applications
```
POST   /api/applications             — Apply (student) — uses TRANSACTION
GET    /api/applications/mine        — Student's applications
GET    /api/applications/company     — Company's received apps
PUT    /api/applications/:id/status  — Update status (company)
DELETE /api/applications/:id         — Withdraw (student)
```

### AI (Claude)
```
POST /api/ai/analyze-resume    — Resume analysis + score
POST /api/ai/match-score       — Job match percentage
POST /api/ai/chat              — CareerBot conversation
POST /api/ai/recommend-jobs    — Career path suggestions
```

### Dashboards
```
GET /api/students/dashboard     — Student stats + recent apps
GET /api/companies/dashboard    — Company analytics (GROUP BY)
GET /api/admin/dashboard        — Platform-wide metrics
```

---

## 🔵 Features Implemented

### Core
- [x] Role-based auth (Student / Company / Admin)
- [x] bcrypt password hashing
- [x] JWT token authentication
- [x] Student profile with skills
- [x] Company profile
- [x] Internship CRUD
- [x] Application system with TRANSACTION
- [x] Application status tracking
- [x] Save/bookmark internships
- [x] Dashboard analytics per role

### AI Integration (Claude API)
- [x] Resume text analyzer — score, improvements, missing skills
- [x] ATS keyword scoring
- [x] Job match score (resume vs. internship)
- [x] Career path recommendations
- [x] CareerBot — AI chatbot (floating bubble)

### External API
- [x] Adzuna job API integration
- [x] DB cache layer (api_cache table, 6hr TTL)
- [x] Fallback to DB cached external jobs
- [x] Fallback to curated mock data if API unavailable
- [x] "Apply on LinkedIn / Internshala" external redirect buttons

### Email Notifications
- [x] Application confirmation email
- [x] Status update email (shortlisted/hired/rejected)
- [x] Welcome email on signup
- [x] Console fallback if SMTP not configured

### Search & Filters
- [x] Full-text search (title, description)
- [x] Filter by location, stipend, skills, type, remote
- [x] Active filter chips UI

### Security
- [x] Input validation (express-validator)
- [x] Parameterized queries (prevent SQL injection)
- [x] Rate limiting (200 req/15min general, 20 req/15min auth)
- [x] CORS configuration
- [x] File type + size validation on upload

---

## 🏆 Bonus Features Added

1. **AI CareerBot** — Floating chatbot bubble on every student page; multi-turn conversation with profile context
2. **Resume keyword match score** — ATS optimization feedback (0-100)
3. **Admin panel** — Full approval workflow, skill demand charts, user management
4. **Stored Procedure** — `apply_for_internship` with atomic transaction + notification
5. **SQL Views** — `application_details`, `internship_skill_match` for clean joins
6. **Profile completion meter** — Percentage bar in dashboard banner
7. **Application timeline** — Visual Applied → Shortlisted → Hired progression
8. **Hybrid data tagging** — Jobs clearly labeled "✅ Portal" vs "🔗 External"
9. **Skill demand analytics** — Admin sees which skills companies need most
10. **Smart fallback chain** — API → DB cache → Mock data (never a broken page)

---

## 🎨 Design Decisions

- **Fonts**: Sora (headings) + DM Sans (body) — distinctive, professional, non-generic
- **Color**: Navy (#0a2540) primary + Electric Blue (#2563eb) accent — LinkedIn-inspired but differentiated
- **Layout**: Fixed sidebar + scrollable main content — standard dashboard pattern
- **Animations**: CSS-only transitions, skeleton loading states, modal/toast animations
- **Mobile**: Sidebar slides in/out on mobile, responsive grid

---

## 📊 DBMS Concepts Checklist (for Evaluation)

| Concept | Implementation |
|---|---|
| Normalization (3NF) | `students`, `skills`, `student_skills` junction |
| 1-to-Many | `companies` → `internships` |
| Many-to-Many | `students ↔ skills`, `internships ↔ skills` |
| INNER JOIN | `application_details` view |
| LEFT JOIN | Internship listing (company may be NULL for external) |
| GROUP BY + COUNT | Company dashboard |
| AVG aggregate | Average CGPA of applicants per job |
| Transactions | Application + notification (atomic) |
| Stored Procedure | `apply_for_internship` |
| Views | `application_details`, `internship_skill_match` |
| Indexes | 12 indexes across critical columns |
| Constraints | NOT NULL, UNIQUE, ENUM, FK CASCADE |
| Subqueries | Skill-based filter in internship listing |
