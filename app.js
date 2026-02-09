
function renderMood(state){
  const el = $("#visitorMood");
  if(!el) return;
  el.textContent = (state && state.card && state.card.moodLine) ? state.card.moodLine : "";
}

// VEVA Entry Control Trainer — GitHub Pages (static)
//
// Notes:
// - No server-side Python. Everything runs client-side.
// - Recognition uses phrase patterns + simple fuzzy similarity.
// - For central "who practiced / how often", configure APP_CONFIG.logEndpoint in config.js.
//
// Privacy mode (writing practice):
// - Only the latest visitor answer is shown.
// - It auto-hides after a short delay.
// - Students should write answers in their notebook.

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeOn(el, evt, fn){ if(el) el.addEventListener(evt, fn); }

function parseHotkey(str){
  const s = (str||"").toLowerCase().replace(/\s+/g,"");
  const parts = s.split("+").filter(Boolean);
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt") || parts.includes("option"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command"),
    key: parts.find(p => !["ctrl","control","alt","option","shift","meta","cmd","command"].includes(p)) || ""
  };
}


// --- ID panel visibility (declared early) ---
function updateIdVisibility(state){
  const panel = $("#idPanel") || $("#idCardPanel");
  const grid = $("#trainGrid");
  const step = currentStep(state);
  const show = (step && step.key !== "gate") || (state.asked && state.asked["request_id"]);
  if(panel) panel.style.display = show ? "" : "none";
  if(grid){
    if(show) grid.classList.remove("trainGridOneCol");
    else grid.classList.add("trainGridOneCol");
  }
}
window.updateIdVisibility = updateIdVisibility;


function matchesHotkey(e, hk){
  if(!hk) return false;
  const key = (e.key || "").toLowerCase();
  return (!!hk.ctrl === !!e.ctrlKey) &&
         (!!hk.alt === !!e.altKey) &&
         (!!hk.shift === !!e.shiftKey) &&
         (!!hk.meta === !!e.metaKey) &&
         (hk.key === key);
}

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

