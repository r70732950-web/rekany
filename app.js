import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// === ئیمپۆرتی هەموو فەنکشنەکانی UI ===
import * as UI from './ui.js';

const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// === Initialize Firebase ===
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");

const translations = {
    ku_sorani: { search_placeholder: "گەڕان بە ناوی کاڵا...", admin_login_title: "چوونەژوورەوەی بەڕێوەبەر", email_label: "ئیمەیڵ:", password_label: "وشەی نهێنی:", login_button: "چوونەژوورەوە", cart_title: "سەبەتەی کڕین", cart_empty: "سەبەتەکەت بەتاڵە", total_price: "کۆی گشتی:", send_whatsapp: "ناردن لە ڕێگەی واتسئاپ", send_viber: "ناردن لە ڕێگەی فایبەر", send_telegram: "ناردن لە ڕێگەی تێلێگرام", favorites_title: "لیستی دڵخوازەکان", favorites_empty: "لیستی دڵخوازەکانت بەتاڵە", choose_category: "هەڵبژاردنی جۆر", all_products: "هەموو کاڵاکان", loading_products: "...خەریکی بارکردنی کاڵاکانە", settings_title: "ڕێکخستنەکان", language_label: "زمان", profile_title: "پڕۆفایلی من", admin_login_nav: "چوونەژوورەوەی بەڕێوەبەر", logout_nav: "چوونەدەرەوە", profile_name: "ناو:", profile_address: "ناونیشان:", profile_phone: "ژمارەی تەلەفۆن:", save_button: "پاشەکەوتکردن", nav_home: "سەرەکی", nav_categories: "جۆرەکان", nav_cart: "سەبەتە", nav_profile: "پڕۆفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیمان پێوە بکە", add_to_cart: "زیادکردن بۆ سەبەتە", added_to_cart: "زیادکرا", product_not_found_error: "هەڵە: کاڵاکە نەدۆزرایەوە!", delete_confirm: "دڵنیایت دەتەوێت ئەم کاڵایە بسڕیتەوە؟", product_deleted: "کاڵا سڕدرایەوە", product_delete_error: "هەڵە لە سڕینەوەی کاڵا", order_greeting: "سڵاو! من پێویستم بەم کاڵایانەی خوارەوەیە:", order_item_details: "نرخ: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆی گشتی", order_user_info: "--- زانیاری داواکار ---", order_user_name: "ناو", order_user_address: "ناونیشان", order_user_phone: "ژمارەی تەلەفۆن", order_prompt_info: "تکایە ناونیشان و زانیارییەکانت بنێرە بۆ گەیاندن.", login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە", logout_success: "بە سەرکەوتوویی چوویتەدەرەوە", profile_saved: "زانیارییەکانی پڕۆفایل پاشەکەوتکران", all_categories_label: "هەموو", install_app: "دامەزراندنی ئەپ", product_added_to_cart: "کاڵاکە زیادکرا بۆ سەبەتە", product_added_to_favorites: "زیادکرا بۆ لیستی دڵخوازەکان", product_removed_from_favorites: "لە لیستی دڵخوازەکان سڕدرایەوە", manage_categories_title: "بەڕێوەبردنی جۆرەکان", manage_contact_methods_title: "بەڕێوەبردنی شێوازەکانی ناردنی داواکاری", notifications_title: "ئاگەهدارییەکان", no_notifications_found: "هیچ ئاگەهدارییەک نییە", manage_announcements_title: "ناردنی ئاگەهداری گشتی", send_new_announcement: "ناردنی ئاگەهداری نوێ", send_announcement_button: "ناردنی ئاگەهداری", sent_announcements: "ئاگەهدارییە نێردراوەکان", no_announcements_sent: "هیچ ئاگەهدارییەک نەنێردراوە", announcement_deleted_success: "ئاگەهدارییەکە سڕدرایەوە", announcement_delete_confirm: "دڵنیایت دەتەوێت ئەم ئاگەهدارییە بسڕیتەوە؟", enable_notifications: "چالاککردنی ئاگەدارییەکان", error_generic: "هەڵەیەک ڕوویدا!", terms_policies_title: "مەرج و ڕێساکان", manage_policies_title: "بەڕێوەبردنی مەرج و ڕێساکان", policies_saved_success: "مەرج و ڕێساکان پاشەکەوتکران", loading_policies: "...خەریکی بارکردنی ڕێساکانە", no_policies_found: "هیچ مەرج و ڕێسایەک دانەنراوە.", has_discount_badge: "داشکانی تێدایە", force_update: "ناچارکردن بە نوێکردنەوە (سڕینەوەی کاش)", update_confirm: "دڵنیایت دەتەوێت ئەپەکە نوێ بکەیتەوە؟ هەموو کاشی ناو وێبگەڕەکەت دەسڕدرێتەوە.", update_success: "ئەپەکە بە سەرکەوتوویی نوێکرایەوە!", },
    ku_badini: { search_placeholder: "لێگەریان ب ناڤێ کاڵای...", admin_login_title: "چوونا ژوور یا بەرپرسى", email_label: "ئیمەیل:", password_label: "پەیڤا نهێنى:", login_button: "چوونا ژوور", cart_title: "سەلکا کرینێ", cart_empty: "سەلکا تە یا ڤالایە", total_price: "کۆمێ گشتی:", send_whatsapp: "فرێکرن ب رێکا واتسئاپ", send_viber: "فرێکرن ب رێکا ڤایبەر", send_telegram: "فرێکرن ب رێکا تێلێگرام", favorites_title: "لیستا حەزژێکریان", favorites_empty: "لیستا حەزژێکریێن تە یا ڤالایە", choose_category: "جورەکی هەلبژێرە", all_products: "هەمی کاڵا", loading_products: "...د بارکرنا کاڵایان دایە", settings_title: "ڕێکخستن", language_label: "زمان", profile_title: "پروفایلێ من", admin_login_nav: "چوونا ژوور یا بەرپرسى", logout_nav: "چوونا دەر", profile_name: "ناڤ:", profile_address: "ناڤ و نیشان:", profile_phone: "ژمارا تەلەفونێ:", save_button: "پاشەکەفتکرن", nav_home: "سەرەکی", nav_categories: "جۆر", nav_cart: "سەلک", nav_profile: "پروفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیێ ب مە بکە", add_to_cart: "زێدەکرن بۆ سەلکێ", added_to_cart: "زێدەکر", product_not_found_error: "خەلەتی: کاڵا نەهاتە دیتن!", delete_confirm: "تو پشتڕاستی دێ ڤی کاڵای ژێبەى؟", product_deleted: "کاڵا هاتە ژێبرن", product_delete_error: "خەلەتی د ژێبرنا کاڵای دا", order_greeting: "سلاڤ! ئەز پێدڤی ب ڤان کاڵایێن خوارێ مە:", order_item_details: "بها: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆمێ گشتی", order_user_info: "--- پێزانینێن داخازکەری ---", order_user_name: "ناڤ", order_user_address: "ناڤ و نیشان", order_user_phone: "ژمارا تەلەفونێ", order_prompt_info: "هیڤی دکەین ناڤ و نیشان و پێزانینێن خۆ فرێکە بۆ گەهاندنێ.", login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە", logout_success: "ب سەرکەفتیانە چوويه دەر", profile_saved: "پێزانینێن پروفایلی هاتنە پاشەکەفتکرن", all_categories_label: "هەمی", install_app: "دامەزراندنا ئەپی", product_added_to_cart: "کاڵا هاتە زێدەکرن بۆ سەلکێ", product_added_to_favorites: "هاتە زێدەکرن بۆ لیستا حەزژێکریان", product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێبرن", manage_categories_title: "рێکخستنا جوران", manage_contact_methods_title: "рێکخستنا رێکێن فرێکرنا داخازیێ", notifications_title: "ئاگەهداری", no_notifications_found: "چ ئاگەهداری نینن", manage_announcements_title: "رێکخستنا ئاگەهداریان", send_new_announcement: "فرێکرنا ئاگەهداریەکا نوو", send_announcement_button: "ئاگەهداریێ فرێکە", sent_announcements: "ئاگەهداریێن هاتینە فرێکرن", no_announcements_sent: "چ ئاگەهداری نەهاتینە فرێکرن", announcement_deleted_success: "ئاگەهداری هاتە ژێبرن", announcement_delete_confirm: "تو پشتڕاستی دێ ڤێ ئاگەهداریێ ژێبەی؟", enable_notifications: "چالاکرنا ئاگەهداریان", error_generic: "خەلەتییەک چێبوو!", terms_policies_title: "مەرج و سیاسەت", manage_policies_title: "рێکخستنا مەرج و سیاسەتان", policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن", loading_policies: "...د بارکرنا سیاسەتان دایە", no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.", has_discount_badge: "داشکان تێدایە", force_update: "ناچارکرن ب نویکرنەوە (ژێبرنا کاشی)", update_confirm: "تو پشتراستی دێ ئەپی نویکەیەڤە؟ دێ هەمی کاش د ناڤ وێبگەرا تە دا هێتە ژێبرن.", update_success: "ئەپ ب سەرکەفتیانە هاتە نویکرن!", },
    ar: { search_placeholder: "البحث باسم المنتج...", admin_login_title: "تسجيل دخول المسؤول", email_label: "البريد الإلكتروني:", password_label: "كلمة المرور:", login_button: "تسجيل الدخول", cart_title: "سلة التسوق", cart_empty: "سلتك فارغة", total_price: "المجموع الكلي:", send_whatsapp: "إرسال عبر واتساب", send_viber: "إرسال عبر فايبر", send_telegram: "إرسال عبر تليجرام", favorites_title: "قائمة المفضلة", favorites_empty: "قائمة المفضلة فارغة", choose_category: "اختر الفئة", all_products: "كل المنتجات", loading_products: "...جاري تحميل المنتجات", settings_title: "الإعدادات", language_label: "اللغة", profile_title: "ملفي الشخصي", admin_login_nav: "تسجيل دخول المسؤول", logout_nav: "تسجيل الخروج", profile_name: "الاسم:", profile_address: "العنوان:", profile_phone: "رقم الهاتف:", save_button: "حفظ", nav_home: "الرئيسية", nav_categories: "الفئات", nav_cart: "السلة", nav_profile: "ملفي", nav_settings: "الإعدادات", contact_us_title: "تواصل معنا", add_to_cart: "إضافة إلى السلة", added_to_cart: "تمت الإضافة", product_not_found_error: "خطأ: المنتج غير موجود!", delete_confirm: "هل أنت متأكد من أنك تريد حذف هذا المنتج؟", product_deleted: "تم حذف المنتج", product_delete_error: "خطأ في حذف المنتج", order_greeting: "مرحباً! أحتاج إلى المنتجات التالية:", order_item_details: "السعر: {price} د.ع. | الكمية: {quantity}", order_total: "المجموع الكلي", order_user_info: "--- معلومات العميل ---", order_user_name: "الاسم", order_user_address: "العنوان", order_user_phone: "رقم الهاتف", order_prompt_info: "يرجى إرسال عنوانك وتفاصيلك للتوصيل.", login_error: "البريد الإلكتروني أو كلمة المرور غير صحيحة", logout_success: "تم تسجيل الخروج بنجاح", profile_saved: "تم حفظ معلومات الملف الشخصي", all_categories_label: "الكل", install_app: "تثبيت التطبيق", product_added_to_cart: "تمت إضافة المنتج إلى السلة", product_added_to_favorites: "تمت الإضافة إلى المفضلة", product_removed_from_favorites: "تمت الإزالة من المفضلة", manage_categories_title: "إدارة الفئات", manage_contact_methods_title: "إدارة طرق إرسال الطلب", notifications_title: "الإشعارات", no_notifications_found: "لا توجد إشعارات", manage_announcements_title: "إدارة الإشعارات العامة", send_new_announcement: "إرسال إشعار جدید", send_announcement_button: "إرسال الإشعار", sent_announcements: "الإشعارات المرسلة", no_announcements_sent: "لم يتم إرسال أي إشعارات", announcement_deleted_success: "تم حذف الإشعار", announcement_delete_confirm: "هل أنت متأكد من حذف هذا الإشعار؟", enable_notifications: "تفعيل الإشعارات", error_generic: "حدث خطأ!", terms_policies_title: "الشروط والسياسات", manage_policies_title: "إدارة الشروط والسياسات", policies_saved_success: "تم حفظ الشروط والسياسات بنجاح", loading_policies: "...جاري تحميل السياسات", no_policies_found: "لم يتم تحديد أي شروط أو سياسات.", has_discount_badge: "يتضمن خصم", force_update: "فرض التحديث (مسح ذاكرة التخزين المؤقت)", update_confirm: "هل أنت متأكد من رغبتك في تحديث التطبيق؟ سيتم مسح جميع بيانات ذاكرة التخزين المؤقت.", update_success: "تم تحديث التطبيق بنجاح!", }
};

// === App State ===
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

// === DOM Elements ===
const elements = {
    loginModal: document.getElementById('loginModal'),
    addProductBtn: document.getElementById('addProductBtn'),
    productFormModal: document.getElementById('productFormModal'),
    productsContainer: document.getElementById('productsContainer'),
    skeletonLoader: document.getElementById('skeletonLoader'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    loginForm: document.getElementById('loginForm'),
    productForm: document.getElementById('productForm'),
    formTitle: document.getElementById('formTitle'),
    imageInputsContainer: document.getElementById('imageInputsContainer'),
    loader: document.getElementById('loader'),
    cartBtn: document.getElementById('cartBtn'),
    cartItemsContainer: document.getElementById('cartItemsContainer'),
    emptyCartMessage: document.getElementById('emptyCartMessage'),
    cartTotal: document.getElementById('cartTotal'),
    totalAmount: document.getElementById('totalAmount'),
    cartActions: document.getElementById('cartActions'),
    favoritesContainer: document.getElementById('favoritesContainer'),
    emptyFavoritesMessage: document.getElementById('emptyFavoritesMessage'),
    categoriesBtn: document.getElementById('categoriesBtn'),
    sheetOverlay: document.getElementById('sheet-overlay'),
    sheetCategoriesContainer: document.getElementById('sheetCategoriesContainer'),
    productCategorySelect: document.getElementById('productCategoryId'),
    subcategorySelectContainer: document.getElementById('subcategorySelectContainer'),
    productSubcategorySelect: document.getElementById('productSubcategoryId'),
    subSubcategorySelectContainer: document.getElementById('subSubcategorySelectContainer'),
    productSubSubcategorySelect: document.getElementById('productSubSubcategoryId'),
    profileForm: document.getElementById('profileForm'),
    settingsPage: document.getElementById('settingsPage'),
    mainPage: document.getElementById('mainPage'),
    homeBtn: document.getElementById('homeBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsFavoritesBtn: document.getElementById('settingsFavoritesBtn'),
    settingsAdminLoginBtn: document.getElementById('settingsAdminLoginBtn'),
    settingsLogoutBtn: document.getElementById('settingsLogoutBtn'),
    profileBtn: document.getElementById('profileBtn'),
    contactToggle: document.getElementById('contactToggle'),
    adminSocialMediaManagement: document.getElementById('adminSocialMediaManagement'),
    addSocialMediaForm: document.getElementById('addSocialMediaForm'),
    socialLinksListContainer: document.getElementById('socialLinksListContainer'),
    socialMediaToggle: document.getElementById('socialMediaToggle'),
    notificationBtn: document.getElementById('notificationBtn'),
    notificationBadge: document.getElementById('notificationBadge'),
    notificationsSheet: document.getElementById('notificationsSheet'),
    notificationsListContainer: document.getElementById('notificationsListContainer'),
    adminAnnouncementManagement: document.getElementById('adminAnnouncementManagement'),
    announcementForm: document.getElementById('announcementForm'),
    termsAndPoliciesBtn: document.getElementById('termsAndPoliciesBtn'),
    termsSheet: document.getElementById('termsSheet'),
    termsContentContainer: document.getElementById('termsContentContainer'),
    adminPoliciesManagement: document.getElementById('adminPoliciesManagement'),
    policiesForm: document.getElementById('policiesForm'),
    subSubcategoriesContainer: document.getElementById('subSubcategoriesContainer'),
    mainCategoriesContainer: document.getElementById('mainCategoriesContainer'),
};

// === Context Object ===
// This object bundles everything the UI functions might need
function getContext() {
    return {
        // State
        isAdmin, currentLanguage, cart, favorites, products, categories, userProfile,
        currentCategory, currentSubcategory, currentSubSubcategory, mainPageScrollPosition,
        // Elements
        elements,
        // Functions
        t, addToCart, removeFromCart, updateQuantity, toggleFavorite, isFavorite, editProduct,
        deleteProduct, searchProductsInFirestore, setLanguage, renderFavoritesPage,
        deleteAnnouncement,
        // Firebase
        db, collection, query, orderBy, getDocs, onSnapshot, getDoc, doc
    };
}

// === Utility Functions ===
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function t(key, replacements = {}) {
    let translation = translations[currentLanguage][key] || translations['ku_sorani'][key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// === State Management ===
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

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
    UI.showNotification(t('product_added_to_cart'));
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    UI.renderCart(getContext());
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            UI.renderCart(getContext());
        }
    }
}

function toggleFavorite(productId) {
    const productIndex = favorites.indexOf(productId);
    if (productIndex > -1) {
        favorites.splice(productIndex, 1);
        UI.showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        favorites.push(productId);
        UI.showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();
    UI.renderProducts(getContext());
    if (elements.favoritesContainer.parentElement.parentElement.classList.contains('show')) {
        renderFavoritesPage();
    }
}

// === Data & Core Logic ===
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    if (isLoadingMoreProducts) return;
    
    if (isNewSearch) {
        allProductsLoaded = false;
        lastVisibleProductDoc = null;
        products = [];
        UI.renderSkeletonLoader(getContext());
    }
    
    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    elements.loader.style.display = 'block';

    try {
        let q = collection(db, "products");
        
        if (currentCategory && currentCategory !== 'all') q = query(q, where("categoryId", "==", currentCategory));
        if (currentSubcategory && currentSubcategory !== 'all') q = query(q, where("subcategoryId", "==", currentSubcategory));
        if (currentSubSubcategory && currentSubSubcategory !== 'all') q = query(q, where("subSubcategoryId", "==", currentSubSubcategory));
        
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
             q = query(q, where('searchableName', '>=', finalSearchTerm), where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
        }
        
        q = finalSearchTerm ? query(q, orderBy("searchableName", "asc"), orderBy("createdAt", "desc")) : query(q, orderBy("createdAt", "desc"));

        if (lastVisibleProductDoc && !isNewSearch) {
            q = query(q, startAfter(lastVisibleProductDoc));
        }
        
        q = query(q, limit(PRODUCTS_PER_PAGE));

        const querySnapshot = await getDocs(q);
        const newProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        products = isNewSearch ? newProducts : [...products, ...newProducts];

        if (querySnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            document.getElementById('scroll-loader-trigger').style.display = 'none';
        } else {
            document.getElementById('scroll-loader-trigger').style.display = 'block';
        }

        lastVisibleProductDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        UI.renderProducts(getContext());

        if (products.length === 0) {
            elements.productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        elements.productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا لە کاتی هێنانی کاڵاکان.</p>';
    } finally {
        isLoadingMoreProducts = false;
        elements.loader.style.display = 'none';
        elements.skeletonLoader.style.display = 'none';
        elements.productsContainer.style.display = 'grid';
    }
}

async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        UI.showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };
    editingProductId = productId;
    elements.formTitle.textContent = 'دەستکاری کردنی کاڵا';
    elements.productForm.reset();

    if (product.name && typeof product.name === 'object') {
        document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
        document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
        document.getElementById('productNameAr').value = product.name.ar || '';
    } else {
        document.getElementById('productNameKuSorani').value = product.name;
    }
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';
    document.getElementById('productCategoryId').value = product.categoryId || product.category;
    if (product.description) {
        document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
        document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
        document.getElementById('productDescriptionAr').value = product.description.ar || '';
    }
    const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
    UI.createProductImageInputs(getContext(), imageUrls);
    document.getElementById('productExternalLink').value = product.externalLink || '';
    if (product.shippingInfo) {
        document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
        document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
        document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
    }
    await UI.populateSubcategoriesDropdown(getContext(), product.categoryId, product.subcategoryId);
    await UI.populateSubSubcategoriesDropdown(getContext(), product.categoryId, product.subcategoryId, product.subSubcategoryId);
    elements.productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    UI.openPopup('productFormModal', 'modal', getContext());
}

async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        UI.showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(elements.searchInput.value, true);
    } catch (error) {
        UI.showNotification(t('product_delete_error'), 'error');
    }
}

