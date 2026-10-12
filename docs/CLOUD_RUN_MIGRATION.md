# Firestore and Cloud Run migration

## Data layer

The API uses the Firebase Admin SDK and Cloud Firestore. The server-side SDK authenticates with Application Default Credentials; on Cloud Run, attach a dedicated runtime service account with only the required Firestore permissions. Do not create or commit service-account JSON keys.

Collections preserve the existing logical table names: `projects`, `certificates`, `contact_messages`, `analytics_events`, and `admins`. Existing MySQL data is not copied automatically. Before production cutover, export the current MySQL records and import them into these collections with a one-time migration script; back up the source database first.

## Deploy

1. Enable Cloud Firestore in project `portfolio-562da` and create the database in the intended region.
2. Configure Firestore security rules to deny direct client access to private collections. The Cloud Run service uses Admin SDK and IAM, not client rules.
3. Grant the Cloud Run runtime service account the minimum Firestore access it needs.
4. Build and deploy the API to Cloud Run. It listens on `process.env.PORT`.
5. Verify `/api/health`, projects, certificates, contact, analytics and admin authentication before routing the public site to it.
6. Add Firebase Hosting rewrites only after the Cloud Run URL is available and tested.
7. Remove Netlify references/files only after production verification.

## Important

- This change removes the API's MySQL driver dependency, but does not migrate existing MySQL data.
- Cloud Run's runtime identity must have permission to access Firestore and any other required Google Cloud services.
- Use Secret Manager for `ADMIN_SESSION_SECRET` and other secrets. Never commit real values.
- Firestore usage and Cloud Run can incur charges; review project billing and budget alerts before production deployment.
