// sw.js - Final Corrected Version

// هەنگاوی ١: ناوی کاشەکە نوێ بکەرەوە بۆ ئەوەی گۆڕانکارییەکان جێبەجێ ببن
const CACHE_NAME = 'maten-store-cache-v7'; // *** گۆڕدرا بۆ v7 ***

// فایلە بنەڕەتییەکانی ئەپەکە کە پێویستن بۆ کارکردنی سەرەتایی
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/styles.css',         // *** زیادکرا ***
    '/app-setup.js',       // *** زیادکرا ***
    '/app-logic.js',       // *** زیادکرا ***
    //'/admin.js', // (ئارەزوومەندانە) ئەگەر پێویست بوو بۆ کارکردنی سەرەتایی زیادبکرێت
    '/manifest.json',
    '/offline.html',       // پەڕەیەک بۆ پیشاندان کاتێک بەکارهێنەر بە تەواوی ئۆفلاینە
    '/images/icons/icon-512x512.png' // یان ئایکۆنی سەرەکی
];

// Event 1: Install - کاشکردنی فایلە سەرەکییەکان
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                // گرنگە دڵنیابین هەموو فایلەکان بە سەرکەوتوویی کاش دەبن
                return cache.addAll(APP_SHELL_URLS).catch(error => {
                    console.error('[Service Worker] Failed to cache app shell:', error);
                    // ڕێگە نادات Service Worker دامەزرێت ئەگەر هەڵەیەک هەبێت
                    throw error;
                });
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
    if (url.origin.includes('googleapis.com') || url.origin.includes('firestore.googleapis.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                             cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.warn('[Service Worker] Network request failed for API, serving stale cache if available:', event.request.url, error);
                        // ئەگەر cachedResponse هەبێت، لێرەدا دەگەڕێتەوە
                    });
                    // یەکسەر وەڵامی کاشکراو بگەڕێنەرەوە ئەگەر هەبێت، ئەگەر نا چاوەڕێی نێتوۆرک بکە
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
    // ستراتیجی دووەم: بۆ کردنەوەی پەڕەکانی ئەپەکە (Network First, fallback to Cache/Offline page)
    else if (event.request.mode === 'navigate') {
         event.respondWith(
             fetch(event.request)
                 .then(response => {
                     // ئەگەر سەرکەوتوو بوو، بیگەرێنەرەوە
                     return response;
                 })
                 .catch(() => {
                     // ئەگەر سەرنەکەوت (ئۆفلاین بوو)، هەوڵبدە لە کاشەوە پەڕەی سەرەکی بهێنیت
                     return caches.match('/').then(cachedResponse => {
                         // ئەگەر پەڕەی سەرەکیش لە کاشدا نەبوو، پەڕەی ئۆفلاین پیشان بدە
                         return cachedResponse || caches.match('/offline.html');
                     });
                 })
         );
    }
    // ستراتیجی سێیەم: بۆ فایلەکانی تر وەک وێنە و فۆنت و فایلە بنچینەییەکان (Cache First)
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                // ئەگەر لە کاشدا هەبوو، بیگەڕێنەرەوە
                if (response) {
                    return response;
                }
                // ئەگەر نا، لە نێتوۆرکەوە بیهێنە و لە کاشدا هەڵیبگرە
                return fetch(event.request).then(networkResponse => {
                    // دڵنیابە وەڵامەکە دروستە پێش کاشکردنی
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                         return networkResponse; // وەڵامی هەڵە یان نادیار کاش مەکە
                    }
                    // وەڵامەکە کۆپی بکە چونکە تەنها یەکجار دەخوێنرێتەوە
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(error => {
                     console.warn('[Service Worker] Fetch failed for asset, possibly offline:', event.request.url, error);
                     // لێرەدا دەتوانیت وێنەیەکی Placeholder یان شتێکی تر بگەڕێنیتەوە ئەگەر پێویست بوو
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
        badge: '/images/icons/badge-72x72.png', // دڵنیابە ئەم فایلە هەیە
        data: { url: self.location.origin }, // URLی بنچینەیی ئەپەکە
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Event 5: Notification Click - کاتێک بەکارهێنەر کلیک لە ئاگەدارییەکە دەکات
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    // کردنەوەی پەنجەرەی ئەپەکە یان فۆکەس کردنی ئەگەر کراوە بێت
    event.waitUntil(clients.matchAll({
        type: "window"
    }).then(clientList => {
        for (const client of clientList) {
            // ئەگەر پەنجەرەیەک کراوە بوو، فۆکەسی بکە
            if (client.url === '/' && 'focus' in client)
                return client.focus();
        }
        // ئەگەر هیچ پەنجەرەیەک کراوە نەبوو، یەکێکی نوێ بکەرەوە
        if (clients.openWindow)
            return clients.openWindow(event.notification.data.url || '/');
    }));
});

// Event 6: Message - بۆ نوێکردنەوەی Service Worker کاتێک ڤێرژنی نوێ دێت
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});