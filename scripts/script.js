// scripts/script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, orderBy, getDocs, setDoc, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

import * as UI from './ui.js';
import { initializeAdmin } from './admin.js';

// Make firebase services available globally for ui.js to use them
window.firebase = {
    firestore: { getFirestore, collection, query, orderBy, onSnapshot, getDocs }
};

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
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");

const appContext = {
    currentLanguage: localStorage.getItem('language') || 'ku_sorani',
    cart: JSON.parse(localStorage.getItem("maten_store_cart")) || [],
    favorites: JSON.parse(localStorage.getItem("maten_store_favorites")) || [],
    userProfile: JSON.parse(localStorage.getItem("maten_store_profile")) || {},
    isAdmin: false,
    adminInitialized: false,
    currentCategory: 'all',
    currentSubcategory: 'all',
    currentSearch: '',
    products: [],
    categories: [],
    subcategories: [],
    deferredPrompt: null,
    
    productsContainer: document.getElementById('productsContainer'),
    skeletonLoader: document.getElementById('skeletonLoader'),
    loader: document.getElementById('loader'),
    cartItemsContainer: document.getElementById('cartItemsContainer'),
    emptyCartMessage: document.getElementById('emptyCartMessage'),
    cartTotal: document.getElementById('cartTotal'),
    totalAmount: document.getElementById('totalAmount'),
    favoritesContainer: document.getElementById('favoritesContainer'),
    emptyFavoritesMessage: document.getElementById('emptyFavoritesMessage'),
    productCategorySelect: document.getElementById('productCategoryId'),
    subcategoriesContainer: document.getElementById('subcategoriesContainer'),
};

UI.initializeUI(appContext);

function saveCart() {
    localStorage.setItem("maten_store_cart", JSON.stringify(appContext.cart));
    UI.updateCartCount();
}

function addToCart(productId) {
    const product = appContext.products.find(p => p.id === productId);
    if (!product) return;
    const existingItem = appContext.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const image = product.imageUrls?.[0] || product.image || '';
        appContext.cart.push({ id: product.id, name: product.name, price: product.price, image, quantity: 1 });
    }
    saveCart();
    UI.showNotification('کاڵاکە زیادکرا بۆ سەبەتە', 'success');
}

function updateQuantity(productId, change) {
    const cartItem = appContext.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            appContext.cart = appContext.cart.filter(item => item.id !== productId);
        }
        saveCart();
        UI.renderCart();
    }
}

function removeFromCart(productId) {
    appContext.cart = appContext.cart.filter(item => item.id !== productId);
    saveCart();
    UI.renderCart();
}

function saveFavorites() {
    localStorage.setItem("maten_store_favorites", JSON.stringify(appContext.favorites));
}

function toggleFavorite(productId) {
    const favIndex = appContext.favorites.indexOf(productId);
    if (favIndex > -1) {
        appContext.favorites.splice(favIndex, 1);
        UI.showNotification('لە لیستی دڵخوازەکان سڕدرایەوە', 'error');
    } else {
        appContext.favorites.push(productId);
        UI.showNotification('زیادکرا بۆ لیستی دڵخوازەکان', 'success');
    }
    saveFavorites();
    UI.renderProducts();
}

function closeAllPopups() {
    if (history.state?.sheet || history.state?.modal) {
        history.back();
    } else {
        UI._closeAllPopupsWithoutHistory();
    }
}

function toggleSheet(sheetId, show) {
    const sheetElement = document.getElementById(sheetId);
    if (!sheetElement) return;

    if (show) {
        UI._closeAllPopupsWithoutHistory();
        if (sheetId === 'cartSheet') UI.renderCart();
        if (sheetId === 'favoritesSheet') UI.renderFavoritesPage();
        sheetElement.classList.add('show');
        document.getElementById('sheet-overlay').classList.add('show');
        document.body.classList.add('overlay-active');
        history.pushState({ sheet: sheetId }, '', `#${sheetId}`);
    } else {
        closeAllPopups();
    }
}

