// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";

// زانیارییەکانی پڕۆژەکەت لە فایەربەیس
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// دەستپێکردنی فایەربەیس
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// چالاککردنی دۆخی ئۆفلاین (بۆ ئەوەی ئەپەکە بێ ئینتەرنێتیش ئیش بکات)
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore Persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore Persistence failed: Browser not supported.');
        }
    });

// ناردنی خزمەتگوزارییەکان بۆ فایلەکانی تر
// ئەمە گرنگترین بەشە، وا دەکات بتوانین لە فایلەکانی تردا db و auth بەکاربهێنین
export { auth, db, messaging };