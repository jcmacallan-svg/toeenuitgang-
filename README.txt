VEVA Trainer baseline v7.0.1

Added baseline tracking:
- window.BUILD in config.js
- v-pill in topbar
- document.title includes version
- console banner logs BUILD + CONFIG
- cache-busting query param ?v=7.0.1 for config.js and app.js

Assets expected:
- assets/photos/soldier.png
- assets/photos/headshot_01.png .. headshot_10.png

ID behavior:
- ID card is hidden at start (hidden + display:none + JS hideId on boot)
- shows only when student asks for ID (ask_id intent)
- visitor avatar and ID photo use the same image file (1:1)
