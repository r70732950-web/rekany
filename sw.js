// sw.js - Final Corrected Version

// هەنگاوی ١: ناوی کاشەکە نوێ بکەرەوە بۆ ئەوەی گۆڕانکارییەکان جێبەجێ ببن
const CACHE_NAME = 'maten-store-cache-v6';

// فایلە بنەڕەتییەکانی ئەپەکە کە پێویستن بۆ کارکردنی سەرەتایی
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/offline.html', // پەڕەیەک بۆ پیشاندان کاتێک بەکارهێنەر بە تەواوی ئۆفلاینە
    '/images/icons/icon-512x512.png'
];

// Event 1: Install - کاشکردنی فایلە سەرەکییەکان
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting()) // ڕاستەوخۆ Service Workerـە نوێیەکە چالاک دەکات
    );
});

// Event 2: Activate - پاککردنەوەی کاشی کۆن
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // ئەگەر ناوی کاشەکە جیاواز بوو لە ناوی نوێ، بیسڕەوە
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // کۆنترۆڵی هەموو پەڕە کراوەکان دەکات
    );
});

// Event 3: Fetch - ستراتیجی زیرەک بۆ وەڵامدانەوەی داواکارییەکان
self.addEventListener('fetch', event => {
    // تەنها داواکاری GET مامەڵەی لەگەڵ دەکەین
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // ستراتیجی یەکەم: بۆ داتای فایەربەیس (Stale-While-Revalidate)
    // ئەمە وا دەکات داتاکان یەکسەر لە کاشەوە پیشان بدرێن و لە پشتەوە نوێ ببنەوە
    if (url.origin.includes('googleapis.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                             cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
    
    // ستراتیجی دووەم: بۆ کردنەوەی پەڕەکانی ئەپەکە (Network First, fallback to Cache)
    // ئەمە وا دەکات هەمیشە نوێترین ڤێرژنی ئەپەکەت ببینرێت ئەگەر ئۆنلاین بیت
    else if (event.request.mode === 'navigate') {
         event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // ئەگەر ئۆفلاین بوو، پەڕە سەرەکییەکە لە کاشەوە بهێنە
                    return caches.match('/');
                })
        );
    }

    // ستراتیجی سێیەم: بۆ فایلەکانی تر وەک وێنە و فۆنت (Cache First)
    // ئەمە وا دەکات وێنە و فایلەکان زۆر بە خێرایی لە کاشەوە بارببن
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                // ئەگەر لە کاشدا هەبوو، بیگەڕێنەرەوە
                if (response) {
                    return response;
                }
                // ئەگەر نا، لە نێتوۆرکەوە بیهێنە و لە کاشدا هەڵیبگرە
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                });
            })
        );
    }
});


// Event 4: Push - بۆ وەرگرتنی ئاگەدارکردنەوە (Push Notifications)
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'ئاگاداری نوێ', body: 'ئاگادارییەک لە فرۆشگای MATEN.', icon: '/images/icons/icon-192x192.png' };
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

// Event 5: Notification Click - کاتێک بەکارهێنەر کلیک لە ئاگەدارییەکە دەکات
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});

// Event 6: Message - بۆ نوێکردنەوەی Service Worker کاتێک ڤێرژنی نوێ دێت
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});