# Google Sheets logging (VEVA Entry Control Trainer)

Goal: log **who practiced and how often** to a Google Sheet from your GitHub Pages app.

You will create:
1) A Google Sheet (your log database)
2) A Google Apps Script **Web App** that receives POST requests and appends rows to the Sheet
3) Paste the Web App URL into `config.js` in this repo

---

## 1) Create the Google Sheet

1. Create a new Google Sheet, e.g. `VEVA Entry Control Logs`
2. Rename the first tab to: `logs`

Create this header row (row 1):

| ts | event | student | className | runId | difficulty | top3 | step | text | userAgent |
|---|---|---|---|---|---|---|---|

(You can add more columns later.)

---

## 2) Create the Apps Script Web App

1. In the Sheet: **Extensions → Apps Script**
2. Delete any default code and paste the content of `Code.gs` (below)
3. Click **Save**

### Code.gs (paste this)

```javascript
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
```

---

## 3) Deploy as a Web App

1. Click **Deploy → New deployment**
2. Select type: **Web app**
3. Description: `VEVA Logger`
4. Execute as: **Me**
5. Who has access: **Anyone** (or **Anyone with the link**)  
   (This is required so GitHub Pages can POST to it.)

Click **Deploy** and approve permissions.

You’ll get a **Web App URL**.

---

## 4) Paste the URL into your repo

Open `config.js` and set:

```js
window.APP_CONFIG = {
  logEndpoint: "YOUR_WEB_APP_URL_HERE"
};
```

Commit & push to GitHub. Now every start/finish will be appended to your Sheet.

---

## Notes (security & classroom reality)

- This setup is lightweight and works well for classes.
- It is not hardened against abuse (anyone with the URL can POST).
  If you need basic protection later:
  - use a simple shared secret token in the request, or
  - restrict access to your domain, or
  - move to Supabase/Firebase with auth.

---


### Unknown questions
If `logUnknownQuestions` is enabled in `config.js`, the app will log `event: unknown_question` with `step` and `text`.
