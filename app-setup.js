// BEŞÊ YEKEM: app-setup.js
// Pênasekirin û sazkarîyên destpêkê

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc,
    deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
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

// --- START: Expose necessary Firebase functions and services globally for admin.js ---
// دروستکردنی ئۆبجێکتی گلۆباڵ
window.globalAdminTools = {
    // Firebase Services
    db: db,
    auth: auth,
    // Firestore Functions (needed by admin.js) - فانکشنەکانی فایەربەیس کە admin.js پێویستی پێیانە
    collection: collection,
    doc: doc,
    getDoc: getDoc,
    updateDoc: updateDoc,
    deleteDoc: deleteDoc,
    addDoc: addDoc,
    setDoc: setDoc,
    query: query,
    orderBy: orderBy,
    onSnapshot: onSnapshot,
    getDocs: getDocs,
    signOut: signOut, // Assuming admin might need to sign out via global tools too
    where: where,
    limit: limit,
    startAfter: startAfter,
    // Placeholder functions to be filled by other modules - فانکشنی کاتی کە دواتر لە فایلەکانی تر پڕ دەکرێنەوە
    showNotification: () => console.warn('showNotification not yet assigned to globalAdminTools'),
    t: (key) => key, // Basic translation fallback - وەرگێڕانی سەرەتایی
    openPopup: () => console.warn('openPopup not yet assigned to globalAdminTools'),
    closeCurrentPopup: () => console.warn('closeCurrentPopup not yet assigned to globalAdminTools'),
    searchProductsInFirestore: () => console.warn('searchProductsInFirestore not yet assigned to globalAdminTools'),
    setEditingProductId: (id) => { state.editingProductId = id; }, // Manage editing state here - لێرە ستەیتی دەستکاریکردن بەڕێوەببە
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide access to categories - ڕێگەدان بە گەیشتن بە جۆرەکان
    getCurrentLanguage: () => state.currentLanguage,
    clearProductCache: () => { state.productCache = {}; state.products = []; state.allProductsLoaded = false; state.lastVisibleProductDoc = null; console.log("Product cache cleared."); } // Fonksiyona paqijkirina cache
};
// --- END: Global Exposure ---


