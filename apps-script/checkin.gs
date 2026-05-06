/**
 * Bridge Retreat — read + write proxy.
 * Bound to the retreat Google Sheet (which stays PRIVATE — never published).
 * Deployed as a web app with "Anyone" access. Every request body must include
 * the SECRET (Script Property) before any read or write.
 *
 * Three POST actions:
 *   { secret, action: 'read_roster' }  → { ok, rows: [...] }
 *   { secret, action: 'read_cells'  }  → { ok, rows: [...] }
 *   { secret, action: 'checkin', user_id } → { ok, checked_in_at, already? }
 */

const SECRET_PROP   = 'SECRET';   // set in Project Settings > Script Properties
const SHEET_ROSTER  = 'roster';
const SHEET_CELLS   = 'cells';
const COL_ID        = 'id';
const COL_BIRTHDAY  = 'birthday';
const COL_CHECKIN   = 'checked_in_at';

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROP);

    if (!secret || body.secret !== secret) {
      return json({ ok: false, err: 'auth' });
    }

    if (body.action === 'read_roster') {
      return json({ ok: true, rows: readSheet(SHEET_ROSTER) });
    }
    if (body.action === 'read_cells') {
      return json({ ok: true, rows: readSheet(SHEET_CELLS) });
    }
    if (body.action === 'checkin') {
      return checkin(String(body.user_id || ''));
    }
    return json({ ok: false, err: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, err: 'server_error', detail: String(err) });
  }
}

function doGet() {
  return json({ ok: true, message: 'Bridge Retreat proxy. POST only.' });
}

function checkin(userId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_ROSTER);
  if (!sheet) return json({ ok: false, err: 'no_sheet' });

  const data       = sheet.getDataRange().getValues();
  const headers    = data[0].map(String);
  const idCol      = headers.indexOf(COL_ID);
  const checkinCol = headers.indexOf(COL_CHECKIN);
  if (idCol < 0 || checkinCol < 0) {
    return json({ ok: false, err: 'bad_schema' });
  }

  const rowIdx = data.findIndex((r, i) => i > 0 && String(r[idCol]) === userId);
  if (rowIdx < 0) return json({ ok: false, err: 'not_found' });

  const existing = data[rowIdx][checkinCol];
  if (existing) {
    return json({
      ok: true,
      checked_in_at: existing instanceof Date ? existing.toISOString() : String(existing),
      already: true,
    });
  }

  const ts = new Date().toISOString();
  // Write as plain string so it doesn't get auto-formatted as a date.
  sheet.getRange(rowIdx + 1, checkinCol + 1).setValue(ts);
  return json({ ok: true, checked_in_at: ts });
}

/**
 * Read a sheet into an array of row objects keyed by header name.
 * Date cells are converted: birthday → MM/DD/YYYY string, others → ISO string.
 */
function readSheet(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const tz = Session.getScriptTimeZone();
  const headers = data[0].map(String);
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const obj = {};
    let hasContent = false;
    for (let j = 0; j < headers.length; j++) {
      const v = data[i][j];
      if (v === '' || v === null || v === undefined) {
        obj[headers[j]] = '';
        continue;
      }
      hasContent = true;
      if (v instanceof Date) {
        obj[headers[j]] = headers[j] === COL_BIRTHDAY
          ? Utilities.formatDate(v, tz, 'MM/dd/yyyy')
          : v.toISOString();
      } else {
        obj[headers[j]] = v;
      }
    }
    if (hasContent) rows.push(obj);
  }
  return rows;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
