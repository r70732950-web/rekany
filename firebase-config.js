import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Enable Firestore persistence
enableIndexedDbPersistence(db)
    .then(() => console.log("Firestore offline persistence enabled successfully."))
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore Persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore Persistence failed: Browser not supported.');
        }
        console.error("Error enabling persistence, running online mode only:", err);
    });

export { app, analytics, auth, db, messaging };