// Central logging endpoint (optional)
// Paste your Google Apps Script Web App URL here.
// If empty, logging is disabled (only local device counter is used).
window.APP_CONFIG = {
  // Teacher mode (hidden editor)
  teacherPin: "", // optional, e.g. "1234". Leave empty to disable PIN unlock.

  logEndpoint: "PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE"
  ,
  logUnknownQuestions: true // log unrecognized student questions to Google Sheets
// The endpoint should accept JSON POST:
  // {event, student, className, runId, ts, stats}
};
