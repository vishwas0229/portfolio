# 🚀 Portfolio

An immersive 3D portfolio experience designed to go beyond traditional websites and feel more like an interactive environment.

---

## ✨ Overview

This project is built as an interactive 3D desk scene where users can explore, interact, and experience my work in a unique way.

Inspired by indie game-style environments, every object in the scene has a purpose — making the portfolio feel engaging rather than static.

---

## 🎮 Features

- 🖱️ Interactive 3D desk environment  
- 📂 Clickable objects with meaningful interactions  
- 🎯 Built-in mini-game with multiple difficulty levels  
- 🤖 Smart AI opponent for engaging gameplay  
- 📄 "Simple View" mode for clean resume experience  
- 📱 Optimized mobile experience with custom camera angles  
- 💬 Feedback system using Netlify Forms  

---

## 🧠 What I Explored

While building this project, I focused on:

- 3D web development  
- Camera transitions and animations  
- Interactive object logic  
- Responsive UI design  
- User interaction & experience design  

---

## 🛠️ Tech Stack

- HTML, CSS, JavaScript  
- Three.js  
- GSAP (Animations)  
- Font Awesome  
- Google Fonts  
- Netlify Forms  

---

## 🎯 Purpose

The goal of this project is to create a portfolio that feels like an experience rather than just a website — something users can explore instead of simply scrolling through.

---

## ⚠️ Note

- For the best experience, use a desktop browser 

---

## 🎥 Demo Video

👉 .[Click here](https://lnkd.in/p/dWTi2yV8)

## 🔗 Live Demo

👉 [Click here](https://portfolio.postlyfi.in/)

---

## 📌 Status

🚧 Phase 1 Completed — More features and improvements coming soon.

---

## 👤 Author

**Rahul**
Aspiring App Developer | 3D Web Enthusiast  

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!


## Rahul Profile

- Goal: App Development
- GitHub: https://github.com/vishwas0229
- Projects: DSA_Problems, e-Karamchari
- Focus: C/C++, Python, React Native, PHP, JavaScript, MySQL, Cyber Security, AI/ML


## Projects

- [DSA Problems](https://github.com/vishwas0229/DSA_Problems)
- [e-Karamchari](https://github.com/vishwas0229/e-Karamchari) — [Live Demo](https://ekaramchari.netlify.app/)
- [Portfolio](https://github.com/vishwas0229/portfolio) — [Live Demo](https://rahulport-folio.netlify.app/)


## Backend

The portfolio now includes a serverless Node.js backend on Netlify Functions.

### API
- `GET /api/health` — health/status
- `GET /api/projects` — published projects
- `GET /api/certificates` — published certificates
- `POST /api/contact` — validated contact submission with database persistence and optional SMTP notification
- `POST /api/analytics` — privacy-conscious event ingestion
- `/api/admin/*` — authenticated admin operations for messages, projects, certificates and analytics

### Data & security
Supabase/PostgreSQL is used for persistent data. The service-role key, SMTP credentials, admin password hash and session secret are server-side environment variables only.

Admin sessions use signed HttpOnly cookies plus a CSRF token. Public write endpoints use input validation, honeypot support and rate limiting.

Database setup files:
- `docs/supabase.sql`
- `docs/supabase-seed.sql`

Admin console: `/admin/`


## 🐳 Docker — Local Full Stack

The repository is Docker-first for local development. It runs the static portfolio, Node API runtime, and PostgreSQL database together.

### Start

```bash
docker compose up --build
```

Open:

```
http://localhost:8888/
http://localhost:8888/admin/
http://localhost:8888/api/health
```

The Docker stack uses:

- Node.js 20 application container
- PostgreSQL 16 container
- Persistent `postgres_data` Docker volume
- Automatic database schema + seed initialization on first database creation
- Native PostgreSQL access through `pg`
- The same Netlify Function modules used by the production backend

The local admin login defaults to:

```
Email: admin@localhost
Password: Admin@12345678
```

This default is intended for localhost development only. Change the credentials before exposing the container beyond your own machine.

### Useful commands

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you intentionally want to delete the local PostgreSQL volume and start with an empty database.

### Configuration

You can override Compose defaults from your shell or a local `.env` file. Examples:

```env
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD_HASH=<generated-with-scripts/generate-password-hash.mjs>
ADMIN_SESSION_SECRET=<long-random-secret>

SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_FROM=
CONTACT_NOTIFICATION_EMAIL=
```

For local Docker, `DATABASE_URL`, `PORT`, and the internal PostgreSQL credentials are already wired by `docker-compose.yml`.

### Architecture

```
Browser
   │
   ▼
Node local runtime :8888
   ├── /               → static portfolio
   ├── /admin/         → admin console
   └── /api/*          → existing Netlify Function handlers
                      │
                      ▼
                 PostgreSQL :5432
```

The production deployment can continue using Netlify Functions + Supabase REST; Docker uses the same function modules with the local PostgreSQL adapter.
