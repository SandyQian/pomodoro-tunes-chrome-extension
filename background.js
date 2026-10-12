// Pomodoro Tunes - background service worker
// Keeps two tabs open (work playlist, break playlist). On every switch it
// pauses one and plays the other, so each playlist keeps its place.

const DEFAULT_SETTINGS = {
  workUrl: "",
  breakUrl: "",
  workMin: 25,
  breakMin: 5,
  notify: true,
  sound: "chime",
  volume: 0.5
};

const DEFAULT_STATE = {
  running: false,
  phase: "work", // "work" | "break"
  endTime: 0,
  round: 1,
  tabs: { work: null, break: null }
};

const PHASE_ALARM = "phase-end";
const TICK_ALARM = "badge-tick";
const other = (phase) => (phase === "work" ? "break" : "work");

async function load() {
  const d = await chrome.storage.local.get(["settings", "state"]);
  const state = { ...DEFAULT_STATE, ...(d.state || {}) };
  state.tabs = { ...DEFAULT_STATE.tabs, ...(state.tabs || {}) };
  return { settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) }, state };
}

const saveState = (state) => chrome.storage.local.set({ state });

function isSupported(url) {
  try {
    const h = new URL(url).hostname;
    return /(^|\.)(youtube\.com|youtu\.be|bilibili\.com)$/.test(h);
  } catch {
    return false;
  }
}

async function tabAlive(id) {
  if (id == null) return false;
  try {
    await chrome.tabs.get(id);
    return true;
  } catch {
    return false;
  }
}

// Make sure the tab for a phase exists. Reuses a tab you already have open on
// the same link; otherwise opens a new one. Returns true if it had to open one.
async function ensureTab(state, settings, phase, foreground) {
  if (await tabAlive(state.tabs[phase])) return false;
  const url = settings[phase + "Url"];
  const taken = state.tabs[other(phase)];
  const all = await chrome.tabs.query({});
  const match = all.find((t) => t.id !== taken && t.url && (t.url === url || t.url.startsWith(url)));
  if (match) {
    state.tabs[phase] = match.id;
    return false;
  }
  const tab = await chrome.tabs.create({ url, active: foreground });
  state.tabs[phase] = tab.id;
  return true;
}

// Play or pause the video in a tab. Keeps trying for a few seconds because
// the player may still be loading (or may autoplay when it should stay quiet).
async function setPlaying(tabId, play) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [play],
      func: (play) => {
        clearInterval(window.__pomodoroTunesTimer);
        let tries = 0;
        const apply = () => {
          const v = document.querySelector("video");
          if (v) {
            if (play && v.paused) v.play().catch(() => {});
            if (!play && !v.paused) v.pause();
          }
          if (++tries >= 16) clearInterval(window.__pomodoroTunesTimer);
        };
        apply();
        window.__pomodoroTunesTimer = setInterval(apply, 500);
      }
    });
  } catch {
    // Tab closed or page not scriptable.
  }
}

async function beginPhase(state, settings, phase) {
  state.phase = phase;
  state.running = true;
  state.endTime = Date.now() + settings[phase + "Min"] * 60000;

  // If the tab was closed in the meantime, reopen it in front so it is allowed to play.
  await ensureTab(state, settings, phase, true);
  await saveState(state);

  await setPlaying(state.tabs[other(phase)], false);
  await setPlaying(state.tabs[phase], true);

  await chrome.alarms.clear(PHASE_ALARM);
  chrome.alarms.create(PHASE_ALARM, { when: state.endTime });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  updateBadge(state);
}

async function playSwitchSound(settings) {
  if (!settings.sound || settings.sound === "none") return;
  try {
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play a short sound when the timer switches between work and break."
      });
    }
    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "play-sound",
      sound: settings.sound,
      volume: settings.volume
    });
  } catch (e) {
    console.warn("Could not play switch sound", e);
  }
}

async function switchPhase() {
  const { state, settings } = await load();
  if (!state.running) return;
  const next = other(state.phase);
  if (next === "work") state.round += 1;

  playSwitchSound(settings);
  await beginPhase(state, settings, next);

  if (settings.notify) {
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      silent: true, // our own sound plays instead of the system one
      title: next === "work" ? "Back to work" : "Break time",
      message:
        next === "work"
          ? `Session ${state.round}: ${settings.workMin} minutes of focus.`
          : `Step away for ${settings.breakMin} minutes.`
    });
  }
}

async function start() {
  const { state, settings } = await load();
  if (!settings.workUrl || !settings.breakUrl) return { error: "Add both playlist links first." };
  state.round = 1;
  // Open the break tab first, then the work tab, both in front for a moment:
  // Chrome holds back playback in tabs that have never been shown.
  await ensureTab(state, settings, "break", true);
  await ensureTab(state, settings, "work", true);
  await beginPhase(state, settings, "work");
  return { ok: true };
}

async function stop() {
  const { state } = await load();
  await setPlaying(state.tabs.work, false);
  await setPlaying(state.tabs.break, false);
  state.running = false;
  state.endTime = 0;
  await saveState(state);
  await chrome.alarms.clear(PHASE_ALARM);
  await chrome.alarms.clear(TICK_ALARM);
  chrome.action.setBadgeText({ text: "" });
  return { ok: true };
}

function updateBadge(state) {
  if (!state.running) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const mins = Math.max(0, Math.ceil((state.endTime - Date.now()) / 60000));
  chrome.action.setBadgeText({ text: String(mins) });
  chrome.action.setBadgeBackgroundColor({ color: state.phase === "work" ? "#C8321F" : "#2F7D5B" });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PHASE_ALARM) {
    await switchPhase();
  } else if (alarm.name === TICK_ALARM) {
    const { state } = await load();
    updateBadge(state);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const actions = { start, stop, skip: async () => (await switchPhase(), { ok: true }) };
  const fn = actions[msg && msg.type];
  if (!fn) return false;
  fn().then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e) }));
  return true; // async response
});

// When one of the two tabs finishes loading, put it in the right state:
// the current phase's tab plays, the other stays paused.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete") return;
  const { state } = await load();
  if (!state.running || !isSupported(tab.url)) return;
  if (tabId === state.tabs[state.phase]) await setPlaying(tabId, true);
  else if (tabId === state.tabs[other(state.phase)]) await setPlaying(tabId, false);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { state } = await load();
  let changed = false;
  for (const phase of ["work", "break"]) {
    if (state.tabs[phase] === tabId) {
      state.tabs[phase] = null; // reopened when that phase next starts
      changed = true;
    }
  }
  if (changed) await saveState(state);
});

// Timers do not survive a browser restart, so start clean.
chrome.runtime.onStartup.addListener(async () => {
  const { state } = await load();
  state.running = false;
  state.endTime = 0;
  state.tabs = { work: null, break: null };
  await saveState(state);
  chrome.action.setBadgeText({ text: "" });
});
