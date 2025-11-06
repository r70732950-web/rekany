// chat.js
// Ev pel logica ji bo piştrastkirina hejmara têlefonê (Firebase Phone Auth)
// û paşê logica bingehîn a chatê birêve dibe.
// ئەم فایلە لۆجیکی پشتڕاستکردنەوەی ژمارەی مۆبایل (Firebase Phone Auth)
// و دواتر لۆجیکی سەرەکی چات بەڕێوە دەبات.

// Em xizmetên bingehîn ên Firebase import dikin
// ئێمە خزمەتگوزارییە سەرەکییەکانی فایەربەیس هاوردە دەکەین
import { auth, db } from './app-setup.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Em van li ser 'window' tomar dikin da ku di navbera gavan de winda nebin
// ئێمە ئەمانە لەسەر 'window' پاشەکەوت دەکەین تا لە نێوان هەنگاوەکاندا ون نەبن
window.recaptchaVerifier = null;
window.confirmationResult = null;
// Em guhdarek (listener) a chatê ya çalak tomar dikin da ku em bikaribin wê rawestînin
// ئێمە گوێگری چاتی چالاک پاشەکەوت دەکەین بۆ ئەوەی بتوانین ڕایگرین
let currentChatListener = null; 

/**
 * reCAPTCHA Verifier amade dike.
 * Pêwîstî bi elementek <div> di index.html de bi IDya 'recaptcha-container' heye.
 * reCAPTCHA Verifier ئامادە دەکات.
 * پێویستی بە <div> элементێک هەیە لە index.html کە IDی 'recaptcha-container' بێت.
 */
export function initPhoneAuth() {
    try {
        // Em piştrast dikin ku konteynir tenê carekê tê çêkirin
        // دڵنیا دەبینەوە کە کۆنتەینەرەکە تەنها یەک جار دروست دەکرێت
        if (!document.getElementById('recaptcha-container')) {
            const recaptchaContainer = document.createElement('div');
            recaptchaContainer.id = 'recaptcha-container';
            recaptchaContainer.style.position = 'fixed';
            recaptchaContainer.style.bottom = '0';
            recaptchaContainer.style.right = '0';
            recaptchaContainer.style.zIndex = '-10'; // Bi tevahî veşêre (بەتەواوی بیشارەوە)
            document.body.appendChild(recaptchaContainer);
        }

        // Em reCAPTCHA nû çêdikin (یان ji nû ve çêdikin eger pirsgirêk hebe)
        // ئێمە reCAPTCHAـی نوێ دروست دەکەین (یان دووبارە دروستی دەکەینەوە ئەگەر کێشە هەبێت)
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear(); // Ya kevn paqij bike
        }

        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible', // reCAPTCHAya nedîtbar
            'callback': (response) => {
                // reCAPTCHA çareser bû, destûrê dide şandina SMSê.
                // reCAPTCHA چارەسەر بوو، ڕێگە بە ناردنی SMS دەدات.
                console.log("reCAPTCHA çareser bû.");
            },
            'expired-callback': () => {
                // Bersiv qediya... Ji nû ve biceribîne
                // وەڵامەکە بەسەرچوو... دووبارە هەوڵ بدەوە
                console.log("reCAPTCHA qediya, ji nû ve çêke.");
                initPhoneAuth(); // Ji nû ve saz bike
            }
        });

        // reCAPTCHA render bike da ku amade be
        // reCAPTCHA ڕێندەر بکە با ئامادە بێت
        return window.recaptchaVerifier.render().then(() => {
             console.log("reCAPTCHA amade ye.");
             return true;
        });

    } catch (error) {
        console.error("Xeta di amadekirina reCAPTCHA de:", error);
        return Promise.resolve(false); // Promise vedigerîne ji bo birêvebirina asynkron
    }
}

/**
 * Koda piştrastkirinê (SMS) ji hejmara têlefonê re dişîne.
 * @param {string} phoneNumber - Hejmara têlefonê (mînak: "+9647501234567")
 * @returns {Promise<object>} - Encamek bi { success: boolean, message: string } vedigerîne
 *
 * کۆدی پشتڕاستکردنەوە (SMS) بۆ ژمارەی مۆبایل دەنێرێت.
 * @param {string} phoneNumber - ژمارەی مۆبایل (بۆ نموونە: "+9647501234567")
 * @returns {Promise<object>} - ئەنجامێک دەگەڕێنێتەوە { success: boolean, message: string }
 */
