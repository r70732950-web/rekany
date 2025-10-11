// app.js

// واردکرنا فەنکشنێن سەرەکی ژ Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, doc, onSnapshot, query, orderBy, getDocs, limit, getDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// واردکرنا مۆدیولێ ئەدمینی
// ئەڤە دێ بتنێ دەمێ ئەدمین دهێتە ژوور هێتە کارئینان
import { initAdmin } from './admin.js';

// پێزانینێن Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// دەستپێکرنا Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ڕێڕەوێن سەرەکی یێن داتابەیسێ
const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");
const promoCardsCollection = collection(db, "promo_cards");

// وەرگێران
const translations = {
    ku_sorani: { search_placeholder: "گەڕان بە ناوی کاڵا...", admin_login_title: "چوونەژوورەوەی بەڕێوەبەر", email_label: "ئیمەیڵ:", password_label: "وشەی نهێنی:", login_button: "چوونەژوورەوە", cart_title: "سەبەتەی کڕین", cart_empty: "سەبەتەکەت بەتاڵە", total_price: "کۆی گشتی:", favorites_title: "لیستی دڵخوازەکان", favorites_empty: "لیستی دڵخوازەکانت بەتاڵە", choose_category: "هەڵبژاردنی جۆر", all_products: "هەموو کاڵاکان", loading_products: "...خەریکی بارکردنی کاڵاکانە", settings_title: "ڕێکخستنەکان", language_label: "زمان", profile_title: "پڕۆفایلی من", admin_login_nav: "چوونەژوورەوەی بەڕێوەبەر", logout_nav: "چوونەدەرەوە", profile_name: "ناو:", profile_address: "ناونیشان:", profile_phone: "ژمارەی تەلەفۆن:", save_button: "پاشەکەوتکردن", nav_home: "سەرەکی", nav_categories: "جۆرەکان", nav_cart: "سەبەتە", nav_profile: "پڕۆفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیمان پێوە بکە", add_to_cart: "زیادکردن بۆ سەبەتە", added_to_cart: "زیادکرا", product_not_found_error: "هەڵە: کاڵاکە نەدۆزرایەوە!", delete_confirm: "دڵنیایت دەتەوێت ئەم کاڵایە بسڕیتەوە؟", product_deleted: "کاڵا سڕدرایەوە", product_delete_error: "هەڵە لە سڕینەوەی کاڵا", order_greeting: "سڵاو! من پێویستم بەم کاڵایانەی خوارەوەیە:", order_item_details: "نرخ: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆی گشتی", order_user_info: "--- زانیاری داواکار ---", order_user_name: "ناو", order_user_address: "ناونیشان", order_user_phone: "ژمارەی تەلەفۆن", order_prompt_info: "تکایە ناونیشان و زانیارییەکانت بنێرە بۆ گەیاندن.", login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە", logout_success: "بە سەرکەوتوویی چوویتەدەرەوە", profile_saved: "زانیارییەکانی پڕۆفایل پاشەکەوتکران", all_categories_label: "هەموو", install_app: "دامەزراندنی ئەپ", product_added_to_cart: "کاڵاکە زیادکرا بۆ سەبەتە", product_added_to_favorites: "زیادکرا بۆ لیستی دڵخوازەکان", product_removed_from_favorites: "لە لیستی دڵخوازەکان سڕدرایەوە", notifications_title: "ئاگەهدارییەکان", no_notifications_found: "هیچ ئاگەهدارییەک نییە", enable_notifications: "چالاککردنی ئاگەدارییەکان", error_generic: "هەڵەیەک ڕوویدا!", terms_policies_title: "مەرج و ڕێساکان", loading_policies: "...خەریکی بارکردنی ڕێساکانە", no_policies_found: "هیچ مەرج و ڕێسایەک دانەنراوە.", force_update: "ناچارکردن بە نوێکردنەوە (سڕینەوەی کاش)", update_confirm: "دڵنیایت دەتەوێت ئەپەکە نوێ بکەیتەوە؟ هەموو کاشی ناو وێبگەڕەکەت دەسڕدرێتەوە.", update_success: "ئەپەکە بە سەرکەوتوویی نوێکرایەوە!" },
    ku_badini: { search_placeholder: "لێگەریان ب ناڤێ کاڵای...", admin_login_title: "چوونا ژوور یا بەرپرسى", email_label: "ئیمەیل:", password_label: "پەیڤا نهێنى:", login_button: "چوونا ژوور", cart_title: "سەلکا کرینێ", cart_empty: "سەلکا تە یا ڤالایە", total_price: "کۆمێ گشتی:", favorites_title: "لیستا حەزژێکریان", favorites_empty: "لیستا حەزژێکریێن تە یا ڤالایە", choose_category: "جورەکی هەلبژێرە", all_products: "هەمی کاڵا", loading_products: "...د بارکرنا کاڵایان دایە", settings_title: "ڕێکخستن", language_label: "زمان", profile_title: "پروفایلێ من", admin_login_nav: "چوونا ژوور یا بەرپرسى", logout_nav: "چوونا دەر", profile_name: "ناڤ:", profile_address: "ناڤ و نیشان:", profile_phone: "ژمارا تەلەفونێ:", save_button: "پاشەکەفتکرن", nav_home: "سەرەکی", nav_categories: "جۆر", nav_cart: "سەلک", nav_profile: "پروفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیێ ب مە بکە", add_to_cart: "زێدەکرن بۆ سەلکێ", added_to_cart: "زێدەکر", product_not_found_error: "خەلەتی: کاڵا نەهاتە دیتن!", delete_confirm: "تو پشتڕاستی دێ ڤی کاڵای ژێبەى؟", product_deleted: "کاڵا هاتە ژێبرن", product_delete_error: "خەلەتی د ژێبرنا کاڵای دا", order_greeting: "سلاڤ! ئەز پێدڤی ب ڤان کاڵایێن خوارێ مە:", order_item_details: "بها: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆمێ گشتی", order_user_info: "--- پێزانینێن داخازکەری ---", order_user_name: "ناڤ", order_user_address: "ناڤ و نیشان", order_user_phone: "ژمارا تەلەفونێ", order_prompt_info: "هیڤی دکەین ناڤ و نیشان و پێزانینێن خۆ فرێکە بۆ گەهاندنێ.", login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە", logout_success: "ب سەرکەفتیانە چوويه دەر", profile_saved: "پێزانینێن پروفایلی هاتنە پاشەکەفتکرن", all_categories_label: "هەمی", install_app: "دامەزراندنا ئەپی", product_added_to_cart: "کاڵا هاتە زێدەکرن بۆ سەلکێ", product_added_to_favorites: "هاتە زێدەکرن بۆ لیستا حەزژێکریان", product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێبرن", notifications_title: "ئاگەهداری", no_notifications_found: "چ ئاگەهداری نینن", enable_notifications: "چالاکرنا ئاگەهداریان", error_generic: "خەلەتییەک چێبوو!", terms_policies_title: "مەرج و سیاسەت", loading_policies: "...د بارکرنا سیاسەتان دایە", no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.", force_update: "ناچارکرن ب نویکرنەوە (ژێبرنا کاشی)", update_confirm: "تو پشتراستی دێ ئەپی نویکەیەڤە؟ دێ هەمی کاش د ناڤ وێبگەرا تە دا هێتە ژێبرن.", update_success: "ئەپ ب سەرکەفتیانە هاتە نویکرن!" },
    ar: { search_placeholder: "البحث باسم المنتج...", admin_login_title: "تسجيل دخول المسؤول", email_label: "البريد الإلكتروني:", password_label: "كلمة المرور:", login_button: "تسجيل الدخول", cart_title: "سلة التسوق", cart_empty: "سلتك فارغة", total_price: "المجموع الكلي:", favorites_title: "قائمة المفضلة", favorites_empty: "قائمة المفضلة فارغة", choose_category: "اختر الفئة", all_products: "كل المنتجات", loading_products: "...جاري تحميل المنتجات", settings_title: "الإعدادات", language_label: "اللغة", profile_title: "ملفي الشخصي", admin_login_nav: "تسجيل دخول المسؤول", logout_nav: "تسجيل الخروج", profile_name: "الاسم:", profile_address: "العنوان:", profile_phone: "رقم الهاتف:", save_button: "حفظ", nav_home: "الرئيسية", nav_categories: "الفئات", nav_cart: "السلة", nav_profile: "ملفي", nav_settings: "الإعدادات", contact_us_title: "تواصل معنا", add_to_cart: "إضافة إلى السلة", added_to_cart: "تمت الإضافة", product_not_found_error: "خطأ: المنتج غير موجود!", delete_confirm: "هل أنت متأكد من أنك تريد حذف هذا المنتج؟", product_deleted: "تم حذف المنتج", product_delete_error: "خطأ في حذف المنتج", order_greeting: "مرحباً! أحتاج إلى المنتجات التالية:", order_item_details: "السعر: {price} د.ع. | الكمية: {quantity}", order_total: "المجموع الكلي", order_user_info: "--- معلومات العميل ---", order_user_name: "الاسم", order_user_address: "العنوان", order_user_phone: "رقم الهاتف", order_prompt_info: "يرجى إرسال عنوانك وتفاصيلك للتوصيل.", login_error: "البريد الإلكتروني أو كلمة المرور غير صحيحة", logout_success: "تم تسجيل الخروج بنجاح", profile_saved: "تم حفظ معلومات الملف الشخصي", all_categories_label: "الكل", install_app: "تثبيت التطبيق", product_added_to_cart: "تمت إضافة المنتج إلى السلة", product_added_to_favorites: "تمت الإضافة إلى المفضلة", product_removed_from_favorites: "تمت الإزالة من المفضلة", notifications_title: "الإشعارات", no_notifications_found: "لا توجد إشعارات", enable_notifications: "تفعيل الإشعارات", error_generic: "حدث خطأ!", terms_policies_title: "الشروط والسياسات", loading_policies: "...جاري تحميل السياسات", no_policies_found: "لم يتم تحديد أي شروط أو سياسات.", force_update: "فرض التحديث (مسح ذاكرة التخزين المؤقت)", update_confirm: "هل أنت متأكد من رغبتك في تحديث التطبيق؟ سيتم مسح جميع بيانات ذاكرة التخزين المؤقت.", update_success: "تم تحديث التطبيق بنجاح!" }
};

// =======================================================
// گۆڕاوێن گشتی (Global Variables)
// =======================================================
let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
let deferredPrompt;
let cart = JSON.parse(localStorage.getItem("maten_store_cart")) || [];
let favorites = JSON.parse(localStorage.getItem("maten_store_favorites")) || [];
let userProfile = JSON.parse(localStorage.getItem("maten_store_profile")) || {};
let isAdmin = false;
let currentSearch = '';
let products = [];
let allPromoCards = [];
let currentPromoCardIndex = 0;
let promoRotationInterval = null;
let categories = [];
let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
const PRODUCTS_PER_PAGE = 25;
let mainPageScrollPosition = 0;
let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSubSubcategory = 'all';

// =======================================================
// ناساندنا Elementـێن سەرەکی
// =======================================================
const loginModal = document.getElementById('loginModal');
const productsContainer = document.getElementById('productsContainer');
const skeletonLoader = document.getElementById('skeletonLoader');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const loginForm = document.getElementById('loginForm');
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
const profileForm = document.getElementById('profileForm');
const settingsPage = document.getElementById('settingsPage');
const mainPage = document.getElementById('mainPage');
const homeBtn = document.getElementById('homeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
const profileBtn = document.getElementById('profileBtn');
const contactToggle = document.getElementById('contactToggle');
const notificationBtn = document.getElementById('notificationBtn');
const notificationBadge = document.getElementById('notificationBadge');
const notificationsSheet = document.getElementById('notificationsSheet');
const notificationsListContainer = document.getElementById('notificationsListContainer');
const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
const termsSheet = document.getElementById('termsSheet');
const termsContentContainer = document.getElementById('termsContentContainer');
const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');

// =======================================================
// فەنکشنێن سەرپەرشتیکرنا UI (UI Management)
// =======================================================

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
        setTimeout(() => window.scrollTo(0, mainPageScrollPosition), 0);
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

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// =======================================================
// فەنکشنێن زمان و وەرگێرانێ
// =======================================================

function t(key, replacements = {}) {
    let translation = (translations[currentLanguage] && translations[currentLanguage][key]) || translations['ku_sorani'][key] || key;
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
        if (element.placeholder) {
            element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    renderProducts();
    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
}

// =======================================================
// فەنکشنێن سەرەکی یێن ئەپلیکەیشنێ
// =======================================================

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
        if (isNewSearch && currentCategory === 'all' && allPromoCards.length === 0) {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
        }

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

        let combinedList = [...newProducts];
        if (isNewSearch && currentCategory === 'all' && allPromoCards.length > 0) {
            if (currentPromoCardIndex >= allPromoCards.length) {
                currentPromoCardIndex = 0;
            }
            combinedList.unshift(allPromoCards[currentPromoCardIndex]);
        }
        
        products = isNewSearch ? combinedList : [...products, ...newProducts];
        
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            document.getElementById('scroll-loader-trigger').style.display = 'none';
        } else {
            document.getElementById('scroll-loader-trigger').style.display = 'block';
        }

        lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        
        renderProducts();

        if (products.length === 0) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">چ کاڵایەک نەهاتە دیتن.</p>`;
        }

        if (isNewSearch) {
           startPromoRotation();
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">خەلەتیەک ڕوویدا.</p>`;
    } finally {
        isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    const nameInCurrentLang = product.name?.[currentLanguage] || product.name?.ku_sorani || 'کاڵای بێ ناڤ';
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
    const shippingText = product.shippingInfo?.[currentLanguage]?.trim();

    if (shippingText) {
        extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
    }

    const isProdFavorite = favorites.includes(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites"><i class="${heartIconClass} fa-heart"></i></button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card"><i class="fas fa-cart-plus"></i><span>${t('add_to_cart')}</span></button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest('.add-to-cart-btn-card')) {
            addToCart(product.id);
        } else if (target.closest('.edit-btn')) {
            if (isAdmin && window.editProduct) window.editProduct(product.id);
        } else if (target.closest('.delete-btn')) {
            if (isAdmin && window.deleteProduct) window.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetails(product.id);
        }
    });
    return productCard;
}

