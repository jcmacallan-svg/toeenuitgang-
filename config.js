// Central logging endpoint (optional)
// Paste your Google Apps Script Web App URL here.
// If empty, logging is disabled (only local device counter is used).
window.APP_CONFIG = {
  // Teacher mode (hidden editor)
  showTeacherButton: true, // show a 'Docent' button in the header

  teacherHotkey: "ctrl+alt+shift+p", // open teacher mode

  teacherPin: "", // optional, e.g. "1234". Leave empty to disable PIN unlock.

  logEndpoint: "https://script.google.com/macros/s/AKfycbxACQ3xg43B-zHm2x3jX0B3Q9Cqf5cs4CSJtejdMKHZ4nKksQ7C2i_pVuapOWaA66gu/exec",
  logUnknownQuestions: true // log unrecognized student questions to Google Sheets
// The endpoint should accept JSON POST:
  // {event, student, className, runId, ts, stats}
};
