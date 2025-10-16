//======================================================================
//==================== بەشی ١: ئیمپۆرتکردن و ڕێکخستن =====================
//======================================================================

// Import data logic and state variables from data-logic.js
import {
    db, auth, messaging,
    products, categories, cart, favorites, userProfile,
    initializeDataLogic,
    searchProductsInFirestore,
    toggleFavorite,
    addToCart,
    renderHomePageContent,
    showProductDetails,
    requestNotificationPermission,
    setupScrollObserver
} from './data-logic.js';

import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

//======================================================================
//==================== بەشی ٢: وەرگێڕانەکان (Translations) =====================
//======================================================================

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

//======================================================================
//=================== بەشی ٣: گۆڕاوە گشتییەکانی ڕووکار ===================
//======================================================================

let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
let deferredPrompt;

// Filter State
let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSubSubcategory = 'all';
let currentSearch = '';

// Editing State (UI related)
let editingProductId = null;

//======================================================================
//================= بەشی ٤: دیاریکردنی ئێلێمێنتەکانی دۆم ==================
//======================================================================

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


//======================================================================
//=================== بەشی ٥: فەنکشنە یارمەتیدەرەکانی ڕووکار ===================
//======================================================================

function t(key, replacements = {}) {
    let translation = (translations[currentLanguage] && translations[currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
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

    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = '';
    }

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

function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


//======================================================================
//==================== بەشی ٦: بەڕێوەبردنی ڕووکار و پەڕەکان ====================
//======================================================================

function saveCurrentScrollPosition() {
    const currentState = history.state;
    if (!document.getElementById('mainPage').classList.contains('page-hidden') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function showPage(pageId) {
    saveCurrentScrollPosition();
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
    saveCurrentScrollPosition();
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

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}


//======================================================================
//=================== بەشی ٧: بەڕێوەبردنی History و Navigation ===================
//======================================================================

async function applyFilterState(state, fromPopState = false) {
    currentCategory = state.category || 'all';
    currentSubcategory = state.subcategory || 'all';
    currentSubSubcategory = state.subSubcategory || 'all';
    currentSearch = state.search || '';

    searchInput.value = currentSearch;
    clearSearchBtn.style.display = currentSearch ? 'block' : 'none';

    renderMainCategories();
    await renderSubcategories(currentCategory);

    await searchProductsInFirestore(currentSearch, true);

    if (fromPopState && typeof state.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, state.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function navigateToFilter(newState) {
    history.replaceState({
        category: currentCategory,
        subcategory: currentSubcategory,
        subSubcategory: currentSubSubcategory,
        search: currentSearch,
        scroll: window.scrollY
    }, '');

    const finalState = { ...history.state, ...newState, scroll: 0 };
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


//======================================================================
//=================== بەشی ٨: پیشاندانی داتا لەسەر ڕووکار (UI Rendering) =================
//======================================================================

function renderProducts() {
    productsContainer.innerHTML = '';
    if (!products || products.length === 0) {
        return;
    }

    products.forEach(item => {
        let element;
        // This logic will be handled by the data-logic.js now
        // if (item.isPromoCard) {
        //     element = createPromoCardElement(item);
        // } else {
        element = window.globalAdminTools.createProductCardElement(item);
        // }
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
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

// These functions now need to be defined here and will call the logic from data-logic.js if needed.
function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            localStorage.setItem('maten_store_cart', JSON.stringify(cart)); // saveCart logic
            updateCartCount();
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    const updatedCart = cart.filter(item => item.id !== productId);
    // Directly update the exported variable. This is not ideal, a setter function would be better.
    // For simplicity, let's update it and then save.
    cart.length = 0;
    Array.prototype.push.apply(cart, updatedCart);

    localStorage.setItem('maten_store_cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
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
            const productCard = window.globalAdminTools.createProductCardElement(product);
            favoritesContainer.appendChild(productCard);
        });
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
        const categoryName = cat.id === 'all' ? t('all_categories_label') : (cat['name_' + currentLanguage] || cat.name_ku_sorani);
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

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (currentCategory === cat.id) {
            btn.classList.add('active');
        }
        const categoryName = cat.id === 'all' ? t('all_categories_label') : (cat['name_' + currentLanguage] || cat.name_ku_sorani);
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

// ... other render functions like renderSubcategories, renderUserNotifications, etc. will go here ...
async function renderSubcategories(categoryId) {
    // This function can stay here, as it's UI logic, but it needs to get subcategories from data-logic
    // For now, let's keep the getDocs here as it's simple enough. A cleaner way would be a function in data-logic.
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') return;

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (subcategories.length === 0) return;

        // ... rest of the function remains the same ...
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

        if (currentSubcategory && currentSubcategory !== 'all') {
            await renderSubSubcategories(categoryId, currentSubcategory);
        }

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
    }
}


//======================================================================
//=================== بەشی ٩: دانانی Event Listeners ===================
//======================================================================

function setupEventListeners() {
    // ... all event listeners code from the original file ...
    // For example:
    homeBtn.onclick = async () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
        showPage('mainPage');
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        showPage('settingsPage');
    };
    
    // ... and so on for all other elements ...
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

    // ... rest of event listeners
}


//======================================================================
//=================== بەشی ١٠: دەستپێکردنی ئەپڵیکەیشن (Initialization) =================
//======================================================================

function init() {
    renderSkeletonLoader();
    initializeAppLogic();
}

function initializeAppLogic() {
    const uiFunctions = {
        updateCartCount,
        showNotification,
        renderProducts,
        renderSkeletonLoader,
        formatDescription
    };

    const appLogicFunctions = {
        t,
        getCurrentLanguage: () => currentLanguage,
        getCurrentFilterState: () => ({ currentCategory, currentSubcategory, currentSubSubcategory, currentSearch }),
        closeCurrentPopup,
        openPopup,
        navigateToFilter
    };

    initializeDataLogic(uiFunctions, appLogicFunctions);
    
    updateCartCount();
    setupEventListeners();
    setLanguage(currentLanguage);
    handleInitialPageLoad();
    setupScrollObserver(); // Make sure this is also initialized
}

document.addEventListener('DOMContentLoaded', init);


//======================================================================
//==================== بەشی ١١: کۆدی تایبەت بە PWA =====================
//======================================================================

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
