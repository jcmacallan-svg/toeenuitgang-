// config.js
// Optional runtime config. Override these in your own fork if needed.
window.CONFIG = {
  assetBase: "assets/photos",
  headshotPrefix: "headshot_",
  headshotCount: 10,
  voiceAutosend: true,
  debug: true,

  // ===== Logging (Google Sheets via Apps Script Web App) =====
  // Set logEndpoint to your deployed Apps Script Web App URL.
  // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  logEnabled: false,
  logEndpoint: "https://script.google.com/macros/s/AKfycbxACQ3xg43B-zHm2x3jX0B3Q9Cqf5cs4CSJtejdMKHZ4nKksQ7C2i_pVuapOWaA66gu/exec",

  // If true, send a single POST per event. If false, events are buffered
  // and flushed in small batches.
  logSendImmediately: false,

  // Max events to keep locally if offline.
  logBufferLimit: 300
};