async function deleteAnnouncement(id) {
    if (confirm(t('announcement_delete_confirm'))) {
        try {
            await deleteDoc(doc(db, "announcements", id));
            UI.showNotification(t('announcement_deleted_success'), 'success');
        } catch (e) {
            UI.showNotification(t('error_generic'), 'error');
        }
    }
}

async function deleteSocialMediaLink(linkId) {
    if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
        try {
            await deleteDoc(doc(db, 'settings', 'contactInfo', 'socialLinks', linkId));
            UI.showNotification('لینکەکە سڕدرایەوە', 'success');
        } catch (error) {
            UI.showNotification(t('error_generic'), 'error');
        }
    }
}

async function deleteContactMethod(methodId) {
    if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
        try {
            await deleteDoc(doc(db, 'settings', 'contactInfo', 'contactMethods', methodId));
            UI.showNotification('شێوازەکە سڕدرایەوە', 'success');
        } catch (error) {
            UI.showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
        }
    }
}

async function handleDeleteCategory(docPath, categoryName) {
    const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
    if (confirmation) {
        try {
            await deleteDoc(doc(db, docPath));
            UI.showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
        } catch (error) {
            UI.showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
        }
    }
}

function renderFavoritesPage() {
    const favoritedProducts = products.filter(p => isFavorite(p.id));
    UI.renderFavoritesPage(getContext(), favoritedProducts);
}

