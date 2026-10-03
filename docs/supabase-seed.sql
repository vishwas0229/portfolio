-- Seed the database with the portfolio content currently shown by the static site.
-- Run this after docs/supabase.sql.

insert into public.projects
  (title, slug, summary, description, tech_stack, repository_url, demo_url, featured, display_order, published)
values
  (
    'DSA Problems',
    'dsa-problems',
    'C programming practice covering arrays, sorting/searching, linked lists, stacks, and student record management.',
    'Includes hands-on implementations of insertion, deletion, traversal, sorting, searching, linked-list partitioning, and stack operations.',
    array['C','Data Structures & Algorithms'],
    'https://portfolio.postlyfi.in/DSA_Problems',
    null,
    false,
    10,
    true
  ),
  (
    'e-Karamchari',
    'e-karamchari',
    'Employee Self-Service / HR management portal for employee and admin workflows.',
    'Includes leave management, grievances, attendance, salary slips, 2FA, reports, and an AI assistant/chatbot.',
    array['HTML','CSS','JavaScript','PHP','MySQL','Apache','2FA'],
    'https://portfolio.postlyfi.in/e-Karamchari',
    'https://ekaramchari.netlify.app/',
    true,
    20,
    true
  ),
  (
    'Portfolio',
    'portfolio',
    'Interactive 3D portfolio website with animated navigation and a responsive Simple View.',
    'Built to showcase projects, education, skills, certifications, and developer links in an interactive experience.',
    array['Three.js','GSAP','JavaScript','HTML','CSS'],
    'https://github.com/vishwas0229/portfolio',
    'https://portfolio.postlyfi.in/',
    true,
    30,
    true
  )
on conflict (slug) do nothing;

insert into public.certificates
  (title, issuer, issued_on, description, display_order, published)
values
  (
    'Diploma in Computer Applications',
    'Delhi Institute of Computer Education, New Delhi',
    null,
    'CGPA: 9.857',
    10,
    true
  ),
  (
    '5-Day AI Agents Intensive Course with Google',
    'Kaggle × Google',
    null,
    'AI Agents intensive course / badge.',
    20,
    true
  ),
  (
    'React Native Course',
    'Tutedude',
    '2026-06-09',
    'Successfully completed the React Native course.',
    30,
    true
  ),
  (
    'Cyber Security Course',
    'WsCube Tech',
    null,
    'Completed Cyber Security training.',
    40,
    true
  ),
  (
    'Data Analytics using Power BI',
    'Sirifort Institute of Management Studies',
    null,
    '2-week (40-hour) vocational training; certificate awarded for 94 marks.',
    50,
    true
  ),
  (
    'SnapAR Hands-on Augmented Reality Lens Creation Workshop',
    'Arexa & Bharat XR · Snap AR',
    '2025-10-01',
    'Lens Studio workshop.',
    60,
    true
  ),
  (
    'Hack4Delhi – Unstop Holiday Fest 2025',
    'Netaji Subhas University of Technology (NSUT), Delhi',
    null,
    'Participation certificate.',
    70,
    true
  )
on conflict do nothing;