// Firestore Collections Exports (still useful for app-core/app-features) - هەناردەکردنی کۆلێکشنەکان (هێشتا بۆ فایلەکانی تر سوودیان هەیە)
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoGroupsCollection = collection(db, "promo_groups");
export const brandGroupsCollection = collection(db, "brand_groups");
// We no longer need to export shortcutRowsCollection here if admin.js uses the global `collection` function
// export const shortcutRowsCollection = collection(db, "shortcut_rows"); // Can be removed if not needed elsewhere

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
        link_copied: "لینک کۆپی کرا!", // Translate Link copied!
        get_location_gps: "وەرگرتنی ناونیشانم بە GPS", // Translate Get my location with GPS
        gps_not_supported: "GPS لەم وێبگەڕەدا پشتگیری نەکراوە.", // Translate GPS not supported in this browser.
        gps_loading: "...وەرگرتنی ناونیشان", // Translate ...Getting location
        address_retrieved: "ناونیشان وەرگیرا.", // Translate Address retrieved.
        address_not_found: "نەتوانرا ناونیشان بدۆزرێتەوە.", // Translate Could not find address.
        error_getting_address: "هەڵە لە وەرگرتنی ناونیشان.", // Translate Error getting address.
        gps_permission_denied: "ڕێگەپێدانی GPS ڕەتکرایەوە.", // Translate GPS permission denied.
        gps_position_unavailable: "زانیاری شوێن بەردەست نییە.", // Translate Location information is unavailable.
        gps_timeout: "کاتی وەرگرتنی شوێن بەسەرچوو.", // Translate Location request timed out.
        gps_error_unknown: "هەڵەیەکی نەزانراو لە GPS ڕوویدا.", // Translate Unknown GPS error occurred.
        increase_quantity: "زیادکردنی بڕ", // Translate Increase quantity
        decrease_quantity: "کەمکردنی بڕ", // Translate Decrease quantity
        remove_item: "سڕینەوەی دانە", // Translate Remove item
        subtotal: "کۆی بچووک", // Translate Subtotal
        toggle_favorite: "گۆڕینی دڵخواز", // Translate Toggle favorite
        add_to_favorites: "زیادکردن بۆ دڵخوازەکان", // Translate Add to favorites
        remove_from_favorites: "سڕینەوە لە دڵخوازەکان", // Translate Remove from favorites
        edit_product: "دەستکاریکردنی کاڵا", // Translate Edit product
        delete_product: "سڕینەوەی کاڵا", // Translate Delete product
        product_no_name: "ناوی کاڵا نییە", // Translate Product has no name
        no_products_found: "هیچ کاڵایەک نەدۆزرایەوە.", // Translate No products found.
        notification_permission_granted: "ڕێگەپێدانی ئاگەدارکردنەوە درا.", // Translate Notification permission granted.
        notification_permission_denied: "ڕێگەپێدانی ئاگەدارکردنەوە ڕەتکرایەوە.", // Translate Notification permission denied.
        no_send_methods: "هیچ شێوازێکی ناردن دیاری نەکراوە.", // Translate No sending methods defined.
        error_loading_send_methods: "هەڵە لە بارکردنی شێوازەکانی ناردن.", // Translate Error loading sending methods.
        no_contact_links: "هیچ لینکی پەیوەندی زیاد نەکراوە.", // Translate No contact links added.
        category_added_success: "جۆری سەرەکی زیادکرا.", // Translate Main category added successfully.
        subcategory_added_success: "جۆری لاوەکی زیادکرا.", // Translate Subcategory added successfully.
        subsubcategory_added_success: "جۆری لاوەکیی لاوەکی زیادکرا.", // Translate Sub-subcategory added successfully.
        category_updated_success: "گۆڕانکارییەکان پاشەکەوت کران.", // Translate Changes saved.
        category_delete_confirm: "دڵنیایت دەتەوێت جۆری '{categoryName}' بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.", // Translate Are you sure you want to delete the category '{categoryName}'?\nWarning: This will also delete all its subcategories.
        category_deleted_success: "جۆرەکە سڕدرایەوە.", // Translate Category deleted.
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
        link_copied: "لینک هاتە کۆپی کرن!", // Translate Link copied!
        get_location_gps: "وەرگرتنا ناڤ و نیشانێن من ب GPS", // Translate Get my location with GPS
        gps_not_supported: "GPS ل ڤێ وێبگەرێ ناهێتە پشتەڤانیکرن.", // Translate GPS not supported in this browser.
        gps_loading: "...وەرگرتنا ناڤ و نیشانان", // Translate ...Getting location
        address_retrieved: "ناڤ و نیشان هاتنە وەرگرتن.", // Translate Address retrieved.
        address_not_found: "نەشهات ناڤ و نیشانان ببینیت.", // Translate Could not find address.
        error_getting_address: "خەلەتی د وەرگرتنا ناڤ و نیشانان دا.", // Translate Error getting address.
        gps_permission_denied: "دەستووریا GPS هاتە رەتکرن.", // Translate GPS permission denied.
        gps_position_unavailable: "پێزانینێن جهی بەردەست نینن.", // Translate Location information is unavailable.
        gps_timeout: "دەمێ داخوازا جهی ب دوماهیک هات.", // Translate Location request timed out.
        gps_error_unknown: "خەلەتیەکا نەدیار یا GPS چێبوو.", // Translate Unknown GPS error occurred.
        increase_quantity: "زێدەکرنا بڕی", // Translate Increase quantity
        decrease_quantity: "کێمکرنا بڕی", // Translate Decrease quantity
        remove_item: "ژێبرنا دانەی", // Translate Remove item
        subtotal: "کۆمێ بچووک", // Translate Subtotal
        toggle_favorite: "گوهارتنا حەزژێکری", // Translate Toggle favorite
        add_to_favorites: "زێدەکرن بۆ حەزژێکریان", // Translate Add to favorites
        remove_from_favorites: "ژێبرن ژ حەزژێکریان", // Translate Remove from favorites
        edit_product: "دەستکاریکرنا کاڵای", // Translate Edit product
        delete_product: "ژێبرنا کاڵای", // Translate Delete product
        product_no_name: "ناڤێ کاڵای نینە", // Translate Product has no name
        no_products_found: "چ کاڵا نەهاتنە دیتن.", // Translate No products found.
        notification_permission_granted: "دەستووریا ئاگەهدارکرنێ هاتە دان.", // Translate Notification permission granted.
        notification_permission_denied: "دەستووریا ئاگەهدارکرنێ هاتە رەتکرن.", // Translate Notification permission denied.
        no_send_methods: "چ رێکێن فرێکرنێ نەهاتینە دیارکرن.", // Translate No sending methods defined.
        error_loading_send_methods: "خەلەتی د بارکرنا رێکێن فرێکرنێ دا.", // Translate Error loading sending methods.
        no_contact_links: "چ لینکێن پەیوەندیێ نەهاتینە زێدەکرن.", // Translate No contact links added.
        category_added_success: "جۆرێ سەرەکی هاتە زێدەکرن.", // Translate Main category added successfully.
        subcategory_added_success: "جۆرێ لاوەکی هاتە زێدەکرن.", // Translate Subcategory added successfully.
        subsubcategory_added_success: "جۆرێ لاوەکیێ لاوەکی هاتە زێدەکرن.", // Translate Sub-subcategory added successfully.
        category_updated_success: "گوهارتن هاتنە پاشەکەفتکرن.", // Translate Changes saved.
        category_delete_confirm: "تو پشتڕاستی دێ جۆرێ '{categoryName}' ژێبەی؟\nئاگەهداربە: دێ هەمی جۆرێن لاوەکی ژی هێنە ژێبرن.", // Translate Are you sure you want to delete the category '{categoryName}'?\nWarning: This will also delete all its subcategories.
        category_deleted_success: "جۆر هاتە ژێبرن.", // Translate Category deleted.
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
        link_copied: "تم نسخ الرابط!", // Translate Link copied!
        get_location_gps: "الحصول على موقعي بـ GPS", // Translate Get my location with GPS
        gps_not_supported: "GPS غير مدعوم في هذا المتصفح.", // Translate GPS not supported in this browser.
        gps_loading: "...جاري تحديد الموقع", // Translate ...Getting location
        address_retrieved: "تم استرداد العنوان.", // Translate Address retrieved.
        address_not_found: "تعذر العثور على العنوان.", // Translate Could not find address.
        error_getting_address: "خطأ في الحصول على العنوان.", // Translate Error getting address.
        gps_permission_denied: "تم رفض إذن GPS.", // Translate GPS permission denied.
        gps_position_unavailable: "معلومات الموقع غير متوفرة.", // Translate Location information is unavailable.
        gps_timeout: "انتهت مهلة طلب الموقع.", // Translate Location request timed out.
        gps_error_unknown: "حدث خطأ GPS غير معروف.", // Translate Unknown GPS error occurred.
        increase_quantity: "زيادة الكمية", // Translate Increase quantity
        decrease_quantity: "تقليل الكمية", // Translate Decrease quantity
        remove_item: "إزالة العنصر", // Translate Remove item
        subtotal: "المجموع الفرعي", // Translate Subtotal
        toggle_favorite: "تبديل المفضلة", // Translate Toggle favorite
        add_to_favorites: "إضافة إلى المفضلة", // Translate Add to favorites
        remove_from_favorites: "إزالة من المفضلة", // Translate Remove from favorites
        edit_product: "تعديل المنتج", // Translate Edit product
        delete_product: "حذف المنتج", // Translate Delete product
        product_no_name: "المنتج ليس له اسم", // Translate Product has no name
        no_products_found: "لم يتم العثور على منتجات.", // Translate No products found.
        notification_permission_granted: "تم منح إذن الإشعارات.", // Translate Notification permission granted.
        notification_permission_denied: "تم رفض إذن الإشعارات.", // Translate Notification permission denied.
        no_send_methods: "لم يتم تحديد طرق إرسال.", // Translate No sending methods defined.
        error_loading_send_methods: "خطأ في تحميل طرق الإرسال.", // Translate Error loading sending methods.
        no_contact_links: "لم يتم إضافة روابط تواصل.", // Translate No contact links added.
        category_added_success: "تمت إضافة الفئة الرئيسية.", // Translate Main category added successfully.
        subcategory_added_success: "تمت إضافة الفئة الفرعية.", // Translate Subcategory added successfully.
        subsubcategory_added_success: "تمت إضافة الفئة الفرعية الفرعية.", // Translate Sub-subcategory added successfully.
        category_updated_success: "تم حفظ التغييرات.", // Translate Changes saved.
        category_delete_confirm: "هل أنت متأكد من حذف الفئة '{categoryName}'؟\nتحذير: سيؤدي هذا أيضًا إلى حذف جميع فئاتها الفرعية.", // Translate Are you sure you want to delete the category '{categoryName}'?\nWarning: This will also delete all its subcategories.
        category_deleted_success: "تم حذف الفئة.", // Translate Category deleted.
    }
};