async function renderSubcategories(categoryId) {
    appContext.subcategoriesContainer.innerHTML = '';
    if (categoryId === 'all') {
        appContext.subcategories = [];
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const querySnapshot = await getDocs(subcategoriesQuery);
        appContext.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        UI.renderSubcategoriesUI();
    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        appContext.subcategories = [];
    }
}


function setupEventListeners() {
    document.getElementById('homeBtn').onclick = () => {
        appContext.currentCategory = 'all';
        appContext.currentSubcategory = 'all';
        UI.showPage('mainPage');
        UI.updateActiveNav('homeBtn');
        UI.renderMainCategories();
        renderSubcategories('all');
        UI.renderProducts();
    };

    document.getElementById('settingsBtn').onclick = () => {
        UI.showPage('settingsPage');
        UI.updateActiveNav('settingsBtn');
    };
    
    document.getElementById('cartBtn').onclick = () => toggleSheet('cartSheet', true);
    document.getElementById('categoriesBtn').onclick = () => toggleSheet('categoriesSheet', true);
    document.getElementById('profileBtn').onclick = () => toggleSheet('profileSheet', true);
    document.getElementById('settingsFavoritesBtn').onclick = () => toggleSheet('favoritesSheet', true);

    document.getElementById('searchInput').oninput = (e) => {
        appContext.currentSearch = e.target.value;
        document.getElementById('clearSearchBtn').style.display = appContext.currentSearch ? 'block' : 'none';
        UI.renderProducts();
    };

    document.getElementById('clearSearchBtn').onclick = () => {
        document.getElementById('searchInput').value = '';
        appContext.currentSearch = '';
        document.getElementById('clearSearchBtn').style.display = 'none';
        UI.renderProducts();
    };

    appContext.productsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const productId = card.dataset.productId;

        if (e.target.closest('.add-to-cart-btn-card')) {
            addToCart(productId);
        } else if (e.target.closest('.favorite-btn')) {
            toggleFavorite(productId);
        } else if (e.target.closest('.edit-btn')) {
            window.editProduct?.(productId);
        } else if (e.target.closest('.delete-btn')) {
            window.deleteProduct?.(productId);
        } else {
            // UI.showProductDetails(productId);
        }
    });
    
    document.getElementById('mainCategoriesContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.main-category-btn');
        if (!btn) return;
        appContext.currentCategory = btn.dataset.categoryId;
        appContext.currentSubcategory = 'all';
        UI.renderMainCategories();
        renderSubcategories(appContext.currentCategory);
        UI.renderProducts();
    });
    
    document.getElementById('sheetCategoriesContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.sheet-category-btn');
        if (!btn) return;
        appContext.currentCategory = btn.dataset.categoryId;
        appContext.currentSubcategory = 'all';
        closeAllPopups();
        UI.showPage('mainPage');
        UI.updateActiveNav('homeBtn');
        UI.renderMainCategories();
        renderSubcategories(appContext.currentCategory);
        UI.renderProducts();
    });
    
    appContext.cartItemsContainer.addEventListener('click', (e) => {
        const id = e.target.closest('button')?.dataset.id;
        if (!id) return;
        if (e.target.closest('.increase-btn')) updateQuantity(id, 1);
        if (e.target.closest('.decrease-btn')) updateQuantity(id, -1);
        if (e.target.closest('.cart-item-remove')) removeFromCart(id);
    });

    document.getElementById('settingsLogoutBtn').onclick = async () => {
        await signOut(auth);
        sessionStorage.removeItem('isAdmin');
        appContext.isAdmin = false;
        appContext.adminInitialized = false;
        UI.updateAdminUI(false);
        UI.showNotification('بە سەرکەوتوویی چوویتەدەرەوە', 'success');
    };
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => UI.applyLanguageUI(btn.dataset.lang);
    });

    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeAllPopups);
    document.getElementById('sheet-overlay').onclick = closeAllPopups;

    // ======== زیادکراوەکان بۆ چارەسەری کێشەکان ========

    // 1. بۆ چالاککردنی دوگمەی ئاگەدارییەکان (Notifications)
    document.getElementById('notificationBtn').onclick = () => {
        UI.renderAnnouncements();
        toggleSheet('notificationsSheet', true);
    };

    // 2. بۆ چالاککردنی دوگمەی GPS
    document.getElementById('getLocationBtn').onclick = (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.querySelector('span').textContent = '...چاوەڕێ بە';

        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            btn.disabled = false;
            btn.querySelector('span').textContent = 'وەرگرتنا ناڤ و نیشانێ من ب GPS';
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // For simplicity, we just put coordinates. A real app would use a Geocoding API.
                document.getElementById('profileAddress').value = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
                btn.disabled = false;
                btn.querySelector('span').textContent = 'وەرگرتنا ناڤ و نیشانێ من ب GPS';
            },
            () => {
                alert('Unable to retrieve your location. Please check your browser permissions.');
                btn.disabled = false;
                btn.querySelector('span').textContent = 'وەرگرتنا ناڤ و نیشانێ من ب GPS';
            }
        );
    };

    // 3. بۆ چالاککردنی لیستی پەیوەندی (Contact Us)
    document.getElementById('contactToggle').onclick = (e) => {
        const toggle = e.currentTarget;
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = toggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // 4. بۆ چالاککردنی داواکردنی ئاگەداری (Push Notifications)
    document.getElementById('enableNotificationsBtn').onclick = () => {
        console.log("Requesting permission...");
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                console.log("Notification permission granted.");
                // ** گرنگ: تکایە VAPID Keyی خۆت لێرە دابنێ **
                getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY_FROM_FIREBASE' })
                    .then((currentToken) => {
                        if (currentToken) {
                            console.log('FCM Token:', currentToken);
                            UI.showNotification('ئاگەدارییەکان چالاکران', 'success');
                        } else {
                            console.log('No registration token available.');
                            UI.showNotification('کێشەیەک لە وەرگرتنی تۆکن ڕوویدا', 'error');
                        }
                    }).catch((err) => {
                        console.log('An error occurred while retrieving token. ', err);
                        UI.showNotification('هەڵەیەک ڕوویدا', 'error');
                    });
            } else {
                console.log("Unable to get permission to notify.");
                UI.showNotification('ڕێگەپێدان بۆ ئاگەداری وەرنەگیرا', 'error');
            }
        });
    };
    
    // ======== کۆتایی زیادکراوەکان ========
}

