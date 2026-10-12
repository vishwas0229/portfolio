# MySQL to Firestore migration

## Before running
- Back up the source MySQL database first.
- Set `DATABASE_URL` privately in the shell; never commit credentials.
- Ensure Firestore is enabled in project `portfolio-562da`.
- Authenticate Firebase Admin through Application Default Credentials (locally, `gcloud auth application-default login`) or use the Cloud Run runtime service account.
- Review the source row counts from the dry run before writing.

## Dry run (no Firestore writes)
```bash
npm run migrate:firestore
```

## Import
```bash
npm run migrate:firestore -- --apply
```

The importer handles the existing `projects`, `certificates`, `contact_messages`, `analytics_events`, and `admins` tables. It stops if a destination collection is already populated. The optional `--overwrite` flag merge-writes matching document IDs, and should only be used after reviewing destination data; it does not delete destination-only documents.

Keep the MySQL database and backup until you verify collection counts, project/certificate reads, contact submissions, analytics, admin login/session, and admin CRUD. Do not switch production traffic or remove Netlify handlers until those checks pass.
