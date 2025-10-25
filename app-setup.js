// BEŞÊ YEKEM: app-setup.js
// Pênasekirin û sazkarîyên destpêkê

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // Removed unused imports
import { getFirestore, enableIndexedDbPersistence, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Removed unused imports
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js"; // Removed unused imports

// Firebase Configuration (Keep your original config)
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE", // Use environment variables in production
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// Initialization and Exports
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Make Firebase services and helper functions globally available for admin.js (if needed by admin.js directly)
// Consider if admin.js can import these directly from app-logic.js's globalAdminTools instead.
// window.globalFirebase = { db, auth, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, getDocs, where, limit, startAfter, runTransaction }; // Example

// Firestore Collections Exports
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoGroupsCollection = collection(db, "promo_groups");
export const brandGroupsCollection = collection(db, "brand_groups");
// === ADDED EXPORT / زیادکرا ===
export const shortcutRowsCollection = collection(db, "shortcut_rows");
export const homeLayoutCollection = collection(db, "home_layout"); // Also export home_layout
export const settingsCollection = collection(db, "settings"); // For policies, contact etc.
// =============================

// Translations Export
export const translations = {
    ku_sorani: {
        search_placeholder: "گەڕان بە ناوی کاڵا...",
        admin_login_title: "چوونەژوورەوەی بەڕێوەبەر",
        email_label: "ئیمەیڵ:",
        password_label: "وشەی نهێنی:",
        login_button: "چوونەژوورەوە",
        cart_title: "سەبەتەی کڕین",
        cart_empty: "سەبەتەکەت بەتاڵە",
        total_price: "کۆی گشتی:",
        send_whatsapp: "ناردن لە ڕێگەی واتسئاپ",
        send_viber: "ناردن لە ڕێگەی فایبەر",
        send_telegram: "ناردن لە ڕێگەی تێلێگرام",
        favorites_title: "لیستی دڵخوازەکان",
        favorites_empty: "لیستی دڵخوازەکانت بەتاڵە",
        choose_category: "هەڵبژاردنی جۆر",
        all_products: "هەموو کاڵاکان",
        loading_products: "...خەریکی بارکردنی کاڵاکانە",
        settings_title: "ڕێکخستنەکان",
        language_label: "زمان",
        profile_title: "پڕۆفایلی من",
        admin_login_nav: "چوونەژوورەوەی بەڕێوەبەر",
        logout_nav: "چوونەدەرەوە",
        profile_name: "ناو:",
        profile_address: "ناونیشان:",
        profile_phone: "ژمارەی تەلەفۆن:",
        save_button: "پاشەکەوتکردن",
        nav_home: "سەرەکی",
        nav_categories: "جۆرەکان",
        nav_cart: "سەبەتە",
        nav_profile: "پڕۆفایل",
        nav_settings: "ڕێکخستن",
        contact_us_title: "پەیوەندیمان پێوە بکە",
        add_to_cart: "زیادکردن بۆ سەبەتە",
        added_to_cart: "زیادکرا",
        product_not_found_error: "هەڵە: کاڵاکە نەدۆزرایەوە!",
        delete_confirm: "دڵنیایت دەتەوێت ئەم کاڵایە بسڕیتەوە؟",
        product_deleted: "کاڵا سڕدرایەوە",
        product_delete_error: "هەڵە لە سڕینەوەی کاڵا",
        order_greeting: "سڵاو! من پێویستم بەم کاڵایانەی خوارەوەیە:",
        order_item_details: "نرخ: {price} د.ع. | ژمارە: {quantity}",
        order_total: "کۆی گشتی",
        order_user_info: "--- زانیاری داواکار ---",
        order_user_name: "ناو",
        order_user_address: "ناونیشان",
        order_user_phone: "ژمارەی تەلەفۆن",
        order_prompt_info: "تکایە ناونیشان و زانیارییەکانت بنێرە بۆ گەیاندن.",
        login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە",
        logout_success: "بە سەرکەوتوویی چوویتەدەرەوە",
        profile_saved: "زانیارییەکانی پڕۆفایل پاشەکەوتکران",
        all_categories_label: "هەموو", // Changed from "هەموو جۆرەکان" for consistency
        install_app: "دامەزراندنی ئەپ",
        product_added_to_cart: "کاڵاکە زیادکرا بۆ سەبەتە",
        product_added_to_favorites: "زیادکرا بۆ لیستی دڵخوازەکان",
        product_removed_from_favorites: "لە لیستی دڵخوازەکان سڕدرایەوە",
        manage_categories_title: "بەڕێوەبردنی جۆرەکان",
		manage_contact_methods_title: "بەڕێوەبردنی شێوازەکانی ناردنی داواکاری",
        notifications_title: "ئاگەهدارییەکان",
        no_notifications_found: "هیچ ئاگەهدارییەک نییە",
        manage_announcements_title: "ناردنی ئاگەداری گشتی",
        send_new_announcement: "ناردنی ئاگەهداری نوێ",
        send_announcement_button: "ناردنی ئاگەهداری",
        sent_announcements: "ئاگەهدارییە نێردراوەکان",
        no_announcements_sent: "هیچ ئاگەهدارییەک نەنێردراوە",
        announcement_deleted_success: "ئاگەهدارییەکە سڕدرایەوە",
        announcement_delete_confirm: "دڵنیایت دەتەوێت ئەم ئاگەهدارییە بسڕیتەوە؟",
        enable_notifications: "چالاککردنی ئاگەدارییەکان",
        error_generic: "هەڵەیەک ڕوویدا!",
        terms_policies_title: "مەرج و ڕێساکان",
        manage_policies_title: "بەڕێوەبردنی مەرج و ڕێساکان",
        policies_saved_success: "مەرج و ڕێساکان پاشەکەوتکران",
        loading_policies: "...خەریکی بارکردنی ڕێساکانە",
        no_policies_found: "هیچ مەرج و ڕێسایەک دانەنراوە.",
        has_discount_badge: "داشکانی تێدایە", // Or simply "داشکان"
        force_update: "ناچارکردن بە نوێکردنەوە (سڕینەوەی کاش)",
        update_confirm: "دڵنیایت دەتەوێت ئەپەکە نوێ بکەیتەوە؟ هەموو کاشی ناو وێبگەڕەکەت دەسڕدرێتەوە.",
        update_success: "ئەپەکە بە سەرکەوتوویی نوێکرایەوە!",
        newest_products: "نوێترین کاڵاکان",
        see_all: "بینینی هەمووی",
        all_products_section_title: "هەموو کاڵاکان",
        share_product: "هاوبەشی پێکردن",
        related_products_title: "کاڵای هاوشێوە",
        share_text: "سەیری ئەم کاڵایە بکە",
        share_error: "هاوبەشیپێکردن سەرکەوتوو نەبوو",
        product_link_copied: "لینکی کاڵا کۆپی کرا!",
        copy_failed: "کۆپیکردن سەرکەوتوو نەبوو!",
        // Added keys from user-actions
        error_saving_cart: 'هەڵە لە پاشەکەوتکردنی سەبەتە ڕوویدا',
        increase_quantity: 'زیادکردنی ژمارە',
        decrease_quantity: 'کەمکردنی ژمارە',
        remove_item: 'سڕینەوەی کاڵا',
        subtotal: 'کۆی گشتی بەش',
        currency: 'د.ع.',
        unnamed_product: 'کاڵای بێ ناو',
        no_order_methods: 'هیچ ڕێگایەک بۆ ناردنی داواکاری دیاری نەکراوە.',
        error_contact_method_misconfigured: 'هەڵە لە ڕێکخستنی شێوازی پەیوەندی.',
        error_unsupported_contact_method: 'شێوازی پەیوەندی نەناسراوە.',
        error_loading_order_methods: 'هەڵە لە بارکردنی شێوازەکانی داواکاری.',
        error_saving_favorites: 'هەڵە لە پاشەکەوتکردنی دڵخوازەکان ڕوویدا',
        add_to_favorites: 'زیادکردن بۆ دڵخوازەکان',
        remove_from_favorites: 'سڕینەوە لە دڵخوازەکان',
        error_fetching_favorites: 'هەڵە لە هێنانی دڵخوازەکان ڕوویدا.',
        error_saving_profile: 'هەڵە لە پاشەکەوتکردنی پڕۆفایل ڕوویدا',
        loading_notifications: '...بارکردنی ئاگەدارییەکان',
        error_loading_notifications: 'هەڵە لە بارکردنی ئاگەدارییەکان',
        error_loading_policies: 'هەڵە لە بارکردنی ڕێساکان.',
        notification_permission_granted: 'مۆڵەتی ناردنی ئاگەداری درا',
        notification_permission_denied: 'مۆڵەت نەدرا',
        error_notification_setup: 'هەڵە لە ڕێکخستنی ئاگەداری ڕوویدا',
        new_notification: 'ئاگەداری نوێ',
        error_force_update: 'هەڵە لەکاتی نوێکردنەوەی زۆرەملێ.',
        logging_in: '...چوونەژوورەوە',
        error_loading_admin_features: 'هەڵە لە بارکردنی تایبەتمەندییەکانی بەڕێوەبەر.',
        error_displaying_product: 'هەڵە لە نیشاندانی زانیاری کاڵا.',
        error_adding_cart: 'هەڵە لە زیادکردنی بۆ سەبەتە ڕوویدا',
         // ... (Add other missing keys if needed)
    },
    ku_badini: {
        search_placeholder: "لێگەریان ب ناڤێ کاڵای...",
        admin_login_title: "چوونا ژوور یا بەرپرسى",
        email_label: "ئیمەیل:",
        password_label: "پەیڤا نهێنى:",
        login_button: "چوونا ژوور",
        cart_title: "سەلکا کرینێ",
        cart_empty: "سەلکا تە یا ڤالایە",
        total_price: "کۆمێ گشتی:",
        send_whatsapp: "فرێکرن ب رێکا واتسئاپ",
        send_viber: "فرێکرن ب رێکا ڤایبەر",
        send_telegram: "فرێکرن ب رێکا تێلێگرام",
        favorites_title: "لیستا حەزژێکریان",
        favorites_empty: "لیستا حەزژێکریێن تە یا ڤالایە",
        choose_category: "جورەکی هەلبژێرە",
        all_products: "هەمی کاڵا",
        loading_products: "...د بارکرنا کاڵایان دایە",
        settings_title: "ڕێکخستن",
        language_label: "زمان",
        profile_title: "پروفایلێ من",
        admin_login_nav: "چوونا ژوور یا بەرپرسى",
        logout_nav: "چوونا دەر",
        profile_name: "ناڤ:",
        profile_address: "ناڤ و نیشان:",
        profile_phone: "ژمارا تەلەفونێ:",
        save_button: "پاشەکەفتکرن",
        nav_home: "سەرەکی",
        nav_categories: "جۆر",
        nav_cart: "سەلک",
        nav_profile: "پروفایل",
        nav_settings: "ڕێکخستن",
        contact_us_title: "پەیوەندیێ ب مە بکە",
        add_to_cart: "زێدەکرن بۆ سەلکێ",
        added_to_cart: "زێدەکر",
        product_not_found_error: "خەلەتی: کاڵا نەهاتە دیتن!",
        delete_confirm: "تو پشتڕاستی دێ ڤی کاڵای ژێبەى؟",
        product_deleted: "کاڵا هاتە ژێبرن",
        product_delete_error: "خەلەتی د ژێبرنا کاڵای دا",
        order_greeting: "سلاڤ! ئەز پێدڤی ب ڤان کاڵایێن خوارێ مە:",
        order_item_details: "بها: {price} د.ع. | ژمارە: {quantity}",
        order_total: "کۆمێ گشتی",
        order_user_info: "--- پێزانینێن داخازکەری ---",
        order_user_name: "ناڤ",
        order_user_address: "ناڤ و نیشان",
        order_user_phone: "ژمارا تەلەفونێ",
        order_prompt_info: "هیڤی دکەین ناڤ و نیشان و پێزانینێن خۆ فرێکە بۆ گەهاندنێ.",
        login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە",
        logout_success: "ب سەرکەفتیانە چوويه دەر",
        profile_saved: "پێزانینێن پروفایلی هاتنە پاشەکەفتکرن",
        all_categories_label: "هەمی", // Changed from "هەمی جور"
        install_app: "دامەزراندنا ئەپی",
        product_added_to_cart: "کاڵا هاتە زێدەکرن بۆ سەلکێ",
        product_added_to_favorites: "هاتە زێدەکرن بۆ لیستا حەزژێکریان",
        product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێبرن",
        manage_categories_title: "رێکخستنا جوران",
		manage_contact_methods_title: "رێکخستنا رێکێن فرێکرنا داخازیێ",
        notifications_title: "ئاگەهداری",
        no_notifications_found: "چ ئاگەهداری نینن",
        manage_announcements_title: "رێکخستنا ئاگەهداریان",
        send_new_announcement: "فرێکرنا ئاگەهداریەکا نوو",
        send_announcement_button: "ئاگەهداریێ فرێکە",
        sent_announcements: "ئاگەهداریێن هاتینە فرێکرن",
        no_announcements_sent: "چ ئاگەهداری نەهاتینە فرێکرن",
        announcement_deleted_success: "ئاگەهداری هاتە ژێبرن",
        announcement_delete_confirm: "تو پشتڕاستی دێ ڤێ ئاگەهداریێ ژێبەی؟",
        enable_notifications: "چالاکرنا ئاگەهداریان",
        error_generic: "خەلەتییەک چێبوو!",
        terms_policies_title: "مەرج و سیاسەت",
        manage_policies_title: "رێکخستنا مەرج و سیاسەتان",
        policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن",
        loading_policies: "...د بارکرنا سیاسەتان دایە",
        no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.",
        has_discount_badge: "داشکان تێدایە", // Or simply "داشکان"
        force_update: "ناچارکرن ب نویکرنەوە (ژێبرنا کاشی)",
        update_confirm: "تو پشتراستی دێ ئەپی نویکەیەڤە؟ دێ هەمی کاش د ناڤ وێبگەرا تە دا هێتە ژێبرن.",
        update_success: "ئەپ ب سەرکەفتیانە هاتە نویکرن!",
        newest_products: "نوترین کاڵا",
        see_all: "هەمیا ببینە",
        all_products_section_title: "هەمی کاڵا",
        share_product: "پارڤەکرن",
        related_products_title: "کاڵایێن وەک ئێکن",
        share_text: "بەرێخۆ بدە ڤی کاڵای",
        share_error: "پارڤەکرن سەرنەکەفت",
        product_link_copied: "لینکێ کاڵای هاتە کۆپیکرن!",
        copy_failed: "کۆپیکرن سەرنەکەفت!",
         // ... (Add Badini translations for added keys)
    },
    ar: {
        search_placeholder: "البحث باسم المنتج...",
        admin_login_title: "تسجيل دخول المسؤول",
        email_label: "البريد الإلكتروني:",
        password_label: "كلمة المرور:",
        login_button: "تسجيل الدخول",
        cart_title: "سلة التسوق",
        cart_empty: "سلتك فارغة",
        total_price: "المجموع الكلي:",
        send_whatsapp: "إرسال عبر واتساب",
        send_viber: "إرسال عبر فايبر",
        send_telegram: "إرسال عبر تليجرام",
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
        order_greeting: "مرحباً! أحتاج إلى المنتجات التالية:",
        order_item_details: "السعر: {price} د.ع. | الكمية: {quantity}",
        order_total: "المجموع الكلي",
        order_user_info: "--- معلومات العميل ---",
        order_user_name: "الاسم",
        order_user_address: "العنوان",
        order_user_phone: "رقم الهاتف",
        order_prompt_info: "يرجى إرسال عنوانك وتفاصيلك للتوصيل.",
        login_error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        logout_success: "تم تسجيل الخروج بنجاح",
        profile_saved: "تم حفظ معلومات الملف الشخصي",
        all_categories_label: "الكل", // Changed from "جميع الفئات"
        install_app: "تثبيت التطبيق",
        product_added_to_cart: "تمت إضافة المنتج إلى السلة",
        product_added_to_favorites: "تمت الإضافة إلى المفضلة",
        product_removed_from_favorites: "تمت الإزالة من المفضلة",
        manage_categories_title: "إدارة الفئات",
		manage_contact_methods_title: "إدارة طرق إرسال الطلب",
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
        policies_saved_success: "تم حفظ الشروط والسياسات بنجاح",
        loading_policies: "...جاري تحميل السياسات",
        no_policies_found: "لم يتم تحديد أي شروط أو سياسات.",
        has_discount_badge: "يتضمن خصم", // Or simply "خصم"
        force_update: "فرض التحديث (مسح ذاكرة التخزين المؤقت)",
        update_confirm: "هل أنت متأكد من رغبتك في تحديث التطبيق؟ سيتم مسح جميع بيانات ذاكرة التخزين المؤقت.",
        update_success: "تم تحديث التطبيق بنجاح!",
        newest_products: "أحدث المنتجات",
        see_all: "عرض الكل",
        all_products_section_title: "جميع المنتجات",
        share_product: "مشاركة المنتج",
        related_products_title: "منتجات مشابهة",
        share_text: "ألق نظرة على هذا المنتج",
        share_error: "فشلت المشاركة",
        product_link_copied: "تم نسخ رابط المنتج!",
        copy_failed: "فشل النسخ!",
         // ... (Add Arabic translations for added keys)
    }
};

// Global State Variables (Mutable) - Keep this minimal
export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null, // For PWA install prompt
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: JSON.parse(localStorage.getItem("maten_store_profile")) || {},
    // --- Data related state (Might move some to data-renderer if appropriate) ---
    products: [], // Current list of displayed products
    categories: [], // Main categories with 'all'
    subcategories: [], // Subcategories for the *currently selected* main category
    lastVisibleProductDoc: null, // For pagination
    isLoadingMoreProducts: false, // Flag for infinite scroll
    allProductsLoaded: false, // Flag for infinite scroll
    productCache: {}, // Simple cache for search/filter results
    // --- Filter/View state ---
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSubSubcategory: 'all',
    currentSearch: '',
    // --- Home Page specific state ---
    isRenderingHomePage: false, // Flag to prevent concurrent home renders
    sliderIntervals: {}, // Object to store promo slider interval IDs { layoutId: intervalId }
    // --- Admin state ---
    editingProductId: null, // ID of product being edited in the form
};

