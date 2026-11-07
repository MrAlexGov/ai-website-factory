/**
 * Google Apps Script web app for appending form leads to one private spreadsheet.
 *
 * Script Properties (Project Settings -> Script properties):
 *   SPREADSHEET_ID = your private spreadsheet ID
 *   SHARED_SECRET = same random secret configured as Worker secret
 *
 * Deploy as Web app, Execute as: Me, Who has access: Anyone.
 * The endpoint does not expose spreadsheet reads. It accepts only signed-by-secret
 * append requests from the Cloudflare Worker.
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expected = properties.getProperty("SHARED_SECRET");
    if (!expected || !payload.secret || !constantTimeEquals_(String(payload.secret), expected)) {
      return json_({ ok: false, error: "unauthorized" });
    }

    const lead = payload.lead || {};
    const name = clean_(lead.name, 100);
    const phone = clean_(lead.phone, 40);
    const service = clean_(lead.service, 120);
    const message = clean_(lead.message, 1500);
    const language = clean_(lead.language, 8);
    if (!name || !phone || !service) return json_({ ok: false, error: "invalid_fields" });

    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) return json_({ ok: false, error: "spreadsheet_not_configured" });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName("Заявки") || spreadsheet.insertSheet("Заявки");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Дата и время", "Имя", "Телефон", "Услуга", "Комментарий", "Язык"]);
        sheet.setFrozenRows(1);
      }
      // Prefix user-controlled values with apostrophe to prevent spreadsheet formula injection.
      sheet.appendRow([new Date(), safeCell_(name), safeCell_(phone), safeCell_(service), safeCell_(message), safeCell_(language)]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: "internal_error" });
  }
}

function clean_(value, maxLength) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

function safeCell_(value) {
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
