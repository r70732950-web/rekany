import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// Initialization
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Make Firebase services and helper functions globally available for admin.js
window.globalAdminTools = {};

// Firestore Collections
const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");
const promoCardsCollection = collection(db, "promo_cards");
const brandsCollection = collection(db, "brands");

// Translations
const translations = {
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

// Global State
let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
let deferredPrompt;
const CART_KEY = "maten_store_cart";
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
const FAVORITES_KEY = "maten_store_favorites";
let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
const PROFILE_KEY = "maten_store_profile";
let userProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
let editingProductId = null;
let products = [];
let allPromoCards = [];
let currentPromoCardIndex = 0;
let promoRotationInterval = null;
let categories = [];
let contactInfo = {};
let subcategories = [];
let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
const PRODUCTS_PER_PAGE = 25;
let isRenderingHomePage = false;

// === START: NEW CACHING AND STATE VARIABLES ===
let productCache = {}; // Cache for first page of products
let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSubSubcategory = 'all';
let currentSearch = '';
// === END: NEW CACHING AND STATE VARIABLES ===

// DOM Elements
const loginModal = document.getElementById('loginModal');
const addProductBtn = document.getElementById('addProductBtn');
const productFormModal = document.getElementById('productFormModal');
const productsContainer = document.getElementById('productsContainer');
const skeletonLoader = document.getElementById('skeletonLoader');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const loginForm = document.getElementById('loginForm');
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const imageInputsContainer = document.getElementById('imageInputsContainer');
const loader = document.getElementById('loader');
const cartBtn = document.getElementById('cartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const emptyCartMessage = document.getElementById('emptyCartMessage');
const cartTotal = document.getElementById('cartTotal');
const totalAmount = document.getElementById('totalAmount');
const cartActions = document.getElementById('cartActions');
const favoritesContainer = document.getElementById('favoritesContainer');
const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
const categoriesBtn = document.getElementById('categoriesBtn');
const sheetOverlay = document.getElementById('sheet-overlay');
const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
const productCategorySelect = document.getElementById('productCategoryId');
const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');
const profileForm = document.getElementById('profileForm');
const settingsPage = document.getElementById('settingsPage');
const mainPage = document.getElementById('mainPage');
const homeBtn = document.getElementById('homeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
const profileBtn = document.getElementById('profileBtn');
const contactToggle = document.getElementById('contactToggle');
const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
const addSocialMediaForm = document.getElementById('addSocialMediaForm');
const socialLinksListContainer = document.getElementById('socialLinksListContainer');
const socialMediaToggle = document.getElementById('socialMediaToggle');
const notificationBtn = document.getElementById('notificationBtn');
const notificationBadge = document.getElementById('notificationBadge');
const notificationsSheet = document.getElementById('notificationsSheet');
const notificationsListContainer = document.getElementById('notificationsListContainer');
const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
const announcementForm = document.getElementById('announcementForm');
const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
const termsSheet = document.getElementById('termsSheet');
const termsContentContainer = document.getElementById('termsContentContainer');
const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
const policiesForm = document.getElementById('policiesForm');
const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');
const adminBrandsManagement = document.getElementById('adminBrandsManagement');


function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : 'settingsBtn';
    updateActiveNav(activeBtnId);
}

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = userProfile.name || '';
            document.getElementById('profileAddress').value = userProfile.address || '';
            document.getElementById('profilePhone').value = userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

// === START: HISTORY AND STATE MANAGEMENT (UPDATED) ===

async function applyFilterState(state, fromPopState = false) {
    currentCategory = state.category || 'all';
    currentSubcategory = state.subcategory || 'all';
    currentSubSubcategory = state.subSubcategory || 'all';
    currentSearch = state.search || '';

    searchInput.value = currentSearch;
    clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
    
    renderMainCategories();
    // Let renderSubcategories handle its own children
    await renderSubcategories(currentCategory); 

    await searchProductsInFirestore(currentSearch, true);

    if (fromPopState && typeof state.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, state.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function navigateToFilter(newState) {
    const currentState = {
        category: currentCategory,
        subcategory: currentSubcategory,
        subSubcategory: currentSubSubcategory,
        search: currentSearch,
        scroll: window.scrollY
    };
    history.replaceState(currentState, '');

    const finalState = { ...currentState, ...newState, scroll: 0 };
    
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    
    history.pushState(finalState, '', newUrl);
    
    await applyFilterState(finalState);
}

window.addEventListener('popstate', (event) => {
    closeAllPopupsUI();
    const state = event.state;
    if (state) {
        if (state.type === 'page') {
            showPage(state.id);
        } else if (state.type === 'sheet' || state.type === 'modal') {
            openPopup(state.id, state.type);
        } else {
            applyFilterState(state, true);
        }
    } else {
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        applyFilterState(defaultState);
        showPage('mainPage');
    }
});

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    if (hash === 'settingsPage') {
        showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, '');
        applyFilterState(initialState);
    }
    
    const element = document.getElementById(hash);
    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }
    
    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500);
    }
}
// === END: HISTORY AND STATE MANAGEMENT (UPDATED) ===


