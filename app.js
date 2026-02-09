(() => {
  "use strict";

  const APP_VERSION = "veva-whatsapp-v3-2026-02-09";
  console.log("[VEVA]", APP_VERSION, "loaded");

  const CONFIG = window.APP_CONFIG || {};
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true;
  const VOICE_LANG = CONFIG.voiceLang || "en-US";

  // How many headshots exist in assets/photos as headshot_01..N
  const HEADSHOT_COUNT = Number(CONFIG.headshotCount || 10);

  const $id = (id) => document.getElementById(id);

  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function safeLower(s) {
    return (s || "").toString().trim().toLowerCase();
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function chance(p) { return Math.random() < clamp(p, 0, 1); }

  function parseYear(text) {
    const m = (text || "").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  // --- DOB formatting requested: "dd Mon yyyy"
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function formatDobDMY({ yyyy, mm, dd }) {
    const z2 = (n) => (n < 10 ? "0" + n : "" + n);
    const mon = MONTHS[clamp(mm,1,12)-1] || "Jan";
    return `${z2(dd)} ${mon} ${yyyy}`;
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
    try {
      await fetch(LOG_ENDPOINT, { method: "POST", mode: "no-cors", body });
    } catch {}
  }

  // ---- Visitor generation ----
  const MOODS = [
    { key: "relaxed",   text: "The visitor looks relaxed and confident.", lieBoost: 0.02, inconsBoost: 0.02 },
    { key: "tired",     text: "The visitor looks tired but cooperative.", lieBoost: 0.05, inconsBoost: 0.05 },
    { key: "uneasy",    text: "The visitor looks uneasy.",                lieBoost: 0.10, inconsBoost: 0.12 },
    { key: "nervous",   text: "The visitor looks nervous.",               lieBoost: 0.18, inconsBoost: 0.20 },
    { key: "irritated", text: "The visitor looks irritated.",             lieBoost: 0.12, inconsBoost: 0.10 }
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

  function moodFeelingLine(moodKey) {
    switch (moodKey) {
      case "relaxed": return "I feel relaxed and confident today.";
      case "tired": return "I’m a bit tired, but I’m okay.";
      case "uneasy": return "I feel a little uneasy, to be honest.";
      case "nervous": return "I feel nervous.";
      case "irritated": return "I’m a bit irritated.";
      default: return "I’m okay.";
    }
  }

  function buildVisitor() {
    const mood = pick(MOODS);
    const dob = randomDob();
    const nat = pick(NATIONALITIES);
    const last = pick(["Johnson","Miller","Brown","Davis","Martinez","Kowalski","Nowak","Schmidt","Dubois","Rossi","Yilmaz"]);
    const name = pick(NAMES) + " " + last;
    const age = calcAgeFromDob(dob);

    const idx = 1 + Math.floor(Math.random() * clamp(HEADSHOT_COUNT, 1, 99));
    const headshot = `assets/photos/headshot_${String(idx).padStart(2, "0")}.png`;

    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30","10:00","13:15","14:00","15:45"]) : null;
    const meetingWith = appointment ? pick(["Captain Lewis","Sgt. van Dijk","Mr. Peters","Lt. Schmidt"]) : null;

    // More detailed "meeting about" / "delivery details"
    const deliveryItems = [
      "replacement radio batteries",
      "a sealed parts box for vehicle maintenance",
      "documents for a contract review",
      "a toolbox and inspection checklist",
      "IT equipment for the logistics office",
      "spare uniform items and boots"
    ];

    const deliveryReason = [
      "because there was a shortage reported last week",
      "because an inspection is scheduled today",
      "because the unit requested an urgent replacement",
      "because the previous shipment was incomplete",
      "because the sergeant asked me to bring it personally"
    ];

    const subjectLong = () => {
      const item = pick(deliveryItems);
      const why = pick(deliveryReason);
      if (appointment && meetingWith) {
        return `I’m delivering ${item}. It was arranged with ${meetingWith} ${why}.`;
      }
      return `I’m delivering ${item}. It was arranged in advance ${why}.`;
    };

    const intake = {
      purpose: pick(["delivery","maintenance","meeting","visit","contract work"]),
      appointment,
      apptTime,
      meetingWith,
      goingWhere: pick(["HQ building","Logistics office","Barracks admin","Workshop"]),
      subject: subjectLong()
    };

    // Contraband / search-related items (mood increases lying, not possession)
    const contraband = {
      weapon: chance(0.10),         // e.g. pocket knife
      drugs: chance(0.06),
      alcohol: chance(0.08),
      sharpObject: chance(0.12)     // needle/boxcutter
    };

    return {
      mood,
      headshot,
      id: { name, nationality: nat, dob, age, idNumber: randomIdNumber(), expiry: randomExpiry() },
      intake,
      contraband,
      claims: { age: null, dob: null, nationality: null, name: null },
      inconsistencies: [],
      idShown: false,
      askedIllegalClarify: false
    };
  }

  // ---- Intents ----
  function compilePatterns(extra) {
    const base = {
      // Greetings
      smalltalk: [
        /\bhello\b/i, /\bhi\b/i, /\bhey\b/i,
        /\bgood\s+(morning|afternoon|evening)\b/i
      ],

      // Feelings / mood
      ask_feeling: [
        /\bhow\s+are\s+you\s+feeling(\s+today)?\b/i,
        /\bhow\s+do\s+you\s+feel(\s+today)?\b/i,
        /\bare\s+you\s+okay\b/i,
        /\bhow\s+are\s+you\s+today\b/i
      ],

      // "How can I help?"
      ask_help: [
        /\bhow\s+can\s+i\s+help(\s+you(\s+today)?)?\b/i,
        /\bwhat\s+can\s+i\s+do\s+for\s+you\b/i,
        /\bwhat\s+do\s+you\s+need\b/i
      ],

      // Intake 5W
      ask_name: [
        /\bwhat\s*(is|'s)\s+your\s+name\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i,
        /\bmay\s+i\s+have\s+your\s+name\b/i,
        /\byour\s+name\s*,?\s+please\b/i,
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
        /\bis\s+this\s+pre[-\s]?arranged\b/i
      ],
      ask_who: [
        /\bwho\s+are\s+you\s+(here\s+to\s+see|meeting|visiting)\b/i,
        /\bwho\s+is\s+(your\s+)?(appointment|meeting)\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\b/i,
        /\bwho\s+is\s+your\s+contact\b/i,
        /\bwho\s+is\s+expecting\s+you\b/i,
        /\bwhat'?s\s+the\s+name\s+of\s+the\s+(host|contact|person)\b/i,
        /\bwho\s+gave\s+you\s+the\s+order\b/i
      ],
      ask_time: [
        /\bwhat\s+time\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhen\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhat\s+time\s+are\s+you\s+expected\b/i,
        /\bwhen\s+are\s+you\s+expected\b/i,
        /\bwhat\s+time\s+were\s+you\s+told\b/i
      ],
      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhat\s+is\s+your\s+destination\b/i,
        /\bwhich\s+(building|unit|office|department|area)\b/i,
        /\bwhere\s+is\s+the\s+(meeting|appointment)\b/i,
        /\bwhere\s+are\s+you\s+meeting\s+(him|her|them)\b/i
      ],
      ask_subject: [
        /\bwhat\s+is\s+(this|it|the\s+visit|the\s+meeting)\s+about\b/i,
        /\bwhat\s+will\s+you\s+discuss\b/i,
        /\bcan\s+you\s+tell\s+me\s+more\s+about\s+(the\s+)?(meeting|visit)\b/i,
        /\bwhy\s+do\s+you\s+need\s+to\s+(be\s+)?here\b/i,
        /\bwhat\s+are\s+you\s+delivering\b/i
      ],

      // ID
      ask_id: [
        /\b(can|could|may)\s+i\s+(see|check|verify|inspect|look\s+at)\s+(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(show|present)\s+(me\s+)?(your|ur)\s+(id|identification|passport|card)\b/i,
        /\bdo\s+you\s+(have|carry)\s+(an?\s+)?(id|identification|passport)\b/i
      ],
      return_id: [
        /\bhere\s+(is|are)\s+(your|ur)\s+(id|card|identification)\s+back\b/i,
        /\byou\s+can\s+have\s+(your|ur)\s+(id|card)\s+back\b/i,
        /\b(return|give)\s+(it|the\s+(id|card|identification))\s+back\b/i
      ],

      // Supervisor (text)
      contact_supervisor: [
        /\b(i\s*(will|’ll|'ll|need\s+to|have\s+to|must)\s+)?(contact|call|ring|phone|speak\s+to|talk\s+to|ask)\s+(my\s+)?(supervisor|boss|manager|team\s*leader|officer)\b/i,
        /\b(i\s+)?need\s+(approval|authori[sz]ation|permission)\b/i,
        /\bfor\s+approval\b/i
      ],

      // Control Qs
      ask_age: [/\bhow\s+old\s+are\s+you\b/i, /\bwhat\s+is\s+your\s+age\b/i],
      ask_dob: [/\b(date\s+of\s+birth|dob)\b/i, /\bwhen\s+were\s+you\s+born\b/i],
      confirm_born_year: [/\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i],
      ask_nationality: [/\bwhat\s+is\s+your\s+nationality\b/i, /\bwhat\s+country\s+are\s+you\s+from\b/i],

      // Search announcement
      announce_search: [
        /\b(due\s+to\s+an?\s+increased\s+threat)\b/i,
        /\beveryone\s+is\s+searched\s+today\b/i,
        /\bwe\s+will\s+search\s+(everyone|you)\b/i,
        /\bi'?m\s+going\s+to\s+search\s+you\b/i,
        /\byou\s+will\s+be\s+searched\b/i,
        /\bwe\s+have\s+to\s+search\s+(everyone|you)\b/i,
        /\bsecurity\s+check\b/i
      ],

      // Pre-search questions
      ask_weapons: [
        /\bdo\s+you\s+have\s+any\s+weapons(\s+on\s+you)?\b/i,
        /\bany\s+weapons\b/i,
        /\bany\s+knives\b/i
      ],
      ask_drugs: [
        /\bdo\s+you\s+have\s+any\s+drugs(\s+on\s+you)?\b/i,
        /\bany\s+drugs\b/i,
        /\billegal\s+substances\b/i
      ],
      ask_alcohol: [
        /\bdo\s+you\s+have\s+any\s+alcohol(\s+with\s+you|\s+on\s+you)?\b/i,
        /\bany\s+alcohol\b/i
      ],
      ask_illegal_items: [
        /\bdo\s+you\s+have\s+any\s+illegal\s+items(\s+on\s+you)?\b/i,
        /\banything\s+illegal\b/i,
        /\bcontraband\b/i
      ],
      explain_illegal_items: [
        /\billegal\s+items\s+are\s+(weapons|drugs|alcohol)\b/i,
        /\bno\s+weapons\s*,?\s+no\s+drugs\s*,?\s+no\s+alcohol\b/i,
        /\bweapons\s*,?\s+drugs\s*(or|and)\s+alcohol\b/i
      ],

      // Move to person search
      follow_to_search: [
        /\bfollow\s+me\s+to\s+(the\s+)?(person\s+search|search\s+area|screening|checkpoint)\b/i,
        /\bcome\s+with\s+me\b/i,
        /\bwe\s+will\s+go\s+to\s+the\s+(person\s+search|search\s+area)\b/i
      ],

      // Person search instructions + sharp objects
      ask_sharp_objects: [
        /\bdo\s+you\s+have\s+any\s+sharp\s+objects(\s+with\s+you|\s+on\s+you)?\b/i,
        /\banything\s+that\s+can\s+hurt\s+me\b/i,
        /\bany\s+needles\b/i
      ],
      cmd_empty_pockets: [
        /\b(empty|clear)\s+your\s+pockets\b/i,
        /\bput\s+(everything|your\s+items)\s+(here|there|on\s+the\s+table)\b/i
      ],
      cmd_remove_jacket: [
        /\b(take\s+off|remove)\s+your\s+(jacket|coat|hoodie)\b/i
      ],
      cmd_position: [
        /\bspread\s+your\s+(arms|legs)\b/i,
        /\barms\s+out\b/i,
        /\bpalms\s+facing\s+up\b/i,
        /\bturn\s+around\b/i,
        /\bstand\s+still\b/i
      ],

      // Deny
      deny: [
        /\bdeny\s+(entrance|entry|access)\b/i,
        /\byou\s+cannot\s+enter\b/i,
        /\bnot\s+allowed\s+to\s+enter\b/i
      ]
    };

    // Merge optional phrasebank patterns if present
    const merged = { ...base };
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
    for (const k of Object.keys(intents)) {
      if (k === "_raw") continue;
      if (intents[k](text)) return k;
    }
    return "unknown";
  }

  // ---- UI helpers: ONLY LAST BUBBLES ----
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

  // ---- ID Canvas ----
  function drawIdCard(visitor) {
    const canvas = $id("idCanvas");
    const panel = $id("idPanel");
    if (!canvas || !panel) return;

    // show panel inline (your CSS handles size)
    panel.style.display = "";
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

    // photo box
    ctx.fillStyle = "#e8ecf5";
    ctx.fillRect(34, 128, 190, 240);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(34, 128, 190, 240);

    const v = visitor.id;
    const rows = [
      ["Name", v.name],
      ["Nationality", v.nationality],
      ["DOB", formatDobDMY(v.dob)],
      ["Age", String(v.age)],
      ["ID nr", v.idNumber],
      ["Expiry", formatDobDMY(v.expiry)]
    ];

    let y = 150;
    ctx.fillStyle = "#111827";
    for (const [label, value] of rows) {
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(label + ":", 260, y);
      ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(String(value), 380, y);
      y += 44;
    }

    // footer
    ctx.fillStyle = "rgba(17,24,39,0.75)";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Valid only for stated purpose. Subject to search and denial.", 34, H - 22);

    // load face
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
    img.onerror = () => {};
    img.src = visitor.headshot;
  }

  function hideIdCard() {
    const panel = $id("idPanel");
    if (panel) panel.style.display = "none";
  }

  // ---- Control answers (lie/inconsistency) ----
  function makeFakeControl(visitor, kind) {
    if (kind === "age") {
      const delta = pick([-2, -1, 1, 2, 3]);
      return String(clamp(visitor.id.age + delta, 18, 70));
    }
    if (kind === "dob") {
      const dob = { ...visitor.id.dob };
      if (chance(0.5)) dob.dd = clamp(dob.dd + pick([-2, -1, 1, 2]), 1, 28);
      else dob.mm = clamp(dob.mm + pick([-1, 1]), 1, 12);
      // Keep internal as yyyy-mm-dd but we will display as DMY
      return `${dob.yyyy}-${String(dob.mm).padStart(2,"0")}-${String(dob.dd).padStart(2,"0")}`;
    }
    if (kind === "nationality") return pick(NATIONALITIES.filter(n => n !== visitor.id.nationality));
    if (kind === "name") return pick(NAMES) + " " + pick(["Johnson","Miller","Brown","Davis","Rossi","Schmidt"]);
    return "";
  }

  function visitorControlAnswer(visitor, kind) {
    const mood = visitor.mood;
    const lieP = 0.04 + mood.lieBoost;
    const inconsP = 0.05 + mood.inconsBoost;

    const truth = (() => {
      if (kind === "age") return String(visitor.id.age);
      if (kind === "dob") return `${visitor.id.dob.yyyy}-${String(visitor.id.dob.mm).padStart(2,"0")}-${String(visitor.id.dob.dd).padStart(2,"0")}`;
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

  function displayDobValue(valueYYYYMMDD) {
    // convert yyyy-mm-dd into dd Mon yyyy if possible
    const m = (valueYYYYMMDD || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return valueYYYYMMDD;
    const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
    return formatDobDMY({ yyyy, mm, dd });
  }

  // ---- Required checkpoints for feedback ----
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
    { key: "asked_nationality", label: "You didn’t verify nationality.", example: "What is your nationality?" }
  ];

  // ---- App State ----
  const state = {
    runId: uid(),
    student: { name: "", className: "", difficulty: "Standard" },
    visitor: null,
    intents: null,
    phase: "start", // start -> intake -> id -> search_notice -> pre_search -> person_search
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
      asked_nationality: false
    },
    finished: false,
    unknowns: 0,
    wrongSinceHint: 0
  };

  function difficultyMode() {
    const d = (state.student.difficulty || "Standard").toLowerCase();
    if (d === "basic") return "basic";
    if (d === "advanced") return "advanced";
    return "standard";
  }

  function hintThreshold() {
    // Basic: immediate hint after 1 wrong/unknown
    // Standard: hint after 3 wrong/unknown
    // Advanced: never
    const d = difficultyMode();
    if (d === "basic") return 1;
    if (d === "standard") return 3;
    return 999999;
  }

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
    setStudentBubble("");
    setVisitorMood(state.visitor?.mood?.text || "");
  }

  // ---- Supervisor modal ----
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

  function getSupervisorFields() {
    return {
      who: ($id("wWho")?.value || "").trim(),
      what: ($id("wWhat")?.value || "").trim(),
      withWhom: ($id("wWithWhom")?.value || "").trim(),
      time: ($id("wTime")?.value || "").trim(),
      why: ($id("wWhy")?.value || "").trim()
    };
  }

  function missing5W(fields) {
    const miss = [];
    if (!fields.who) miss.push("WHO (visitor name)");
    if (!fields.what) miss.push("WHAT (purpose)");
    if (!fields.withWhom) miss.push("WITH WHOM (host/contact)");
    if (!fields.time) miss.push("WHEN (time)");
    if (!fields.why) miss.push("WHY (meeting details)");
    return miss;
  }

  // ---- Conversation helpers ----
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
      return;
    }

    visitorSays("No, that’s not correct.", state.visitor.mood.text);

    if (yearAsked === trueYear && claim.lied) {
      visitorSays(`Actually… you’re right. I was born in ${trueYear}. Sorry.`, state.visitor.mood.text);
      v.claims.dob = `${v.id.dob.yyyy}-${String(v.id.dob.mm).padStart(2,"0")}-${String(v.id.dob.dd).padStart(2,"0")}`;
      return;
    }

    visitorSays(`I was born in ${claimYear}.`, state.visitor.mood.text);
  }

  function intakeAnswer(kind) {
    const v = state.visitor;
    const a = v.intake;
    if (kind === "name") return `My name is ${v.id.name}.`;
    if (kind === "purpose") return `I’m here for ${a.purpose}.`;
    if (kind === "appointment") return a.appointment ? "Yes, I have an appointment." : "No, I don’t have an appointment.";
    if (kind === "who") return a.meetingWith ? `I’m meeting ${a.meetingWith}.` : "I’m not meeting anyone specific.";
    if (kind === "time") return a.apptTime ? `It’s at ${a.apptTime}.` : "I don’t have a specific time.";
    if (kind === "where") return `I’m going to the ${a.goingWhere}.`;
    if (kind === "subject") return a.subject;
    return "Okay.";
  }

  function visitorLiesAboutItem() {
    // Lying about contraband is driven by mood
    const mood = state.visitor.mood;
    const lieP = 0.10 + mood.lieBoost; // a bit higher during security questions
    return chance(lieP);
  }

  function answerYesNo(hasItem, itemLabel) {
    if (!hasItem) return "No.";
    // may lie
    if (visitorLiesAboutItem()) return "No.";
    return `Yes… I have ${itemLabel}.`;
  }

  function maybeAskClarifyIllegal() {
    const v = state.visitor;
    if (v.askedIllegalClarify) return false;
    // sometimes ask back
    const p = 0.35 + v.mood.inconsBoost * 0.3;
    if (chance(p)) {
      v.askedIllegalClarify = true;
      visitorSays("What do you mean by illegal items?", v.mood.text);
      return true;
    }
    return false;
  }

  function bumpUnknownAndMaybeHint() {
    state.unknowns += 1;
    state.wrongSinceHint += 1;

    const th = hintThreshold();
    if (state.wrongSinceHint >= th) {
      state.wrongSinceHint = 0;
      if (difficultyMode() !== "advanced") {
        visitorSays(
          "Hint: try asking 5W questions (name, purpose, appointment, who, time, where, meeting about) or ask for an ID.",
          state.visitor.mood.text
        );
      }
    } else {
      visitorSays("Sorry, I don’t understand. Can you ask it another way?", state.visitor.mood.text);
    }

    if (LOG_UNKNOWN) logEvent("unknown_question", { runId: state.runId, text: $id("studentBubble")?.textContent || "" });
  }

  function handleMessage(text) {
    if (state.finished) return;
    const t = (text || "").trim();
    if (!t) return;

    studentSays(t);
    logEvent("message", { runId: state.runId, from: "student", text: t });

    const intent = matchIntent(state.intents, t);

    // Always allow deny
    if (intent === "deny") {
      visitorSays("Okay.", state.visitor.mood.text);
      state.finished = true;
      showScreen("feedback");
      return;
    }

    // Greeting logic (your opening)
    if (intent === "smalltalk") {
      // If student says hello, visitor asks for help
      visitorSays("Can you help me?", state.visitor.mood.text);
      state.phase = "intake";
      setStep("Intake", "Ask the 5W/5WH questions (name, purpose, appointment, who, time, where, meeting about).");
      return;
    }

    // Feeling question
    if (intent === "ask_feeling") {
      visitorSays(moodFeelingLine(state.visitor.mood.key), state.visitor.mood.text);
      return;
    }

    // How can I help?
    if (intent === "ask_help") {
      visitorSays("I need to get onto the base.", state.visitor.mood.text);
      state.phase = "intake";
      setStep("Intake", "Ask the 5W/5WH questions (name, purpose, appointment, who, time, where, meeting about).");
      return;
    }

    // Supervisor via TEXT trigger
    if (intent === "contact_supervisor") {
      openSupervisorModal();
      setStep("Supervisor", "Fill in the 5W briefing. (Basic/Standard will be checked.)");
      logEvent("supervisor_trigger", { runId: state.runId, source: "text" });
      return;
    }

    // ID request
    if (intent === "ask_id") {
      state.flags.asked_id = true;
      state.visitor.idShown = true;
      visitorSays("Yes. Here you go.", state.visitor.mood.text);
      drawIdCard(state.visitor);
      state.phase = "id";
      setStep("ID check", "Verify DOB / age / nationality. Then return the ID.");
      logEvent("show_id", { runId: state.runId });
      return;
    }

    // Return ID
    if (intent === "return_id") {
      hideIdCard();
      visitorSays("Thank you.", state.visitor.mood.text);
      // Move to search announcement stage
      state.phase = "search_notice";
      setStep("Security check", "Announce the search due to increased threat, then ask: weapons / drugs / alcohol.");
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
      visitorSays(`My date of birth is ${displayDobValue(a.value)}.`, state.visitor.mood.text);
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
    if (intent === "ask_appointment") { state.flags.asked_appointment = true; visitorSays(intakeAnswer("appointment"), state.visitor.mood.text); return; }
    if (intent === "ask_who") { state.flags.asked_who = true; visitorSays(intakeAnswer("who"), state.visitor.mood.text); return; }
    if (intent === "ask_time") { state.flags.asked_time = true; visitorSays(intakeAnswer("time"), state.visitor.mood.text); return; }
    if (intent === "ask_where") { state.flags.asked_where = true; visitorSays(intakeAnswer("where"), state.visitor.mood.text); return; }
    if (intent === "ask_subject") { state.flags.asked_subject = true; visitorSays(intakeAnswer("subject"), state.visitor.mood.text); return; }

    // Search flow
    if (intent === "announce_search") {
      state.phase = "pre_search";
      visitorSays("Okay. I understand.", state.visitor.mood.text);
      setStep("Security questions", "Ask: Do you have any weapons? any drugs? any alcohol?");
      return;
    }

    if (intent === "ask_illegal_items") {
      // visitor may ask what that means
      if (maybeAskClarifyIllegal()) return;

      const v = state.visitor;
      const hasAny = !!(v.contraband.weapon || v.contraband.drugs || v.contraband.alcohol);
      if (!hasAny) {
        visitorSays("No, I don’t.", v.mood.text);
      } else {
        // might lie even if they have something
        if (visitorLiesAboutItem()) visitorSays("No, I don’t.", v.mood.text);
        else visitorSays("Yes… I might have something.", v.mood.text);
      }
      return;
    }

    if (intent === "explain_illegal_items") {
      visitorSays("Okay. No weapons, no drugs, no alcohol.", state.visitor.mood.text);
      return;
    }

    if (intent === "ask_weapons") {
      const v = state.visitor;
      visitorSays(answerYesNo(v.contraband.weapon, "a knife"), v.mood.text);
      return;
    }
    if (intent === "ask_drugs") {
      const v = state.visitor;
      visitorSays(answerYesNo(v.contraband.drugs, "drugs"), v.mood.text);
      return;
    }
    if (intent === "ask_alcohol") {
      const v = state.visitor;
      visitorSays(answerYesNo(v.contraband.alcohol, "alcohol"), v.mood.text);
      return;
    }

    if (intent === "follow_to_search") {
      state.phase = "person_search";
      visitorSays("Okay. I will follow you.", state.visitor.mood.text);
      setStep("Person search", "Ask about sharp objects, then give clear instructions (empty pockets, take off jacket, arms out, palms up, turn around).");
      return;
    }

    // Person search phase
    if (intent === "ask_sharp_objects") {
      const v = state.visitor;
      visitorSays(answerYesNo(v.contraband.sharpObject, "a sharp object"), v.mood.text);
      return;
    }

    if (intent === "cmd_empty_pockets" || intent === "cmd_remove_jacket" || intent === "cmd_position") {
      visitorSays("Okay.", state.visitor.mood.text);
      return;
    }

    // Unknown
    bumpUnknownAndMaybeHint();
  }

  // ---- Voice (hold-to-talk) ----
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
        const combined = (finalText + " " + interim).trim();
        input.value = combined;
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

    btn.addEventListener("mousedown", (e) => { e.preventDefault(); startRec(); });
    document.addEventListener("mouseup", () => { if (listening) stopRec(); });

    btn.addEventListener("touchstart", (e) => { e.preventDefault(); startRec(); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); stopRec(); }, { passive: false });
  }

  // ---- Init / wiring ----
  async function init() {
    // Remove teacher & supervisor buttons if present (no circles)
    const teacherBtn = $id("btnTeacher");
    if (teacherBtn && CONFIG.showTeacherButton === false) teacherBtn.remove();

    const supBtn = $id("btnContactSupervisor");
    if (supBtn) supBtn.remove(); // HARD REMOVE, never show again

    // Load phrasebank
    const pb = await loadPhrasebank();
    state.intents = compilePatterns(pb);

    // LOGIN screen
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
      if (!cls) { alert("Kies je groep."); return; } // group is required

      state.student = { name, className: cls, difficulty: diff };
      state.runId = uid();
      state.finished = false;
      state.unknowns = 0;
      state.wrongSinceHint = 0;
      for (const k of Object.keys(state.flags)) state.flags[k] = false;

      state.visitor = buildVisitor();
      state.phase = "start";

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

      // hide ID until asked
      hideIdCard();

      // meta header
      const meta = $id("meta");
      if (meta) meta.textContent = `${name} · ${cls} · ${diff} · Run ${state.runId.slice(0, 6)}`;

      showScreen("train");
      resetBubbles();

      await logEvent("start", { runId: state.runId, student: state.student, mood: state.visitor.mood.key });

      // Opening: visitor says Hello. Student responds.
      visitorSays("Hello.", state.visitor.mood.text);
      setStep("Start", "Say hello back (or ask: How can I help you?). Then continue with 5W/5WH.");
    });

    // Training send
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

    // Supervisor modal
    $id("btnCloseModal")?.addEventListener("click", closeSupervisorModal);
    $id("btnBackToVisitor")?.addEventListener("click", () => {
      closeSupervisorModal();
      visitorSays("Okay.", state.visitor?.mood?.text || "");
    });

    $id("btnSendSupervisor")?.addEventListener("click", () => {
      const resp = $id("supervisorResponse");
      const fields = getSupervisorFields();

      const mode = difficultyMode();
      if (mode !== "advanced") {
        const miss = missing5W(fields);
        if (miss.length > 0) {
          if (resp) resp.textContent = `Supervisor: Are you sure? You missed: ${miss.join(", ")}. Go back and ask again.`;
          closeSupervisorModal();
          visitorSays("Please go back and ask the missing questions.", state.visitor.mood.text);
          setStep("Intake", "Ask the missing 5W questions, then contact supervisor again if needed.");
          return;
        }
      }

      if (resp) resp.textContent = "Supervisor response: Approved. Proceed with additional checks.";
      closeSupervisorModal();
      visitorSays("Understood.", state.visitor.mood.text);
      setStep("Continue", "Continue with ID check and security procedure.");
    });

    // Optional buttons (keep working if present)
    $id("btnDenyEntrance")?.addEventListener("click", () => {
      visitorSays("Okay.", state.visitor?.mood?.text || "");
      state.finished = true;
      showScreen("feedback");
    });

    $id("btnNewScenario")?.addEventListener("click", () => showScreen("login"));
    $id("btnFinishRun")?.addEventListener("click", () => showScreen("feedback"));

    $id("btnHint")?.addEventListener("click", () => {
      visitorSays(
        "Try: How can I help you? / What is your name? / What is the purpose of your visit? / Do you have an appointment?",
        state.visitor?.mood?.text || ""
      );
    });

    setupVoice();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