// === App Initialization & Event Listeners ===
function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';
    document.querySelectorAll('[data-translate-key]').forEach(el => {
        const key = el.dataset.translateKey;
        const translation = t(key);
        if (['INPUT', 'TEXTAREA'].includes(el.tagName)) {
            if (el.placeholder) el.placeholder = translation;
        } else {
            el.textContent = translation;
        }
    });
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
    const fetchedCategories = categories.filter(cat => cat.id !== 'all');
    categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
    UI.renderProducts(getContext());
    UI.renderMainCategories(getContext());
    UI.renderCategoriesSheet(getContext());
    if (elements.cartItemsContainer.parentElement.parentElement.classList.contains('show')) UI.renderCart(getContext());
    if (elements.favoritesContainer.parentElement.parentElement.classList.contains('show')) renderFavoritesPage();
}

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const element = document.getElementById(hash);
    if (hash === 'settingsPage') {
        UI.showPage('settingsPage', elements.mainPage, UI.updateActiveNav);
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        UI.showPage('mainPage', elements.mainPage, UI.updateActiveNav);
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }
    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            UI.openPopup(hash, isSheet ? 'sheet' : 'modal', getContext());
        }
    }
}

function setupEventListeners() {
    elements.homeBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        UI.showPage('mainPage', elements.mainPage, UI.updateActiveNav);
    };
    elements.settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        UI.showPage('settingsPage', elements.mainPage, UI.updateActiveNav);
    };
    elements.profileBtn.onclick = () => {
        UI.openPopup('profileSheet', 'sheet', getContext());
        UI.updateActiveNav('profileBtn');
    };
    elements.cartBtn.onclick = () => {
        UI.openPopup('cartSheet', 'sheet', getContext());
        UI.updateActiveNav('cartBtn');
    };
    elements.categoriesBtn.onclick = () => {
        UI.openPopup('categoriesSheet', 'sheet', getContext());
        UI.updateActiveNav('categoriesBtn');
    };
    elements.settingsFavoritesBtn.onclick = () => UI.openPopup('favoritesSheet', 'sheet', getContext());
    elements.settingsAdminLoginBtn.onclick = () => UI.openPopup('loginModal', 'modal', getContext());
    elements.addProductBtn.onclick = () => {
        editingProductId = null;
        elements.productForm.reset();
        UI.createProductImageInputs(getContext());
        elements.subcategorySelectContainer.style.display = 'none';
        elements.subSubcategorySelectContainer.style.display = 'none';
        elements.formTitle.textContent = 'زیادکردنی کاڵای نوێ';
        elements.productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        UI.openPopup('productFormModal', 'modal', getContext());
    };
    elements.settingsLogoutBtn.onclick = async () => await signOut(auth);
    elements.sheetOverlay.onclick = () => UI.closeCurrentPopup(getContext());
    document.querySelectorAll('.close').forEach(btn => btn.onclick = () => UI.closeCurrentPopup(getContext()));
    window.onclick = (e) => { if (e.target.classList.contains('modal')) UI.closeCurrentPopup(getContext()); };
    elements.loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            UI.showNotification(t('login_error'), 'error');
        }
    };
    const debouncedSearch = debounce((term) => searchProductsInFirestore(term, true), 500);
    elements.searchInput.oninput = () => {
        currentSearch = elements.searchInput.value;
        elements.clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
        debouncedSearch(currentSearch);
    };
    elements.clearSearchBtn.onclick = () => {
        elements.searchInput.value = '';
        currentSearch = '';
        elements.clearSearchBtn.style.display = 'none';
        searchProductsInFirestore('', true);
    };
    elements.productForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '...چاوەڕێ بە';
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url);
        if (imageUrls.length === 0) {
            UI.showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            return;
        }
        const productNameKuSorani = document.getElementById('productNameKuSorani').value;
        const productData = {
            name: {
                ku_sorani: productNameKuSorani,
                ku_badini: document.getElementById('productNameKuBadini').value,
                ar: document.getElementById('productNameAr').value
            },
            searchableName: productNameKuSorani.toLowerCase(),
            price: parseInt(document.getElementById('productPrice').value),
            originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
            categoryId: document.getElementById('productCategoryId').value,
            subcategoryId: document.getElementById('productSubcategoryId').value || null,
            subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
            description: {
                ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                ku_badini: document.getElementById('productDescriptionKuBadini').value,
                ar: document.getElementById('productDescriptionAr').value
            },
            imageUrls: imageUrls,
            createdAt: Date.now(),
            externalLink: document.getElementById('productExternalLink').value || null,
            shippingInfo: {
                ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                ar: document.getElementById('shippingInfoAr').value.trim()
            }
        };
        try {
            if (editingProductId) {
                const { createdAt, ...updateData } = productData;
                await updateDoc(doc(db, "products", editingProductId), updateData);
                UI.showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                await addDoc(productsCollection, productData);
                UI.showNotification('کاڵا زیادکرا', 'success');
            }
            UI.closeCurrentPopup(getContext());
            searchProductsInFirestore(currentSearch, true);
        } catch (error) {
            UI.showNotification(t('error_generic'), 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            editingProductId = null;
        }
    };
    elements.profileForm.onsubmit = (e) => {
        e.preventDefault();
        userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        UI.showNotification(t('profile_saved'), 'success');
        UI.closeCurrentPopup(getContext());
    };
    document.querySelectorAll('.lang-btn').forEach(btn => btn.onclick = () => setLanguage(btn.dataset.lang));
    // ... all other event listeners
}

