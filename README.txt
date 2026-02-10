VEVA Ingang/Uitgang Trainer — Baseline v7.3.5

Run locally (recommended):
- VS Code: install "Live Server" extension -> right click index.html -> "Open with Live Server"
- Or in Terminal (in this folder):
    python3 -m http.server 5500
  Then open: http://localhost:5500

NOTE: Voice (SpeechRecognition) usually requires a secure context:
- https:// OR http://localhost
- It will NOT work reliably when opening index.html via file://
