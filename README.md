# VIVA Entry Control English Trainer (v6)

Streamlit webapp for VIVA students to practice entry control English.

## Privacy mode
- Only the latest VISITOR answer is shown on screen.
- If TTS is enabled, the answer is spoken and the visible text hides 5 seconds after speech ends.
- When the next question is asked, the previous answer is replaced.

## Phrasebank
- Keep `phrasebank.json` next to `app.py`.
- Use the sidebar to add extra phrases to intents to improve recognition.

## Photos on the ID card
- Add rights-cleared images to `assets/photos/`.

## Run locally
```bash
pip install -r requirements.txt
streamlit run app.py
```

## Deploy
GitHub Pages cannot run Streamlit. Use Streamlit Community Cloud.


## Manual step button + feedback
- The right-side checklist was removed.
- Students can press **“I'm done with this step (continue)”** to move on.
- At the end, the app shows which intents were missed, with example sentences.
