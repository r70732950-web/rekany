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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Firestore Collections
const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");
const slidersCollection = collection(db, "sliders");

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
        manage_announcements_title: "ناردنی ئاگەهداری گشتی",
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
        manage_policies_title: "рێکخستنا مەرج و سیاسەتان",
        policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن",
        loading_policies: "...د بارکرنا سیاسەتان دایە",
        no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.",
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
let isAdmin = false;
let editingProductId = null;
let currentSearch = '';
let products = [];
let categories = [];
let contactInfo = {};
let subcategories = [];
let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
const PRODUCTS_PER_PAGE = 25;
let mainPageScrollPosition = 0;

let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSubSubcategory = 'all';

// Slider State
let sliderInterval;
let currentSlideIndex = 0;
let slidesData = [];


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
    if (!mainPage.classList.contains('page-hidden')) {
        mainPageScrollPosition = window.scrollY;
    }

    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });

    if (pageId === 'mainPage') {
        setTimeout(() => {
            window.scrollTo(0, mainPageScrollPosition);
        }, 0);
    } else {
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

window.addEventListener('popstate', (event) => {
    closeAllPopupsUI();
    const state = event.state;
    if (state) {
        if (state.type === 'page') {
            showPage(state.id);
        } else if (state.type === 'sheet' || state.type === 'modal') {
            openPopup(state.id, state.type);
        }
    } else {
        showPage('mainPage');
    }
});

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const element = document.getElementById(hash);

    if (hash === 'settingsPage') {
        showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        showPage('mainPage');
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }

    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }
}

function t(key, replacements = {}) {
    let translation = translations[currentLanguage][key] || translations['ku_sorani'][key] || key;
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

    const fetchedCategories = categories.filter(cat => cat.id !== 'all');
    categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];

    renderProducts();
    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
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
    renderProducts();
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
        option.textContent = cat['name_' + currentLanguage] || cat.name;
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
        const categoryName = cat['name_' + currentLanguage] || cat.name;
        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = () => {
            currentCategory = cat.id;
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            renderSubcategories(currentCategory);
            renderSubSubcategories(currentCategory, currentSubcategory);
            searchProductsInFirestore('', true);
            history.back();
            renderMainCategories();
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
        allBtn.className = 'subcategory-btn active';
        allBtn.textContent = t('all_categories_label');
        allBtn.onclick = () => {
            currentSubSubcategory = 'all';
            document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            searchProductsInFirestore('', true);
        };
        subSubcategoriesContainer.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'subcategory-btn';
            btn.textContent = subSubcat['name_' + currentLanguage] || subSubcat.name_ku_sorani;
            btn.onclick = () => {
                currentSubSubcategory = subSubcat.id;
                document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                searchProductsInFirestore('', true);
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
        allBtn.className = 'subcategory-btn active';
        allBtn.textContent = t('all_categories_label');
        allBtn.onclick = () => {
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            document.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            subSubcategoriesContainer.innerHTML = '';
            searchProductsInFirestore('', true);
        };
        subcategoriesContainer.appendChild(allBtn);

        subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = 'subcategory-btn';
            subcatBtn.textContent = subcat['name_' + currentLanguage] || subcat.name_ku_sorani;
            subcatBtn.onclick = () => {
                currentSubcategory = subcat.id;
                currentSubSubcategory = 'all';
                document.querySelectorAll('#subcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
                subcatBtn.classList.add('active');
                renderSubSubcategories(categoryId, subcat.id);
                searchProductsInFirestore('', true);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });
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

        const categoryName = cat['name_' + currentLanguage] || cat.name;
        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = () => {
            currentCategory = cat.id;
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            renderMainCategories();
            renderSubcategories(currentCategory);
            renderSubSubcategories(currentCategory, currentSubcategory);
            searchProductsInFirestore('', true);
        };

        container.appendChild(btn);
    });
}

function showProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

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

    openPopup('productDetailSheet');
}

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';

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
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');

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
        } else if (target.closest('.edit-btn')) {
            editProduct(product.id);
        } else if (target.closest('.delete-btn')) {
            deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetails(product.id);
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
    products.forEach(product => {
        const productCard = createProductCardElement(product);
		productCard.classList.add('product-card-reveal');
        productsContainer.appendChild(productCard);
    });
    setupScrollAnimations();
}

async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
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
        let q = collection(db, "products");
        
        if (currentCategory && currentCategory !== 'all') {
            q = query(q, where("categoryId", "==", currentCategory));
        }

        if (currentSubcategory && currentSubcategory !== 'all') {
            q = query(q, where("subcategoryId", "==", currentSubcategory));
        }
        
        if (currentSubSubcategory && currentSubSubcategory !== 'all') {
            q = query(q, where("subSubcategoryId", "==", currentSubSubcategory));
        }
        
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
             q = query(q, 
                where('searchableName', '>=', finalSearchTerm), 
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
             );
        }
        
        if (finalSearchTerm) {
            q = query(q, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            q = query(q, orderBy("createdAt", "desc"));
        }

        if (lastVisibleProductDoc && !isNewSearch) {
            q = query(q, startAfter(lastVisibleProductDoc));
        }
        
        q = query(q, limit(PRODUCTS_PER_PAGE));

        const querySnapshot = await getDocs(q);
        const newProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            products = newProducts;
        } else {
            products = [...products, ...newProducts];
        }

        if (querySnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            document.getElementById('scroll-loader-trigger').style.display = 'none';
        } else {
            document.getElementById('scroll-loader-trigger').style.display = 'block';
        }

        lastVisibleProductDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        renderProducts();

        if (products.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا لە کاتی هێنانی کاڵاکان.</p>';
    } finally {
        isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

function createProductImageInputs(imageUrls = []) {
    imageInputsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const isRequired = i === 0 ? 'required' : '';
        const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
        const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `<input type="text" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}><img src="${previewSrc}" class="image-preview-small" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;
        imageInputsContainer.appendChild(inputGroup);
    }
}

async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
    const container = document.getElementById('subSubcategorySelectContainer');
    const select = document.getElementById('productSubSubcategoryId');
    
    if (!mainCategoryId || !subcategoryId) {
        container.style.display = 'none';
        select.innerHTML = '';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    select.disabled = true;
    container.style.display = 'block';

    try {
        const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        select.innerHTML = '<option value="">-- هیچ --</option>'; 
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const subSubcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subSubcat.id;
                option.textContent = subSubcat.name_ku_sorani;
                if (subSubcat.id === selectedSubSubcategoryId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching sub-subcategories for form:", error);
        select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
    } finally {
        select.disabled = false;
    }
}

async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    if (!categoryId) {
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        return;
    }

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    productSubcategorySelect.disabled = true;
    subcategorySelectContainer.style.display = 'block';

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

        if (querySnapshot.empty) {
            productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
            subSubcategorySelectContainer.style.display = 'none';
        } else {
            querySnapshot.docs.forEach(doc => {
                const subcat = { id: doc.id, ...doc.data() };
                const option = document.createElement('option');
                option.value = subcat.id;
                option.textContent = subcat.name_ku_sorani || subcat.id;
                if (subcat.id === selectedSubcategoryId) {
                    option.selected = true;
                }
                productSubcategorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching subcategories for form:", error);
        productSubcategorySelect.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
    } finally {
        productSubcategorySelect.disabled = false;
    }
}

async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    editingProductId = productId;
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

    if (product.name && typeof product.name === 'object') {
        document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
        document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
        document.getElementById('productNameAr').value = product.name.ar || '';
    } else {
        document.getElementById('productNameKuSorani').value = product.name;
        document.getElementById('productNameKuBadini').value = '';
        document.getElementById('productNameAr').value = '';
    }
    
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';

    const categoryId = product.categoryId || product.category;
    document.getElementById('productCategoryId').value = categoryId;

    if (product.description) {
        document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
        document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
        document.getElementById('productDescriptionAr').value = product.description.ar || '';
    }

    const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
    createProductImageInputs(imageUrls);
    document.getElementById('productExternalLink').value = product.externalLink || '';
    
    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);
    await populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    openPopup('productFormModal', 'modal');
}

async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(searchInput.value, true);
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
    }
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

function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + currentLanguage] || cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
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

async function deleteContactMethod(methodId) {
    if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
        try {
            const methodRef = doc(db, 'settings', 'contactInfo', 'contactMethods', methodId);
            await deleteDoc(methodRef);
            showNotification('شێوازەکە سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting contact method: ", error);
            showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
        }
    }
}

function renderContactMethodsAdmin() {
    const container = document.getElementById('contactMethodsListContainer');
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const name = method['name_' + currentLanguage] || method.name_ku_sorani;

            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${method.icon}" style="color: ${method.color};"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${method.value}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteContactMethod(method.id);
            container.appendChild(item);
        });
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

async function loadPoliciesForAdmin() {
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || '';
            document.getElementById('policiesContentKuBadini').value = policies.ku_badini || '';
            document.getElementById('policiesContentAr').value = policies.ar || '';
        }
    } catch (error) {
        console.error("Error loading policies for admin:", error);
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

async function deleteAnnouncement(id) {
    if (confirm(t('announcement_delete_confirm'))) {
        try {
            await deleteDoc(doc(db, "announcements", id));
            showNotification(t('announcement_deleted_success'), 'success');
        } catch (e) {
            showNotification(t('error_generic'), 'error');
        }
    }
}

function renderAdminAnnouncementsList() {
    const container = document.getElementById('announcementsListContainer');
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
            return;
        }
        snapshot.forEach(doc => {
            const announcement = { id: doc.id, ...doc.data() };
            const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان';
            const item = document.createElement('div');
            item.className = 'admin-notification-item';
            item.innerHTML = `
                <div class="admin-notification-details">
                    <div class="notification-title">${title}</div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').addEventListener('click', () => deleteAnnouncement(announcement.id));
            container.appendChild(item);
        });
    });
}

