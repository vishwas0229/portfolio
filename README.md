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
- 💬 MySQL-backed contact and feedback system  

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
- Node.js + MySQL  

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
- [Portfolio](https://github.com/vishwas0229/portfolio) — [Live Demo](https://portfolio.postlyfi.in/)


## Backend

The portfolio now includes a serverless Node.js backend on Netlify Functions.

### API
- `GET /api/health` — lightweight API health
- `GET /api/health?deep=1` — API + MySQL connectivity/readiness check
- `GET /api/projects` — published projects
- `GET /api/certificates` — published certificates
- `POST /api/contact` — validated contact submission with database persistence; messages are shown in the authenticated Admin Console
- `POST /api/analytics` — privacy-conscious event ingestion
- `/api/admin/*` — authenticated admin operations for messages, projects, certificates, analytics and account settings

### Data & security

MySQL is used for persistent backend data. The database connection is server-side only.

Admin accounts are stored in the MySQL `admins` table. The login API loads the account by email, verifies the PBKDF2 password hash, and creates a signed HttpOnly session plus a CSRF token. Admin profile credentials are not stored in `.env`.

Public write endpoints use input validation, honeypot support and rate limiting. Projects, certificates, contact messages and analytics are also stored in MySQL.

Database setup files:
- `docs/mysql.sql`
- `docs/mysql-seed.sql`

Admin console: `/admin/`

The **Account** tab lets the signed-in admin change the email/password stored in MySQL. The current password is required for every credential change, the new password is stored only as a PBKDF2 hash, and older sessions are invalidated.


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
- Deep application healthcheck that verifies MySQL connectivity
- Automatic MySQL schema + seed initialization on first database creation
- Native MySQL access through `mysql2`
- The same backend function modules used by the production runtime

The local MySQL seed creates one bootstrap admin:

```
Email: admin@localhost
Password: Admin@12345678
```

These credentials are stored in the seeded `admins` database record, not in `.env`. The bootstrap password is for localhost development only and should be changed in the database before exposing the container beyond your own machine.

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

For an existing MySQL volume created before admin/contact schema changes, run the applicable migration once. The contact cleanup migration removes legacy email-notification columns:

```bash
docker compose exec -T db mysql -uportfolio -pportfolio_dev portfolio < docs/mysql-migrate.sql
docker compose exec -T db mysql -uportfolio -pportfolio_dev portfolio < docs/mysql-contact-migrate.sql
```

### Configuration

For Docker, the application uses:

```env
DATABASE_URL=mysql://portfolio:portfolio_dev@db:3306/portfolio
DB_POOL_MAX=10
```

Infrastructure/security settings such as the MySQL connection and session secret are configured through `.env`. Admin account credentials and feedback messages are database data.

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


### Cloudflare Tunnel development

The Docker runtime is proxy-aware for Cloudflare Tunnel development. When HTTPS traffic arrives through Cloudflare, the app accepts the tunnel origin for same-origin admin requests and marks the admin cookies as `Secure`. You do not need to hardcode a temporary tunnel hostname in `CORS_ORIGIN`.