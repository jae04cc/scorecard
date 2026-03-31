// Scorecard Service Worker
// Strategy:
//  - Navigation requests: network-first with offline fallback
//  - API GET requests: network-first (no caching — data must be fresh)
//  - API mutations (POST/PUT/PATCH/DELETE to /api/sessions/*/rounds): queue when offline
//  - Static assets (_next/static): cache-first

const CACHE = "scorecard-v2";
const OFFLINE_PAGE = "/offline.html";

// ── Install: cache offline fallback page ───────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Background sync queue for offline round submissions ───────────────────
const SYNC_TAG = "round-queue";
const DB_NAME = "scorecard-sw";
const STORE = "pending-requests";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueRequest(request) {
  const body = await request.text();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({
      url: request.url,
      method: request.method,
      body,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const all = await new Promise((res) => {
    const req = store.getAll();
    const keys = store.getAllKeys();
    let items, itemKeys;
    req.onsuccess = () => { items = req.result; if (itemKeys) res({ items, keys: itemKeys }); };
    keys.onsuccess = () => { itemKeys = keys.result; if (items) res({ items, keys: itemKeys }); };
  });

  for (let i = 0; i < all.items.length; i++) {
    const item = all.items[i];
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      // Remove from queue on success
      const delTx = db.transaction(STORE, "readwrite");
      delTx.objectStore(STORE).delete(all.keys[i]);
    } catch {
      // Leave in queue — will retry on next sync
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue());
  }
});

// ── Fetch handler ──────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Static assets: cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Round POST/PUT mutations: queue when offline
  const isRoundMutation =
    (request.method === "POST" || request.method === "PUT") &&
    url.pathname.match(/^\/api\/sessions\/[^/]+\/rounds/);

  if (isRoundMutation) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await queueRequest(request.clone());
        // Try to register background sync
        if (self.registration.sync) {
          await self.registration.sync.register(SYNC_TAG);
        }
        return new Response(
          JSON.stringify({ queued: true, offline: true }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Navigation: network-first, fall back to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_PAGE).then((r) => r ?? new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Everything else: network only
});