function t(key, replacements = {}) {
    let translation = (translations[currentLanguage] && translations[currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}


function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const isHomeView = !currentSearch && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';
    if (isHomeView) {
        renderHomePageContent();
    } else {
        renderProducts();
    }

    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            setTimeout(() => {
                window.location.reload(true);
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

function updateContactLinksUI() {
    if (!contactInfo) return;
}

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification('مۆڵەت نەدرا', 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now()
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

function toggleFavorite(productId) {
    const productIndex = favorites.indexOf(productId);
    if (productIndex > -1) {
        favorites.splice(productIndex, 1);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    const isHomeView = !currentSearch && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';
    if(isHomeView) {
        renderHomePageContent();
    } else {
        renderProducts();
    }

    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

function renderFavoritesPage() {
    favoritesContainer.innerHTML = '';
    const favoritedProducts = products.filter(p => favorites.includes(p.id));

    if (favoritedProducts.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
    } else {
        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';
        favoritedProducts.forEach(product => {
            const productCard = createProductCardElement(product);
            favoritesContainer.appendChild(productCard);
        });
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup();
            showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

async function renderSubSubcategories(mainCatId, subCatId) {
    subSubcategoriesContainer.innerHTML = '';
    if (subCatId === 'all' || !mainCatId) return;

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${currentSubSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             await navigateToFilter({ subSubcategory: 'all' });
        };
        subSubcategoriesContainer.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn ${currentSubSubcategory === subSubcat.id ? 'active' : ''}`;

            const subSubcatName = subSubcat['name_' + currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;

            btn.innerHTML = `
                <img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subSubcatName}</span>
            `;
            
            btn.onclick = async () => {
                await navigateToFilter({ subSubcategory: subSubcat.id });
            };
            subSubcategoriesContainer.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
    }
}

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';
    // Clear sub-subcategories here explicitly before re-rendering
    subSubcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') {
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (subcategories.length === 0) return;

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${currentSubcategory === subcat.id ? 'active' : ''}`;
            
            const subcatName = subcat['name_' + currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
        
            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;
            
            subcatBtn.onclick = async () => {
                 await navigateToFilter({
                    subcategory: subcat.id,
                    subSubcategory: 'all'
                });
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

        // This is the crucial part: after rendering subcategories, render their children if one is active.
        if (currentSubcategory && currentSubcategory !== 'all') {
            await renderSubSubcategories(categoryId, currentSubcategory);
        }
    } catch (error) {
        console.error("Error fetching subcategories: ", error);
    }
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
        };

        container.appendChild(btn);
    });
}

function showProductDetails(productId) {
    const allFetchedProducts = [...products];
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found for details view. Trying to fetch...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        });
        return;
    }
    showProductDetailsWithData(product);
}

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; 
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
       q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
    }
}

function showProductDetailsWithData(product) {
    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }

    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup();
    };

    const shareButton = document.getElementById('sheetShareBtn');
    shareButton.onclick = async () => {
        const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani);
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;

        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                console.log('Product shared successfully');
            } catch (err) {
                console.error('Share error:', err);
                if (err.name !== 'AbortError') {
                       showNotification(t('share_error'), 'error');
                }
            }
        } else {
            try {
                navigator.clipboard.writeText(productUrl);
                showNotification('لینکی کاڵا کۆپی کرا!', 'success');
            } catch (err) {
                console.error('Fallback share error:', err);
                showNotification(t('share_error'), 'error');
            }
        }
    };
    
    renderRelatedProducts(product);

    openPopup('productDetailSheet');
}

