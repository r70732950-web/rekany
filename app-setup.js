// app-setup.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
// [ 💡 GORANKARI LÊRE HAT KIRIN 💡 ] - Fenkşna nû ya 'sendPasswordResetEmail' hat zêdekirin
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE", 
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);
export const storage = getStorage(app);

// [ 💡 GORANKARI LÊRE HAT KIRIN 💡 ] - Fenkşna nû hat zêdekirin
export {
    signInWithEmailAndPassword, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, updateProfile,
    sendPasswordResetEmail
};

export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoGroupsCollection = collection(db, "promo_groups");
export const brandGroupsCollection = collection(db, "brand_groups");
export const shortcutRowsCollection = collection(db, "shortcut_rows");
export const categoryLayoutsCollection = collection(db, "category_layouts");
export const usersCollection = collection(db, "users");


export const translations = {
    ku_sorani: {
        search_placeholder: "گەڕان بە ناوی کاڵا...",
        admin_login_title: "چوونەژوورەوەی بەڕێوەبەر",
        email_label: "ئیمەیڵ:",
        password_label: "وشەی نهێنی:",
        login_button: "چوونەژوورەوە",
        cart_title: "سەbەتەی کڕین",
        cart_empty: "سەbەتەکەت بەتاڵە",
        total_price: "کۆی گشتی:",
        send_whatsapp: "ناردن لە ڕێگەی واتسئاپ",
        send_viber: "ناردن لە ڕێگەی فایbەر",
        send_telegram: "ناردن لە ڕێگەی تێلێگرام",
        favorites_title: "لیستی دڵخوازەکان",
        favorites_empty: "لیستی دڵخوازەکانت بەتاڵە",
        choose_category: "هەڵbژاردنی جۆر",
        all_products: "هەموو کاڵاکان",
        loading_products: "...خەریکی bارکردنی کاڵاکانە",
        settings_title: "ڕێکخستنەکان",
        language_label: "زمان",
        profile_title: "پڕۆفایلی من",
        admin_login_nav: "چوونەژوورەوەی بەڕێوەbەر",
        logout_nav: "چوونەدەرەوە",
        profile_name: "ناو:",
        profile_address: "ناونیشان:",
        profile_phone: "ژمارەی تەلەفۆن:",
        save_button: "پاشەکەوتکردن",
        nav_home: "سەرەki",
        nav_categories: "جۆرەکان",
        nav_cart: "سەbەتە",
        nav_profile: "پڕۆفایل",
        nav_settings: "ڕێکخستن",
        contact_us_title: "پەیوەندیمان پێوە bکە",
        add_to_cart: "زیادکردن بۆ سەbەتە",
        added_to_cart: "زیادکرا",
        product_not_found_error: "هەڵە: کاڵاکە نەدۆزرایەوە!",
        delete_confirm: "دڵنیایت دەتەوێت ئەم کاڵایە bسڕیتەوە؟",
        product_deleted: "کاڵا سڕدرایەوە",
        product_delete_error: "هەڵە لە سڕینەوەی کاڵا",
        order_greeting: "سڵاو! من پێویستم bەم کاڵایانەی خوارەوەیە:",
        order_item_details: "نرخ: {price} د.ع. | ژمارە: {quantity}",
        order_total: "کۆی گشتی",
        order_user_info: "--- زانیاری داواکار ---",
        order_user_name: "ناو",
        order_user_address: "ناونیشان",
        order_user_phone: "ژمارەی تەلەفۆن",
        order_prompt_info: "تکایە ناونیشان و زانیارییەکانت bنێرە بۆ گەیاندن.",
        login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە",
        logout_success: "bە سەرکەوتوویی چوویتەدەرەوە",
        profile_saved: "زانیارییەکانی پڕۆفایل پاشەکەوتکران",
        all_categories_label: "هەموو",
        install_app: "دامەزراندنی ئەپ",
        product_added_to_cart: "کاڵاکە زیادکرا بۆ سەbەتە",
        product_added_to_favorites: "زیادکرا بۆ لیستی دڵخوازەکان",
        product_removed_from_favorites: "لە لیستی دڵخوازەکان سڕدرایەوە",
        manage_categories_title: "bەڕێوەbردنی جۆرەکان",
        manage_contact_methods_title: "bەڕێوەbردنی شێوازەکانی ناردنی داواکاری",
        notifications_title: "ئاگەهدارییەکان",
        no_notifications_found: "هیچ ئاگەهدارییەک نییە",
        manage_announcements_title: "ناردنی ئاگەهداری گشتی",
        send_new_announcement: "ناردنی ئاگەهداری نوێ",
        send_announcement_button: "ناردنی ئاگەهداری",
        sent_announcements: "ئاگەهدارییە نێردراوەکان",
        no_announcements_sent: "هیچ ئاگەهدارییەک نەنێردراوە",
        announcement_deleted_success: "ئاگەهدارییەکە سڕدرایەوە",
        announcement_delete_confirm: "دڵنیایت دەتەوێت ئەم ئاگەهدارییە bسڕیتەوە؟",
        enable_notifications: "چالاککردنی ئاگەدارییەکان",
        error_generic: "هەڵەیەک ڕوویدا!",
        terms_policies_title: "مەرج و ڕێساکان",
        manage_policies_title: "bەڕێوەbردنی مەرج و ڕێساکان",
        policies_saved_success: "مەرج و ڕێساکان پاشەکەوتکران",
        loading_policies: "...خەریکی bارکردنی ڕێساکانە",
        no_policies_found: "هیچ مەرج و ڕێسایەک دانەنراوە.",
        has_discount_badge: "داشکانی تێدایە",
        force_update: "ناچارکردن bە نوێکردنەوە (سڕینەوەی کاش)",
        update_confirm: "دڵنیایت دەتەوێت ئەپەکە نوێ bکەیتەوە؟ هەموو کاشی ناو وێbگەڕەکەت دەسڕدرێتەوە.",
        update_success: "ئەپەکە bە سەرکەوتوویی نوێکرایەوە!",
        newest_products: "نوێترین کاڵاکان",
        see_all: "bینینی هەمووی",
        all_products_section_title: "هەموو کاڵاکان",
        share_product: "هاوbەشی پێکردن",
        related_products_title: "کاڵای هاوشێوە",
        share_text: "سەیری ئەم کاڵایە bکە",
        share_error: "هاوbەشیپێکردن سەرکەوتوو نەbوو",
        admin_category_layout_title: "دیزاینی لاپەڕەی جۆرەکان",
        admin_category_layout_select: "-- جۆری سەرەki هەڵbژێرە --",
        admin_category_layout_enable: "چالاککردنی دیزاینی تایbەت bۆ ئەم جۆرە",
        admin_category_layout_info: "ئەگەر چالاک bێت، ئەم دیزاینە لە جیاتی لیستی ئاسایی کاڵاکان پیشان دەدرێت.",
        admin_category_layout_add_section: "زیادکردنی bەش bۆ جۆر",
        user_login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە",
        user_signup_email_exists: "ئەم ئیمەیڵە پێشتر bەکارهاتووە",
        user_signup_weak_password: "وشەی نهێنی زۆر لاوازە (پێویستە 6 پیت bێت)",
        user_signup_success: "هەژمارەکەت bە سەرکەوتوویی دروستکرا",
        user_logout_success: "bە سەرکەوتوویی چوویتەدەرەوە",
        auth_tab_login: "چوونەژوورەوە",
        auth_tab_signup: "خۆتۆمارکردن",
        // === WERGERÊN NÛ ===
        forgot_password: "وشەی نهێنیت ژبیرکردووە؟",
        forgot_password_no_email: "تکایە ئیمەیڵەکەت bنووسە",
        forgot_password_no_email_prompt: "تکایە ئیمەیڵەکەت لە خانەی ئیمەیڵ bنووسە، پاشان کلیک bکە",
        forgot_password_success: "لینکێکی نوێکردنەوە bۆ ئیمەیڵەکەت نێردرا",
        forgot_password_not_found: "ئەم ئیمەیڵە تۆمار نەکراوە",
        // === KOTAHIYA WERGERÊN NÛ ===
    },
    ku_badini: {
        search_placeholder: "لێگەریان ب ناڤێ کاڵای...",
        admin_login_title: "چوونا ژوور یا bەرپرسى",
        email_label: "ئیمەیل:",
        password_label: "پەیڤا نهێنى:",
        login_button: "چوونا ژوور",
        cart_title: "سەلکا کرینێ",
        cart_empty: "سەلکا تە یا ڤالایە",
        total_price: "کۆمێ گشتی:",
        send_whatsapp: "فرێکرن b رێکا واتسئاپ",
        send_viber: "فرێکرن b رێکا ڤایbەر",
        send_telegram: "فرێکرن b رێکا تێلێگرام",
        favorites_title: "لیستا حەزژێکریان",
        favorites_empty: "لیستا حەزژێکریێن تە یا ڤالایە",
        choose_category: "جورەکی هەلbژێرە",
        all_products: "هەمی کاڵا",
        loading_products: "...د bارکرنا کاڵایان دایە",
        settings_title: "ڕێکخستن",
        language_label: "زمان",
        profile_title: "پروفایلێ من",
        admin_login_nav: "چوونا ژوور یا bەرپرسى",
        logout_nav: "چوونا دەر",
        profile_name: "ناڤ:",
        profile_address: "ناڤ و نیشان:",
        profile_phone: "ژمارا تەلەفونێ:",
        save_button: "پاشەکەفتکرن",
        nav_home: "سەرەki",
        nav_categories: "جۆر",
        nav_cart: "سەلک",
        nav_profile: "پروفایل",
        nav_settings: "ڕێکخستن",
        contact_us_title: "پەیوەندیێ b مە bکە",
        add_to_cart: "زێدەکرن bۆ سەلکێ",
        added_to_cart: "زێدەکر",
        product_not_found_error: "خەلەتی: کاڵا نەهاتە دیتن!",
        delete_confirm: "تو پشتڕاستی دێ ڤی کاڵای ژێbەى؟",
        product_deleted: "کاڵا هاتە ژێbرن",
        product_delete_error: "خەلەتی د ژێbرنا کاڵای دا",
        order_greeting: "سلاڤ! ئەز پێدڤی b ڤان کاڵایێن خوارێ مە:",
        order_item_details: "bها: {price} د.ع. | ژمارە: {quantity}",
        order_total: "کۆمێ گشتی",
        order_user_info: "--- پێزانینێن داخازکەری ---",
        order_user_name: "ناڤ",
        order_user_address: "ناڤ و نیشان",
        order_user_phone: "ژمارا تەلەفونێ:",
        order_prompt_info: "هیڤی دکەین ناڤ و نیشان و پێزانینێن خۆ فرێکە bۆ گەهاندنێ.",
        login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە",
        logout_success: "b سەرکەفتیانە چوويه دەر",
        profile_saved: "پێزانینێن پروفایلی هاتنە پاشەکەفتکرن",
        all_categories_label: "هەمی",
        install_app: "دامەزراندنا ئەپی",
        product_added_to_cart: "کاڵا هاتە زێدەکرن bۆ سەلکێ",
        product_added_to_favorites: "هاتە زێدەکرن bۆ لیستا حەزژێکریان",
        product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێbرن",
        manage_categories_title: "рێکخستنا جوران",
        manage_contact_methods_title: "рێکخستنا رێکێن فرێکرنا داخازیێ",
        notifications_title: "ئاگەهداری",
        no_notifications_found: "چ ئاگەهداری نینن",
        manage_announcements_title: "рێکخستنا ئاگەهداریان",
        send_new_announcement: "فرێکرنا ئاگەهداریەکا نوو",
        send_announcement_button: "ئاگەهداریێ فرێکە",
        sent_announcements: "ئاگەهداریێن هاتینە فرێکرن",
        no_announcements_sent: "چ ئاگەهداری نەهاتینە فرێکرن",
        announcement_deleted_success: "ئاگەهداری هاتە ژێbرن",
        announcement_delete_confirm: "تو پشتڕاستی دێ ڤێ ئaگەهداریێ ژێbەی؟",
        enable_notifications: "چالاکرنا ئاگەهداریان",
        error_generic: "خەلەتییەک چێbوو!",
        terms_policies_title: "مەرج و سیاسەت",
        manage_policies_title: "рێکخستنا مەرج و سیاسەتان",
        policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن",
        loading_policies: "...د bارکرنا سیاسەتان دایە",
        no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.",
        has_discount_badge: "داشکان تێدایە",
        force_update: "ناچارکرن b نویکرنەوە (ژێbرنا کاشی)",
        update_confirm: "تو پشتراستی دێ ئەپی نویکەیەڤە؟ دێ هەمی کاش د ناڤ وێbگەرا تە دا هێتە ژێbرن.",
        update_success: "ئەپ b سەرکەfتیانە هاتە نویکرن!",
        newest_products: "نوترین کاڵا",
        see_all: "هەمیا bبینە",
        all_products_section_title: "هەمی کاڵا",
        share_product: "پارڤەکرن",
        related_products_title: "کاڵایێن وەک ئێکن",
        share_text: "bەرێخۆ bدە ڤی کاڵای",
        share_error: "پارڤەکرن سەرنەکەفت",
        admin_category_layout_title: "دیزاینا لاپەرێ جوران",
        admin_category_layout_select: "-- جۆرێ سەرەki هەلbژێرە --",
        admin_category_layout_enable: "چالاکرنا دیزاینا تایbەت bۆ ڤی جۆری",
        admin_category_layout_info: "ئەگەر bهێتە چالاکرن، ئەڤ دیزاینە دێ ل جهێ لیستا ئاسایی یا کاڵایان هێتە نیشاندان.",
        admin_category_layout_add_section: "زێدەکرنا پشکێ bۆ جۆری",
        user_login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە",
        user_signup_email_exists: "ئەڤ ئیمەیلە bەری نوکە هاتیە bکارئینان",
        user_signup_weak_password: "پەیڤا نهێنى یا لاوازە (پێدڤیە 6 پیت bن)",
        user_signup_success: "هەژمارا تە b سەرکەفتیانە هاتە دروستکرن",
        user_logout_success: "b سەرکەفتیانە چوويه دەر",
        auth_tab_login: "چوونا ژوور",
        auth_tab_signup: "خۆتۆمارکرن",
        // === WERGERÊN NÛ ===
        forgot_password: "پەیڤا نهێنى تە ژبیرکریە؟",
        forgot_password_no_email: "هیڤی دکەین ئیمەیلێ خۆ bنڤیسە",
        forgot_password_no_email_prompt: "تکایە ئیمەیلێ خۆ د خانەیا ئیمەیلێ دا bنڤیسە، پاشی کلیک bکە",
        forgot_password_success: "لینکەکا نویکرنەوە bۆ ئیمەیلێ تە هاتە فرێکرن",
        forgot_password_not_found: "ئەڤ ئیمەیلە تۆمارکری نییە",
        // === KOTAHIYA WERGERÊN NÛ ===
    },
    ar: {
        search_placeholder: "الbحث bاسم المنتج...",
        admin_login_title: "تسجيل دخول المسؤول",
        email_label: "الbريد الإلكتروني:",
        password_label: "كلمة المرور:",
        login_button: "تسجيل الدخول",
        cart_title: "سلة التسوق",
        cart_empty: "سلتك فارغة",
        total_price: "المجموع الكلي:",
        send_whatsapp: "إرسال عbر واتساb",
        send_viber: "إرسال عbر فايbر",
        send_telegram: "إرسال عbر تليجرام",
        favorites_title: "قائمة المفضلة",
        favorites_empty: "قائمة المفضلة فارغة",
        choose_category: "اختر الفئة",
        all_products: "كل المنتجات",
        loading_products: "...جاري تحميل المنتجات",
        settings_title: "الإعدادات",
        language_label: "اللغة",
        profile_title: "ملفي الشخصي",
        admin_login_nav: "تسجيل دخول المسؤول",
        logout_nav: "تسجيل الخروج",
        profile_name: "الاسم:",
        profile_address: "العنوان:",
        profile_phone: "رقم الهاتف:",
        save_button: "حفظ",
        nav_home: "الرئيسية",
        nav_categories: "الفئات",
        nav_cart: "السلة",
        nav_profile: "ملفي",
        nav_settings: "الإعدادات",
        contact_us_title: "تواصل معنا",
        add_to_cart: "إضافة إلى السلة",
        added_to_cart: "تمت الإضافة",
        product_not_found_error: "خطأ: المنتج غير موجود!",
        delete_confirm: "هل أنت متأكد من أنك تريد حذف هذا المنتج؟",
        product_deleted: "تم حذف المنتج",
        product_delete_error: "خطأ في حذف المنتج",
        order_greeting: "مرحbاً! أحتاج إلى المنتجات التالية:",
        order_item_details: "السعر: {price} د.ع. | الكمية: {quantity}",
        order_total: "المجموع الكلي",
        order_user_info: "--- معلومات العميل ---",
        order_user_name: "الاسم",
        order_user_address: "العنوان",
        order_user_phone: "رقم الهاتف",
        order_prompt_info: "يرجى إرسال عنوانك وتفاصيلك للتوصيل.",
        login_error: "الbريد الإلكتروني أو كلمة المرور غير صحيحة",
        logout_success: "تم تسجيل الخروج bنجاح",
        profile_saved: "تم حفظ معلومات الملف الشخصي",
        all_categories_label: "الكل",
        install_app: "تثbيت التطbيق",
        product_added_to_cart: "تمت إضافة المنتج إلى السلة",
        product_added_to_favorites: "تمت الإضافة إلى المفضلة",
        product_removed_from_favorites: "تمت الإزالة من المفضلة",
        manage_categories_title: "إدارة الفئات",
        manage_contact_methods_title: "إدارة طرق إرسال الطلb",
        notifications_title: "الإشعارات",
        no_notifications_found: "لا توجد إشعارات",
        manage_announcements_title: "إدارة الإشعارات العامة",
        send_new_announcement: "إرسال إشعار جدید",
        send_announcement_button: "إرسال الإشعار",
        sent_announcements: "الإشعارات المرسلة",
        no_announcements_sent: "لم يتم إرسال أي إشعارات",
        announcement_deleted_success: "تم حذف الإشعار",
        announcement_delete_confirm: "هل أنت متأكد من حذف هذا الإشعار؟",
        enable_notifications: "تفعيل الإشعارات",
        error_generic: "حدث خطأ!",
        terms_policies_title: "الشروط والسياسات",
        manage_policies_title: "إدارة الشروط والسياسات",
        policies_saved_success: "تم حفظ الشروط والسياسات bنجاح",
        loading_policies: "...جاري تحميل السياسات",
        no_policies_found: "لم يتم تحديد أي شروط أو سياسات.",
        has_discount_badge: "يتضمن خصم",
        force_update: "فرض التحديث (مسح ذاكرة التخزين المؤقت)",
        update_confirm: "هل أنت متأكد من رغbتك في تحديث التطbيق؟ سيتم مسح جميع bيانات ذاكرة التخزين المؤقت.",
        update_success: "تم تحديث التطbيق bنجاح!",
        newest_products: "أحدث المنتجات",
        see_all: "عرض الكل",
        all_products_section_title: "جميع المنتجات",
        share_product: "مشاركة المنتج",
        related_products_title: "منتجات مشaبهة",
        share_text: "ألق نظرة على هذا المنتج",
        share_error: "فشلت المشاركة",
        admin_category_layout_title: "تصميم صفحة الفئات",
        admin_category_layout_select: "-- اختر الفئة الرئيسية --",
        admin_category_layout_enable: "تفعيل التصميم المخصص لهذه الفئة",
        admin_category_layout_info: "في حال تفعيله، سيتم عرض هذا التصميم bدلاً من قائمة المنتجات العادية.",
        admin_category_layout_add_section: "إضافة قسم للفئة",
        user_login_error: "الbريد الإلكتروني أو كلمة المرور غير صحيحة",
        user_signup_email_exists: "هذا الbريد الإلكتروني مستخدم bالفعل",
        user_signup_weak_password: "كلمة المرور ضعيفة جداً (يجb أن تكون 6 أحرف على الأقل)",
        user_signup_success: "تم إنشاء حساbك bنجاح",
        user_logout_success: "تم تسجيل الخروج bنجاح",
        auth_tab_login: "تسجيل الدخول",
        auth_tab_signup: "إنشاء حساb",
        // === WERGERÊN NÛ ===
        forgot_password: "هل نسيت كلمة المرور؟",
        forgot_password_no_email: "يرجى إدخال bريدك الإلكتروني",
        forgot_password_no_email_prompt: "الرجاء إدخال bريدك الإلكتروني في حقل الإيميل، ثم انقر",
        forgot_password_success: "تم إرسال راbط إعادة التعيين إلى bريدك الإلكتروني",
        forgot_password_not_found: "هذا الbريد الإلكتروني غير مسجل",
        // === KOTAHIYA WERGERÊN NÛ ===
    }
};

