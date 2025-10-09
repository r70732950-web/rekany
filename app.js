// app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// UI Functions that app.js needs to call for updates
import {
    showNotification, renderProducts, updateAdminUI, renderSkeletonLoader, updateCartCount,
    populateCategoryDropdown, renderMainCategories, loadPoliciesForAdmin, renderAdminAnnouncementsList,
    renderContactMethodsAdmin, renderSocialMediaLinks, renderCategoryManagementUI, notificationBadge,
    closeCurrentPopup, populateParentCategorySelect, populateSubcategoriesForAdmin,
    populateSubSubcategoriesForAdmin
} from './ui.js';

// --- CONFIG AND INITIALIZATION ---
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
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");

// --- STATE MANAGEMENT ---
export const translations = {
    ku_sorani: { search_placeholder: "گەڕان بە ناوی کاڵا...", admin_login_title: "چوونەژوورەوەی بەڕێوەبەر", email_label: "ئیمەیڵ:", password_label: "وشەی نهێنی:", login_button: "چوونەژوورەوە", cart_title: "سەبەتەی کڕین", cart_empty: "سەبەتەکەت بەتاڵە", total_price: "کۆی گشتی:", send_whatsapp: "ناردن لە ڕێگەی واتسئاپ", send_viber: "ناردن لە ڕێگەی فایبەر", send_telegram: "ناردن لە ڕێگەی تێلێگرام", favorites_title: "لیستی دڵخوازەکان", favorites_empty: "لیستی دڵخوازەکانت بەتاڵە", choose_category: "هەڵبژاردنی جۆر", all_products: "هەموو کاڵاکان", loading_products: "...خەریکی بارکردنی کاڵاکانە", settings_title: "ڕێکخستنەکان", language_label: "زمان", profile_title: "پڕۆفایلی من", admin_login_nav: "چوونەژوورەوەی بەڕێوەبەر", logout_nav: "چوونەدەرەوە", profile_name: "ناو:", profile_address: "ناونیشان:", profile_phone: "ژمارەی تەلەفۆن:", save_button: "پاشەکەوتکردن", nav_home: "سەرەکی", nav_categories: "جۆرەکان", nav_cart: "سەبەتە", nav_profile: "پڕۆفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیمان پێوە بکە", add_to_cart: "زیادکردن بۆ سەبەتە", added_to_cart: "زیادکرا", product_not_found_error: "هەڵە: کاڵاکە نەدۆزرایەوە!", delete_confirm: "دڵنیایت دەتەوێت ئەم کاڵایە بسڕیتەوە؟", product_deleted: "کاڵا سڕدرایەوە", product_delete_error: "هەڵە لە سڕینەوەی کاڵا", order_greeting: "سڵاو! من پێویستم بەم کاڵایانەی خوارەوەیە:", order_item_details: "نرخ: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆی گشتی", order_user_info: "--- زانیاری داواکار ---", order_user_name: "ناو", order_user_address: "ناونیشان", order_user_phone: "ژمارەی تەلەفۆن", order_prompt_info: "تکایە ناونیشان و زانیارییەکانت بنێرە بۆ گەیاندن.", login_error: "ئیمەیڵ یان وشەی نهێنی هەڵەیە", logout_success: "بە سەرکەوتوویی چوویتەدەرەوە", profile_saved: "زانیارییەکانی پڕۆفایل پاشەکەوتکران", all_categories_label: "هەموو", install_app: "دامەزراندنی ئەپ", product_added_to_cart: "کاڵاکە زیادکرا بۆ سەبەتە", product_added_to_favorites: "زیادکرا بۆ لیستی دڵخوازەکان", product_removed_from_favorites: "لە لیستی دڵخوازەکان سڕدرایەوە", manage_categories_title: "بەڕێوەبردنی جۆرەکان", manage_contact_methods_title: "بەڕێوەبردنی شێوازەکانی ناردنی داواکاری", notifications_title: "ئاگەهدارییەکان", no_notifications_found: "هیچ ئاگەهدارییەک نییە", manage_announcements_title: "ناردنی ئاگەهداری گشتی", send_new_announcement: "ناردنی ئاگەهداری نوێ", send_announcement_button: "ناردنی ئاگەهداری", sent_announcements: "ئاگەهدارییە نێردراوەکان", no_announcements_sent: "هیچ ئاگەهدارییەک نەنێردراوە", announcement_deleted_success: "ئاگەهدارییەکە سڕدرایەوە", announcement_delete_confirm: "دڵنیایت دەتەوێت ئەم ئاگەهدارییە بسڕیتەوە؟", enable_notifications: "چالاککردنی ئاگەدارییەکان", error_generic: "هەڵەیەک ڕوویدا!", terms_policies_title: "مەرج و ڕێساکان", manage_policies_title: "بەڕێوەبردنی مەرج و ڕێساکان", policies_saved_success: "مەرج و ڕێساکان پاشەکەوتکران", loading_policies: "...خەریکی بارکردنی ڕێساکانە", no_policies_found: "هیچ مەرج و ڕێسایەک دانەنراوە.", has_discount_badge: "داشکانی تێدایە", force_update: "ناچارکردن بە نوێکردنەوە (سڕینەوەی کاش)", update_confirm: "دڵنیایت دەتەوێت ئەپەکە نوێ بکەیتەوە؟ هەموو کاشی ناو وێبگەڕەکەت دەسڕدرێتەوە.", update_success: "ئەپەکە بە سەرکەوتوویی نوێکرایەوە!", },
    ku_badini: { search_placeholder: "لێگەریان ب ناڤێ کاڵای...", admin_login_title: "چوونا ژوور یا بەرپرسى", email_label: "ئیمەیل:", password_label: "پەیڤا نهێنى:", login_button: "چوونا ژوور", cart_title: "سەلکا کرینێ", cart_empty: "سەلکا تە یا ڤالایە", total_price: "کۆمێ گشتی:", send_whatsapp: "فرێکرن ب رێکا واتسئاپ", send_viber: "فرێکرن ب رێکا ڤایبەر", send_telegram: "فرێکرن ب رێکا تێلێگرام", favorites_title: "لیستا حەزژێکریان", favorites_empty: "لیستا حەزژێکریێن تە یا ڤالایە", choose_category: "جورەکی هەلبژێرە", all_products: "هەمی کاڵا", loading_products: "...د بارکرنا کاڵایان دایە", settings_title: "ڕێکخستن", language_label: "زمان", profile_title: "پروفایلێ من", admin_login_nav: "چوونا ژوور یا بەرپرسى", logout_nav: "چوونا دەر", profile_name: "ناڤ:", profile_address: "ناڤ و نیشان:", profile_phone: "ژمارا تەلەفونێ:", save_button: "پاشەکەفتکرن", nav_home: "سەرەکی", nav_categories: "جۆر", nav_cart: "سەلک", nav_profile: "پروفایل", nav_settings: "ڕێکخستن", contact_us_title: "پەیوەندیێ ب مە بکە", add_to_cart: "زێدەکرن بۆ سەلکێ", added_to_cart: "زێدەکر", product_not_found_error: "خەلەتی: کاڵا نەهاتە دیتن!", delete_confirm: "تو پشتڕاستی دێ ڤی کاڵای ژێبەى؟", product_deleted: "کاڵا هاتە ژێبرن", product_delete_error: "خەلەتی د ژێبرنا کاڵای دا", order_greeting: "سلاڤ! ئەز پێدڤی ب ڤان کاڵایێن خوارێ مە:", order_item_details: "بها: {price} د.ع. | ژمارە: {quantity}", order_total: "کۆمێ گشتی", order_user_info: "--- پێزانینێن داخازکەری ---", order_user_name: "ناڤ", order_user_address: "ناڤ و نیشان", order_user_phone: "ژمارا تەلەفونێ", order_prompt_info: "هیڤی دکەین ناڤ و نیشان و پێزانینێن خۆ فرێکە بۆ گەهاندنێ.", login_error: "ئیمەیل یان پەیڤا نهێنى یا خەلەتە", logout_success: "ب سەرکەفتیانە چوويه دەر", profile_saved: "پێزانینێن پروفایلی هاتنە پاشەکەفتکرن", all_categories_label: "هەمی", install_app: "دامەزراندنا ئەپی", product_added_to_cart: "کاڵا هاتە زێدەکرن بۆ سەلکێ", product_added_to_favorites: "هاتە زێدەکرن بۆ لیستا حەزژێکریان", product_removed_from_favorites: "ژ لیستا حەزژێکریان هاتە ژێبرن", manage_categories_title: "рێکخستنا جوران", manage_contact_methods_title: "рێکخستنا رێکێن فرێکرنا داخازیێ", notifications_title: "ئاگەهداری", no_notifications_found: "چ ئاگەهداری نینن", manage_announcements_title: "رێکخستنا ئاگەهداریان", send_new_announcement: "فرێکرنا ئاگەهداریەکا نوو", send_announcement_button: "ئاگەهداریێ فرێکە", sent_announcements: "ئاگەهداریێن هاتینە فرێکرن", no_announcements_sent: "چ ئاگەهداری نەهاتینە فرێکرن", announcement_deleted_success: "ئاگەهداری هاتە ژێبرن", announcement_delete_confirm: "تو پشتڕاستی دێ ڤێ ئاگەهداریێ ژێبەی؟", enable_notifications: "چالاکرنا ئاگەهداریان", error_generic: "خەلەتییەک چێبوو!", terms_policies_title: "مەرج و سیاسەت", manage_policies_title: "рێکخستنا مەرج و سیاسەتان", policies_saved_success: "مەرج و سیاسەت هاتنە پاشەکەفتکرن", loading_policies: "...د بارکرنا سیاسەتان دایە", no_policies_found: "چ مەرج و سیاسەت نەهاتینە دانان.", has_discount_badge: "داشکان تێدایە", force_update: "ناچارکرن ب نویکرنەوە (ژێبرنا کاشی)", update_confirm: "تو پشتراستی دێ ئەپی نویکەیەڤە؟ دێ هەمی کاش د ناڤ وێبگەرا تە دا هێتە ژێبرن.", update_success: "ئەپ ب سەرکەfتیانە هاتە نویکرن!", },
    ar: { search_placeholder: "البحث باسم المنتج...", admin_login_title: "تسجيل دخول المسؤول", email_label: "البريد الإلكتروني:", password_label: "كلمة المرور:", login_button: "تسجيل الدخول", cart_title: "سلة التسوق", cart_empty: "سلتك فارغة", total_price: "المجموع الكلي:", send_whatsapp: "إرسال عبر واتساب", send_viber: "إرسال عبر فايبر", send_telegram: "إرسال عبر تليجرام", favorites_title: "قائمة المفضلة", favorites_empty: "قائمة المفضلة فارغة", choose_category: "اختر الفئة", all_products: "كل المنتجات", loading_products: "...جاري تحميل المنتجات", settings_title: "الإعدادات", language_label: "اللغة", profile_title: "ملفي الشخصي", admin_login_nav: "تسجيل دخول المسؤول", logout_nav: "تسجيل الخروج", profile_name: "الاسم:", profile_address: "العنوان:", profile_phone: "رقم الهاتف:", save_button: "حفظ", nav_home: "الرئيسية", nav_categories: "الفئات", nav_cart: "السلة", nav_profile: "ملفي", nav_settings: "الإعدادات", contact_us_title: "تواصل معنا", add_to_cart: "إضافة إلى السلة", added_to_cart: "تمت الإضافة", product_not_found_error: "خطأ: المنتج غير موجود!", delete_confirm: "هل أنت متأكد من أنك تريد حذف هذا المنتج؟", product_deleted: "تم حذف المنتج", product_delete_error: "خطأ في حذف المنتج", order_greeting: "مرحباً! أحتاج إلى المنتجات التالية:", order_item_details: "السعر: {price} د.ع. | الكمية: {quantity}", order_total: "المجموع الكلي", order_user_info: "--- معلومات العميل ---", order_user_name: "الاسم", order_user_address: "العنوان", order_user_phone: "رقم الهاتف", order_prompt_info: "يرجى إرسال عنوانك وتفاصيلك للتوصيل.", login_error: "البريد الإلكتروني أو كلمة المرور غير صحيحة", logout_success: "تم تسجيل الخروج بنجاح", profile_saved: "تم حفظ معلومات الملف الشخصي", all_categories_label: "الكل", install_app: "تثبيت التطبيق", product_added_to_cart: "تمت إضافة المنتج إلى السلة", product_added_to_favorites: "تمت الإضافة إلى المفضلة", product_removed_from_favorites: "تمت الإزالة من المفضلة", manage_categories_title: "إدارة الفئات", manage_contact_methods_title: "إدارة طرق إرسال الطلب", notifications_title: "الإشعارات", no_notifications_found: "لا توجد إشعارات", manage_announcements_title: "إدارة الإشعارات العامة", send_new_announcement: "إرسال إشعار جدید", send_announcement_button: "إرسال الإشعار", sent_announcements: "الإشعارات المرسلة", no_announcements_sent: "لم يتم إرسال أي إشعارات", announcement_deleted_success: "تم حذف الإشعار", announcement_delete_confirm: "هل أنت متأكد من حذف هذا الإشعار؟", enable_notifications: "تفعيل الإشعارات", error_generic: "حدث خطأ!", terms_policies_title: "الشروط والسياسات", manage_policies_title: "إدارة الشروط والسياسات", policies_saved_success: "تم حفظ الشروط والسياسات بنجاح", loading_policies: "...جاري تحميل السياسات", no_policies_found: "لم يتم تحديد أي شروط أو سياسات.", has_discount_badge: "يتضمن خصم", force_update: "فرض التحديث (مسح ذاكرة التخزين المؤقت)", update_confirm: "هل أنت متأكد من رغبتك في تحديث التطبيق؟ سيتم مسح جميع بيانات ذاكرة التخزين المؤقت.", update_success: "تم تحديث التطبيق بنجاح!", }
};
export let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
export let deferredPrompt;
export let cart = JSON.parse(localStorage.getItem("maten_store_cart")) || [];
export let favorites = JSON.parse(localStorage.getItem("maten_store_favorites")) || [];
export let userProfile = JSON.parse(localStorage.getItem("maten_store_profile")) || {};
export let isAdmin = false;
export let editingProductId = null;
export let products = [];
export let categories = [];
let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
const PRODUCTS_PER_PAGE = 25;
export let currentCategory = 'all';
export let currentSubcategory = 'all';
export let currentSubSubcategory = 'all';

