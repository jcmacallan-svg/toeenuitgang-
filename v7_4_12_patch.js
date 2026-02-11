
// v7.4.12 PATCH
(function(){
  console.info("Applying v7.4.12 bubble alignment + delay patch");

  if (typeof window.VISITOR_REPLY_DELAY_MS !== "undefined") {
    window.VISITOR_REPLY_DELAY_MS = 3000;
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll(".chatRow").forEach(row => {
      if (row.classList.contains("isVisitor")) {
        row.classList.add("left");
        row.classList.remove("right");
      }
      if (row.classList.contains("isStudent")) {
        row.classList.add("right");
        row.classList.remove("left");
      }
    });
  });

  const chat = document.querySelector(".chatContainer");
  if (chat) {
    observer.observe(chat, { childList: true, subtree: true });
    chat.style.display = "flex";
    chat.style.flexDirection = "column";
  }
})();
