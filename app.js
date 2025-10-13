import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import from new modules
import { t, showNotification } from './utils.js';
import {
    closeAllPopupsUI, openPopup, showPage, updateActiveNav, renderProducts,
    renderSkeletonLoader, renderCart, renderFavoritesPage, renderCategoriesSheet,
    searchProductsInFirestore, renderMainCategories, checkNewAnnouncements,
    renderPolicies, setupGpsButton, renderSubcategories, renderSubSubcategories,
    changePromoCard, renderHomePageContent, renderCartActionButtons
} from './ui-handlers.js';
import {
    updateAdminUI, loadPoliciesForAdmin, renderAdminAnnouncementsList,
    renderContactMethodsAdmin, renderSocialMediaLinksAdmin, renderCategoryManagementUI,
    deleteAnnouncement, deleteContactMethod, deleteSocialMediaLink, renderPromoCardsAdminList
} from './admin-handlers.js';

const firebaseConfig = {
    // ... (Your Firebase Config remains the same)
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Export collections for other modules
export const productsCollection = collection(db, "products");
export const categoriesCollection = collection(db, "categories");
export const announcementsCollection = collection(db, "announcements");
export const promoCardsCollection = collection(db, "promo_cards");

// Export translations
export const translations = {
    // ... (Your Translations object remains the same)
    ku_sorani: { /* ... */ },
    ku_badini: { /* ... */ },
    ar: { /* ... */ }
};

// Global State (exported to be accessed by other modules)
export let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
export let deferredPrompt;
const CART_KEY = "maten_store_cart";
export let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
const FAVORITES_KEY = "maten_store_favorites";
export let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
const PROFILE_KEY = "maten_store_profile";
export let userProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
export let isAdmin = false;
export let editingProductId = null; // Used by admin-handlers
export let currentSearch = '';
export let products = []; // Array to hold fetched products
export let allPromoCards = [];
export let currentPromoCardIndex = 0;
export let promoRotationInterval = null;
export let categories = []; // Array of main categories
export let contactInfo = {};
export let lastVisibleProductDoc = null;
export let isLoadingMoreProducts = false;
export let allProductsLoaded = false;
export const PRODUCTS_PER_PAGE = 25;
export let mainPageScrollPosition = 0;

export let currentCategory = 'all';
export let currentSubcategory = 'all';
export let currentSubSubcategory = 'all';
export let isRenderingHomePage = false;

// Expose state to window object for modules to easily access (less ideal, but simplifies imports/exports for quick fix)
// **THIS IS THE REQUIRED "ONE LESS LINE" CHANGE:**
window.products = products;
window.favorites = favorites;
window.isRenderingHomePage = isRenderingHomePage;
window.promoRotationInterval = promoRotationInterval;

// Helper to update global state variables and window counterparts
export function setGlobalState(key, value) {
    switch(key) {
        case 'products': window.products = products = value; break;
        case 'favorites': window.favorites = favorites = value; break;
        case 'currentCategory': currentCategory = value; break;
        case 'currentSubcategory': currentSubcategory = value; break;
        case 'currentSubSubcategory': currentSubSubcategory = value; break;
        case 'currentSearch': currentSearch = value; break;
        case 'lastVisibleProductDoc': lastVisibleProductDoc = value; break;
        case 'allProductsLoaded': allProductsLoaded = value; break;
        case 'isLoadingMoreProducts': isLoadingMoreProducts = value; break;
        case 'mainPageScrollPosition': mainPageScrollPosition = value; break;
        case 'allPromoCards': allPromoCards = value; break;
        case 'currentPromoCardIndex': currentPromoCardIndex = value; break;
        case 'editingProductId': editingProductId = value; break;
        case 'isRenderingHomePage': window.isRenderingHomePage = isRenderingHomePage = value; break;
        case 'cart': cart = value; break;
        default: console.warn(`Attempted to set unknown global state key: ${key}`);
    }
}

// DOM Elements (Keep local to reduce exports)
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const loginForm = document.getElementById('loginForm');
const productForm = document.getElementById('productForm');
const homeBtn = document.getElementById('homeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const profileBtn = document.getElementById('profileBtn');
const cartBtn = document.getElementById('cartBtn');
const categoriesBtn = document.getElementById('categoriesBtn');
const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
const addProductBtn = document.getElementById('addProductBtn');
const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
const contactToggle = document.getElementById('contactToggle');
const socialMediaToggle = document.getElementById('socialMediaToggle');
const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
const notificationBtn = document.getElementById('notificationBtn');
const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
const policiesForm = document.getElementById('policiesForm');
const announcementForm = document.getElementById('announcementForm');
const productCategorySelect = document.getElementById('productCategoryId');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const addCategoryForm = document.getElementById('addCategoryForm');
const addSubcategoryForm = document.getElementById('addSubcategoryForm');
const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
const editCategoryForm = document.getElementById('editCategoryForm');
const addContactMethodForm = document.getElementById('addContactMethodForm');
const addPromoCardForm = document.getElementById('addPromoCardForm');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
const forceUpdateBtn = document.getElementById('forceUpdateBtn');
const updateNotification = document.getElementById('update-notification');
const updateNowBtn = document.getElementById('update-now-btn');
const imageInputsContainer = document.getElementById('imageInputsContainer');


// =======================================================
// Core Functions
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

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

export function startPromoRotation() {
    if (window.promoRotationInterval) {
        clearInterval(window.promoRotationInterval);
    }
    if (allPromoCards.length > 1) {
        window.promoRotationInterval = setInterval(rotatePromoCard, 5000);
    }
}

function rotatePromoCard() {
    if (allPromoCards.length <= 1) return;
    changePromoCard(1);
}

function populateCategoryDropdown() {
    const select = productCategorySelect;
    select.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + currentLanguage] || cat.name_ku_sorani;
        select.appendChild(option);
    });
}