// --- UTILITY & STATE MODIFICATION FUNCTIONS ---
export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function t(key, replacements = {}) {
    let translation = (translations[currentLanguage] && translations[currentLanguage][key]) || translations['ku_sorani'][key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

export function setLanguageState(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
}

export function saveCart() {
    localStorage.setItem("maten_store_cart", JSON.stringify(cart));
    updateCartCount();
}

export function saveFavorites() {
    localStorage.setItem("maten_store_favorites", JSON.stringify(favorites));
}

export function saveProfile(newProfile) {
    userProfile = newProfile;
    localStorage.setItem("maten_store_profile", JSON.stringify(userProfile));
}

export function setCurrentCategory(catId) { currentCategory = catId; }
export function setCurrentSubcategory(subCatId) { currentSubcategory = subCatId; }
export function setCurrentSubSubcategory(subSubCatId) { currentSubSubcategory = subSubCatId; }
export function setEditingProductId(id) { editingProductId = id; }
export function clearDeferredPrompt() { deferredPrompt = null; }

// --- DATA LOGIC FUNCTIONS ---
export function addToCart(productId) {
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

export function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            import('./ui.js').then(ui => ui.renderCart());
        }
    }
}

export function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    import('./ui.js').then(ui => ui.renderCart());
}

export function toggleFavorite(productId) {
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
    import('./ui.js').then(ui => {
        if (document.getElementById('favoritesSheet').classList.contains('show')) {
            ui.renderFavoritesPage();
        }
    });
}

