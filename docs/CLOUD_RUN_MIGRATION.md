# Cloud Run backend migration

This repository is being migrated from Netlify Functions to a standalone Node.js API on Cloud Run while Firebase Hosting continues to serve static assets.

## Migration status

- API handlers are copied into `api/functions/`; the server loads handlers from this new location.
- A temporary compatibility route for legacy `/.netlify/functions/*` paths is retained while the frontend is switched.
- The original `netlify/functions/` files remain temporarily as a rollback source. Do not delete them until the Cloud Run deployment and all API tests are verified.
- Firebase Hosting excludes `api/` from static public files.

## Service requirements

The service uses Node.js 20+, listens on `process.env.PORT`, and requires a reachable MySQL database via `DATABASE_URL`. Set `DATABASE_URL` and admin/session secrets in Cloud Run environment configuration or Secret Manager; never commit credentials.

Health endpoints:
- `GET /api/health` (liveness)
- `GET /api/health?deep=1` (database readiness)

Main API endpoints:
- `/api/projects`
- `/api/certificates`
- `/api/contact`
- `/api/analytics`
- `/api/admin/*`
- `/api/github`
- `/api/leetcode`

## Safe cutover order

1. Deploy the container to Cloud Run and configure its database connection.
2. Verify both health endpoints, then test projects, certificates, contact submissions, analytics, and admin authentication.
3. Add Firebase Hosting rewrites to the Cloud Run service only after that service exists.
4. Switch the frontend's legacy GitHub/LeetCode URLs to `/api/github` and `/api/leetcode`.
5. Run the full test suite and verify the custom domain.
6. Remove legacy Netlify URLs, the compatibility route, and the old Netlify files only after successful production verification.
