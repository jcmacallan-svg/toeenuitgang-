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

  // =========================
  // Visitor generation
  // =========================
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

    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30", "10:00", "13:15", "14:00", "15:45"]) : null;
    const meetingWith = appointment ? pick(["Captain Lewis", "Sgt. van Dijk", "Mr. Peters", "Lt. Schmidt"]) : null;

    const purpose = pick(["delivery", "maintenance", "meeting", "visit", "contract work"]);
    const goingWhere = pick(["HQ building", "Logistics office", "Barracks admin", "Workshop"]);
    const subject = pick(["paperwork", "equipment handover", "maintenance report", "security briefing", "contract discussion"]);

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

  // =========================
  // Intents (ruimer)
  // =========================
  function compilePatterns(extra) {
    const base = {
      // Opening / help offer
      offer_help: [
        /\b(sure|of\s+course|yes)\b.*\b(help|assist)\b/i,
        /\bhow\s+can\s+i\s+help\s+you\b/i,
        /\bwhat\s+can\s+i\s+help\s+you\s+with\b/i,
        /\bwhat\s+can\s+i\s+do\s+for\s+you\b/i,
        /\bcan\s+i\s+help\s+you\b/i,
        /\bhow\s+may\s+i\s+help\b/i,
        /\bwhat\s+do\s+you\s+need\b/i
      ],

      // ID
      ask_id: [
        /\b(can|could|may)\s+i\s+(see|check|verify|inspect|look\s+at)\s+(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(show|present)\s+(me\s+)?(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(id|identification|passport)\s+(please|pls)\b/i,
        /\bdo\s+you\s+(have|carry)\s+(an?\s+)?(id|identification|passport)\b/i,
        /\bcan\s+you\s+provide\s+(an?\s+)?(id|identification)\b/i,
        /\blet\s+me\s+(see|check)\s+(your|ur)\s+(id|identification)\b/i
      ],

      return_id: [
        /\bhere\s+(is|are)\s+(your|ur)\s+(id|card|identification|passport)\s+back\b/i,
        /\b(return|give)\s+(it|the\s+(id|card|identification|passport))\s+back\b/i,
        /\byou\s+can\s+have\s+(your|ur)\s+(id|card|passport)\s+back\b/i
      ],

      // Supervisor / boss
      contact_supervisor: [
        /\b(i\s*(will|’ll|'ll|need\s+to|have\s+to|must|may\s+need\s+to)\s+)?(contact|call|ring|phone|speak\s+to|talk\s+to|ask)\s+(my\s+)?(supervisor|boss|manager|team\s*leader|officer)\b/i,
        /\b(i\s*(will|’ll|'ll)\s+)?(have\s+to|need\s+to|must)\s+ask\s+(my\s+)?(supervisor|boss|manager)\b/i,
        /\b(i\s+)?need\s+(approval|authori[sz]ation|permission)\b/i,
        /\bfor\s+(approval|authori[sz]ation|permission)\b/i
      ],

      // 5W/5WH
      ask_name: [
        /\bwhat\s*(is|'s)\s+your\s+name\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i,
        /\bmay\s+i\s+have\s+your\s+name\b/i,
        /\byour\s+name\s*,?\s+please\b/i,
        /\bstate\s+your\s+name\b/i,
        /\bwho\s+are\s+you\b/i,
        /\bwhat\s+should\s+i\s+call\s+you\b/i
      ],

      ask_purpose: [
        /\bwhat\s*(is|'s)\s+the\s+purpose\s+of\s+(your\s+)?visit\b/i,
        /\bwhat\s+are\s+you\s+here\s+for\b/i,
        /\bwhy\s+are\s+you\s+here\b/i,
        /\bwhat\s+brings\s+you\s+here\b/i,
        /\bstate\s+your\s+purpose\b/i,
        /\breason\s+for\s+(your\s+)?visit\b/i
      ],

      ask_appointment: [
        /\bdo\s+you\s+have\s+(an?\s+)?appointment\b/i,
        /\bare\s+you\s+expected\b/i,
        /\bdo\s+they\s+expect\s+you\b/i,
        /\bis\s+this\s+pre[-\s]?arranged\b/i,
        /\bdid\s+you\s+schedule\s+(a\s+)?(meeting|appointment)\b/i
      ],

      ask_who: [
        /\bwho\s+are\s+you\s+(here\s+to\s+see|meeting|visiting)\b/i,
        /\bwho\s+is\s+(your\s+)?(appointment|meeting)\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\b/i,
        /\bwho\s+is\s+your\s+contact\b/i,
        /\bwho\s+is\s+expecting\s+you\b/i,
        /\bwith\s+whom\s+is\s+your\s+(meeting|appointment)\b/i,
        /\bwith\s+who\s+is\s+your\s+(meeting|appointment)\b/i
      ],

      ask_time: [
        /\bwhat\s+time\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhen\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhat\s+time\s+are\s+you\s+expected\b/i,
        /\bwhen\s+are\s+you\s+expected\b/i,
        /\bwhat\s+time\s+did\s+they\s+tell\s+you\b/i
      ],

      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhat\s+is\s+your\s+destination\b/i,
        /\bwhich\s+(building|unit|office|department|area)\b/i,
        /\bwhere\s+is\s+the\s+(meeting|appointment)\b/i,
        /\bwhere\s+will\s+you\s+go\b/i
      ],

      ask_subject: [
        /\bwhat\s+is\s+(this|it|the\s+visit|the\s+meeting)\s+about\b/i,
        /\bwhat\s+will\s+you\s+discuss\b/i,
        /\bwhat\s+are\s+you\s+here\s+to\s+discuss\b/i,
        /\bcan\s+you\s+tell\s+me\s+more\s+about\s+(the\s+)?(meeting|visit|delivery|work)\b/i,
        /\bwhat\s+is\s+the\s+reason\s+for\s+(the\s+)?(meeting|visit|delivery)\b/i,
        /\bwhy\s+is\s+(the\s+)?(meeting|visit|delivery)\b/i
      ],

      // Control
      ask_age: [
        /\bhow\s+old\s+are\s+you\b/i,
        /\bwhat\s+is\s+your\s+age\b/i,
        /\bwhat\s+age\s+are\s+you\b/i,
        /\bmay\s+i\s+ask\s+your\s+age\b/i,
        /\bcan\s+you\s+confirm\s+your\s+age\b/i
      ],

      ask_dob: [
        /\bwhat\s*(is|'s)\s+your\s+(date\s+of\s+birth|dob)\b/i,
        /\bdate\s+of\s+birth\b/i,
        /\bdob\b/i,
        /\bwhen\s+were\s+you\s+born\b/i,
        /\bcan\s+you\s+confirm\s+your\s+date\s+of\s+birth\b/i
      ],

      confirm_born_year: [
        /\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i,
        /\bwere\s+you\s+born\s+around\s+(19\d{2}|20\d{2})\b/i,
        /\bis\s+your\s+birth\s+year\s+(19\d{2}|20\d{2})\b/i,
        /\byour\s+birth\s+year\s+is\s+(19\d{2}|20\d{2})\s*\?\s*$/i
      ],

      ask_nationality: [
        /\bwhat\s+is\s+your\s+nationality\b/i,
        /\bwhat\s+nationality\s+are\s+you\b/i,
        /\bwhere\s+are\s+you\s+from\b/i,
        /\bwhat\s+country\s+are\s+you\s+from\b/i,
        /\bwhat\s+is\s+your\s+citizenship\b/i
      ],

      // Person search / pat-down
      go_person_search: [
        /\b(go\s+to|start|begin|proceed\s+to)\s+(the\s+)?(person\s+search|pat[-\s]?down|frisk|search)\b/i,
        /\b(i\s+will|we\s+will|i\s+am\s+going\s+to|we\s+are\s+going\s+to)\s+(pat\s+you\s+down|search\s+you|do\s+a\s+pat[-\s]?down)\b/i,
        /\b(person\s+search|pat[-\s]?down)\s+now\b/i
      ],

      // Deny
      deny: [
        /\bdeny\s+(entrance|entry|access)\b/i,
        /\b(refuse|reject)\s+(entry|access)\b/i,
        /\byou\s+cannot\s+enter\b/i,
        /\byou\s+may\s+not\s+enter\b/i,
        /\bnot\s+allowed\s+to\s+enter\b/i,
        /\bi\s+(am\s+)?(denying|refusing)\s+(entry|access)\b/i
      ],

      // Smalltalk / greetings
      smalltalk: [
        /\bhello\b/i, /\bhi\b/i, /\bhey\b/i,
        /\bgood\s+(morning|afternoon|evening)\b/i
      ]
    };

    const merged = { ...base };

    // phrasebank merge (optioneel)
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
    const t = text || "";
    const order = [
      "deny",
      "return_id",
      "ask_id",
      "contact_supervisor",
      "go_person_search",
      "offer_help",
      "ask_name",
      "ask_purpose",
      "ask_appointment",
      "ask_who",
      "ask_time",
      "ask_where",
      "ask_subject",
      "ask_age",
      "ask_dob",
      "confirm_born_year",
      "ask_nationality",
      "smalltalk"
    ];
    for (const k of order) if (intents?.[k] && intents[k](t)) return k;
    return "unknown";
  }

  // =========================
  // UI helpers: ONLY LAST BUBBLES
  // =========================
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

  // =========================
  // ID overlay helpers
  // =========================
  function openIdOverlay() {
    document.body.classList.add("id-open");
    const panel = $id("idPanel");
    if (panel) panel.style.display = "block";
  }

  function closeIdOverlay() {
    document.body.classList.remove("id-open");
    const panel = $id("idPanel");
    if (panel) panel.style.display = "none";
  }

  // =========================
  // ID Canvas
  // =========================
  function drawIdCard(visitor) {
    const canvas = $id("idCanvas");
    if (!canvas) return;

    openIdOverlay();

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#163a66";
    ctx.fillRect(0, 0, W, 92);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("VISITOR ID", 32, 58);

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("Checkpoint Access Card", 34, 80);

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

    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(34, 128, 190, 240);
      ctx.clip();
      ctx.drawImage(img, 0, 0, img.width, img.height, 34, 128, 190, 240);
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(34, 128, 190, 240);
    };
    img.src = visitor.headshot;
  }

  // =========================
  // Control answers (lie/inconsistency)
  // =========================
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

  // =========================
  // Required checkpoints for feedback
  // =========================
  const REQUIRED = [
    { key: "asked_name", label: "You didn’t ask the visitor’s name.", example: "What is your name, please?" },
    { key: "asked_purpose", label: "You didn’t ask the purpose of the visit.", example: "What is the purpose of your visit today?" },
    { key: "asked_appointment", label: "You didn’t confirm the appointment.", example: "Do you have an appointment?" },
    { key: "asked_who", label: "You didn’t ask who they are meeting.", example: "Who are you meeting?" },
    { key: "asked_time", label: "You didn’t confirm the time.", example: "What time is your appointment?" },
    { key: "asked_where", label: "You didn’t confirm where they are going.", example: "Where are you going on base?" },
    { key: "asked_subject", label: "You didn’t ask what the meeting is about.", example: "What is your meeting about?" },
    { key: "asked_id", label: "You didn’t ask to see an ID.", example: "Can I see your ID, please?" },
    { key: "asked_dob", label: "You didn’t verify date of birth (DOB).", example: "What is your date of birth?" },
    { key: "asked_age", label: "You didn’t verify age.", example: "How old are you?" },
    { key: "asked_nationality", label: "You didn’t verify nationality.", example: "What is your nationality?" },
    { key: "supervisor_contacted", label: "You didn’t contact a supervisor when needed.", example: "I’ll contact my supervisor for approval." },
    { key: "did_person_search", label: "You didn’t complete the person search step.", example: "I’m going to do a quick pat-down search. Is that okay?" }
  ];

  // =========================
  // App State
  // =========================
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
    opening: {
      visitorAskedHelp: false
    }
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
    setVisitorBubble("Ask your first question…");
    setStudentBubble("");
    setVisitorMood(state.visitor?.mood?.text || "");
  }

  // Supervisor modal
  function openSupervisorModal() {
    const modal = $id("supervisorModal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const v = state.visitor;
    $id("wWho").value = v?.id?.name || "";
    $id("wWhat").value = v?.intake?.purpose || "";
    $id("wWithWhom").value = v?.intake?.meetingWith || "";
    $id("wTime").value = v?.intake?.apptTime || "";
    $id("wWhy").value = v?.intake?.subject || "";

    const resp = $id("supervisorResponse");
    if (resp) resp.textContent = "";
  }

  function closeSupervisorModal() {
    const modal = $id("supervisorModal");
    if (!modal) return;
    modal.classList.add("hidden");
  }

  // Conversation (last bubble only)
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
      visitorSays("Sorry, could you repeat the year?");
      return;
    }

    const v = state.visitor;
    const claim = visitorControlAnswer(v, "dob");
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if (yearAsked === claimYear) {
      visitorSays("Yes, that’s correct.");
      if (claim.lied) setVisitorMood("The visitor looks a bit stressed.");
      return;
    }

    visitorSays("No, that’s not correct.");

    if (yearAsked === trueYear && claim.lied) {
      visitorSays(`Actually… you’re right. I was born in ${trueYear}. Sorry.`);
      v.claims.dob = formatDob(v.id.dob);
      return;
    }

    visitorSays(`I was born in ${claimYear}.`);
  }

  // Richer answers
  function intakeAnswer(kind) {
    const v = state.visitor;
    const a = v.intake;

    if (kind === "name") return `My name is ${v.id.name}.`;

    if (kind === "purpose") {
      const map = {
        delivery: [
          "I’m here to deliver equipment for your unit.",
          "I’m delivering a package for Logistics.",
          "I’m here for a scheduled delivery to the base."
        ],
        maintenance: [
          "I’m here for maintenance work.",
          "I’m here to repair and service equipment on site.",
          "I’m here to carry out maintenance in the Workshop."
        ],
        meeting: [
          "I’m here for a meeting on base.",
          "I’m here to attend a meeting with staff.",
          "I’m here for a scheduled meeting."
        ],
        visit: [
          "I’m here to visit someone on the base.",
          "I’m here as a visitor.",
          "I’m here for a visit."
        ],
        "contract work": [
          "I’m here for contract work.",
          "I’m here as a contractor to do some work on site.",
          "I’m here for contract-related tasks."
        ]
      };
      return pick(map[a.purpose] || ["I’m here for official business."]);
    }

    if (kind === "appointment") {
      if (a.appointment) return "Yes, I have an appointment.";
      return "No, I don’t have an appointment. It was short notice and I was told to come anyway.";
    }

    if (kind === "who") {
      if (a.meetingWith) return `I’m meeting ${a.meetingWith}.`;
      // no appointment: make it plausible
      return "I don’t have a named contact, I was told to report to the duty desk / reception.";
    }

    if (kind === "time") {
      if (a.apptTime) return `It’s at ${a.apptTime}.`;
      return "I don’t have an exact time. I was told to come as soon as possible today.";
    }

    if (kind === "where") {
      return `I’m going to the ${a.goingWhere}.`;
    }

    // MEETING ABOUT / WHY (richer story)
    if (kind === "subject") {
      const who = a.meetingWith ? `with ${a.meetingWith}` : "with your staff";
      const place = a.goingWhere ? `at the ${a.goingWhere}` : "on site";

      const stories = {
        delivery: [
          `It’s about a delivery that was requested last week. There was a shortage reported, so I’m bringing the replacement parts and the paperwork. I need to hand it over ${who} ${place}.`,
          `I’m delivering equipment that was pre-arranged earlier this month. The unit needed it for an inspection and asked us to bring it urgently. I also have documents to sign when I arrive ${place}.`,
          `It’s a scheduled logistics handover. The base requested these items after a previous delivery was incomplete, so I’m bringing the missing items and confirmation documents.`
        ],
        maintenance: [
          `It’s about maintenance work. There was an issue reported and I’m here to inspect it, fix it, and write a maintenance report afterwards. I was told to check in ${place} first.`,
          `It’s about servicing equipment that failed during routine checks. I need to inspect the system, replace a component, and confirm it’s operational again before I leave.`,
          `It’s a follow-up on an earlier problem. The issue wasn’t fully resolved last time, so I’m here to finish the job and document the work.`
        ],
        meeting: [
          `It’s a scheduled meeting ${who}. We need to discuss ${a.subject} and confirm next steps. After that, I will leave the site.`,
          `It’s about ${a.subject}. It was arranged in advance so we can review the situation and agree on the plan.`,
          `It’s a short briefing and paperwork. I’m here to clarify details and make sure everything is approved.`
        ],
        visit: [
          `I’m visiting someone stationed here. I was told to check in first and then I’ll go ${place}. I’m not here for any work.`,
          `It’s a personal visit. I’ll stay with my host and follow the base rules, then I’ll leave again.`,
          `I’m here to visit a friend/colleague. I don’t have any equipment with me—just personal items.`
        ],
        "contract work": [
          `It’s about contract work. My company is supporting your unit, and I’m here to do the agreed tasks and report back. I was told to sign in and then go ${place}.`,
          `It’s about a scheduled contract job. We’re here because something needs to be inspected and documented for compliance.`,
          `It’s contract work that was arranged earlier. I need to complete the work, get a signature, and then I’ll leave the base.`
        ]
      };

      return pick(stories[a.purpose] || [
        `It’s about official business ${place}. I was told to check in first and then continue to my destination.`
      ]);
    }

    return "Okay.";
  }

  function showFeedback() {
    showScreen("feedback");
    const misses = REQUIRED.filter(r => !state.flags[r.key]);

    const top3 = misses.slice(0, 3);
    const ulTop = $id("top3");
    const all = $id("allMisses");
    if (ulTop) ulTop.innerHTML = top3.map(m => `<li><b>${m.label}</b><br><span class="muted small">Example: ${m.example}</span></li>`).join("");
    if (all) all.innerHTML = misses.map(m => `<div style="margin:10px 0;"><b>${m.label}</b><div class="muted small">Example: ${m.example}</div></div>`).join("");
  }

  function finishRun(reason) {
    if (state.finished) return;
    state.finished = true;
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

  function handleMessage(text) {
    if (state.finished) return;
    const t = (text || "").trim();
    if (!t) return;

    studentSays(t);
    logEvent("message", { runId: state.runId, from: "student", text: t });

    // Greeting logic
    const isHello = /\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)\b/i.test(t);
    if (isHello) {
      visitorSays("Can you help me?", state.visitor.mood.text);
      state.opening.visitorAskedHelp = true;
      setStep("Start", "Answer the visitor and then ask the 5W/5WH questions.");
      return;
    }

    const intent = matchIntent(state.intents, t);

    if (intent === "deny") { denyEntrance(); return; }

    // Return ID hides overlay
    if (intent === "return_id") {
      closeIdOverlay();
      visitorSays("Thank you.", state.visitor.mood.text);
      return;
    }

    // Offer help (your missing piece)
    if (intent === "offer_help") {
      // visitor requested help earlier, but we also allow it anytime
      visitorSays("I need to get onto the base.", state.visitor.mood.text);
      setStep("Intake", "Now ask the 5W/5WH questions (name, purpose, appointment, who, time, where, subject).");
      return;
    }

    // ID request
    if (intent === "ask_id") {
      state.flags.asked_id = true;
      state.visitor.idShown = true;
      visitorSays("Yes. Here you go.", state.visitor.mood.text);
      drawIdCard(state.visitor);
      setStep("ID check", "Check the ID details and ask control questions (DOB, age, nationality).");
      logEvent("show_id", { runId: state.runId });
      return;
    }

    // Supervisor via TEXT
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

    // Intake questions
    if (intent === "ask_name") { state.flags.asked_name = true; visitorSays(intakeAnswer("name"), state.visitor.mood.text); return; }
    if (intent === "ask_purpose") { state.flags.asked_purpose = true; visitorSays(intakeAnswer("purpose"), state.visitor.mood.text); return; }

    if (intent === "ask_appointment") {
      state.flags.asked_appointment = true;
      visitorSays(intakeAnswer("appointment"), state.visitor.mood.text);
      if (!state.visitor.intake.appointment) setVisitorMood("The visitor looks uncertain.");
      return;
    }

    if (intent === "ask_who") { state.flags.asked_who = true; visitorSays(intakeAnswer("who"), state.visitor.mood.text); return; }
    if (intent === "ask_time") { state.flags.asked_time = true; visitorSays(intakeAnswer("time"), state.visitor.mood.text); return; }
    if (intent === "ask_where") { state.flags.asked_where = true; visitorSays(intakeAnswer("where"), state.visitor.mood.text); return; }

    if (intent === "ask_subject") {
      state.flags.asked_subject = true;
      visitorSays(intakeAnswer("subject"), state.visitor.mood.text);
      return;
    }

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

  // =========================
  // Voice (hold-to-talk)
  // =========================
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

  // =========================
  // Init
  // =========================
  async function init() {
    const teacherBtn = $id("btnTeacher");
    if (teacherBtn) teacherBtn.style.display = (CONFIG.showTeacherButton === false) ? "none" : "";

    const supBtn = $id("btnContactSupervisor");
    if (supBtn) supBtn.style.display = "none";

    const pb = await loadPhrasebank();
    state.intents = compilePatterns(pb);

    showScreen("login");

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

      if (!name) { alert("Vul je naam in."); return; }

      state.student = { name, className: cls, difficulty: diff };
      state.runId = uid();
      state.finished = false;
      state.unknowns = 0;
      state.opening.visitorAskedHelp = false;

      state.flags = {
        asked_name: false, asked_purpose: false, asked_appointment: false, asked_who: false,
        asked_time: false, asked_where: false, asked_subject: false, asked_id: false,
        asked_age: false, asked_dob: false, asked_nationality: false,
        supervisor_contacted: false, did_person_search: false
      };

      state.visitor = buildVisitor();

      // avatars
      const vA = $id("visitorAvatar");
      if (vA) {
        vA.src = state.visitor.headshot;
        vA.onerror = () => { vA.src = "assets/photos/headshot_01.png"; };
      }
      const sA = $id("studentAvatar");
      if (sA) sA.src = "assets/photos/soldier.png";

      // mood line
      setVisitorMood(state.visitor.mood.text);

      // hide ID overlay at start
      closeIdOverlay();

      // meta header
      const meta = $id("meta");
      if (meta) meta.textContent = `${name}${cls ? " · " + cls : ""} · ${diff} · Run ${state.runId.slice(0, 6)}`;

      showScreen("train");
      resetBubbles();

      await logEvent("start", { runId: state.runId, student: state.student, mood: state.visitor.mood.key });

      // Opening: visitor says Hello only (you wanted that)
      visitorSays("Hello.", state.visitor.mood.text);
      setStep("Start", "Say hello to the visitor. Then respond and ask the 5W/5WH questions.");
    });

    // Training controls
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

    $id("btnDenyEntrance")?.addEventListener("click", () => denyEntrance());

    $id("btnNewScenario")?.addEventListener("click", () => {
      showScreen("login");
      state.finished = false;
      closeIdOverlay();
    });

    $id("btnFinishRun")?.addEventListener("click", () => finishRun("manual_finish"));

    $id("btnHint")?.addEventListener("click", () => {
      visitorSays(
        "Try: Hello. / How can I help you? / What is your name? / What is the purpose of your visit? / Do you have an appointment?",
        state.visitor?.mood?.text || ""
      );
    });

    $id("btnDoneStep")?.addEventListener("click", () => {
      if (!state.flags.asked_id) {
        visitorSays("Next step: ask for an ID.", state.visitor.mood.text);
        setStep("ID check", "Ask for ID. Then verify DOB / age / nationality.");
        return;
      }
      if (!state.flags.did_person_search) {
        visitorSays("Next step: person search.", state.visitor.mood.text);
        setStep("Person search", "Type: Go to person search");
      }
    });

    $id("btnGoPersonSearch")?.addEventListener("click", () => {
      state.flags.did_person_search = true;
      visitorSays("Yes, that’s okay.", state.visitor.mood.text);
      finishRun("completed");
    });

    $id("btnReturnVisitor")?.addEventListener("click", () => {
      visitorSays("Okay.", state.visitor?.mood?.text || "");
    });

    // Supervisor modal
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

    // Feedback
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
