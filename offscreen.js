// The background worker cannot play audio itself, so it asks this hidden page to.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.target === "offscreen" && msg.type === "play-sound") {
    playSound(msg.sound, msg.volume);
  }
});
