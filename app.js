(() => {
  "use strict";

  const APP_VERSION = "veva-whatsapp-clean-2026-02-09";
  console.log("[VEVA]", APP_VERSION, "loaded");

  const CONFIG = window.APP_CONFIG || {};
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true;
  const VOICE_LANG = CONFIG.voiceLang || "en-US";

  const $id = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function safeLower(s){ return (s||"").toString().trim().toLowerCase(); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function chance(p){ return Math.random() < clamp(p,0,1); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function parseYear(text){
    const m = (text||"").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  function calcAgeFromDob(dob){
    const today = new Date();
    let age = today.getFullYear() - dob.yyyy;
    const m = today.getMonth()+1;
    const d = today.getDate();
    if (m < dob.mm || (m===dob.mm && d < dob.dd)) age -= 1;
    return age;
  }

  function monthAbbr(mm){
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][clamp(mm,1,12)-1];
  }

  // DMY like: 07 Feb 1993
  function formatDobDMY({yyyy,mm,dd}){
    const z2 = (n)=> (n<10?("0"+n):(""+n));
    return `${z2(dd)} ${monthAbbr(mm)} ${yyyy}`;
  }

  async function logEvent(type, payload={}){
    if (!LOG_ENDPOINT) return;
    const body = JSON.stringify({ ts: nowIso(), type, ...payload });
    try{ await fetch(LOG_ENDPOINT, { method:"POST", mode:"no-cors", body }); } catch {}
  }

  // -----------------------
  // Visitor generation
  // -----------------------
  const MOODS = [
    { key:"relaxed",   line:"The visitor looks relaxed.",           adj:"relaxed",   lieBoost:0.02, inconsBoost:0.02 },
    { key:"confident", line:"The visitor looks confident.",         adj:"confident", lieBoost:0.03, inconsBoost:0.03 },
    { key:"tired",     line:"The visitor looks tired but polite.",  adj:"tired",     lieBoost:0.06, inconsBoost:0.05 },
    { key:"uneasy",    line:"The visitor looks uneasy.",            adj:"uneasy",    lieBoost:0.12, inconsBoost:0.12 },
    { key:"nervous",   line:"The visitor looks nervous.",           adj:"nervous",   lieBoost:0.18, inconsBoost:0.20 },
    { key:"irritated", line:"The visitor looks irritated.",         adj:"irritated", lieBoost:0.12, inconsBoost:0.10 }
  ];

  const NATIONALITIES = ["Dutch","German","Belgian","French","Spanish","Italian","Polish","Romanian","Turkish","British","American","Canadian"];
  const FIRST = ["David","Michael","James","Robert","Daniel","Thomas","Mark","Lucas","Noah","Adam","Omar","Yusuf","Mateusz","Julien","Marco"];
  const LAST  = ["Johnson","Miller","Brown","Davis","Martinez","Kowalski","Nowak","Schmidt","Dubois","Rossi","Yilmaz","Peters"];

  function randomDob(){
    const today = new Date();
    const year = today.getFullYear() - (18 + Math.floor(Math.random()*38)); // 18..55
    return { yyyy: year, mm: 1+Math.floor(Math.random()*12), dd: 1+Math.floor(Math.random()*28) };
  }

  function randomExpiry(){
    const today = new Date();
    const y = today.getFullYear() + (1 + Math.floor(Math.random()*8));
    return { yyyy: y, mm: 1+Math.floor(Math.random()*12), dd: 1+Math.floor(Math.random()*28) };
  }

  function randomIdNumber(){
    const a = Math.floor(100000 + Math.random()*900000);
    const b = Math.floor(1000 + Math.random()*9000);
    return `ID-${a}-${b}`;
  }

  function buildMeetingStory(purpose, meetingWith){
    // richer “what is it about / what are you delivering / why” answers
    const base = [
      `It was arranged last week. ${meetingWith} asked me to bring documents and equipment for a quick check.`,
      `We scheduled it earlier because they reported a shortage. I’m delivering supplies and need it signed off.`,
      `They requested an inspection. I’m here to drop off parts and confirm the handover.`,
      `I’m delivering a package that must be received by the host personally. It needs a signature.`,
      `It’s a pre-arranged visit. I have to deliver items and verify the serial numbers with the host.`
    ];
    if (purpose === "maintenance") return pick([
      `They called us because something needs maintenance. I’m here to check the issue and bring replacement parts.`,
      `It was planned a few days ago. I’m doing a maintenance check and reporting back to ${meetingWith}.`,
      ...base
    ]);
    if (purpose === "inspection") return pick([
      `I’m here for an inspection that was scheduled earlier. ${meetingWith} requested a short briefing and paperwork.`,
      ...base
    ]);
    if (purpose === "delivery") return pick([
      `I’m here to deliver equipment. ${meetingWith} requested it because they were running low.`,
      ...base
    ]);
    return pick(base);
  }

  function buildVisitor(){
    const mood = pick(MOODS);

    const dob = randomDob();
    const nat = pick(NATIONALITIES);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const age = calcAgeFromDob(dob);

    // You have 10 headshots: headshot_01..headshot_10
    const idx = 1 + Math.floor(Math.random()*10);
    const headshot = `assets/photos/headshot_${String(idx).padStart(2,"0")}.png`;

    // appointment probability
    const appointment = chance(0.70);
    const apptTime = appointment ? pick(["09:30","10:00","11:15","13:15","14:00","15:45"]) : null;
    const meetingWith = appointment ? pick(["Captain Lewis","Sgt. van Dijk","Mr. Peters","Lt. Schmidt"]) : null;

    const purpose = pick(["delivery","maintenance","inspection","meeting","visit"]);
    const goingWhere = pick(["HQ building","Logistics office","Barracks admin","Workshop","Gate office"]);
    const subject = appointment && meetingWith ? buildMeetingStory(purpose, meetingWith) : pick([
      "I need to check in and get permission first.",
      "I’m not fully sure who handles it, I was told to report at the gate."
    ]);

    return {
      mood,
      headshot,
      id: { name, nationality: nat, dob, age, idNumber: randomIdNumber(), expiry: randomExpiry() },
      intake: { purpose, appointment, apptTime, meetingWith, goingWhere, subject },
      claims: { age:null, dob:null, nationality:null, name:null },
      inconsistencies: [],
      idShown: false
    };
  }

  // -----------------------
  // Intents (RUIMER)
  // -----------------------
  function compilePatterns(extra){
    const base = {
      // greeting
      greet: [
        /\bhello\b/i, /\bhi\b/i, /\bhey\b/i,
        /\bgood\s+(morning|afternoon|evening)\b/i
      ],

      // “how can I help?”
      ask_help: [
        /\bhow\s+can\s+i\s+help\b/i,
        /\bhow\s+can\s+i\s+help\s+you\b/i,
        /\bhow\s+may\s+i\s+help\b/i,
        /\bwhat\s+can\s+i\s+do\s+for\s+you\b/i,
        /\bwhat\s+can\s+i\s+help\s+you\s+with\b/i,
        /\bhow\s+can\s+i\s+help\s+you\s+today\b/i,
        /\bwhat\s+do\s+you\s+need\b/i,
        /\bwhat\s+do\s+you\s+want\b/i,
        /\bwhat\s+can\s+i\s+do\b/i
      ],

      // mood / feeling
      ask_feeling: [
        /\bhow\s+are\s+you\s+feeling\b/i,
        /\bhow\s+do\s+you\s+feel\b/i,
        /\bare\s+you\s+ok\b/i,
        /\bare\s+you\s+okay\b/i
      ],

      // 5W / intake
      ask_name: [
        /\bwhat\s*(is|'s)\s+your\s+name\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i,
        /\bmay\s+i\s+have\s+your\s+name\b/i,
        /\bstate\s+your\s+name\b/i,
        /\bwho\s+are\s+you\b/i
      ],

      ask_purpose: [
        /\bwhat\s+are\s+you\s+here\s+for\b/i,
        /\bwhy\s+are\s+you\s+here\b/i,
        /\bwhat\s*(is|'s)\s+the\s+purpose\s+of\s+(your\s+)?visit\b/i,
        /\bwhat\s+brings\s+you\s+here\b/i,
        /\bwhat\s+are\s+you\s+doing\s+here\b/i,
        /\bwhat\s+do\s+you\s+need\b/i
      ],

      ask_appointment: [
        /\bdo\s+you\s+have\s+(an?\s+)?appointment\b/i,
        /\bare\s+you\s+expected\b/i,
        /\bis\s+this\s+pre[-\s]?arranged\b/i,
        /\bdid\s+you\s+schedule\s+(a\s+)?(meeting|appointment)\b/i
      ],

      ask_who: [
        /\bwho\s+are\s+you\s+(here\s+to\s+see|meeting|visiting)\b/i,
        /\bwho\s+is\s+(your\s+)?(appointment|meeting)\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\b/i,
        /\bwho\s+is\s+your\s+contact\b/i,
        /\bwho\s+is\s+the\s+host\b/i,
        /\bwhat\s+is\s+the\s+name\s+of\s+the\s+person\s+you('?re)?\s+seeing\b/i,
        /\bwho\s+gave\s+you\s+the\s+order\b/i
      ],

      ask_time: [
        /\bwhat\s+time\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhat\s+time\s+is\s+the\s+meeting\b/i,
        /\bwhat\s+time\s+is\s+the\s+appointment\b/i,
        /\bwhen\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhen\s+are\s+you\s+expected\b/i,
        /\bwhat\s+time\s+were\s+you\s+meeting\b/i,
        /\bwhat\s+time\s+did\s+they\s+tell\s+you\b/i
      ],

      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhat\s+is\s+your\s+destination\b/i,
        /\bwhere\s+is\s+the\s+(meeting|appointment)\b/i,
        /\bwhere\s+are\s+you\s+meeting\s+(him|her|them)\b/i,
        /\bwhere\s+will\s+you\s+deliver\b/i,
        /\bwhich\s+(building|unit|office|department|area)\b/i
      ],

      ask_subject: [
        /\bwhat\s+is\s+(the\s+)?(meeting|appointment|visit)\s+about\b/i,
        /\bwhat\s+are\s+you\s+delivering\b/i,
        /\bwhat\s+is\s+the\s+delivery\b/i,
        /\bwhy\s+do\s+you\s+need\s+(to\s+)?(enter|access|get\s+onto)\s+the\s+base\b/i,
        /\bcan\s+you\s+tell\s+me\s+more\s+about\s+(the\s+)?(meeting|visit|delivery)\b/i,
        /\bwhat\s+will\s+you\s+discuss\b/i
      ],

      // ID
      ask_id: [
        /\b(can|could|may)\s+i\s+(see|check|verify|inspect|look\s+at)\s+(your|ur)\s+(id|identification|passport|card)\b/i,
        /\bshow\s+(me\s+)?(your|ur)\s+(id|identification|passport|card)\b/i,
        /\bdo\s+you\s+(have|carry)\s+(an?\s+)?(id|identification|passport)\b/i
      ],

      return_id: [
        /\bhere\s+(is|are)\s+(your|ur)\s+(id|card|identification)\s+back\b/i,
        /\byou\s+can\s+have\s+(your|ur)\s+(id|card)\s+back\b/i,
        /\b(return|give)\s+(it|the\s+(id|card))\s+back\b/i
      ],

      // control
      ask_age: [/\bhow\s+old\s+are\s+you\b/i, /\bwhat\s+is\s+your\s+age\b/i],
      ask_dob: [/\b(date\s+of\s+birth|dob)\b/i, /\bwhen\s+were\s+you\s+born\b/i],
      confirm_born_year: [
        /\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i,
        /\bis\s+your\s+birth\s+year\s+(19\d{2}|20\d{2})\b/i
      ],
      ask_nationality: [
        /\bwhat\s+is\s+your\s+nationality\b/i,
        /\bwhat\s+country\s+are\s+you\s+from\b/i,
        /\bwhat\s+nationality\s+are\s+you\b/i
      ],

      // supervisor (TEXT ONLY)
      contact_supervisor: [
        /\b(i\s*(will|’ll|'ll|need\s+to|have\s+to|must)\s+)?(contact|call|ring|phone|ask)\s+(my\s+)?(supervisor|boss|manager|team\s*leader|officer)\b/i,
        /\bfor\s+(approval|authori[sz]ation|permission)\b/i
      ],

      // person search
      go_person_search: [
        /\b(go\s+to|start|begin|proceed\s+to)\s+(the\s+)?(person\s+search|pat[-\s]?down|frisk|search)\b/i,
        /\bfollow\s+me\s+to\s+(the\s+)?(search|person\s+search)\b/i
      ],

      // deny
      deny: [
        /\bdeny\s+(entrance|entry|access)\b/i,
        /\byou\s+cannot\s+enter\b/i,
        /\byou\s+may\s+not\s+enter\b/i,
        /\bnot\s+allowed\s+to\s+enter\b/i
      ]
    };

    const merged = { ...base };

    // optional phrasebank merge
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

  async function loadPhrasebank(){
    try{
      const res = await fetch("phrasebank.json", { cache:"no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function matchIntent(intents, text){
    for (const k of Object.keys(intents)) {
      if (k === "_raw") continue;
      if (intents[k](text)) return k;
    }
    return "unknown";
  }

  // -----------------------
  // UI helpers (only last bubbles)
  // -----------------------
  function setVisitorBubble(text){ const el=$id("visitorBubble"); if(el) el.textContent = text||""; }
  function setVisitorMood(text){ const el=$id("visitorMood"); if(el) el.textContent = text||""; }
  function setStudentBubble(text){
    const el=$id("studentBubble");
    if(!el) return;
    el.textContent = text||"";
    el.style.display = text ? "" : "none";
  }

  function showIdCard(){ document.body.classList.add("show-id"); }
  function hideIdCard(){
    document.body.classList.remove("show-id");
    const panel = $id("idPanel");
    if(panel) panel.style.display = "none";
  }

  // -----------------------
  // ID Canvas
  // -----------------------
  function drawIdCard(visitor){
    const canvas = $id("idCanvas");
    const panel  = $id("idPanel");
    if(!canvas || !panel){
      console.warn("[VEVA] Missing #idPanel or #idCanvas in HTML");
      return;
    }

    showIdCard();
    panel.style.display = "block";

    // ensure usable canvas size
    if (!canvas.width || canvas.width < 600) canvas.width = 980;
    if (!canvas.height || canvas.height < 300) canvas.height = 560;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = "#163a66";
    ctx.fillRect(0,0,W,110);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("VISITOR ID", 36, 70);

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Checkpoint Access Card", 38, 98);

    // photo box
    ctx.fillStyle = "#e8ecf5";
    ctx.fillRect(40,150,230,290);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(40,150,230,290);

    const v = visitor.id;
    const rows = [
      ["Name", v.name],
      ["Nationality", v.nationality],
      ["DOB", formatDobDMY(v.dob)],
      ["Age", String(v.age)],
      ["ID nr", v.idNumber],
      ["Expiry", formatDobDMY(v.expiry)]
    ];

    let y = 180;
    ctx.fillStyle = "#111827";
    for (const [label, value] of rows) {
      ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(label + ":", 310, y);
      ctx.font = "22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(String(value), 460, y);
      y += 58;
    }

    ctx.fillStyle = "rgba(17,24,39,0.75)";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Valid only for stated purpose. Subject to search and denial.", 40, H - 28);

    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(40,150,230,290);
      ctx.clip();
      ctx.drawImage(img, 40,150,230,290);
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(40,150,230,290);
    };
    img.onerror = () => {};
    img.src = visitor.headshot;
  }

  // -----------------------
  // Control answers (lie/inconsistency)
  // -----------------------
  function makeFakeControl(visitor, kind){
    if(kind==="age"){
      const delta = pick([-2,-1,1,2,3]);
      return String(clamp(visitor.id.age + delta, 18, 70));
    }
    if(kind==="dob"){
      const dob = { ...visitor.id.dob };
      if(chance(0.5)) dob.dd = clamp(dob.dd + pick([-2,-1,1,2]), 1, 28);
      else dob.mm = clamp(dob.mm + pick([-1,1]), 1, 12);
      return formatDobDMY(dob);
    }
    if(kind==="nationality") return pick(NATIONALITIES.filter(n => n !== visitor.id.nationality));
    if(kind==="name") return `${pick(FIRST)} ${pick(LAST)}`;
    return "";
  }

  function visitorControlAnswer(visitor, kind){
    const lieP = 0.04 + visitor.mood.lieBoost;
    const inconsP = 0.05 + visitor.mood.inconsBoost;

    const truth = (() => {
      if(kind==="age") return String(visitor.id.age);
      if(kind==="dob") return formatDobDMY(visitor.id.dob);
      if(kind==="nationality") return visitor.id.nationality;
      if(kind==="name") return visitor.id.name;
      return "";
    })();

    const prev = visitor.claims[kind];
    if(prev){
      if(chance(inconsP)){
        const fake = makeFakeControl(visitor, kind);
        if(fake !== prev){
          visitor.inconsistencies.push({ kind, prev, next: fake, ts: nowIso() });
          visitor.claims[kind] = fake;
          return { value: fake, lied: true, inconsistent: true };
        }
      }
      return { value: prev, lied: prev !== truth, inconsistent: false };
    }

    if(chance(lieP)){
      const fake = makeFakeControl(visitor, kind);
      visitor.claims[kind] = fake;
      return { value: fake, lied: fake !== truth, inconsistent: false };
    }

    visitor.claims[kind] = truth;
    return { value: truth, lied: false, inconsistent: false };
  }

  // -----------------------
  // Required checkpoints (feedback)
  // -----------------------
  const REQUIRED = [
    { key:"asked_name", label:"You didn’t ask the visitor’s name.", example:"What is your name, please?" },
    { key:"asked_purpose", label:"You didn’t ask the purpose of the visit.", example:"What is the purpose of your visit?" },
    { key:"asked_appointment", label:"You didn’t confirm the appointment.", example:"Do you have an appointment?" },
    { key:"asked_who", label:"You didn’t ask who they are meeting.", example:"Who is your appointment with?" },
    { key:"asked_time", label:"You didn’t confirm the time.", example:"What time is your appointment?" },
    { key:"asked_where", label:"You didn’t confirm where they are going / meeting place.", example:"Where are you going / where is the meeting?" },
    { key:"asked_subject", label:"You didn’t ask what it is about / what they are delivering.", example:"What is the meeting about? What are you delivering?" },
    { key:"asked_id", label:"You didn’t ask to see an ID.", example:"Can I see your ID, please?" },
    { key:"asked_dob", label:"You didn’t verify date of birth (DOB).", example:"What is your date of birth?" },
    { key:"asked_age", label:"You didn’t verify age.", example:"How old are you?" },
    { key:"asked_nationality", label:"You didn’t verify nationality.", example:"What is your nationality?" },
    { key:"supervisor_contacted", label:"You didn’t contact a supervisor when needed.", example:"I will contact my supervisor for approval." },
    { key:"did_person_search", label:"You didn’t proceed to person search step.", example:"Follow me to the person search." }
  ];

  // -----------------------
  // App state
  // -----------------------
  const state = {
    runId: uid(),
    student: { name:"", className:"", difficulty:"Standard" },
    visitor: null,
    intents: null,
    finished: false,
    unknowns: 0,
    badCount: 0, // for hint policy
    flags: {
      asked_name:false,
      asked_purpose:false,
      asked_appointment:false,
      asked_who:false,
      asked_time:false,
      asked_where:false,
      asked_subject:false,
      asked_id:false,
      asked_age:false,
      asked_dob:false,
      asked_nationality:false,
      supervisor_contacted:false,
      did_person_search:false
    }
  };

  function showScreen(which){
    $id("screen-login")?.classList.toggle("hidden", which!=="login");
    $id("screen-train")?.classList.toggle("hidden", which!=="train");
    $id("screen-feedback")?.classList.toggle("hidden", which!=="feedback");
  }

  function setStep(title, help){
    const t=$id("stepTitle"), h=$id("stepHelp");
    if(t) t.textContent = title||"";
    if(h) h.textContent = help||"";
  }

  function resetBubbles(){
    setVisitorBubble("Ask your first question…");
    setStudentBubble("");
    setVisitorMood(state.visitor?.mood?.line || "");
    hideIdCard();
  }

  function visitorSays(text, moodLine=null){
    setVisitorBubble(text);
    if(moodLine !== null) setVisitorMood(moodLine);
  }

  function studentSays(text){
    setStudentBubble(text);
  }

  function hintText(){
    return "Try: What is your name? / What is the purpose of your visit? / Do you have an appointment? / Who is your appointment with? / What time is it? / Can I see your ID?";
  }

  function maybeHintAfterBad(){
    const diff = (state.student.difficulty || "Standard");
    const threshold = diff === "Basic" ? 1 : (diff === "Standard" ? 2 : 999);
    if (state.badCount >= threshold && diff !== "Advanced"){
      visitorSays("Hint: " + hintText(), state.visitor.mood.line);
      state.badCount = 0; // reset after showing hint
    }
  }

  function intakeAnswer(kind){
    const v = state.visitor;
    const a = v.intake;
    if (kind==="name") return `My name is ${v.id.name}.`;
    if (kind==="purpose") return `I’m here for ${a.purpose}.`;
    if (kind==="appointment") return a.appointment ? "Yes, I have an appointment." : "No, I don’t have an appointment.";
    if (kind==="who") return a.meetingWith ? `I’m meeting ${a.meetingWith}.` : "I’m not meeting anyone specific.";
    if (kind==="time") return a.apptTime ? `It’s at ${a.apptTime}.` : "I don’t have a specific time.";
    if (kind==="where") return `I’m going to the ${a.goingWhere}.`;
    if (kind==="subject") return a.subject;
    return "Okay.";
  }

  function feelingAnswer(){
    const adj = state.visitor.mood.adj;
    // small natural variants
    return pick([
      `I feel ${adj} today.`,
      `I’m feeling ${adj}.`,
      `Pretty ${adj}, thanks.`,
    ]);
  }

  function handleBornYearConfirm(userText){
    const yearAsked = parseYear(userText);
    if(!yearAsked){ visitorSays("Sorry, could you repeat the year?", state.visitor.mood.line); return; }

    const v = state.visitor;
    const claim = visitorControlAnswer(v, "dob"); // value is DMY; parse year from it
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if(yearAsked === claimYear){
      visitorSays("Yes, that’s correct.", v.mood.line);
      return;
    }

    visitorSays("No, that’s not correct.", v.mood.line);

    if(yearAsked === trueYear && claim.lied){
      visitorSays(`Actually… you’re right. I was born in ${trueYear}. Sorry.`, v.mood.line);
      v.claims.dob = formatDobDMY(v.id.dob);
      return;
    }

    visitorSays(`I was born in ${claimYear}.`, v.mood.line);
  }

  function openSupervisorModal(){
    const modal = $id("supervisorModal");
    if(!modal) return;
    modal.classList.remove("hidden");

    const v = state.visitor;
    $id("wWho").value = v?.id?.name || "";
    $id("wWhat").value = v?.intake?.purpose || "";
    $id("wWithWhom").value = v?.intake?.meetingWith || "";
    $id("wTime").value = v?.intake?.apptTime || "";
    $id("wWhy").value = (v?.intake?.subject || "").slice(0, 80);

    const resp = $id("supervisorResponse");
    if(resp) resp.textContent = "";
  }

  function closeSupervisorModal(){
    $id("supervisorModal")?.classList.add("hidden");
  }

  function finishRun(reason){
    if(state.finished) return;
    state.finished = true;

    logEvent("finish", {
      runId: state.runId,
      reason,
      student: state.student,
      flags: state.flags,
      unknowns: state.unknowns,
      inconsistencies: state.visitor?.inconsistencies || []
    });

    const misses = REQUIRED.filter(r => !state.flags[r.key]);
    const top3 = misses.slice(0,3);

    const ulTop = $id("top3");
    const all = $id("allMisses");
    if(ulTop) ulTop.innerHTML = top3.map(m => `<li><b>${m.label}</b><br><span class="muted small">Example: ${m.example}</span></li>`).join("");
    if(all) all.innerHTML = misses.map(m => `<div style="margin:10px 0;"><b>${m.label}</b><div class="muted small">Example: ${m.example}</div></div>`).join("");

    showScreen("feedback");
  }

  function denyEntrance(){
    studentSays("I’m denying entry. You cannot enter the site.");
    visitorSays("Okay.", state.visitor.mood.line);
    finishRun("denied");
  }

  // -----------------------
  // Conversation core
  // -----------------------
  function handleMessage(text){
    if(state.finished) return;
    const t = (text||"").trim();
    if(!t) return;

    studentSays(t);
    logEvent("message", { runId: state.runId, from:"student", text:t });

    const intent = matchIntent(state.intents, t);

    // deny
    if(intent==="deny"){ denyEntrance(); return; }

    // greetings: visitor asks for help (but student must continue)
    if(intent==="greet"){
      visitorSays("Can you help me?", state.visitor.mood.line);
      setStep("Start", "Ask how you can help. Then continue with 5W/5WH questions.");
      return;
    }

    // how can I help => visitor explains need
    if(intent==="ask_help"){
      visitorSays("I need to get onto the base.", state.visitor.mood.line);
      setStep("Intake", "Continue with 5W/5WH: name, purpose, appointment, who, time, where, subject.");
      return;
    }

    // mood / feeling
    if(intent==="ask_feeling"){
      visitorSays(feelingAnswer(), state.visitor.mood.line);
      return;
    }

    // supervisor via TEXT only
    if(intent==="contact_supervisor"){
      state.flags.supervisor_contacted = true;
      visitorSays("Okay. Please contact your supervisor.", state.visitor.mood.line);
      openSupervisorModal();
      setStep("Supervisor", "Fill the 5W briefing. Then continue.");
      logEvent("supervisor_trigger", { runId: state.runId, source:"text" });
      return;
    }

    // ID request
    if(intent==="ask_id"){
      state.flags.asked_id = true;
      state.visitor.idShown = true;
      visitorSays("Yes. Here you go.", state.visitor.mood.line);
      drawIdCard(state.visitor);
      setStep("ID check", "Check the ID and ask control questions (DOB, age, nationality).");
      logEvent("show_id", { runId: state.runId });
      return;
    }

    // return ID => hide it
    if(intent==="return_id"){
      visitorSays("Thank you.", state.visitor.mood.line);
      hideIdCard();
      return;
    }

    // control questions
    if(intent==="ask_age"){
      state.flags.asked_age = true;
      const a = visitorControlAnswer(state.visitor, "age");
      visitorSays(`I’m ${a.value} years old.`, state.visitor.mood.line);
      return;
    }
    if(intent==="ask_dob"){
      state.flags.asked_dob = true;
      const a = visitorControlAnswer(state.visitor, "dob");
      visitorSays(`My date of birth is ${a.value}.`, state.visitor.mood.line);
      return;
    }
    if(intent==="confirm_born_year"){
      state.flags.asked_dob = true;
      handleBornYearConfirm(t);
      return;
    }
    if(intent==="ask_nationality"){
      state.flags.asked_nationality = true;
      const a = visitorControlAnswer(state.visitor, "nationality");
      visitorSays(`I’m ${a.value}.`, state.visitor.mood.line);
      return;
    }

    // intake 5W
    if(intent==="ask_name"){ state.flags.asked_name = true; visitorSays(intakeAnswer("name"), state.visitor.mood.line); return; }
    if(intent==="ask_purpose"){ state.flags.asked_purpose = true; visitorSays(intakeAnswer("purpose"), state.visitor.mood.line); return; }
    if(intent==="ask_appointment"){
      state.flags.asked_appointment = true;
      visitorSays(intakeAnswer("appointment"), state.visitor.mood.line);
      return;
    }
    if(intent==="ask_who"){ state.flags.asked_who = true; visitorSays(intakeAnswer("who"), state.visitor.mood.line); return; }
    if(intent==="ask_time"){ state.flags.asked_time = true; visitorSays(intakeAnswer("time"), state.visitor.mood.line); return; }
    if(intent==="ask_where"){ state.flags.asked_where = true; visitorSays(intakeAnswer("where"), state.visitor.mood.line); return; }
    if(intent==="ask_subject"){ state.flags.asked_subject = true; visitorSays(intakeAnswer("subject"), state.visitor.mood.line); return; }

    // person search
    if(intent==="go_person_search"){
      state.flags.did_person_search = true;
      visitorSays("Okay.", state.visitor.mood.line);
      finishRun("completed");
      return;
    }

    // unknown
    state.unknowns += 1;
    state.badCount += 1;
    visitorSays("Sorry, I don’t understand. Can you ask it another way?", state.visitor.mood.line);
    if(LOG_UNKNOWN) logEvent("unknown_question", { runId: state.runId, text:t });
    maybeHintAfterBad();
  }

  // -----------------------
  // Voice: hold-to-talk, autosend on release if enabled
  // -----------------------
  function setupVoice(){
    const btn = $id("btnMicHold");
    const status = $id("micStatus");
    const input = $id("studentInput");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if(!btn || !status || !input) return;

    if(!SpeechRecognition){
      status.textContent = "Voice not supported in this browser.";
      btn.disabled = true;
      return;
    }

    let rec = null;
    let finalText = "";
    let listening = false;

    const setStatus = (s)=> status.textContent = s || "";

    function startRec(){
      if(listening) return;
      finalText = "";
      rec = new SpeechRecognition();
      rec.lang = VOICE_LANG;
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (e)=>{
        let interim = "";
        for(let i=e.resultIndex; i<e.results.length; i++){
          const txt = e.results[i][0]?.transcript || "";
          if(e.results[i].isFinal) finalText += txt;
          else interim += txt;
        }
        input.value = (finalText + " " + interim).trim();
      };

      rec.onerror = ()=> setStatus("Mic error.");
      rec.onend = ()=>{
        listening = false;
        btn.classList.remove("listening");
        setStatus("");

        if(VOICE_AUTO_SEND){
          const val = (input.value||"").trim();
          if(val){
            input.value = "";
            handleMessage(val);
          }
        }
      };

      listening = true;
      btn.classList.add("listening");
      setStatus("Listening…");
      try{ rec.start(); } catch {}
    }

    function stopRec(){
      if(!rec) return;
      try{ rec.stop(); } catch {}
    }

    btn.addEventListener("mousedown", (e)=>{ e.preventDefault(); startRec(); });
    document.addEventListener("mouseup", ()=>{ if(listening) stopRec(); });

    btn.addEventListener("touchstart", (e)=>{ e.preventDefault(); startRec(); }, { passive:false });
    btn.addEventListener("touchend", (e)=>{ e.preventDefault(); stopRec(); }, { passive:false });
  }

  // -----------------------
  // Init / wiring
  // -----------------------
  async function init(){
    // teacher button optional
    const teacherBtn = $id("btnTeacher");
    if(teacherBtn) teacherBtn.style.display = (CONFIG.showTeacherButton === false) ? "none" : "";

    // Load phrasebank (optional merge)
    const pb = await loadPhrasebank();
    state.intents = compilePatterns(pb);

    showScreen("login");

    $id("btnResetLocal")?.addEventListener("click", ()=>{
      localStorage.removeItem("veva_runs");
      alert("Lokaal gereset.");
    });

    $id("btnStart")?.addEventListener("click", async ()=>{
      const name = ($id("studentName")?.value || "").trim();
      const cls  = ($id("className")?.value || "").trim();
      const diff = ($id("difficulty")?.value || "Standard").trim();

      if(!name){ alert("Vul je naam in."); return; }
      if(!cls){ alert("Kies je groep."); return; }

      state.student = { name, className: cls, difficulty: diff };
      state.runId = uid();
      state.finished = false;
      state.unknowns = 0;
      state.badCount = 0;
      state.flags = Object.fromEntries(Object.keys(state.flags).map(k => [k,false]));

      state.visitor = buildVisitor();

      // avatars
      const vA = $id("visitorAvatar");
      if(vA){
        vA.src = state.visitor.headshot;
        vA.onerror = ()=> { vA.src = "assets/photos/headshot_01.png"; };
      }
      const sA = $id("studentAvatar");
      if(sA) sA.src = "assets/photos/soldier.png";

      // header meta
      const meta = $id("meta");
      if(meta) meta.textContent = `${name} · ${cls} · ${diff} · Run ${state.runId.slice(0,6)}`;

      showScreen("train");
      resetBubbles();

      setStep("Start", "Say hello to the visitor. Then ask: How can I help you?");
      setVisitorMood(state.visitor.mood.line);

      await logEvent("start", { runId: state.runId, student: state.student, mood: state.visitor.mood.key });

      // Opening line: visitor only says Hello
      visitorSays("Hello.", state.visitor.mood.line);
    });

    // send typed
    $id("btnSend")?.addEventListener("click", ()=>{
      const input = $id("studentInput");
      if(!input) return;
      const val = input.value;
      input.value = "";
      handleMessage(val);
    });

    $id("studentInput")?.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        const input = $id("studentInput");
        const val = input.value;
        input.value = "";
        handleMessage(val);
      }
    });

    // close ID
    $id("btnCloseId")?.addEventListener("click", ()=>{
      hideIdCard();
      visitorSays("Okay.", state.visitor?.mood?.line || "");
    });

    // deny
    $id("btnDenyEntrance")?.addEventListener("click", ()=> denyEntrance());

    // simple buttons
    $id("btnNewScenario")?.addEventListener("click", ()=>{ showScreen("login"); state.finished=false; hideIdCard(); });
    $id("btnFinishRun")?.addEventListener("click", ()=> finishRun("manual_finish"));

    $id("btnHint")?.addEventListener("click", ()=>{
      visitorSays("Hint: " + hintText(), state.visitor?.mood?.line || "");
    });

    $id("btnDoneStep")?.addEventListener("click", ()=>{
      if(!state.flags.asked_id){
        visitorSays("Next step: ask for an ID.", state.visitor.mood.line);
        setStep("ID check", "Ask for ID. Then verify DOB / age / nationality.");
        return;
      }
      if(!state.flags.did_person_search){
        visitorSays("Next step: person search.", state.visitor.mood.line);
        setStep("Person search", "Say: Follow me to the person search.");
      }
    });

    $id("btnGoPersonSearch")?.addEventListener("click", ()=>{
      state.flags.did_person_search = true;
      visitorSays("Okay.", state.visitor.mood.line);
      finishRun("completed");
    });

    $id("btnReturnVisitor")?.addEventListener("click", ()=>{
      visitorSays("Okay.", state.visitor?.mood?.line || "");
    });

    // supervisor modal
    $id("btnCloseModal")?.addEventListener("click", closeSupervisorModal);
    $id("btnBackToVisitor")?.addEventListener("click", ()=>{
      closeSupervisorModal();
      visitorSays("Okay.", state.visitor?.mood?.line || "");
    });

    $id("btnSendSupervisor")?.addEventListener("click", ()=>{
      const diff = state.student.difficulty || "Standard";
      const resp = $id("supervisorResponse");

      // In Basic/Standard: supervisor checks if key intake bits are missing
      if(diff !== "Advanced"){
        const missing = [];
        if(!state.flags.asked_name) missing.push("name");
        if(!state.flags.asked_purpose) missing.push("purpose");
        if(!state.flags.asked_appointment) missing.push("appointment");
        if(!state.flags.asked_who) missing.push("who");
        if(!state.flags.asked_time) missing.push("time");
        if(!state.flags.asked_where) missing.push("where");
        if(!state.flags.asked_subject) missing.push("what/why (details)");
        if(!state.flags.asked_id) missing.push("ID");

        if(missing.length){
          if(resp) resp.textContent = `Supervisor: Are you sure? You are missing: ${missing.join(", ")}. Go back and ask again.`;
          // close modal and push student back
          closeSupervisorModal();
          visitorSays("Go back and ask the missing questions, please.", state.visitor.mood.line);
          setStep("Back to intake", "Ask the missing questions, then contact supervisor again if needed.");
          return;
        }
      }

      if(resp) resp.textContent = "Supervisor: Approved. Proceed with additional checks.";
      closeSupervisorModal();
      visitorSays("Understood.", state.visitor?.mood?.line || "");
    });

    // feedback buttons
    $id("btnBackToStart")?.addEventListener("click", ()=> showScreen("login"));
    $id("btnDownloadCsv")?.addEventListener("click", ()=>{
      const rows = [
        ["ts", nowIso()],
        ["runId", state.runId],
        ["studentName", state.student.name],
        ["className", state.student.className],
        ["difficulty", state.student.difficulty],
        ["unknowns", String(state.unknowns)]
      ];
      const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
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
