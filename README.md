# VEVA Entry Control Trainer — GitHub Pages (static)

This is a **pure static** version for **GitHub Pages**:
- No Streamlit / no Python server.
- Designed for **writing practice**: only the latest visitor answer is shown briefly.
- Manual step button: **“I'm done with this step”**.
- End feedback shows **biggest 3 misses** + all missed items with example sentences.
- Generates an **ID card with a photo** (assets in `assets/photos/`).

## Central tracking (who practiced / how often)
GitHub Pages is static. If you want a **central** dashboard, you need an external backend:
- simplest: **Google Sheets** via Google Apps Script Web App
- or: **Supabase / Firebase**

Configure the endpoint in `config.js`:

```js
window.APP_CONFIG = { logEndpoint: "https://..." };
```

The app will POST JSON events `{event:"start"/"finish", student, className, runId, ts, stats}`.

If `logEndpoint` is empty, it still keeps a **local counter** on the device (not shared).

## Deploy to GitHub Pages
1. Push this repo to GitHub.
2. In GitHub: Settings → Pages → Deploy from branch → choose `main` and `/root`.
3. Open the Pages URL.

## Customize phrase recognition
Edit `phrasebank.json` and add extra patterns under `intents`.


## Google Sheets logging
See `GOOGLE_SHEETS_LOGGING.md` for the step-by-step setup.


## UX updates
- When a step is completed, the app shows a clear next-action hint (what to do next).
- ID card now reveals nationality / DOB / age / address immediately after asking for ID.


## Supervisor flow (Step 2)
- When ID-check is complete, use **Contact supervisor** to open the 5W modal.
- After supervisor approves, press **Return to visitor** to continue.
- After threat/rules, press **Go to person search** to proceed to the pat-down.
- Steps auto-advance when all required items are completed.