function initializeAppLogic() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
        UI.populateCategoryDropdown(getContext());
        UI.renderMainCategories(getContext());
        if (isAdmin) {
            // Further admin UI setup
        }
    });
    searchProductsInFirestore('', true);
    updateCartCount();
    setupEventListeners();
    handleInitialPageLoad();
    UI.showWelcomeMessage(getContext());
    UI.setupGpsButton(getContext());
    UI.checkNewAnnouncements(getContext());
}

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    isAdmin = !!(user && user.uid === adminUID);
    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) await signOut(auth);
    }
    UI.updateAdminUI(getContext());
    UI.renderProducts(getContext());
});

document.addEventListener('DOMContentLoaded', () => {
    enableIndexedDbPersistence(db)
        .catch((err) => console.error("Persistence error:", err))
        .finally(initializeAppLogic);
});

window.addEventListener('popstate', (event) => {
    UI.closeAllPopupsUI(getContext());
    const state = event.state;
    if (state) {
        if (state.type === 'page') {
            UI.showPage(state.id, elements.mainPage, UI.updateActiveNav);
        } else if (state.type === 'sheet' || state.type === 'modal') {
            UI.openPopup(state.id, state.type, getContext());
        }
    } else {
        UI.showPage('mainPage', elements.mainPage, UI.updateActiveNav);
    }
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
            registration.waiting.postMessage({ action: 'skipWaiting' });
        });
    }).catch(err => console.log('SW registration failed: ', err));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}