// Global State Variables (Mutable) - گۆڕاوی ستەیتی گشتی
export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null,
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: JSON.parse(localStorage.getItem("maten_store_profile")) || {},
    editingProductId: null, // Moved here from globalAdminTools - گواسترایەوە بۆ ئێرە
    products: [],
    allPromoCards: [],
    currentPromoCardIndex: 0,
    promoRotationInterval: null,
    categories: [],
    contactInfo: {},
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
};

// Constants - نەگۆڕەکان
export const CART_KEY = "maten_store_cart";
export const FAVORITES_KEY = "maten_store_favorites";
export const PROFILE_KEY = "maten_store_profile";
export const PRODUCTS_PER_PAGE = 25;

// DOM Elements Exports (can be reduced if not needed globally) - هەناردەکردنی ئلێمێنتەکانی دۆم
// تێبینی: باشتر وایە هەموو ئەمانە لێرە نەبن، بەڵکو هەر فایلێک خۆی ئاماژە بە پێویستییەکانی بکات
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
export const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
export const addSocialMediaForm = document.getElementById('addSocialMediaForm');
export const socialLinksListContainer = document.getElementById('socialLinksListContainer');
export const socialMediaToggle = document.getElementById('socialMediaToggle');
export const notificationBtn = document.getElementById('notificationBtn');
export const notificationBadge = document.getElementById('notificationBadge');
export const notificationsSheet = document.getElementById('notificationsSheet');
export const notificationsListContainer = document.getElementById('notificationsListContainer');
export const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
export const announcementForm = document.getElementById('announcementForm');
export const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
export const termsSheet = document.getElementById('termsSheet');
export const termsContentContainer = document.getElementById('termsContentContainer');
export const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
export const policiesForm = document.getElementById('policiesForm');
export const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
export const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');
export const adminBrandsManagement = document.getElementById('adminBrandsManagement');

// Make sure other modules populate the globalAdminTools with their specific functions
// دڵنیا ببەوە کە فایلەکانی تر فانکشنە تایبەتەکانیان دەخەنە ناو globalAdminTools
// Example in app-core.js: Object.assign(window.globalAdminTools, { showNotification, t, ... });
// Example in app-features.js: Object.assign(window.globalAdminTools, { renderMainCategories, ... });