function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';

    const imageUrl = card.imageUrls[currentLanguage] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = card.categoryId;
            const categoryExists = categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                document.getElementById('mainCategoriesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(-1);
    });

    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(1);
    });

    return cardElement;
}

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';


    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[currentLanguage] && product.shippingInfo[currentLanguage].trim();

    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            addToCart(product.id);
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}

function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader() {
    skeletonLoader.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        skeletonLoader.appendChild(skeletonCard);
    }
    skeletonLoader.style.display = 'grid';
    productsContainer.style.display = 'none';
    loader.style.display = 'none';
}

function renderProducts() {
    productsContainer.innerHTML = '';
	if (!products || products.length === 0) {
		return;
	}

    products.forEach(item => {
        let element;
        if (item.isPromoCard) {
            element = createPromoCardElement(item);
        } else {
            element = createProductCardElement(item);
        }
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
}

async function renderShortcutRows() {
    const mainContainer = document.createDocumentFragment();

    try {
        const shortcutRowsCollection = collection(db, "shortcut_rows");
        const rowsQuery = query(shortcutRowsCollection, orderBy("order", "asc"));
        const rowsSnapshot = await getDocs(rowsQuery);

        if (rowsSnapshot.empty) {
            return null;
        }
        
        for (const rowDoc of rowsSnapshot.docs) {
            const rowData = { id: rowDoc.id, ...rowDoc.data() };
            const rowTitle = rowData.title[currentLanguage] || rowData.title.ku_sorani;
            
            const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
            const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
            const cardsSnapshot = await getDocs(cardsQuery);

            if (!cardsSnapshot.empty) {
                const sectionContainer = document.createElement('div');
                sectionContainer.className = 'shortcut-cards-section';
                
                const titleElement = document.createElement('h3');
                titleElement.className = 'shortcut-row-title';
                titleElement.textContent = rowTitle;
                sectionContainer.appendChild(titleElement);
                
                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'shortcut-cards-container';
                sectionContainer.appendChild(cardsContainer);

                cardsSnapshot.forEach(cardDoc => {
                    const cardData = cardDoc.data();
                    const cardName = cardData.name[currentLanguage] || cardData.name.ku_sorani;

                    const item = document.createElement('div');
                    item.className = 'shortcut-card';
                    item.innerHTML = `
                        <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                        <div class="shortcut-card-name">${cardName}</div>
                    `;

                    item.onclick = async () => {
                        await navigateToFilter({
                            category: cardData.categoryId || 'all',
                            subcategory: cardData.subcategoryId || 'all',
                            subSubcategory: cardData.subSubcategoryId || 'all',
                            search: ''
                        });
                    };
                    cardsContainer.appendChild(item);
                });
                
                mainContainer.appendChild(sectionContainer);
            }
        }
        
        return mainContainer;

    } catch (error) {
        console.error("Error fetching shortcut rows:", error);
        return null;
    }
}

async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = 'brandsContainer';
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                await navigateToFilter({
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all',
                    search: ''
                });
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null;
    }
}