function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminCategoryManagement = document.getElementById('adminCategoryManagement');
    const adminContactMethodsManagement = document.getElementById('adminContactMethodsManagement');
    const adminSliderManagement = document.getElementById('adminSliderManagement');

    if (adminPoliciesManagement) {
        adminPoliciesManagement.style.display = isAdmin ? 'block' : 'none';
    }
    if(adminSliderManagement) {
        adminSliderManagement.style.display = isAdmin ? 'block' : 'none';
    }
    if (adminSocialMediaManagement) adminSocialMediaManagement.style.display = isAdmin ? 'block' : 'none';
    if (adminAnnouncementManagement) {
        adminAnnouncementManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) renderAdminAnnouncementsList();
    }

    if (isAdmin) {
        settingsLogoutBtn.style.display = 'flex';
        settingsAdminLoginBtn.style.display = 'none';
        addProductBtn.style.display = 'flex';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'block';
            renderCategoryManagementUI();
        }
        if (adminContactMethodsManagement) {
            adminContactMethodsManagement.style.display = 'block';
            renderContactMethodsAdmin();
        }
        if (adminSliderManagement) {
             renderAdminSlidersList();
        }
    } else {
        settingsLogoutBtn.style.display = 'none';
        settingsAdminLoginBtn.style.display = 'flex';
        addProductBtn.style.display = 'none';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'none';
        }
        if (adminContactMethodsManagement) {
            adminContactMethodsManagement.style.display = 'none';
        }
        if (adminSliderManagement) {
            adminSliderManagement.style.display = 'none';
        }
    }
}

async function deleteSocialMediaLink(linkId) {
    if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
        try {
            const linkRef = doc(db, 'settings', 'contactInfo', 'socialLinks', linkId);
            await deleteDoc(linkRef);
            showNotification('لینکەکە سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting social link: ", error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

function renderSocialMediaLinks() {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        socialLinksListContainer.innerHTML = '';
        if (snapshot.empty) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const link = { id: doc.id, ...doc.data() };
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${link.icon}"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${link.url}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLink(link.id);
            socialLinksListContainer.appendChild(item);
        });
    });
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

