import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import all our UI functions under the 'UI' namespace
import * as UI from './ui.js';

// --- Firebase Config and Initialization ---
const firebaseConfig = {
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
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");

// --- Translations ---
const translations = {
    // ... [کۆدی وەرگێڕانەکان لێرەدا وەک خۆی دەمێنێتەوە] ...
    // ... (من لێرەدا کورتم کردووەتەوە بۆ ئەوەی درێژ نەبێت، بەڵام تۆی خۆت مەیسڕەوە) ...
    ku_sorani: { search_placeholder: "گەڕان بە ناوی کاڵا...", /* ... هتد */ },
    ku_badini: { search_placeholder: "لێگەریان ب ناڤێ کاڵای...", /* ... هتد */ },
    ar: { search_placeholder: "البحث باسم المنتج...", /* ... هتد */ }
};


// --- App State ---
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

let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSubSubcategory = 'all';

// --- DOM Elements (for event listeners) ---
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const loginForm = document.getElementById('loginForm');
const productForm = document.getElementById('productForm');
const imageInputsContainer = document.getElementById('imageInputsContainer');
const productCategorySelect = document.getElementById('productCategoryId');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const profileForm = document.getElementById('profileForm');
const announcementForm = document.getElementById('announcementForm');
const policiesForm = document.getElementById('policiesForm');

// --- Helper Functions (Core Logic) ---
function t(key, replacements = {}) {
    const lang = translations[currentLanguage] || translations['ku_sorani'];
    let translation = lang[key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
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

// --- Page Navigation & Popups (Logic part) ---
function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        UI.closeAllPopupsUI();
    }
}

function openPopupWithCallbacks(id, type = 'sheet') {
    const callbacks = {
        renderCart: () => UI.renderCart(cart, t, userProfile, handleQuantityChange, handleRemoveFromCart),
        renderFavoritesPage: () => UI.renderFavoritesPage(products, favorites, isAdmin, t, { handleCardClick }),
        renderCategoriesSheet: () => UI.renderCategoriesSheet(categories, currentCategory, t, handleSheetCategoryClick),
        renderUserNotifications: async () => {
            const announcements = await getDocs(query(announcementsCollection, orderBy("createdAt", "desc")));
            UI.renderUserNotifications(announcements, t, currentLanguage);
        },
        renderPolicies: () => renderPolicies(),
        loadProfileData: () => UI.loadProfileData(userProfile)
    };
    UI.openPopup(id, type, callbacks);
}


function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const element = document.getElementById(hash);

    if (hash === 'settingsPage') {
        UI.showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        UI.showPage('mainPage');
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }

    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopupWithCallbacks(hash, isSheet ? 'sheet' : 'modal');
        }
    }
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

    UI.renderProducts(products, isAdmin, favorites, t, { handleCardClick });
    UI.renderMainCategories(categories, currentCategory, t, handleMainCategoryClick);
    UI.renderCategoriesSheet(categories, currentCategory, t, handleSheetCategoryClick);
    if (document.getElementById('cartSheet').classList.contains('show')) UI.renderCart(cart, t, userProfile, handleQuantityChange, handleRemoveFromCart);
    if (document.getElementById('favoritesSheet').classList.contains('show')) UI.renderFavoritesPage(products, favorites, isAdmin, t, { handleCardClick });
}

// --- State Management ---
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    UI.updateCartCount(cart);
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
        UI.showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        favorites.push(productId);
        UI.showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();
    UI.renderProducts(products, isAdmin, favorites, t, { handleCardClick });
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        UI.renderFavoritesPage(products, favorites, isAdmin, t, { handleCardClick });
    }
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

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            UI.renderCart(cart, t, userProfile, handleQuantityChange, handleRemoveFromCart);
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    UI.renderCart(cart, t, userProfile, handleQuantityChange, handleRemoveFromCart);
}