function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
    const imageUrl = card.imageUrls[currentLanguage] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container"><img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion"></div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = card.categoryId;
            if (categories.some(cat => cat.id === targetCategoryId)) {
                currentCategory = targetCategoryId;
                currentSubcategory = 'all';
                currentSubSubcategory = 'all';
                renderMainCategories();
                renderSubcategories(currentCategory);
                renderSubSubcategories(currentCategory, currentSubcategory);
                searchProductsInFirestore('', true);
                document.getElementById('mainCategoriesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => { e.stopPropagation(); changePromoCard(-1); });
    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => { e.stopPropagation(); changePromoCard(1); });

    return cardElement;
}

function renderProducts() {
    productsContainer.innerHTML = '';
	if (!products || products.length === 0) return;

    products.forEach(item => {
        let element = item.isPromoCard ? createPromoCardElement(item) : createProductCardElement(item);
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });
    setupScrollAnimations();
}

function renderSkeletonLoader() {
    skeletonLoader.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `<div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div><div class="skeleton-price shimmer"></div><div class="skeleton-button shimmer"></div>`;
        skeletonLoader.appendChild(skeletonCard);
    }
    skeletonLoader.style.display = 'grid';
    productsContainer.style.display = 'none';
    loader.style.display = 'none';
}

function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;
        if (currentCategory === cat.id) btn.classList.add('active');
        
        const categoryName = cat['name_' + currentLanguage] || cat.name_ku_sorani || cat.name;
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

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = '';
    if (categoryId === 'all') return;

    try {
        const q = query(collection(db, "categories", categoryId, "subcategories"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const allBtn = document.createElement('button');
        allBtn.className = 'subcategory-btn active';
        allBtn.textContent = t('all_categories_label');
        allBtn.onclick = () => {
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            document.querySelectorAll('#subcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            subSubcategoriesContainer.innerHTML = '';
            searchProductsInFirestore('', true);
        };
        subcategoriesContainer.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subcat = { id: doc.id, ...doc.data() };
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
    } catch (error) { console.error("Error fetching subcategories: ", error); }
}

async function renderSubSubcategories(mainCatId, subCatId) {
    subSubcategoriesContainer.innerHTML = '';
    if (subCatId === 'all' || !mainCatId) return;

    try {
        const q = query(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), orderBy("order", "asc"));
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
    } catch (error) { console.error("Error fetching sub-subcategories:", error); }
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (currentCategory === cat.id) btn.classList.add('active');
        const categoryName = cat['name_' + currentLanguage] || cat.name_ku_sorani || cat.name;
        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = () => {
            currentCategory = cat.id;
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            renderSubcategories(currentCategory);
            renderSubSubcategories(currentCategory, currentSubcategory);
            searchProductsInFirestore('', true);
            closeCurrentPopup();
            renderMainCategories();
            showPage('mainPage');
        };
        sheetCategoriesContainer.appendChild(btn);
    });
}

function showProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const nameInCurrentLang = product.name?.[currentLanguage] || product.name?.ku_sorani || 'کاڵای بێ ناو';
    const descriptionText = product.description?.[currentLanguage] || product.description?.ku_sorani || '';
    const imageUrls = product.imageUrls || [];

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);
            const thumb = document.createElement('img');
            thumb.src = url;
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

    prevBtn.style.display = nextBtn.style.display = imageUrls.length > 1 ? 'flex' : 'none';
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
    addToCartButton.onclick = () => { addToCart(product.id); closeCurrentPopup(); };

    openPopup('productDetailSheet');
}


// =======================================================
// فەنکشنێن تایبەت ب سەبەتە، دڵخواز و پڕۆفایل
// =======================================================

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 });
    }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function saveCart() {
    localStorage.setItem("maten_store_cart", JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
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
        const itemName = item.name?.[currentLanguage] || item.name?.ku_sorani || 'کاڵای بێ ناو';

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemName}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemName}</div>
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
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function generateOrderMessage() {
    if (cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    cart.forEach(item => {
        const itemName = item.name?.[currentLanguage] || item.name?.ku_sorani || 'کاڵای بێ ناو';
        message += `- ${itemName} | ${t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity })}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;
    if (userProfile.name) {
        message += `\n${t('order_user_info')}\n${t('order_user_name')}: ${userProfile.name}\n${t('order_user_address')}: ${userProfile.address}\n${t('order_user_phone')}: ${userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';
    const q = query(collection(db, 'settings', 'contactInfo', 'contactMethods'), orderBy("createdAt"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

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
            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${method.value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${method.value}&text=${encodedMessage}`; break;
                case 'telegram': link = `https://t.me/${method.value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${method.value}`; break;
                case 'url': link = method.value; break;
            }
            if (link) window.open(link, '_blank');
        };
        container.appendChild(btn);
    });
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
    localStorage.setItem("maten_store_favorites", JSON.stringify(favorites));
    renderProducts();
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

function renderFavoritesPage() {
    favoritesContainer.innerHTML = '';
    const favoritedProducts = products.filter(p => favorites.includes(p.id) && !p.isPromoCard);

    if (favoritedProducts.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
    } else {
        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';
        favoritedProducts.forEach(product => {
            favoritesContainer.appendChild(createProductCardElement(product));
        });
    }
}

// =======================================================
// فەنکشنێن دی
// =======================================================

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    if (hash === 'settingsPage') {
        showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        showPage('mainPage');
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }
    if (document.getElementById(hash)) {
        const isSheet = document.getElementById(hash).classList.contains('bottom-sheet');
        openPopup(hash, isSheet ? 'sheet' : 'modal');
    }
}

function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    return escapedText.replace(urlRegex, (url) => `<a href="${url.startsWith('http') ? url : `https://${url}`}" target="_blank" rel="noopener noreferrer">${url}</a>`).replace(/\n/g, '<br>');
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docSnap = await getDoc(doc(db, "settings", "policies"));
        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) { console.error("Error fetching policies:", error); }
}

function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latest = snapshot.docs[0].data();
            const lastSeen = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            notificationBadge.style.display = latest.createdAt > lastSeen ? 'block' : 'none';
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
        const ann = doc.data();
        if (ann.createdAt > latestTimestamp) latestTimestamp = ann.createdAt;
        const date = new Date(ann.createdAt);
        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${ann.title?.[currentLanguage] || ann.title?.ku_sorani}</span>
                <span class="notification-date">${date.toLocaleDateString()}</span>
            </div>
            <p class="notification-content">${ann.content?.[currentLanguage] || ann.content?.ku_sorani}</p>`;
        notificationsListContainer.appendChild(item);
    });
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

function renderContactLinks() {
    const container = document.getElementById('dynamicContactLinksContainer');
    const q = query(collection(db, 'settings/contactInfo/socialLinks'), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) return;
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.className = 'settings-item';
            linkElement.innerHTML = `<div><i class="${link.icon}" style="margin-left: 10px;"></i><span>${name}</span></div><i class="fas fa-external-link-alt"></i>`;
            container.appendChild(linkElement);
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
    /* ... کۆدێ وەرگرتنا GPS وەک خۆ دمینیت ... */
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            searchProductsInFirestore(currentSearch, false);
        }
    }, { threshold: 0.1 });
    if (trigger) observer.observe(trigger);
}

function changePromoCard(direction) {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex = (currentPromoCardIndex + direction + allPromoCards.length) % allPromoCards.length;
    displayPromoCard(currentPromoCardIndex);
    startPromoRotation();
}

function startPromoRotation() {
    if (promoRotationInterval) clearInterval(promoRotationInterval);
    if (allPromoCards.length > 1) {
        promoRotationInterval = setInterval(rotatePromoCard, 5000);
    }
}

function rotatePromoCard() {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex = (currentPromoCardIndex + 1) % allPromoCards.length;
    displayPromoCard(currentPromoCardIndex);
}

function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot) return;
    const cardData = allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    promoCardSlot.style.opacity = 0;
    setTimeout(() => {
        promoCardSlot.parentNode?.replaceChild(newCardElement, promoCardSlot);
    }, 300);
}

async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.unregister();
            }
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
            }
            showNotification(t('update_success'), 'success');
            setTimeout(() => window.location.reload(true), 1500);
        } catch (error) { showNotification(t('error_generic'), 'error'); }
    }
}

// =======================================================
// دەستپێکرنا ئەپلیکەیشنێ
// =======================================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    renderSkeletonLoader();
    enableIndexedDbPersistence(db)
        .then(() => initializeAppLogic())
        .catch((err) => {
            console.error("Persistence failed, running online:", err);
            initializeAppLogic();
        });
}

function initializeAppLogic() {
    onSnapshot(query(categoriesCollection, orderBy("order", "asc")), (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
        renderMainCategories();
    });

    searchProductsInFirestore('', true);
    
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

// PWA & Service Worker
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });
        updateNowBtn.addEventListener('click', () => {
            registration.waiting?.postMessage({ action: 'skipWaiting' });
        });
    }).catch(err => console.log('Service Worker registration failed: ', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

