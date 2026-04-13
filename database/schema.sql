-- ============================================================
-- Smart Internship Portal - MySQL Database Schema (3NF)
-- Author: Smart Internship Portal
-- ============================================================

CREATE DATABASE IF NOT EXISTS internship_portal;
USE internship_portal;

-- ============================================================
-- TABLE: users (base authentication table)
-- ============================================================
CREATE TABLE users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,           -- bcrypt hash
    role        ENUM('student','company','admin') NOT NULL DEFAULT 'student',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role  (role)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: students (1-to-1 with users where role='student')
-- ============================================================
CREATE TABLE students (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    college         VARCHAR(255),
    degree          VARCHAR(100),
    branch          VARCHAR(100),
    graduation_year YEAR,
    cgpa            DECIMAL(4,2),
    resume_url      VARCHAR(500),
    bio             TEXT,
    linkedin_url    VARCHAR(300),
    github_url      VARCHAR(300),
    profile_photo   VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_graduation_year (graduation_year)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: companies (1-to-1 with users where role='company')
-- ============================================================
CREATE TABLE companies (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    company_name    VARCHAR(255) NOT NULL,
    industry        VARCHAR(100),
    website         VARCHAR(300),
    description     TEXT,
    logo_url        VARCHAR(500),
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'India',
    is_verified     TINYINT(1) DEFAULT 0,        -- Admin approval
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_company_name (company_name),
    INDEX idx_industry (industry)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: skills (master skill list)
-- ============================================================
CREATE TABLE skills (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    category   VARCHAR(100),                     -- e.g. 'Programming', 'Design'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_skill_name (name)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: student_skills (many-to-many: students <-> skills)
-- ============================================================
CREATE TABLE student_skills (
    student_id  INT UNSIGNED NOT NULL,
    skill_id    INT UNSIGNED NOT NULL,
    level       ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
    PRIMARY KEY (student_id, skill_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id)   REFERENCES skills(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: internships (posted by companies OR cached from API)
-- ============================================================
CREATE TABLE internships (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id      INT UNSIGNED,               -- NULL if external/API
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    location        VARCHAR(255),
    is_remote       TINYINT(1) DEFAULT 0,
    stipend_min     INT UNSIGNED DEFAULT 0,
    stipend_max     INT UNSIGNED DEFAULT 0,
    duration_months TINYINT UNSIGNED DEFAULT 3,
    type            ENUM('portal','external') DEFAULT 'portal',
    external_url    VARCHAR(500),               -- LinkedIn/Internshala link
    external_source VARCHAR(100),               -- e.g. 'adzuna','linkedin'
    external_id     VARCHAR(255),               -- ID from external API
    deadline        DATE,
    status          ENUM('active','closed','pending_approval') DEFAULT 'active',
    openings        INT UNSIGNED DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    INDEX idx_location  (location),
    INDEX idx_stipend   (stipend_min, stipend_max),
    INDEX idx_deadline  (deadline),
    INDEX idx_type      (type),
    INDEX idx_status    (status)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: internship_skills (many-to-many: internships <-> skills)
-- ============================================================
CREATE TABLE internship_skills (
    internship_id INT UNSIGNED NOT NULL,
    skill_id      INT UNSIGNED NOT NULL,
    PRIMARY KEY (internship_id, skill_id),
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id)      REFERENCES skills(id)      ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: applications (students applying to internships)
-- Uses TRANSACTION to maintain integrity
-- ============================================================
CREATE TABLE applications (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id     INT UNSIGNED NOT NULL,
    internship_id  INT UNSIGNED NOT NULL,
    cover_letter   TEXT,
    status         ENUM('applied','shortlisted','rejected','hired') DEFAULT 'applied',
    applied_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_internship (student_id, internship_id),  -- prevent duplicate apps
    FOREIGN KEY (student_id)    REFERENCES students(id)     ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internships(id)  ON DELETE CASCADE,
    INDEX idx_status      (status),
    INDEX idx_applied_at  (applied_at)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: saved_jobs (student bookmarks)
-- ============================================================
CREATE TABLE saved_jobs (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id    INT UNSIGNED NOT NULL,
    internship_id INT UNSIGNED NOT NULL,
    saved_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saved (student_id, internship_id),
    FOREIGN KEY (student_id)    REFERENCES students(id)    ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: api_cache (cache external job API results)
-- ============================================================
CREATE TABLE api_cache (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cache_key  VARCHAR(255) NOT NULL UNIQUE,
    data       LONGTEXT NOT NULL,               -- JSON blob
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: notifications (email/in-app notification log)
-- ============================================================
CREATE TABLE notifications (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    type        ENUM('application_received','status_update','new_match','system') NOT NULL,
    message     TEXT NOT NULL,
    is_read     TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read)
) ENGINE=InnoDB;

-- ============================================================
-- STORED PROCEDURE: apply_for_internship (with TRANSACTION)
-- ============================================================
DELIMITER $$
CREATE PROCEDURE apply_for_internship(
    IN p_student_id    INT UNSIGNED,
    IN p_internship_id INT UNSIGNED,
    IN p_cover_letter  TEXT,
    OUT p_result       VARCHAR(100)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'error';
    END;

    START TRANSACTION;

    -- Check if already applied
    IF EXISTS (
        SELECT 1 FROM applications
        WHERE student_id = p_student_id AND internship_id = p_internship_id
    ) THEN
        SET p_result = 'already_applied';
        ROLLBACK;
    ELSE
        INSERT INTO applications (student_id, internship_id, cover_letter)
        VALUES (p_student_id, p_internship_id, p_cover_letter);

        -- Insert notification for company
        INSERT INTO notifications (user_id, type, message)
        SELECT c.user_id,
               'application_received',
               CONCAT('New application received for internship ID ', p_internship_id)
        FROM internships i
        JOIN companies c ON i.company_id = c.id
        WHERE i.id = p_internship_id;

        SET p_result = 'success';
        COMMIT;
    END IF;
END$$
DELIMITER ;

-- ============================================================
-- VIEW: application_details (frequently used JOIN)
-- ============================================================
CREATE VIEW application_details AS
SELECT
    a.id              AS application_id,
    a.status,
    a.applied_at,
    s.id              AS student_id,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    u_s.email         AS student_email,
    s.college,
    s.cgpa,
    s.resume_url,
    i.id              AS internship_id,
    i.title           AS internship_title,
    i.location,
    i.stipend_min,
    i.stipend_max,
    c.company_name,
    c.id              AS company_id
FROM applications a
INNER JOIN students s        ON a.student_id    = s.id
INNER JOIN users u_s         ON s.user_id       = u_s.id
INNER JOIN internships i     ON a.internship_id = i.id
LEFT  JOIN companies c       ON i.company_id    = c.id;

-- ============================================================
-- VIEW: internship_match_score (skill overlap count)
-- Used by recommendation engine
-- ============================================================
CREATE VIEW internship_skill_match AS
SELECT
    ss.student_id,
    is2.internship_id,
    COUNT(*) AS matched_skills
FROM student_skills ss
INNER JOIN internship_skills is2 ON ss.skill_id = is2.skill_id
GROUP BY ss.student_id, is2.internship_id;
