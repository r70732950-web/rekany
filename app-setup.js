// --- app-setup.js ---
// Pênasekirin û sazkarîyên destpêkê

// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // Import only what's needed here
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Import only what's needed here
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js"; // Import only what's needed here

// Firebase Configuration (Keep your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE", // Sensitive data - consider environment variables for production
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

// Firestore Collections Exports (Import collection function from Firestore where needed)
import { collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoGroupsCollection = collection(db, "promo_groups");
export const brandGroupsCollection = collection(db, "brand_groups");
export const shortcutRowsCollection = collection(db, "shortcut_rows"); // Added export for shortcut rows

// --- Global State ---
export let state = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    deferredPrompt: null,
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: JSON.parse(localStorage.getItem("maten_store_profile")) || {},
    editingProductId: null,
    products: [],
    categories: [], // Core logic will fetch and populate this
    subcategories: [], // Core logic will fetch and populate this
    contactInfo: {}, // Core logic might fetch this
    lastVisibleProductDoc: null,
    isLoadingMoreProducts: false,
    allProductsLoaded: false,
    isRenderingHomePage: false,
    productCache: {},
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSubSubcategory: 'all',
    currentSearch: '',
    sliderIntervals: {} // Added for slider fix
};

// --- Constants ---
export const CART_KEY = "maten_store_cart";
export const FAVORITES_KEY = "maten_store_favorites";
export const PROFILE_KEY = "maten_store_profile";
export const PRODUCTS_PER_PAGE = 25; // Or your desired number

// --- Translations ---
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
        no_products_found: "هیچ کاڵایەک نەدۆزرایەوە.", // Added for empty search/filter
        product_no_name: "کاڵای بێ ناو", // Added for products missing names
        new_notification: "ئاگەداری نوێ" // Added for FCM
    },
    ku_badini: { /* ... وەرگێڕانەکانی بادینی لێرە دابنێ ... */ },
    ar: { /* ... وەرگێڕانەکانی عەرەبی لێرە دابنێ ... */ }
};

// --- Utility Functions ---

// *** دروستکرا *** : Translation function (Exported)
export function t(key, replacements = {}, options = { default: key }) {
    let lang = state.currentLanguage || 'ku_sorani'; // Use state for language
    let translation = (translations[lang] && translations[lang][key])
                   || (translations['ku_sorani'] && translations['ku_sorani'][key]) // Fallback to Sorani
                   || options.default; // Fallback to default provided or the key itself

    // Replace placeholders
    for (const placeholder in replacements) {
        // Use a regex for global replacement
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        translation = translation.replace(regex, replacements[placeholder]);
    }
    return translation;
}


// *** دروستکرا *** : Notification function (Exported)
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Add timeout logic for showing and hiding
    setTimeout(() => notification.classList.add('show'), 10); // Show after slight delay
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition finishes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // Should match CSS transition duration
    }, 3000); // How long the notification stays visible
}


// --- DOM Elements Exports ---
// Export references to DOM elements needed by core or UI logic

// Modals & Popups
export const loginModal = document.getElementById('loginModal');
export const welcomeModal = document.getElementById('welcomeModal');
export const productFormModal = document.getElementById('productFormModal');
export const editCategoryModal = document.getElementById('editCategoryModal');
export const addHomeSectionModal = document.getElementById('addHomeSectionModal');

// Sheets & Overlay
export const sheetOverlay = document.getElementById('sheet-overlay');
export const notificationsSheet = document.getElementById('notificationsSheet');
export const cartSheet = document.getElementById('cartSheet');
export const categoriesSheet = document.getElementById('categoriesSheet');
export const profileSheet = document.getElementById('profileSheet');
export const favoritesSheet = document.getElementById('favoritesSheet');
export const productDetailSheet = document.getElementById('productDetailSheet');
export const termsSheet = document.getElementById('termsSheet');

// Header Elements
export const searchInput = document.getElementById('searchInput');
export const clearSearchBtn = document.getElementById('clearSearchBtn');
export const notificationBtn = document.getElementById('notificationBtn');
export const notificationBadge = document.getElementById('notificationBadge');
// Subpage Header elements might be needed too
export const subpageSearchInput = document.getElementById('subpageSearchInput');
export const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

