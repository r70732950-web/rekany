// sw.js
// Version: v18 (Complete & Fixed)

importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// 1. ڕێکخستنی فایەربەیس
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 2. وەرگرتنی ئاگادارکردنەوەکان (Notifications) لە باکگراوند
messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Received background message:', payload);
    const data = payload.data;
    if (!data) return;

    const notificationTitle = data.title || 'Maten Store';
    const notificationOptions = {
        body: data.body || '',
        icon: data.image || '/images/icons/icon-192x192.png',
        badge: '/images/icons/badge-72x72.png',
        tag: 'maten-notification',
        data: { url: data.url || '/' }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 3. کلیک کردن لەسەر ئاگادارکردنەوە
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    let targetUrl = event.notification.data?.url || '/';
    // دڵنیابوونەوە لەوەی URLـەکە تەواوە
    const fullUrl = new URL(targetUrl, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // ئەگەر پەڕەکە کراوەتەوە، تەنها فوکەس دەخاتە سەری
            for (let client of windowClients) {
                if (client.url === fullUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // ئەگەر نەکرابۆوە، دەیکاتەوە
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

// -----------------------------------------------------------------
// [ بەشی کاشکردن و ئۆفلاین - بەهێزکراو ]
// -----------------------------------------------------------------

const CACHE_NAME = 'maten-store-v18-complete';

// لیستی ئەو فایلانەی پێویستە هەبن بۆ ئەوەی ئەپەکە بێ ئینتەرنێت کار بکات
const FILES_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app-setup.js',
    './app-core.js',
    './app-ui.js',
    './categories.js',
    './products.js',
    './cart.js',
    './home.js',
    './chat.js',
    './admin.js',
    './manifest.json',
    // دڵنیابە ئەم وێنانە بوونیان هەیە، ئەگەر نەبن کێشە نییە (Promise.allSettled) ڕێگری لە وەستان دەکات
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png'
];

// قۆناغی یەکەم: دابەزاندن (Install)
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    // لابردنی چاوەڕوانی بۆ ئەوەی خێرا کار بکات
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // ئەمە زۆر گرنگە: Promise.allSettled بەکاردێنین
            // واتە ئەگەر یەک فایل هەڵەی تێدا بێت، ئەپەکە ناوەستێت و فایلەکانی تر کاش دەکات
            return Promise.allSettled(
                FILES_TO_CACHE.map(url => 
                    cache.add(url).catch(err => console.warn(`[SW] Failed to cache file: ${url}`, err))
                )
            );
        })
    );
});

// قۆناغی دووەم: چالاککردن (Activate) - سڕینەوەی کاشە کۆنەکان
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});

// قۆناغی سێیەم: وەڵامدانەوەی داواکارییەکان (Fetch)
self.addEventListener('fetch', (event) => {
    // تەنها داواکارییەکانی GET کاش دەکەین
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // ستراتیژی ١: Network First (بۆ داتای Firebase/API)
    // هەمیشە هەوڵدەدات نوێترین داتا بهێنێت، ئەگەر ئینتەرنێت نەبوو، دەچێتە سەر کاش
    if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('googleapis.com')) {
         event.respondWith(
            fetch(event.request)
                .then(response => {
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // ستراتیژی ٢: Stale-While-Revalidate (بۆ فایلەکان: HTML, JS, CSS)
    // یەکسەر لە کاش نیشانی دەدات (بۆ خێرایی)، وە لە باکگراوند نوێی دەکاتەوە
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // ئەگەر فایلەکە بە سەرکەوتوویی هات، کاشەکە نوێ دەکەینەوە
                if(networkResponse && networkResponse.status === 200) {
                     const resClone = networkResponse.clone();
                     caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
                }
                return networkResponse;
            }).catch(() => {
                // ئەگەر ئینتەرنێت نەبوو، هیچ ناکەین (کاشەکە بەسە)
            });

            // ئەگەر لە کاش هەبوو، بیگەڕێنەوە. ئەگەر نا، چاوەڕێی ئینتەرنێت بە.
            return cachedResponse || fetchPromise;
        })
    );
});