function generateOrderMessage() {
    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    if (cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.toLocaleString()} د.ع.\n`;

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

// --- Firestore/API Logic ---
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    if (isLoadingMoreProducts) return;
    
    if (isNewSearch) {
        allProductsLoaded = false;
        lastVisibleProductDoc = null;
        products = [];
        UI.renderSkeletonLoader();
    }
    
    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    document.getElementById('loader').style.display = 'block';

    try {
        let q = collection(db, "products");
        if (currentCategory && currentCategory !== 'all') q = query(q, where("categoryId", "==", currentCategory));
        if (currentSubcategory && currentSubcategory !== 'all') q = query(q, where("subcategoryId", "==", currentSubcategory));
        if (currentSubSubcategory && currentSubSubcategory !== 'all') q = query(q, where("subSubcategoryId", "==", currentSubSubcategory));
        
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            q = query(q, where('searchableName', '>=', finalSearchTerm), where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
            q = query(q, orderBy("searchableName", "asc"));
        }
        q = query(q, orderBy("createdAt", "desc"));

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

        allProductsLoaded = (querySnapshot.docs.length < PRODUCTS_PER_PAGE);
        document.getElementById('scroll-loader-trigger').style.display = allProductsLoaded ? 'none' : 'block';
        lastVisibleProductDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        UI.renderProducts(products, isAdmin, favorites, t, { handleCardClick });
        UI.setupScrollAnimations();

        if (products.length === 0) {
            document.getElementById('productsContainer').innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        document.getElementById('productsContainer').innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا لە کاتی هێنانی کاڵاکان.</p>';
    } finally {
        isLoadingMoreProducts = false;
        document.getElementById('loader').style.display = 'none';
        document.getElementById('skeletonLoader').style.display = 'none';
        document.getElementById('productsContainer').style.display = 'grid';
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
    
    UI.showProductForm(product, categories, db);
}

async function deleteProduct(productId) {
    if (!confirm(t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        UI.showNotification(t('product_deleted'), 'success');
        searchProductsInFirestore(searchInput.value, true);
    } catch (error) {
        UI.showNotification(t('product_delete_error'), 'error');
        console.error("Error deleting product:", error);
    }
}

async function renderPolicies() {
    await UI.renderPolicies(db, t, currentLanguage);
}

// ... other logic functions ...

// --- Event Handlers & Listeners ---
function handleMainCategoryClick(categoryId) {
    currentCategory = categoryId;
    currentSubcategory = 'all';
    currentSubSubcategory = 'all';
    UI.renderMainCategories(categories, currentCategory, t, handleMainCategoryClick);
    UI.renderSubcategories(db, currentCategory, t, handleSubCategoryClick); // This will fetch and render
    UI.renderSubSubcategories(db, currentCategory, currentSubcategory, t, handleSubSubCategoryClick); // This will clear it
    searchProductsInFirestore('', true);
}

function handleSubCategoryClick(subcatId) {
    currentSubcategory = subcatId;
    currentSubSubcategory = 'all';
    UI.renderSubcategories(db, currentCategory, t, handleSubCategoryClick, currentSubcategory);
    UI.renderSubSubcategories(db, currentCategory, currentSubcategory, t, handleSubSubCategoryClick);
    searchProductsInFirestore('', true);
}

function handleSubSubCategoryClick(subSubcatId) {
    currentSubSubcategory = subSubcatId;
    UI.renderSubSubcategories(db, currentCategory, currentSubcategory, t, handleSubSubCategoryClick, currentSubSubcategory);
    searchProductsInFirestore('', true);
}

function handleSheetCategoryClick(categoryId) {
    handleMainCategoryClick(categoryId); // Re-use the same logic
    closeCurrentPopup();
    UI.showPage('mainPage');
}

function handleQuantityChange(productId, change) {
    updateQuantity(productId, change);
}

function handleRemoveFromCart(productId) {
    removeFromCart(productId);
}

function handleCardClick(event, product) {
    const target = event.target;
    const addToCartButton = target.closest('.add-to-cart-btn-card');

    if (addToCartButton) {
        addToCart(product.id);
        if (!addToCartButton.disabled) {
            const originalContent = `<span>${t('add_to_cart')}</span>`;
            addToCartButton.disabled = true;
            addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            setTimeout(() => {
                addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${originalContent}`;
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
        UI.showProductDetails(product, t, (productId) => addToCart(productId));
    }
}

function setupEventListeners() {
    document.getElementById('homeBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        UI.showPage('mainPage');
    };
    document.getElementById('settingsBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        UI.showPage('settingsPage');
    };
    document.getElementById('profileBtn').onclick = () => {
        openPopupWithCallbacks('profileSheet');
        UI.updateActiveNav('profileBtn');
    };
    document.getElementById('cartBtn').onclick = () => {
        openPopupWithCallbacks('cartSheet');
        UI.updateActiveNav('cartBtn');
    };
    document.getElementById('categoriesBtn').onclick = () => {
        openPopupWithCallbacks('categoriesSheet');
        UI.updateActiveNav('categoriesBtn');
    };
    document.getElementById('settingsFavoritesBtn').onclick = () => openPopupWithCallbacks('favoritesSheet');
    document.getElementById('settingsAdminLoginBtn').onclick = () => openPopupWithCallbacks('loginModal', 'modal');
    document.getElementById('addProductBtn').onclick = () => {
        editingProductId = null;
        UI.showProductForm(null, categories, db);
    };
    document.getElementById('settingsLogoutBtn').onclick = async () => await signOut(auth);
    
    document.getElementById('sheet-overlay').onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            UI.showNotification(t('login_error'), 'error');
        }
    };
    // ... all other event listeners
}

// ... More logic functions to keep in app.js ...

// --- Main App Initialization ---
function initializeAppLogic() {
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
        
        UI.populateCategoryDropdown(categories, 'productCategoryId');
        UI.renderMainCategories(categories, currentCategory, t, handleMainCategoryClick);
        
        if (isAdmin) {
            // Setup admin-specific dropdowns and UI
        }
        setLanguage(currentLanguage);
    });

    searchProductsInFirestore('', true);
    
    saveCart(); // To initialize cart count on load
    setupEventListeners(); // Setup all event listeners
    handleInitialPageLoad(); // Handle initial page state based on URL
    UI.showWelcomeMessage();
    UI.setupGpsButton( (message, type) => UI.showNotification(message, type));
}

function init() {
    UI.renderSkeletonLoader();
    enableIndexedDbPersistence(db)
        .then(initializeAppLogic)
        .catch((err) => {
            console.error("Persistence failed, running online:", err.code);
            initializeAppLogic();
        });
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('popstate', (event) => {
    UI.closeAllPopupsUI();
    const state = event.state;
    if (state) {
        if (state.type === 'page') {
            UI.showPage(state.id);
        } else if (state.type === 'sheet' || state.type === 'modal') {
            openPopupWithCallbacks(state.id, state.type);
        }
    } else {
        UI.showPage('mainPage');
    }
});