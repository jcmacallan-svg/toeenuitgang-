// app.js
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // -------------------------
  // Build / config
  // -------------------------
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);

  // Support both legacy keys (voiceAutoSend) and new keys (voiceAutosend)
  const _voiceCfg =
    (CFG.voiceAutosend !== undefined) ? CFG.voiceAutosend :
    (CFG.voiceAutoSend !== undefined) ? CFG.voiceAutoSend :
    undefined;
  const VOICE_AUTOSEND = (_voiceCfg === undefined) ? true : !!_voiceCfg;

  // Chat behavior
  const MAX_VISIBLE = 4;                 // ✅ max 4 in beeld
  const VISITOR_REPLY_DELAY_MS = 1200;   // visitor “thinking”
  const STUDENT_SEND_DELAY_MS = 550;     // ✅ soldier typing dots vóór student tekst

  // -------------------------
  // UI nodes (defensive)
  // -------------------------
  const versionPill = $("#versionPill");
  const studentPill = $("#studentPill");
  const voiceStatus = $("#voiceStatus");

  const loginModal = $("#loginModal");
  const studentSurnameInput = $("#studentSurname");
  const studentGroupSel = $("#studentGroup");
  const studentDifficultySel = $("#studentDifficulty");
  const btnStartTraining = $("#btnStartTraining");
  const loginError = $("#loginError");

  const btnReset = $("#btnReset");
  const btnReturn = $("#btnReturn");
  const btnPersonSearch = $("#btnPersonSearch");
  const btnSignIn = $("#btnSignIn");
  const btnDeny = $("#btnDeny");
  const btnNewScenario = $("#btnNewScenario");

  const holdToTalk = $("#holdToTalk");
  const textInput = $("#textInput");
  const btnSend = $("#btnSend");

  const idCardWrap = $("#idCardWrap");
  const btnReturnId = $("#btnReturnId");
  const idPhoto = $("#idPhoto");
  const portraitPhoto = $("#portraitPhoto");
  const portraitMood = $("#portraitMood");

  const idName = $("#idName");
  const idSurname = $("#idSurname");
  const idDob = $("#idDob");
  const idNat = $("#idNat");
  const idNo = $("#idNo");

  const hintBand = $("#hintBand");
  const hintBandText = $("#hintBandText");

  // Supervisor modal
  const supervisorModal = $("#supervisorModal");
  const btnCloseSupervisor = $("#btnCloseSupervisor");
  const btnSupervisorCheck = $("#btnSupervisorCheck");
  const btnReturnToVisitor = $("#btnReturnToVisitor");
  const svWhy = $("#svWhy");
  const svAppt = $("#svAppt");
  const svWho = $("#svWho");
  const svAbout = $("#svAbout");
  const svTime = $("#svTime");
  const svWhyStatus = $("#svWhyStatus");
  const svApptStatus = $("#svApptStatus");
  const svWhoStatus = $("#svWhoStatus");
  const svAboutStatus = $("#svAboutStatus");
  const svTimeStatus = $("#svTimeStatus");
  const svNote = $("#svNote");

  // Chat slots (in DOM heb je er 6, wij tonen er max 4)
  const slotEls = [
    { row: $("#slot0"), av: $("#slot0Avatar"), txt: $("#slot0Text"), meta: $("#slot0Meta") },
    { row: $("#slot1"), av: $("#slot1Avatar"), txt: $("#slot1Text"), meta: $("#slot1Meta") },
    { row: $("#slot2"), av: $("#slot2Avatar"), txt: $("#slot2Text"), meta: $("#slot2Meta") },
    { row: $("#slot3"), av: $("#slot3Avatar"), txt: $("#slot3Text"), meta: $("#slot3Meta") },
    { row: $("#slot4"), av: $("#slot4Avatar"), txt: $("#slot4Text"), meta: $("#slot4Meta") },
    { row: $("#slot5"), av: $("#slot5Avatar"), txt: $("#slot5Text"), meta: $("#slot5Meta") },
  ];
  const MAX_SLOTS = slotEls.length;

  // Avatar sources for rendering
  const visitorAvatar = portraitPhoto || { src: "" };
  const soldierAvatar = new Image();
  soldierAvatar.src = `${ASSET_BASE}/soldier.png`;

  // -------------------------
  // Version banner
  // -------------------------
  const __assetVer = String(window.__ASSET_VER__ || "");
  const __assetShort = __assetVer ? __assetVer.slice(-6) : "";
  if (versionPill) versionPill.textContent = `v${BUILD.version}${__assetShort ? " · " + __assetShort : ""}`;
  document.title = `${BUILD.name} v${BUILD.version}${__assetShort ? " (" + __assetShort + ")" : ""}`;
  console.info(`${BUILD.name} v${BUILD.version}`, BUILD, CFG);

  // -------------------------
  // Helpers
  // -------------------------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pad2 = (n) => String(n).padStart(2, "0");

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pick(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

 // ---- Visitor TTS (male voice selector) ----
let VISITOR_TTS_ENABLED = true;
let _ttsReady = false;
let _visitorVoice = null;

function _pickMaleVoice(langPref = ["en-GB","en-US","en"]) {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const scoreVoice = (v) => {
    const name = (v.name || "").toLowerCase();
    const voiceURI = (v.voiceURI || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase();

    // Language preference
    let langScore = 0;
    for (let i = 0; i < langPref.length; i++){
      const lp = langPref[i].toLowerCase();
      if (lang.startsWith(lp)) { langScore = 30 - i * 5; break; }
    }

    // Male hints in common voice names
    const maleHints = [
      "male","man","masculine",
      "daniel","alex","fred","oliver","tom","thomas","john","david",
      "guy","george","mark","james"
    ];
    const femaleHints = [
      "female","woman","feminine",
      "samantha","victoria","karen","zira","tessa","susan","anna","emma",
      "google uk english female"
    ];

    let genderScore = 0;
    for (const h of maleHints) if (name.includes(h) || voiceURI.includes(h)) genderScore += 15;
    for (const h of femaleHints) if (name.includes(h) || voiceURI.includes(h)) genderScore -= 20;

    // Prefer non-compact voices (often higher quality)
    const qualityScore = name.includes("premium") ? 10 : 0;

    // Slight preference for default voice if it also scores male
    const defaultScore = v.default ? 3 : 0;

    return langScore + genderScore + qualityScore + defaultScore;
  };

  // Pick best scoring voice
  let best = null;
  let bestScore = -1e9;
  for (const v of voices){
    const s = scoreVoice(v);
    if (s > bestScore){ bestScore = s; best = v; }
  }

  return best;
}

function primeTTS(){
  try{
    if (!("speechSynthesis" in window)) return;

    // Some browsers load voices async — hook once
    if (!window.__TTS_VOICES_HOOKED__){
      window.__TTS_VOICES_HOOKED__ = true;
      window.speechSynthesis.onvoiceschanged = () => {
        _visitorVoice = _pickMaleVoice();
      };
    }

    // attempt immediate voice selection too
    _visitorVoice = _pickMaleVoice();

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.();

    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.lang = "en-GB";
    if (_visitorVoice) u.voice = _visitorVoice;

    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    _ttsReady = true;
  }catch{}
}

function speakVisitor(text){
  try{
    if (!VISITOR_TTS_ENABLED) return;
    if (!("speechSynthesis" in window)) return;
    if (!_ttsReady) return;

    const t = String(text||"").trim();
    if (!t) return;

    // refresh voice if still null and voices became available
    if (!_visitorVoice) _visitorVoice = _pickMaleVoice();

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);

    // Pick a consistent male-ish sound
    u.lang = "en-GB";
    if (_visitorVoice) u.voice = _visitorVoice;

    // These help but can't override the selected voice gender
    u.rate = 0.98;    // slightly slower = “heavier”
    u.pitch = 0.75;   // lower pitch
    u.volume = 1.0;

    window.speechSynthesis.speak(u);
  }catch{}
}

  // -------------------------
  // Session
  // -------------------------
  const STUDENT_KEY = "veva.student.v2";
  let session = { surname: "", group: "", difficulty: "standard" };

  function loadStudentPrefill() {
    try { return JSON.parse(localStorage.getItem(STUDENT_KEY) || "null"); } catch { return null; }
  }
  function saveStudentPrefill(v) {
    try { localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch {}
  }
  function updateStudentPill() {
    if (!studentPill) return;
    if (!session.surname || !session.group) {
      studentPill.textContent = "Student: —";
      return;
    }
    const cap = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // -------------------------
  // ID + Avatar data (male-only)
  // -------------------------
  function headshotPath(index) {
    return `${ASSET_BASE}/${HEADSHOT_PREFIX}${pad2(index)}.png`;
  }

  function makeRandomId() {
    const idx = randInt(1, HEADSHOT_COUNT);

    // ✅ Male-only names (jij wilt later female toevoegen, maar nu niet)
    const FIRST_MALE = [
      "Liam","Noah","James","Oliver","Lucas",
      "Milan","Daan","Sem","Jayden","Finn",
      "Jasper","Thijs","Niels","Bram","Sven"
    ];
    const LAST = ["Miller","Bakker","de Vries","Jansen","Visser","Smit","Bos","van Dijk","de Jong","Meijer"];
    const NATS = ["Dutch","German","Belgian","French","British"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const first = pick(FIRST_MALE);
    const last = pick(LAST);
    const year = randInt(1976, 2002);
    const month = MONTHS[randInt(0, MONTHS.length - 1)];
    const day = pad2(randInt(1, 28));
    const nat = pick(NATS);
    const idNo =
      (nat === "Dutch" ? "NL-" :
       nat === "German" ? "DE-" :
       nat === "Belgian" ? "BE-" :
       nat === "French" ? "FR-" : "UK-") + randInt(100000, 999999);

    return {
      first,
      last,
      name: `${first} ${last}`,
      dob: `${day} ${month} ${year}`,
      nat,
      idNo,
      headshotIndex: idx,
      photoSrc: headshotPath(idx),
    };
  }

  let ID_DATA = makeRandomId();

  function syncVisitorAvatars() {
    // visitor avatar used in visitor messages + ID card + portrait
    for (const i of [0, 2, 4]) {
      const el = slotEls[i]?.av;
      if (el) el.src = ID_DATA.photoSrc;
    }
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
    if (portraitPhoto) portraitPhoto.src = ID_DATA.photoSrc;
    visitorAvatar.src = ID_DATA.photoSrc;
  }

  function showId() {
    if (!idCardWrap || !state?.visitor) return;

    if (idName) idName.textContent = state.visitor.name || "";
    if (idSurname) idSurname.textContent = state.visitor.last || "";
    if (idDob) idDob.textContent = state.visitor.dob || "";
    if (idNat) idNat.textContent = state.visitor.nat || "";
    if (idNo) idNo.textContent = state.visitor.idNo || "";
    if (idPhoto) idPhoto.src = state.visitor.photoSrc || "";

    idCardWrap.hidden = false;
    state.idVisible = true;
    if (hintBand) hintBand.hidden = true;
  }

  function hideId() {
    if (idCardWrap) idCardWrap.hidden = true;
    if (state) state.idVisible = false;
    updateHintBand(true);
  }

  // -------------------------
  // Mood
  // -------------------------
  const MOODS = [
    { key: "relaxed",   line: "The visitor looks relaxed.",   liarBias: 0.08 },
    { key: "neutral",   line: "The visitor looks neutral.",   liarBias: 0.12 },
    { key: "mixed",     line: "The visitor looks a bit uneasy.", liarBias: 0.22 },
    { key: "nervous",   line: "The visitor looks nervous.",   liarBias: 0.35 },
    { key: "irritated", line: "The visitor looks irritated.", liarBias: 0.28 },
  ];
  let currentMood = MOODS[1];

  function syncMoodUI() {
    if (portraitMood) portraitMood.textContent = currentMood?.line || "";
  }

  function maybeLie(truth, lie) {
    return (Math.random() < (currentMood?.liarBias || 0)) ? lie : truth;
  }

  // -------------------------
  // Chat ladder (history + typing)
  // -------------------------
  let history = []; // newest first: { side:'visitor'|'student', text:'' }

  function renderHistory() {
    // last 4 (plus optional typing inserted) — we render into the first 4 DOM slots, hide rest.
    let view = history.slice(0, MAX_VISIBLE);

    const typingMsg =
      (state?.typing?.visitor) ? { side: "visitor", typing: true } :
      (state?.typing?.student) ? { side: "student", typing: true } :
      null;

    if (typingMsg) view = [typingMsg, ...view].slice(0, MAX_VISIBLE);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = slotEls[i];
      if (!slot?.row) continue;

      // hide anything above MAX_VISIBLE always
      if (i >= MAX_VISIBLE) {
        slot.row.hidden = true;
        continue;
      }
function initChatSlotsHidden(){
  for (const slot of slotEls){
    if (!slot) continue;

    // Hide the whole row until it's actually used
    if (slot.row) slot.row.hidden = true;

    // Ensure avatar isn't visible (prevents empty circles)
    if (slot.av){
      slot.av.src = "";
      slot.av.alt = "";
      slot.av.style.display = "none";
    }

    // Clear text/meta
    if (slot.txt){
      slot.txt.classList.remove("typing");
      slot.txt.textContent = "";
      slot.txt.innerHTML = "";
    }
    if (slot.meta) slot.meta.textContent = "";
  }
}

      const msg = view[i];
      if (!msg) {
        slot.row.hidden = true; // ✅ no bubble/avatar until used
        continue;
      }

      slot.row.hidden = false;
      slot.row.classList.toggle("isVisitor", msg.side === "visitor");
      slot.row.classList.toggle("isStudent", msg.side === "student");
      slot.row.classList.toggle("left", msg.side === "visitor");
      slot.row.classList.toggle("right", msg.side === "student");

      if (slot.av) {
        slot.av.src = (msg.side === "visitor") ? (visitorAvatar.src || "") : (soldierAvatar.src || "");
        slot.av.alt = (msg.side === "visitor") ? "Visitor" : "Soldier";
      }

      if (slot.meta) slot.meta.textContent = "";

      if (slot.txt) {
        slot.txt.classList.toggle("typing", !!msg.typing);
        if (msg.typing) {
          slot.txt.innerHTML =
            '<span class="typingDots" aria-label="Typing"><span></span><span></span><span></span></span>';
        } else {
          slot.txt.textContent = msg.text || "";
        }
      }
    }
  }

  function pushVisitor(text) {
    const t = String(text || "").trim();
    if (!t) return;
    history.unshift({ side: "visitor", text: t });
    history = history.slice(0, MAX_VISIBLE);
    state.misses = 0;
    renderHistory();
    updateHintBand();

    // optional voice
    speakVisitor(t);
  }

  function pushStudent(text) {
    const t = String(text || "").trim();
    if (!t) return;
    history.unshift({ side: "student", text: t });
    history = history.slice(0, MAX_VISIBLE);
    state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  // Visitor queued replies with typing dots
  const _visitorQueue = [];
  let _visitorTimer = null;

  function enqueueVisitor(text) {
    const t = String(text || "").trim();
    if (!t) return;
    _visitorQueue.push(t);
    drainVisitorQueue();
  }

  function drainVisitorQueue() {
    if (_visitorTimer) return;
    if (!_visitorQueue.length) return;

    if (state?.typing) {
      state.typing.visitor = true;
      state.typing.student = false;
    }
    renderHistory();

    _visitorTimer = setTimeout(() => {
      _visitorTimer = null;
      if (state?.typing) state.typing.visitor = false;
      const next = _visitorQueue.shift();
      if (next) pushVisitor(next);
      if (_visitorQueue.length) drainVisitorQueue();
    }, VISITOR_REPLY_DELAY_MS);
  }

  // -------------------------
  // Hint band (basic/standard/advanced)
  // -------------------------
  function shouldShowHints() {
    return (session?.difficulty || "standard") !== "advanced";
  }

  function setHintText(t) {
    if (!hintBandText) return;
    hintBandText.textContent = t || "";
  }

  function updateHintBand(force = false) {
    if (!hintBand) return;

    if (!shouldShowHints()) {
      hintBand.hidden = true;
      return;
    }

    if (state?.idVisible) {
      hintBand.hidden = true;
      return;
    }

    const diff = (session?.difficulty || "standard");
    const canShow = force || diff === "basic" || (diff === "standard" && (state?.misses || 0) >= 2);

    if (!canShow) {
      hintBand.hidden = true;
      return;
    }

    hintBand.hidden = false;
    setHintText(getNextHint());
  }

  function nudge(t) {
    state.misses = (state.misses || 0) + 1;
    if (state?.idVisible) return;
    if (!shouldShowHints()) return;

    const diff = (session?.difficulty || "standard");
    const canShow = diff === "basic" || (diff === "standard" && state.misses >= 2);
    if (!canShow) return;

    if (hintBand) hintBand.hidden = false;
    setHintText(t || getNextHint());
  }

  function getNextHint() {
    const f = state?.facts || {};
    if (state?.mode === "person_search") return 'Ask: “Can I see your ID, please?”';

    if (state?.stage === "start") return 'Say: “Good morning. How can I help you?”';
    if (state?.stage === "help") return 'Ask: “What do you need?”';

    if (!f.name) return 'Ask: “Who are you?”';
    if (!f.purpose) return 'Ask: “What are you doing here?”';
    if (!f.appt) return 'Ask: “Do you have an appointment?”';

    if (f.appt === "yes") {
      if (!f.who) return 'Ask: “With whom do you have an appointment?”';
      if (!f.time) return 'Ask: “What time is your appointment?”';
      if (!f.about) return 'Ask: “What is the appointment about?”';
    }

    if (!state?.idChecked) return 'Ask: “Can I see your ID, please?”';
    return "Continue the procedure.";
  }

  // -------------------------
  // Meeting time helper
  // -------------------------
  function getMeetingTimeHHMM() {
    state.facts = state.facts || {};
    if (state.facts.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime)) return state.facts.meetingTime;

    const now = new Date();
    const offsetMin = randInt(17, 23);
    const dt = new Date(now.getTime() + offsetMin * 60 * 1000);
    const hhmm = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;

    state.facts.meetingTime = hhmm;
    state.facts.meetingOffsetMin = offsetMin;
    return hhmm;
  }

  function spellLastName() {
    const full = (ID_DATA?.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const ln = parts.length ? parts[parts.length - 1] : full;
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  // -------------------------
  // Intents
  // -------------------------
  const INTENTS = [
    { key: "greet", rx: /\b(hi|hello|good\s*(morning|afternoon|evening))\b/i },
    { key: "help_open", rx: /\b(how\s+can\s+i\s+help(\s+you(\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help)\b/i },
    { key: "purpose", rx: /\b(why\s+are\s+you\s+here|what\s+is\s+the\s+purpose\s+of\s+your\s+visit|what\s+is\s+the\s+reason\s+for\s+your\s+visit|what'?s\s+the\s+reason\s+for\s+your\s+visit|whats\s+the\s+reason\s+for\s+your\s+visit)\b/i },
    { key: "has_appointment", rx: /\b(do\s+you\s+have\s+an\s+appointment|do\s+you\s+have\s+a\s+meeting|have\s+you\s+got\s+an\s+appointment|have\s+you\s+got\s+a\s+meeting|is\s+your\s+visit\s+scheduled)\b/i },
    { key: "ask_name", rx: /\b(who\s+are\s+you|what\s+is\s+your\s+name|may\s+i\s+have\s+your\s+name|your\s+name\s*,?\s+please)\b/i },
    { key: "who_meeting", rx: /\b(who\s+do\s+you\s+have\s+an?\s+(appointment|meeting)\s+with|with\s+whom\s+do\s+you\s+have\s+an\s+appointment|who\s+are\s+you\s+(meeting|seeing|talking\s+to))\b/i },
    { key: "time_meeting", rx: /\b(what\s+time\s+is\s+(the\s+)?(appointment|meeting)|when\s+is\s+(the\s+)?(appointment|meeting)|what\s+time\s+are\s+you\s+expected)\b/i },
    { key: "about_meeting", rx: /\b(what\s+is\s+(the\s+)?(appointment|meeting)\s+about|what\s+are\s+you\s+delivering|tell\s+me\s+more\s+about\s+the\s+(appointment|meeting))\b/i },
    { key: "ask_id", rx: /\b(do\s+you\s+have\s+(an\s+)?id|can\s+i\s+see\s+your\s+id|show\s+me\s+your\s+id|id\s+please|identity\s+card|passport)\b/i },
    { key: "dob_q", rx: /\b(date\s+of\s+birth|dob|when\s+were\s+you\s+born)\b/i },
    { key: "nat_q", rx: /\b(nationality|what\s+is\s+your\s+nationality|where\s+are\s+you\s+from)\b/i },
    { key: "spell_last_name", rx: /\b(spell\s+(your\s+)?(last\s+name|surname)|how\s+do\s+you\s+spell\s+(your\s+)?(last\s+name|surname))\b/i },
    { key: "contact_supervisor", rx: /\b(i\s+will\s+contact\s+my\s+(supervisor|boss)|let\s+me\s+call\s+my\s+(supervisor|boss))\b/i },
    { key: "return_id", rx: /\b(return\s+your\s+id|here'?s\s+your\s+id\s+back|you\s+can\s+have\s+your\s+id\s+back)\b/i },
    { key: "we_search_you", rx: /\b(we\s+are\s+going\s+to\s+search\s+you|you\s+will\s+be\s+searched|we\s+will\s+search\s+you)\b/i },
    { key: "go_person_search", rx: /\b(go\s+to\s+(the\s+)?person\s+search|let'?s\s+go\s+to\s+(the\s+)?person\s+search)\b/i },
    { key: "go_sign_in", rx: /\b(go\s+to\s+(the\s+)?sign[\s-]*in(\s+office)?|go\s+to\s+reception|sign[\s-]*in\s+office)\b/i },
  ];

  function detectIntent(text) {
    const t = String(text || "");
    for (const it of INTENTS) {
      if (it.rx.test(t)) return it.key;
    }
    return "unknown";
  }

  // -------------------------
  // State
  // -------------------------
  let state = null;

  function resetScenario() {
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    syncMoodUI();

    ID_DATA = makeRandomId();
    syncVisitorAvatars();

    history.length = 0;

    state = {
      mode: "gate", // "gate" | "person_search"
      stage: "start",
      misses: 0,
      typing: { visitor: false, student: false },
      idVisible: false,
      idChecked: false,
      visitor: { ...ID_DATA },
      facts: { name: "", purpose: "", appt: "", who: "", time: "", about: "", meetingTime: "" },
    };

    hideId();
    updateHintBand(true);

    // ✅ Start met 1 visitor bubble
    pushVisitor(maybeLie("Hello.", "Hello—"));
  }

  // -------------------------
  // Person Search mode (werkt ook zonder patch file)
  // -------------------------
  function enterPersonSearch() {
    if (!state || state.stage === "ended") return;
    state.mode = "person_search";
    hideId();
    enqueueVisitor("Person search. Please ask for my surname and date of birth.");
    updateHintBand(true);
  }

  function psBand() {
    // if patch loaded, use it
    const fn = window.PS_PATCH?.bandFromMoodKey;
    if (typeof fn === "function") return fn(currentMood?.key || "neutral") || "cautious";

    // fallback
    if (currentMood?.key === "relaxed") return "open";
    if (currentMood?.key === "nervous" || currentMood?.key === "irritated") return "evasive";
    return "cautious";
  }

  function psPick(intentKey, ctx = {}) {
    const qa = window.PS_PATCH?.QA?.[intentKey];
    if (!qa) return ""; // fallback handled by caller

    const band = psBand();
    const arr = qa[band] || qa.cautious || [];
    let line = pick(arr);

    const v = state?.visitor || {};
    const rep = (key, val) => {
      line = String(line || "").replace(new RegExp("\\{" + key + "\\}", "g"), String(val ?? ""));
    };

    rep("meetingTime", ctx.meetingTime || "");
    rep("name", v.name || "");
    rep("first", v.first || "");
    rep("last", v.last || "");
    rep("dob", v.dob || "");
    rep("nat", v.nat || "");
    rep("idNo", v.idNo || "");

    return String(line || "").trim();
  }

  function handlePersonSearch(intent) {
    const mt = getMeetingTimeHHMM();

    if (intent === "ask_name") {
      const patched = psPick("ask_name", { meetingTime: mt });
      enqueueVisitor(patched || `My surname is ${state.visitor.last}.`);
      return;
    }
    if (intent === "dob_q") {
      const patched = psPick("dob_q", { meetingTime: mt });
      enqueueVisitor(patched || `My date of birth is ${state.visitor.dob}.`);
      return;
    }
    if (intent === "nat_q") {
      const patched = psPick("nat_q", { meetingTime: mt });
      enqueueVisitor(patched || `My nationality is ${state.visitor.nat}.`);
      return;
    }
    if (intent === "spell_last_name") {
      enqueueVisitor(spellLastName());
      return;
    }
    if (intent === "ask_id") {
      showId();
      const patched = psPick("ask_id", { meetingTime: mt });
      enqueueVisitor(patched || "Sure. Here you go.");
      return;
    }
    if (intent === "return_id") {
      hideId();
      enqueueVisitor("Thank you.");
      return;
    }
    if (intent === "go_sign_in") {
      enqueueVisitor("Go to sign-in office (placeholder).");
      return;
    }

    nudge('Try: “Can I see your ID, please?”');
    enqueueVisitor("Okay.");
  }

  // -------------------------
  // Gate dialogue
  // -------------------------
  function handleStudent(text) {
    const clean = String(text || "").trim();
    if (!clean || !state || state.stage === "ended") return;

    pushStudent(clean);

    const intent = detectIntent(clean);

    // if in person search mode
    if (state.mode === "person_search") {
      handlePersonSearch(intent);
      return;
    }

    // Gate flow minimal
    switch (state.stage) {
      case "start":
        if (intent === "greet") {
          state.stage = "help";
          enqueueVisitor(maybeLie("I… need help.", "Can you help me?"));
          return;
        }
        if (intent === "help_open") {
          state.stage = "purpose";
          enqueueVisitor("I need to get onto the base.");
          return;
        }
        nudge("Try greeting first.");
        return;

      case "help":
        if (intent === "help_open") {
          state.stage = "purpose";
          enqueueVisitor("I need to get onto the base.");
          return;
        }
        if (intent === "greet") {
          enqueueVisitor("Hello.");
          return;
        }
        nudge("Try: “How can I help you?”");
        return;

      case "purpose":
        if (intent === "ask_name") {
          state.facts.name = state.visitor.name;
          enqueueVisitor(`My name is ${state.visitor.name}.`);
          return;
        }
        if (intent === "purpose") {
          state.facts.purpose = "base entry";
          enqueueVisitor("I have an appointment on base.");
          return;
        }
        if (intent === "has_appointment") {
          state.facts.appt = "yes";
          enqueueVisitor("Yes, I have an appointment.");
          return;
        }
        if (intent === "who_meeting") {
          state.facts.who = "known";
          enqueueVisitor("I’m meeting my contact at reception.");
          return;
        }
        if (intent === "time_meeting") {
          const t = getMeetingTimeHHMM();
          state.facts.meetingTime = t;
          enqueueVisitor(`At ${t}.`);
          return;
        }
        if (intent === "about_meeting") {
          state.facts.about = "known";
          enqueueVisitor("It’s about a scheduled service appointment.");
          return;
        }
        if (intent === "ask_id") {
          state.idChecked = true;
          showId();
          enqueueVisitor("Sure. Here you go.");
          return;
        }
        if (intent === "go_person_search") {
          enterPersonSearch();
          return;
        }
        nudge("Try 5W questions, ask for ID, or go to person search.");
        return;

      default:
        enqueueVisitor("Okay.");
        return;
    }
  }

  // -------------------------
  // ✅ Student send flow (typing dots first)
  // -------------------------
  function submitStudentText(t) {
    const text = String(t || "").trim();
    if (!text || !state || state.stage === "ended") return;

    // show soldier typing dots (and only then show the real bubble)
    state.typing.student = true;
    state.typing.visitor = false;
    renderHistory();

    setTimeout(() => {
      if (!state || state.stage === "ended") return;
      state.typing.student = false;
      renderHistory();
      handleStudent(text);
    }, STUDENT_SEND_DELAY_MS);
  }

  // -------------------------
  // Supervisor modal (optional)
  // -------------------------
  function setStatus(el, ok) {
    if (!el) return;
    el.classList.remove("ok", "bad");
    if (ok === true) { el.textContent = "OK"; el.classList.add("ok"); }
    else if (ok === false) { el.textContent = "NO"; el.classList.add("bad"); }
    else { el.textContent = "—"; }
  }

  function openSupervisorModal() {
    if (!supervisorModal || !state) return;
    supervisorModal.hidden = false;

    if (svWhy) svWhy.value = state.facts?.purpose || "";
    if (svAppt) svAppt.value = state.facts?.appt || "yes";
    if (svWho) svWho.value = state.facts?.who || "";
    if (svAbout) svAbout.value = state.facts?.about || "";
    if (svTime) svTime.value = state.facts?.meetingTime ? `At ${state.facts.meetingTime}.` : "";

    setStatus(svWhyStatus, null);
    setStatus(svApptStatus, null);
    setStatus(svWhoStatus, null);
    setStatus(svAboutStatus, null);
    setStatus(svTimeStatus, null);

    if (svNote) svNote.textContent = "Fill in the answers, run checks, then return to the visitor.";
  }

  function closeSupervisorModal() {
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
  }

  function runSupervisorChecks() {
    if (!state) return;

    const expected = {
      why: normalize(state.facts?.purpose),
      appt: normalize(state.facts?.appt),
      who: normalize(state.facts?.who),
      about: normalize(state.facts?.about),
      time: normalize(state.facts?.meetingTime),
    };

    const entered = {
      why: normalize(svWhy?.value),
      appt: normalize(svAppt?.value),
      who: normalize(svWho?.value),
      about: normalize(svAbout?.value),
      time: normalize(svTime?.value),
    };

    const whyOk = !!entered.why;
    const apptOk = !!entered.appt;
    const whoOk = !!entered.who;
    const aboutOk = !!entered.about;
    const timeOk = !!entered.time;

    setStatus(svWhyStatus, whyOk);
    setStatus(svApptStatus, apptOk);
    setStatus(svWhoStatus, whoOk);
    setStatus(svAboutStatus, aboutOk);
    setStatus(svTimeStatus, timeOk);

    if (svNote) svNote.textContent = "Checks complete.";
  }

  // -------------------------
  // Buttons / events
  // -------------------------
  btnNewScenario?.addEventListener("click", () => {
    if (!state) return;
    resetScenario();
  });

  btnReset?.addEventListener("click", () => {
    history.length = 0;
    renderHistory();
    hideId();
    updateStudentPill();
    if (textInput) textInput.value = "";
    if (loginModal) loginModal.hidden = false;
  });

  btnReturn?.addEventListener("click", () => enqueueVisitor("Return (placeholder)."));

  btnPersonSearch?.addEventListener("click", () => {
    enterPersonSearch();
  });

  btnSignIn?.addEventListener("click", () => enqueueVisitor("Sign-in office (placeholder)."));

  btnDeny?.addEventListener("click", () => {
    enqueueVisitor("Why are you denying me?");
    state.stage = "ended";
    if (textInput) textInput.disabled = true;
    if (btnSend) btnSend.disabled = true;
    if (holdToTalk) holdToTalk.disabled = true;
  });

  btnReturnId?.addEventListener("click", () => {
    hideId();
    enqueueVisitor("Thank you.");
  });

  btnSend?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    const t = (textInput?.value || "").trim();
    if (textInput) textInput.value = "";
    submitStudentText(t);
  });

  textInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend?.click();
  });

  // Supervisor events
  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  supervisorModal?.addEventListener("click", (e) => {
    if (e.target === supervisorModal) closeSupervisorModal();
  });
  btnSupervisorCheck?.addEventListener("click", runSupervisorChecks);
  btnReturnToVisitor?.addEventListener("click", () => {
    runSupervisorChecks();
    closeSupervisorModal();
    hideId();
    enqueueVisitor("Okay.");
  });

  // -------------------------
  // Voice
  // -------------------------
  let recognition = null;
  let isRecognizing = false;

  function setVoiceStatusSafe(text) {
    if (voiceStatus) voiceStatus.textContent = text;
  }

  function voiceSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  async function ensureMicPermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  function setupSpeech() {
    if (!voiceSupported()) {
      setVoiceStatusSafe("Voice: not supported");
      if (holdToTalk) holdToTalk.disabled = true;
      return;
    }

    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;
    if (!okContext) {
      setVoiceStatusSafe("Voice: use https/localhost");
      if (holdToTalk) holdToTalk.disabled = true;
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      setVoiceStatusSafe("Voice: listening…");
      holdToTalk?.classList.add("listening");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const chunk = (res && res[0] && res[0].transcript) ? res[0].transcript : "";
        if (res.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      const combined = String(finalText || interimText || "").trim();
      if (combined && textInput) textInput.value = combined;
    };

    recognition.onerror = () => {
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");
      setVoiceStatusSafe("Voice: error");
    };

    recognition.onend = () => {
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");
      setVoiceStatusSafe("Voice: ready");

      // ✅ autosend via dezelfde typing-flow als de Send knop
      if (VOICE_AUTOSEND && state && state.stage !== "ended") {
        const toSend = (textInput?.value || "").trim();
        if (toSend) {
          if (textInput) textInput.value = "";
          submitStudentText(toSend);
        }
      }
    };

    setVoiceStatusSafe("Voice: ready");
  }

  async function startListen() {
    if (!recognition || isRecognizing) return;
    const ok = await ensureMicPermission();
    if (!ok) {
      setVoiceStatusSafe("Voice: blocked");
      return;
    }
    try { recognition.start(); } catch {
      setVoiceStatusSafe("Voice: blocked");
    }
  }

  function stopListen() {
    if (!recognition || !isRecognizing) return;
    try { recognition.stop(); } catch {}
  }

  holdToTalk?.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk?.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk?.addEventListener("pointercancel", () => stopListen());
  holdToTalk?.addEventListener("pointerleave", () => stopListen());

  // -------------------------
  // Login
  // -------------------------
  function tryStart() {
    const surname = (studentSurnameInput?.value || "").trim();
    const group = studentGroupSel?.value || "";
    const difficulty = studentDifficultySel?.value || "standard";

    if (!surname || !group) {
      if (loginError) loginError.style.display = "block";
      return;
    }
    if (loginError) loginError.style.display = "none";

    session = { surname, group, difficulty };
    saveStudentPrefill(session);
    updateStudentPill();

    if (loginModal) loginModal.hidden = true;

    // unlock TTS on user gesture
    primeTTS();

    resetScenario();
    textInput?.focus();
  }

  btnStartTraining?.addEventListener("click", tryStart);
  studentSurnameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  // -------------------------
  // Boot
  // -------------------------
  const pre = loadStudentPrefill();
  if (pre && typeof pre === "object") {
    if (pre.surname && studentSurnameInput) studentSurnameInput.value = pre.surname;
    if (pre.group && studentGroupSel) studentGroupSel.value = pre.group;
    if (pre.difficulty && studentDifficultySel) studentDifficultySel.value = pre.difficulty;
  }

  updateStudentPill();
  hideId();
  syncVisitorAvatars();
  setupSpeech();
  if (loginModal) loginModal.hidden = false;
  renderHistory();
})();