// --- FIREBASE FUNCTIONS (Auth, Firestore, etc.) ---

export async function handleLogin(e) {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        closeCurrentPopup();
    } catch (error) {
        showNotification(t('login_error'), 'error');
    }
}

export async function handleLogout() {
    await signOut(auth);
    showNotification(t('logout_success'), 'success');
}

export async function handleProductFormSubmit(e) {
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

    const productNameKuSorani = document.getElementById('productNameKuSorani').value;
    const productData = {
        name: { ku_sorani: productNameKuSorani, ku_badini: document.getElementById('productNameKuBadini').value, ar: document.getElementById('productNameAr').value },
        searchableName: productNameKuSorani.toLowerCase(),
        price: parseInt(document.getElementById('productPrice').value),
        originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
        categoryId: document.getElementById('productCategoryId').value,
        subcategoryId: document.getElementById('productSubcategoryId').value || null,
        subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
        description: { ku_sorani: document.getElementById('productDescriptionKuSorani').value, ku_badini: document.getElementById('productDescriptionKuBadini').value, ar: document.getElementById('productDescriptionAr').value },
        imageUrls: imageUrls,
        createdAt: Date.now(),
        externalLink: document.getElementById('productExternalLink').value || null,
        shippingInfo: { ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(), ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(), ar: document.getElementById('shippingInfoAr').value.trim() }
    };
    
    try {
        if (editingProductId) {
            const { createdAt, ...updateData } = productData;
            await updateDoc(doc(db, "products", editingProductId), updateData);
            showNotification('کاڵا نوێکرایەوە', 'success');
        } else {
            await addDoc(productsCollection, productData);
            showNotification('کاڵا زیادکرا', 'success');
        }
        closeCurrentPopup();
        searchProductsInFirestore(document.getElementById('searchInput').value, true);
    } catch (error) {
        showNotification(t('error_generic'), 'error');
        console.error("Error saving product:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
        editingProductId = null;
    }
}

export async function handleDeleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(document.getElementById('searchInput').value, true);
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
    }
}

