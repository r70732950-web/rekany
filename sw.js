// sw.js - Final Professional Version

const CACHE_NAME = 'maten-store-cache-v5'; // گرنگ: ڤێرژنەکە نوێ کرایەوە

// فایلە بنەڕەتییەکانی ئەپەکە + پەڕەی ئۆفلاین
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/offline.html', // زیادکرا بۆ پیشاندانی لەکاتی پێویست
    '/images/icons/icon-512x512.png'
];

// 1. Install Event: کاشکردنی فایلە بنەڕەتییەکان
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// 2. Activate Event: پاککردنەوەی کاشی کۆن
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: ستراتیژی زیرەک بۆ مامەڵەکردن لەگەڵ داواکارییەکان
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // گرنگترین گۆڕانکاری: ئەگەر داواکارییەکە بۆ سێرڤەرەکانی گووگڵ بوو (وەک فایەرستۆر)، دەستی لێ مەدە!
    if (url.origin.includes('googleapis.com')) {
        return; // با فایەربەیس خۆی کاری خۆی بکات
    }

    // ستراتیژی Stale-While-Revalidate بۆ فایلەکانی تر
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => {
                    // ئەگەر بەکارهێنەر ئۆفلاین بوو و هەوڵی دا بچێتە لاپەڕەیەکی نوێ
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                });
                return cachedResponse || fetchPromise;
            });
        })
    );
});


// 4. Push Notifications & Message Events (وەک خۆی)
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'Tiştekî Nû', body: 'Agahdariyek ji Maten Store.', icon: '/images/icons/icon-192x192.png' };
    try {
        data = event.data.json();
    } catch (e) { console.log('Push data is not JSON.'); }
    
    const options = {
        body: data.body,
        icon: data.icon || '/images/icons/icon-192x192.png',
        badge: '/images/icons/badge-72x72.png',
        data: { url: self.location.origin },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});

self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
