// app.js (FULL WORKING SET)
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

  function setInputEnabled(on){
    const enabled = !!on;
    if (textInput) textInput.disabled = !enabled;
    if (btnSend) btnSend.disabled = !enabled;
    if (holdToTalk) holdToTalk.disabled = !enabled;
  }


  // Portrait UI
  const portraitPhoto = $("#portraitPhoto");
  const portraitMood = $("#portraitMood");

  // ID UI (training card)
  const idCardWrap = $("#idCardWrap");
  const btnReturnId = $("#btnReturnId");
  const idPhoto = $("#idPhoto");
  const idName = $("#idName");
  const idSurname = $("#idSurname");
  const idDob = $("#idDob");
  const idNat = $("#idNat");
  const idNo = $("#idNo");

  const idBarcode2 = $("#idBarcode2");
  const idLevel = $("#idLevel");
  const idScenario = $("#idScenario");

  // Hint band
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

  // Chat slots
  const slotEls = [0,1,2,3,4,5].map(i => {
    const row = $(`#slot${i}`);
    return {
      row,
      av: $(`#slot${i}Avatar`),
      bubble: row ? row.querySelector(".bubble") : null,
      txt: $(`#slot${i}Text`),
      meta: $(`#slot${i}Meta`)
    };
  });

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

  // -------- Assets / Avatars --------
  const soldierAvatar = new Image();
  soldierAvatar.src = `${ASSET_BASE}/soldier.png`;
  soldierAvatar.onerror = () => { soldierAvatar.src = TRANSPARENT_PX; };

  // visitor avatar uses portraitPhoto
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

    // MALE only
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

  // -------- Scenario state --------
  let state = null;

  // -------- Training ID card sync --------
  function makeBarcodeString(v){
    const safe = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const parts = [
      "VEVA",
      safe(v?.idNo),
      safe(v?.last),
      safe(v?.first),
      safe(v?.dob),
      safe(v?.nat),
      safe(state?.facts?.meetingTime || "")
    ].filter(Boolean);
    return parts.join(" | ");
  }

  function syncTrainingIdCard(){
    const v = state?.visitor || ID_DATA;
    if (!v) return;

    if (idLevel) idLevel.textContent = String(session?.difficulty || "standard").toUpperCase();
    if (idScenario) idScenario.textContent = "Checkpoint";

    if (idName) idName.textContent = v.name || "";
    if (idSurname) idSurname.textContent = v.last || "";
    if (idDob) idDob.textContent = v.dob || "";
    if (idNat) idNat.textContent = v.nat || "";
    if (idNo) idNo.textContent = v.idNo || "";
    if (idPhoto) idPhoto.src = v.photoSrc || TRANSPARENT_PX;

    if (idBarcode2) idBarcode2.textContent = makeBarcodeString(v);
  }

  function syncVisitorAvatars(){
    if (portraitPhoto) portraitPhoto.src = ID_DATA.photoSrc;
    visitorAvatar.src = ID_DATA.photoSrc;
    syncTrainingIdCard();
  }

  // -------- ID card show/hide --------
  function showId(){
    if (!idCardWrap || !state?.visitor) return;
    syncTrainingIdCard();
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

  // -------- Hint band --------
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
    if (!state?.supervisorOk) return 'Say: “I’ll contact my supervisor.”';
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
    slot.row.classList.remove("left","right","isVisitor","isStudent");
    if (slot.av){
      slot.av.hidden = true;
      slot.av.style.display = "none";
      slot.av.src = TRANSPARENT_PX;
      slot.av.alt = "";
    }
    if (slot.bubble){
      slot.bubble.classList.remove("typing");
    }
    if (slot.txt){
      slot.txt.textContent = "";
      slot.txt.innerHTML = "";
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
      if (slot.bubble) slot.bubble.classList.toggle("typing", !!msg.typing);

      if (slot.txt){
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
  let _approachTimer = null;


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

  // -------- Visitor lines --------
  const VISITOR = {
    greeting: ["Hello."],
    need_help: ["Hi, I need help."],
    need_base: ["I need to get onto the base."],
    appointment_yes: ["Yes, I have an appointment."],
    who_meeting: ["I’m meeting Sergeant de Vries."],
    about_meeting: ["It’s a delivery for the workshop—tools and spare parts."],
    search_why: ["Why am I being searched?"],
    illegal_what: ["What do you mean by illegal items?"],
    deny_why: ["Why are you denying me?"],
    thanks: ["Thanks."],
    handover_ok: ["Okay, I'll hand it over."]
  };

  function visitorLine(key){ return pick(VISITOR[key]) || "Okay."; }

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
    { key:"contact_supervisor", rx:/\b(contact\s+my\s+supervisor|i\'?ll\s+contact\s+my\s+supervisor|call\s+my\s+supervisor|supervisor\s+check)\b/i },
    { key:"we_search_you", rx:/\b(you\s+will\s+be\s+searched|we\s+will\s+search\s+you|you(\'?re|\s+are)\s+going\s+to\s+get\s+searched)\b/i },
    { key:"everyone_searched", rx:/\b(everyone\s+is\s+searched|routine\s+search)\b/i },
    { key:"due_threat", rx:/\b(heightened\s+security|increased\s+threat|security\s+reasons)\b/i },
    { key:"illegal_items", rx:/\b(any\s+illegal\s+items|anything\s+illegal|contraband|prohibited)\b/i },
    { key:"illegal_clarify", rx:/\b(weapons?|drugs?|alcohol|knife|gun)\b/i },
    { key:"hand_in", rx:/\b(hand\s+it\s+in|hand\s+it\s+over|please\s+hand\s+it\s+over|you\s+must\s+hand\s+it\s+over|you\s+have\s+to\s+hand\s+it\s+in|you\'?ll\s+get\s+it\s+back)\b/i },
    { key:"go_person_search", rx:/\b(go\s+to\s+(the\s+)?person\s+search|person\s+search)\b/i },
  ];

  function detectIntent(text){
    const t = String(text || "");
    for (const it of INTENTS){
      if (it.rx.test(t)) return it.key;
    }
    return "unknown";
  }

  // -------- Supervisor modal logic --------
  function openSupervisorModal(){
    if (!supervisorModal) return;
    state._stageBeforeSupervisor = state.stage;

    if (svWhy) svWhy.value = "";
    if (svAppt) svAppt.value = "";
    if (svWho) svWho.value = "";
    if (svTime) svTime.value = "";
    if (svAbout) svAbout.value = "";

    if (svWhyStatus) svWhyStatus.textContent = "";
    if (svApptStatus) svApptStatus.textContent = "";
    if (svWhoStatus) svWhoStatus.textContent = "";
    if (svTimeStatus) svTimeStatus.textContent = "";
    if (svAboutStatus) svAboutStatus.textContent = "";

    if (svNote) svNote.textContent = "Fill the 5W/H fields with what the visitor actually said, then send.";
    supervisorModal.hidden = false;
    supervisorModal.style.display = "";
  }

  function closeSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
    supervisorModal.style.display = "none";
    if (state && state._stageBeforeSupervisor) state.stage = state._stageBeforeSupervisor;
  }

  function checkSupervisorForm(){
    const v = state?.visitor || {};
    const mt = String(state?.facts?.meetingTime || "").trim();

    const nameExpected = normalize(v.name);
    const apptExpected = "yes";
    const whoExpected  = normalize("Sergeant de Vries");
    const aboutTokens = ["delivery","workshop","tools","spare","parts"];
    const timeExpected = normalize(mt);

    const nameGot = normalize(svWhy?.value);
    const apptGot = normalize(svAppt?.value);
    const whoGot  = normalize(svWho?.value);
    const aboutGot= normalize(svAbout?.value);
    const timeGot = normalize(svTime?.value);

    const okName = nameGot && (nameGot.includes(nameExpected) || nameExpected.includes(nameGot));
    const okAppt = apptGot === apptExpected || apptGot === "y";
    const okWho  = whoGot && (whoGot.includes(whoExpected) || whoExpected.includes(whoGot));
    const okTime = timeExpected ? timeGot.includes(timeExpected) : !!timeGot;
    const okAbout = aboutGot && aboutTokens.some(tok => aboutGot.includes(tok));

    const setStatus = (el, ok) => { if (el) el.textContent = ok ? "" : "Does not match visitor info."; };
    setStatus(svWhyStatus, okName);
    setStatus(svApptStatus, okAppt);
    setStatus(svWhoStatus, okWho);
    setStatus(svTimeStatus, okTime);
    setStatus(svAboutStatus, okAbout);

    const allOk = okName && okAppt && okWho && okTime && okAbout;
    if (svNote) svNote.textContent = allOk ? "Looks good. You can send this to your supervisor." : "Some fields do not match what the visitor said. Correct them, then send.";
    return allOk;
  }

  // -------- Contraband generation --------
  function pickContraband(){
    const weapons = Math.random() < 0.18;
    const drugs   = Math.random() < 0.10;
    const alcohol = Math.random() < 0.12;
    const count = [weapons,drugs,alcohol].filter(Boolean).length;
    if (count >= 3 && Math.random() < 0.65){
      const pickIdx = randInt(0,2);
      return { weapons: pickIdx !== 0, drugs: pickIdx !== 1, alcohol: pickIdx !== 2 };
    }
    return { weapons, drugs, alcohol };
  }

  function contrabandList(){
    const c = state?.contraband || {};
    const items = [];
    if (c.weapons) items.push("a pocket knife");
    if (c.drugs) items.push("some drugs");
    if (c.alcohol) items.push("alcohol");
    return items;
  }

  // -------- Scenario reset --------
  function resetScenario(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    syncMoodUI();

    ID_DATA = makeRandomId();
    syncVisitorAvatars();

    history.length = 0;
    _visitorQueue.length = 0;
    if (_visitorTimer){ clearTimeout(_visitorTimer); _visitorTimer = null; }
    if (_approachTimer){ clearTimeout(_approachTimer); _approachTimer = null; }


    state = {
      stage: "start",
      misses: 0,
      typing: { visitor:false, student:false },
      idVisible: false,
      idChecked: false,
      supervisorOk: false,
      visitor: { ...ID_DATA },
      facts: { name:"", purpose:"", appt:"", who:"", time:"", about:"", meetingTime:"" },
      contraband: pickContraband(),
      willLie: (Math.random() < currentMood.liarBias)
    };

    hideId();
    updateHintBand(true);
    syncTrainingIdCard();

    // Approach cue: give the student a moment to observe before the first "Hello".
    setInputEnabled(false);

    if (portraitMood){
      portraitMood.textContent = "A visitor is walking up to the checkpoint…";
      portraitMood.style.display = "";
    }

    state.stage = "approach";
    renderHistory(); // ensure no bubbles/avatars are visible yet

    _approachTimer = setTimeout(() => {
      _approachTimer = null;
      if (!state || state.stage !== "approach") return;

      // Restore the real mood line and start the dialogue.
      syncMoodUI();
      state.stage = "start";
      setInputEnabled(true);
      pushVisitor(visitorLine("greeting"));
      try { textInput?.focus(); } catch {}
    }, 5000);
  }

  // -------- Dialogue --------
  function handleStudent(raw){
    const clean = String(raw || "").trim();
    if (!clean || !state || state.stage === "ended") return;

    // During the "approach" cue (before the first hello), ignore input to keep the UI clean.
    if (state.stage === "approach") return;

    pushStudent(clean);

    const intent = detectIntent(clean);

    if (intent === "contact_supervisor"){
      openSupervisorModal();
      return;
    }

    // progress tracking (for hints)
    if (intent === "ask_name") state.facts.name = state.visitor.name;
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
          enqueueVisitor("I have an appointment on base.");
          return;
        }
        if (intent === "has_appointment"){
          enqueueVisitor(visitorLine("appointment_yes"));
          return;
        }
        if (intent === "who_meeting"){
          enqueueVisitor(visitorLine("who_meeting"));
          return;
        }
        if (intent === "time_meeting"){
          const t = getMeetingTimeHHMM();
          state.facts.meetingTime = t;
          syncTrainingIdCard();
          enqueueVisitor(`At ${t}.`);
          return;
        }
        if (intent === "about_meeting"){
          enqueueVisitor(visitorLine("about_meeting"));
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
          state.stage = "supervisor";
          return;
        }
        nudge("Try a control question, or return the ID.");
        return;

      case "supervisor":
        nudge('Say: “I’ll contact my supervisor.”');
        return;

      case "search_announce":
        if (intent === "we_search_you"){
          state.stage = "why_searched";
          enqueueVisitor(visitorLine("search_why"));
          return;
        }
        nudge('Try: “You will be searched.”');
        return;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat"){
          state.stage = "illegal_items";
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Explain: routine search / heightened security.");
        return;

      case "illegal_items":
        if (intent === "illegal_items"){
          state.stage = "clarify_illegal";
          enqueueVisitor(visitorLine("illegal_what"));
          return;
        }
        nudge("Ask: illegal items / contraband.");
        return;

      case "clarify_illegal":
        if (intent === "illegal_clarify"){
          const items = contrabandList();

          if (!items.length){
            state.stage = "direction";
            enqueueVisitor("No.");
            return;
          }

          if (state.willLie){
            state.stage = "direction";
            enqueueVisitor("No.");
            return;
          }

          state.stage = "handover_request";
          enqueueVisitor(`Yes. I have ${items.join(" and ")}.`);
          return;
        }
        enqueueVisitor("Clarify: drugs, weapons and alcohol.");
        return;

      case "handover_request":
        if (intent === "hand_in"){
          state.stage = "direction";
          enqueueVisitor(visitorLine("handover_ok"));
          return;
        }
        nudge("Tell him to hand it over and he will get it back at the end of the visit.");
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

  // After supervisor approves: continue
  function supervisorApproved(){
    if (!state) return;
    state.supervisorOk = true;
    state.stage = "search_announce";
    updateHintBand(true);
  }

  // -------- Sidebar buttons --------
  btnDeny?.addEventListener("click", () => enqueueVisitor(visitorLine("deny_why")));
  btnNewScenario?.addEventListener("click", () => resetScenario());
  btnReset?.addEventListener("click", () => {
    if (loginModal) loginModal.hidden = false;
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
    state.stage = "supervisor";
  });

  // -------- Input --------
  btnSend?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    const t = (textInput?.value || "").trim();
    if (textInput) textInput.value = "";
    handleStudent(t);
  });

  textInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSend?.click(); });

  textInput?.addEventListener("input", () => {
    if (!state?.typing) return;
    state.typing.student = !!(textInput.value || "").trim();
    renderHistory();
  });

  // -------- Voice (SpeechRecognition) --------
  let recognition = null;
  let isRecognizing = false;

  function setVoiceStatusSafe(text){ if (voiceStatus) voiceStatus.textContent = text; }

  async function ensureMicPermission(){
    try{
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    }catch{ return false; }
  }

  function voiceSupported(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setupSpeech(){
    if (!voiceSupported()){
      setVoiceStatusSafe("Voice: not supported");
      if (holdToTalk){ holdToTalk.disabled = true; holdToTalk.title = "SpeechRecognition not supported."; }
      return;
    }

    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;
    if (!okContext){
      setVoiceStatusSafe("Voice: use https/localhost");
      if (holdToTalk){ holdToTalk.disabled = true; holdToTalk.title = "Voice requires https:// or http://localhost."; }
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      if (state?.typing){ state.typing.student = true; state.typing.visitor = false; }
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
    if (!ok){ setVoiceStatusSafe("Voice: blocked"); return; }
    try{ recognition.start(); } catch {}
  }

  function stopListen(){
    if (!recognition || !isRecognizing) return;
    try{ recognition.stop(); } catch {}
  }

  holdToTalk?.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk?.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk?.addEventListener("pointercancel", stopListen);
  holdToTalk?.addEventListener("pointerleave", stopListen);

  // -------- Visitor TTS --------
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
    }catch{ return null; }
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

  // -------- Supervisor modal listeners --------
  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  btnReturnToVisitor?.addEventListener("click", closeSupervisorModal);

  btnSupervisorCheck?.addEventListener("click", () => {
    const ok = checkSupervisorForm();
    if (!ok) return;
    closeSupervisorModal();
    supervisorApproved();
    enqueueVisitor("Okay.");
  });

  [svWhy, svAppt, svWho, svTime, svAbout].forEach(el => el?.addEventListener("input", () => { checkSupervisorForm(); }));

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
    primeTTS(); // unlock after gesture
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

  history.length = 0;
  state = {
    stage: "idle",
    typing: { visitor:false, student:false },
    visitor: { ...ID_DATA },
    facts: {},
    misses: 0,
    contraband: { weapons:false, drugs:false, alcohol:false }
  };
  renderHistory();
})();
