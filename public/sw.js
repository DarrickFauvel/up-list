/**
 * UpList Service Worker
 *
 * Cache strategy:
 *   App shell (HTML, CSS, JS)  → Cache-first, versioned
 *   API GET requests           → Network-first, fallback to cache
 *   Images                     → Cache-first
 *   SSE / POST / publish       → Network-only
 *
 * Background Sync:
 *   Offline drafts created in IndexedDB are synced via the
 *   'up-list-sync' BackgroundSync tag → POST /sync/batch
 */

const CACHE_NAME    = 'uplist-v1';
const SHELL_ASSETS  = [
  '/',
  '/dashboard',
  '/css/reset.css',
  '/css/base.css',
  '/css/components.css',
  '/app.js',
  '/components/up-camera.js',
  '/components/up-draft-field.js',
  '/components/up-item-card.js',
  '/components/up-publish-btn.js',
  '/components/up-toast.js',
  '/components/up-modal.js',
  '/manifest.webmanifest',
];

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-only: SSE, mutations, external resources
  if (
    request.method !== 'GET' ||
    url.pathname.includes('/generate') ||
    url.pathname.includes('/publish') ||
    url.origin !== self.location.origin
  ) {
    return; // fall through to network
  }

  // Images — cache-first
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell assets — cache-first
  if (SHELL_ASSETS.some(a => url.pathname === a)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API reads & pages — network-first
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === 'up-list-sync') {
    event.waitUntil(syncPendingItems());
  }
});

async function syncPendingItems() {
  // Read pending items from IndexedDB
  const pending = await readPendingFromIDB();
  if (!pending.length) return;

  const response = await fetch('/sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: pending }),
  });

  if (!response.ok) throw new Error('Sync failed');

  const { synced } = await response.json();
  await clearSyncedFromIDB(synced.map(s => s.localId));
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('uplist', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('pending-sync', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function readPendingFromIDB() {
  const db    = await openIDB();
  const tx    = db.transaction('pending-sync', 'readonly');
  const store = tx.objectStore('pending-sync');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function clearSyncedFromIDB(ids) {
  const db    = await openIDB();
  const tx    = db.transaction('pending-sync', 'readwrite');
  const store = tx.objectStore('pending-sync');
  await Promise.all(ids.map(id => new Promise((res, rej) => {
    const req = store.delete(id);
    req.onsuccess = res;
    req.onerror   = rej;
  })));
}