function downloadJson(filename, obj){
  const text = JSON.stringify(obj, null, 2);
  const blob = new Blob([text], { type:"application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const DIFFICULTY = {
  Basic:    { threshold: 0.68 },
  Standard: { threshold: 0.72 },
  Advanced: { threshold: 0.78 },
};

const EXAMPLE_BY_INTENT = {
  ask_identity: "Could you tell me your name, please?",
  ask_purpose: "What are you doing here today?",
  ask_appointment: "Do you have an appointment?",
  ask_host: "With whom do you have an appointment?",
  ask_time: "What time is your appointment?",
  ask_topic: "What is the appointment about?",
  request_id: "May I see your ID, please?",
  control_question: "Can you tell me your date of birth, please?",
  contact_supervisor: "One moment, I will contact my supervisor.",
  inform_search_threat: "Due to an increased threat level, you will be searched before entry.",
  prohibited_items: "You are not allowed to bring weapons, drugs, or alcohol onto the base.",
  request_surrender: "If you have any prohibited items, please hand them over now.",
  explain_patdown: "I will conduct a security search (a pat-down).",
  ask_sharp: "Do you have any sharp objects on you?",
  empty_pockets: "Please empty your pockets and place the items in the tray.",
  remove_jacket: "Please remove your jacket/coat.",
  announce_armpits: "I am searching under your armpits.",
  announce_waist: "I am searching around your waist.",
  announce_private: "I am searching around your private parts.",
  leg_instruction: "Please place your foot on your knee.",
  issue_visitor_pass_rule: "Here is your visitor pass. Wear it visibly at all times.",
  return_pass_rule: "Please return the visitor pass at the end of your visit.",
  alarm_rally_point: "If the alarm sounds, go to the assembly area (rally point).",
  closing_time: "The base is closed to visitors after 16:00. All visitors must have left by then.",
};

const INTENT_PRIORITY = [
  "ask_identity","ask_purpose","ask_appointment","ask_host","ask_time","ask_topic",
  "request_id","control_question","contact_supervisor",
  "inform_search_threat","prohibited_items","request_surrender",
  "explain_patdown","ask_sharp","empty_pockets","remove_jacket",
  "announce_armpits","announce_waist","announce_private","leg_instruction",
  "issue_visitor_pass_rule","return_pass_rule","alarm_rally_point","closing_time",
];

const PURPOSE_TO_TOPICS = {
  "a delivery": ["equipment delivery","spare parts delivery","package delivery"],
  "maintenance work": ["network maintenance","equipment repair","HVAC maintenance"],
  "an inspection": ["fire safety inspection","vehicle inspection","safety compliance inspection"],
  "a briefing": ["training coordination","security briefing","project briefing"],
  "a meeting": ["IT audit meeting","contractor meeting","planning meeting"],
};

const DATA = {
  FIRST: ["Mark","Tom","James","Lucas","Daan","Pieter","Ahmed","Omar","Robert","Kevin","Hassan","Marco"],
  LAST:  ["Jensen","Bakker","Williams","De Vries","Khan","Smit","Brown","Visser","Johnson","Martens"],
  ORG:   ["NetSecure BV","NorthRail","TriCom Systems","BlueShield Contractors","AeroTech Services","MedLogistics"],
  HOST:  ["Captain De Vries","Lt. Van Dijk","Major Jansen","Sgt. De Boer","Captain Smit"],
  TIME:  ["09:00","10:30","13:00","14:30","15:15"],
  NAT:   ["Dutch","German","Belgian","British","French","Spanish","Polish","Italian"],
  MOOD: [
    "The visitor looks relaxed and confident.",
    "The visitor looks slightly nervous and fidgets with his hands.",
    "The visitor seems impatient and keeps checking his watch.",
    "The visitor looks uneasy and keeps glancing around.",
    "The visitor looks tired but cooperative.",
    "The visitor looks annoyed but stays polite."
  ],
  STREET:["Oak Street","Main Street","Station Road","Maple Avenue","Church Lane","Parkstraat","Wilhelminastraat"],
  CITY:  ["Ede","Arnhem","Utrecht","Apeldoorn","Zwolle","Amersfoort"],
  PC:    ["6711 AB","6811 CD","3511 EF","7311 GH","8011 JK","3811 LM"],
  TWISTS: [
    ["vague_time","The visitor is vague about the appointment time unless asked clearly."],
    ["no_appointment","The visitor says they have no appointment."],
    ["annoyed","The visitor is annoyed and short in responses."],
    ["typo_name","The visitor gives a name that is easy to misspell."],
    ["sharp_object","The visitor has a small sharp object and must surrender it."],
    ["alcohol","The visitor has alcohol and must surrender it."],
  ]
};



const VISITORS = [
  { photo:"assets/photos/headshot_01.png", name:"Mark Visser", org:"MedLogistics", role:"courier",
    purpose:"a delivery", topic:"spare parts delivery", host:"Sgt. De Boer", time: computeMeetingTime(), nationality:"Dutch" },
  { photo:"assets/photos/headshot_02.png", name:"Tom Bakker", org:"AeroTech Services", role:"technical inspector",
    purpose:"an inspection", topic:"fire safety inspection", host:"Captain Smit", time: computeMeetingTime(), nationality:"Dutch" },
  { photo:"assets/photos/headshot_03.png", name:"James Khan", org:"BlueShield Contractors", role:"contractor electrician",
    purpose:"maintenance work", topic:"equipment repair", host:"Lt. Van Dijk", time: computeMeetingTime(), nationality:"British" },
  { photo:"assets/photos/headshot_04.png", name:"Lucas Jansen", org:"NetSecure BV", role:"security vendor",
    purpose:"a meeting", topic:"security briefing", host:"Major Jansen", time: computeMeetingTime(), nationality:"Dutch" },
  { photo:"assets/photos/headshot_05.png", name:"Daan Martens", org:"NorthRail", role:"mechanic",
    purpose:"maintenance work", topic:"vehicle inspection", host:"Sgt. De Boer", time: computeMeetingTime(), nationality:"Belgian" },
  { photo:"assets/photos/headshot_06.png", name:"Pieter Smit", org:"TriCom Systems", role:"it specialist",
    purpose:"a meeting", topic:"IT audit meeting", host:"Captain De Vries", time: computeMeetingTime(), nationality:"Dutch" },
  { photo:"assets/photos/headshot_07.png", name:"Ahmed Omar", org:"MedLogistics", role:"driver",
    purpose:"a delivery", topic:"equipment delivery", host:"Lt. Van Dijk", time: computeMeetingTime(), nationality:"German" },
  { photo:"assets/photos/headshot_08.png", name:"Robert Brown", org:"AeroTech Services", role:"briefing attendee",
    purpose:"a briefing", topic:"training coordination", host:"Captain Smit", time: computeMeetingTime(), nationality:"British" },
  { photo:"assets/photos/headshot_09.png", name:"Kevin Johnson", org:"BlueShield Contractors", role:"contractor",
    purpose:"maintenance work", topic:"HVAC maintenance", host:"Major Jansen", time: computeMeetingTime(), nationality:"French" },
  { photo:"assets/photos/headshot_10.png", name:"Hassan De Vries", org:"NetSecure BV", role:"supplier",
    purpose:"a delivery", topic:"package delivery", host:"Captain De Vries", time: computeMeetingTime(), nationality:"Dutch" }
];


const STEPS = [
  { key:"gate", title:"1) Poort (intake)",
    opening:["Good morning.","I need to enter the base."],
    required:["ask_identity","ask_purpose","ask_appointment","ask_host","ask_time","ask_topic"],
    hint:"Ask: name, purpose, appointment, who with, what time, and what it is about."
  },
  { key:"id_check", title:"2) ID-check + controlevraag + contact leidinggevende",
    opening:["Sure. Where do you want me to go?"],
    required:["request_id","control_question","contact_supervisor"],
    hint:"Request ID, ask one control question, then contact supervisor."
  },
  { key:"threat_rules", title:"3) Toelaten + dreiging + verboden items",
    opening:["Can I go in now?"],
    required:["inform_search_threat","prohibited_items","request_surrender"],
    hint:"Explain search due to threat. State prohibited items. Ask to surrender them."
  },
  { key:"patdown", title:"4) Fouilleren / zoekinstructies",
    opening:["Alright. What do I need to do?"],
    required:["explain_patdown","ask_sharp","empty_pockets","remove_jacket","announce_armpits","announce_waist","announce_private","leg_instruction"],
    hint:"Explain pat-down, ask sharp objects, empty pockets, remove jacket, announce areas, leg instruction."
  },
  { key:"registration_rules", title:"5) Registratie + kazerne regels",
    opening:["Okay. Am I good to go?"],
    required:["issue_visitor_pass_rule","return_pass_rule","alarm_rally_point","closing_time"],
    hint:"Visitor pass rules, return rule, rally point, and closing time."
  },
];

const INTENT_PHRASES_BASE = {
  ask_identity: ["who are you","what is your name","your name please","identify yourself","may i have your name","can you tell me your name"],
  ask_purpose: ["what are you doing here","what is the purpose","why are you here","reason for your visit","what brings you here","what is your reason for visiting"],
  ask_appointment: ["do you have an appointment","have you got an appointment","do you have a meeting scheduled","do you have an appointment scheduled","are you expected","do you have a booking"],
  ask_host: ["who are you meeting","who do you have an appointment with","with whom do you have a meeting","who is your host","who is expecting you"],
  ask_time: ["what time is the appointment","what time is your meeting","appointment time","when is the appointment","what time is it scheduled",
             "what time is that","what time is that delivery","what time is the delivery","what time is your delivery","what time is your inspection",
             "what time is that inspection","what time is that meeting","what time is that appointment"],
  ask_topic: ["what is the appointment about","what is the meeting about","topic of the appointment","what is it regarding","what is the purpose of the meeting"],
  request_id: ["can i see your id","show me your id","id please","identification please","may i see your identification","could you show your id"],
  control_question: ["date of birth","what is your date of birth","what is your birthday","what is your address","what is your postcode","what is your zip code",
                     "nationality","how old are you","what is your age","where do you live","dob","what is your dob","what's your dob","when is your birthday","when were you born","you are","you're","confirm your age","confirm your date of birth"],
  contact_supervisor: ["i will contact my supervisor","i will call my supervisor","one moment i will contact my supervisor","please wait i will contact","i will check with my supervisor"],
  inform_search_threat: ["heightened threat","increased threat","security level","you will be searched","for security reasons you will be searched","due to a higher threat level"],
  prohibited_items: ["no weapons","no drugs","no alcohol","prohibited items","weapons drugs or alcohol","you are not allowed to bring weapons","you are not allowed to bring drugs","you are not allowed to bring alcohol"],
  request_surrender: ["please hand them over","you must surrender","give them to me","you have to hand it over","hand it over"],
  explain_patdown: ["i will pat you down","i am going to search you","i will frisk you","i will conduct a security search","i will perform a pat-down"],
  ask_sharp: ["sharp objects","anything sharp","needles","anything that can hurt","do you have anything sharp","any sharp items"],
  empty_pockets: ["empty your pockets","take everything out of your pockets","put your items on the table","place your belongings in the tray"],
  remove_jacket: ["remove your jacket","take off your jacket","remove your coat","remove your outerwear"],
  announce_armpits: ["under your armpits","armpits"],
  announce_waist: ["around your waist","waistline"],
  announce_private: ["private parts","groin area","around your private parts"],
  leg_instruction: ["place your foot on your knee","rest your ankle on your knee","lift your leg and place it","put your foot on your knee"],
  issue_visitor_pass_rule: ["here is your visitor pass","visitor badge","wear it visibly","visible at all times","you must wear it","keep it visible"],
  return_pass_rule: ["return it at the end","hand it in at the end","give it back when you leave","return the pass","return the badge"],
  alarm_rally_point: ["if the alarm sounds","assembly area","rally point","muster point","go to the assembly area","go to the rally point"],
  closing_time: ["we close at four","closing time is 16:00","visitors must leave by 4 pm","the base closes for visitors at 4","all visitors must leave by four"],
};

function computeMeetingTime(){
  const now = new Date();
  const addMin = 10 + Math.floor(Math.random()*16); // 10-25
  const d = new Date(now.getTime() + addMin*60000);
  // round to nearest 5 minutes
  const mins = d.getMinutes();
  const rounded = Math.round(mins/5)*5;
  d.setMinutes(rounded);
  d.setSeconds(0); d.setMilliseconds(0);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${mm}`;
}

function norm(s){
  return String(s ?? "").toLowerCase().trim().replace(/\s+/g," ");
}

// Normalized Levenshtein similarity
function similarity(a,b){
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, () => new Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m,n);
}

function fuzzyIntentMatch(userText, phrases, threshold){
  const t = norm(userText);
  for(const p of (phrases||[])){
    const p2 = norm(p);
    if (!p2) continue;
    if (t.includes(p2)) return true;
    if (similarity(t, p2) >= threshold) return true;
  }
  return false;
}

function pbMatch(text, entries){
  const t = norm(text);
  for(const e of (entries||[])){
    for(const p of (e.patterns||[])){
      const p2 = norm(p);
      if (p2 && t.includes(p2)) return e;
    }
  }
  return null;
}

function offScriptReflect(userText, phrasebank){
  const cleaned = (userText||"").trim();
  if(!cleaned) return "Sorry—what exactly do you need to know?";
  const tpl = (phrasebank.off_script && phrasebank.off_script.reflect_question_template) || "Just to confirm: are you asking '{q}'?";
  const q = cleaned.endsWith("?") ? cleaned : cleaned + "?";
  return tpl.replace("{q}", q);
}

function randChoice(arr, rnd){ return arr[Math.floor(rnd()*arr.length)]; }

function makeIdNumber(rnd){
  const a = Math.floor(100000 + rnd()*900000);
  const b = Math.floor(10 + rnd()*90);
  return `ID-${a}-${b}`;
}

function makeDob(rnd){
  const now = new Date();
  const year = (now.getFullYear()-60) + Math.floor(rnd()*43); // 18..60
  const month = 1 + Math.floor(rnd()*12);
  const day = 1 + Math.floor(rnd()*28);
  const d = new Date(Date.UTC(year, month-1, day));
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }).replace(",", "");
}

function computeAge(dobStr){
  try{
    const parts = dobStr.split(" ");
    if(parts.length !== 3) return null;
    const day = parseInt(parts[0],10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2],10);
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const month = months[monthStr.slice(0,3)];
    const dob = new Date(year, month, day);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }catch(_){ return null; }
}

function makeAddress(rnd){
  const street = randChoice(DATA.STREET, rnd);
  const nr = 1 + Math.floor(rnd()*199);
  const pc = randChoice(DATA.PC, rnd);
  const city = randChoice(DATA.CITY, rnd);
  return `${street} ${nr}, ${pc} ${city}`;
}

function makeExpiry(rnd){
  const now = new Date();
  const year = now.getFullYear() + (1 + Math.floor(rnd()*8));
  const month = 1 + Math.floor(rnd()*12);
  const day = 1 + Math.floor(rnd()*28);
  const d = new Date(Date.UTC(year, month-1, day));
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }).replace(",", "");
}

function listPhotoFiles(){
  // We know our assets are named headshot_01.png..headshot_10.png
  const files = [];
  for(let i=1;i<=10;i++){
    files.push(`assets/photos/headshot_${String(i).padStart(2,"0")}.png`);
  }
  return files;
}

function generateVisitorCard(seed){
  // Deterministic selection based on seed so students can replay same run if needed
  const idx = (seed >>> 0) % VISITORS.length;
  const base = deepClone(VISITORS[idx]);

  // Deterministic RNG for the remaining fields (DOB/ID/expiry + mood)
  let s = (seed ^ 0xA5A5A5A5) >>> 0;
  const rnd = () => (s = (s*1664525 + 1013904223) >>> 0) / 4294967296;

  const dob = makeDob(rnd);
  const id_no = makeIdNumber(rnd);
  const expiry = makeExpiry(rnd);

  // Mood line (shown below visitor text)
  const moodLine = randChoice(DATA.MOOD, rnd);

  // Optional twist (kept coherent: a delivery/inspection/meeting/briefing/maintenance still stays same)
  const twist = randChoice(DATA.TWISTS, rnd)[0];

  return {
    ...base,
    headshot: base.photo || base.headshot || "",
    twist,
    id: {
      id_no,
      dob,
      nationality: base.nationality,
      address: makeAddress(rnd), // kept internally for 'where do you live' questions, but NOT displayed on ID
      expiry
    },
    moodLine
  };
}

function responseForControlQuestion(userText, card, state){
  const t = (userText || "").toLowerCase();

  // If the student challenges after we previously accepted a wrong value, apologize + give correct.
  if(state && state.lastWrongAccepted && (t.includes("but your id") || t.includes("that's not correct") || t.includes("that is not correct") || t.includes("it says") || t.includes("your id says"))){
    const correct = state.lastWrongAccepted.correct;
    state.lastWrongAccepted = null;
    return randChoice([
      `Sorry, I must have misheard you. The correct information is ${correct}.`,
      `Sorry, I got confused for a moment. The correct information is ${correct}.`,
      `My apologies — I misspoke. The correct information is ${correct}.`
    ], Math.random);
  }

  // Detect control questions about DOB / age / nationality / spelling name
  const wantsDob = t.includes("date of birth") || t.includes("dob") || t.includes("born");
  const wantsAge = t.includes("age") || t.includes("years old") || /are you\s+\d{2}/.test(t);
  const wantsNationality = t.includes("nationality") || t.includes("citizen") || t.includes("from which country");
  const wantsSpell = t.includes("spell") && t.includes("name");

  // If the student proposes a wrong value, sometimes correct, sometimes accept (then allow challenge)
  const correctChance = 0.7;

  if(wantsDob && card && card.id && card.id.dob){
    const correctDob = formatDob(card.id.dob);
    const hasYear = /\b(19|20)\d{2}\b/.test(t);
    const year = (card.id.dob || "").slice(0,4);
    // If they mention a year and it's not the correct year -> mismatch
    if(hasYear && year && !t.includes(year)){
      if(Math.random() < correctChance){
        return `No, my date of birth is ${correctDob}.`;
      }
      if(state){
        state.lastWrongAccepted = { type:"dob", correct: correctDob };
      }
      return "Yes, that's right.";
    }
    // otherwise answer normally
    return `My date of birth is ${correctDob}.`;
  }

  if(wantsAge && card && card.id && String(card.id.age)){
    const correctAge = String(card.id.age);
    const n = (t.match(/\b(\d{2})\b/)||[])[1];
    if(n && n !== correctAge){
      if(Math.random() < correctChance){
        return `No, I'm actually ${correctAge}.`;
      }
      if(state){
        state.lastWrongAccepted = { type:"age", correct: correctAge };
      }
      return "Yes, that's right.";
    }
    return `I'm ${correctAge} years old.`;
  }

  if(wantsNationality && card && card.id && card.id.nationality){
    const nat = card.id.nationality;
    // if they propose a specific nationality and it's wrong
    const prop = (t.match(/\b(dutch|belgian|german|french|british|italian|spanish|turkish|danish|norwegian|swedish|polish|moroccan|nigerian)\b/)||[])[1];
    if(prop && nat && prop.toLowerCase() !== nat.toLowerCase()){
      if(Math.random() < correctChance){
        return `No, my nationality is ${nat}.`;
      }
      if(state){
        state.lastWrongAccepted = { type:"nationality", correct: nat };
      }
      return "Yes, that's right.";
    }
    return `My nationality is ${nat}.`;
  }

  if(wantsSpell && card && card.name){
    const spelled = card.name.split("").filter(ch => ch !== " ").join("-").toUpperCase();
    return `Sure. It's ${spelled}.`;
  }

  return null;
}