export async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };
    const ui = await import('./ui.js');
    ui.openEditProductForm(product);
}

// ... All other logic functions go here (handle categories, policies, etc.) ...
// This includes: handleDeleteCategory, handleAddMainCategory, etc.

export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    // ... Function body is the same as before ...
}

export async function forceUpdate() {
    // ... Function body is the same as before ...
}

export async function requestNotificationPermission() {
    // ... Function body is the same as before ...
}

// --- INITIALIZATION LOGIC ---
export function initializeAppLogic() {
    enableIndexedDbPersistence(db).catch(err => console.error("Persistence error: ", err));

    onSnapshot(query(categoriesCollection, orderBy("order", "asc")), (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
        populateCategoryDropdown();
        renderMainCategories();
        if (isAdmin) {
            populateParentCategorySelect();
            renderCategoryManagementUI();
            populateSubcategoriesForAdmin();
            populateSubSubcategoriesForAdmin();
        }
    });
    
    onAuthStateChanged(auth, async (user) => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
        isAdmin = user && user.uid === adminUID;
        sessionStorage.setItem('isAdmin', String(isAdmin));
        updateAdminUI(isAdmin);
        renderProducts(); 
        if(isAdmin) {
            loadPoliciesForAdmin();
            renderAdminAnnouncementsList();
            renderContactMethodsAdmin();
            renderSocialMediaLinks();
            renderCategoryManagementUI();
        }
    });

    onMessage(messaging, (payload) => {
        const { title, body } = payload.notification;
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block';
    });

    searchProductsInFirestore('', true);
    checkNewAnnouncements();
}