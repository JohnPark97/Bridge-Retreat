# Bridge Retreat — Setup Guide

One-time setup for organizers. Time required: ~15 minutes.

You'll create a **private** Google Sheet (the roster + check-in database) and an
Apps Script web app that reads + writes the Sheet on behalf of the app. The
Sheet itself is never published — names, birthdays, and room assignments stay
private. All reads and writes flow through a single SECRET-protected proxy.

## 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new) and rename the file to **Bridge Retreat 2026**.
2. Rename the first tab to `roster` (lowercase).
3. Paste this header row into row 1:
   `id, korean_name, birthday, room, floor, cell_name, is_leader, checked_in_at`
4. Add real attendees. Format notes:
   - `id`: 1, 2, 3 …
   - `birthday`: `MM/DD/YYYY` (e.g. `12/29/1981`). To prevent Sheets from
     auto-formatting as a date, select the column → **Format → Number → Plain text**
     before typing. (If you skip this, the Apps Script will normalize on read,
     but it's cleaner to lock the format upfront.)
   - `cell_name`: e.g. `1조`, `2조` — must match a row in the `cells` tab
   - `is_leader`: `TRUE` or `FALSE`
   - `checked_in_at`: leave blank (the app fills it in)
5. Add a second tab named `cells`. Headers in row 1: `cell_name, meeting_room`.
   Each row is one small group, e.g. `1조 | 201호`.
6. **Do NOT** publish the Sheet. Keep it private. Share with co-organizers via
   **Share → Add people** if needed (granting them edit access on the Sheet
   directly).

See [data/sample-roster.csv](data/sample-roster.csv) and
[data/sample-cells.csv](data/sample-cells.csv) for the exact shape.

## 2. Set up the Apps Script proxy

1. From the Sheet menu: **Extensions → Apps Script**
2. Delete the placeholder code in `Code.gs`, paste the full contents of
   [apps-script/checkin.gs](apps-script/checkin.gs)
3. Save (⌘S / Ctrl+S). Name the project "Bridge Retreat Writer".
4. **Project Settings** (gear icon) → **Script Properties** → **Add property**
   - Name: `SECRET`
   - Value: a long random string. Generate one with:
     ```
     openssl rand -hex 32
     ```
     Save this — you'll paste it into `config.js` in step 3.
5. **Deploy → New deployment**:
   - Type: **Web app**
   - Description: "Bridge Retreat Proxy v1"
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, authorize when prompted. You'll see "Google hasn't verified
   this app" — that's expected for personal scripts. Click **Advanced → Go to
   Bridge Retreat Writer (unsafe)** → **Allow**.
7. Copy the **Web app URL** — `https://script.google.com/macros/s/.../exec`.

### Updating the script later

Apps Script deployments are versioned. To push code changes without changing
your `/exec` URL: **Deploy → Manage deployments → ✏️ (Edit)** → pick **New
version** in the version dropdown → **Deploy**. The URL stays identical;
visitors immediately see the new code.

## 3. Wire secrets into the deploy

**Important:** This repo is meant to be public on GitHub. Real secret values
must NEVER live in a committed file. Two paths to a working `config.js`:

### Local dev — copy the template

```bash
cp assets/js/config.template.js assets/js/config.js
```

Then edit `assets/js/config.js` and fill in your three values:
- `APPS_SCRIPT_URL` (from step 2)
- `APPS_SCRIPT_SECRET` (the random string from step 2)
- `ADMIN_PASSWORD` (your choice — gates `/admin.html`)

`assets/js/config.js` is in `.gitignore` — git won't track it. Don't try to
force-add it.

### Production — GitHub Repository Secrets

In your GitHub repo: **Settings → Secrets and variables → Actions →
New repository secret**. Add three secrets with the exact names below:

| Name | Value |
|---|---|
| `APPS_SCRIPT_URL`    | The full `/exec` URL from step 2 |
| `APPS_SCRIPT_SECRET` | The random string from step 2 (must match the `SECRET` Script Property) |
| `ADMIN_PASSWORD`     | Your choice — gates `/admin.html` |

The deploy workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
reads these at build time and writes a real `config.js` from
`config.template.js` before uploading to Pages. The repo source code never
contains the values; the deployed site does.

GitHub auto-redacts secret values from workflow logs (they appear as `***`),
and they're encrypted at rest. They're only decrypted inside running workflows.

**If you ever accidentally commit a real secret**, rotation is the only fix
(git history is forever, even after a force-push):

1. Generate a new value (e.g. `openssl rand -hex 32` for the SECRET)
2. Update the corresponding GitHub Secret
3. For `APPS_SCRIPT_SECRET`: also update the `SECRET` Script Property in the
   Apps Script editor
4. For `APPS_SCRIPT_URL`: deploy a new version of the Apps Script and update
   the GitHub Secret with the new URL
5. Re-run the deploy workflow to push the rotated value

## 4. Test locally

From the project root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 on your phone (same Wi-Fi: `http://<your-mac-ip>:8000`).
Log in with a name + birthday from your roster. Verify:

- Welcome page shows name, room, today's schedule, theme verse
- Tap **체크인 완료** → toast appears, overlay dismisses
- Refresh the Google Sheet → `checked_in_at` for that row populated within seconds
- Reload the page → overlay does not reappear (already checked in)
- Visit `/admin.html`, enter `ADMIN_PASSWORD` → see stats + per-cell breakdown + roster search

## 5. Deploy to GitHub Pages

1. **Add the 3 secrets** under Settings → Secrets and variables → Actions (see step 3 above)
2. **Settings → Pages → Source**: select **GitHub Actions**
3. Push to `main`. The workflow at `.github/workflows/deploy.yml` runs:
   - Generates `assets/js/config.js` from the template + your repo secrets
   - Uploads the entire repo as a Pages artifact
   - Deploys

If the workflow fails with `APPS_SCRIPT_URL secret is not set`, you forgot to
add the GitHub secrets — the build aborts loudly rather than deploying a
broken `config.js`.

Site goes live at `https://<username>.github.io/<repo>/`.

## Admin dashboard (`/admin.html`)

Operators visit `/admin.html` on their phone, enter `ADMIN_PASSWORD`, and see:

- **체크인 현황** — total checked-in count, percentage, and a countdown to the next main session
- **그룹별 체크인** — per-cell breakdown with progress bars
- **명단** — searchable roster, un-checked-in members surfaced first

The admin session is `sessionStorage` (per-tab). Closing the tab ends the
session. The **로그아웃** button at the bottom clears it sooner.

## Troubleshooting

**"명단에서 찾을 수 없어요" on login** — Check that name (한글) and birth
month/day match a row in the roster sheet exactly. Year is stored but not
matched.

**"연결에 문제가 있어요" toast** — Apps Script returned an error. Open the
Apps Script editor → **Executions** tab → look for the failed run. Common
causes:
- `SECRET` Script Property doesn't match `APPS_SCRIPT_SECRET` in config.js
- Sheet tab isn't named exactly `roster` or `cells` (case-sensitive)
- Headers don't match expected names

**Roster shows but admin says everyone is unchecked** — Check that the
`checked_in_at` column in your sheet has the expected header spelling. The
app reads by column name, not position.

**CORS errors in browser console** — Make sure the Apps Script is deployed
with **Anyone** access (not "Anyone with Google account").

**Session won't persist after closing the app** — localStorage is per-origin.
Switching between `localhost`, the LAN IP, and the Pages URL each have their
own session. Pick one for testing.

## Day-of-retreat operations

- **Add a late-arriving attendee**: edit the roster sheet directly. The app
  reads from the Sheet on each page load — newcomers can log in immediately.
- **Fix a wrong room or birthday**: edit the cell directly.
- **See who's checked in**: filter the `checked_in_at` column, or use the
  admin dashboard's roster search (un-checked first).
- **Reset a check-in for testing**: clear the cell.
