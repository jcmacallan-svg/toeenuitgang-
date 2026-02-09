VEVA Trainer baseline v5

Implemented changes:
- ID card is under the chat bubbles (main panel), not in the sidebar.
- ID card is hidden at start; shows only after asking for ID / passport / identity card / have you got ID, etc.
- Visitor avatar is ALWAYS the same file as the ID photo (1:1 sync).
- Speech-to-text writes into the input bar while talking; it only sends to the green bubble when you release.
- Added 'what is your name' intent.
- Added Quick Add rules (sidebar) for fast content iteration; stored in localStorage.

Asset paths used:
- Soldier: assets/photos/soldier.png
- Headshots: assets/photos/headshots_01.png .. headshots_10.png
Fallback supported: assets/photos/headshot_01.png ..

Files to drop into repo root:
- index.html, styles.css, config.js, app.js
