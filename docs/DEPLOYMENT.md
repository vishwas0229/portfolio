# Deployment guide

## Docker Compose (full stack)

The Docker Compose setup runs the portfolio's Node.js runtime and MySQL together. From the repository root:

1. Copy the example environment file and replace the example passwords/secrets.

   ```bash
   cp .env.docker.example .env
   ```

2. Use a URL-safe password for `MYSQL_PASSWORD` (letters and numbers are simplest because it is embedded in `DATABASE_URL`). Set a different strong `MYSQL_ROOT_PASSWORD` and a random `ADMIN_SESSION_SECRET` of at least 32 characters.

3. Start the stack:

   ```bash
   docker compose up --build -d
   docker compose ps
   docker compose logs -f app
   ```

4. Open `http://localhost:8888/` and verify `http://localhost:8888/api/health?deep=1`.

The database is persisted in the `mysql_data` volume. The bootstrap account in `docs/mysql-seed.sql` is for local development only; change its password before using the app in any shared environment. Do not expose the local Compose stack directly to the internet. The app port is bound to localhost by default.

To stop the stack, run `docker compose down`. Do not use `docker compose down -v` unless you intend to erase the local database volume.

## Firebase Hosting (static frontend)

The Firebase Hosting workflows target project `portfolio-562da` and deploy the static portfolio files. Pull requests from branches in this repository get a temporary Hosting preview; pushes to `main` deploy the static site to the live channel.

Required GitHub Actions secret:

- `FIREBASE_SERVICE_ACCOUNT_PORTFOLIO_562DA`: the service-account JSON key authorized to deploy to Firebase Hosting. Do not commit this key to the repository.

If the secret is missing or expired, from a trusted local checkout run:

```bash
firebase login
firebase use portfolio-562da
firebase init hosting:github
```

Follow the Firebase CLI prompts to configure the repository secret. Avoid replacing the existing workflow files unless you intend to regenerate the Firebase setup.

### Important backend distinction

Firebase Hosting serves static files; it does not run this repository's Node server, Netlify Functions, or MySQL database by itself. The current API handlers live under `netlify/functions/`, and the full-stack Docker setup runs them through `server/local-server.js`. Therefore a Firebase-only deployment serves the frontend, but API-dependent features (contact form, admin dashboard, analytics, projects/certificates APIs) need a separately deployed backend and database, with Firebase Hosting rewrites configured for that backend before switching production traffic. The existing Netlify deployment remains the backend-compatible option unless you deploy the API to a managed Node host such as Cloud Run.

The Firebase Hosting ignore list deliberately excludes backend source, SQL/schema/seed files, Docker configuration, tests, and package metadata from the public static upload.
