;(() => {
  "use strict";

  /***********************
   * VEVA app.js — WhatsApp-style + Voice (2026-02-09)
   * - WhatsApp-like UI (bubbles + wallpaper + composer)
   * - Hold-to-talk voice input (Web Speech API)
   * - NO supervisor button in UI
   * - Supervisor modal only via text trigger
   * - Born-year confirm uses actual ID year (or claimed/lie)
   * - Deny always works + finish run
   * - Person search always works
   * - Logging uses no-cors to avoid Apps Script CORS/preflight issues
   ***********************/

  const APP_VERSION = "veva-stable-v3-wa-voice-2026-02-09";
  console.log("[VEVA]", APP_VERSION, "loaded");

  /***********************
   * CONFIG + UTIL
   ***********************/
  const CONFIG = (window.APP_CONFIG || {});
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  // Voice config (optional)
  const VOICE_LANG = CONFIG.voiceLang || "en-US";        // or "en-GB"
  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true; // default false

  const $ = (sel, root = document) => root.querySelector(sel);

  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function safeLower(s) { return (s || "").toString().trim().toLowerCase(); }

  function escapeHtml(str) {
    return (str || "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

  function parseYear(text) {
    const m = (text || "").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  function formatDob({ yyyy, mm, dd }) {
    const z2 = (n) => (n < 10 ? "0" + n : "" + n);
    return `${yyyy}-${z2(mm)}-${z2(dd)}`;
  }

  function calcAgeFromDob(dobObj) {
    const today = new Date();
    const y = today.getFullYear();
    let age = y - dobObj.yyyy;
    const m = today.getMonth() + 1;
    const d = today.getDate();
    if (m < dobObj.mm || (m === dobObj.mm && d < dobObj.dd)) age -= 1;
    return age;
  }

  function chance(p) { return Math.random() < clamp(p, 0, 1); }

  function teacherModeEnabled() {
    const qp = new URLSearchParams(location.search);
    if (qp.get("teacher") === "1") return true;
    return localStorage.getItem("veva_teacher_mode") === "1";
  }

  /***********************
   * STATE
   ***********************/
  const STEPS = {
    INTAKE: "intake",
    ID_CHECK: "id_check",
    THREAT_ITEMS: "threat_items",
    PERSON_SEARCH: "person_search",
    FINISHED: "finished"
  };

  const REQUIRED = [
    { key: "asked_name", label: "You didn’t ask the visitor’s name.", example: "What is your name, please?" },
    { key: "asked_purpose", label: "You didn’t ask the purpose of the visit.", example: "What is the purpose of your visit today?" },
    { key: "asked_appointment", label: "You didn’t confirm the appointment.", example: "Do you have an appointment?" },
    { key: "asked_who", label: "You didn’t ask who they are meeting.", example: "Who are you here to see?" },
    { key: "asked_time", label: "You didn’t confirm the time.", example: "What time is your appointment?" },
    { key: "asked_where", label: "You didn’t confirm where they are going.", example: "Where are you going on base?" },
    { key: "asked_subject", label: "You didn’t ask what the meeting is about.", example: "What is the meeting about?" },
    { key: "asked_id", label: "You didn’t ask to see an ID.", example: "Can I see your ID, please?" },
    { key: "asked_dob", label: "You didn’t verify date of birth (DOB).", example: "What is your date of birth?" },
    { key: "asked_age", label: "You didn’t verify age.", example: "How old are you?" },
    { key: "asked_nationality", label: "You didn’t verify nationality.", example: "What is your nationality?" },
    { key: "supervisor_contacted", label: "You didn’t contact a supervisor when needed.", example: "I’ll contact my supervisor for approval." },
    { key: "explained_threat", label: "You didn’t mention threat level / security measures.", example: "We are on a higher threat level today, so I will ask a few extra questions." },
    { key: "explained_items", label: "You didn’t explain prohibited items.", example: "Do you have any weapons, sharp objects, or prohibited items?" },
    { key: "did_person_search", label: "You didn’t complete the person search step.", example: "I’m going to do a quick pat-down search. Is that okay?" }
  ];

  /***********************
   * PHRASEBANK (optional)
   ***********************/
  async function loadPhrasebank() {
    try {
      const res = await fetch("phrasebank.json", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function compilePatterns(extra) {
    const base = {
      ask_id: [
        /\b(can i|could i|may i|let me)\s+(see|check)\s+(your|ur)\s+(id|identification)\b/i,
        /\bshow\s+me\s+(your|ur)\s+(id|identification)\b/i,
        /\bdo\s+you\s+have\s+an?\s+id\b/i,
        /\bid\s+please\b/i
      ],
      return_id: [
        /\bhere('?s|\s+is)\s+your\s+id\s+back\b/i,
        /\b(return|give)\s+(it|the\s+id)\s+back\b/i,
        /\breturn\s+to\s+visitor\b/i
      ],
      contact_supervisor: [
        /\b(i\s+(will|’ll|'ll)\s+)?(please\s+)?(contact|call|ring|phone)\s+(my\s+)?(supervisor|boss|officer|team\s*leader|manager)\b/i,
        /\b(contact|call)\s+(a\s+)?(supervisor|team\s*leader|manager)\b/i
      ],
      ask_name: [
        /\bwhat('?s|\s+is)\s+your\s+name\b/i,
        /\bname\s*,?\s+please\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i
      ],
      ask_purpose: [
        /\b(what('?s|\s+is)\s+the\s+purpose|why\s+are\s+you\s+here|reason\s+for\s+your\s+visit)\b/i,
        /\bwhat\s+brings\s+you\s+here\b/i
      ],
      ask_appointment: [
        /\bdo\s+you\s+have\s+an?\s+appointment\b/i,
        /\bare\s+you\s+expected\b/i
      ],
      ask_who: [
        /\bwho\s+are\s+you\s+(here\s+to\s+see|meeting|visiting)\b/i,
        /\bwho\s+is\s+your\s+appointment\s+with\b/i
      ],
      ask_time: [
        /\bwhat\s+time\s+is\s+your\s+appointment\b/i,
        /\bwhen\s+is\s+your\s+appointment\b/i
      ],
      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhich\s+(building|unit|office)\b/i
      ],
      ask_subject: [
        /\bwhat\s+is\s+it\s+about\b/i,
        /\bwhat\s+is\s+the\s+meeting\s+about\b/i
      ],
      ask_age: [
        /\bhow\s+old\s+are\s+you\b/i,
        /\bwhat\s+is\s+your\s+age\b/i
      ],
      ask_dob: [
        /\b(what('?s|\s+is)\s+your\s+(date\s+of\s+birth|dob)|date\s+of\s+birth|dob)\b/i,
        /\bwhen\s+were\s+you\s+born\b/i
      ],
      confirm_born_year: [
        /\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i,
        /\byou\s+were\s+born\s+in\s+(19\d{2}|20\d{2})\s*\?\s*$/i
      ],
      ask_nationality: [
        /\bwhat\s+is\s+your\s+nationality\b/i,
        /\bwhere\s+are\s+you\s+from\b/i,
        /\byour\s+citizenship\b/i
      ],
      go_person_search: [
        /\b(go\s+to|start|begin)\s+(the\s+)?(person\s+search|pat\s*down|frisk)\b/i,
        /\b(i\s+need\s+to|we\s+need\s+to)\s+(search|pat\s*down)\b/i
      ],
      deny: [
        /\bdeny\s+(entrance|entry|access)\b/i,
        /\byou\s+cannot\s+enter\b/i,
        /\bnot\s+allowed\s+to\s+enter\b/i,
        /\bi\s+am\s+refusing\s+entry\b/i
      ],
      smalltalk: [ /\bhello\b/i, /\bhi\b/i, /\bgood\s+(morning|afternoon|evening)\b/i ]
    };

    const merged = { ...base };

    // Optional merge phrasebank
    if (extra) {
      const intentsObj = extra.intents && typeof extra.intents === "object" ? extra.intents : null;

      const addPatterns = (key, arr) => {
        if (!arr || !Array.isArray(arr)) return;
        merged[key] = merged[key] || [];
        for (const p of arr) {
          if (!p) continue;
          if (p instanceof RegExp) merged[key].push(p);
          else if (typeof p === "string") {
            try { merged[key].push(new RegExp(p, "i")); } catch {}
          }
        }
      };

      if (intentsObj) {
        for (const [k, v] of Object.entries(intentsObj)) {
          if (v && Array.isArray(v.patterns)) addPatterns(k, v.patterns);
        }
      } else {
        for (const [k, v] of Object.entries(extra)) {
          if (Array.isArray(v)) addPatterns(k, v);
        }
      }
    }

    const compiled = {};
    for (const [k, arr] of Object.entries(merged)) compiled[k] = (text) => arr.some(rx => rx.test(text));
    compiled._raw = merged;
    return compiled;
  }

  /***********************
   * VISITOR GENERATION
   ***********************/
  const MOODS = [
    { name: "relaxed", lieBoost: 0.02, inconsBoost: 0.02 },
    { name: "tired but cooperative", lieBoost: 0.05, inconsBoost: 0.05 },
    { name: "uneasy", lieBoost: 0.10, inconsBoost: 0.12 },
    { name: "nervous", lieBoost: 0.18, inconsBoost: 0.20 },
    { name: "irritated", lieBoost: 0.12, inconsBoost: 0.10 }
  ];

  const NATIONALITIES = [
    "Dutch","German","Belgian","French","Spanish","Italian",
    "Polish","Romanian","Turkish","British","American","Canadian"
  ];

  const NAMES = [
    "David","Michael","James","Robert","Daniel","Thomas",
    "Mark","Lucas","Noah","Adam","Omar","Yusuf","Mateusz","Julien","Marco"
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomDob() {
    const today = new Date();
    const year = today.getFullYear() - (18 + Math.floor(Math.random() * 38)); // 18..55
    const mm = 1 + Math.floor(Math.random() * 12);
    const dd = 1 + Math.floor(Math.random() * 28);
    return { yyyy: year, mm, dd };
  }

  function randomIdNumber() {
    const a = Math.floor(100000 + Math.random() * 900000);
    const b = Math.floor(1000 + Math.random() * 9000);
    return `ID-${a}-${b}`;
  }

  function randomExpiry() {
    const today = new Date();
    const y = today.getFullYear() + (1 + Math.floor(Math.random() * 8));
    const mm = 1 + Math.floor(Math.random() * 12);
    const dd = 1 + Math.floor(Math.random() * 28);
    return { yyyy: y, mm, dd };
  }

  function buildVisitor() {
    const mood = pick(MOODS);
    const dob = randomDob();
    const nat = pick(NATIONALITIES);
    const name = pick(NAMES) + " " + (["Johnson","Miller","Brown","Davis","Martinez","Kowalski","Nowak","Schmidt","Dubois","Rossi","Yilmaz"][Math.floor(Math.random() * 11)]);
    const age = calcAgeFromDob(dob);

    const id = { name, nationality: nat, dob, age, idNumber: randomIdNumber(), expiry: randomExpiry() };

    const idx = 1 + Math.floor(Math.random() * 12);
    // YOU confirmed this folder is correct:
    const headshot = `assets/photos/headshot_${String(idx).padStart(2, "0")}.png`;

    const purpose = pick(["delivery", "maintenance", "meeting", "visit", "contract work"]);
    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30", "10:00", "13:15", "14:00", "15:45"]) : null;
    const meetingWith = appointment ? pick(["Captain Lewis", "Sgt. van Dijk", "Mr. Peters", "Lt. Schmidt"]) : null;
    const goingWhere = pick(["HQ building", "Logistics office", "Barracks admin", "Workshop"]);
    const subject = pick(["paperwork", "equipment handover", "maintenance report", "security briefing", "contract discussion"]);

    return {
      mood,
      headshot,
      id,
      intake: { purpose, appointment, apptTime, meetingWith, goingWhere, subject },
      claims: { age: null, dob: null, nationality: null, name: null },
      inconsistencies: []
    };
  }

  /***********************
   * UI — WhatsApp-ish
   ***********************/
  function injectUi() {
    $("#veva-app")?.remove();

    const root = document.createElement("div");
    root.id = "veva-app";
    root.innerHTML = `
      <div class="wa-shell">
        <header class="wa-top">
          <div class="wa-brand">
            <div class="wa-title">VEVA – Ingang/Uitgang Trainer</div>
            <div class="wa-sub">English checkpoint conversation practice</div>
          </div>

          <div class="wa-actions">
            <button class="wa-btn wa-btn-danger" id="btn-deny">Deny entrance</button>
          </div>
        </header>

        <div class="wa-body">
          <div class="wa-chat">
            <div class="wa-chat-bg" aria-hidden="true"></div>

            <div class="wa-chatlog" id="chatlog" aria-live="polite"></div>

            <div class="wa-sidebar">
              <div class="wa-card">
                <div class="wa-card-title">Visitor</div>
                <div class="wa-visitor">
                  <img id="visitor-img" class="wa-avatar" alt="Visitor headshot" />
                  <div class="wa-vmeta">
                    <div><b>Mood:</b> <span id="visitor-mood"></span></div>
                    <div><b>Run ID:</b> <span id="runid"></span></div>
                    <div><b>Step:</b> <span id="stepname"></span></div>
                  </div>
                </div>
              </div>

              <div class="wa-card" id="idcard" style="display:none;">
                <div class="wa-card-title">ID card</div>
                <div class="wa-id">
                  <div><b>Name:</b> <span id="id-name"></span></div>
                  <div><b>Nationality:</b> <span id="id-nat"></span></div>
                  <div><b>DOB:</b> <span id="id-dob"></span></div>
                  <div><b>Age:</b> <span id="id-age"></span></div>
                  <div><b>ID nr:</b> <span id="id-nr"></span></div>
                  <div><b>Expiry:</b> <span id="id-exp"></span></div>
                </div>
                <div class="wa-row wa-row-tight">
                  <button class="wa-btn wa-btn-subtle" id="btn-return-id">Return to visitor</button>
                </div>
              </div>

              <div class="wa-card wa-teacher" id="teacher-card" style="display:none;">
                <div class="wa-card-title">Teacher</div>
                <div class="wa-small" id="teacher-debug"></div>
              </div>
            </div>

            <div class="wa-composer">
              <div class="wa-hint" id="hintline"></div>
              <div class="wa-row">
                <input id="chatinput" type="text" autocomplete="off" placeholder="Type your question in English…" />
                <button class="wa-btn wa-btn-send" id="btn-send">Send</button>
                <button class="wa-btn wa-btn-mic" id="btn-mic" type="button" title="Hold to talk">🎙</button>
              </div>
              <div class="wa-micstatus" id="micStatus" aria-live="polite"></div>
            </div>
          </div>
        </div>

        <!-- Supervisor Modal -->
        <div class="wa-modal-backdrop" id="sup-backdrop" style="display:none;">
          <div class="wa-modal" role="dialog" aria-modal="true" aria-label="Supervisor contact">
            <div class="wa-modal-head">
              <div class="wa-modal-title">Contact supervisor</div>
              <button class="wa-btn wa-btn-subtle" id="sup-close">Close</button>
            </div>

            <div class="wa-modal-body">
              <div class="wa-small">Fill in the 5W/5WH details before requesting approval.</div>
              <div class="wa-grid">
                <label>Who (visitor name)<input id="sup-who" type="text" /></label>
                <label>Why (purpose)<input id="sup-why" type="text" /></label>
                <label>What (subject)<input id="sup-what" type="text" /></label>
                <label>Where (destination)<input id="sup-where" type="text" /></label>
                <label>When (time)<input id="sup-when" type="text" /></label>
                <label>With whom (appointment with)<input id="sup-with" type="text" /></label>
              </div>

              <div class="wa-row wa-row-wrap">
                <button class="wa-btn" id="sup-request">Request approval</button>
                <button class="wa-btn wa-btn-danger" id="sup-deny">Supervisor denies</button>
                <button class="wa-btn wa-btn-ok" id="sup-approve">Supervisor approves</button>
              </div>

              <div class="wa-small" id="sup-status"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const mount = $("#app") || document.body;
    mount.innerHTML = "";
    mount.appendChild(root);

    const style = document.createElement("style");
    style.textContent = `
      :root{
        --wa-bg: #e5ddd5;
        --wa-wall: rgba(0,0,0,.04);
        --wa-header: #075e54;
        --wa-header2:#128c7e;
        --wa-out: #dcf8c6;
        --wa-in: #ffffff;
        --wa-text: #111;
        --wa-muted: rgba(0,0,0,.55);
        --wa-border: rgba(0,0,0,.08);
      }

      body{margin:0;font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;background: var(--wa-bg);color:var(--wa-text);}

      .wa-shell{height:100vh;display:flex;flex-direction:column;}
      .wa-top{
        padding:10px 14px;
        background: linear-gradient(90deg, var(--wa-header), var(--wa-header2));
        color:white;
        display:flex;align-items:center;justify-content:space-between;
        box-shadow: 0 2px 10px rgba(0,0,0,.10);
      }
      .wa-title{font-weight:900;font-size:16px;line-height:1.15}
      .wa-sub{opacity:.85;font-size:12px}
      .wa-actions{display:flex;gap:10px;align-items:center}

      .wa-body{flex:1;min-height:0;display:flex;justify-content:center;}
      .wa-chat{
        width:min(1100px, 100%);
        flex:1;
        min-height:0;
        display:grid;
        grid-template-columns: 1fr 320px;
        position:relative;
      }

      .wa-chat-bg{
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 20% 10%, rgba(255,255,255,.25), transparent 45%),
          radial-gradient(circle at 80% 30%, rgba(255,255,255,.20), transparent 50%),
          radial-gradient(circle at 30% 70%, rgba(255,255,255,.18), transparent 55%),
          linear-gradient(0deg, var(--wa-wall), var(--wa-wall));
        pointer-events:none;
        z-index:0;
      }

      .wa-chatlog{
        grid-column:1/2;
        position:relative;
        z-index:1;
        overflow:auto;
        padding:14px 14px 120px 14px;
        min-height:0;
      }

      .wa-sidebar{
        grid-column:2/3;
        position:relative;
        z-index:1;
        overflow:auto;
        padding:14px 14px 120px 10px;
        min-height:0;
      }

      .wa-card{
        background: rgba(255,255,255,.92);
        border:1px solid var(--wa-border);
        border-radius:14px;
        padding:12px;
        margin-bottom:12px;
      }
      .wa-card-title{font-weight:900;margin-bottom:8px}
      .wa-visitor{display:flex;gap:10px;align-items:center}
      .wa-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:1px solid var(--wa-border);background:#f2f2f2}
      .wa-vmeta{font-size:12px;color:rgba(0,0,0,.75)}
      .wa-id{font-size:12px;color:rgba(0,0,0,.80);display:flex;flex-direction:column;gap:4px}
      .wa-small{font-size:12px;color:rgba(0,0,0,.70)}
      .wa-teacher{opacity:.95}

      .wa-bubble{
        max-width:min(74%, 680px);
        padding:10px 12px;
        border-radius:14px;
        margin:8px 0;
        border:1px solid var(--wa-border);
        box-shadow: 0 1px 1px rgba(0,0,0,.06);
        position:relative;
        display:flex;
        gap:10px;
        align-items:flex-end;
      }
      .wa-bubble .txt{white-space:pre-wrap;word-wrap:break-word}
      .wa-bubble .meta{font-size:11px;color:var(--wa-muted);margin-top:6px}
      .wa-bubble.in{background: var(--wa-in); margin-right:auto;}
      .wa-bubble.out{background: var(--wa-out); margin-left:auto; flex-direction: row-reverse;}
      .wa-bubble .ava{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--wa-border);background:#eee;flex:0 0 auto}

      .wa-composer{
        position:absolute;
        left:0; right:0; bottom:0;
        grid-column:1/3;
        z-index:2;
        padding:10px 10px 12px 10px;
        backdrop-filter: blur(6px);
        background: rgba(229,221,213,.80);
        border-top:1px solid rgba(0,0,0,.10);
      }
      .wa-hint{font-size:12px;color:rgba(0,0,0,.65);margin-bottom:8px}

      .wa-row{display:flex;gap:8px;align-items:center}
      .wa-row-tight{margin-top:10px}
      .wa-row-wrap{flex-wrap:wrap}

      #chatinput{
        flex:1;
        padding:12px 12px;
        border-radius:999px;
        border:1px solid rgba(0,0,0,.14);
        background:white;
        font-size:14px;
        outline:none;
      }
      #chatinput:focus{border-color: rgba(18,140,126,.55); box-shadow:0 0 0 3px rgba(18,140,126,.12);}

      .wa-btn{
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(0,0,0,.14);
        background:white;
        cursor:pointer;
        font-weight:800;
      }
      .wa-btn:hover{filter:brightness(.98)}
      .wa-btn-send{background:#128c7e;color:white;border-color: rgba(0,0,0,.10)}
      .wa-btn-mic{width:46px;display:flex;align-items:center;justify-content:center}
      .wa-btn-danger{background:#ffe8e8;border-color: rgba(200,0,0,.18)}
      .wa-btn-ok{background:#e9fff1;border-color: rgba(0,140,70,.22)}
      .wa-btn-subtle{opacity:.9}

      .wa-micstatus{margin-top:6px;font-size:12px;color:rgba(0,0,0,.6);min-height:16px}

      .wa-modal-backdrop{position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex;align-items:center;justify-content:center; padding:16px; z-index:9999}
      .wa-modal{width:min(760px, 96vw); background:white; border-radius:16px; border:1px solid rgba(0,0,0,.12); overflow:hidden}
      .wa-modal-head{display:flex; align-items:center; justify-content:space-between; padding:12px 12px; border-bottom:1px solid rgba(0,0,0,.10)}
      .wa-modal-title{font-weight:900}
      .wa-modal-body{padding:12px; display:flex; flex-direction:column; gap:10px}
      .wa-grid{display:grid; grid-template-columns:1fr 1fr; gap:10px}
      .wa-grid label{font-size:12px;color:rgba(0,0,0,.75);display:flex;flex-direction:column;gap:6px}
      .wa-grid input{padding:10px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.14);background:white}

      @media (max-width: 980px){
        .wa-chat{grid-template-columns:1fr}
        .wa-sidebar{display:none}
        .wa-composer{grid-column:1/2}
      }
    `;
    document.head.appendChild(style);
  }

  /***********************
   * LOGGING (no-cors)
   ***********************/
  function logEvent(type, payload = {}) {
    if (!LOG_ENDPOINT) return Promise.resolve();
    const body = JSON.stringify({ ts: nowIso(), type, ...payload });
    try {
      return fetch(LOG_ENDPOINT, { method: "POST", mode: "no-cors", body }).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }

  /***********************
   * APP CORE STATE
   ***********************/
  const app = {
    runId: uid(),
    visitor: null,
    step: STEPS.INTAKE,
    flags: {
      asked_name: false,
      asked_purpose: false,
      asked_appointment: false,
      asked_who: false,
      asked_time: false,
      asked_where: false,
      asked_subject: false,
      asked_id: false,
      asked_age: false,
      asked_dob: false,
      asked_nationality: false,
      supervisor_contacted: false,
      explained_threat: false,
      explained_items: false,
      did_person_search: false
    },
    idVisible: false,
    processing: false,
    finished: false,
    intents: null,
    phrasebank: null,
    unknowns: 0,
    messages: [],
    speech: {
      supported: false,
      recognizing: false,
      finalTranscript: ""
    }
  };

  function setStep(step) {
    app.step = step;
    const el = $("#stepname");
    if (el) el.textContent = step;
  }

  function setHint(text) {
    const el = $("#hintline");
    if (el) el.textContent = text || "";
  }

  function addBubble(side, text, meta = "") {
    const log = $("#chatlog");
    if (!log) return;

    const div = document.createElement("div");
    const cls = (side === "out") ? "wa-bubble out" : "wa-bubble in";
    div.className = cls;

    const avatarSrc = side === "out"
      ? "assets/photos/soldier.png"
      : (app.visitor?.headshot || "assets/photos/headshot_01.png");

    div.innerHTML = `
      <img class="ava" alt="${side === "out" ? "student" : "visitor"}" src="${escapeHtml(avatarSrc)}" />
      <div class="content">
        <div class="txt">${escapeHtml(text)}</div>
        ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    `;

    // If visitor image missing, fallback without crashing
    const img = div.querySelector("img.ava");
    if (img) img.onerror = () => { img.src = "assets/photos/headshot_01.png"; };

    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function soldierSay(text, meta) {
    app.messages.push({ from: "soldier", text, ts: nowIso() });
    addBubble("out", text, meta);
  }

  function visitorSay(text, meta) {
    app.messages.push({ from: "visitor", text, ts: nowIso() });
    addBubble("in", text, meta);
  }

  function showIdCard() {
    const card = $("#idcard");
    if (!card) return;
    app.idVisible = true;
    card.style.display = "";
    const v = app.visitor;
    $("#id-name").textContent = v.id.name;
    $("#id-nat").textContent = v.id.nationality;
    $("#id-dob").textContent = formatDob(v.id.dob);
    $("#id-age").textContent = String(v.id.age);
    $("#id-nr").textContent = v.id.idNumber;
    $("#id-exp").textContent = formatDob(v.id.expiry);
  }

  function hideIdCard() {
    const card = $("#idcard");
    if (!card) return;
    app.idVisible = false;
    card.style.display = "none";
  }

  function openSupervisorModal(prefill = {}) {
    const back = $("#sup-backdrop");
    if (!back) return;
    $("#sup-status").textContent = "";

    const v = app.visitor;
    const fill = (id, val) => { const el = $(id); if (el) el.value = val || ""; };

    fill("#sup-who", prefill.who ?? v?.id?.name ?? "");
    fill("#sup-why", prefill.why ?? v?.intake?.purpose ?? "");
    fill("#sup-what", prefill.what ?? v?.intake?.subject ?? "");
    fill("#sup-where", prefill.where ?? v?.intake?.goingWhere ?? "");
    fill("#sup-when", prefill.when ?? v?.intake?.apptTime ?? "");
    fill("#sup-with", prefill.with ?? v?.intake?.meetingWith ?? "");

    back.style.display = "flex";
    const who = $("#sup-who");
    if (who) setTimeout(() => who.focus(), 0);
  }

  function closeSupervisorModal() {
    const back = $("#sup-backdrop");
    if (!back) return;
    back.style.display = "none";
    const input = $("#chatinput");
    if (input) setTimeout(() => input.focus(), 0);
  }

  function supervisorPayloadFromModal() {
    return {
      who: ($("#sup-who")?.value || "").trim(),
      why: ($("#sup-why")?.value || "").trim(),
      what: ($("#sup-what")?.value || "").trim(),
      where: ($("#sup-where")?.value || "").trim(),
      when: ($("#sup-when")?.value || "").trim(),
      with: ($("#sup-with")?.value || "").trim()
    };
  }

  function validateSupervisorFields(p) {
    const missing = [];
    for (const k of ["who", "why", "what", "where", "when"]) if (!p[k]) missing.push(k);
    return missing;
  }

  function makeFakeControl(kind) {
    const v = app.visitor;
    if (kind === "age") {
      const delta = pick([-2, -1, 1, 2, 3]);
      return String(clamp(v.id.age + delta, 18, 70));
    }
    if (kind === "dob") {
      const dob = { ...v.id.dob };
      if (chance(0.5)) dob.dd = clamp(dob.dd + pick([-2, -1, 1, 2]), 1, 28);
      else dob.mm = clamp(dob.mm + pick([-1, 1]), 1, 12);
      return formatDob(dob);
    }
    if (kind === "nationality") return pick(NATIONALITIES.filter(n => n !== v.id.nationality));
    if (kind === "name") return pick(NAMES) + " " + pick(["Johnson", "Miller", "Brown", "Davis", "Rossi", "Schmidt"]);
    return "";
  }

  function visitorControlAnswer(kind) {
    const v = app.visitor;
    const mood = v.mood;
    const lieP = 0.04 + mood.lieBoost;
    const inconsP = 0.05 + mood.inconsBoost;

    const truth = (() => {
      if (kind === "age") return String(v.id.age);
      if (kind === "dob") return formatDob(v.id.dob);
      if (kind === "nationality") return v.id.nationality;
      if (kind === "name") return v.id.name;
      return "";
    })();

    const prev = v.claims[kind];
    if (prev) {
      if (chance(inconsP)) {
        const fake = makeFakeControl(kind);
        if (fake !== prev) {
          v.inconsistencies.push({ kind, prev, next: fake, ts: nowIso() });
          v.claims[kind] = fake;
          return { value: fake, lied: true, inconsistent: true };
        }
      }
      return { value: prev, lied: prev !== truth, inconsistent: false };
    }

    if (chance(lieP)) {
      const fake = makeFakeControl(kind);
      v.claims[kind] = fake;
      return { value: fake, lied: fake !== truth, inconsistent: false };
    }

    v.claims[kind] = truth;
    return { value: truth, lied: false, inconsistent: false };
  }

  function ensureStepProgression() {
    if (app.step === STEPS.INTAKE && app.flags.asked_id) setStep(STEPS.ID_CHECK);
    if (app.step === STEPS.ID_CHECK && app.flags.supervisor_contacted) setStep(STEPS.THREAT_ITEMS);
  }

  function visitorReplyForIntakeQuestion(kind) {
    const v = app.visitor;
    const a = v.intake;
    if (kind === "name") return `My name is ${v.id.name}.`;
    if (kind === "purpose") return `I’m here for ${a.purpose}.`;
    if (kind === "appointment") return a.appointment ? "Yes, I have an appointment." : "No, I don’t have an appointment.";
    if (kind === "who") return a.meetingWith ? `I’m meeting ${a.meetingWith}.` : "I’m not meeting anyone specific.";
    if (kind === "time") return a.apptTime ? `It’s at ${a.apptTime}.` : "I don’t have a specific time.";
    if (kind === "where") return `I’m going to the ${a.goingWhere}.`;
    if (kind === "subject") return `It’s about ${a.subject}.`;
    return "Okay.";
  }

  function handleBornYearConfirm(userText) {
    const v = app.visitor;
    const yearAsked = parseYear(userText);
    if (!yearAsked) return visitorSay("Sorry, could you repeat the year?");

    const claim = visitorControlAnswer("dob");     // may be truth or lie
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if (yearAsked === claimYear) {
      visitorSay("Yes, that’s correct.");
      if (claim.lied) visitorSay("Sorry… I’m a bit stressed.", "mood");
      return;
    }

    visitorSay("No, that’s not correct.");

    if (yearAsked === trueYear && claim.lied) {
      visitorSay(`Actually… you’re right. I was born in ${trueYear}. Sorry.`, "correction");
      v.claims.dob = formatDob(v.id.dob);
      return;
    }

    visitorSay(`I was born in ${claimYear}.`);
  }

  function explainThreatAndItems() {
    app.flags.explained_threat = true;
    app.flags.explained_items = true;
    soldierSay("Thanks. Due to a higher threat level today, I’ll apply extra security checks.", "threat");
    soldierSay("Do you have any weapons, sharp objects, drugs, or other prohibited items with you?", "prohibited items");
    setStep(STEPS.THREAT_ITEMS);
  }

  function beginPersonSearch() {
    if (app.finished) return;
    app.flags.did_person_search = true;
    setStep(STEPS.PERSON_SEARCH);
    soldierSay("I’m going to do a quick pat-down search (person search). Is that okay?", "person search");
    visitorSay("Yes, that’s okay.");
    soldierSay("Thank you. Please keep your hands visible and follow my instructions.", "rules");
    soldierSay("You may enter. Follow site rules and stay with your escort if required.", "completion");
    endRun("completed");
  }

  function endRun(reason = "finished") {
    if (app.finished) return;
    app.finished = true;
    setStep(STEPS.FINISHED);

    const input = $("#chatinput");
    const send = $("#btn-send");
    if (input) input.disabled = true;
    if (send) send.disabled = true;

    const deny = $("#btn-deny");
    if (deny) deny.disabled = true;

    hideIdCard();

    logEvent("finish", {
      runId: app.runId,
      reason,
      step: app.step,
      unknowns: app.unknowns,
      inconsistencies: app.visitor?.inconsistencies || []
    });

    const misses = REQUIRED.filter(r => !app.flags[r.key]).slice(0, 3);
    if (misses.length) {
      soldierSay("Run finished. Here are your top 3 improvements:", "feedback");
      misses.forEach((m, i) => soldierSay(`${i + 1}) ${m.label}`, `Example: ${m.example}`));
    } else {
      soldierSay("Run finished. Nice work — you covered all key checkpoints.", "feedback");
    }
  }

  async function denyEntranceFlow(source = "button") {
    if (app.finished) return;
    soldierSay("I’m denying entry. You cannot enter the site.", "deny");
    logEvent("deny", { runId: app.runId, source, step: app.step });
    await sleep(900);
    endRun("denied");
  }

  function matchIntent(text) {
    const t = text || "";
    const I = app.intents;

    const map = [
      ["deny", "deny"],
      ["ask_id", "ask_id"],
      ["return_id", "return_id"],
      ["contact_supervisor", "contact_supervisor"],
      ["go_person_search", "go_person_search"],
      ["ask_name", "ask_name"],
      ["ask_purpose", "ask_purpose"],
      ["ask_appointment", "ask_appointment"],
      ["ask_who", "ask_who"],
      ["ask_time", "ask_time"],
      ["ask_where", "ask_where"],
      ["ask_subject", "ask_subject"],
      ["ask_age", "ask_age"],
      ["ask_dob", "ask_dob"],
      ["confirm_born_year", "confirm_born_year"],
      ["ask_nationality", "ask_nationality"],
      ["smalltalk", "smalltalk"]
    ];

    for (const [key, fn] of map) if (I?.[fn] && I[fn](t)) return key;

    const low = safeLower(t);
    if (low.includes("date of birth") || low === "dob") return "ask_dob";
    if (low.includes("how old")) return "ask_age";
    return "unknown";
  }

  async function onUserMessage(text) {
    const input = $("#chatinput");
    const send = $("#btn-send");
    if (app.processing || app.finished) return;

    const t = (text || "").trim();
    if (!t) return;

    app.processing = true;
    if (input) input.disabled = true;
    if (send) send.disabled = true;

    const hangGuard = setTimeout(() => {
      app.processing = false;
      if (!app.finished) {
        if (input) input.disabled = false;
        if (send) send.disabled = false;
        input?.focus();
        soldierSay("Something got stuck. Please try again.", "system");
      }
    }, 7000);

    try {
      soldierSay(t);
      logEvent("message", { runId: app.runId, from: "student", text: t, step: app.step });

      const intent = matchIntent(t);

      if (intent === "deny") { await denyEntranceFlow("text"); return; }

      if (intent === "return_id") {
        hideIdCard();
        visitorSay("Thank you.");
        logEvent("return_id", { runId: app.runId, step: app.step });
        return;
      }

      if (intent === "ask_id") {
        app.flags.asked_id = true;
        visitorSay("Yes. Here you go.");
        showIdCard();
        logEvent("show_id", { runId: app.runId, step: app.step });
        ensureStepProgression();
        return;
      }

      // Supervisor via TEXT TRIGGER (no button exists)
      if (intent === "contact_supervisor") {
        app.flags.supervisor_contacted = true;
        logEvent("supervisor_trigger", { runId: app.runId, step: app.step, source: "text" });

        openSupervisorModal({
          who: app.visitor?.id?.name || "",
          why: app.visitor?.intake?.purpose || "",
          what: app.visitor?.intake?.subject || "",
          where: app.visitor?.intake?.goingWhere || "",
          when: app.visitor?.intake?.apptTime || "",
          with: app.visitor?.intake?.meetingWith || ""
        });

        visitorSay("Okay. Please contact your supervisor.", "supervisor");
        ensureStepProgression();
        return;
      }

      if (intent === "go_person_search") {
        logEvent("go_person_search", { runId: app.runId, step: app.step, source: "text" });
        beginPersonSearch();
        return;
      }

      if (intent === "ask_name") { app.flags.asked_name = true; visitorSay(visitorReplyForIntakeQuestion("name")); return; }
      if (intent === "ask_purpose") { app.flags.asked_purpose = true; visitorSay(visitorReplyForIntakeQuestion("purpose")); return; }

      if (intent === "ask_appointment") {
        app.flags.asked_appointment = true;
        visitorSay(visitorReplyForIntakeQuestion("appointment"));
        if (!app.visitor.intake.appointment) {
          visitorSay("I don’t have an appointment. Is that a problem?");
          setHint("Tip: try “I’ll contact my supervisor for approval.”");
        }
        return;
      }

      if (intent === "ask_who") { app.flags.asked_who = true; visitorSay(visitorReplyForIntakeQuestion("who")); return; }
      if (intent === "ask_time") { app.flags.asked_time = true; visitorSay(visitorReplyForIntakeQuestion("time")); return; }
      if (intent === "ask_where") { app.flags.asked_where = true; visitorSay(visitorReplyForIntakeQuestion("where")); return; }
      if (intent === "ask_subject") { app.flags.asked_subject = true; visitorSay(visitorReplyForIntakeQuestion("subject")); return; }

      if (intent === "ask_nationality") {
        app.flags.asked_nationality = true;
        const a = visitorControlAnswer("nationality");
        visitorSay(`I’m ${a.value}.`);
        if (a.inconsistent) visitorSay("Sorry… I meant that.", "mood");
        logEvent("control_nationality", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "ask_age") {
        app.flags.asked_age = true;
        const a = visitorControlAnswer("age");
        visitorSay(`I’m ${a.value} years old.`);
        if (a.inconsistent) visitorSay("Sorry, I’m tired.", "mood");
        logEvent("control_age", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "ask_dob") {
        app.flags.asked_dob = true;
        const a = visitorControlAnswer("dob");
        visitorSay(`My date of birth is ${a.value}.`);
        if (a.inconsistent) visitorSay("Sorry… I’m a bit nervous.", "mood");
        logEvent("control_dob", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "confirm_born_year") {
        app.flags.asked_dob = true;
        handleBornYearConfirm(t);
        logEvent("control_born_year", { runId: app.runId, step: app.step, userText: t });
        return;
      }

      // Nudge: after ID + supervisor -> threat/items
      if (app.step === STEPS.ID_CHECK && app.flags.asked_id && app.flags.supervisor_contacted) {
        explainThreatAndItems();
        setHint("Tip: type “Go to person search” when ready.");
        return;
      }

      if (intent === "smalltalk") { visitorSay("Hello."); return; }

      // Unknown
      app.unknowns += 1;
      visitorSay("Sorry, I don’t understand. Can you ask it another way?");
      if (LOG_UNKNOWN) logEvent("unknown_question", { runId: app.runId, step: app.step, text: t });
      setHint("Try short clear questions (5W/5WH). Example: “What is the purpose of your visit?”");
    } finally {
      clearTimeout(hangGuard);
      app.processing = false;
      if (!app.finished) {
        if (input) input.disabled = false;
        if (send) send.disabled = false;
        input?.focus();
      }
    }
  }

  /***********************
   * VOICE (Hold-to-talk)
   ***********************/
  function initVoice() {
    const micBtn = $("#btn-mic");
    const micStatus = $("#micStatus");
    const input = $("#chatinput");

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!micBtn || !micStatus || !input || !SR) {
      if (micBtn) micBtn.disabled = true;
      if (micStatus) micStatus.textContent = "Voice not supported in this browser.";
      app.speech.supported = false;
      return null;
    }

    app.speech.supported = true;

    const rec = new SR();
    rec.lang = VOICE_LANG;
    rec.interimResults = true;
    rec.continuous = false;

    const setStatus = (t) => { micStatus.textContent = t || ""; };

    rec.onstart = () => {
      app.speech.recognizing = true;
      app.speech.finalTranscript = "";
      setStatus("Listening… (hold)");
      micBtn.style.filter = "brightness(.95)";
    };

    rec.onerror = (e) => {
      setStatus(`Voice error: ${e?.error || "unknown"}`);
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) app.speech.finalTranscript += txt;
        else interim += txt;
      }
      const combined = (app.speech.finalTranscript + " " + interim).trim();
      if (combined) input.value = combined;
    };

    rec.onend = () => {
      app.speech.recognizing = false;
      micBtn.style.filter = "";
      setStatus(VOICE_AUTO_SEND && input.value.trim() ? "Recognized. Sending…" : "Recognized.");
      if (VOICE_AUTO_SEND && input.value.trim()) {
        const val = input.value;
        input.value = "";
        onUserMessage(val);
      }
      setTimeout(() => setStatus(""), 1200);
    };

    const start = () => {
      try {
        if (!app.speech.recognizing) rec.start();
      } catch {
        // Some browsers throw if start called too quickly
      }
    };
    const stop = () => {
      try {
        if (app.speech.recognizing) rec.stop();
      } catch {}
    };

    // Hold behavior: mouse + touch
    micBtn.addEventListener("mousedown", (e) => { e.preventDefault(); start(); });
    window.addEventListener("mouseup", () => stop());

    micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); start(); }, { passive:false });
    window.addEventListener("touchend", () => stop());

    return rec;
  }

  /***********************
   * INIT
   ***********************/
  async function init() {
    injectUi();

    app.visitor = buildVisitor();

    $("#runid").textContent = app.runId;
    $("#visitor-mood").textContent = app.visitor.mood.name;

    const img = $("#visitor-img");
    img.src = app.visitor.headshot;
    img.onerror = () => { img.src = "assets/photos/headshot_01.png"; };

    setStep(STEPS.INTAKE);

    app.phrasebank = await loadPhrasebank();
    app.intents = compilePatterns(app.phrasebank);

    // Teacher card (optional)
    const tcard = $("#teacher-card");
    if (tcard) tcard.style.display = teacherModeEnabled() ? "" : "none";
    if (teacherModeEnabled()) {
      $("#teacher-debug").innerHTML = `
        <div><b>App:</b> ${escapeHtml(APP_VERSION)}</div>
        <div><b>Patterns loaded:</b> ${escapeHtml(String(Object.keys(app.intents._raw || {}).length))}</div>
        <div><b>logEndpoint:</b> ${escapeHtml(LOG_ENDPOINT ? "set" : "missing")}</div>
        <div><b>voiceLang:</b> ${escapeHtml(VOICE_LANG)}</div>
        <div><b>voiceAutoSend:</b> ${escapeHtml(String(VOICE_AUTO_SEND))}</div>
      `;
    }

    // Start messages
    visitorSay("Hello.");
    visitorSay(`(Mood: ${app.visitor.mood.name})`, "visitor mood");
    soldierSay("Good day. Please state your name and the purpose of your visit.", "start");
    setHint("Start with 5W/5WH (name, purpose, appointment, who, time, where, subject).");

    logEvent("start", { runId: app.runId, mood: app.visitor.mood.name, step: app.step });

    // Composer
    const input = $("#chatinput");
    const send = $("#btn-send");

    function submit() {
      const val = input.value;
      input.value = "";
      onUserMessage(val);
    }

    send?.addEventListener("click", submit);
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

    // Deny always
    $("#btn-deny")?.addEventListener("click", () => denyEntranceFlow("button"));

    // ID controls
    $("#btn-return-id")?.addEventListener("click", () => {
      hideIdCard();
      visitorSay("Thank you.");
      logEvent("return_id", { runId: app.runId, step: app.step, source: "button" });
    });

    // Supervisor modal
    $("#sup-close")?.addEventListener("click", closeSupervisorModal);
    $("#sup-backdrop")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "sup-backdrop") closeSupervisorModal();
    });

    $("#sup-request")?.addEventListener("click", async () => {
      const p = supervisorPayloadFromModal();
      const missing = validateSupervisorFields(p);
      if (missing.length) {
        $("#sup-status").textContent = `Missing: ${missing.join(", ")}. Please fill them in.`;
        logEvent("supervisor_request_invalid", { runId: app.runId, missing, payload: p });
        return;
      }
      $("#sup-status").textContent = "Request sent. Waiting for supervisor decision…";
      logEvent("supervisor_request", { runId: app.runId, payload: p });
      setHint("(Teacher) Click Approve/Deny in the popup.");
    });

    $("#sup-approve")?.addEventListener("click", async () => {
      $("#sup-status").textContent = "Supervisor approves. Proceed with security measures.";
      logEvent("supervisor_approve", { runId: app.runId });
      closeSupervisorModal();
      visitorSay("Okay.", "supervisor");
      explainThreatAndItems();
      setHint("Next: type “Go to person search” when ready. Deny entrance always available.");
    });

    $("#sup-deny")?.addEventListener("click", async () => {
      $("#sup-status").textContent = "Supervisor denies. Deny entrance.";
      logEvent("supervisor_deny", { runId: app.runId });
      closeSupervisorModal();
      await denyEntranceFlow("supervisor_deny");
    });

    // Voice
    initVoice();

    if (!app.visitor.intake.appointment) {
      setTimeout(() => {
        soldierSay("If there is no appointment, you may need supervisor approval.", "hint");
        setHint("Try: “I’ll contact my supervisor for approval.”");
      }, 800);
    }

    // Focus
    input?.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
