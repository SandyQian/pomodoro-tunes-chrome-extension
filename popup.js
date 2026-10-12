const $ = (id) => document.getElementById(id);
const DEFAULTS = { workUrl: "", breakUrl: "", workMin: 25, breakMin: 5, notify: true, sound: "chime", volume: 0.5 };
const FIELDS = ["workUrl", "breakUrl", "workMin", "breakMin", "notify", "sound", "volume"];

let settings = { ...DEFAULTS };
let state = { running: false, phase: "work", endTime: 0, round: 1 };

function readForm() {
  const mins = (id) => {
    const n = Math.round(Number($(id).value));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 240) : DEFAULTS[id];
  };
  return {
    workUrl: $("workUrl").value.trim(),
    breakUrl: $("breakUrl").value.trim(),
    workMin: mins("workMin"),
    breakMin: mins("breakMin"),
    notify: $("notify").checked,
    sound: $("sound").value,
    volume: Number($("volume").value)
  };
}

function saveForm() {
  settings = readForm();
  return chrome.storage.local.set({ settings });
}

function validUrl(s) {
  try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; }
}

function showError(text) {
  $("error").textContent = text || "";
  $("error").hidden = !text;
}

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

function render() {
  const running = state.running;
  document.body.dataset.phase = running ? state.phase : "idle";
  $("start").hidden = running;
  $("skip").hidden = !running;
  $("stop").hidden = !running;

  if (!running) {
    $("phase").textContent = "Ready when you are";
    $("clock").textContent = fmt(readForm().workMin * 60000);
    $("bar").style.width = "0";
    $("round").textContent = "";
    return;
  }
  const total = settings[state.phase + "Min"] * 60000;
  const left = state.endTime - Date.now();
  $("phase").textContent = state.phase === "work" ? "Working" : "On a break";
  $("clock").textContent = fmt(left);
  $("bar").style.width = Math.min(100, Math.max(0, (1 - left / total) * 100)) + "%";
  $("round").textContent = "Session " + state.round;
  $("skip").textContent = state.phase === "work" ? "Skip to break" : "Skip to work";
}

async function send(type) {
  const res = await chrome.runtime.sendMessage({ type });
  if (res && res.error) showError(res.error);
}

$("start").addEventListener("click", async () => {
  const s = readForm();
  if (!validUrl(s.workUrl)) return showError("Paste a full link (starting with https://) for the work playlist.");
  if (!validUrl(s.breakUrl)) return showError("Paste a full link (starting with https://) for the break playlist.");
  showError("");
  await saveForm();
  send("start");
});
$("skip").addEventListener("click", () => send("skip"));
$("stop").addEventListener("click", () => send("stop"));

const preview = () => playSound($("sound").value, Number($("volume").value));
$("preview").addEventListener("click", preview);
$("sound").addEventListener("change", preview);
$("volume").addEventListener("change", preview);

FIELDS.forEach((id) => $(id).addEventListener("change", () => { saveForm(); render(); }));

chrome.storage.onChanged.addListener((changes) => {
  if (changes.state) { state = { ...state, ...changes.state.newValue }; render(); }
});

(async () => {
  const d = await chrome.storage.local.get(["settings", "state"]);
  settings = { ...DEFAULTS, ...(d.settings || {}) };
  state = { ...state, ...(d.state || {}) };
  for (const [value, label] of Object.entries(SOUND_NAMES)) {
    $("sound").add(new Option(label, value));
  }
  FIELDS.forEach((id) => {
    if ($(id).type === "checkbox") $(id).checked = settings[id];
    else $(id).value = settings[id];
  });
  render();
  setInterval(render, 500);
})();
