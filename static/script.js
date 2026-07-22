const themeBtn = document.getElementById("themeBtn");
const clearBtn = document.getElementById("clearBtn");
const form = document.getElementById("form");
const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const scrollBtn = document.getElementById("scrollBtn");

// ---------- Theme Logic ----------
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  document.body.classList.toggle("light", mode === "light");
  if (themeBtn) themeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}

const savedTheme = localStorage.getItem("albert-theme") || "dark";
applyTheme(savedTheme);

if (themeBtn) {
  themeBtn.onclick = () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("albert-theme", next);
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    chat.innerHTML = "";
    addBotMessage("What's the plan?", "ALBERT");
  };
}

// ---------- Helpers ----------
function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function isNearBottom() {
  return chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
}

function scrollToBottom(smooth = true) {
  chat.scrollTo({ top: chat.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function addUserMessage(text) {
  const row = document.createElement("div");
  row.className = "user-row";
  row.innerHTML = `
    <div class="avatar">YOU</div>
    <div class="bubble-wrap">
      <div class="user">${escapeHtml(text)}</div>
      <div class="meta">${timeNow()}</div>
    </div>
  `;
  chat.appendChild(row);
  scrollToBottom();
}

function addBotMessage(text, label = "ALBERT") {
  const row = document.createElement("div");
  row.className = "bot-row";
  row.innerHTML = `
    <div class="avatar">AL</div>
    <div class="bubble-wrap">
      <div class="bot">${escapeHtml(text)}</div>
      <div class="meta">${label} · ${timeNow()}</div>
    </div>
  `;
  chat.appendChild(row);
  scrollToBottom();
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "bot-row";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="avatar">JR</div>
    <div class="bot">Thinking...</div>
  `;
  chat.appendChild(row);
  scrollToBottom();
  return row;
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ---------- Audio Recording Logic ----------
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

if (micBtn) {
  micBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await sendAudioToBackend(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add("listening");
      } catch (err) {
        console.log("Mic access issue:", err);
      }
    } else {
      if (mediaRecorder) mediaRecorder.stop();
      isRecording = false;
      micBtn.classList.remove("listening");
    }
  });
}

async function sendAudioToBackend(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "voice.webm");

  const typingRow = addTypingIndicator();

  try {
    const res = await fetch("/voice", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    typingRow.remove();

    if (data.user_text) addUserMessage(data.user_text);
    if (data.reply) {
      addBotMessage(data.reply);
      speakText(data.reply);
    }
  } catch (err) {
    typingRow.remove();
    addBotMessage("Audio process karne mein issue aaya.");
  }
}

// ---------- Standard Chat Submit ----------
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";
    autoResize();

    sendBtn.disabled = true;
    const typingRow = addTypingIndicator();

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      typingRow.remove();
      addBotMessage(data.reply);
    } catch (err) {
      typingRow.remove();
      addBotMessage("Network issue.");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}

if (input) {
  input.addEventListener("input", autoResize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

if (chat && scrollBtn) {
  chat.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("show", !isNearBottom());
  });
  scrollBtn.addEventListener("click", () => scrollToBottom());
}

window.addEventListener("load", () => {
  if (input) input.focus();
});

// ---------- Mobile Keyboard Adjuster ----------
if (input) {
  input.addEventListener("focus", () => {
    requestAnimationFrame(() => scrollToBottom(false));
  });
}
// Ensure smooth focus handling when clicking input
if (input) {
  input.addEventListener("focus", () => {
    setTimeout(() => {
      scrollToBottom(true);
    }, 300);
  });
}