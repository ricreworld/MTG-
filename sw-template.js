// Mana Steps offline support (service worker). Generated at build time by vite.config.ts.
// - Install: saves a copy of every app file, so the installed app works without internet.
// - Updates never reload the page mid-lesson: a new version waits until the app is fully closed.
const CACHE = "mana-steps-__VERSION__";
const FILES = __FILES__;
// Match saved files by address only (some servers add "Vary" headers that would block a match).
const MATCH = { ignoreVary: true, ignoreSearch: true };

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mana-steps-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    // Pages: try the network first (fresh content), fall back to the saved copy when offline.
    event.respondWith(fetch(request).catch(() => caches.match("./index.html", MATCH).then((hit) => hit || caches.match("./", MATCH))));
    return;
  }
  // Files: the saved copy first (fast, works offline), the network if it isn't saved.
  event.respondWith(caches.match(request, MATCH).then((hit) => hit || fetch(request)));
});
