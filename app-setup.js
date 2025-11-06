// BEŞÊ YEKEM: app-setup.js (Çakkirî bo exportên UI û globalAdminTools)
// Pênasekirin û sazkarîyên destpêkê

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
// === START: KODA NÛ / کۆدی نوێ ===
// Em xizmetguzariya Storage lê zêde dikin
// ئێمە خزمەتگوزاری ستۆرێج زیاد دەکەین
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE", // Ensure this key is correct and secured if necessary
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    
    // === VÊ BIGUHERE / ئەمە بگۆڕە ===
    // Nêrîna xwe biguherîne li ser vê yekê
    // تکایە ئەم دێڕە ڕاست بکەرەوە
    storageBucket: "maten-store.appspot.com", // <-- HATE RASTKIRIN / لێرە ڕاستکرایەوە
    // === DAWÎYA GUHERTINÊ / کۆتایی گۆڕانکاری ===

    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// Initialization and Exports (for app-core.js and app-ui.js)
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);
// === START: KODA NÛ / کۆدی نوێ ===
// Em 'storage' initialize dikin
// ئێمە 'storage' ئامادە دەکەین
export const storage = getStorage(app);
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// Firestore Collections Exports (for app-core.js and app-ui.js)
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoGroupsCollection = collection(db, "promo_groups");
export const brandGroupsCollection = collection(db, "brand_groups");
export const shortcutRowsCollection = collection(db, "shortcut_rows");

// Translations Export
export const translations = {
    // ... (هەموو وەرگێڕانەکان وەک خۆیان دەمێننەوە) ...
    // ... (Hemî wergêran wek xwe dimînin) ...
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
        nav_home: "سەرەki",
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
        all_categories_label: "هەموو",
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
        has_discount_badge: "داشکانی تێدایە",
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
        nav_home: "سەرەki",
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
        all_categories_label: "هەمی",
        install_app: "دامەزراندنا ئەپی",
        product_added_to_cart: "کاڵا هاتە زێدەکرن بۆ سەلکێ",
        product_added_to_favorites: "هاتە زێدەکرن بۆ لیستا حەزژێکریان",
        product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێبرن",
        manage_categories_title: "рێکخستنا جوران",
        manage_contact_methods_title: "рێکخستنا رێکێن فرێکرنا داخازیێ",
        notifications_title: "ئاگەهداری",
        no_notifications_found: "چ ئاگەهداری نینن",
        manage_announcements_title: "рێکخستنا ئاگەهداریان",
        send_new_announcement: "فرێکرنا ئاگەهداریەکا نوو",
        send_announcement_button: "ئاگەهداریێ فرێکە",
        sent_announcements: "ئاگەهداریێن هاتینە فرێکرن",
        no_announcements_sent: "چ ئاگەهداری نەهاتینە فرێکرن",
        announcement_deleted_success: "ئاگەهداری هاتە ژێبرن",
        announcement_delete_confirm: "تو پشتڕاستی دێ ڤێ ئaگەهداریێ ژێبەی؟",
        enable_notifications: "چالاکرنا ئاگەهداریان",
        error_generic: "خەلەتییەک چێبوو!",
        terms_policies_title: "مەرج و سیاسەت",
        manage_policies_title: "рێکخستنا مەرج و سیاسەتان",
        policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن",
        loading_policies: "...د بارکرنا سیاسەتان دایە",
        no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.",
        has_discount_badge: "داشکان تێدایە",
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
        all_categories_label: "الكل",
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
        has_discount_badge: "يتضمن خصم",
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
    }
};


// Global State Variables (Mutable) - Exported for app-core.js and app-ui.js
export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null,
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: JSON.parse(localStorage.getItem("maten_store_profile")) || {},
    editingProductId: null, // Used by Admin
    products: [],
    categories: [], // Populated by app-core
    subcategories: [], // Populated by app-core
    lastVisibleProductDoc: null,
    isLoadingMoreProducts: false,
    allProductsLoaded: false,
    isRenderingHomePage: false,
    productCache: {},
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSubSubcategory: 'all',
    currentSearch: '',
    currentProductId: null, // Used by app-ui
    currentPageId: 'mainPage', // *** زیادکرا: بۆ زانینی پەڕەی ئێستا ***
    currentPopupState: null, // *** زیادکرا: شوێنی دۆخی ئێستای پۆپئەپ بگرە ***
    // *** START: Gۆڕانکاری لێرە کرا ***
    // *** دەستپێک: گۆڕانکاری لێرە کرا ***
    pendingFilterNav: null, // Ji bo ragirtina fîlterê heta ku popup were girtin (بۆ ڕاگرتنی فلتەر تا داخستنی پۆپئەپ)
    // *** END: Gۆڕانکاری لێرە کرا ***
    // *** کۆتایی: Gۆڕانکاری لێرە کرا ***
    sliderIntervals: {}, // Used by app-ui & app-core
    contactInfo: {}, // Might be needed?
};

// Constants - Exported
export const CART_KEY = "maten_store_cart";
export const FAVORITES_KEY = "maten_store_favorites";
export const PROFILE_KEY = "maten_store_profile";
export const PRODUCTS_PER_PAGE = 25;