function visitorResponseForIntent(state, intent, userText, card){
  const t = norm(userText);
  if(t.includes("spell") && t.includes("name")){
    const spelled = card.name.replace(/\s+/g,"").split("").join("-");
    return `It is spelled: ${spelled}.`;
  }

  switch(intent){
    case "ask_identity":
      return card.twist==="typo_name" ? `My name is ${card.name}… that’s J-e-n-s-e-n.` : `My name is ${card.name}.`;
    case "ask_purpose":
        // HOW_CAN_I_HELP_SPECIAL
        if(norm(userText) === "how can i help" || norm(userText) === "how can i help?"){
          markAsked(state, "purpose");
          return "I would like to get on the base, please.";
        }
        markAsked(state, "purpose");
      return `I'm here for ${card.purpose}.`;
    case "ask_appointment":
        markAsked(state, "appointment");
      return card.twist==="no_appointment" ? "No, I don't have an appointment." : "Yes, I have an appointment.";
    case "ask_host":
        markAsked(state, "host");
      return card.twist==="no_appointment" ? "Uh… I don't actually have an appointment. I was told I could come by." : `I'm meeting ${card.host}.`;
    case "ask_time":
        markAsked(state, "time");
      return card.twist==="vague_time" ? "I think it's sometime this afternoon… I'm not sure." : `It's at ${card.time}.`;
    case "ask_topic":
      return `It's about ${card.topic}.`;
    case "request_id":
        markAsked(state, "request_id");
        updateIdVisibility(state);
        updateIdVisibility(state);
        updateVisitorAvatar(state);
      // If still in gate, move into ID check step automatically
        try{
          const step = currentStep(state);
          if(step && step.key === "gate"){
            goToStep(state, "id_check");
          }
          updateIdVisibility(state);
        }catch(e){}
        return "Sure, here is my ID.";
    case "control_question":
      return responseForControlQuestion(userText, card, state);
    case "contact_supervisor":
      return "Okay, I'll wait.";
    case "inform_search_threat":
      return card.twist==="annoyed" ? "Fine. Let's just get this over with." : "Understood.";
    case "prohibited_items":
      if(card.twist==="sharp_object") return "I do have a small pocket knife in my bag.";
      if(card.twist==="alcohol") return "I have a bottle of wine as a gift.";
      return "I don't have any of those.";
    case "request_surrender":
      return (card.twist==="sharp_object" || card.twist==="alcohol") ? "Alright, I will hand it over." : "Okay.";
    case "ask_sharp":
      return card.twist==="sharp_object" ? "I already mentioned the pocket knife—nothing else." : "No.";
    case "ask_age":
        return "I'm " + state.card.age + " years old.";

      case "ask_dob":
        return "My date of birth is " + formatDob(state.card.dob) + ".";

      case "challenge":
        // Mood can shift when challenged
        if(state.card){
          state.card.mood = "uneasy";
          renderMood(state);
        }
        return randChoice([
          "I'm just tired from a long drive, that's all.",
          "Sorry, it's been a long day. I'm fine.",
          "I'm a bit stressed because I'm running late, but everything is in order."
        ]);

      case "ask_who":
        markAsked(state, "who");
        return "My name is " + state.card.name + ".";

      default:
      return "Understood.";
  }
}

