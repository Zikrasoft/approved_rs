// Version-controlled reference copy — Google doesn't deploy Apps Script from
// git, so this has to be pasted into the Sheet's Extensions > Apps Script
// editor by hand and redeployed after any change. Keep this file in sync
// with whatever's actually pasted there.
//
// Setup: Project Settings > Script Properties > add key "SECRET" with a
// value matching GOOGLE_SHEETS_WEBAPP_SECRET in Vercel's env vars. Then
// Deploy > New deployment > Web App (execute as: Me, access: Anyone), and
// put the resulting URL in Vercel's GOOGLE_SHEETS_WEBAPP_URL.
//
// Also run setupSheet() once (select it in the function dropdown next to
// Run, then click Run) — sets up the Статус dropdown and Оплачено мне
// checkbox via code instead of the Data validation UI. See setupSheet()
// below for why that matters.

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
  var typeLabel = typeLabelFor(data.kind, data.contactChannel);

  var values = [
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
  ];

  // The Vercel side (@vercel/functions' waitUntil) can genuinely dispatch
  // two doPost() calls close together (two visitors clicking within the
  // same second is ordinary traffic) — Web App executions for one
  // deployment are NOT automatically serialized by Apps Script, so without
  // a lock, two concurrent calls could both read the same "next empty row"
  // from getNextDataRow() and then overwrite each other's write. The lock
  // makes the read-then-write below atomic across concurrent executions.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var rowNum;
  try {
    rowNum = getNextDataRow(sheet);
    sheet.getRange(rowNum, 1, 1, values.length).setValues([values]);
  } finally {
    lock.releaseLock();
  }

  // Deep link straight to the row just written, so the Telegram notification
  // can carry a "open this row" link instead of just "open the sheet".
  var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var gid = sheet.getSheetId();
  var rowUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId +
    '/edit#gid=' + gid + '&range=A' + rowNum;

  return jsonResponse({ ok: true, rowUrl: rowUrl });
}

// kind distinguishes a real form submission (leads.ts) from a contact-link
// tap (contact-click.ts — phone/Telegram/WhatsApp/Viber, no form — name/
// contact arrive empty on purpose, staff fill those in by hand once
// they've actually connected). Звонок is kept specifically for phone
// (matches what's already in the sheet); other channels get their own
// label instead of a generic "Клик" so it's obvious which one at a glance.
// An if-chain, not an object literal keyed by contactChannel — the request
// body is untrusted JSON, and `obj[untrustedKey]` on a plain object literal
// resolves inherited Object.prototype members (contactChannel:"constructor"
// etc.) instead of undefined, which this sidesteps entirely.
function typeLabelFor(kind, contactChannel) {
  if (kind !== 'call_click') return 'Заявка';
  if (contactChannel === 'phone') return 'Звонок';
  if (contactChannel === 'telegram') return 'Клик Telegram';
  if (contactChannel === 'whatsapp') return 'Клик WhatsApp';
  if (contactChannel === 'viber') return 'Клик Viber';
  return 'Клик';
}

// First empty row after the header, based only on column A (Дата/время) —
// see the long comment in doPost() for why not sheet.getLastRow().
function getNextDataRow(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) return 2; // header-only sheet (no data rows exist yet)
  var colA = sheet.getRange(2, 1, maxRows - 1, 1).getValues();
  for (var i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== '') return i + 3; // i is 0-based from row 2, so row = i+2; next row = i+3
  }
  return 2; // no data yet — first row right after the header
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this once by hand (function dropdown next to Run > setupSheet > Run).
// Applies the Статус dropdown and Оплачено мне checkbox via
// setDataValidation() instead of the Data validation menu.
// LAST_ROW = the whole sheet, not a small bounded range: getNextDataRow()
// above only ever reads column A (never touched by validation), and
// setDataValidation() (unlike the UI's "Insert > Checkbox" / older
// insertCheckboxes()) doesn't write FALSE/blank into every cell either —
// so there's no more risk in covering the full sheet than a small range,
// and a small range just means rows past it silently have no dropdown/
// checkbox with nothing telling anyone that happened.
function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var LAST_ROW = sheet.getMaxRows();

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Новая', 'В работе', 'Закрыта', 'Спам'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('L2:L' + LAST_ROW).setDataValidation(statusRule);

  var paidRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange('O2:O' + LAST_ROW).setDataValidation(paidRule);
}