// Main Content Area Elements
export const mainPage = document.getElementById('mainPage');
export const subcategoryDetailPage = document.getElementById('subcategoryDetailPage'); // Needed for page switching
export const settingsPage = document.getElementById('settingsPage'); // Needed for page switching
export const mainCategoriesContainer = document.getElementById('mainCategoriesContainer');
export const subcategoriesContainer = document.getElementById('subcategoriesContainer');
export const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
export const homePageSectionsContainer = document.getElementById('homePageSectionsContainer');
export const loader = document.getElementById('loader');
export const skeletonLoader = document.getElementById('skeletonLoader');
export const productsContainer = document.getElementById('productsContainer');
export const scrollTrigger = document.getElementById('scroll-loader-trigger');

// Detail Page Elements
export const productsContainerOnDetailPage = document.getElementById('productsContainerOnDetailPage');
export const subSubCategoryContainerOnDetailPage = document.getElementById('subSubCategoryContainerOnDetailPage');
export const detailPageLoader = document.getElementById('detailPageLoader');

// Cart Elements
export const cartItemsContainer = document.getElementById('cartItemsContainer');
export const emptyCartMessage = document.getElementById('emptyCartMessage');
export const cartTotal = document.getElementById('cartTotal');
export const totalAmount = document.getElementById('totalAmount');
export const cartActions = document.getElementById('cartActions');

// Favorites Elements
export const favoritesContainer = document.getElementById('favoritesContainer');
export const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');

// Categories Sheet Elements
export const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');

// Profile Form Elements
export const profileForm = document.getElementById('profileForm');
// GPS button is handled within UI logic, might not need export unless core interacts

// Settings Page Elements
export const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
export const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
export const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
export const contactToggle = document.getElementById('contactToggle');
export const dynamicContactLinksContainer = document.getElementById('dynamicContactLinksContainer'); // Needed for UI render
export const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
export const installAppBtn = document.getElementById('installAppBtn'); // Needed for PWA logic in UI
export const enableNotificationsBtn = document.getElementById('enableNotificationsBtn'); // Needed for Notif logic in UI
export const forceUpdateBtn = document.getElementById('forceUpdateBtn'); // Needed for update logic in UI

// Terms Sheet Elements
export const termsContentContainer = document.getElementById('termsContentContainer');

// Notifications Sheet Elements
export const notificationsListContainer = document.getElementById('notificationsListContainer');

// Product Form Elements (Admin)
export const addProductBtn = document.getElementById('addProductBtn'); // Floating button
export const productForm = document.getElementById('productForm');
export const formTitle = document.getElementById('formTitle');
export const imageInputsContainer = document.getElementById('imageInputsContainer');
export const productCategorySelect = document.getElementById('productCategoryId');
export const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
export const productSubcategorySelect = document.getElementById('productSubcategoryId');
export const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
export const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');

// Admin Management Sections (Main containers needed if UI needs to toggle visibility based on auth)
export const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
export const adminCategoryManagement = document.getElementById('adminCategoryManagement');
export const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');
export const adminBrandsManagement = document.getElementById('adminBrandsManagement');
export const adminShortcutRowsManagement = document.getElementById('adminShortcutRowsManagement');
export const adminHomeLayoutManagement = document.getElementById('adminHomeLayoutManagement');
export const adminContactMethodsManagement = document.getElementById('adminContactMethodsManagement');
export const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
export const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
// Specific elements within admin sections are usually handled by admin.js or ui.js event listeners

// Bottom Navigation Buttons
export const homeBtn = document.getElementById('homeBtn');
export const categoriesBtn = document.getElementById('categoriesBtn');
export const cartBtn = document.getElementById('cartBtn');
export const profileBtn = document.getElementById('profileBtn');
export const settingsBtn = document.getElementById('settingsBtn');


// --- Global object for admin.js ---
// This remains necessary if admin.js is not an ES module
// Core logic will populate this in app-core.js
window.globalAdminTools = {};