export async function sendVerificationCode(phoneNumber) {
    if (!window.recaptchaVerifier) {
        console.warn("reCAPTCHA verifier nehatiye amadekirin. Ji nû ve tê amadekirin...");
        await initPhoneAuth(); // Bisekine heta ku amade bibe
        if (!window.recaptchaVerifier) {
             return { success: false, message: "reCAPTCHA ne amade bû, ji kerema xwe rûpelê nû bike." };
        }
    }
    
    const appVerifier = window.recaptchaVerifier;

    try {
        window.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        console.log("SMS hate şandin. Encama piştrastkirinê hate tomarkirin.");
        return { success: true, message: "SMS bi serkeftî hate şandin." };
    } catch (error) {
        console.error("Xeta di şandina SMSê de:", error);
        
        // reCAPTCHA ji nû ve saz bike eger pêwîst be
        try {
            await window.recaptchaVerifier.render();
        } catch (e) {
            console.error("Xeta di renderkirina ji nû ve ya reCAPTCHA de:", e);
            await initPhoneAuth(); // Bi tevahî ji nû ve saz bike
        }

        if (error.code === 'auth/invalid-phone-number') {
            return { success: false, message: "Hejmara têlefonê ya nederbasdar." };
        } else if (error.code === 'auth/too-many-requests') {
            return { success: false, message: "We gelek caran hewl da. Ji kerema xwe paşê biceribîne." };
        }
        
        return { success: false, message: "Xetayek di şandina SMSê de çêbû." };
    }
}

/**
 * Koda 6-reqemî ya ku bikarhêner têkevî piştrast dike.
 * @param {string} code - Koda piştrastkirinê ya 6-reqemî.
 * @returns {Promise<object>} - Encamek bi { success: boolean, userId?: string, phone?: string, message?: string } vedigerîne
 *
 * ئەو کۆدە ٦ ژمارەییەی بەکارهێنەر داغڵی کردووە پشتڕاست دەکاتەوە.
 * @param {string} code - کۆدی پشتڕاستکردنەوەی ٦ ژمارەیی.
 * @returns {Promise<object>} - ئەنجامێک دەگەڕێنێتەوە { success: boolean, userId?: string, phone?: string, message?: string }
 */
export async function verifyCode(code) {
    if (!window.confirmationResult) {
        console.error("Encama piştrastkirinê tune. Ji kerema xwe pêşî SMS bişînin.");
        return { success: false, message: "Pêşî SMS bişînin." };
    }

    try {
        const result = await window.confirmationResult.confirm(code);
        const user = result.user;
        console.log("Bikarhêner bi serkeftî têket:", user.uid);
        window.confirmationResult = null; // Encama piştrastkirinê paqij bike
        return { success: true, userId: user.uid, phone: user.phoneNumber }; // ID û hejmara bikarhêner vegerîne
    } catch (error) {
        console.error("Xeta di piştrastkirina kodê de:", error);
        if (error.code === 'auth/invalid-verification-code') {
            return { success: false, message: "Koda nederbasdar." };
        }
        return { success: false, message: "Xetayek di piştrastkirina kodê de çêbû." };
    }
}

/**
 * Kontrol dike ka bikarhênerek profîlek (navek) di Firestore de heye an na.
 * @param {string} userId - IDya bikarhêner.
 * @returns {Promise<object|null>} - Daneyên profîlê vedigerîne eger hebe, yan jî null.
 *
 * پشکنین دەکات بزانێت ئایا بەکارهێنەر پڕۆفایلێکی (ناو) لە فایەرستۆر هەیە یان نا.
 * @param {string} userId - ئایدی بەکارهێنەر.
 * @returns {Promise<object|null>} - داتای پڕۆفایل دەگەڕێنێتەوە ئەگەر هەبوو، ئەگەرنا null.
 */
export async function getUserProfile(userId) {
     if (!userId) return null;
     const userDocRef = doc(db, "users", userId);
     const docSnap = await getDoc(userDocRef);
     if (docSnap.exists()) {
         return docSnap.data();
     } else {
         return null;
     }
}

/**
 * Profîla nû ya bikarhêner tomar dike an jî ya heyî nû dike.
 * @param {string} userId 
 * @param {string} name 
 * @param {string} phone 
 *
 * پڕۆفایلی نوێی بەکارهێنەر پاشەکەوت دەکات یان هی ئێستا نوێ دەکاتەوە.
 * @param {string} userId 
 * @param {string} name 
 * @param {string} phone 
 */
