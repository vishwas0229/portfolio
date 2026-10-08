USE portfolio;

-- Link the existing MySQL admin account to the Firebase Authentication account.
-- Run this once after importing mysql.sql/mysql-seed.sql.
UPDATE admins
SET email = 'rahul@admin.com',
    session_version = session_version + 1
WHERE email = 'admin@localhost'
LIMIT 1;

-- Verify the result:
SELECT id, email, role, active, session_version
FROM admins
WHERE email = 'rahul@admin.com'
LIMIT 1;
