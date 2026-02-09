(() => {
  "use strict";

  const APP_VERSION = "veva-whatsapp-v3-2026-02-09";
  console.log("[VEVA]", APP_VERSION, "loaded");

  const CONFIG = window.APP_CONFIG || {};
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true;
  const VOICE_LANG = CONFIG.voiceLang || "en-US";

  const $id = (id) => document.getElementById(id);

  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function safeLower(s) { return (s || "").toString().trim().toLowerCase(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function chance(p) { return Math.random() < clamp(p, 0, 1); }

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

  async function logEvent(type, payload = {}) {
    if (!LOG_ENDPOINT) return;
    const body = JSON.stringify({ ts: nowIso(), type, ...payload });
    try { await fetch(LOG_ENDPOINT, { method: "POST", mode: "no-cors", body }); } catch {}
  }

  /***********************
   * HARD FIX: supervisor button NEVER appears
   ***********************/
  function nukeSupervisorButton() {
    // Remove by known ID
    const sup = $id("btnContactSupervisor");
    if (sup) sup.remove();

    // Also remove any accidental duplicates
    const allBtns = Array.from(document.querySelectorAll("button, .btn"));
    for (const b of allBtns) {
      const t = (b.textContent || "").trim().toLowerCase();
      if (t === "contact supervisor") b.remove();
    }
  }

  // Keep it nuked if something re-adds it
  function enforceSupervisorNukeForever() {
    nukeSupervisorButton();
    const mo = new MutationObserver(() => nukeSupervisorButton());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  /***********************
   * Visitor generation
   ***********************/
  const MOODS = [
    { key: "relaxed", text: "The visitor looks relaxed and confident.", lieBoost: 0.02, inconsBoost: 0.02 },
    { key: "tired", text: "The visitor looks tired but cooperative.", lieBoost: 0.05, inconsBoost: 0.05 },
    { key: "uneasy", text: "The visitor looks uneasy.", lieBoost: 0.10, inconsBoost: 0.12 },
    { key: "nervous", text: "The visitor looks nervous.", lieBoost: 0.18, inconsBoost: 0.20 },
    { key: "irritated", text: "The visitor looks irritated.", lieBoost: 0.12, inconsBoost: 0.10 }
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
    const last = pick(["Johnson", "Miller", "Brown", "Davis", "Martinez", "Kowalski", "Nowak", "Schmidt", "Dubois", "Rossi", "Yilmaz"]);
    const name = pick(NAMES) + " " + last;
    const age = calcAgeFromDob(dob);

    const idx = 1 + Math.floor(Math.random() * 12);
    const headshot = `assets/photos/headshot_${String(idx).padStart(2, "0")}.png`;

    const purpose = pick(["delivery", "maintenance", "meeting", "visit", "contract work"]);
    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30", "10:00", "13:15", "14:00", "15:45"]) : null;
    const meetingWith = appointment ? pick(["Captain Lewis", "Sgt. van Dijk", "Mr. Peters", "Lt. Schmidt"]) : null;

    const subject = pick([
      "paperwork",
      "equipment handover",
      "maintenance report",
      "security briefing",
      "contract discussion",
      "inspection follow-up",
      "replacement parts delivery"
    ]);

    const goingWhere = pick(["HQ building", "Logistics office", "Barracks admin", "Workshop"]);

    return {
      mood,
      headshot,
      id: { name, nationality: nat, dob, age, idNumber: randomIdNumber(), expiry: randomExpiry() },
      intake: { purpose, appointment, apptTime, meetingWith, goingWhere, subject },
      claims: { age: null, dob: null, nationality: null, name: null },
      inconsistencies: [],
      idShown: false
    };
  }

  /***********************
   * Intents (broader English)
   ***********************/
  function compilePatterns(extra) {
    const base = {
      // Opening / helper
      hello: [
        /\b(hello|hi|hey)\b/i,
        /\bgood\s+(morning|afternoon|evening)\b/i
      ],
      help_offer: [
        /\b(can|could)\s+i\s+help\b/i,
        /\bhow\s+(can|may)\s+i\s+help\b/i,
        /\bwhat\s+can\s+i\s+do\s+for\s+you\b/i,
        /\bsure\b/i,
        /\bof\s+course\b/i,
        /\byes\b/i
      ],

      // ID
      ask_id: [
        /\b(can|could|may)\s+i\s+(see|check|verify|inspect|look\s+at)\s+(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(show|present)\s+(me\s+)?(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(id|identification|passport)\s+(please|pls)\b/i,
        /\bdo\s+you\s+(have|carry)\s+(an?\s+)?(id|identification|passport)\b/i,
        /\blet\s+me\s+(see|check)\s+(your|ur)\s+(id|identification)\b/i
      ],
      return_id: [
        /\bhere\s+(is|are)\s+(your|ur)\s+(id|card|identification)\s+back\b/i,
        /\b(return|give)\s+(it|the\s+(id|card|identification))\s+back\b/i,
        /\byou\s+can\s+have\s+(your|ur)\s+(id|card)\s+back\b/i,
        /\breturn\s+your\s+(id|card)\b/i
      ],

      // Supervisor (TEXT ONLY)
      contact_supervisor: [
        /\b(i\s*(will|’ll|'ll|need\s+to|have\s+to|must|may\s+need\s+to)\s+)?(contact|call|ring|phone|speak\s+to|talk\s+to|ask)\s+(my\s+)?(supervisor|boss|manager|team\s*leader|officer)\b/i,
        /\b(i\s*(will|’ll|'ll)\s+)?(have\s+to|need\s+to|must)\s+ask\s+(my\s+)?(supervisor|boss|manager)\b/i,
        /\b(i\s+)?need\s+(approval|authori[sz]ation|permission)\b/i,
        /\bfor\s+(approval|authori[sz]ation|permission)\b/i
      ],

      // 5W/5WH intake
      ask_name: [
        /\bwhat\s*(is|'s)\s+your\s+name\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i,
        /\bmay\s+i\s+have\s+your\s+name\b/i,
        /\bstate\s+your\s+name\b/i,
        /\bwho\s+are\s+you\b/i
      ],
      ask_purpose: [
        /\bwhat\s*(is|'s)\s+the\s+purpose\s+of\s+(your\s+)?visit\b/i,
        /\bwhat\s+are\s+you\s+here\s+for\b/i,
        /\bwhy\s+are\s+you\s+here\b/i,
        /\bwhat\s+brings\s+you\s+here\b/i,
        /\breason\s+for\s+(your\s+)?visit\b/i
      ],
      ask_appointment: [
        /\bdo\s+you\s+have\s+(an?\s+)?appointment\b/i,
        /\bare\s+you\s+expected\b/i,
        /\bdo\s+they\s+expect\s+you\b/i,
        /\bis\s+this\s+pre[-\s]?arranged\b/i
      ],
      ask_who: [
        /\bwho\s+are\s+you\s+(here\s+to\s+see|meeting|visiting)\b/i,
        /\bwho\s+is\s+(your\s+)?(appointment|meeting)\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\b/i,
        /\bwho\s+is\s+your\s+contact\b/i,
        /\bwith\s+whom\s+are\s+you\s+meeting\b/i,     // your request
        /\bwith\s+who\s+are\s+you\s+meeting\b/i        // student mistake tolerated
      ],
      ask_time: [
        /\bwhat\s+time\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhen\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhat\s+time\s+are\s+you\s+expected\b/i,
        /\bwhen\s+are\s+you\s+expected\b/i
      ],
      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhat\s+is\s+your\s+destination\b/i,
        /\bwhich\s+(building|unit|office|department|area)\b/i,
        /\bwhere\s+is\s+the\s+(meeting|appointment)\b/i
      ],
      ask_subject: [
        /\bwhat\s+is\s+(this|it|the\s+visit|the\s+meeting)\s+about\b/i,
        /\bwhat\s+will\s+you\s+discuss\b/i,
        /\bwhat\s+are\s+you\s+here\s+to\s+discuss\b/i,
        /\bcan\s+you\s+tell\s+me\s+more\s+about\s+(the\s+)?(meeting|visit)\b/i,
        /\bwhy\s+is\s+the\s+meeting\b/i
      ],

      // Control
      ask_age: [
        /\bhow\s+old\s+are\s+you\b/i,
        /\bwhat\s+is\s+your\s+age\b/i,
        /\bwhat\s+age\s+are\s+you\b/i
      ],
      ask_dob: [
        /\bwhat\s*(is|'s)\s+your\s+(date\s+of\s+birth|dob)\b/i,
        /\bdate\s+of\s+birth\b/i,
        /\bdob\b/i,
        /\bwhen\s+were\s+you\s+born\b/i
      ],
      confirm_born_year: [
        /\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i,
        /\bis\s+your\s+birth\s+year\s+(19\d{2}|20\d{2})\b/i
      ],
      ask_nationality: [
        /\bwhat\s+is\s+your\s+nationality\b/i,
        /\bwhat\s+nationality\s+are\s+you\b/i,
        /\bwhere\s+are\s+you\s+from\b/i,
        /\bwhat\s+country\s+are\s+you\s+from\b/i,
        /\bwhat\s+is\s+your\s+citizenship\b/i
      ],

      // Person search
      go_person_search: [
        /\b(go\s+to|start|begin|proceed\s+to)\s+(the\s+)?(person\s+search|pat[-\s]?down|frisk|search)\b/i,
        /\b(i\s+will|we\s+will|i\s+am\s+going\s+to)\s+(pat\s+you\s+down|search\s+you|do\s+a\s+pat[-\s]?down)\b/i
      ],

      // Deny
      deny: [
        /\bdeny\s+(entrance|entry|access)\b/i,
        /\b(refuse|reject)\s+(entry|access)\b/i,
        /\byou\s+cannot\s+enter\b/i,
        /\byou\s+may\s+not\s+enter\b/i,
        /\bnot\s+allowed\s+to\s+enter\b/i,
        /\bi\s+(am\s+)?(denying|refusing)\s+(entry|access)\b/i
      ]
    };

    const merged = { ...base };

    // phrasebank merge (optional)
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
    for (const [k, arr] of Object.entries(merged)) {
      compiled[k] = (text) => arr.some(rx => rx.test(text || ""));
    }
    compiled._raw = merged;
    return compiled;
  }

  async function loadPhrasebank() {
    try {
      const res = await fetch("phrasebank.json", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function matchIntent(intents, text) {
    if (!intents) return "unknown";
    for (const k of Object.keys(intents)) {
      if (k === "_raw") continue;
      if (intents[k](text)) return k;
    }
    return "unknown";
  }

  /***********************
   * UI helpers: ONLY LAST bubble text
   ***********************/
  function setVisitorBubble(text) {
    const bubble = $id("visitorBubble");
    if (bubble) bubble.textContent = text || "";
  }
  function setVisitorMood(text) {
    const mood = $id("visitorMood");
    if (mood) mood.textContent = text || "";
  }
  function setStudentBubble(text) {
    const bubble = $id("studentBubble");
    if (!bubble) return;
    bubble.textContent = text || "";
    bubble.style.display = text ? "" : "none";
  }

  /***********************
   * ID panel show/hide (INLINE, not fullscreen)
   ***********************/
  function ensureIdCloseButton() {
    const panel = $id("idPanel");
    if (!panel) return;
    if (panel.querySelector("#btnCloseIdPanel")) return;

    const btn = document.createElement("button");
    btn.id = "btnCloseIdPanel";
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = "Close ID";
    btn.style.marginTop = "10px";

    btn.addEventListener("click", () => {
      hideIdPanel();
      // polite visitor line
      if (state.visitor) visitorSays("Thank you.", state.visitor.mood.text);
    });

    panel.appendChild(btn);
  }

  function showIdPanel() {
    const panel = $id("idPanel");
    if (!panel) return;
    ensureIdCloseButton();
    panel.style.display = "";
  }

  function hideIdPanel() {
    const panel = $id("idPanel");
    if (!panel) return;
    panel.style.display = "none";
  }

  function clearIdCanvas() {
    const canvas = $id("idCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawIdCard(visitor) {
    const canvas = $id("idCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(0, 0, W, H);

    // header bar
    ctx.fillStyle = "#163a66";
    ctx.fillRect(0, 0, W, 92);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("VISITOR ID", 32, 58);

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("Checkpoint Access Card", 34, 80);

    // photo box
    ctx.fillStyle = "#e8ecf5";
    ctx.fillRect(34, 128, 190, 240);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(34, 128, 190, 240);

    const v = visitor.id;
    const rows = [
      ["Name", v.name],
      ["Nationality", v.nationality],
      ["DOB", formatDob(v.dob)],
      ["Age", String(v.age)],
      ["ID nr", v.idNumber],
      ["Expiry", formatDob(v.expiry)]
    ];

    let y = 150;
    ctx.fillStyle = "#111827";
    for (const [label, value] of rows) {
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(label + ":", 260, y);
      ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(value, 380, y);
      y += 44;
    }

    // barcode-ish footer
    ctx.fillStyle = "#111827";
    for (let i = 0; i < 140; i++) {
      const x = 34 + i * 5;
      const w = (i % 3 === 0) ? 2 : 1;
      const h = (i % 7 === 0) ? 70 : 50;
      ctx.fillRect(x, H - 110, w, h);
    }

    ctx.fillStyle = "rgba(17,24,39,0.75)";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Valid only for stated purpose. Subject to search and denial.", 34, H - 22);

    // face
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(34, 128, 190, 240);
      ctx.clip();
      ctx.drawImage(img, 34, 128, 190, 240);
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(34, 128, 190, 240);
    };
    img.src = visitor.headshot;
  }

  /***********************
   * Lies / inconsistencies
   ***********************/
  function makeFakeControl(visitor, kind) {
    if (kind === "age") {
      const delta = pick([-2, -1, 1, 2, 3]);
      return String(clamp(visitor.id.age + delta, 18, 70));
    }
    if (kind === "dob") {
      const dob = { ...visitor.id.dob };
      if (chance(0.5)) dob.dd = clamp(dob.dd + pick([-2, -1, 1, 2]), 1, 28);
      else dob.mm = clamp(dob.mm + pick([-1, 1]), 1, 12);
      return formatDob(dob);
    }
    if (kind === "nationality") return pick(NATIONALITIES.filter(n => n !== visitor.id.nationality));
    if (kind === "name") return pick(NAMES) + " " + pick(["Johnson", "Miller", "Brown", "Davis", "Rossi", "Schmidt"]);
    return "";
  }

  function visitorControlAnswer(visitor, kind) {
    const mood = visitor.mood;
    const lieP = 0.04 + mood.lieBoost;
    const inconsP = 0.05 + mood.inconsBoost;

    const truth = (() => {
      if (kind === "age") return String(visitor.id.age);
      if (kind === "dob") return formatDob(visitor.id.dob);
      if (kind === "nationality") return visitor.id.nationality;
      if (kind === "name") return visitor.id.name;
      return "";
    })();

    const prev = visitor.claims[kind];
    if (prev) {
      if (chance(inconsP)) {
        const fake = makeFakeControl(visitor, kind);
        if (fake !== prev) {
          visitor.inconsistencies.push({ kind, prev, next: fake, ts: nowIso() });
          visitor.claims[kind] = fake;
          return { value: fake, lied: true, inconsistent: true };
        }
      }
      return { value: prev, lied: prev !== truth, inconsistent: false };
    }

    if (chance(lieP)) {
      const fake = makeFakeControl(visitor, kind);
      visitor.claims[kind] = fake;
      return { value: fake, lied: fake !== truth, inconsistent: false };
    }

    visitor.claims[kind] = truth;
    return { value: truth, lied: false, inconsistent: false };
  }

  /***********************
   * Feedback requirements
   ***********************/
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
    { key: "did_person_search", label: "You didn’t complete the person search step.", example: "I’m going to do a quick pat-down search. Is that okay?" }
  ];

  /***********************
   * App state
   ***********************/
  const state = {
    runId: uid(),
    student: { name: "", className: "", difficulty: "" },
    visitor: null,
    intents: null,
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
      did_person_search: false
    },
    finished: false,
    unknowns: 0,

    // opening stages:
    // "hello_shown" -> visitor said hello
    // "help_prompted" -> student greeted; visitor asked can you help me
    // "ready" -> student offered help; visitor stated "I need to get onto the base."
    opening: "hello_shown"
  };

  function showScreen(which) {
    const a = $id("screen-login");
    const b = $id("screen-train");
    const c = $id("screen-feedback");
    if (!a || !b || !c) return;

    a.classList.toggle("hidden", which !== "login");
    b.classList.toggle("hidden", which !== "train");
    c.classList.toggle("hidden", which !== "feedback");
  }

  function setStep(title, help) {
    const t = $id("stepTitle");
    const h = $id("stepHelp");
    if (t) t.textContent = title || "";
    if (h) h.textContent = help || "";
  }

  function resetBubbles() {
    setVisitorBubble("");
    setStudentBubble("");
    setVisitorMood(state.visitor?.mood?.text || "");
  }

  /***********************
   * Supervisor modal (still available, but only via text intent)
   ***********************/
  function openSupervisorModal() {
    const modal = $id("supervisorModal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const v = state.visitor;
    if ($id("wWho")) $id("wWho").value = v?.id?.name || "";
    if ($id("wWhat")) $id("wWhat").value = v?.intake?.purpose || "";
    if ($id("wWithWhom")) $id("wWithWhom").value = v?.intake?.meetingWith || "";
    if ($id("wTime")) $id("wTime").value = v?.intake?.apptTime || "";
    if ($id("wWhy")) $id("wWhy").value = v?.intake?.subject || "";

    const resp = $id("supervisorResponse");
    if (resp) resp.textContent = "";
  }

  function closeSupervisorModal() {
    const modal = $id("supervisorModal");
    if (!modal) return;
    modal.classList.add("hidden");
  }

  /***********************
   * Conversation: single bubble updates
   ***********************/
  function visitorSays(text, moodLine = null) {
    setVisitorBubble(text);
    if (moodLine !== null) setVisitorMood(moodLine);
  }

  function studentSays(text) {
    setStudentBubble(text);
  }

  function handleBornYearConfirm(userText) {
    const yearAsked = parseYear(userText);
    if (!yearAsked) {
      visitorSays("Sorry, could you repeat the year?", state.visitor.mood.text);
      return;
    }

    const v = state.visitor;
    const claim = visitorControlAnswer(v, "dob");
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if (yearAsked === claimYear) {
      visitorSays("Yes, that’s correct.", state.visitor.mood.text);
      if (claim.lied) setVisitorMood("The visitor looks a bit stressed.");
      return;
    }

    visitorSays("No, that’s not correct.", state.visitor.mood.text);

    if (yearAsked === trueYear && claim.lied) {
      visitorSays(`Actually… you’re right. I was born in ${trueYear}. Sorry.`, state.visitor.mood.text);
      v.claims.dob = formatDob(v.id.dob);
      return;
    }

    visitorSays(`I was born in ${claimYear}.`, state.visitor.mood.text);
  }

  function intakeAnswer(kind) {
    const v = state.visitor;
    const a = v.intake;

    if (kind === "name") return `My name is ${v.id.name}.`;

    if (kind === "purpose") {
      // richer purpose answer
      if (a.purpose === "delivery") {
        return "I’m here for a delivery. I was asked to bring supplies to the logistics section.";
      }
      if (a.purpose === "maintenance") {
        return "I’m here for maintenance work. I need to check or repair equipment on site.";
      }
      if (a.purpose === "meeting") {
        return "I’m here for a meeting on base.";
      }
      if (a.purpose === "contract work") {
        return "I’m here for contract work. I’m supporting a scheduled task for the unit.";
      }
      return `I’m here for a visit.`;
    }

    if (kind === "appointment") {
      if (a.appointment) return "Yes, I have an appointment.";
      return "No, I don’t have an appointment. I was told to check in at the gate. Can you call someone for approval?";
    }

    if (kind === "who") {
      if (a.meetingWith) return `I’m meeting ${a.meetingWith}.`;
      return "I don’t have a named contact. I was told to report to the duty desk.";
    }

    if (kind === "time") {
      if (a.apptTime) return `It’s at ${a.apptTime}.`;
      return "I don’t have an exact time. I was told to come in this morning.";
    }

    if (kind === "where") {
      return `I’m going to the ${a.goingWhere}.`;
    }

    if (kind === "subject") {
      // richer “meeting about” / why explanation
      const templates = [
        `It’s about ${a.subject}. We spoke about it earlier, and they asked me to come today to sort it out.`,
        `It’s about ${a.subject}. There was a problem last week, so they arranged a follow-up with me.`,
        `It’s about ${a.subject}. I need to hand over documents and confirm the details with the host.`,
        `It’s about ${a.subject}. They requested support because they were short on equipment and needed a replacement.`,
        `It’s about ${a.subject}. I’m delivering items that were requested in advance, and I need someone to sign for them.`
      ];
      return pick(templates);
    }

    return "Okay.";
  }

  function showFeedback() {
    showScreen("feedback");
    const misses = REQUIRED.filter(r => !state.flags[r.key]);

    const top3 = misses.slice(0, 3);
    const ulTop = $id("top3");
    const all = $id("allMisses");

    if (ulTop) {
      ulTop.innerHTML = top3.map(m => `<li><b>${m.label}</b><br><span class="muted small">Example: ${m.example}</span></li>`).join("");
    }
    if (all) {
      all.innerHTML = misses.map(m => `<div style="margin:10px 0;"><b>${m.label}</b><div class="muted small">Example: ${m.example}</div></div>`).join("");
    }
  }

  function finishRun(reason) {
    if (state.finished) return;
    state.finished = true;

    hideIdPanel();

    logEvent("finish", {
      runId: state.runId,
      reason,
      student: state.student,
      flags: state.flags,
      unknowns: state.unknowns,
      inconsistencies: state.visitor?.inconsistencies || []
    });

    showFeedback();
  }

  function denyEntrance() {
    studentSays("I’m denying entry. You cannot enter the site.");
    visitorSays("Okay.", state.visitor.mood.text);
    finishRun("denied");
  }

  function handleOpeningFlow(intent, rawText) {
    const t = (rawText || "").trim();

    // Stage 1: student greets -> visitor asks for help
    if (state.opening === "hello_shown" && intent === "hello") {
      visitorSays("Can you help me?", state.visitor.mood.text);
      state.opening = "help_prompted";
      setStep("Start", "Ask what the visitor needs. Then continue with 5W/5WH questions.");
      return true;
    }

    // Stage 2: student offers help -> visitor states goal
    if (state.opening === "help_prompted" && intent === "help_offer") {
      visitorSays("Yes. I need to get onto the base.", state.visitor.mood.text);
      state.opening = "ready";
      setStep("Intake", "Now ask the 5W/5WH questions (name, purpose, appointment, who, time, where, subject).");
      return true;
    }

    // If student tries to offer help before greeting, allow anyway
    if (state.opening === "hello_shown" && intent === "help_offer") {
      visitorSays("I need to get onto the base.", state.visitor.mood.text);
      state.opening = "ready";
      setStep("Intake", "Now ask the 5W/5WH questions.");
      return true;
    }

    return false;
  }

  function handleMessage(text) {
    if (state.finished) return;

    const t = (text || "").trim();
    if (!t) return;

    studentSays(t);
    logEvent("message", { runId: state.runId, from: "student", text: t });

    const intent = matchIntent(state.intents, t);

    // Opening logic first
    if (handleOpeningFlow(intent, t)) return;

    // Deny always
    if (intent === "deny") {
      denyEntrance();
      return;
    }

    // Return ID (by text) also hides panel
    if (intent === "return_id") {
      hideIdPanel();
      visitorSays("Thank you.", state.visitor.mood.text);
      return;
    }

    // Ask ID -> show/draw ID
    if (intent === "ask_id") {
      state.flags.asked_id = true;
      state.visitor.idShown = true;
      visitorSays("Yes. Here you go.", state.visitor.mood.text);
      drawIdCard(state.visitor);
      showIdPanel();
      setStep("ID check", "Check the ID details and ask control questions (DOB, age, nationality).");
      logEvent("show_id", { runId: state.runId });
      return;
    }

    // Supervisor only via TEXT (modal still exists)
    if (intent === "contact_supervisor") {
      state.flags.supervisor_contacted = true;
      visitorSays("Okay. Please contact your supervisor.", state.visitor.mood.text);
      openSupervisorModal();
      setStep("Supervisor", "Fill the 5W briefing. Then continue.");
      logEvent("supervisor_trigger", { runId: state.runId, source: "text" });
      return;
    }

    // Control questions
    if (intent === "ask_age") {
      state.flags.asked_age = true;
      const a = visitorControlAnswer(state.visitor, "age");
      visitorSays(`I’m ${a.value} years old.`, state.visitor.mood.text);
      return;
    }

    if (intent === "ask_dob") {
      state.flags.asked_dob = true;
      const a = visitorControlAnswer(state.visitor, "dob");
      visitorSays(`My date of birth is ${a.value}.`, state.visitor.mood.text);
      return;
    }

    if (intent === "confirm_born_year") {
      state.flags.asked_dob = true;
      handleBornYearConfirm(t);
      return;
    }

    if (intent === "ask_nationality") {
      state.flags.asked_nationality = true;
      const a = visitorControlAnswer(state.visitor, "nationality");
      visitorSays(`I’m ${a.value}.`, state.visitor.mood.text);
      return;
    }

    // Intake
    if (intent === "ask_name") { state.flags.asked_name = true; visitorSays(intakeAnswer("name"), state.visitor.mood.text); return; }
    if (intent === "ask_purpose") { state.flags.asked_purpose = true; visitorSays(intakeAnswer("purpose"), state.visitor.mood.text); return; }

    if (intent === "ask_appointment") {
      state.flags.asked_appointment = true;
      visitorSays(intakeAnswer("appointment"), state.visitor.mood.text);

      if (!state.visitor.intake.appointment) {
        // Give student the “next line” clearly
        setStep("No appointment", "Use: “I will contact my supervisor for approval.” (or similar).");
        setVisitorMood("The visitor looks uncertain.");
      }
      return;
    }

    if (intent === "ask_who") { state.flags.asked_who = true; visitorSays(intakeAnswer("who"), state.visitor.mood.text); return; }
    if (intent === "ask_time") { state.flags.asked_time = true; visitorSays(intakeAnswer("time"), state.visitor.mood.text); return; }
    if (intent === "ask_where") { state.flags.asked_where = true; visitorSays(intakeAnswer("where"), state.visitor.mood.text); return; }
    if (intent === "ask_subject") { state.flags.asked_subject = true; visitorSays(intakeAnswer("subject"), state.visitor.mood.text); return; }

    if (intent === "go_person_search") {
      state.flags.did_person_search = true;
      visitorSays("Yes, that’s okay.", state.visitor.mood.text);
      finishRun("completed");
      return;
    }

    // Unknown
    state.unknowns += 1;
    visitorSays("Sorry, I don’t understand. Can you ask it another way?", state.visitor.mood.text);
    if (LOG_UNKNOWN) logEvent("unknown_question", { runId: state.runId, text: t });
  }

  /***********************
   * Voice (hold-to-talk)
   ***********************/
  function setupVoice() {
    const btn = $id("btnMicHold");
    const status = $id("micStatus");
    const input = $id("studentInput");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!btn || !status || !input) return;

    if (!SpeechRecognition) {
      status.textContent = "Voice not supported in this browser.";
      btn.disabled = true;
      return;
    }

    let rec = null;
    let finalText = "";
    let listening = false;

    function setStatus(s) { status.textContent = s || ""; }

    function startRec() {
      if (listening) return;
      finalText = "";
      rec = new SpeechRecognition();
      rec.lang = VOICE_LANG;
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const txt = e.results[i][0]?.transcript || "";
          if (e.results[i].isFinal) finalText += txt;
          else interim += txt;
        }
        input.value = (finalText + " " + interim).trim();
      };

      rec.onerror = () => setStatus("Mic error.");
      rec.onend = () => {
        listening = false;
        btn.classList.remove("listening");
        setStatus("");

        // auto send on release/end
        if (VOICE_AUTO_SEND) {
          const val = (input.value || "").trim();
          if (val) {
            input.value = "";
            handleMessage(val);
          }
        }
      };

      listening = true;
      btn.classList.add("listening");
      setStatus("Listening…");
      try { rec.start(); } catch {}
    }

    function stopRec() {
      if (!rec) return;
      try { rec.stop(); } catch {}
    }

    // mouse
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); startRec(); });
    document.addEventListener("mouseup", () => { if (listening) stopRec(); });

    // touch
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); startRec(); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); stopRec(); }, { passive: false });
  }

  /***********************
   * Init / wiring
   ***********************/
  async function init() {
    enforceSupervisorNukeForever();

    // teacher button optional
    const teacherBtn = $id("btnTeacher");
    if (teacherBtn) teacherBtn.style.display = (CONFIG.showTeacherButton === false) ? "none" : "";

    // Load phrasebank
    const pb = await loadPhrasebank();
    state.intents = compilePatterns(pb);

    // login screen default
    showScreen("login");
    hideIdPanel();

    const btnStart = $id("btnStart");
    const btnReset = $id("btnResetLocal");

    btnReset?.addEventListener("click", () => {
      localStorage.removeItem("veva_runs");
      alert("Lokaal gereset.");
    });

    btnStart?.addEventListener("click", async () => {
      const name = ($id("studentName")?.value || "").trim();
      const cls = ($id("className")?.value || "").trim();
      const diff = ($id("difficulty")?.value || "Standard").trim();

      if (!name) {
        alert("Vul je naam in.");
        return;
      }

      state.student = { name, className: cls, difficulty: diff };
      state.runId = uid();
      state.finished = false;
      state.unknowns = 0;

      // reset flags
      state.flags = {
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
        did_person_search: false
      };

      state.visitor = buildVisitor();
      state.opening = "hello_shown";

      // avatars
      const vA = $id("visitorAvatar");
      if (vA) {
        vA.src = state.visitor.headshot;
        vA.onerror = () => { vA.src = "assets/photos/headshot_01.png"; };
      }
      const sA = $id("studentAvatar");
      if (sA) sA.src = "assets/photos/soldier.png";

      // meta header
      const meta = $id("meta");
      if (meta) meta.textContent = `${name}${cls ? " · " + cls : ""} · ${diff} · Run ${state.runId.slice(0, 6)}`;

      // clear bubbles + ID
      resetBubbles();
      hideIdPanel();
      clearIdCanvas();

      // show training screen
      showScreen("train");

      await logEvent("start", { runId: state.runId, student: state.student, mood: state.visitor.mood.key });

      // Opening: visitor says Hello (student responds)
      visitorSays("Hello.", state.visitor.mood.text);
      setStep("Start", "Say hello to the visitor. Then respond when the visitor asks for help.");
    });

    // Send
    $id("btnSend")?.addEventListener("click", () => {
      const input = $id("studentInput");
      if (!input) return;
      const val = input.value;
      input.value = "";
      handleMessage(val);
    });

    $id("studentInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = $id("studentInput");
        const val = input.value;
        input.value = "";
        handleMessage(val);
      }
    });

    // Deny entrance
    $id("btnDenyEntrance")?.addEventListener("click", () => denyEntrance());

    // Return to visitor button: also hides ID (acts like giving it back)
    $id("btnReturnVisitor")?.addEventListener("click", () => {
      if (state.visitor?.idShown) {
        hideIdPanel();
        visitorSays("Thank you.", state.visitor?.mood?.text || "");
      } else {
        visitorSays("Okay.", state.visitor?.mood?.text || "");
      }
    });

    // Go person search
    $id("btnGoPersonSearch")?.addEventListener("click", () => {
      state.flags.did_person_search = true;
      visitorSays("Yes, that’s okay.", state.visitor?.mood?.text || "");
      finishRun("completed");
    });

    // New scenario
    $id("btnNewScenario")?.addEventListener("click", () => {
      showScreen("login");
      state.finished = false;
      hideIdPanel();
    });

    // Finish run
    $id("btnFinishRun")?.addEventListener("click", () => finishRun("manual_finish"));

    // Hint
    $id("btnHint")?.addEventListener("click", () => {
      visitorSays(
        "Try: What is your name? / Why are you here? / Do you have an appointment? / Who are you meeting?",
        state.visitor?.mood?.text || ""
      );
    });

    // Done step helper
    $id("btnDoneStep")?.addEventListener("click", () => {
      if (!state.flags.asked_name) { visitorSays("Next: ask their name.", state.visitor.mood.text); return; }
      if (!state.flags.asked_purpose) { visitorSays("Next: ask the purpose of the visit.", state.visitor.mood.text); return; }
      if (!state.flags.asked_appointment) { visitorSays("Next: ask if they have an appointment.", state.visitor.mood.text); return; }
      if (!state.flags.asked_id) { visitorSays("Next: ask for an ID.", state.visitor.mood.text); return; }
      if (!state.flags.did_person_search) { visitorSays("Next: person search.", state.visitor.mood.text); return; }
    });

    // Supervisor modal buttons
    $id("btnCloseModal")?.addEventListener("click", closeSupervisorModal);
    $id("btnBackToVisitor")?.addEventListener("click", () => {
      closeSupervisorModal();
      visitorSays("Okay.", state.visitor?.mood?.text || "");
    });

    $id("btnSendSupervisor")?.addEventListener("click", () => {
      const resp = $id("supervisorResponse");
      if (resp) resp.textContent = "Supervisor response: Approved. Proceed with additional checks.";
      closeSupervisorModal();
      visitorSays("Understood.", state.visitor?.mood?.text || "");
    });

    // Feedback buttons
    $id("btnBackToStart")?.addEventListener("click", () => showScreen("login"));
    $id("btnDownloadCsv")?.addEventListener("click", () => {
      const rows = [
        ["ts", nowIso()],
        ["runId", state.runId],
        ["studentName", state.student.name],
        ["className", state.student.className],
        ["difficulty", state.student.difficulty],
        ["unknowns", String(state.unknowns)]
      ];
      const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `veva_${state.runId}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    setupVoice();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