const REVEAL_BY_INTENT = {
  ask_identity: ["name","org"],
  ask_purpose: ["purpose"],
  ask_host: ["host"],
  ask_time: ["time"],
  ask_topic: ["topic"],
  request_id: ["id"], // makes card appear
};

function reveal(intent, state){
  const fields = REVEAL_BY_INTENT[intent] || [];
  for(const f of fields){
    if(f==="id") { state.revealed.id = true; state.revealed.name = true; state.revealed.dob = true; state.revealed.nationality = true; state.revealed.address = true; state.revealed.age = true; }
    else state.revealed[f] = true;
  }
  // Additional reveals for control questions based on what they asked
  if(intent==="control_question"){
    const q = norm(state.lastStudentText||"");
    if(q.includes("date of birth")||q.includes("birthday")||q.includes("birth")) state.revealed.dob = true;
    if(q.includes("nationality")) state.revealed.nationality = true;
    if(q.includes("address") || (q.includes("where") && q.includes("live"))) state.revealed.address = true;
    if(q.includes("age") || q.includes("how old")) state.revealed.age = true;
  }
}

async function loadPhrasebank(){
  // Base phrasebank from repo
  let base = null;
  try{
    const res = await fetch("phrasebank.json", { cache:"no-store" });
    base = await res.json();
  }catch(err){
    console.error("Failed to load phrasebank.json", err);
    base = { smalltalk: [], off_script: { reflect_question_template: "Just to confirm: are you asking '{q}'?" }, intents: {} };
  }

  // Optional local draft (teacher use)
  const useDraft = localStorage.getItem("veva_phrasebank_use_draft") === "1";
  const draftRaw = localStorage.getItem("veva_phrasebank_draft");
  if(useDraft && draftRaw){
    try{
      const draft = JSON.parse(draftRaw);
      return draft;
    }catch(err){
      console.warn("Invalid local phrasebank draft — falling back to base.", err);
      // Clear broken draft so the app can start normally
      localStorage.removeItem("veva_phrasebank_draft");
      localStorage.removeItem("veva_phrasebank_use_draft");
      try{ showToast("Local phrasebank draft was invalid and has been reset."); }catch(_){}
    }
  }
  return base;
}

function mergedIntentPhrases(phrasebank){
  const merged = JSON.parse(JSON.stringify(INTENT_PHRASES_BASE));
  const extra = (phrasebank.intents || {});
  for(const [intent, list] of Object.entries(extra)){
    merged[intent] = merged[intent] || [];
    if(Array.isArray(list)){
      for(const p of list){
        if(typeof p === "string" && p.trim()) merged[intent].push(p.trim());
      }
    }
  }
  return merged;
}

function setScreen(id){
  ["#screen-login","#screen-train","#screen-feedback"].forEach(s => $(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function showVisitor(text){
  const bubble = $("#visitorBubble");
  bubble.textContent = text || "";
  bubble.style.display = "flex";
  // hide after 8 seconds (writing practice)
  window.clearTimeout(window.__hideTimer);
  window.__hideTimer = window.setTimeout(() => {
    bubble.textContent = "Ask your next question…";
  }, 8000);
}

function updateMeta(state){
  const meta = $("#meta");
  meta.innerHTML = state.student ? `Student: <b>${escapeHtml(state.student)}</b> <span class="runId">• Run: ${escapeHtml(state.runId)}</span>` : "";
}

function currentStep(state){ return STEPS[state.stepIndex]; }

function ensureOpenings(state){
  const step = currentStep(state);
  if(state.openedSteps.has(step.key)) return;
  step.opening.forEach(line => showVisitor(line));
  state.openedSteps.add(step.key);
}

function buildCsv(state){
  // Build a simple CSV of run summary + per-intent completion
  const lines = [];
  const header = ["runId","student","className","difficulty","startedAt","finishedAt","event","step","intent","completed"];
  lines.push(header.join(","));

  const startedAt = state.startedAt;
  const finishedAt = state.finishedAt || "";
  for(const step of STEPS){
    for(const intent of step.required){
      const row = [
        state.runId,
        escapeCsv(state.student),
        escapeCsv(state.className||""),
        state.difficulty,
        startedAt,
        finishedAt,
        "check",
        step.key,
        intent,
        state.done[intent] ? "1" : "0"
      ];
      lines.push(row.join(","));
    }
  }
  return lines.join("\n");
}

function escapeCsv(s){
  s = (s ?? "").toString();
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g,'""')}"`;
  }
  return s;
}

function top3Misses(state){
  const missing = [];
  for(const step of STEPS){
    for(const intent of step.required){
      if(!state.done[intent] && !missing.includes(intent)) missing.push(intent);
    }
  }
  const idx = new Map(INTENT_PRIORITY.map((k,i)=>[k,i]));
  missing.sort((a,b)=>(idx.get(a)??999)-(idx.get(b)??999));
  return missing.slice(0,3);
}

function allMissesByStep(state){
  const blocks = [];
  for(const step of STEPS){
    const miss = step.required.filter(i => !state.done[i]);
    if(miss.length){
      blocks.push({ title: step.title, intents: miss });
    }
  }
  return blocks;
}