function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + currentLanguage] || cat.name_ku_sorani;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
}

// =======================================================
// Translation and Initialization
// =======================================================

export function setLanguage(lang) {
    setGlobalState('currentLanguage', lang);
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
    if (document.getElementById('socialLinksListContainer')) renderSocialMediaLinksAdmin();
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

// =======================================================
// Event Listeners
// =======================================================

function setupEventListeners() {
    homeBtn.onclick = () => { history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname); showPage('mainPage'); };
    settingsBtn.onclick = () => { history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage'); showPage('settingsPage'); };
    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); };
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); };
    addProductBtn.onclick = () => {
        setGlobalState('editingProductId', null);
        productForm.reset();
        createProductImageInputs();
        document.getElementById('subcategorySelectContainer').style.display = 'none';
        document.getElementById('subSubcategorySelectContainer').style.display = 'none';
        document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
        productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        openPopup('productFormModal', 'modal');
    };
    settingsLogoutBtn.onclick = async () => { await signOut(auth); };
    document.querySelectorAll('.close').forEach(btn => btn.onclick = () => history.back());
    document.getElementById('sheet-overlay').onclick = () => history.back();
    window.onclick = (e) => { if (e.target.classList.contains('modal')) history.back(); };
    window.addEventListener('popstate', (event) => {
        closeAllPopupsUI();
        const state = event.state;
        if (state) {
            if (state.type === 'page') { showPage(state.id); }
            else if (state.type === 'sheet' || state.type === 'modal') { openPopup(state.id, state.type); }
        } else { showPage('mainPage'); }
    });


    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) { showNotification(t('login_error'), 'error'); }
    };

    productCategorySelect.addEventListener('change', (e) => {
        // Assume these functions are available in admin-handlers
        // Note: they need to be imported or refactored to be accessible
        // For now, keep the original names and assume they're imported/available
        populateSubcategoriesDropdown(e.target.value);
        populateSubSubcategoriesDropdown(null, null);
    });

    productSubcategorySelect.addEventListener('change', (e) => {
        const mainCatId = productCategorySelect.value;
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
                categoryId: productCategorySelect.value,
                subcategoryId: productSubcategorySelect.value || null,
                subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                description: productDescriptionObject,
                imageUrls: imageUrls,
                externalLink: document.getElementById('productExternalLink').value || null,
                shippingInfo: {
                    ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                    ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                    ar: document.getElementById('shippingInfoAr').value.trim()
                }
            };
            if (!editingProductId) { productData.createdAt = Date.now(); }

            if (editingProductId) {
                const { createdAt, ...updateData } = productData;
                await updateDoc(doc(db, "products", editingProductId), updateData);
                showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                await addDoc(productsCollection, productData);
                showNotification('کاڵا زیادکرا', 'success');
            }
            history.back(); // Use history.back() for modals/sheets
            searchProductsInFirestore(currentSearch, true);
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            console.error("Error saving product:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            setGlobalState('editingProductId', null);
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
        setGlobalState('currentSearch', searchTerm);
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        setGlobalState('currentSearch', '');
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

    document.getElementById('profileForm').onsubmit = (e) => {
        e.preventDefault();
        setGlobalState('userProfile', {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        });
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        showNotification(t('profile_saved'), 'success');
        history.back();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => { setLanguage(btn.dataset.lang); };
    });

    if (document.getElementById('installAppBtn')) {
        document.getElementById('installAppBtn').addEventListener('click', async () => {
            if (deferredPrompt) {
                document.getElementById('installAppBtn').style.display = 'none';
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                setGlobalState('deferredPrompt', null);
            }
        });
    }

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
            } catch (error) { console.error("Error adding main category: ", error); showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی'; }
        });
    }

    if (addSubcategoryForm) {
        addSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            const parentCategoryId = document.getElementById('parentCategorySelect').value;
            if (!parentCategoryId) { showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error'); return; }
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
            } catch (error) { console.error("Error adding subcategory: ", error); showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی'; }
        });
    }

    if (addSubSubcategoryForm) {
        addSubSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
            const mainCatId = mainCatSelect.value;
            const subCatId = subCatSelect.value;
            if (!mainCatId || !subCatId) { showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error'); return; }
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
            } catch (error) { console.error("Error adding sub-subcategory: ", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
        });
    }

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
            if (level === '1') { updateData.icon = document.getElementById('editCategoryIcon').value; }
            try {
                await updateDoc(doc(db, docPath), updateData);
                showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                history.back();
            } catch (error) { console.error("Error updating category: ", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
            finally { submitButton.disabled = false; submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری'; }
        });
    }

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
            } catch (error) { console.error("Error adding contact method: ", error); showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; }
        });
    }

    if (document.getElementById('addSocialMediaForm')) {
        document.getElementById('addSocialMediaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            const linkData = {
                name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                name_ku_badini: document.getElementById('socialNameKuBadini').value,
                name_ar: document.getElementById('socialNameAr').value,
                url: document.getElementById('socialUrl').value,
                icon: document.getElementById('socialIcon').value,
                createdAt: Date.now()
            };
            try {
                const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
                await addDoc(socialLinksCollection, linkData);
                showNotification('لینکی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                document.getElementById('addSocialMediaForm').reset();
            } catch (error) { showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; }
        });
    }

    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); });

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
            } catch (error) { console.error("Error sending announcement: ", error); showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; submitButton.textContent = t('send_announcement_button'); }
        });
    }

    if (termsAndPoliciesBtn) { termsAndPoliciesBtn.addEventListener('click', () => { openPopup('termsSheet'); }); }

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
            } catch (error) { console.error("Error saving policies:", error); showNotification(t('error_generic'), 'error'); }
            finally { submitButton.disabled = false; }
        });
    }

    if(addPromoCardForm) {
        addPromoCardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            const editingId = document.getElementById('editingPromoCardId').value;
            const cardData = {
                imageUrls: {
                    ku_sorani: document.getElementById('promoCardImageKuSorani').value,
                    ku_badini: document.getElementById('promoCardImageKuBadini').value,
                    ar: document.getElementById('promoCardImageAr').value,
                },
                categoryId: document.getElementById('promoCardTargetCategory').value,
                order: parseInt(document.getElementById('promoCardOrder').value),
            };
            if (!editingId) { cardData.createdAt = Date.now(); }

            try {
                if (editingId) {
                    await setDoc(doc(db, "promo_cards", editingId), cardData);
                    showNotification('کارتەکە نوێکرایەوە', 'success');
                } else {
                    await addDoc(promoCardsCollection, cardData);
                    showNotification('کارتی نوێ زیادکرا', 'success');
                }
                addPromoCardForm.reset();
                document.getElementById('editingPromoCardId').value = '';
                submitButton.textContent = 'پاشەکەوتکردن';
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
            finally { submitButton.disabled = false; }
        });
    }


    if (enableNotificationsBtn) { enableNotificationsBtn.addEventListener('click', requestNotificationPermission); }
    if(forceUpdateBtn) { forceUpdateBtn.addEventListener('click', forceUpdate); }

    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
    });
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
            });
            if (currentToken) { await saveTokenToFirestore(currentToken); }
        } else { showNotification('مۆڵەت نەدرا', 'error'); }
    } catch (error) { console.error('An error occurred while requesting permission: ', error); }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), { createdAt: Date.now() });
    } catch (error) { console.error('Error saving token to Firestore: ', error); }
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            searchProductsInFirestore(currentSearch, false);
        }
    }, { root: null, threshold: 0.1 });

    observer.observe(trigger);
}

