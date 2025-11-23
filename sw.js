// sw.js
// وەشانی: v14 (Çareserkirina Arişeya Cache.put)

// 1. هێنانی کتێبخانەکانی فایەربەیس (Classic Mode)
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// 2. ڕێکخستنی فایەربەیس
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

// 3. گوێگرتن بۆ ئیشعار (Data-Only)
messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] ئیشعار گەیشت: ', payload);

    const data = payload.data;

    if (!data || !data.is_notification) {
        console.log("Not a notification payload.");
        return;
    }

    const notificationTitle = data.title || 'Maten Store';
    const notificationOptions = {
        body: data.body || '',
        icon: data.image || '/images/icons/icon-192x192.png',
        badge: '/images/icons/badge-72x72.png',
        tag: 'maten-notification',
        data: { 
            url: data.url || '/'
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 4. کاتێک کلیک لە ئیشعارەکە دەکرێت
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] کلیک لە ئیشعار کرا');
    event.notification.close();

    let targetUrl = '/';
    if (event.notification.data && event.notification.data.url) {
        targetUrl = event.notification.data.url;
    }
    
    const fullUrl = new URL(targetUrl, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url === fullUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

// -----------------------------------------------------------------
// [ 💡 بەشی کاشکردن - نوێکراوە 💡 ]
// -----------------------------------------------------------------

// [ 💡 گۆڕانکاری ] : ناڤێ کاشێ هاتە گوهارتن بۆ وەشانا نوو
const CACHE_NAME = 'maten-store-v14-swr-fix';

// [ 💡 گۆڕانکاری ] : '/' هاتە لادان ژ لیستێ
const APP_SHELL_URLS = [
    '/index.html', // '/' لادان
    '/styles.css',
    '/app-setup.js',
    '/app-core.js',   
    '/app-ui.js',     
    '/home.js',       
    '/chat.js',       
    '/admin.js',      
    '/manifest.json',
    '/offline.html',  // لاپەڕا ئۆفلاین
    '/images/icons/icon-512x512.png' 
];

// Install: کاشکرنا فایلێن سەرەکی
self.addEventListener('install', event => {
    console.log('[SW] Install - Caching App Shell');
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL_URLS);
        })
    );
});

// Activate: پاقژکرنا کاشێن کەڤن
self.addEventListener('activate', event => {
    console.log('[SW] Activate - Cleaning old caches');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // ئەگەر ناڤێ کاشێ نە مینا یێ نوو بیت، دێ هێتە ژێبرن
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // کۆنترۆلکرنا لاپەڕان
    );
});


// Fetch: بکارئینانا ستراتیژییا Stale-While-Revalidate
self.addEventListener('fetch', event => {
    // بتنێ داخازیێن GET کاش دکەین
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);

    // --- ستراتیژیا ١: Network First (بۆ API و Firestore) ---
    if (url.origin.includes('googleapis.com') || url.origin.includes('firestore')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // ئەگەر سەرکەفتی، کاشێ نوو بکە
                    if (response && response.status === 200) {
                        const resClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    }
                    return response;
                })
                .catch(() => {
                    // ئەگەر ئینتەرنێت نەبوو، ژ کاشێ بینە
                    return caches.match(event.request);
                })
        );
        return;
    }

    // --- ستراتیژیا ٢: Stale-While-Revalidate (بۆ هەمی فایلێن دی) ---
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                
                // (Revalidate) : داخازیێ بۆ ئینتەرنێتێ فرێکە
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // ئەگەر ب سەرکەفتی هات، کاشێ نوو بکە
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    // ئەگەر داخازییا ئینتەرنێتێ سەرنەکەفت (بۆ نموونە ئۆفلاین)
                    console.log('[SW] Fetch failed:', err);
                    // ئەگەر چ تشت د کاشێ دا نەبوو، لاپەڕا ئۆفلاین نیشان بدە
                    if (!cachedResponse) {
                        return caches.match('/offline.html');
                    }
                });

                // (Stale) : ئەگەر د کاشێ دا هەبوو، ئێک سەر بزڤرینە
                return cachedResponse || fetchPromise;
            });
        })
    );
});
