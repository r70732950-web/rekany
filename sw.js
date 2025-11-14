// sw.js
// وەشانی: v12 (Fixed Clone Error)

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
// بەشی کاشکردن (Offline Mode)
// -----------------------------------------------------------------

// [ 💡 ] وەشانم کرد بە v12 بۆ ئەوەی دڵنیابین گۆڕانکارییەکان وەردەگرێت
const CACHE_NAME = 'maten-store-v12-classic';

const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app-setup.js',
    '/app-core.js',   
    '/app-ui.js',     
    '/home.js',       
    '/chat.js',       
    '/admin.js',      
    '/manifest.json',
    '/offline.html',  
    '/images/icons/icon-512x512.png' 
];

// Install
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL_URLS);
        })
    );
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);

    // Network First (API & Firestore)
    if (url.origin.includes('googleapis.com') || url.origin.includes('firestore')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache First (Files) - بەشی چاککراو
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if(networkResponse && networkResponse.status === 200) {
                    // [ ✅ چاککراوە ] : کۆپیکردن پێش ئەوەی کاش بکرێتەوە
                    const responseToCache = networkResponse.clone();
                    
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {});

            return cachedResponse || fetchPromise;
        })
    );
});