async function logEvent(payload){
  const ep = (window.APP_CONFIG && window.APP_CONFIG.logEndpoint) || "";
  if(!ep) return;
  try{
    await fetch(ep, {
      method:"POST",
      // Apps Script Web Apps often do not return CORS headers. Use a simple request.
      mode:"no-cors",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }catch(_){}
}

function renderIdCard(state){
  const canvas = $("#idCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // background
  ctx.fillStyle = "#f5f5f5"; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = "#282828"; ctx.lineWidth = 4; ctx.strokeRect(10,10,W-20,H-20);

  // header
  ctx.fillStyle = "rgb(30,60,120)";
  ctx.fillRect(10,10,W-20,100);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px system-ui";
  ctx.fillText("TRAINING ID CARD", 30, 60);
  ctx.fillStyle = "rgba(210,220,245,1)";
  ctx.font = "22px system-ui";
  ctx.fillText("Fictional document for classroom practice", 30, 90);

  // photo box
  const box = {x:30,y:140,w:230,h:270};
  ctx.fillStyle = "#e6e6e6";
  ctx.fillRect(box.x,box.y,box.w,box.h);
  ctx.strokeStyle = "#282828"; ctx.lineWidth = 3;
  ctx.strokeRect(box.x,box.y,box.w,box.h);

  // draw photo if available
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, box.x, box.y, box.w, box.h);
    drawFields();
  };
  img.onerror = () => {
    // placeholder
    ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(145,235,55,0,Math.PI*2); ctx.stroke();
    ctx.strokeRect(105,285,80,95);
    drawFields();
  };
  img.src = state.card.photo;

  function field(label, value, y){
    ctx.fillStyle = "#000"; ctx.font = "bold 28px system-ui";
    ctx.fillText(label+":", 300, y);
    ctx.font = "28px system-ui";
    ctx.fillText(value, 510, y);
  }

  function drawFields(){
    // Card footer (no instructional/reminder text)
    ctx.fillStyle = "#f0f0f0"; ctx.fillRect(10,H-70,W-20,60);

    const card = state.card;
    const id = card.id;
    const name = state.revealed.name ? card.name : "—";
    const org  = state.revealed.org ? card.org : "—";
    const nat  = (state.revealed.id || state.revealed.nationality) ? id.nationality : "—";
    const dob  = (state.revealed.id || state.revealed.dob) ? id.dob : "—";
    const age  = (state.revealed.id || state.revealed.age) ? ((computeAge(id.dob) ?? "—").toString()) : "—";

    field("Name", name, 170);
    field("Company", org, 222);
    field("Nationality", nat, 274);
    field("Date of birth", dob, 326);
    field("Age", age, 378);
    field("ID No.", id.id_no, 490);
    field("Expiry", id.expiry, 520);
  }
}

function buildState(){
  const seed = (Math.random()*1e9) >>> 0;
  return {
    runId: `run_${seed}`,
    student: "",
    className: "",
    difficulty: "Standard",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    phrasebank: null,
    intentPhrases: null,
    card: generateVisitorCard(seed),
    revealed: { id:false },
    stepIndex: 0,
    openedSteps: new Set(),
    done: {},
    lastStudentText: "",
    pendingReflect: null,
    asked: {},
    gateComplete: false,
    supervisorComplete: false,
    threatRulesComplete: false,

    supervisorApproved: false,
    supervisorModalUsed: false,
    pendingReturnToVisitor: false,

  };
}


function goToStep(state, stepKey){
  const idx = STEPS.findIndex(s => s.key === stepKey);
  if(idx >= 0){
    state.stepIndex = idx;
    state.stepKey = stepKey;
    setStepUI(state);
    updateVisitorAvatar(state);
    updateIdVisibility(state);
    if(typeof updateActionButtons === 'function') updateActionButtons(state);
    updateIdVisibility(state);
  }
}

function setStepUI(state){
  const step = currentStep(state);
  $("#stepTitle").textContent = step.title;
  $("#stepHelp").textContent = "";
  ensureOpenings(state);
  renderMood(state);
  renderIdCard(state);

    // If this step is now complete, auto-advance (except where a button is required)
    const stepNow = currentStep(state);
    const complete = stepNow.required.every(i => state.done[i]);
    if(complete){
      // Special case: in ID-check we require a supervisor-return flow
      if(stepNow.key === "id_check"){
        $("#stepHelp").textContent = "Use the button: Contact supervisor → fill 5W → then Return to visitor.";
        state.pendingReturnToVisitor = true;
        if(typeof updateActionButtons === 'function') updateActionButtons(state);
        showVisitor("✅ ID-check complete. Next: contact supervisor (button), then return to the visitor.");
      } else if(stepNow.key === "threat_rules"){
        $("#stepHelp").textContent = "Press “Go to person search” to proceed to the pat-down.";
        if(typeof updateActionButtons === 'function') updateActionButtons(state);
        showVisitor("✅ Step complete. Press “Go to person search” to continue to the pat-down.");
      } else {
        const nextStep = (state.stepIndex < STEPS.length - 1) ? STEPS[state.stepIndex + 1] : null;
        const msg = nextStep ? `✅ Step complete. Moving to: ${nextStep.title}` : "✅ Step complete. Finishing run.";
        showVisitor(msg);
        if(nextStep){
          // advance after a short delay so the student can read the message
          window.setTimeout(() => {
            state.stepIndex++;
            $("#stepHelp").textContent = "";
            setStepUI(state);
            showVisitor(nextStep.opening[0] || "Okay.");
          }, 1200);
        } else {
          window.setTimeout(() => finishRun(state), 800);
        }
      }
    }


function updateActionButtons(state){
  const step = currentStep(state);
  const btnContact = $("#btnContactSupervisor");
  const btnReturn = $("#btnReturnVisitor");
  const btnGo = $("#btnGoPersonSearch");

  // defaults: hidden
  [btnContact, btnReturn, btnGo].forEach(b => { if(b) { b.style.display = "none"; b.disabled = false; } });

  if(step.key === "id_check"){
    // Show contact supervisor after ID requested + control question done (or anytime, if teacher wants)
    if(btnContact) btnContact.style.display = "inline-flex";
    if(state.supervisorApproved && btnReturn){
      btnReturn.style.display = "inline-flex";
    }
  }

  // After supervisor approved, we want an explicit return step before moving to threat_rules
  if(state.pendingReturnToVisitor && btnReturn){
    btnReturn.style.display = "inline-flex";
    if(btnContact) btnContact.style.display = "none";
  }

  // Gate to person search: after threat_rules complete show button to proceed (optional)
  if(step.key === "threat_rules"){
    if(btnGo) btnGo.style.display = "inline-flex";
  }
  if(step.key === "patdown"){
    // no special buttons
  }
}
}

function smalltalkResponse(text, phrasebank){
  const hit = pbMatch(text, phrasebank.smalltalk || []);
  return hit ? hit.response : null;
}


function markAsked(state, key){
  if(!state.asked) state.asked = {};
  state.asked[key] = true;
}

function hasAsked(state, keys){
  return keys.every(k => state.asked && state.asked[k]);
}

function maybeAutoAdvanceFromGate(state){
  // Required for gate: who, purpose, appointment, host, time, about
  const req = ["who","purpose","appointment","host","time","about"];
  if(state.stepKey === "gate" && hasAsked(state, req)){
    state.gateComplete = true;
    // Move to ID step
    goToStep(state, "id_check");
    showVisitor("Okay. Please show me your ID for verification.");
    renderMood(state);
    return true;
  }
  return false;
}

function maybeAutoAdvanceAfterSupervisor(state){
  if(state.stepKey === "id_check" && state.supervisorComplete){
    goToStep(state, "threat_rules");
    showVisitor("Everything checks out. Before you enter: no weapons, no drugs, and no alcohol. Due to an increased threat level, everyone is searched.");
    renderMood(state);
    return true;
  }
  return false;
}

function maybeAutoAdvanceAfterThreatRules(state){
  if(state.stepKey === "threat_rules" && state.threatRulesComplete){
    goToStep(state, "person_search");
    showVisitor("Please follow me to the person search area.");
    renderMood(state);
    return true;
  }
  return false;
}

function processUserLine(state, userText){
  // threat rules completion (simple)
  if(state.stepKey === "threat_rules"){
    const t = norm(userText);
    if(t.includes("no weapons") || t.includes("no drugs") || t.includes("no alcohol") || t.includes("prohibited") || t.includes("searched") || t.includes("search") || t.includes("pat-down") || t.includes("due to") ){
      state.threatRulesComplete = true;
    }
  }

  // handle reflect yes/no
  if(state.pendingReflect){
    const t = norm(userText);
    if(["yes","yeah","yep","correct","that's right","right","affirmative","sure"].includes(t)){
      state.pendingReflect = null;
      showVisitor("Okay. What do you want to know?");
      return;
    }
    if(["no","nope","negative","not really"].includes(t)){
      state.pendingReflect = null;
      showVisitor("No problem. Please ask your security questions.");
      return;
    }
  }

  state.lastStudentText = userText;
  const pb = state.phrasebank;
  const step = currentStep(state);
  const threshold = DIFFICULTY[state.difficulty].threshold;

  const stResp = smalltalkResponse(userText, pb);
  if(stResp){
    showVisitor(stResp);
    return;
  }

  const remaining = step.required.filter(i => !state.done[i]);
  let matched = null;
  for(const intent of remaining){
    const phrases = state.intentPhrases[intent] || [];
    if(fuzzyIntentMatch(userText, phrases, threshold)){
      matched = intent;
      break;
    }
  }

  if(matched){
    state.done[matched] = true;
    reveal(matched, state);
    const answer = visitorResponseForIntent(state, matched, userText, state.card);
    showVisitor(answer);
  // Auto-advance from gate to ID-check when all required questions have been asked
  const step = currentStep(state);
  if(step && step.key === "threat_rules" && threatComplete(state)){
    showVisitor("Alright. Due to an increased threat level, everyone is searched. Please follow me to the pat-down.");
    // allow moving on
    updateActionButtons && updateActionButtons(state);
  }

  if(step && step.key === "gate" && gateComplete(state)){
    showVisitor("Thank you. Please show me your ID. (Ask: \"Can I see your ID?\" )");
    goToStep(state, "id_check");
    updateIdVisibility(state);
  }
    renderIdCard(state);
  } else {
    // Log unknown questions (optional)
    if(window.APP_CONFIG && window.APP_CONFIG.logUnknownQuestions){
      logEvent({
        event: "unknown_question",
        student: state.student,
        className: state.className,
        runId: state.runId,
        ts: new Date().toISOString(),
        stats: {
          difficulty: state.difficulty,
          step: currentStep(state).key,
          text: userText,
          userAgent: navigator.userAgent
        }
      });
    }
    state.pendingReflect = userText;
    const reflect = state.difficulty === "Advanced"
      ? "Could you be more specific, please?"
      : offScriptReflect(userText, pb);
    showVisitor(reflect);
  }
}

function finishRun(state){
  state.finishedAt = new Date().toISOString();
  // feedback UI
  const top3 = top3Misses(state);
  const ul = $("#top3");
  ul.innerHTML = "";
  if(top3.length === 0){
    ul.innerHTML = "<li>✅ No misses — well done.</li>";
  } else {
    for(const intent of top3){
      const ex = EXAMPLE_BY_INTENT[intent] || "";
      const li = document.createElement("li");
      li.textContent = ex ? `${intent} — e.g., “${ex}”` : intent;
      ul.appendChild(li);
    }
  }

  const blocks = allMissesByStep(state);
  const all = $("#allMisses");
  all.innerHTML = "";
  if(blocks.length === 0){
    all.innerHTML = "<p>✅ No missed items.</p>";
  } else {
    for(const b of blocks){
      const h = document.createElement("h3");
      h.textContent = b.title;
      all.appendChild(h);
      const u = document.createElement("ul");
      for(const intent of b.intents){
        const ex = EXAMPLE_BY_INTENT[intent] || "";
        const li = document.createElement("li");
        li.textContent = ex ? `${intent} — e.g., “${ex}”` : intent;
        u.appendChild(li);
      }
      all.appendChild(u);
    }
  }

  // local counter (no backend)
  const key = "veva_practice_counter";
  const counter = JSON.parse(localStorage.getItem(key) || "{}");
  const who = (state.student || "unknown").trim();
  counter[who] = (counter[who] || 0) + 1;
  localStorage.setItem(key, JSON.stringify(counter));

  setScreen("#screen-feedback");
  updateMeta(state);
}

(async function init(){
  const state = buildState();

  // Preload heavy assets so Start feels instant
  const preloadPhrasebankPromise = (async () => {
    const pb = await loadPhrasebank();
    state.phrasebank = pb;
    state.intentPhrases = mergedIntentPhrases(pb);
    if(typeof teacherRefreshOnLoad === 'function') teacherRefreshOnLoad();
    return pb;
  })();


  // UI hooks
  $("#btnResetLocal").addEventListener("click", () => {
    localStorage.removeItem("veva_practice_counter");
    alert("Lokale telling gereset (alleen op dit apparaat).");
  
    localStorage.removeItem("veva_phrasebank_draft");
    localStorage.removeItem("veva_phrasebank_use_draft");
});

  
  $("#btnStart").addEventListener("click", async () => {
    const name = $("#studentName").value.trim();
    if(!name){
      alert("Vul eerst je naam in.");
      return;
    }

    state.student = name;
    state.className = $("#className").value.trim();
    state.difficulty = $("#difficulty").value;

    // Option 2: switch screens immediately (feels fast)
    setScreen("#screen-train");
    updateMeta(state);
    setStepUI(state);

    // Temporary loading message while we finalize preloads
    showVisitor("Loading scenario…");

    // Await preloaded phrasebank (Option 1)
    await preloadPhrasebankPromise;

    // Fire-and-forget start log (don't block UI)
    logEvent({
      event: "start",
      student: state.student,
      className: state.className,
      runId: state.runId,
      ts: new Date().toISOString(),
      stats: { difficulty: state.difficulty, userAgent: navigator.userAgent }
    }).catch(() => {});

    // Now begin
    updateIdVisibility(state);
    updateVisitorAvatar(state);
    updateIdVisibility(state);
    updateVisitorAvatar(state);
    showVisitor("Good morning.");
    setTimeout(focusQuestion, 50);
    renderMood(state);
  });

  // Enter-to-start (login screen)
  ["#studentName","#className"].forEach(sel => {
    const el = $(sel);
    if(el){
      el.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          $("#btnStart").click();
        }
      });
    }
  });
