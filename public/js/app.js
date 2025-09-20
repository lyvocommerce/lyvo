// Access Telegram WebApp object
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) {}

const user = tg?.initDataUnsafe?.user || null;

async function sendToBackend(payload) {
  try {
    const res = await fetch("https://lyvo-be.onrender.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    // Покажем внутри Telegram всплывающее окно
    tg?.showPopup({ title: "OK", message: "Event sent to backend", buttons:[{type:"close"}] });
    console.log("Backend response:", data);
  } catch (e) {
    tg?.showPopup({ title: "Error", message: String(e), buttons:[{type:"close"}] });
    console.error(e);
  }
}

document.getElementById("send")?.addEventListener("click", () => {
  const payload = {
    event: "demo_click",
    user_id: user?.id || null,
    first_name: user?.first_name || null,
    lang: (user?.language_code || "en").toLowerCase(),
    ts: Date.now(),
  };
  sendToBackend(payload);
});

// Кнопка «Open external link» оставляем как есть
document.getElementById("open")?.addEventListener("click", () => {
  try { tg?.openLink("https://lyvo.vercel.app", { try_instant_view: false }); }
  catch { window.open("https://lyvo.vercel.app", "_blank"); }
});