function init() {
    UI.renderSkeletonLoader();

    onSnapshot(query(categoriesCollection, orderBy("order", "asc")), (snapshot) => {
        appContext.categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        UI.populateCategoryDropdown();
        UI.applyLanguageUI(appContext.currentLanguage);
    });

    onSnapshot(query(productsCollection, orderBy("createdAt", "desc")), (snapshot) => {
        appContext.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        appContext.skeletonLoader.style.display = 'none';
        appContext.productsContainer.style.display = 'grid';
        UI.renderProducts();
    });

    setupEventListeners();
    UI.updateCartCount();
    UI.updateActiveNav('homeBtn');
}

onAuthStateChanged(auth, (user) => {
    const isAdminNow = !!user;
    if (appContext.isAdmin !== isAdminNow) {
        appContext.isAdmin = isAdminNow;
        UI.updateAdminUI(appContext.isAdmin);
    }

    if (user && !appContext.adminInitialized) {
        UI._closeAllPopupsWithoutHistory();
        initializeAdmin({
            db, productsCollection, categoriesCollection, announcementsCollection,
            showNotification: UI.showNotification,
            closeAllPopups: closeAllPopups,
            products: appContext.products,
            categories: appContext.categories,
            currentLanguage: appContext.currentLanguage
        });
        appContext.adminInitialized = true;
    } else if (!user) {
        appContext.adminInitialized = false;
    }
    
    UI.updateAdminUI(appContext.isAdmin);
});


document.addEventListener('DOMContentLoaded', init);

window.addEventListener('popstate', (event) => {
    UI._closeAllPopupsWithoutHistory();
    const state = event.state;
    if (state?.page) {
        UI.showPage(state.page);
        UI.updateActiveNav(state.page === 'settingsPage' ? 'settingsBtn' : 'homeBtn');
    } else if (state?.sheet) {
        toggleSheet(state.sheet, true);
    } else {
        UI.showPage('mainPage');
        UI.updateActiveNav('homeBtn');
    }
});