// intents_patch_en.js
// Central intent matchers for VEVA Trainer (EN).
// Load BEFORE app.js (via boot.js) so app.js can use window.VEVA_INTENTS.

window.VEVA_INTENTS = [
    { key:"greet", rx:/\b(hi|hello|good\s*(morning|afternoon|evening))\b/i },
    { key:"help_open", rx:/\b(how\s+can\s+i\s+help(\s+you(\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help)\b/i },
      // Ask for surname / last name (separate from spelling)
  { key: "ask_surname", rx: /(what\s+is\s+your\s+(last\s+name|surname)\b|your\s+(last\s+name|surname)\b|surname\?)|last\s+name\?/i },

{ key: "ask_name", rx: /\b(who\s+are\s+you\b|what\s+is\s+your\s+name\b|your\s+name\b|can\s+i\s+have\s+your\s+name\b)\??/i },
    { key:"purpose", rx:/\b(why\s+are\s+you\s+here|what\s+is\s+the\s+purpose|reason\s+for\s+your\s+visit)\b/i },

  // If visitor is evasive about purpose, allow student to insist / warn / deny to force a clear answer
  { key:"insist_reason", rx:/\b(tell\s+me\s+the\s+reason|give\s+me\s+a\s+reason|i\s+need\s+to\s+know\s+why|i\s+must\s+know\s+the\s+reason|you\s+need\s+to\s+explain|that\s+is\s+not\s+enough)\b/i },
  { key:"ultimatum_reason", rx:/\b(if\s+you\s+don\'?t\s+tell\s+me|unless\s+you\s+tell\s+me|otherwise\s+i\s+will\s+(deny|refuse)|i\s+will\s+deny\s+(you\s+)?entry|you\s+cannot\s+(enter|go\s+on\s+base|go\s+inside)|no\s+details\s+no\s+entry)\b/i },

    // Appointment follow-ups (must be BEFORE "has_appointment")
    { key:"who_meeting", rx:/\b(?:with\s+whom\s+(?:do\s+you\s+have|have\s+you\s+got)\s+an?\s+(?:appointment|meeting)|with\s+who(?:m)?\s+(?:do\s+you\s+have|have\s+you\s+got)\s+an?\s+(?:appointment|meeting)|who(?:m)?\s+is\s+(?:your|the)\s+(?:appointment|meeting)\s+with|who\s+is\s+(?:your|the)\s+(?:appointment|meeting)\s+with|who\s+are\s+you\s+meeting(?:\s+with)?|who\s+are\s+you\s+(?:meeting|seeing)|who\s+do\s+you\s+have\s+an?\s+(?:appointment|meeting)\s+with)\b/i },
    { key:"time_meeting", rx:/\b(?:what\s+time\s+is\s+(?:your|the)\s+(?:appointment|meeting)|when\s+is\s+(?:your|the)\s+(?:appointment|meeting)|what\s+time\s+are\s+you\s+(?:expected|scheduled)|what\s+time\s+is\s+it)\b/i },
    { key:"about_meeting", rx:/\b(?:what\s+is\s+(?:your|the)\s+(?:appointment|meeting)\s+about|what\s+is\s+(?:your|the)\s+meeting\s+about|what\s+is\s+it\s+about|what\s+is\s+the\s+meeting\s+for|what\s+are\s+you\s+here\s+for|what\s+are\s+you\s+delivering)\b/i },

    { key:"press_for_answer", rx:/\b(?:answer\s+(?:my|the)\s+question|i\s+need\s+an\s+answer|you\s+(?:need|must)\s+answer|if\s+you\s+don'?t\s+answer|otherwise\s+i\s+will\s+deny\s+(?:your\s+)?entry|no\s+answer\s*,?\s*no\s+entry)\b/i },

    { key:"has_appointment", rx:/\b(?:do\s+you\s+have\s+(?:an?\s+)?(?:appointment|meeting)|have\s+you\s+got\s+(?:an?\s+)?(?:appointment|meeting)|is\s+your\s+visit\s+scheduled)\b/i },

    { key:"ask_id", rx:/\b(can\s+i\s+see\s+your\s+id|show\s+me\s+your\s+id|id\s+please|passport)\b/i },
    { key:"dob_q", rx:/\b(date\s+of\s+birth|dob|when\s+were\s+you\s+born)\b/i },
    { key:"nat_q", rx:/\b(nationality|what\s+is\s+your\s+nationality|where\s+are\s+you\s+from)\b/i },
    { key:"spell_last_name", rx:/\b(spell\s+(your\s+)?(last\s+name|surname)|how\s+do\s+you\s+spell)\b/i },
    { key:"return_id", rx:/\b(return\s+your\s+id|here\'?s\s+your\s+id\s+back)\b/i },
    { key:"we_search_you", rx:/\b(you\s+will\s+be\s+searched|we\s+will\s+search\s+you)\b/i },
    { key:"everyone_searched", rx:/\b(everyone\s+is\s+searched|routine\s+search)\b/i },
    { key:"due_threat", rx:/\b(heightened\s+security|increased\s+threat|security\s+reasons)\b/i },
    { key:"illegal_items", rx:/\b(any\s+illegal\s+items|anything\s+illegal|contraband|prohibited)\b/i },
    { key:"illegal_clarify", rx:/\b(weapons?|drugs?|alcohol|knife|gun)\b/i },
    { key:"go_person_search", rx:/\b(go\s+to\s+(the\s+)?person\s+search|person\s+search)\b/i },
  // Contact supervisor (opens 5W/H modal)
{ key:"contact_supervisor", rx:/\b(i\s*(will|'ll)\s*)?(contact|call|talk\s*to|speak\s*to|ask)\s+(my\s+)?supervisor\b/i },
{ key:"contact_supervisor", rx:/\b(supervisor\s+check|check\s+with\s+my\s+supervisor)\b/i },
];
