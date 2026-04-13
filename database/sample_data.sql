-- ============================================================
-- Smart Internship Portal - Sample Data
-- ============================================================
USE internship_portal;

-- Users (passwords: all "Password@123" bcrypt-hashed)
INSERT INTO users (email, password, role) VALUES
('alice@student.com',  '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHstudent1', 'student'),
('bob@student.com',    '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHstudent2', 'student'),
('priya@student.com',  '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHstudent3', 'student'),
('hr@techcorp.com',    '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHcompany1', 'company'),
('jobs@startup.io',    '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHcompany2', 'company'),
('admin@portal.com',   '$2b$10$YzE1NjQ5ZjBhYWViOTk4N.wEXAMPLEHASHadmin001', 'admin');

-- Students
INSERT INTO students (user_id, first_name, last_name, phone, college, degree, branch, graduation_year, cgpa, bio) VALUES
(1, 'Alice',  'Sharma',  '9876543210', 'IIT Bombay',    'B.Tech', 'Computer Science', 2025, 8.9, 'Passionate full-stack developer.'),
(2, 'Bob',    'Verma',   '9876543211', 'BITS Pilani',   'B.E.',   'Electronics',      2026, 7.5, 'Interested in embedded systems and IoT.'),
(3, 'Priya',  'Mehta',   '9876543212', 'NIT Trichy',    'B.Tech', 'Data Science',     2025, 9.1, 'ML enthusiast and data analyst.');

-- Companies
INSERT INTO companies (user_id, company_name, industry, website, description, city, is_verified) VALUES
(4, 'TechCorp Solutions', 'Information Technology', 'https://techcorp.example.com', 'Leading software solutions provider.', 'Bangalore', 1),
(5, 'Startup.io',         'SaaS',                  'https://startup.io',           'Fast-growing B2B SaaS startup.',       'Mumbai',    1);

-- Skills
INSERT INTO skills (name, category) VALUES
('Python',          'Programming'),
('JavaScript',      'Programming'),
('React',           'Frontend'),
('Node.js',         'Backend'),
('MySQL',           'Database'),
('Machine Learning','AI/ML'),
('Data Analysis',   'Analytics'),
('HTML/CSS',        'Frontend'),
('Git',             'Tools'),
('Docker',          'DevOps'),
('REST APIs',       'Backend'),
('TypeScript',      'Programming'),
('AWS',             'Cloud'),
('MongoDB',         'Database'),
('Communication',   'Soft Skills');

-- Student Skills
INSERT INTO student_skills (student_id, skill_id, level) VALUES
(1, 2,  'advanced'),    -- Alice: JavaScript
(1, 3,  'advanced'),    -- Alice: React
(1, 4,  'intermediate'),-- Alice: Node.js
(1, 5,  'intermediate'),-- Alice: MySQL
(1, 9,  'intermediate'),-- Alice: Git
(2, 1,  'intermediate'),-- Bob: Python
(2, 9,  'beginner'),    -- Bob: Git
(3, 1,  'advanced'),    -- Priya: Python
(3, 6,  'advanced'),    -- Priya: ML
(3, 7,  'advanced'),    -- Priya: Data Analysis
(3, 5,  'intermediate'),-- Priya: MySQL
(3, 9,  'intermediate');-- Priya: Git

-- Internships (Portal)
INSERT INTO internships (company_id, title, description, location, is_remote, stipend_min, stipend_max, duration_months, type, deadline, status, openings) VALUES
(1, 'Frontend Developer Intern',
   'Work on our React-based dashboard. Build responsive components, integrate REST APIs, and write unit tests. Good mentorship provided.',
   'Bangalore', 1, 15000, 25000, 3, 'portal', '2025-06-30', 'active', 2),

(1, 'Backend Node.js Intern',
   'Develop RESTful APIs using Node.js and Express. Work with MySQL databases. Agile team environment.',
   'Bangalore', 0, 20000, 30000, 6, 'portal', '2025-07-15', 'active', 1),

(2, 'Data Science Intern',
   'Analyze large datasets, build ML models for customer churn prediction, and create dashboards using Python and Tableau.',
   'Mumbai', 1, 18000, 28000, 4, 'portal', '2025-06-20', 'active', 3),

(2, 'Full Stack Developer Intern',
   'Build end-to-end features for our SaaS platform. React frontend, Node.js backend, MongoDB/MySQL databases.',
   'Mumbai', 0, 25000, 35000, 6, 'portal', '2025-08-01', 'active', 2);

-- Internship Skills Required
INSERT INTO internship_skills (internship_id, skill_id) VALUES
(1, 2),   -- Frontend: JavaScript
(1, 3),   -- Frontend: React
(1, 8),   -- Frontend: HTML/CSS
(1, 11),  -- Frontend: REST APIs
(2, 4),   -- Backend: Node.js
(2, 5),   -- Backend: MySQL
(2, 11),  -- Backend: REST APIs
(2, 9),   -- Backend: Git
(3, 1),   -- DS: Python
(3, 6),   -- DS: ML
(3, 7),   -- DS: Data Analysis
(3, 5),   -- DS: MySQL
(4, 2),   -- FS: JavaScript
(4, 3),   -- FS: React
(4, 4),   -- FS: Node.js
(4, 5);   -- FS: MySQL

-- Applications
INSERT INTO applications (student_id, internship_id, cover_letter, status) VALUES
(1, 1, 'I am an experienced React developer with 2 years of project experience...', 'shortlisted'),
(1, 2, 'I have strong Node.js skills and love backend development...', 'applied'),
(3, 3, 'Data science is my passion. I have worked on 5+ ML projects...', 'applied');

-- Saved Jobs
INSERT INTO saved_jobs (student_id, internship_id) VALUES
(1, 3),
(1, 4),
(2, 1),
(3, 4);

-- Notifications
INSERT INTO notifications (user_id, type, message) VALUES
(1, 'status_update',        'Your application for "Frontend Developer Intern" has been shortlisted!'),
(1, 'new_match',            'New internship matching your skills: Full Stack Developer Intern'),
(4, 'application_received', 'New application received for Frontend Developer Intern from Alice Sharma');