$("#btnHint").addEventListener("click", () => {
    const step = currentStep(state);
    $("#stepHelp").textContent = step.hint;
  });

  $("#btnSend").addEventListener("click", () => {
    const inp = $("#studentInput");
    const text = inp.value.trim();
    if(!text) return;
    inp.value = "";
    processUserLine(state, text);
  });

  $("#studentInput").addEventListener("keydown", (e) => {
    if(e.key === "Enter"){
      e.preventDefault();
      $("#btnSend").click();
    }
  });

  
  // Supervisor modal buttons
  $("#btnContactSupervisor")?.addEventListener("click", () => openSupervisorModal(state));
  $("#btnCloseModal")?.addEventListener("click", () => closeSupervisorModal());
  $("#btnSendSupervisor")?.addEventListener("click", () => sendToSupervisor(state));
  // Return to visitor
  $("#btnReturnVisitor")?.addEventListener("click", () => {
    state.supervisorComplete = true;

    closeSupervisorModal();
    showVisitor("Alright. Everything checks out. You are allowed on the base.");
    state.pendingReturnToVisitor = false;
    if(typeof updateActionButtons === 'function') updateActionButtons(state);
  
    // Auto-advance to threat rules (you will return to visitor next)
    goToStep(state, "threat_rules");
});
$("#btnDoneStep").addEventListener("click", () => {
    const step = currentStep(state);
    if(step.key === "id_check"){
      $("#stepHelp").textContent = "Use Contact supervisor → fill 5W → Return to visitor.";
      showVisitor("Use the supervisor flow buttons in this step.");
      if(typeof updateActionButtons === 'function') updateActionButtons(state);
      return;
    }
    if(step.key === "threat_rules"){
      $("#stepHelp").textContent = "Press “Go to person search” to proceed to the pat-down.";
      if(typeof updateActionButtons === 'function') updateActionButtons(state);
      showVisitor("Press “Go to person search” to continue.");
      return;
    }
    if(state.stepIndex < STEPS.length - 1){
      state.stepIndex++;
      $("#stepHelp").textContent = "";
      setStepUI(state);
      showVisitor(currentStep(state).opening[0] || "Okay.");
    } else {
      finishRun(state);
    }
  });

  $("#btnNewScenario").addEventListener("click", () => {
    const seed = (Math.random()*1e9) >>> 0;
    state.runId = `run_${seed}`;
    state.card = generateVisitorCard(seed);
    updateVisitorAvatar(state);
    updateIdVisibility(state);
    state.revealed = { id:false };
    state.stepIndex = 0;
    state.stepKey = STEPS[0].key;
    state.openedSteps = new Set();
    state.done = {};
    state.startedAt = new Date().toISOString();
    state.finishedAt = "";
    $("#stepHelp").textContent = "";
    updateMeta(state);
    setStepUI(state);
    updateIdVisibility(state);
    updateVisitorAvatar(state);
    updateIdVisibility(state);
    updateVisitorAvatar(state);
    showVisitor("Good morning.");
    setTimeout(focusQuestion, 50);
  });

  // Teacher button (visible for now)
  safeOn($("#btnTeacher"), "click", () => { openTeacher(); });


  $("#btnFinishRun").addEventListener("click", async () => {
    finishRun(state);
    await logEvent({
      event: "finish",
      student: state.student,
      className: state.className,
      runId: state.runId,
      ts: new Date().toISOString(),
      stats: {
        difficulty: state.difficulty,
        top3: top3Misses(state),
        userAgent: navigator.userAgent
      }
    });
  });

  $("#btnBackToStart").addEventListener("click", () => {
    location.reload();
  });

  $("#btnDownloadCsv").addEventListener("click", () => {
    const csv = buildCsv(state);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `veva_${state.student || "student"}_${state.runId}.csv`.replace(/\s+/g,"_");
    document.body.appendChild(a);
    a.click();
    a.remove();
  });


  // ---------- Teacher mode (hidden phrasebank editor) ----------
  const teacherModal = $("#teacherModal");
  const btnTeacherOpen = $("#btnTeacherOpen");
  const teacherClose = $("#btnTeacherClose");
  const teacherUnlockBox = $("#teacherUnlockBox");
  const teacherPinInput = $("#teacherPinInput");
  const teacherUnlockBtn = $("#btnTeacherUnlock");
  const teacherUnlockStatus = $("#teacherUnlockStatus");

  const TABS = Array.from(document.querySelectorAll(".tab"));
  const PANELS = Array.from(document.querySelectorAll(".tabPanel"));

  const intentSelect = $("#intentSelect");
  const intentNewPattern = $("#intentNewPattern");
  const intentPatternList = $("#intentPatternList");
  const btnAddIntentPattern = $("#btnAddIntentPattern");
  const btnDeleteIntentPattern = $("#btnDeleteIntentPattern");
  const intentStatus = $("#intentStatus");

  const stName = $("#stName");
  const stResponse = $("#stResponse");
  const stPatterns = $("#stPatterns");
  const smalltalkList = $("#smalltalkList");
  const btnAddSmalltalk = $("#btnAddSmalltalk");
  const btnDeleteSmalltalk = $("#btnDeleteSmalltalk");
  const smalltalkStatus = $("#smalltalkStatus");

  const btnExportPhrasebank = $("#btnExportPhrasebank");
  const btnUseDraftNow = $("#btnUseDraftNow");
  const btnDiscardDraft = $("#btnDiscardDraft");
  const fileInput = $("#phrasebankFile");
  const btnImportPhrasebank = $("#btnImportPhrasebank");
  const exportStatus = $("#exportStatus");

  let teacherUnlocked = false;

  function hasTeacherPin(){
    return (window.APP_CONFIG && window.APP_CONFIG.teacherPin && window.APP_CONFIG.teacherPin.length > 0);
  }

  function isTypingTarget(e){
    const t = e.target;
    if(!t) return false;
    const tag = (t.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
  }

  
function openSupervisorModal(state){
  const modal = $("#supervisorModal");
  if(!modal) return;
  modal.classList.remove("hidden");
  // clear fields
  ["wWho","wWhat","wWithWhom","wTime","wWhy"].forEach(id => { const el = $("#"+id); if(el) el.value = ""; });
  const resp = $("#supervisorResponse"); if(resp) resp.textContent = "";
  state.supervisorModalUsed = true;
}

function closeSupervisorModal(){
  const modal = $("#supervisorModal");
  if(modal) modal.classList.add("hidden");
}

function sendToSupervisor(state){
  const who = ($("#wWho")?.value || "").trim();
  const what = ($("#wWhat")?.value || "").trim();
  const withWhom = ($("#wWithWhom")?.value || "").trim();
  const time = ($("#wTime")?.value || "").trim();
  const why = ($("#wWhy")?.value || "").trim();

  const resp = $("#supervisorResponse");
  if(resp){
    resp.textContent = "Supervisor: Approved. Allow the visitor to proceed to the next check.";
  }

  state.supervisorApproved = true;
  // Log event (non-blocking)
  logEvent({
    event: "supervisor_briefing",
    student: state.student,
    className: state.className,
    runId: state.runId,
    ts: new Date().toISOString(),
    stats: { who, what, withWhom, time, why, difficulty: state.difficulty, userAgent: navigator.userAgent }
  }).catch(()=>{});

  updateActionButtons(state);
}
function openTeacher(){
    if(!teacherModal) return;
    teacherModal.classList.remove("hidden");
    exportStatus.textContent = "";
    intentStatus.textContent = "";
    smalltalkStatus.textContent = "";

    if(hasTeacherPin()){
      teacherUnlockBox.open = true;
      teacherUnlockStatus.textContent = teacherUnlocked ? "Unlocked" : "Locked";
    } else {
      teacherUnlockBox.open = false;
      teacherUnlocked = true;
      teacherUnlockStatus.textContent = "Unlocked";
    }

    refreshTeacherUI();
    setTeacherEditingEnabled();
  }

  function closeTeacher(){
    if(!teacherModal) return;
    teacherModal.classList.add("hidden");
  }

  function setTeacherEditingEnabled(){
    const locked = hasTeacherPin() && !teacherUnlocked;
    [
      btnAddIntentPattern, btnDeleteIntentPattern,
      btnAddSmalltalk, btnDeleteSmalltalk,
      btnExportPhrasebank, btnUseDraftNow, btnDiscardDraft, btnImportPhrasebank
    ].forEach(el => { if(el) el.disabled = locked; });
    [intentSelect, intentNewPattern, intentPatternList, stName, stResponse, stPatterns, smalltalkList, fileInput]
      .forEach(el => { if(el) el.disabled = locked; });
  }

  function getDraftOrBase(){
    const raw = localStorage.getItem("veva_phrasebank_draft");
    if(raw){
      try{ return JSON.parse(raw); }catch(_){}
    }
    return state.phrasebank ? deepClone(state.phrasebank) : null;
  }

  function saveDraft(pb){
    localStorage.setItem("veva_phrasebank_draft", JSON.stringify(pb));
  }

  function refreshTeacherUI(){
    let pb = getDraftOrBase();
    if(!pb){
      exportStatus.textContent = "Phrasebank not loaded yet — start a run once, or refresh.";
      return;
    }
    pb.intents = pb.intents || {};
    pb.smalltalk = pb.smalltalk || [];
    pb.off_script = pb.off_script || { reflect_question_template: "Just to confirm: are you asking '{q}'?" };

    const intentKeys = Object.keys(INTENT_PHRASES_BASE).sort();
    intentSelect.innerHTML = "";
    for(const k of intentKeys){
      const opt = document.createElement("option");
      opt.value = k; opt.textContent = k;
      intentSelect.appendChild(opt);
    }
    const prev = intentSelect.dataset.prev;
    if(prev && intentKeys.includes(prev)) intentSelect.value = prev;

    intentSelect.dataset.prev = intentSelect.value;
    const sel = intentSelect.value;
    const patterns = Array.isArray(pb.intents[sel]) ? pb.intents[sel] : [];
    intentPatternList.innerHTML = "";
    patterns.forEach((p, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = p;
      intentPatternList.appendChild(opt);
    });

    smalltalkList.innerHTML = "";
    pb.smalltalk.forEach((e, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${e.name || "smalltalk"} — ${((e.patterns||[])[0]||"pattern…")} → ${e.response||""}`;
      smalltalkList.appendChild(opt);
    });
  }

  // Tabs
  TABS.forEach(btn => {
    btn.addEventListener("click", () => {
      TABS.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.tab;
      PANELS.forEach(p => p.classList.add("hidden"));
      document.getElementById(id).classList.remove("hidden");
    });
  });

  safeOn(intentSelect, "change", () => {
    intentSelect.dataset.prev = intentSelect.value;
    refreshTeacherUI();
  });

  safeOn(btnAddIntentPattern, "click", () => {
    const pattern = (intentNewPattern.value || "").trim();
    if(!pattern){ intentStatus.textContent = "Enter a pattern first."; return; }
    let pb = getDraftOrBase(); if(!pb) return;
    pb.intents = pb.intents || {};
    const key = intentSelect.value;
    pb.intents[key] = Array.isArray(pb.intents[key]) ? pb.intents[key] : [];
    if(pb.intents[key].map(norm).includes(norm(pattern))){
      intentStatus.textContent = "Pattern already exists.";
      return;
    }
    pb.intents[key].push(pattern);
    saveDraft(pb);
    intentNewPattern.value = "";
    intentStatus.textContent = "Added to local draft.";
    refreshTeacherUI();
  });

  safeOn(btnDeleteIntentPattern, "click", () => {
    const selIdx = intentPatternList.value;
    if(selIdx === "" || selIdx == null){ intentStatus.textContent = "Select a pattern to delete."; return; }
    let pb = getDraftOrBase(); if(!pb) return;
    const key = intentSelect.value;
    const arr = Array.isArray(pb.intents[key]) ? pb.intents[key] : [];
    const idx = parseInt(selIdx, 10);
    if(Number.isNaN(idx) || idx < 0 || idx >= arr.length) return;
    arr.splice(idx, 1);
    pb.intents[key] = arr;
    saveDraft(pb);
    intentStatus.textContent = "Deleted from local draft.";
    refreshTeacherUI();
  });

  safeOn(btnAddSmalltalk, "click", () => {
    const name = (stName.value || "").trim() || "smalltalk";
    const resp = (stResponse.value || "").trim();
    const pats = (stPatterns.value || "").split(",").map(s => s.trim()).filter(Boolean);
    if(!resp || pats.length === 0){
      smalltalkStatus.textContent = "Provide patterns and a response.";
      return;
    }
    let pb = getDraftOrBase(); if(!pb) return;
    pb.smalltalk = pb.smalltalk || [];
    pb.smalltalk.push({ name, patterns: pats, response: resp });
    saveDraft(pb);
    stName.value = ""; stResponse.value = ""; stPatterns.value = "";
    smalltalkStatus.textContent = "Added to local draft.";
    refreshTeacherUI();
  });

  safeOn(btnDeleteSmalltalk, "click", () => {
    const selIdx = smalltalkList.value;
    if(selIdx === "" || selIdx == null){ smalltalkStatus.textContent = "Select an entry to delete."; return; }
    let pb = getDraftOrBase(); if(!pb) return;
    const idx = parseInt(selIdx, 10);
    if(Number.isNaN(idx) || idx < 0 || idx >= pb.smalltalk.length) return;
    pb.smalltalk.splice(idx, 1);
    saveDraft(pb);
    smalltalkStatus.textContent = "Deleted from local draft.";
    refreshTeacherUI();
  });

  safeOn(btnExportPhrasebank, "click", () => {
    let pb = getDraftOrBase(); if(!pb) return;
    pb.off_script = pb.off_script || { reflect_question_template: "Just to confirm: are you asking '{q}'?" };
    downloadJson("phrasebank.json", pb);
    exportStatus.textContent = "Downloaded. Replace repo file and commit to GitHub.";
  });

  safeOn(btnUseDraftNow, "click", async () => {
    const raw = localStorage.getItem("veva_phrasebank_draft");
    if(!raw){ exportStatus.textContent = "No local draft found."; return; }
    localStorage.setItem("veva_phrasebank_use_draft", "1");
    state.phrasebank = await loadPhrasebank();
    state.intentPhrases = mergedIntentPhrases(state.phrasebank);
    if(typeof teacherRefreshOnLoad === 'function') teacherRefreshOnLoad();
    exportStatus.textContent = "Draft enabled for recognition in this browser.";
  });

  safeOn(btnDiscardDraft, "click", () => {
    localStorage.removeItem("veva_phrasebank_draft");
    localStorage.removeItem("veva_phrasebank_use_draft");
    exportStatus.textContent = "Local draft discarded.";
    refreshTeacherUI();
  });

  safeOn(btnImportPhrasebank, "click", async () => {
    const f = fileInput.files && fileInput.files[0];
    if(!f){ exportStatus.textContent = "Choose a file first."; return; }
    try{
      const text = await f.text();
      const pb = JSON.parse(text);
      saveDraft(pb);
      exportStatus.textContent = "Imported into local draft.";
      refreshTeacherUI();
    }catch(err){
      exportStatus.textContent = "Import failed: " + String(err);
    }
  });

  safeOn(teacherUnlockBtn, "click", () => {
    if(!hasTeacherPin()){
      teacherUnlocked = true;
      teacherUnlockStatus.textContent = "Unlocked";
      setTeacherEditingEnabled();
      return;
    }
    const pin = (teacherPinInput.value || "").trim();
    if(pin && pin === window.APP_CONFIG.teacherPin){
      teacherUnlocked = true;
      teacherUnlockStatus.textContent = "Unlocked";
    } else {
      teacherUnlocked = false;
      teacherUnlockStatus.textContent = "Wrong PIN";
    }
    setTeacherEditingEnabled();
  });

  safeOn(teacherClose, "click", closeTeacher);
  safeOn(teacherModal, "click", (e) => { if(e.target === teacherModal) closeTeacher(); });

  window.addEventListener("keydown", (e) => {
    if(isTypingTarget(e)) return;
    if(e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "t")){
      e.preventDefault();
      if(teacherModal.classList.contains("hidden")) openTeacher();
      else closeTeacher();
    }
  }, true);

  // F2 quick open teacher mode
  window.addEventListener("keydown", (e) => {
    if(e.key === "F2"){
      e.preventDefault();
      openTeacher();
    }
  }, true);

  function teacherRefreshOnLoad(){
    try{ refreshTeacherUI(); setTeacherEditingEnabled(); }catch(_){}
  }

  // Enter-to-send (question box)  // Enter-to-send
  const q = $("#typedInput") || $("#userInput");
  if(q){
    q.addEventListener("keydown", (e) => {
      if(e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        $("#btnSend").click();
      }
    });
  }

})();

function updateVisitorAvatar(state){
  const img = $("#visitorAvatar");
  if(!img) return;
  const src = (state && state.card && state.card.headshot) ? state.card.headshot : "";
  img.onerror = () => {
    if(src && src.includes("assets/photos/")) {
      setAvatarSrc(img, src.replace("assets/photos/","assets/fotos/"));
    } else {
      setAvatarSrc(img, "data:image/svg+xml;charset=utf-8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27> <rect width=%27100%%27 height=%27100%%27 fill=%27%231b2a44%27/> <circle cx=%2732%27 cy=%2726%27 r=%2714%27 fill=%27%237aa2d6%27/> <rect x=%2714%27 y=%2742%27 width=%2736%27 height=%2718%27 rx=%279%27 fill=%27%237aa2d6%27/> </svg>");
    }
  };
  setAvatarSrc(img, src || "data:image/svg+xml;charset=utf-8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27> <rect width=%27100%%27 height=%27100%%27 fill=%27%231b2a44%27/> <circle cx=%2732%27 cy=%2726%27 r=%2714%27 fill=%27%237aa2d6%27/> <rect x=%2714%27 y=%2742%27 width=%2736%27 height=%2718%27 rx=%279%27 fill=%27%237aa2d6%27/> </svg>");
}

function setAvatarSrc(img, src){
  if(!img) return;
  img.onerror = null;
  img.src = src || "data:image/svg+xml;charset=utf-8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27> <rect width=%27100%%27 height=%27100%%27 fill=%27%231b2a44%27/> <circle cx=%2732%27 cy=%2726%27 r=%2714%27 fill=%27%237aa2d6%27/> <rect x=%2714%27 y=%2742%27 width=%2736%27 height=%2718%27 rx=%279%27 fill=%27%237aa2d6%27/> </svg>";
}

function focusQuestion(){
  const el = $("#studentInput");
  if(el){ el.focus(); el.select && el.select(); }
}

function gateComplete(state){
  const a = state.asked || {};
  return a.who && a.purpose && a.appointment && a.host && a.time && a.about;
}

function threatComplete(state){
  return state.asked && state.asked["threat_rules"];
}

function denyEntrance(state){
  state.finished = true;
  showVisitor("You are denied entry. Please step aside and wait.");
  logEvent(state, "deny_entrance", {reason:"manual"});
  // disable input
  const inp = $("#studentInput");
  const btn = $("#btnSend");
  if(inp) inp.disabled = true;
  if(btn) btn.disabled = true;
}

function idCheckComplete(state){
  const a = state.asked || {};
  return !!a.request_id && !!a.control_question;
}

function bindGoToPersonSearch(state){
  const a = $("#btnGoToPersonSearch") || $("#btnGoPersonSearch");
  if(a){
    a.addEventListener("click", () => {
      goToStep(state, "person_search");
      updateIdVisibility(state);
      focusQuestion();
    });
  }
}
