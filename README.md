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

MySQL is used for persistent backend data. The database connection is server-side only.

Admin sessions use signed HttpOnly cookies plus a CSRF token. Public write endpoints use input validation, honeypot support and rate limiting.

Database setup files:
- `docs/mysql.sql`
- `docs/mysql-seed.sql`

Admin console: `/admin/`


## 🐳 Docker — Local Full Stack

The repository is Docker-first for local development. It runs the static portfolio, Node API runtime, and MySQL together.

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
- MySQL 8.4.11 container
- Persistent `mysql_data` Docker volume
- Automatic MySQL schema + seed initialization on first database creation
- Native MySQL access through `mysql2`
- The same backend function modules used by the production runtime

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
docker compose exec db mysql -uportfolio -pportfolio_dev portfolio
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you intentionally want to delete the local MySQL volume and start with a fresh database.

### Configuration

For Docker, the application uses:

```env
DATABASE_URL=mysql://portfolio:portfolio_dev@db:3306/portfolio
DB_POOL_MAX=10
```

Admin and optional SMTP settings can be overridden from a local `.env` file.

### Architecture

```
Browser
   │
   ▼
Node local runtime :8888
   ├── /               → static portfolio
   ├── /admin/         → admin console
   └── /api/*          → backend handlers
                      │
                      ▼
                  MySQL :3306
```

The same application backend can point to any reachable MySQL 8.x server by changing `DATABASE_URL`.
