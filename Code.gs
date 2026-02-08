// VEVA Entry Control Trainer — Google Sheets logger
// Receives JSON POST and appends a row to the 'logs' sheet.

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("logs") || ss.insertSheet("logs");

    // Ensure header exists
    if (sh.getLastRow() === 0) {
      sh.appendRow(["ts","event","student","className","runId","difficulty","top3","step","text","userAgent"]);
    }

    const body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const data = JSON.parse(body);

    const ts = data.ts || new Date().toISOString();
    const event = data.event || "";
    const student = data.student || "";
    const className = data.className || "";
    const runId = data.runId || "";
    const difficulty = (data.stats && data.stats.difficulty) ? data.stats.difficulty : "";
    const top3 = (data.stats && data.stats.top3) ? JSON.stringify(data.stats.top3) : "";
    const step = (data.stats && data.stats.step) ? data.stats.step : "";
    const text = (data.stats && data.stats.text) ? data.stats.text : "";
    const userAgent = (data.stats && data.stats.userAgent) ? data.stats.userAgent : (data.userAgent || "");

    sh.appendRow([ts, event, student, className, runId, difficulty, top3, step, text, userAgent]);

    return ContentService
      .createTextOutput(JSON.stringify({ok:true}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ok:false, error: String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
