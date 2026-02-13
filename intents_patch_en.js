// intents_patch_en.js
// Modular intent list (EN) — loaded before app.js via boot.js
// NOTE: Keep specific intents BEFORE general ones to avoid shadowing.

(() => {
  "use strict";

  window.VEVA_INTENTS = [
    // -------------------------
    // Greeting / opening
    // -------------------------
    {
      key: "greet",
      rx: /(?:^|[\s,!.?])(hi|hello|hey|good\s*(morning|afternoon|evening))(?:$|[\s,!.?])/i
    },

    // -------------------------
    // "How can I help you?" opener
    // (Needed because app.js uses stage "help" -> expects help_open)
    // Put this early so it doesn't get shadowed by purpose/appointment patterns.
    // -------------------------
    {
      key: "help_open",
      rx: /(?:^|[\s,!.?])(?:how\s+can\s+i\s+help(?:\s+you(?:\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help|what\s+can\s+i\s+do\s+for\s+you|how\s+can\s+we\s+help)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // 5W set (training order)
    // 1) Who are you?
    // -------------------------
    {
      key: "ask_name",
      rx: /(?:^|[\s,!.?])(?:who\s+are\s+you|what(?:'s| is)\s+your\s+name|your\s+name\s*,?\s+please|may\s+i\s+have\s+your\s+name|identify\s+yourself)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // 2) What are you doing here?
    // -------------------------
    {
      key: "purpose",
      rx: /(?:^|[\s,!.?])(?:what\s+are\s+you\s+doing\s+here|why\s+are\s+you\s+here|reason\s+for\s+(?:your\s+)?visit|purpose\s+of\s+(?:your\s+)?visit|what\s+brings\s+you\s+here|what\s+is\s+the\s+purpose)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // 3) With whom do you have an appointment?
    // (Keep ABOVE has_appointment so it doesn't get captured as "appointment" only)
    // -------------------------
    {
      key: "who_meeting",
      rx: /(?:^|[\s,!.?])(?:with\s+whom\s+do\s+you\s+have\s+an?\s+appointment|who\s+is\s+(?:your\s+)?appointment\s+with|who\s+do\s+you\s+have\s+an?\s+appointment\s+with|who\s+are\s+you\s+(?:meeting|seeing)|who\s+will\s+you\s+meet)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // 4) What time is the appointment?
    // -------------------------
    {
      key: "time_meeting",
      rx: /(?:^|[\s,!.?])(?:what\s+time\s+is\s+(?:the\s+)?(?:appointment|meeting)|when\s+is\s+(?:the\s+)?(?:appointment|meeting)|what\s+time\s+are\s+you\s+expected|what\s+time\s+do\s+you\s+need\s+to\s+be\s+there)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // 5) What is the appointment about?
    // -------------------------
    {
      key: "about_meeting",
      rx: /(?:^|[\s,!.?])(?:what\s+is\s+(?:the\s+)?(?:appointment|meeting)\s+about|what\s+are\s+you\s+here\s+for\s+exactly|what\s+is\s+this\s+visit\s+about|what\s+are\s+you\s+delivering|what\s+is\s+the\s+purpose\s+of\s+the\s+appointment)(?:$|[\s,!.?])/i
    },

    // -------------------------
    // Appointment (general) — keep BELOW who_meeting/time/about
    // -------------------------
    {
      key: "has_appointment",
      rx: /(?:^|[\s,!.?])(?:do\s+you\s+have\s+an?\s+appointment|do\s+you\s+have\s+a\s+meeting|is\s+there\s+an?\s+appointment|is\s+your\s+visit\s+scheduled|are\s+you\s+expected)(?:$|[\s,!.?])/i
    }
  ];
})();
