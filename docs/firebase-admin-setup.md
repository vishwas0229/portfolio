# Firebase Admin Login and Firestore Setup

This portfolio uses Firebase Authentication for the admin email/password and Cloud Firestore for portfolio data and the admin allowlist. The browser never gets database admin credentials. The backend verifies Firebase ID tokens, checks the matching `admins` document, then issues a short-lived, HttpOnly admin session.

## 1. Confirm the Firebase project

The repository's `.firebaserc` points to project `portfolio-562da`. Use that same project in every step below.

Open [Firebase Console](https://console.firebase.google.com/) and select `portfolio-562da`.

## 2. Enable admin sign-in

1. Open **Build → Authentication → Sign-in method**.
2. Enable **Email/Password** and save.
3. Under **Authentication → Settings → Authorized domains**, ensure `portfolio.postlyfi.in` is listed. Add it if needed.
4. Under **Authentication → Users**, choose **Add user** and create the admin email/password. Do not add a public sign-up form to the portfolio.

The login page uses Firebase Hosting's `/__/firebase/init.json` to initialize the public web app. Serve `/admin/` through Firebase Hosting for the production login flow.

## 3. Create the Firestore database

1. Open **Build → Firestore Database** and create the database in the project.
2. Keep the repository's `firestore.rules` locked down (all client reads/writes denied). The API uses Firebase Admin from the trusted server; Admin SDK requests bypass Firestore Security Rules and are controlled by Google Cloud IAM.
3. In Firestore, create a collection named `admins`.
4. Use the Firebase Authentication user's **UID** as the document ID. Add these fields:

| Field | Type | Value |
| --- | --- | --- |
| `id` | string | same UID |
| `email` | string | same email as the Firebase Auth user, lowercase |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `session_version` | number | `1` |

No password or password hash belongs in this document. The login API authorizes only an active `admin` document whose email matches the signed-in Firebase account.

The other collections (`projects`, `certificates`, `contact_messages`, `analytics_events`) are created automatically when the API first writes to them.

## 4. Give the Netlify API access to Firebase

The API at `api.postlyfi.in` runs on Netlify, outside Google's managed runtime. It therefore needs a private service-account credential.

1. In Firebase Console, open **Project settings → Service accounts** and choose **Generate new private key**.
2. In Netlify, open the site that deploys the API functions, then **Site configuration → Environment variables**.
3. Add `FIREBASE_SERVICE_ACCOUNT_JSON` with the complete downloaded JSON value. Keep it private; never commit it, paste it into the browser, or add it to a public build variable.
4. Add `GOOGLE_CLOUD_PROJECT=portfolio-562da`.
5. Ensure `PORTFOLIO_SITE_URL=https://portfolio.postlyfi.in`, `CORS_ORIGIN=https://portfolio.postlyfi.in`, and a random `ADMIN_SESSION_SECRET` of at least 32 characters are set.
6. Redeploy the Netlify site so the functions receive the variables.

The code uses Google Application Default Credentials when no JSON key is provided (for Google-managed runtimes), and uses `FIREBASE_SERVICE_ACCOUNT_JSON` for Netlify. Restrict the service account's IAM access to the Firebase Auth and Firestore operations this API needs. Rotate the key immediately if it is ever exposed.

## 5. Verify the complete flow

1. Open `https://portfolio.postlyfi.in/admin/`.
2. Sign in with the Firebase Authentication admin email/password.
3. The backend verifies the ID token, finds the matching `admins` document, and opens the console.
4. Submit a test contact message from the public portfolio and confirm it appears in the Admin Console.
5. Open **Account → Send password reset email** and check the admin inbox.
6. If sign-in says the account is unauthorized, compare the Auth user's email with `admins/{uid}.email`, and confirm `role=admin` and `active=true`.
7. If the page reports Firebase Authentication is unavailable, confirm the admin page is served by Firebase Hosting and the correct Firebase project is selected. If the API reports Firebase is not configured, check Netlify's service-account environment variable and deployment logs.

## Local development

For local Node/Docker runs, set `GOOGLE_CLOUD_PROJECT`, `FIREBASE_SERVICE_ACCOUNT_JSON`, and `ADMIN_SESSION_SECRET` in the private local `.env`. Do not use a production service-account key in a shared or untrusted machine. The local-only legacy login flow remains available when the site runs on localhost.
