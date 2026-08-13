// Version-controlled reference copy — Google doesn't deploy Apps Script from
// git, so this has to be pasted into the Sheet's Extensions > Apps Script
// editor by hand and redeployed after any change. Keep this file in sync
// with whatever's actually pasted there.
//
// Setup: Project Settings > Script Properties > add key "SECRET" with a
// value matching GOOGLE_SHEETS_WEBAPP_SECRET in Vercel's env vars. Then
// Deploy > New deployment > Web App (execute as: Me, access: Anyone), and
// put the resulting URL in Vercel's GOOGLE_SHEETS_WEBAPP_URL.

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'bad json' });
  }

  var expectedSecret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!expectedSecret || data.secret !== expectedSecret) {
    return jsonResponse({ ok: false, error: 'forbidden' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  // kind distinguishes a real form submission (leads.ts) from a call-button
  // tap (call-click.ts, no form — name/contact arrive empty on purpose,
  // staff fill those in by hand once they've actually spoken to the caller).
  var typeLabel = data.kind === 'call_click' ? 'Звонок' : 'Заявка';

  // Only the auto-populated columns (A–L) — the manual/business columns
  // (Сколько заработал, Моя доля, Оплачено мне) are left blank; staff fill
  // those in by hand, and "Моя доля" is an ARRAYFORMULA in its header cell.
  sheet.appendRow([
    new Date(),
    typeLabel,
    data.id || '',
    data.name || '',
    data.contact || '',
    data.contactChannel || '',
    data.service || '',
    data.country || '',
    data.locale || '',
    data.comment || '',
    data.source_url || '',
    'Новая',
  ]);

  return jsonResponse({ ok: true });
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