export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null,
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: {}, 
    currentUser: null, 
    editingProductId: null, 
    products: [],
    categories: [], 
    subcategories: [], 
    lastVisibleProductDoc: null,
    isLoadingMoreProducts: false,
    allProductsLoaded: false,
    isRenderingHomePage: false,
    productCache: {},
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSubSubcategory: 'all',
    currentSearch: '',
    currentProductId: null, 
    currentPageId: 'mainPage', 
    currentPopupState: null, 
    pendingFilterNav: null, 
    sliderIntervals: {}, 
    contactInfo: {}, 
};

export const CART_KEY = "maten_store_cart";
export const FAVORITES_KEY = "maten_store_favorites";
export const PRODUCTS_PER_PAGE = 25;

export const loginModal = document.getElementById('loginModal');
export const addProductBtn = document.getElementById('addProductBtn'); 
export const productFormModal = document.getElementById('productFormModal');
export const productsContainer = document.getElementById('productsContainer');
export const skeletonLoader = document.getElementById('skeletonLoader');
export const searchInput = document.getElementById('searchInput');
export const clearSearchBtn = document.getElementById('clearSearchBtn');
export const loginForm = document.getElementById('loginForm');
export const productForm = document.getElementById('productForm');
export const formTitle = document.getElementById('formTitle');
export const imageInputsContainer = document.getElementById('imageInputsContainer');
export const loader = document.getElementById('loader');
export const cartBtn = document.getElementById('cartBtn');
export const cartItemsContainer = document.getElementById('cartItemsContainer');
export const emptyCartMessage = document.getElementById('emptyCartMessage');
export const cartTotal = document.getElementById('cartTotal');
export const totalAmount = document.getElementById('totalAmount');
export const cartActions = document.getElementById('cartActions');
export const favoritesContainer = document.getElementById('favoritesContainer');
export const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
export const categoriesBtn = document.getElementById('categoriesBtn');
export const sheetOverlay = document.getElementById('sheet-overlay');
export const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
export const productCategorySelect = document.getElementById('productCategoryId');
export const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
export const productSubcategorySelect = document.getElementById('productSubcategoryId');
export const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
export const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');
export const profileForm = document.getElementById('profileForm');
export const settingsPage = document.getElementById('settingsPage');
export const mainPage = document.getElementById('mainPage');
export const homeBtn = document.getElementById('homeBtn');
export const settingsBtn = document.getElementById('settingsBtn');
export const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
export const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
export const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
export const profileBtn = document.getElementById('profileBtn');
export const contactToggle = document.getElementById('contactToggle');
export const notificationBtn = document.getElementById('notificationBtn');
export const notificationBadge = document.getElementById('notificationBadge');
export const notificationsSheet = document.getElementById('notificationsSheet');
export const notificationsListContainer = document.getElementById('notificationsListContainer');
export const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
export const termsSheet = document.getElementById('termsSheet');
export const termsContentContainer = document.getElementById('termsContentContainer');
export const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); 