// =======================================================
// Initialization Sequence
// =======================================================

onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";

    if (user && user.uid === adminUID) {
        setGlobalState('isAdmin', true);
        sessionStorage.setItem('isAdmin', 'true');
        loadPoliciesForAdmin();
        if (document.getElementById('loginModal').style.display === 'block') { history.back(); }
    } else {
        setGlobalState('isAdmin', false);
        sessionStorage.removeItem('isAdmin');
        if (user) { await signOut(auth); }
    }

    updateAdminUI(isAdmin);
    searchProductsInFirestore(currentSearch, true);
});

function init() {
    renderSkeletonLoader();

    enableIndexedDbPersistence(db)
        .then(() => { console.log("Firestore offline persistence enabled successfully."); initializeAppLogic(); })
        .catch((err) => {
            if (err.code == 'failed-precondition') { console.warn('Firestore Persistence failed: Multiple tabs open.'); }
            else if (err.code == 'unimplemented') { console.warn('Firestore Persistence failed: Browser not supported.'); }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic();
        });
}

function initializeAppLogic() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGlobalState('categories', [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]);

        populateCategoryDropdown();
        renderMainCategories();

        if (isAdmin) {
            populateParentCategorySelect();
            renderCategoryManagementUI();

            // Logic for sub-sub category creation dropdowns in admin section
            const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
            if (mainCatSelectForSubSub && subCatSelectForSubSub) {
                mainCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
                categories.filter(cat => cat.id !== 'all').forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                    mainCatSelectForSubSub.appendChild(option);
                });
                if (!mainCatSelectForSubSub.listenerAttached) {
                    mainCatSelectForSubSub.addEventListener('change', async () => {
                        const mainCategoryId = mainCatSelectForSubSub.value;
                        if (!mainCategoryId) { subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>'; return; };

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

    const contactInfoRef = doc(db, "settings", "contactInfo");
    onSnapshot(contactInfoRef, (docSnap) => {
        if (docSnap.exists()) {
            setGlobalState('contactInfo', docSnap.data());
            // updateContactLinksUI function removed as it was empty/unnecessary
        } else { console.log("No contact info document found!"); }
    });

    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    setLanguage(currentLanguage);
    renderSocialMediaLinksAdmin(); // Updated to use the admin-handler version
    renderContactLinks(); // Remains in app.js for now, but should ideally be moved
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
    handleInitialPageLoad();
}

function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

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


document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setGlobalState('deferredPrompt', e);
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) { installBtn.style.display = 'flex'; }
});

if ('serviceWorker' in navigator) {
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

    }).catch(err => { console.log('Service Worker registration failed: ', err); });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}