// app.js (FULL REPLACEMENT — supervisor + search + contraband + no ghost bubbles)
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // -------- Config / Build --------
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);

  // Support both legacy keys (voiceAutoSend) and new keys (voiceAutosend)
  const _voiceCfg = (CFG.voiceAutosend !== undefined) ? CFG.voiceAutosend
                  : (CFG.voiceAutoSend !== undefined) ? CFG.voiceAutoSend
                  : undefined;
  const VOICE_AUTOSEND = (_voiceCfg === undefined) ? true : !!_voiceCfg;

  // Only show the last N bubbles (you asked for 4)
  const MAX_VISIBLE_BUBBLES = 4;

  // 1x1 transparent pixel (prevents broken-image “Soldier” circles)
  const TRANSPARENT_PX =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  // -------- UI --------
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

  // ID UI
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

  // Supervisor modal (optional in HTML)
  const supervisorModal = $("#supervisorModal");
  const btnCloseSupervisor = $("#btnCloseSupervisor");
  const btnSupervisorCheck = $("#btnSupervisorCheck");
  const btnReturnToVisitor = $("#btnReturnToVisitor");
  const svWhy = $("#svWhy");     // "Who at the gate"
  const svAppt = $("#svAppt");   // "Appointment yes/no"
  const svWho = $("#svWho");     // "With whom"
  const svAbout = $("#svAbout"); // "What is it about"
  const svTime = $("#svTime");   // "Time"
  const svWhyStatus = $("#svWhyStatus");
  const svApptStatus = $("#svApptStatus");
  const svWhoStatus = $("#svWhoStatus");
  const svAboutStatus = $("#svAboutStatus");
  const svTimeStatus = $("#svTimeStatus");
  const svNote = $("#svNote");

  // Chat slots (make sure these IDs exist in HTML)
  const slotEls = [
    { row: $("#slot0"), av: $("#slot0Avatar"), txt: $("#slot0Text"), meta: $("#slot0Meta") },
    { row: $("#slot1"), av: $("#slot1Avatar"), txt: $("#slot1Text"), meta: $("#slot1Meta") },
    { row: $("#slot2"), av: $("#slot2Avatar"), txt: $("#slot2Text"), meta: $("#slot2Meta") },
    { row: $("#slot3"), av: $("#slot3Avatar"), txt: $("#slot3Text"), meta: $("#slot3Meta") },
    { row: $("#slot4"), av: $("#slot4Avatar"), txt: $("#slot4Text"), meta: $("#slot4Meta") },
    { row: $("#slot5"), av: $("#slot5Avatar"), txt: $("#slot5Text"), meta: $("#slot5Meta") },
  ];

  const MAX_SLOTS = slotEls.length;

  // -------- Version banner --------
  const __assetVer = String(window.__ASSET_VER__ || "");
  const __assetShort = __assetVer ? __assetVer.slice(-6) : "";
  if (versionPill) versionPill.textContent = `v${BUILD.version}${__assetShort ? " · " + __assetShort : ""}`;
  document.title = `${BUILD.name} v${BUILD.version}${__assetShort ? " (" + __assetShort + ")" : ""}`;

  // -------- Helpers --------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pad2 = (n) => String(n).padStart(2, "0");

  function normalize(s){
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pick(arr){
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // "contains" match, forgiving
  function softMatch(a, b){
    const A = normalize(a);
    const B = normalize(b);
    if (!A || !B) return false;
    return A.includes(B) || B.includes(A);
  }

  // -------- Assets / Avatars --------
  const soldierAvatar = new Image();
  soldierAvatar.src = `${ASSET_BASE}/soldier.png`;
  soldierAvatar.onerror = () => { soldierAvatar.src = TRANSPARENT_PX; };

  // visitor avatar uses portraitPhoto if present, else dummy object
  const visitorAvatar = portraitPhoto || { src: "" };

  // -------- Session (student) --------
  const STUDENT_KEY = "veva.student.v2";
  let session = { surname:"", group:"", difficulty:"standard" };

  function loadStudentPrefill(){
    try{ return JSON.parse(localStorage.getItem(STUDENT_KEY) || "null"); } catch { return null; }
  }
  function saveStudentPrefill(v){
    try{ localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch {}
  }
  function updateStudentPill(){
    if (!studentPill) return;
    if (!session.surname || !session.group){
      studentPill.textContent = "Student: —";
      return;
    }
    const cap = (s) => (s||"").charAt(0).toUpperCase() + (s||"").slice(1);
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // -------- ID + Visitor (MALE ONLY) --------
  function headshotPath(index){
    return `${ASSET_BASE}/${HEADSHOT_PREFIX}${pad2(index)}.png`;
  }

  function makeRandomId(){
    const idx = randInt(1, HEADSHOT_COUNT);

    const FIRST = ["Liam","Noah","James","Oliver","Lucas","Milan","Daan","Sem","Jayden","Finn","Benjamin","Ethan","Jack","Thomas"];
    const LAST  = ["Miller","Bakker","de Vries","Jansen","Visser","Smit","Bos","van Dijk","de Jong","Meijer"];
    const NATS  = ["Dutch","German","Belgian","French","British"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const first = pick(FIRST);
    const last  = pick(LAST);
    const year  = randInt(1976, 2002);
    const month = MONTHS[randInt(0, MONTHS.length - 1)];
    const day   = pad2(randInt(1, 28));
    const nat   = pick(NATS);
    const idNo  = (nat === "Dutch" ? "NL-" : nat === "German" ? "DE-" : nat === "Belgian" ? "BE-" : nat === "French" ? "FR-" : "UK-")
                  + randInt(100000, 999999);

    return {
      first, last,
      name: `${first} ${last}`,
      dob: `${day} ${month} ${year}`,
      nat, idNo,
      headshotIndex: idx,
      photoSrc: headshotPath(idx)
    };
  }

  let ID_DATA = makeRandomId();

  function syncVisitorAvatars(){
    if (portraitPhoto) portraitPhoto.src = ID_DATA.photoSrc;
    visitorAvatar.src = ID_DATA.photoSrc;
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
  }

  // -------- Mood --------
  const MOODS = [
    { key:"relaxed",  line:"The visitor looks relaxed.",  liarBias:0.08 },
    { key:"neutral",  line:"The visitor looks neutral.",  liarBias:0.12 },
    { key:"mixed",    line:"The visitor looks a bit uneasy.", liarBias:0.22 },
    { key:"nervous",  line:"The visitor looks nervous.",  liarBias:0.35 },
    { key:"irritated",line:"The visitor looks irritated.",liarBias:0.28 }
  ];
  let currentMood = MOODS[1];
  function syncMoodUI(){
    if (portraitMood) portraitMood.textContent = currentMood?.line || "";
  }

  // -------- ID card show/hide --------
  let state = null;

  function showId(){
    if (!idCardWrap || !state?.visitor) return;

    if (idName) idName.textContent = state.visitor.name || "";
    if (idSurname) idSurname.textContent = state.visitor.last || "";
    if (idDob) idDob.textContent = state.visitor.dob || "";
    if (idNat) idNat.textContent = state.visitor.nat || "";
    if (idNo) idNo.textContent = state.visitor.idNo || "";
    if (idPhoto) idPhoto.src = state.visitor.photoSrc || TRANSPARENT_PX;

    idCardWrap.hidden = false;
    idCardWrap.style.display = "";
    state.idVisible = true;

    if (hintBand) hintBand.hidden = true;
  }

  function hideId(){
    if (idCardWrap){
      idCardWrap.hidden = true;
      idCardWrap.style.display = "none";
    }
    if (state) state.idVisible = false;
    updateHintBand(true);
  }

  // -------- Hint band (optional) --------
  function shouldShowHints(){
    return (session?.difficulty || "standard") !== "advanced";
  }
  function setHintText(t){
    if (!hintBandText) return;
    hintBandText.textContent = t || "";
  }
  function getNextHint(){
    const f = state?.facts || {};
    if (!f.name) return 'Ask: “Who are you?”';
    if (!f.purpose) return 'Ask: “What are you doing here?”';
    if (!f.appt) return 'Ask: “Do you have an appointment?”';
    if (f.appt === "yes"){
      if (!f.who) return 'Ask: “With whom do you have an appointment?”';
      if (!f.time) return 'Ask: “What time is your appointment?”';
      if (!f.about) return 'Ask: “What is the appointment about?”';
    }
    if (!state?.idChecked) return 'Ask: “Can I see your ID, please?”';
    if (!state?.supervisor?.done) return 'Say: “I’ll contact my supervisor.”';
    return "Continue the procedure.";
  }
  function updateHintBand(force=false){
    if (!hintBand) return;
    if (!shouldShowHints()){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }
    if (state?.idVisible){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }

    const diff = (session?.difficulty || "standard");
    const canShow = force || diff === "basic" || (diff === "standard" && (state?.misses || 0) >= 2);

    if (!canShow){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }

    hintBand.hidden = false;
    hintBand.style.display = "";
    setHintText(getNextHint());
  }
  function nudge(t){
    if (!state) return;
    state.misses = (state.misses || 0) + 1;
    if (!shouldShowHints() || state?.idVisible) return;
    setHintText(t || getNextHint());
    if (hintBand){
      hintBand.hidden = false;
      hintBand.style.display = "";
    }
  }

  // -------- Chat history --------
  let history = []; // newest first: {side, text}

  function hardHideRow(slot){
    if (!slot?.row) return;
    slot.row.hidden = true;
    slot.row.style.display = "none";

    if (slot.av){
      slot.av.hidden = true;
      slot.av.style.display = "none";
      slot.av.src = TRANSPARENT_PX;
      slot.av.alt = "";
    }
    if (slot.txt){
      slot.txt.classList.remove("typing");
      slot.txt.textContent = "";
    }
    if (slot.meta) slot.meta.textContent = "";
  }

  function showRow(slot){
    if (!slot?.row) return;
    slot.row.hidden = false;
    slot.row.style.display = "";
    if (slot.av){
      slot.av.hidden = false;
      slot.av.style.display = "";
    }
  }

  function renderHistory(){
    const base = history.slice(0, Math.min(MAX_VISIBLE_BUBBLES, MAX_SLOTS));

    const typingMsg =
      (state?.typing?.visitor) ? { side:"visitor", typing:true } :
      (state?.typing?.student) ? { side:"student", typing:true } :
      null;

    const view = typingMsg ? [typingMsg, ...base].slice(0, Math.min(MAX_VISIBLE_BUBBLES, MAX_SLOTS)) : base;

    for (let i = 0; i < MAX_SLOTS; i++){
      const msg = view[i];
      const slot = slotEls[i];
      if (!slot?.row) continue;

      if (!msg){
        hardHideRow(slot);
        continue;
      }

      showRow(slot);

      slot.row.classList.toggle("isVisitor", msg.side === "visitor");
      slot.row.classList.toggle("isStudent", msg.side === "student");
      slot.row.classList.toggle("left", msg.side === "visitor");
      slot.row.classList.toggle("right", msg.side === "student");

      if (slot.av){
        if (msg.side === "visitor"){
          slot.av.src = visitorAvatar.src || TRANSPARENT_PX;
          slot.av.alt = "Visitor";
        } else {
          slot.av.src = soldierAvatar.src || TRANSPARENT_PX;
          slot.av.alt = "Soldier";
        }
      }

      if (slot.meta) slot.meta.textContent = "";

      if (slot.txt){
        slot.txt.classList.toggle("typing", !!msg.typing);
        if (msg.typing){
          slot.txt.innerHTML =
            '<span class="typingDots" aria-label="Typing"><span></span><span></span><span></span></span>';
        } else {
          slot.txt.textContent = msg.text || "";
        }
      }
    }
  }

  function pushVisitor(text){
    const t = String(text || "").trim();
    if (!t) return;
    history.unshift({ side:"visitor", text:t });
    history = history.slice(0, MAX_VISIBLE_BUBBLES);
    if (state) state.misses = 0;
    renderHistory();
    updateHintBand();
    speakVisitor(t);
  }

  function pushStudent(text){
    const t = String(text || "").trim();
    if (!t) return;
    if (state?.typing) state.typing.student = false;
    history.unshift({ side:"student", text:t });
    history = history.slice(0, MAX_VISIBLE_BUBBLES);
    if (state) state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  // Visitor delayed replies with typing dots
  const VISITOR_REPLY_DELAY_MS = 900;
  const _visitorQueue = [];
  let _visitorTimer = null;

  function enqueueVisitor(text){
    const t = String(text || "").trim();
    if (!t) return;
    _visitorQueue.push(t);
    drainVisitorQueue();
  }

  function drainVisitorQueue(){
    if (_visitorTimer) return;
    if (!_visitorQueue.length) return;

    if (state?.typing){
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

  // -------- Meeting time helper --------
  function getMeetingTimeHHMM(){
    state.facts = state.facts || {};
    if (state.facts.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime)) return state.facts.meetingTime;
    const now = new Date();
    const offsetMin = randInt(17, 23);
    const dt = new Date(now.getTime() + offsetMin * 60 * 1000);
    const hhmm = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    state.facts.meetingTime = hhmm;
    return hhmm;
  }

  function spellLastName(){
    const full = (ID_DATA?.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const ln = parts.length ? parts[parts.length - 1] : full;
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  // -------- Visitor lines (base) --------
  const VISITOR = {
    greeting: ["Hello."],
    need_help: ["I… need help."],
    need_base: ["I need to get onto the base."],
    appointment_yes: ["Yes, I have an appointment."],
    search_why: ["Why am I being searched?"],
    illegal_what: ["What do you mean by illegal items?"],
    deny_why: ["Why are you denying me?"],
    thanks: ["Thanks."]
  };

  function visitorLine(key){
    return pick(VISITOR[key]) || "Okay.";
  }

  // -------- Intents --------
  const INTENTS = [
    { key:"greet", rx:/\b(hi|hello|good\s*(morning|afternoon|evening))\b/i },
    { key:"help_open", rx:/\b(how\s+can\s+i\s+help(\s+you(\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help)\b/i },

    { key:"purpose", rx:/\b(why\s+are\s+you\s+here|what\s+is\s+the\s+purpose|reason\s+for\s+your\s+visit)\b/i },
    { key:"has_appointment", rx:/\b(do\s+you\s+have\s+an\s+appointment|do\s+you\s+have\s+a\s+meeting|is\s+your\s+visit\s+scheduled)\b/i },
    { key:"ask_name", rx:/\b(who\s+are\s+you|what\s+is\s+your\s+name|your\s+name\s*,?\s+please)\b/i },
    { key:"who_meeting", rx:/\b(who\s+are\s+you\s+(meeting|seeing)|who\s+do\s+you\s+have\s+an?\s+(appointment|meeting)\s+with)\b/i },
    { key:"time_meeting", rx:/\b(what\s+time\s+is\s+(the\s+)?(appointment|meeting)|when\s+is\s+(the\s+)?(appointment|meeting))\b/i },
    { key:"about_meeting", rx:/\b(what\s+is\s+(the\s+)?(appointment|meeting)\s+about|what\s+are\s+you\s+delivering)\b/i },

    { key:"ask_id", rx:/\b(can\s+i\s+see\s+your\s+id|show\s+me\s+your\s+id|id\s+please|passport)\b/i },
    { key:"dob_q", rx:/\b(date\s+of\s+birth|dob|when\s+were\s+you\s+born)\b/i },
    { key:"nat_q", rx:/\b(nationality|what\s+is\s+your\s+nationality|where\s+are\s+you\s+from)\b/i },
    { key:"spell_last_name", rx:/\b(spell\s+(your\s+)?(last\s+name|surname)|how\s+do\s+you\s+spell)\b/i },
    { key:"return_id", rx:/\b(return\s+your\s+id|here\'?s\s+your\s+id\s+back)\b/i },

    // supervisor trigger
    { key:"contact_supervisor", rx:/\b(contact|call)\s+(my\s+)?supervisor\b|\b(i('| a)m|i\s+will)\s+contact\s+(my\s+)?supervisor\b/i },

    // search + threat in one line
    { key:"search_and_threat", rx:/\b(search(ed)?|frisk|pat\s*down)\b.*\b(increased\s+threat|heightened\s+security)\b|\b(increased\s+threat|heightened\s+security)\b.*\b(search(ed)?|frisk|pat\s*down)\b/i },

    { key:"we_search_you", rx:/\b(you\s+will\s+be\s+searched|we\s+will\s+search\s+you|we\'?re\s+going\s+to\s+search\s+you|you\'?re\s+going\s+to\s+get\s+searched|we\'?re\s+going\s+to\s+frisk\s+you|we\'?re\s+going\s+to\s+pat\s+you\s+down)\b/i },
    { key:"everyone_searched", rx:/\b(everyone\s+is\s+searched|routine\s+search|standard\s+procedure)\b/i },
    { key:"due_threat", rx:/\b(heightened\s+security|increased\s+threat|security\s+reasons)\b/i },

    { key:"illegal_items", rx:/\b(any\s+illegal\s+items|anything\s+illegal|contraband|prohibited)\b/i },

    // category questions
    { key:"ask_weapons", rx:/\b(weapons?|knife|gun|firearm)\b/i },
    { key:"ask_drugs", rx:/\b(drugs?|narcotics?)\b/i },
    { key:"ask_alcohol", rx:/\b(alcohol|beer|wine|liquor)\b/i },

    // hand in
    { key:"hand_in", rx:/\b(hand\s+in|hand\s+over|turn\s+it\s+in|leave\s+it\s+here)\b|\b(get\s+it\s+back\s+at\s+the\s+end)\b/i },

    { key:"go_person_search", rx:/\b(go\s+to\s+(the\s+)?person\s+search|person\s+search)\b/i },
  ];

  function detectIntent(text){
    const t = String(text || "");
    for (const it of INTENTS){
      if (it.rx.test(t)) return it.key;
    }
    return "unknown";
  }

  // -------- Supervisor modal helpers --------
  function openSupervisorModal(){
    if (!supervisorModal) return;

    // clear fields
    if (svWhy) svWhy.value = "";
    if (svAppt) svAppt.value = "";
    if (svWho) svWho.value = "";
    if (svTime) svTime.value = "";
    if (svAbout) svAbout.value = "";
    if (svNote) svNote.textContent = "";

    [svWhyStatus, svApptStatus, svWhoStatus, svAboutStatus, svTimeStatus].forEach(el => {
      if (el) el.textContent = "";
    });

    supervisorModal.hidden = false;
    supervisorModal.style.display = "";

    // no typing while modal open
    if (state?.typing){
      state.typing.student = false;
      state.typing.visitor = false;
      renderHistory();
    }
  }

  function closeSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
    supervisorModal.style.display = "none";
  }

  function validateSupervisorForm(){
    const t = state?.truth;
    if (!t) return { ok:false, msg:"No truth data loaded." };

    const whoAtGate = (svWhy?.value || "").trim();
    const appt      = (svAppt?.value || "").trim();
    const withWhom  = (svWho?.value || "").trim();
    const time      = (svTime?.value || "").trim();
    const about     = (svAbout?.value || "").trim();

    const missing = [];
    if (!whoAtGate) missing.push("Who at the gate");
    if (!appt) missing.push("Appointment (yes/no)");
    if (!withWhom) missing.push("With whom");
    if (!time) missing.push("Time");
    if (!about) missing.push("About");

    if (missing.length){
      return { ok:false, msg:`Please fill: ${missing.join(", ")}.` };
    }

    const whoOK = softMatch(whoAtGate, t.whoAtGate);

    const apptOK = (() => {
      const A = normalize(appt);
      // Expect "yes"
      return A.includes("yes") || A === "y" || A.includes("have an appointment") || A.includes("appointment yes");
    })();

    const withOK  = softMatch(withWhom, t.withWhom);
    const timeOK  = softMatch(time, t.time);
    const aboutOK = softMatch(about, t.about);

    if (svWhyStatus) svWhyStatus.textContent = whoOK ? "OK" : "Mismatch";
    if (svApptStatus) svApptStatus.textContent = apptOK ? "OK" : "Mismatch";
    if (svWhoStatus) svWhoStatus.textContent = withOK ? "OK" : "Mismatch";
    if (svTimeStatus) svTimeStatus.textContent = timeOK ? "OK" : "Mismatch";
    if (svAboutStatus) svAboutStatus.textContent = aboutOK ? "OK" : "Mismatch";

    const allOK = whoOK && apptOK && withOK && timeOK && aboutOK;
    if (!allOK){
      return { ok:false, msg:"Some entries do not match what the visitor told you. Ask again and correct the form." };
    }

    return { ok:true, msg:"Supervisor approved." };
  }

  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  btnReturnToVisitor?.addEventListener("click", closeSupervisorModal);

  btnSupervisorCheck?.addEventListener("click", () => {
    const res = validateSupervisorForm();
    if (svNote) svNote.textContent = res.msg;

    if (!res.ok) return;

    // Always approve (your request)
    if (!state.supervisor) state.supervisor = { done:false };
    state.supervisor.done = true;

    closeSupervisorModal();

    // Back to main screen; now student can announce search
    state.stage = "search_announce";
    updateHintBand(true);
  });

  // -------- Scenario state --------
  function resetScenario(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    syncMoodUI();

    ID_DATA = makeRandomId();
    syncVisitorAvatars();

    history.length = 0;

    // create base state first (so helpers using "state" are safe)
    state = {
      stage: "start",
      misses: 0,
      typing: { visitor:false, student:false },

      idVisible: false,
      idChecked: false,

      visitor: { ...ID_DATA },

      supervisor: { done:false },

      // what student has gathered (for hints)
      facts: { name:"", purpose:"", appt:"", who:"", time:"", about:"", meetingTime:"" },

      // contraband state
      carry: { weapons:false, drugs:false, alcohol:false }, // real items (hidden)
      contraband: { weapons:false, drugs:false, alcohol:false }, // admitted items (for flow)
      truth: null
    };

    // determine what visitor REALLY has (chance-based)
    state.carry = {
      weapons: Math.random() < 0.12,
      drugs:   Math.random() < 0.08,
      alcohol: Math.random() < 0.22
    };

    // truth data for appointment
    const meetingTime = getMeetingTimeHHMM();
    const withWhom = "Sergeant de Vries";
    const about = pick([
      "It’s a delivery for the workshop—tools and spare parts.",
      "It’s a scheduled maintenance check for equipment.",
      "It’s paperwork and access for a contractor delivery."
    ]);

    state.truth = {
      whoAtGate: ID_DATA.name,
      purpose: "Appointment on base",
      hasAppointment: "yes",
      withWhom,
      time: meetingTime,
      about
    };

    hideId();
    updateHintBand(true);

    // EXACTLY one bubble at start
    pushVisitor(visitorLine("greeting"));
  }

  // -------- Dialogue --------
  function handleStudent(raw){
    const clean = String(raw || "").trim();
    if (!clean || !state || state.stage === "ended") return;

    pushStudent(clean);

    const intent = detectIntent(clean);

    // Supervisor trigger (always available once scenario started)
    if (intent === "contact_supervisor"){
      // Must have ID checked + information gathered? You asked for 5W/H popup — we allow opening anytime.
      openSupervisorModal();
      return;
    }

    // progress tracking (for hints)
    if (intent === "ask_name") state.facts.name = state.truth?.whoAtGate || state.visitor.name;
    if (intent === "purpose") state.facts.purpose = "known";
    if (intent === "has_appointment") state.facts.appt = "yes";
    if (intent === "who_meeting") state.facts.who = "known";
    if (intent === "time_meeting") state.facts.time = "known";
    if (intent === "about_meeting") state.facts.about = "known";
    if (intent === "ask_id") state.idChecked = true;

    switch(state.stage){
      case "start":
        if (intent === "greet"){
          state.stage = "help";
          enqueueVisitor(visitorLine("need_help"));
          return;
        }
        if (intent === "help_open"){
          state.stage = "purpose";
          state.facts.purpose = "pending";
          enqueueVisitor(visitorLine("need_base"));
          return;
        }
        nudge("Try greeting first.");
        return;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          enqueueVisitor(visitorLine("need_base"));
          return;
        }
        if (intent === "greet"){
          enqueueVisitor(visitorLine("greeting"));
          return;
        }
        nudge('Try: “How can I help you?”');
        return;

      case "purpose":
        if (intent === "purpose"){
          enqueueVisitor(`I have an appointment on base.`);
          return;
        }
        if (intent === "has_appointment"){
          enqueueVisitor(visitorLine("appointment_yes"));
          return;
        }
        if (intent === "who_meeting"){
          enqueueVisitor(`I’m meeting ${state.truth.withWhom}.`);
          return;
        }
        if (intent === "time_meeting"){
          const t = state.truth.time;
          state.facts.meetingTime = t;
          enqueueVisitor(`At ${t}.`);
          return;
        }
        if (intent === "about_meeting"){
          enqueueVisitor(state.truth.about);
          return;
        }
        if (intent === "ask_name"){
          enqueueVisitor(`My name is ${state.truth.whoAtGate}.`);
          return;
        }
        if (intent === "ask_id"){
          showId();
          state.stage = "control_q";
          enqueueVisitor("Sure. Here you go.");
          return;
        }
        nudge("Try 5W questions, or ask for ID.");
        return;

      case "control_q":
        if (intent === "dob_q"){
          enqueueVisitor(`My date of birth is ${ID_DATA.dob}.`);
          return;
        }
        if (intent === "nat_q"){
          enqueueVisitor(`My nationality is ${ID_DATA.nat}.`);
          return;
        }
        if (intent === "spell_last_name"){
          enqueueVisitor(spellLastName());
          return;
        }
        if (intent === "return_id"){
          hideId();
          enqueueVisitor(visitorLine("thanks"));
          // after ID return, student should contact supervisor first
          state.stage = "post_id";
          updateHintBand(true);
          return;
        }
        nudge("Try a control question, or return the ID.");
        return;

      case "post_id":
        // Here we want them to contact supervisor to open 5W/H popup
        if (!state.supervisor?.done){
          nudge('Say: “I’ll contact my supervisor.”');
          return;
        }
        // If supervisor already done, proceed
        state.stage = "search_announce";
        updateHintBand(true);
        return;

      case "search_announce":
        // If they combine search + threat in one sentence, skip "why" stage.
        if (intent === "search_and_threat"){
          state.stage = "illegal_items";
          enqueueVisitor("Okay.");
          return;
        }
        if (intent === "we_search_you"){
          state.stage = "why_searched";
          enqueueVisitor(visitorLine("search_why"));
          return;
        }
        nudge('Try: “You are going to be searched.”');
        return;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat"){
          state.stage = "illegal_items";
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Explain: routine search / due to an increased threat.");
        return;

      case "illegal_items":
        if (intent === "illegal_items"){
          state.stage = "clarify_illegal";
          enqueueVisitor(visitorLine("illegal_what"));
          return;
        }
        nudge("Ask: illegal items / contraband.");
        return;

      case "clarify_illegal": {
        const askedWeapons = (intent === "ask_weapons");
        const askedDrugs   = (intent === "ask_drugs");
        const askedAlcohol = (intent === "ask_alcohol");

        if (!askedWeapons && !askedDrugs && !askedAlcohol){
          nudge("Clarify: weapons, drugs and alcohol.");
          return;
        }

        // mood-driven honesty
        const honesty = Math.random() > (currentMood?.liarBias ?? 0.2);

        const admits = { weapons:false, drugs:false, alcohol:false };

        if (askedWeapons){
          admits.weapons = state.carry.weapons && honesty;
          enqueueVisitor(admits.weapons ? "Yes… I have a small pocket knife." : "No weapons.");
        }
        if (askedDrugs){
          admits.drugs = state.carry.drugs && honesty;
          enqueueVisitor(admits.drugs ? "…Yes. I have something on me." : "No drugs.");
        }
        if (askedAlcohol){
          admits.alcohol = state.carry.alcohol && honesty;
          enqueueVisitor(admits.alcohol ? "Yes, I have alcohol in my bag." : "No alcohol.");
        }

        // track admitted
        state.contraband.weapons = state.contraband.weapons || admits.weapons;
        state.contraband.drugs   = state.contraband.drugs   || admits.drugs;
        state.contraband.alcohol = state.contraband.alcohol || admits.alcohol;

        if (state.contraband.weapons || state.contraband.drugs || state.contraband.alcohol){
          state.stage = "hand_in_step";
          return;
        }

        state.stage = "direction";
        enqueueVisitor("Okay.");
        return;
      }

      case "hand_in_step":
        if (intent === "hand_in"){
          // visitor hands it over -> clear
          state.carry = { weapons:false, drugs:false, alcohol:false };
          state.contraband = { weapons:false, drugs:false, alcohol:false };

          enqueueVisitor("Okay. I’ll hand it over.");
          state.stage = "direction";
          return;
        }
        nudge("Tell them: hand in any contraband; you will get it back at the end of your visit.");
        return;

      case "direction":
        if (intent === "go_person_search"){
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Try: “Go to person search.”");
        return;

      default:
        enqueueVisitor("Okay.");
        return;
    }
  }

  // -------- Sidebar buttons --------
  btnDeny?.addEventListener("click", () => {
    enqueueVisitor(visitorLine("deny_why"));
  });

  btnNewScenario?.addEventListener("click", () => {
    if (!textInput || !btnSend || !holdToTalk) return;
    textInput.disabled = false;
    btnSend.disabled = false;
    holdToTalk.disabled = false;
    resetScenario();
  });

  btnReset?.addEventListener("click", () => {
    if (loginModal) loginModal.hidden = false;
    if (textInput) textInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
    if (holdToTalk) holdToTalk.disabled = false;

    history.length = 0;
    renderHistory();
    hideId();
    updateStudentPill();
    if (textInput) textInput.value = "";
  });

  btnReturn?.addEventListener("click", () => enqueueVisitor("Return (placeholder)."));
  btnPersonSearch?.addEventListener("click", () => enqueueVisitor("Person search (placeholder)."));
  btnSignIn?.addEventListener("click", () => enqueueVisitor("Sign-in office (placeholder)."));

  btnReturnId?.addEventListener("click", () => {
    hideId();
    enqueueVisitor(visitorLine("thanks"));
    if (state && state.stage === "control_q"){
      state.stage = "post_id";
      updateHintBand(true);
    }
  });

  // -------- Input --------
  btnSend?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    const t = (textInput?.value || "").trim();
    if (textInput) textInput.value = "";
    handleStudent(t);
  });

  textInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend?.click();
  });

  textInput?.addEventListener("input", () => {
    if (!state?.typing) return;
    state.typing.student = !!(textInput.value || "").trim();
    renderHistory();
  });

  // -------- Voice (SpeechRecognition) --------
  let recognition = null;
  let isRecognizing = false;

  function setVoiceStatusSafe(text){
    if (voiceStatus) voiceStatus.textContent = text;
  }

  async function ensureMicPermission(){
    try{
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    }catch{
      return false;
    }
  }

  function voiceSupported(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setupSpeech(){
    if (!voiceSupported()){
      setVoiceStatusSafe("Voice: not supported");
      if (holdToTalk){
        holdToTalk.disabled = true;
        holdToTalk.title = "SpeechRecognition not supported in this browser.";
      }
      return;
    }

    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;
    if (!okContext){
      setVoiceStatusSafe("Voice: use https/localhost");
      if (holdToTalk){
        holdToTalk.disabled = true;
        holdToTalk.title = "Voice requires https:// or http://localhost (not file://).";
      }
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      if (state?.typing){
        state.typing.student = true;
        state.typing.visitor = false;
      }
      renderHistory();
      if (state) state._voiceSessionActive = true;
      setVoiceStatusSafe("Voice: listening…");
      holdToTalk?.classList.add("listening");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++){
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
      setVoiceStatusSafe("Voice: ready");
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");
      if (state?.typing) state.typing.student = false;
      renderHistory();

      if (VOICE_AUTOSEND && state && state._voiceSessionActive){
        const toSend = (textInput?.value || "").trim();
        if (toSend){
          handleStudent(toSend);
          if (textInput) textInput.value = "";
        }
      }

      if (state) state._voiceSessionActive = false;
    };
  }

  async function startListen(){
    if (!recognition || isRecognizing) return;
    const ok = await ensureMicPermission();
    if (!ok){
      setVoiceStatusSafe("Voice: blocked");
      return;
    }
    try { recognition.start(); } catch {}
  }

  function stopListen(){
    if (!recognition || !isRecognizing) return;
    try { recognition.stop(); } catch {}
  }

  holdToTalk?.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk?.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk?.addEventListener("pointercancel", stopListen);
  holdToTalk?.addEventListener("pointerleave", stopListen);

  // -------- Visitor TTS (male-ish) --------
  let VISITOR_TTS_ENABLED = true;
  let _ttsReady = false;

  function pickMaleishVoice(){
    try{
      const voices = window.speechSynthesis?.getVoices?.() || [];
      const preferred = voices.find(v =>
        /en(-|_)(GB|US|AU|IE|NZ)/i.test(v.lang) &&
        /male|daniel|george|arthur|fred|guy/i.test(v.name)
      );
      return preferred || voices.find(v => /en/i.test(v.lang)) || null;
    }catch{
      return null;
    }
  }

  function primeTTS(){
    try{
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.lang = "en-GB";
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

      const t = String(text || "").trim();
      if (!t) return;

      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      const v = pickMaleishVoice();
      if (v) u.voice = v;

      u.lang = (v?.lang) || "en-GB";
      u.rate = 1.0;
      u.pitch = 0.75;
      u.volume = 1.0;

      window.speechSynthesis.speak(u);
    }catch{}
  }

  // -------- Login --------
  function tryStart(){
    const surname = (studentSurnameInput?.value || "").trim();
    const group = studentGroupSel?.value;
    const difficulty = studentDifficultySel?.value || "standard";

    if (!surname || !group){
      if (loginError) loginError.style.display = "block";
      return;
    }
    if (loginError) loginError.style.display = "none";

    session = { surname, group, difficulty };
    saveStudentPrefill(session);
    updateStudentPill();

    if (loginModal) loginModal.hidden = true;

    // Unlock TTS after user gesture
    primeTTS();

    resetScenario();
    textInput?.focus();
  }

  btnStartTraining?.addEventListener("click", tryStart);
  studentSurnameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  // -------- Boot --------
  const pre = loadStudentPrefill();
  if (pre && typeof pre === "object"){
    if (pre.surname && studentSurnameInput) studentSurnameInput.value = pre.surname;
    if (pre.group && studentGroupSel) studentGroupSel.value = pre.group;
    if (pre.difficulty && studentDifficultySel) studentDifficultySel.value = pre.difficulty;
    session = { ...session, ...pre };
  }

  updateStudentPill();
  syncVisitorAvatars();
  hideId();
  setupSpeech();

  if (loginModal) loginModal.hidden = false;

  // IMPORTANT: on first load, show NOTHING except what we render
  history.length = 0;
  state = {
    stage: "idle",
    typing: { visitor:false, student:false },
    visitor: { ...ID_DATA },
    facts: {},
    misses: 0,
    supervisor: { done:false }
  };
  renderHistory();

})();
