/* app.js — VEVA Ingang/Uitgang Trainer (static, GitHub Pages)
   Clean version with:
   - No TDZ crash (STEPS defined before app state)
   - Supervisor button removed (and hard-hidden even if legacy UI exists)
   - Reliable text-trigger for supervisor modal
   - Reliable age/DOB questions incl. "Were you born in 1993?"
   - Reliable person-search + deny flow
*/

(() => {
  "use strict";

  /***********************
   * CONFIG + UTIL
   ***********************/
  const CONFIG = (window.APP_CONFIG || {});
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  function parseDateLike(text) {
    const t = (text || "").trim();

    // yyyy-mm-dd
    let m = t.match(/\b(19\d{2}|20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/);
    if (m) return { yyyy: Number(m[1]), mm: Number(m[2]), dd: Number(m[3]) };

    // dd-mm-yyyy
    m = t.match(/\b(0?[1-9]|[12]\d|3[01])[-\/.](0?[1-9]|1[0-2])[-\/.](19\d{2}|20\d{2})\b/);
    if (m) return { yyyy: Number(m[3]), mm: Number(m[2]), dd: Number(m[1]) };

    // "12 May 1993"
    m = t.match(/\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19\d{2}|20\d{2})\b/i);
    if (m) {
      const dd = Number(m[1]);
      const mon = safeLower(m[2]).slice(0, 3);
      const map = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
      const mm = map[mon] || null;
      const yyyy = Number(m[3]);
      if (mm) return { yyyy, mm, dd };
    }
    return null;
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
   * STATE MACHINE (DEFINED EARLY -> NO TDZ)
   ***********************/
  const STEPS = {
    INTAKE: "intake",
    ID_CHECK: "id_check",
    SUPERVISOR: "supervisor",
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
        /\bid\s+please\b/i,
        /\bsee\s+your\s+id\b/i
      ],
      return_id: [
        /\bhere('?s|\s+is)\s+your\s+id\s+back\b/i,
        /\b(return|give)\s+(it|the\s+id)\s+back\b/i,
        /\breturn\s+to\s+visitor\b/i
      ],
      contact_supervisor: [
        /\b(i\s+(will|’ll|'ll)\s+)?(contact|call|ring|phone)\s+(my\s+)?(supervisor|boss|officer|team\s*leader|manager)\b/i,
        /\blet\s+me\s+(contact|call)\s+(my\s+)?(supervisor|boss|team\s*leader|manager)\b/i
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
        /\bare\s+you\s+expected\b/i,
        /\bappointment\s+time\b/i
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
        /\bwhat\s+will\s+you\s+discuss\b/i,
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
        // were you born in 1993?
        /\bwere\s+you\s+born\s+in\s+('?)(\d{2}|\d{4})\1\b/i,
        // you were born in 1993, right?
        /\byou\s+were\s+born\s+in\s+('?)(\d{2}|\d{4})\1\b/i,
        // born in 1993?
        /\bborn\s+in\s+('?)(\d{2}|\d{4})\1\b/i
],
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
      smalltalk: [
        /\bhello\b/i, /\bhi\b/i, /\bgood\s+(morning|afternoon|evening)\b/i
      ]
    };

    const merged = { ...base };

    const addPatterns = (key, arr) => {
      if (!arr || !Array.isArray(arr)) return;
      merged[key] = merged[key] || [];
      for (const p of arr) {
        if (!p) continue;
        if (p instanceof RegExp) merged[key].push(p);
        else if (typeof p === "string") {
          try { merged[key].push(new RegExp(p, "i")); } catch { /* ignore */ }
        }
      }
    };

    if (extra) {
      const intentsObj = extra.intents && typeof extra.intents === "object" ? extra.intents : null;
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
    for (const [k, arr] of Object.entries(merged)) {
      compiled[k] = (text) => arr.some(rx => rx.test(text));
    }
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
    "Dutch", "German", "Belgian", "French", "Spanish", "Italian",
    "Polish", "Romanian", "Turkish", "British", "American", "Canadian"
  ];

  const NAMES = [
    "David", "Michael", "James", "Robert", "Daniel", "Thomas",
    "Mark", "Lucas", "Noah", "Adam", "Omar", "Yusuf", "Mateusz", "Julien", "Marco"
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
    const name = pick(NAMES) + " " + (["Johnson", "Miller", "Brown", "Davis", "Martinez", "Kowalski", "Nowak", "Schmidt", "Dubois", "Rossi", "Yilmaz"][Math.floor(Math.random() * 11)]);
    const age = calcAgeFromDob(dob);

    const id = {
      name,
      nationality: nat,
      dob,
      age,
      idNumber: randomIdNumber(),
      expiry: randomExpiry()
    };

    const idx = 1 + Math.floor(Math.random() * 12);
    const headshot = `assets/fotos/headshot_${String(idx).padStart(2, "0")}.png`;

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
   * LOGGING
   ***********************/
  async function logEvent(type, payload = {}) {
    if (!LOG_ENDPOINT) return;
    const body = { ts: nowIso(), type, ...payload };
    try {
      await fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true
      });
    } catch {
      // ignore
    }
  }

  /***********************
   * APP STATE (NO TDZ)
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
    messages: []
  };

  /***********************
   * UI (Chat UI)
   ***********************/
  function injectBaseUiIfMissing() {
    if ($("#veva-app")) return;

    const root = document.createElement("div");
    root.id = "veva-app";
    root.innerHTML = `
      <div class="veva-shell">
        <div class="veva-topbar">
          <div class="veva-title">
            <div class="veva-title-main">VEVA – Ingang/Uitgang Trainer</div>
            <div class="veva-title-sub">English checkpoint conversation practice</div>
          </div>
          <div class="veva-actions">
            <button class="veva-btn veva-btn-ghost" id="btn-toggle-id" title="(Hidden) Toggle ID card">ID</button>
            <button class="veva-btn veva-btn-danger" id="btn-deny">Deny entrance</button>
            <button class="veva-btn" id="btn-finish" style="display:none;">Finish run</button>
          </div>
        </div>

        <div class="veva-main">
          <div class="veva-chat">
            <div class="veva-chatlog" id="chatlog" aria-live="polite"></div>

            <div class="veva-composer">
              <input id="chatinput" type="text" autocomplete="off" placeholder="Type your question…" />
              <button class="veva-btn" id="btn-send">Send</button>
            </div>

            <div class="veva-hint" id="hintline"></div>
          </div>

          <aside class="veva-side" id="sidebar">
            <div class="veva-card">
              <div class="veva-card-title">Visitor</div>
              <div class="veva-visitor">
                <img id="visitor-img" alt="Visitor headshot" />
                <div class="veva-visitor-meta">
                  <div><b>Mood:</b> <span id="visitor-mood"></span></div>
                  <div><b>Run ID:</b> <span id="runid"></span></div>
                  <div><b>Step:</b> <span id="stepname"></span></div>
                </div>
              </div>
            </div>

            <div class="veva-card" id="idcard" style="display:none;">
              <div class="veva-card-title">ID card</div>
              <div class="veva-idcard">
                <div><b>Name:</b> <span id="id-name"></span></div>
                <div><b>Nationality:</b> <span id="id-nat"></span></div>
                <div><b>DOB:</b> <span id="id-dob"></span></div>
                <div><b>Age:</b> <span id="id-age"></span></div>
                <div><b>ID nr:</b> <span id="id-nr"></span></div>
                <div><b>Expiry:</b> <span id="id-exp"></span></div>
              </div>
              <div class="veva-id-actions">
                <button class="veva-btn veva-btn-ghost" id="btn-return-id">Return to visitor</button>
              </div>
            </div>

            <div class="veva-card" id="teacher-card" style="display:none;">
              <div class="veva-card-title">Teacher</div>
              <div class="veva-small">
                Hidden mode. Toggle via <code>?teacher=1</code> or set <code>localStorage.veva_teacher_mode=1</code>.
              </div>
              <div class="veva-small" id="teacher-debug"></div>
            </div>
          </aside>
        </div>

        <!-- Supervisor Modal -->
        <div class="veva-modal-backdrop" id="sup-backdrop" style="display:none;">
          <div class="veva-modal" role="dialog" aria-modal="true" aria-label="Supervisor contact">
            <div class="veva-modal-head">
              <div class="veva-modal-title">Contact supervisor</div>
              <button class="veva-btn veva-btn-ghost" id="sup-close">Close</button>
            </div>

            <div class="veva-modal-body">
              <div class="veva-small">Fill in the 5W/5WH details before requesting approval.</div>
              <div class="veva-grid">
                <label>Who (visitor name)<input id="sup-who" type="text" /></label>
                <label>Why (purpose)<input id="sup-why" type="text" /></label>
                <label>What (subject)<input id="sup-what" type="text" /></label>
                <label>Where (destination)<input id="sup-where" type="text" /></label>
                <label>When (time)<input id="sup-when" type="text" /></label>
                <label>With whom (appointment with)<input id="sup-with" type="text" /></label>
              </div>

              <div class="veva-sup-actions">
                <button class="veva-btn" id="sup-request">Request approval</button>
                <button class="veva-btn veva-btn-danger" id="sup-deny">Supervisor denies</button>
                <button class="veva-btn veva-btn-ok" id="sup-approve">Supervisor approves</button>
              </div>

              <div class="veva-small" id="sup-status"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const mount = $("#app") || document.body;
    mount.appendChild(root);

    const style = document.createElement("style");
    style.textContent = `
      .veva-shell{height:calc(100vh - 10px);display:flex;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;}
      .veva-topbar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.08);}
      .veva-title-main{font-weight:800;font-size:16px;line-height:1.1}
      .veva-title-sub{opacity:.7;font-size:12px}
      .veva-actions{display:flex;gap:8px;align-items:center}
      .veva-main{flex:1;display:grid;grid-template-columns:1fr 320px;gap:10px;padding:10px;min-height:0;}
      .veva-chat{display:flex;flex-direction:column;min-height:0;border:1px solid rgba(0,0,0,.08);border-radius:14px;overflow:hidden}
      .veva-chatlog{flex:1;overflow:auto;padding:12px;background:rgba(0,0,0,.02)}
      .veva-composer{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(0,0,0,.08);background:white}
      #chatinput{flex:1;padding:10px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.16);font-size:14px}
      .veva-btn{padding:9px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.14);background:white;cursor:pointer;font-weight:650}
      .veva-btn:hover{filter:brightness(.98)}
      .veva-btn-ghost{opacity:.8}
      .veva-btn-danger{border-color:rgba(200,0,0,.25);background:rgba(255,0,0,.06)}
      .veva-btn-ok{border-color:rgba(0,160,80,.35);background:rgba(0,160,80,.08)}
      .veva-hint{font-size:12px;opacity:.75;padding:8px 12px;border-top:1px dashed rgba(0,0,0,.12);background:white}
      .veva-side{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px}
      .veva-card{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:white}
      .veva-card-title{font-weight:800;margin-bottom:8px}
      .veva-visitor{display:flex;gap:10px;align-items:center}
      #visitor-img{width:64px;height:64px;border-radius:14px;object-fit:cover;border:1px solid rgba(0,0,0,.12);background:rgba(0,0,0,.04)}
      .veva-visitor-meta{font-size:12px;opacity:.9}
      .veva-idcard{font-size:12px;display:flex;flex-direction:column;gap:4px}
      .veva-id-actions{margin-top:8px}
      .bubble{max-width:min(78%,560px);padding:10px 12px;border-radius:16px;margin:8px 0;line-height:1.35;font-size:14px;box-shadow:0 1px 0 rgba(0,0,0,.05)}
      .bubble.left{background:white;border:1px solid rgba(0,0,0,.08);margin-right:auto}
      .bubble.right{background:rgba(0,0,0,.88);color:white;margin-left:auto}
      .bubble .meta{font-size:11px;opacity:.72;margin-top:6px}
      .veva-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px;z-index:9999}
      .veva-modal{width:min(720px,95vw);background:white;border-radius:16px;border:1px solid rgba(0,0,0,.12);overflow:hidden}
      .veva-modal-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.08)}
      .veva-modal-title{font-weight:900}
      .veva-modal-body{padding:12px;display:flex;flex-direction:column;gap:10px}
      .veva-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .veva-grid label{font-size:12px;opacity:.9;display:flex;flex-direction:column;gap:6px}
      .veva-grid input{padding:9px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.16)}
      .veva-sup-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .veva-small{font-size:12px;opacity:.8}
      @media (max-width: 980px){
        .veva-main{grid-template-columns:1fr}
        .veva-side{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function setStep(step) {
    app.step = step;
    const stepEl = $("#stepname");
    if (stepEl) stepEl.textContent = step;
  }

  function setHint(text) {
    const el = $("#hintline");
    if (el) el.textContent = text || "";
  }

  function addBubble(side, text, meta = "") {
    const log = $("#chatlog");
    if (!log) return;
    const div = document.createElement("div");
    div.className = `bubble ${side}`;
    div.innerHTML = `
      <div class="txt">${escapeHtml(text)}</div>
      ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
    `;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function soldierSay(text, meta) {
    app.messages.push({ from: "soldier", text, ts: nowIso() });
    addBubble("right", text, meta);
  }

  function visitorSay(text, meta) {
    app.messages.push({ from: "visitor", text, ts: nowIso() });
    addBubble("left", text, meta);
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
    const fill = (id, val) => {
      const el = $(id);
      if (el) el.value = val || "";
    };

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
    for (const k of ["who", "why", "what", "where", "when"]) {
      if (!p[k]) missing.push(k);
    }
    return missing;
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
    if (kind === "nationality") {
      const other = pick(NATIONALITIES.filter(n => n !== v.id.nationality));
      return other;
    }
    if (kind === "name") {
      return pick(NAMES) + " " + pick(["Johnson", "Miller", "Brown", "Davis", "Rossi", "Schmidt"]);
    }
    return "";
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

    const fin = $("#btn-finish");
    if (fin) fin.style.display = "";

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
    await logEvent("deny", { runId: app.runId, source, step: app.step });
    await sleep(900);
    endRun("denied");
  }

  function ensureStepProgression() {
    if (app.step === STEPS.INTAKE) {
      if (app.flags.asked_id) setStep(STEPS.ID_CHECK);
    }
    if (app.step === STEPS.ID_CHECK) {
      if (app.flags.supervisor_contacted) setStep(STEPS.THREAT_ITEMS);
    }
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
    const trueYear = v.id.dob.yyyy;

    const claim = visitorControlAnswer("dob");
    const claimYear = parseYear(claim.value) || trueYear;

    if (!yearAsked) return visitorSay("Sorry, could you repeat the year?");
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

  /***********************
   * SUPERVISOR BUTTON KILL (even if legacy UI exists)
   ***********************/
  function supervisorKillStart() {
    const RX_SUP_BTN = /(contact\s+supervisor|contact\s+leidinggevende)/i;

    function allClickable() {
      return Array.from(document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']"));
    }
    function findSupervisorButtons() {
      return allClickable().filter(el => RX_SUP_BTN.test((el.textContent || el.value || "").trim()));
    }
    function hide() {
      const btns = findSupervisorButtons();
      btns.forEach(btn => {
        btn.dataset.vevaSupHidden = "1";
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
        btn.style.setProperty("pointer-events", "none", "important");
        btn.setAttribute("aria-hidden", "true");
        btn.tabIndex = -1;
      });
    }
    hide();
    const mo = new MutationObserver(hide);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  /***********************
   * INTENTS
   ***********************/
  function matchIntent(text) {
    const t = text || "";
    const I = app.intents;

    const order = [
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

    for (const [key, fn] of order) {
      if (I?.[fn] && I[fn](t)) return key;
    }

    const low = safeLower(t);
    if (low.includes("date of birth") || low === "dob") return "ask_dob";
    if (low.includes("how old")) return "ask_age";
    if (/\bborn in\b/.test(low) && parseYear(low)) return "confirm_born_year";

    return "unknown";
  }

  /***********************
   * MAIN MESSAGE HANDLER
   ***********************/
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
        if (input) input.focus();
        soldierSay("Something got stuck. Please try again.", "system");
      }
    }, 7000);

    try {
      soldierSay(t);
      await logEvent("message", { runId: app.runId, from: "student", text: t, step: app.step });

      const intent = matchIntent(t);

      // Deny ALWAYS
      if (intent === "deny") {
        await denyEntranceFlow("text");
        return;
      }

      // Return ID ALWAYS
      if (intent === "return_id") {
        hideIdCard();
        visitorSay("Thank you.");
        await logEvent("return_id", { runId: app.runId, step: app.step });
        return;
      }

      // Ask ID
      if (intent === "ask_id") {
        app.flags.asked_id = true;
        visitorSay("Yes. Here you go.");
        showIdCard();
        await logEvent("show_id", { runId: app.runId, step: app.step });
        ensureStepProgression();
        return;
      }

      // Contact supervisor (TEXT trigger)
      if (intent === "contact_supervisor") {
        app.flags.supervisor_contacted = true;
        await logEvent("supervisor_trigger", { runId: app.runId, step: app.step, source: "text" });

        // open immediately
        openSupervisorModal();
        visitorSay("Okay. Please contact your supervisor.", "supervisor");
        ensureStepProgression();
        return;
      }

      // Person search
      if (intent === "go_person_search") {
        await logEvent("go_person_search", { runId: app.runId, step: app.step, source: "text" });
        beginPersonSearch();
        return;
      }

      // Intake
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

      // Control questions
      if (intent === "ask_nationality") {
        app.flags.asked_nationality = true;
        const a = visitorControlAnswer("nationality");
        visitorSay(`I’m ${a.value}.`);
        if (a.inconsistent) visitorSay("Sorry… I meant that.", "mood");
        await logEvent("control_nationality", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "ask_age") {
        app.flags.asked_age = true;
        const a = visitorControlAnswer("age");
        visitorSay(`I’m ${a.value} years old.`);
        if (a.inconsistent) visitorSay("Sorry, I’m tired.", "mood");
        await logEvent("control_age", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "ask_dob") {
        app.flags.asked_dob = true;
        const a = visitorControlAnswer("dob");
        visitorSay(`My date of birth is ${a.value}.`);
        if (a.inconsistent) visitorSay("Sorry… I’m a bit nervous.", "mood");
        await logEvent("control_dob", { runId: app.runId, step: app.step, value: a.value, lied: a.lied });
        return;
      }

      if (intent === "confirm_born_year") {
        app.flags.asked_dob = true;
        handleBornYearConfirm(t);
        await logEvent("control_born_year", { runId: app.runId, step: app.step, userText: t });
        return;
      }

      // Nudge after ID + supervisor
      if (app.step === STEPS.ID_CHECK && app.flags.asked_id && app.flags.supervisor_contacted) {
        explainThreatAndItems();
        setHint("Tip: type “Go to person search” when ready.");
        return;
      }

      if (intent === "smalltalk") {
        visitorSay("Hello.");
        return;
      }

      // Unknown
      app.unknowns += 1;
      visitorSay("Sorry, I don’t understand. Can you ask it another way?");
      if (LOG_UNKNOWN) await logEvent("unknown_question", { runId: app.runId, step: app.step, text: t });
      setHint("Try short clear questions (5W/5WH). Example: “What is the purpose of your visit?”");
    } finally {
      clearTimeout(hangGuard);
      app.processing = false;
      if (!app.finished) {
        if (input) input.disabled = false;
        if (send) send.disabled = false;
        if (input) input.focus();
      }
    }
  }

  /***********************
   * INIT / WIRING
   ***********************/
  async function init() {
    // Kill any legacy supervisor button UI (if present)
    supervisorKillStart();

    // Always use our UI (inject if missing)
    injectBaseUiIfMissing();

    // Hide dev-only ID toggle for students
    const idToggle = $("#btn-toggle-id");
    if (idToggle) idToggle.style.display = teacherModeEnabled() ? "" : "none";

    // Setup run
    app.visitor = buildVisitor();
    $("#runid").textContent = app.runId;
    $("#visitor-mood").textContent = app.visitor.mood.name;
    $("#visitor-img").src = app.visitor.headshot;
    setStep(STEPS.INTAKE);

    // Patterns
    app.phrasebank = await loadPhrasebank();
    app.intents = compilePatterns(app.phrasebank);

    // Teacher card
    const tcard = $("#teacher-card");
    if (tcard) tcard.style.display = teacherModeEnabled() ? "" : "none";
    if (teacherModeEnabled()) {
      $("#teacher-debug").innerHTML = `
        <div><b>Patterns loaded:</b> ${Object.keys(app.intents._raw || {}).length}</div>
        <div><b>logEndpoint:</b> ${escapeHtml(LOG_ENDPOINT ? "set" : "missing")}</div>
      `;
    }

    // Start messages
    visitorSay("Hello.");
    visitorSay(`(Mood: ${app.visitor.mood.name})`, "visitor mood");
    soldierSay("Good day. Please state your name and the purpose of your visit.", "start");
    setHint("Start with 5W/5WH (name, purpose, appointment, who, time, where, subject).");

    // Log start
    logEvent("start", { runId: app.runId, mood: app.visitor.mood.name, step: app.step });

    // Composer
    const input = $("#chatinput");
    const send = $("#btn-send");

    function submit() {
      const v = input.value;
      input.value = "";
      onUserMessage(v);
    }

    send?.addEventListener("click", submit);
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

    // Autofocus
    if (input) setTimeout(() => input.focus(), 0);

    // Deny always
    $("#btn-deny")?.addEventListener("click", () => denyEntranceFlow("button"));

    // Finish
    $("#btn-finish")?.addEventListener("click", () => endRun("manual_finish"));

    // ID controls
    $("#btn-return-id")?.addEventListener("click", () => {
      hideIdCard();
      visitorSay("Thank you.");
      logEvent("return_id", { runId: app.runId, step: app.step, source: "button" });
    });
    $("#btn-toggle-id")?.addEventListener("click", () => {
      if (app.idVisible) hideIdCard(); else showIdCard();
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
        await logEvent("supervisor_request_invalid", { runId: app.runId, missing, payload: p });
        return;
      }
      $("#sup-status").textContent = "Request sent. Waiting for supervisor decision…";
      await logEvent("supervisor_request", { runId: app.runId, payload: p });
      setHint("Supervisor decision: click Approve/Deny in the popup (teacher) or proceed when instructed.");
    });

    $("#sup-approve")?.addEventListener("click", async () => {
      $("#sup-status").textContent = "Supervisor approves. Proceed with security measures.";
      await logEvent("supervisor_approve", { runId: app.runId });
      closeSupervisorModal();
      visitorSay("Okay.", "supervisor");
      explainThreatAndItems();
      setHint("Next: type “Go to person search” when ready. Deny entrance always available.");
    });

    $("#sup-deny")?.addEventListener("click", async () => {
      $("#sup-status").textContent = "Supervisor denies. Deny entrance.";
      await logEvent("supervisor_deny", { runId: app.runId });
      closeSupervisorModal();
      await denyEntranceFlow("supervisor_deny");
    });

    if (!app.visitor.intake.appointment) {
      setTimeout(() => {
        soldierSay("If there is no appointment, you may need supervisor approval.", "hint");
        setHint("Try: “I’ll contact my supervisor for approval.”");
      }, 800);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
