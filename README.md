# Entry Control English Trainer (VVA) — Streamlit Webapp

A lightweight Streamlit webapp for **VVA students** to practice English **entry/exit control** conversations.

## Features
- Step-by-step training flow:
  1) Gate interview (5W’s + appointment details)  
  2) ID-check + control question + supervisor contact (Dutch 5W briefing)  
  3) Threat posture + prohibited items (weapons/drugs/alcohol)  
  4) Pat-down/search instructions (incl. 3 mandatory announcements)  
  5) Registration + base rules briefing
- **Difficulty levels** (Basic / Standard / Advanced)
- **Instant feedback** via intent recognition (fuzzy matching)
- **CSV export** with:
  - SUMMARY (run metadata + completion)
  - CHECKLIST (per intent)
  - CHAT_LOG (timestamped dialogue)

> Privacy note: if you deploy this, the CSV export contains the chat log.

---

## Quick start (local)

### 1) Install
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate

pip install -r requirements.txt
```

### 2) Run
```bash
streamlit run app.py
```

Streamlit will print a local URL (usually `http://localhost:8501`).

---

## Classroom workflow
1. Enter **Class/Group** and **Student name** in the sidebar.
2. Choose a **Difficulty** level.
3. Complete all steps by typing what the student would say in English.
4. After finishing, click **Download CSV export** in the sidebar.

---

## Deploy (Streamlit Community Cloud)
1. Push this repository to GitHub.
2. In Streamlit Community Cloud, create a new app:
   - Repository: this repo
   - Branch: `main`
   - Main file path: `app.py`

---

## Customizing accepted phrases
Edit `INTENT_PHRASES` in `app.py` to add phrasing your students commonly use.

---

## License
MIT — see [LICENSE](LICENSE).
