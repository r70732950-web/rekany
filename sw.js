// sw.js - Final Corrected Version

// هەنگاوی گرنگ: ناوی کاشەکە بگۆڕە بۆ ئەوەی نوێبوونەوەکە جێبەجێ بێت
const CACHE_NAME = 'maten-store-cache-v7';

// ئەو فایلانەی کە بۆ کارکردنی ئەپەکە پێویستن
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/admin.js', // گرنگە ئەم فایلەش کاش بکرێت
    '/manifest.json',
    '/images/icons/icon-512x512.png'
];

// Event 1: Install - کاشکردنی فایلە سەرەکییەکان
self.addEventListener('install', event => {
    console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting()) // ڕاستەوخۆ Service Workerـە نوێیەکە چالاک دەکات
    );
});

// Event 2: Activate - پاککردنەوەی کاشی کۆن
self.addEventListener('activate', event => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Event 3: Fetch - ستراتیجی زیرەک بۆ وەڵامدانەوەی داواکارییەکان
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // ستراتیجی یەکەم: "Network First" بۆ فایلە سەرەکییەکانی ئەپەکە
    // ئەمە دڵنیایی دەدات کە هەمیشە نوێترین ڤێرژنی کۆدەکانت بەکاردێت
    if (APP_SHELL_URLS.includes(url.pathname) || event.request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(networkResponse => {
                        // ئەگەر وەڵام لە نێتوۆرکەوە هات، کاشەکە نوێ بکەرەوە
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // ئەگەر نێتوۆرک کێشەی هەبوو (ئۆفلاین بوویت)، لە کاشەوە بیهێنە
                        return cache.match(event.request);
                    });
            })
        );
    }
    // ستراتیجی دووەم: "Cache First" بۆ فایلەکانی تر (وەک وێنە، فۆنت، API)
    // ئەمە وا دەکات ئەپەکە خێراتر بێت
    else if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(response => {
                // ئەگەر لە کاشدا هەبوو، یەکسەر بیگەڕێنەرەوە
                if (response) {
                    return response;
                }
                // ئەگەر نا، لە نێتوۆرکەوە داوای بکە و لە کاشدا هەڵیبگرە
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