async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);
    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    container.appendChild(productsScroller);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderCategorySections() {
    const mainContainer = document.createElement('div');
    const categoriesToRender = categories.filter(cat => cat.id !== 'all');
    categoriesToRender.sort((a, b) => (a.order || 99) - (b.order || 99));

    for (const category of categoriesToRender) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';

        const header = document.createElement('div');
        header.className = 'section-title-header';

        const title = document.createElement('h3');
        title.className = 'section-title-main';
        const categoryName = category['name_' + currentLanguage] || category.name_ku_sorani;
        title.innerHTML = `<i class="${category.icon}"></i> ${categoryName}`;
        header.appendChild(title);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             await navigateToFilter({
                category: category.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
        };
        header.appendChild(seeAllLink);

        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        sectionContainer.appendChild(productsScroller);

        try {
            const q = query(
                productsCollection,
                where('categoryId', '==', category.id),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const card = createProductCardElement(product);
                    productsScroller.appendChild(card);
                });
                mainContainer.appendChild(sectionContainer);
            }
        } catch (error) {
            console.error(`Error fetching products for category ${category.id}:`, error);
        }
    }
    return mainContainer;
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

async function renderHomePageContent() {
    if (isRenderingHomePage) {
        return;
    }
    isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        skeletonLoader.style.display = 'grid';
        homeSectionsContainer.innerHTML = '';

        if (allPromoCards.length === 0) {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
        }

        let promoGrid = null;
        if (allPromoCards.length > 0) {
            if (currentPromoCardIndex >= allPromoCards.length) currentPromoCardIndex = 0;
            const promoCardElement = createPromoCardElement(allPromoCards[currentPromoCardIndex]);
            promoGrid = document.createElement('div');
            promoGrid.className = 'products-container';
            promoGrid.style.marginBottom = '24px';
            promoGrid.appendChild(promoCardElement);
            startPromoRotation();
        }

        const [brandsSection, newestSection, categorySections, shortcutRowsFragment, allProductsSection] = await Promise.all([
            renderBrandsSection(),
            renderNewestProductsSection(),
            renderCategorySections(),
            renderShortcutRows(),
            renderAllProductsSection()
        ]);

        if (promoGrid) homeSectionsContainer.appendChild(promoGrid);
        if (brandsSection) homeSectionsContainer.appendChild(brandsSection);
        if (newestSection) homeSectionsContainer.appendChild(newestSection);
        if (categorySections) homeSectionsContainer.appendChild(categorySections);
        if (shortcutRowsFragment) homeSectionsContainer.appendChild(shortcutRowsFragment);
        if (allProductsSection) homeSectionsContainer.appendChild(allProductsSection);

    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p>هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        skeletonLoader.style.display = 'none';
        isRenderingHomePage = false;
    }
}

async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        if (isNewSearch) {
            productsContainer.style.display = 'none';
            scrollTrigger.style.display = 'none';
            homeSectionsContainer.style.display = 'block';
            await renderHomePageContent();
        }
        return;
    } else {
        homeSectionsContainer.innerHTML = '';
        homeSectionsContainer.style.display = 'none';
    }
    
    const cacheKey = `${currentCategory}-${currentSubcategory}-${currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && productCache[cacheKey]) {
        console.log("Loading from cache for key:", cacheKey);
        products = productCache[cacheKey].products;
        lastVisibleProductDoc = productCache[cacheKey].lastVisible;
        allProductsLoaded = productCache[cacheKey].allLoaded;
        
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';
        
        renderProducts();
        scrollTrigger.style.display = allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (isLoadingMoreProducts) return;

    if (isNewSearch) {
        allProductsLoaded = false;
        lastVisibleProductDoc = null;
        products = [];
        renderSkeletonLoader();
    }

    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    loader.style.display = 'block';

    try {
        let productsQuery = collection(db, "products");

        if (currentCategory && currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", currentCategory));
        }
        if (currentSubcategory && currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", currentSubcategory));
        }
        if (currentSubSubcategory && currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", currentSubSubcategory));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        if (lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            products = newProducts;
        } else {
            products = [...products, ...newProducts];
        }

        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }

        lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        if (isNewSearch) {
             console.log("Saving to cache for key:", cacheKey);
            productCache[cacheKey] = {
                products: products,
                lastVisible: lastVisibleProductDoc,
                allLoaded: allProductsLoaded
            };
        }
        
        renderProducts();

        if (products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ కాڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}


function addToCart(productId) {
    const allFetchedProducts = [...products];
    let product = allFetchedProducts.find(p => p.id === productId);

    if(!product){
        console.warn("Product not found in local 'products' array. Adding with limited data.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart();
                showNotification(t('product_added_to_cart'));
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    saveCart();
    showNotification(t('product_added_to_cart'));
}


function renderCart() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons();

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    totalAmount.textContent = total.toLocaleString();
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function generateOrderMessage() {
    if (cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

    if (userProfile.name && userProfile.address && userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${userProfile.name}\n`;
        message += `${t('order_user_address')}: ${userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';

    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn';
        btn.style.backgroundColor = method.color;

        const name = method['name_' + currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessage();
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp':
                    link = `https://wa.me/${value}?text=${encodedMessage}`;
                    break;
                case 'viber':
                    link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                    break;
                case 'telegram':
                    link = `https://t.me/${value}?text=${encodedMessage}`;
                    break;
                case 'phone':
                    link = `tel:${value}`;
                    break;
                case 'url':
                    link = value;
                    break;
            }

            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
}