// ============= CATEGORY MANAGEMENT FUNCTIONS =============

async function renderCategoryManagementUI() {
    const container = document.getElementById('categoryListContainer');
    if (!container) return;
    container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

    let content = '';
    const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

    for (const mainDoc of mainCategoriesSnapshot.docs) {
        const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
        const mainPath = `categories/${mainCategory.id}`;
        content += `
            <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                    <div>
                        <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;

        const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
        const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
        for (const subDoc of subCategoriesSnapshot.docs) {
            const subCategory = { id: subDoc.id, ...subDoc.data() };
            const subPath = `${mainPath}/subcategories/${subCategory.id}`;
            content += `
                <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                        <div>
                            <button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-path="${subPath}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            
            const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
            const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
            for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                content += `
                    <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;
            }
        }
    }

    container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level));
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name));
    });
}

async function openEditCategoryModal(docPath, level) {
    const docRef = doc(db, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
        return;
    }
    const category = docSnap.data();
    
    document.getElementById('editCategoryDocPath').value = docPath;
    document.getElementById('editCategoryLevel').value = level;
    
    document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || '';
    document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || '';
    document.getElementById('editCategoryNameAr').value = category.name_ar || '';
    document.getElementById('editCategoryOrder').value = category.order || 0;

    const iconField = document.getElementById('editIconField');
    if (level === '1') {
        iconField.style.display = 'block';
        document.getElementById('editCategoryIcon').value = category.icon || '';
    } else {
        iconField.style.display = 'none';
    }

    openPopup('editCategoryModal', 'modal');
}

async function handleDeleteCategory(docPath, categoryName) {
    const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
    if (confirmation) {
        try {
            await deleteDoc(doc(db, docPath));
            showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
        } catch (error) {
            console.error("Error deleting category: ", error);
            showNotification('هەڵەیەک ڕوویدا لە کاتی سڕینەوە', 'error');
        }
    }
}

// ============= SLIDER FUNCTIONS (NEW) =============

function renderAdminSlidersList() {
    const container = document.getElementById('slidersListContainer');
    const q = query(slidersCollection, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center;">هیچ سلایدێک زیاد نەکراوە.</p>`;
            return;
        }
        snapshot.forEach(doc => {
            const slider = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'admin-slider-item';
            item.innerHTML = `
                <img src="${slider.imageUrl}" alt="Slider Preview">
                <div class="admin-slider-item-info">
                    <span><strong>ڕیزبەندی:</strong> ${slider.order}</span>
                    <span style="direction: ltr;"><strong>URL:</strong> ${slider.link || 'نییە'}</span>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm('دڵنیایت دەتەوێت ئەم سلایدە بسڕیتەوە؟')) {
                    await deleteDoc(doc(db, "sliders", slider.id));
                    showNotification('سلایدەکە سڕدرایەوە', 'success');
                }
            });
            container.appendChild(item);
        });
    });
}

function setupAdminSliderForm() {
    const addSliderForm = document.getElementById('addSliderForm');
    if (addSliderForm) {
        addSliderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const sliderData = {
                imageUrl: document.getElementById('sliderImageUrl').value,
                link: document.getElementById('sliderLink').value || null,
                order: parseInt(document.getElementById('sliderOrder').value),
                isActive: true, 
                createdAt: Date.now()
            };

            try {
                await addDoc(slidersCollection, sliderData);
                showNotification('سلایدی نوێ زیادکرا', 'success');
                addSliderForm.reset();
            } catch (error) {
                console.error("Error adding slider:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }
}

function showSlide(index) {
    const sliderWrapper = document.querySelector('.slider-wrapper');
    const dots = document.querySelectorAll('.pagination-dot');

    if (!sliderWrapper || slidesData.length === 0) return;

    if (index >= slidesData.length) {
        currentSlideIndex = 0;
    } else if (index < 0) {
        currentSlideIndex = slidesData.length - 1;
    } else {
        currentSlideIndex = index;
    }

    sliderWrapper.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === currentSlideIndex);
    });
}

function initSlider() {
    const sliderContainer = document.getElementById('mainSliderContainer');
    if (!sliderContainer || slidesData.length === 0) return;

    const prevButton = sliderContainer.querySelector('.slider-nav.prev');
    const nextButton = sliderContainer.querySelector('.slider-nav.next');
    const paginationContainer = sliderContainer.querySelector('.slider-pagination');
    
    paginationContainer.innerHTML = '';

    slidesData.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'pagination-dot';
        dot.addEventListener('click', () => {
            showSlide(index);
            clearInterval(sliderInterval);
            sliderInterval = setInterval(() => showSlide(currentSlideIndex + 1), 5000);
        });
        paginationContainer.appendChild(dot);
    });

    prevButton.addEventListener('click', () => showSlide(currentSlideIndex - 1));
    nextButton.addEventListener('click', () => showSlide(currentSlideIndex + 1));

    clearInterval(sliderInterval);
    sliderInterval = setInterval(() => showSlide(currentSlideIndex + 1), 5000);

    showSlide(0);
}

async function fetchAndRenderSlider() {
    const sliderContainer = document.getElementById('mainSliderContainer');
    const sliderWrapper = sliderContainer.querySelector('.slider-wrapper');
    sliderWrapper.innerHTML = '';
    
    const q = query(slidersCollection, where("isActive", "==", true), orderBy("order", "asc"));
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            sliderContainer.style.display = 'none';
            return;
        }

        slidesData = snapshot.docs.map(doc => doc.data());
        
        slidesData.forEach(slideData => {
            const slideElement = document.createElement('div');
            slideElement.className = 'slide';
            if (slideData.link) {
                slideElement.innerHTML = `<a href="${slideData.link}" target="_blank"><img src="${slideData.imageUrl}" alt="Advertisement"></a>`;
            } else {
                slideElement.innerHTML = `<img src="${slideData.imageUrl}" alt="Advertisement">`;
            }
            sliderWrapper.appendChild(slideElement);
        });

        sliderContainer.style.display = 'block';
        initSlider();

    } catch (error) {
        console.error("Error fetching sliders:", error);
        sliderContainer.style.display = 'none';
    }
}

// ============= EVENT LISTENERS SETUP =============

function setupEventListeners() {
    homeBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        showPage('mainPage');
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

    addProductBtn.onclick = () => {
        editingProductId = null;
        productForm.reset();
        createProductImageInputs();
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        formTitle.textContent = 'زیادکردنی کاڵای نوێ';
        productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        openPopup('productFormModal', 'modal');
    };
    settingsLogoutBtn.onclick = async () => {
        await signOut(auth);
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

    productCategorySelect.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value);
        populateSubSubcategoriesDropdown(null, null);
    });

    productSubcategorySelect.addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId').value;
        populateSubSubcategoriesDropdown(mainCatId, e.target.value);
    });

    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '...چاوەڕێ بە';
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
        if (imageUrls.length === 0) {
            showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            return;
        }

        const productDescriptionObject = {
            ku_sorani: document.getElementById('productDescriptionKuSorani').value,
            ku_badini: document.getElementById('productDescriptionKuBadini').value,
            ar: document.getElementById('productDescriptionAr').value
        };
        
        const productNameKuSorani = document.getElementById('productNameKuSorani').value;
        const productNameObject = {
            ku_sorani: productNameKuSorani,
            ku_badini: document.getElementById('productNameKuBadini').value,
            ar: document.getElementById('productNameAr').value
        };

        try {
            const productData = {
                name: productNameObject,
                searchableName: productNameKuSorani.toLowerCase(),
                price: parseInt(document.getElementById('productPrice').value),
                originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
                categoryId: document.getElementById('productCategoryId').value,
                subcategoryId: document.getElementById('productSubcategoryId').value || null,
                subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                description: productDescriptionObject,
                imageUrls: imageUrls,
                createdAt: Date.now(),
                externalLink: document.getElementById('productExternalLink').value || null
            };
            if (editingProductId) {
                const { createdAt, ...updateData } = productData;
                await updateDoc(doc(db, "products", editingProductId), updateData);
                showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                await addDoc(productsCollection, productData);
                showNotification('کاڵا زیادکرا', 'success');
            }
            closeCurrentPopup();
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            console.error("Error saving product:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            editingProductId = null;
        }
    };

    imageInputsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('productImageUrl')) {
            const previewImg = e.target.nextElementSibling;
            const url = e.target.value;
            if (url) { previewImg.src = url; }
            else {
                const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        }
    });
    
    const debouncedSearch = debounce((term) => {
        searchProductsInFirestore(term, true);
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        currentSearch = searchTerm;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        searchProductsInFirestore('', true);
    };


    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    socialMediaToggle.onclick = () => {
        const container = adminSocialMediaManagement.querySelector('.contact-links-container');
        const chevron = socialMediaToggle.querySelector('.contact-chevron');
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

    const addCategoryForm = document.getElementById('addCategoryForm');
    const addSubcategoryForm = document.getElementById('addSubcategoryForm');
    const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');

    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const categoryData = {
                name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                name_ar: document.getElementById('mainCategoryNameAr').value,
                icon: document.getElementById('mainCategoryIcon').value,
                order: parseInt(document.getElementById('mainCategoryOrder').value)
            };

            try {
                await addDoc(categoriesCollection, categoryData);
                showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                addCategoryForm.reset();
            } catch (error) {
                console.error("Error adding main category: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
            }
        });
    }

    if (addSubcategoryForm) {
        addSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            const parentCategoryId = document.getElementById('parentCategorySelect').value;

            if (!parentCategoryId) {
                showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error');
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const subcategoryData = {
                name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
                name_ar: document.getElementById('subcategoryNameAr').value,
                order: parseInt(document.getElementById('subcategoryOrder').value) || 0
            };

            try {
                const subcategoriesCollectionRef = collection(db, "categories", parentCategoryId, "subcategories");
                await addDoc(subcategoriesCollectionRef, subcategoryData);
                showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                addSubcategoryForm.reset();
            } catch (error) {
                console.error("Error adding subcategory: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
            }
        });
    }
    
    if (addSubSubcategoryForm) {
        addSubSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
            const mainCatId = mainCatSelect.value;
            const subCatId = subCatSelect.value;

            if (!mainCatId || !subCatId) {
                showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error');
                return;
            }

            const subSubcategoryData = {
                name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                name_ar: document.getElementById('subSubcategoryNameAr').value,
                order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                createdAt: Date.now()
            };

            try {
                const subSubcategoriesRef = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
                await addDoc(subSubcategoriesRef, subSubcategoryData);
                showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                addSubSubcategoryForm.reset();
                mainCatSelect.value = '';
                subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
            } catch (error) {
                console.error("Error adding sub-subcategory: ", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        });
    }
    
    const editCategoryForm = document.getElementById('editCategoryForm');
    if (editCategoryForm) {
        editCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const docPath = document.getElementById('editCategoryDocPath').value;
            const level = document.getElementById('editCategoryLevel').value;

            let updateData = {
                name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                name_ar: document.getElementById('editCategoryNameAr').value,
                order: parseInt(document.getElementById('editCategoryOrder').value) || 0
            };

            if (level === '1') {
                updateData.icon = document.getElementById('editCategoryIcon').value;
            }
            
            try {
                await updateDoc(doc(db, docPath), updateData);
                showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                closeCurrentPopup();
            } catch (error) {
                console.error("Error updating category: ", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
            }
        });
    }

    const addContactMethodForm = document.getElementById('addContactMethodForm');
    if (addContactMethodForm) {
        addContactMethodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const methodData = {
                type: document.getElementById('contactMethodType').value,
                value: document.getElementById('contactMethodValue').value,
                name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                name_ar: document.getElementById('contactMethodNameAr').value,
                icon: document.getElementById('contactMethodIcon').value,
                color: document.getElementById('contactMethodColor').value,
                createdAt: Date.now()
            };

            try {
                const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
                await addDoc(methodsCollection, methodData);
                showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                addContactMethodForm.reset();
            } catch (error) {
                console.error("Error adding contact method: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

    if (announcementForm) {
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...ناردن';

            const announcementData = {
                title: {
                    ku_sorani: document.getElementById('announcementTitleKuSorani').value,
                    ku_badini: document.getElementById('announcementTitleKuBadini').value,
                    ar: document.getElementById('announcementTitleAr').value,
                },
                content: {
                    ku_sorani: document.getElementById('announcementContentKuSorani').value,
                    ku_badini: document.getElementById('announcementContentKuBadini').value,
                    ar: document.getElementById('announcementContentAr').value,
                },
                createdAt: Date.now()
            };

            try {
                await addDoc(announcementsCollection, announcementData);
                showNotification('ئاگەداری بە سەرکەوتوویی نێردرا', 'success');
                announcementForm.reset();
            } catch (error) {
                console.error("Error sending announcement: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = t('send_announcement_button');
            }
        });
    }

    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    if (policiesForm) {
        policiesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const policiesData = {
                content: {
                    ku_sorani: document.getElementById('policiesContentKuSorani').value,
                    ku_badini: document.getElementById('policiesContentKuBadini').value,
                    ar: document.getElementById('policiesContentAr').value,
                }
            };

            try {
                const docRef = doc(db, "settings", "policies");
                await setDoc(docRef, policiesData, { merge: true });
                showNotification(t('policies_saved_success'), 'success');
            } catch (error) {
                console.error("Error saving policies:", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
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

    if (user && user.uid === adminUID) {
        isAdmin = true;
        sessionStorage.setItem('isAdmin', 'true');
        loadPoliciesForAdmin();

        if (document.getElementById('loginModal').style.display === 'block') {
            closeCurrentPopup();
        }
    } else {
        isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        if (user) {
            await signOut(auth);
        }
    }

    updateAdminUI(isAdmin);
    renderProducts();
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
        categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
        
        populateCategoryDropdown();
        renderMainCategories();
        
        if (isAdmin) {
            populateParentCategorySelect();
            renderCategoryManagementUI();
            
            const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
            
            if (mainCatSelectForSubSub && subCatSelectForSubSub) {
                mainCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
                const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name;
                    mainCatSelectForSubSub.appendChild(option);
                });

                if (!mainCatSelectForSubSub.listenerAttached) {
                    mainCatSelectForSubSub.addEventListener('change', async () => {
                        const mainCategoryId = mainCatSelectForSubSub.value;
                        if (!mainCategoryId) {
                             subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                             return;
                        };
                        
                        subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>...خەریکی بارکردنە</option>';
                        subCatSelectForSubSub.disabled = true;
   
                        const subcategoriesQuery = collection(db, "categories", mainCategoryId, "subcategories");
                        const q = query(subcategoriesQuery, orderBy("order", "asc"));
                        const querySnapshot = await getDocs(q);
                        
                        subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
                        if (!querySnapshot.empty) {
                            querySnapshot.forEach(doc => {
                                const subcat = { id: doc.id, ...doc.data() };
                                const option = document.createElement('option');
                                option.value = subcat.id;
                                option.textContent = subcat.name_ku_sorani || subcat.name_ku_badini || 'بێ ناو';
                                subCatSelectForSubSub.appendChild(option);
                            });
                        } else {
                            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                        }
                        subCatSelectForSubSub.disabled = false;
                    });
                    mainCatSelectForSubSub.listenerAttached = true;
                }
            }
        }

        setLanguage(currentLanguage);
    });

    searchProductsInFirestore('', true);
    fetchAndRenderSlider(); 
    setupAdminSliderForm();

    const contactInfoRef = doc(db, "settings", "contactInfo");
    onSnapshot(contactInfoRef, (docSnap) => {
        if (docSnap.exists()) {
            contactInfo = docSnap.data();
            updateContactLinksUI();
        } else {
            console.log("No contact info document found!");
        }
    });

    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(currentLanguage);
    renderSocialMediaLinks();
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
    handleInitialPageLoad();
}


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