export async function saveUserProfile(userId, name, phone) {
     const userDocRef = doc(db, "users", userId);
     try {
         await setDoc(userDocRef, {
             name: name,
             phone: phone,
             createdAt: Date.now()
         }, { merge: true }); // Merge bikar bîne da ku daneyên din ên heyî winda nebin
         return true;
     } catch (error) {
         console.error("Xeta di tomarkirina profîla bikarhêner de:", error);
         return false;
     }
}

/**
 * Fonksiyonek ji bo şandina peyamekê bo chatê.
 * @param {string} userId - IDya bikarhênerê ku peyamê dişîne.
 * @param {string} text - Nivîsa peyamê.
 * @returns {Promise<boolean>} - True eger bi serkeftî hate şandin.
 *
 * فەنکشنێک بۆ ناردنی نامەیەک بۆ چات.
 * @param {string} userId - ئایدی ئەو بەکارهێنەرەی نامەکە دەنێرێت.
 * @param {string} text - تێکستی نامەکە.
 * @returns {Promise<boolean>} - ڕاست (True) ئەگەر بە سەرکەوتوویی نێردرا.
 */
export async function sendChatMessage(userId, text) {
    if (!userId || !text || text.trim() === "") return false;

    const messageData = {
        senderId: userId, // Ji bo naskirina bikarhêner
        text: text.trim(),
        timestamp: Date.now(),
        readByAdmin: false // Ji bo nîşandana notificationê ji admin re
    };

    try {
        // Peyamê li sub-collectiona bikarhêner zêde bike
        // نامەکە بۆ ژێر-کۆڵەکشنی بەکارهێنەر زیاد بکە
        const messagesRef = collection(db, "chats", userId, "messages");
        await addDoc(messagesRef, messageData);
        
        // Metadataya chatê ji bo panela admin nû bike
        // مێتادەیتای چاتەکە بۆ پانێڵی ئەدمین نوێ بکەوە
        const chatMetaRef = doc(db, "chats_meta", userId);
        const userProfile = await getUserProfile(userId); // Profîlê bistîne da ku nav hebe
        
        await setDoc(chatMetaRef, {
            lastMessage: text,
            lastMessageTimestamp: messageData.timestamp,
            userName: userProfile?.name || "Bikarhênerê nenas",
            userPhone: userProfile?.phone || "Hejmar ne diyar e",
            hasUnreadUserMessages: true // Nîşan dide ku bikarhêner peyamek şandiye
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Xeta di şandina peyama chatê de:", error);
        return false;
    }
}

/**
 * Guhdarek (listener) ji bo peyamên chatê yên bikarhênerekî taybet saz dike.
 * @param {string} userId - IDya bikarhêner.
 * @param {function} onMessagesReceived - Callback fonksiyonek ku bi rêzek peyaman tê bang kirin.
 * @returns {function} - Fonksiyonek ji bo rawestandina guhdarê (unsubscribe).
 *
 * گوێگرێک (listener) بۆ نامەکانی چاتی بەکارهێنەرێکی دیاریکراو دادەنێت.
 * @param {string} userId - ئایدی بەکارهێنەر.
 * @param {function} onMessagesReceived - فەنکشنێکی Callback کە لەگەڵ لیستی نامەکان بانگ دەکرێت.
 * @returns {function} - فەنکشنێک بۆ ڕاگرتنی گوێگرەکە (unsubscribe).
 */
export function getChatMessagesListener(userId, onMessagesReceived) {
    // Guhdarê kevn rawestîne eger hebe
    // گوێگرە کۆنەکە بوەستێنە ئەگەر هەبێت
    if (currentChatListener) {
        currentChatListener();
    }

    const messagesRef = collection(db, "chats", userId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc")); // Ji kevn bo nû rêz bike

    // Guhdarê nû saz bike û tomar bike
    // گوێگرە نوێیەکە دابنێ و پاشەکەوتی بکە
    currentChatListener = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        onMessagesReceived(messages); // Peyaman ji UI re bişîne
    }, (error) => {
        console.error("Xeta di wergirtina peyamên chatê de:", error);
    });

    return currentChatListener; // Fonksiyona unsubscribe vegerîne
}

/**
 * Guhdarê chatê yê çalak radiwestîne.
 * گوێگری چاتی چالاک ڕادەگرێت.
 */
export function stopChatMessagesListener() {
    if (currentChatListener) {
        currentChatListener();
        currentChatListener = null;
        console.log("Guhdarê chatê hate rawestandin.");
    }
}