async function renderUserNotifications() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = '';
    if (snapshot.empty) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        const title = (announcement.title && announcement.title[currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${title}</span>
                <span class="notification-date">${formattedDate}</span>
            </div>
            <p class="notification-content">${content}</p>
        `;
        notificationsListContainer.appendChild(item);
    });

    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}


function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.className = 'settings-item';

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    });
}

function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            if (data && data.display_name) {
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case 2:
                message = 'شوێنەکەت نەدۆزرایەوە';
                break;
            case 3:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            searchProductsInFirestore(currentSearch, false);
        }
    }, {
        root: null,
        threshold: 0.1
    });

    observer.observe(trigger);
}

function updateCategoryDependentUI() {
    if (categories.length === 0) return;
    populateCategoryDropdown();
    renderMainCategories();
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
    }
}

function setupEventListeners() {
    homeBtn.onclick = async () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
        showPage('mainPage');
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        showPage('settingsPage');
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn');
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn');
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn');
    };

    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet');
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal');
    };

    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };

    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term });
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' });
    };


    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                installBtn.style.display = 'none';
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
            }
        });
    }

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
    });
}

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            window.AdminLogic.initialize();
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            await signOut(auth);
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});

function init() {
    renderSkeletonLoader();

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic();
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic();
        });
}

function initializeAppLogic() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories];
        updateCategoryDependentUI();
        setLanguage(currentLanguage);
    });

    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(currentLanguage);
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
    handleInitialPageLoad();
}

Object.assign(window.globalAdminTools, {
    db, auth,
    doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    
    clearProductCache: () => {
        console.log("Product cache cleared due to admin action.");
        productCache = {};
    },
    
    setEditingProductId: (id) => { editingProductId = id; },
    getEditingProductId: () => editingProductId,
    getCategories: () => categories,
    getCurrentLanguage: () => currentLanguage
});

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });

        updateNowBtn.addEventListener('click', () => {
            registration.waiting.postMessage({ action: 'skipWaiting' });
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}

function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot) return;

    const cardData = allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    newCardElement.classList.add('product-card-reveal');

    promoCardSlot.style.opacity = 0;
    setTimeout(() => {
        if (promoCardSlot.parentNode) {
            promoCardSlot.parentNode.replaceChild(newCardElement, promoCardSlot);
            setTimeout(() => {
                newCardElement.classList.add('visible');
            }, 10);
        }
    }, 300);
}

function rotatePromoCard() {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex = (currentPromoCardIndex + 1) % allPromoCards.length;
    displayPromoCard(currentPromoCardIndex);
}

function changePromoCard(direction) {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex += direction;
    if (currentPromoCardIndex >= allPromoCards.length) {
        currentPromoCardIndex = 0;
    } else if (currentPromoCardIndex < 0) {
        currentPromoCardIndex = allPromoCards.length - 1;
    }
    displayPromoCard(currentPromoCardIndex);
    startPromoRotation();
}

function startPromoRotation() {
    if (promoRotationInterval) {
        clearInterval(promoRotationInterval);
    }
    if (allPromoCards.length > 1) {
        promoRotationInterval = setInterval(rotatePromoCard, 5000);
    }
}

