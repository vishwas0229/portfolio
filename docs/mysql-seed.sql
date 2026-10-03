USE portfolio;

-- Local bootstrap admin. Authentication reads this record from MySQL.
-- Password: Admin@12345678 (change it before exposing the stack beyond localhost).
INSERT INTO admins
  (email, password_hash, role, active, session_version)
VALUES
  ('admin@localhost','pbkdf2$sha256$210000$R6ZX5t5mJZPuovaCNoLx_A$9yfNalu_0ZGP8WkEDWKSxfizBinvZVdPNqkHqUV48M0','admin',TRUE,1)
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  active = VALUES(active),
  session_version = 1;

INSERT INTO projects
  (title, slug, summary, description, tech_stack, repository_url, demo_url, featured, display_order, published)
VALUES
  ('DSA Problems','dsa-problems',
   'C programming practice covering arrays, sorting/searching, linked lists, stacks, and student record management.',
   'Hands-on implementations of insertion, deletion, traversal, sorting, searching, linked-list partitioning, and stack operations.',
   JSON_ARRAY('C','Data Structures & Algorithms'),
   'https://github.com/vishwas0229/DSA_Problems',
   NULL, FALSE, 10, TRUE),
  ('e-Karamchari','e-karamchari',
   'Employee Self-Service / HR management portal for employee and admin workflows.',
   'Includes leave management, grievances, attendance, salary slips, 2FA, reports, and an AI assistant/chatbot.',
   JSON_ARRAY('HTML','CSS','JavaScript','PHP','MySQL','Apache','2FA'),
   'https://github.com/vishwas0229/e-Karamchari',
   'https://ekaramchari.netlify.app/', TRUE, 20, TRUE),
  ('Portfolio','portfolio',
   'Interactive 3D portfolio website with animated navigation and a responsive Simple View.',
   'Built to showcase projects, education, skills, certifications, and developer links in an interactive experience.',
   JSON_ARRAY('Three.js','GSAP','JavaScript','HTML','CSS'),
   'https://github.com/vishwas0229/portfolio',
   'https://portfolio.postlyfi.in/', TRUE, 30, TRUE)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  summary = VALUES(summary),
  description = VALUES(description),
  tech_stack = VALUES(tech_stack),
  repository_url = VALUES(repository_url),
  demo_url = VALUES(demo_url),
  featured = VALUES(featured),
  display_order = VALUES(display_order),
  published = VALUES(published);

INSERT INTO certificates
  (title, issuer, issued_on, credential_url, image_url, description, display_order, published)
VALUES
  ('Diploma in Computer Applications','Delhi Institute of Computer Education, New Delhi',NULL,NULL,NULL,'CGPA: 9.857',10,TRUE),
  ('5-Day AI Agents Intensive Course with Google','Kaggle × Google',NULL,NULL,NULL,'AI Agents intensive course / badge.',20,TRUE),
  ('React Native Course','Tutedude','2026-06-09',NULL,NULL,'Successfully completed the React Native course.',30,TRUE),
  ('Cyber Security Course','WsCube Tech',NULL,NULL,NULL,'Completed Cyber Security training.',40,TRUE),
  ('Data Analytics using Power BI','Sirifort Institute of Management Studies',NULL,NULL,NULL,'2-week (40-hour) vocational training; certificate awarded for 94 marks.',50,TRUE),
  ('SnapAR Hands-on Augmented Reality Lens Creation Workshop','Arexa & Bharat XR · Snap AR','2025-10-01',NULL,NULL,'Lens Studio workshop.',60,TRUE),
  ('Hack4Delhi – Unstop Holiday Fest 2025','Netaji Subhas University of Technology (NSUT), Delhi',NULL,NULL,NULL,'Participation certificate.',70,TRUE)
ON DUPLICATE KEY UPDATE
  issuer = VALUES(issuer),
  issued_on = VALUES(issued_on),
  description = VALUES(description),
  display_order = VALUES(display_order),
  published = VALUES(published);
