// Access Telegram WebApp object
const tg = window.Telegram?.WebApp;

// Expand WebView to full height (inside Telegram)
try {
  tg?.expand();
} catch (_) {
  /* noop */
}

// Get user info and language safely
const user = tg?.initDataUnsafe?.user || null;
const lang = (user?.language_code || "en").toLowerCase().startsWith("en") ? "en" : "en"; // keep English as default

// Simple greeting text (only English for MVP)
const greeting = (name) => `Hi ${name}! Mini App is working. (lang: en)`;

// Set greeting text
const helloEl = document.getElementById("hello");
helloEl.textContent = greeting(user?.first_name || "");

// Buttons
const sendBtn = document.getElementById("send");
const openBtn = document.getElementById("open");

// Send test event to bot (bot receives via WEB_APP_DATA)
sendBtn?.addEventListener("click", () => {
  try {
    tg?.sendData(JSON.stringify({ event: "demo_click", lang: "en" }));
    tg?.showPopup({
      title: "Sent",
      message: "Event sent to the bot",
      buttons: [{ type: "close" }],
    });
  } catch (e) {
    console.error("sendData error:", e);
  }
});

// Open external link
openBtn?.addEventListener("click", () => {
  try {
    tg?.openLink("https://lyvo.vercel.app", { try_instant_view: false });
  } catch (e) {
    // If not inside Telegram, open in new tab
    window.open("https://lyvo.vercel.app", "_blank");
  }
});