// DOM Elements Exports
// === General UI Elements ===
export const loginModal = document.getElementById('loginModal');
export const addProductBtn = document.getElementById('addProductBtn'); // Used by admin check in UI
export const productFormModal = document.getElementById('productFormModal');
export const productsContainer = document.getElementById('productsContainer');
export const skeletonLoader = document.getElementById('skeletonLoader');
export const searchInput = document.getElementById('searchInput');
export const clearSearchBtn = document.getElementById('clearSearchBtn');
export const loginForm = document.getElementById('loginForm');
export const productForm = document.getElementById('productForm');
export const formTitle = document.getElementById('formTitle');
// === START: Gۆڕانکاری / دەستپێک ===
// Em êdî vê rêzê bikar naynin (ئیتر ئەم دێڕە بەکارناهێنین)
// export const imageInputsContainer = document.getElementById('imageInputsContainer');
// === END: Gۆڕانکاری / کۆتایی ===
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
export const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); // Main page sub-subcat container

// === Admin UI Elements ===
export const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
export const policiesForm = document.getElementById('policiesForm');
export const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
export const addSocialMediaForm = document.getElementById('addSocialMediaForm');
export const socialLinksListContainer = document.getElementById('socialLinksListContainer');
export const socialMediaToggle = document.getElementById('socialMediaToggle');
export const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
export const announcementForm = document.getElementById('announcementForm');
export const announcementsListContainer = document.getElementById('announcementsListContainer'); // Used by admin.js
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

// === START: BEŞÊN NÛ / بەشە نوێیەکان ===
export const adminCategoryLayoutManagement = document.getElementById('adminCategoryLayoutManagement');
export const categoryLayoutSelect = document.getElementById('categoryLayoutSelect');
export const categoryLayoutBuilderContainer = document.getElementById('categoryLayoutBuilderContainer');
export const categoryLayoutTitle = document.getElementById('categoryLayoutTitle');
export const addCategoryLayoutSectionBtn = document.getElementById('addCategoryLayoutSectionBtn');
export const categoryLayoutListContainer = document.getElementById('categoryLayoutListContainer');
export const saveCategoryLayoutBtn = document.getElementById('saveCategoryLayoutBtn');
export const addCategoryLayoutSectionModal = document.getElementById('addCategoryLayoutSectionModal');
export const addCategoryLayoutSectionForm = document.getElementById('addCategoryLayoutSectionForm');
export const newCategoryLayoutSectionType = document.getElementById('newCategoryLayoutSectionType');
export const specificCategoryLayoutItemGroupSelectContainer = document.getElementById('specificCategoryLayoutItemGroupSelectContainer');
export const specificCategoryLayoutItemGroupId = document.getElementById('specificCategoryLayoutItemGroupId');
export const specificCategoryLayoutItemGroupLabel = document.getElementById('specificCategoryLayoutItemGroupLabel');
export const specificCategoryLayoutCategorySelectContainer = document.getElementById('specificCategoryLayoutCategorySelectContainer');
export const newCategoryLayoutSectionMainCategory = document.getElementById('newCategoryLayoutSectionMainCategory');
export const newCategoryLayoutSectionSubcategoryContainer = document.getElementById('newCategoryLayoutSectionSubcategoryContainer');
export const newCategoryLayoutSectionSubcategory = document.getElementById('newCategoryLayoutSectionSubcategory');
export const newCategoryLayoutSectionSubSubcategoryContainer = document.getElementById('newCategoryLayoutSectionSubSubcategoryContainer');
export const newCategoryLayoutSectionSubSubcategory = document.getElementById('newCategoryLayoutSectionSubSubcategory');
export const newCategoryLayoutSectionName = document.getElementById('newCategoryLayoutSectionName');
// === END: BEŞÊN NÛ / کۆتایی بەشە نوێیەکان ===


// *** Populate globalAdminTools here ***
// Moved from app-core.js to ensure availability before admin.js (defer) runs
window.globalAdminTools = {
    // Firebase Services & Functions needed by admin.js
    db, auth,
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em xizmetguzarî û fonksiyonên Storage lê zêde dikin
    // ئێمە خزمەتگوزاری و فەنکشنەکانی ستۆرێج زیاد دەکەین
    storage, ref, uploadBytes, getDownloadURL,
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection,
    query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,

    // Collections needed by admin.js
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,

    // Core State Accessors/Mutators needed by admin.js
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories,
    getCurrentLanguage: () => state.currentLanguage,

    // Core Helper Functions needed by admin.js
    t: (key, replacements = {}) => { // Re-export 't' function
        let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
        for (const placeholder in replacements) {
            translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return translation;
    },
    showNotification: (message, type = 'success') => { // Re-export basic notification logic
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
     clearProductCache: () => { // Keep this helper
          console.log("Product cache and home page cleared due to admin action.");
          state.productCache = {};
          const homeContainer = document.getElementById('homePageSectionsContainer');
          if (homeContainer) {
              homeContainer.innerHTML = '';
          }
          // Notify UI layer to trigger re-render
          document.dispatchEvent(new Event('clearCacheTriggerRender'));
     },
};
// *** END OF globalAdminTools SECTION ***