// Constants
export const CART_KEY = "maten_store_cart";
export const FAVORITES_KEY = "maten_store_favorites";
export const PROFILE_KEY = "maten_store_profile";
export const PRODUCTS_PER_PAGE = 25; // For pagination

// DOM Elements Exports (Keep only those needed by multiple modules or core logic)
// UI Manager might select its own elements internally more often
export const loginModal = document.getElementById('loginModal');
export const addProductBtn = document.getElementById('addProductBtn'); // Needed by AdminLogic/UI
export const productFormModal = document.getElementById('productFormModal'); // Needed by AdminLogic
export const productsContainer = document.getElementById('productsContainer'); // Needed by data-renderer
export const skeletonLoader = document.getElementById('skeletonLoader'); // Needed by data-renderer
export const searchInput = document.getElementById('searchInput'); // Needed by app-logic event listener
export const clearSearchBtn = document.getElementById('clearSearchBtn'); // Needed by app-logic event listener
export const loginForm = document.getElementById('loginForm'); // Needed by app-logic event listener
export const productForm = document.getElementById('productForm'); // Needed by AdminLogic
export const formTitle = document.getElementById('formTitle'); // Needed by AdminLogic
export const imageInputsContainer = document.getElementById('imageInputsContainer'); // Needed by AdminLogic
export const loader = document.getElementById('loader'); // Needed by data-renderer
export const cartBtn = document.getElementById('cartBtn'); // Needed by app-logic event listener
export const cartItemsContainer = document.getElementById('cartItemsContainer'); // Needed by user-actions (renderCart)
export const emptyCartMessage = document.getElementById('emptyCartMessage'); // Needed by user-actions (renderCart)
export const cartTotal = document.getElementById('cartTotal'); // Needed by user-actions (renderCart)
export const totalAmount = document.getElementById('totalAmount'); // Needed by user-actions (renderCart)
export const cartActions = document.getElementById('cartActions'); // Needed by user-actions (renderCartActionButtons)
export const favoritesContainer = document.getElementById('favoritesContainer'); // Needed by user-actions (renderFavoritesPage)
export const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage'); // Needed by user-actions (renderFavoritesPage)
export const categoriesBtn = document.getElementById('categoriesBtn'); // Needed by app-logic event listener
export const sheetOverlay = document.getElementById('sheet-overlay'); // Needed by app-logic/ui-manager
export const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer'); // Needed by user-actions/ui-manager (renderCategoriesSheet)
export const productCategorySelect = document.getElementById('productCategoryId'); // Needed by AdminLogic/app-logic event listener
export const subcategorySelectContainer = document.getElementById('subcategorySelectContainer'); // Needed by AdminLogic
export const productSubcategorySelect = document.getElementById('productSubcategoryId'); // Needed by AdminLogic/app-logic event listener
export const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer'); // Needed by AdminLogic
export const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId'); // Needed by AdminLogic
export const profileForm = document.getElementById('profileForm'); // Needed by app-logic event listener
export const settingsPage = document.getElementById('settingsPage'); // Needed by app-logic (showPage)
export const mainPage = document.getElementById('mainPage'); // Needed by app-logic (showPage)
export const homeBtn = document.getElementById('homeBtn'); // Needed by app-logic event listener
export const settingsBtn = document.getElementById('settingsBtn'); // Needed by app-logic event listener
export const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn'); // Needed by app-logic event listener
export const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn'); // Needed by app-logic event listener
export const settingsLogoutBtn = document.getElementById('settingsLogoutBtn'); // Needed by app-logic event listener
export const profileBtn = document.getElementById('profileBtn'); // Needed by app-logic event listener
export const contactToggle = document.getElementById('contactToggle'); // Needed by app-logic event listener
// Admin section containers needed by AdminLogic initialize/deinitialize
export const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
export const addSocialMediaForm = document.getElementById('addSocialMediaForm'); // Needed by AdminLogic event listener
export const socialLinksListContainer = document.getElementById('socialLinksListContainer'); // Needed by AdminLogic render
export const socialMediaToggle = document.getElementById('socialMediaToggle'); // Needed by AdminLogic event listener
// Notification elements
export const notificationBtn = document.getElementById('notificationBtn'); // Needed by app-logic event listener
export const notificationBadge = document.getElementById('notificationBadge'); // Needed by user-actions (checkNewAnnouncements)
export const notificationsSheet = document.getElementById('notificationsSheet'); // Needed? Maybe only ID needed by openPopup
export const notificationsListContainer = document.getElementById('notificationsListContainer'); // Needed by user-actions (renderUserNotifications)
// Admin Announcement elements
export const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
export const announcementForm = document.getElementById('announcementForm'); // Needed by AdminLogic event listener
// Terms elements
export const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn'); // Needed by app-logic event listener
export const termsSheet = document.getElementById('termsSheet'); // Needed? Maybe only ID needed by openPopup
export const termsContentContainer = document.getElementById('termsContentContainer'); // Needed by user-actions (renderPolicies)
// Admin Policies elements
export const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
export const policiesForm = document.getElementById('policiesForm'); // Needed by AdminLogic event listener
// SubSubcategories container (removed from main page, might not need export)
// export const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
// Admin Promo/Brand elements needed by AdminLogic
export const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');
export const adminBrandsManagement = document.getElementById('adminBrandsManagement');
// Subpage search elements
export const subpageSearchInput = document.getElementById('subpageSearchInput');
export const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
