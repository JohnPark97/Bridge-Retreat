// This is a TEMPLATE — committed to the public repo with placeholders.
//
// Two paths to a real config.js (which is gitignored):
//
// 1. Local dev: copy this file to assets/js/config.js and fill in your values.
//    The app falls back to sample-data CSVs when values are placeholders, so
//    you can also leave them as-is and click through the app on fake data.
//
// 2. Production: GitHub Actions reads encrypted repo secrets and writes a real
//    config.js at deploy time. See .github/workflows/deploy.yml.
//
// Required GitHub Secrets (Settings → Secrets and variables → Actions):
//   APPS_SCRIPT_URL    — full /exec URL of the deployed Apps Script web app
//   APPS_SCRIPT_SECRET — long random string; must match the Script Property
//   ADMIN_PASSWORD     — phrase that gates /admin.html
export const CONFIG = {
  APPS_SCRIPT_URL:    'PASTE_APPS_SCRIPT_URL_HERE',
  APPS_SCRIPT_SECRET: 'PASTE_APPS_SCRIPT_SECRET_HERE',
  ADMIN_PASSWORD:     'CHANGE_ME_TO_RETREAT_TEAM_PASSWORD',

  SESSION_KEY:       'bridge_retreat_session',
  SESSION_DAYS:      3,
  ADMIN_SESSION_KEY: 'bridge_retreat_admin',
};