export const homePageSectionsContainer = document.getElementById('homePageSectionsContainer');
export const categoryLayoutContainer = document.getElementById('categoryLayoutContainer');

export const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
export const policiesForm = document.getElementById('policiesForm');
export const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
export const addSocialMediaForm = document.getElementById('addSocialMediaForm');
export const socialLinksListContainer = document.getElementById('socialLinksListContainer');
export const socialMediaToggle = document.getElementById('socialMediaToggle');
export const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
export const announcementForm = document.getElementById('announcementForm');
export const announcementsListContainer = document.getElementById('announcementsListContainer'); 
export const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');
export const addPromoGroupForm = document.getElementById('addPromoGroupForm');
export const promoGroupsListContainer = document.getElementById('promoGroupsListContainer');
export const addPromoCardForm = document.getElementById('addPromoCardForm');
export const adminBrandsManagement = document.getElementById('adminBrandsManagement');
export const addBrandGroupForm = document.getElementById('addBrandGroupForm');
export const brandGroupsListContainer = document.getElementById('brandGroupsListContainer');
export const addBrandForm = document.getElementById('addBrandForm');
export const adminCategoryManagement = document.getElementById('adminCategoryManagement');
export const categoryListContainer = document.getElementById('categoryListContainer');
export const addCategoryForm = document.getElementById('addCategoryForm');
export const addSubcategoryForm = document.getElementById('addSubcategoryForm');
export const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
export const editCategoryForm = document.getElementById('editCategoryModal');
export const adminContactMethodsManagement = document.getElementById('adminContactMethodsManagement');
export const contactMethodsListContainer = document.getElementById('contactMethodsListContainer');
export const adminShortcutRowsManagement = document.getElementById('adminShortcutRowsManagement');
export const shortcutRowsListContainer = document.getElementById('shortcutRowsListContainer');
export const addShortcutRowForm = document.getElementById('addShortcutRowForm');
export const addCardToRowForm = document.getElementById('addCardToRowForm');
export const adminHomeLayoutManagement = document.getElementById('adminHomeLayoutManagement');
export const homeLayoutListContainer = document.getElementById('homeLayoutListContainer');
export const addHomeSectionBtn = document.getElementById('addHomeSectionBtn');
export const addHomeSectionModal = document.getElementById('addHomeSectionModal');
export const addHomeSectionForm = document.getElementById('addHomeSectionForm');
export const adminCategoryLayoutManagement = document.getElementById('adminCategoryLayoutManagement');
export const categoryLayoutSelect = document.getElementById('categoryLayoutSelect');
export const categoryLayoutEditorContainer = document.getElementById('categoryLayoutEditorContainer');
export const categoryLayoutEnableToggle = document.getElementById('categoryLayoutEnableToggle');
export const categoryLayoutListContainer = document.getElementById('categoryLayoutListContainer');
export const addCategorySectionBtn = document.getElementById('addCategorySectionBtn');

window.globalAdminTools = {
    db, auth,
    storage, ref, uploadBytes, getDownloadURL,
    doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection,
    query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,

    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    categoryLayoutsCollection, 

    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories,
    getCurrentLanguage: () => state.currentLanguage,

    t: (key, replacements = {}) => { 
        let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
        for (const placeholder in replacements) {
            translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return translation;
    },
    showNotification: (message, type = 'success') => { 
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    },
     clearProductCache: () => { 
          console.log("Product cache and home page cleared due to admin action.");
          state.productCache = {};
          const homeContainer = document.getElementById('homePageSectionsContainer');
          if (homeContainer) {
              homeContainer.innerHTML = '';
          }
          const categoryContainer = document.getElementById('categoryLayoutContainer');
          if (categoryContainer) {
              categoryContainer.innerHTML = '';
          }
          document.dispatchEvent(new Event('clearCacheTriggerRender'));
     },
};
