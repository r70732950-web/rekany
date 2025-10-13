// app.js (فایلی سەرەکی و تەواوکراو)

// =======================================================
// 1. IMPORT KRDN - بانگکردنی فایلەکانی تر
// =======================================================
import { auth, db, messaging } from './firebase.js';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, doc, onSnapshot, query, orderBy, getDocs, where, startAfter, limit, getDoc, updateDoc, deleteDoc, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

import { translations } from './translations.js';
import { showNotification, formatDescription, renderSkeletonLoader, updateActiveNav, closeAllPopupsUI, openPopup, closeCurrentPopup, showPage, setupScrollAnimations } from './ui.js';
import { addToCart, renderCart, updateCartCount } from './cart.js';
import { updateAdminUI, openAddProductForm, openEditProductForm, deleteProduct, initializeAdminPanel } from './admin.js';

// =======================================================
// 2. GLOBAL STATE - گۆڕاوە گشتییەکان
// =======================================================
const PRODUCTS_PER_PAGE = 25;
const FAVORITES_KEY = "maten_store_favorites";
const PROFILE_KEY = "maten_store_profile";

let currentLanguage = localStorage.getItem('language') || 'ku_sorani';
let isAdmin = sessionStorage.getItem('isAdmin') === 'true';
let products = [];
let categories = [];
let allPromoCards = [];
let userProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];

let currentCategory = 'all', currentSubcategory = 'all', currentSubSubcategory = 'all';
let currentSearch = '';

let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
let deferredPrompt;
let isRenderingHomePage = false;
let currentPromoCardIndex = 0;
let promoRotationInterval = null;

// =======================================================
// 3. CORE LOGIC - функشنە سەرەکییەکان
// =======================================================

function t(key, replacements = {}) {
    let text = (translations[currentLanguage] && translations[currentLanguage][key]) ||
               (translations['ku_sorani'] && translations['ku_sorani'][key]) ||
               key;
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
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

    const isHomeView = !currentSearch && currentCategory === 'all';
    if (isHomeView) {
        renderHomePageContent();
    } else {
        renderProducts();
    }
    renderMainCategories();
}

async function searchProductsInFirestore(isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHome = !currentSearch && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';

    if (shouldShowHome) {
        document.getElementById('productsContainer').style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';
        if (isNewSearch) await renderHomePageContent();
        return;
    } 
    
    homeSectionsContainer.innerHTML = '';
    homeSectionsContainer.style.display = 'none';

    if (isLoadingMoreProducts) return;
    if (isNewSearch) {
        products = [];
        lastVisibleProductDoc = null;
        allProductsLoaded = false;
        renderSkeletonLoader();
    }
    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    document.getElementById('loader').style.display = 'block';

    try {
        let q = collection(db, "products");

        if (currentCategory && currentCategory !== 'all') q = query(q, where("categoryId", "==", currentCategory));
        if (currentSubcategory && currentSubcategory !== 'all') q = query(q, where("subcategoryId", "==", currentSubcategory));
        
        const finalSearchTerm = currentSearch.trim().toLowerCase();
        if (finalSearchTerm) {
            q = query(q, where('searchableName', '>=', finalSearchTerm), where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
        }

        q = query(q, orderBy(finalSearchTerm ? "searchableName" : "createdAt", finalSearchTerm ? "asc" : "desc"));
        
        if (lastVisibleProductDoc && !isNewSearch) {
            q = query(q, startAfter(lastVisibleProductDoc));
        }
        
        q = query(q, limit(PRODUCTS_PER_PAGE));

        const snapshot = await getDocs(q);
        const newProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        products = isNewSearch ? newProducts : [...products, ...newProducts];
        
        lastVisibleProductDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
             scrollTrigger.style.display = 'block';
        }
        renderProducts();
    } catch (error) {
        console.error("Error fetching products:", error);
    } finally {
        isLoadingMoreProducts = false;
        document.getElementById('loader').style.display = 'none';
        document.getElementById('skeletonLoader').style.display = 'none';
        document.getElementById('productsContainer').style.display = 'grid';
    }
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';
    if (products.length === 0 && !isLoadingMoreProducts) {
        container.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ కాڵایەک نەدۆزرایەوە.</p>`;
    } else {
        products.forEach(product => {
            const card = createProductCardElement(product);
            container.appendChild(card);
        });
    }
    setupScrollAnimations();
}

function createProductCardElement(product) {
    const card = document.createElement('div');
    card.className = 'product-card product-card-reveal';
    const name = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const isFav = favorites.includes(product.id);
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    let priceHTML = `<div class="product-price">${product.price.toLocaleString()} د.ع.</div>`;
    let discountBadgeHTML = '';
    if (hasDiscount) {
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
        priceHTML = `<span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del>`;
    }
    
    const shippingText = product.shippingInfo && product.shippingInfo[currentLanguage] && product.shippingInfo[currentLanguage].trim();
    const shippingBadgeHTML = shippingText ? `<div class="shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div>` : '';

    card.innerHTML = `
        <div class="product-image-container">
            <img src="${(product.imageUrls && product.imageUrls[0]) || ''}" alt="${name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-id="${product.id}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${name}</div>
            <div class="product-price-container">${priceHTML}</div>
            <button class="add-to-cart-btn-card" data-id="${product.id}"><i class="fas fa-cart-plus"></i></button>
            ${shippingBadgeHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" data-id="${product.id}"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" data-id="${product.id}"><i class="fas fa-trash"></i></button>
        </div>
    `;

    card.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (target) {
            e.stopPropagation();
            const productId = target.dataset.id;
            if (target.classList.contains('add-to-cart-btn-card')) {
                const productToAdd = products.find(p => p.id === productId);
                addToCart(productToAdd, t);
            } else if (target.classList.contains('edit-btn')) {
                openEditProductForm(productId, categories);
            } else if (target.classList.contains('delete-btn')) {
                if (await deleteProduct(productId, t)) {
                    searchProductsInFirestore(true);
                }
            } else if (target.classList.contains('favorite-btn')) {
                toggleFavorite(productId);
            }
        } else {
             showProductDetails(product);
        }
    });

    return card;
}

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    renderProducts();
}

function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container || !categories) return;
    container.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        if (currentCategory === cat.id) btn.classList.add('active');
        const categoryName = cat['name_' + currentLanguage] || cat.name_ku_sorani;
        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;
        btn.onclick = () => {
            currentCategory = cat.id;
            currentSubcategory = 'all';
            currentSubSubcategory = 'all';
            renderMainCategories();
            searchProductsInFirestore(true);
        };
        container.appendChild(btn);
    });
}

async function renderHomePageContent() {
    // This is a placeholder. You can copy the full function from your original file if you need complex home page logic.
    // For now, it will just load products.
    await searchProductsInFirestore(true);
}

function showProductDetails(product) {
    const name = (product.name && product.name[currentLanguage]) || product.name.ku_sorani;
    const description = (product.description && product.description[currentLanguage]) || product.description.ku_sorani;

    document.getElementById('sheetProductName').textContent = name;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(description);

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }
    
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product, t);
        closeCurrentPopup();
    };

    openPopup('productDetailSheet', 'sheet');
}

// =======================================================
// 5. EVENT LISTENERS & INITIALIZATION
// =======================================================

function setupEventListeners() {
    // Navigation
    document.getElementById('homeBtn').onclick = () => { history.pushState({ page: 'main' }, ''); showPage('mainPage'); };
    document.getElementById('settingsBtn').onclick = () => { history.pushState({ page: 'settings' }, ''); showPage('settingsPage'); };
    
    // Sheets and Modals
    document.getElementById('cartBtn').onclick = () => {
        openPopup('cartSheet', 'sheet', { onOpen: () => renderCart(t, currentLanguage, userProfile) });
        updateActiveNav('cartBtn');
    };
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });
    
    // Search
    const debouncedSearch = debounce(() => searchProductsInFirestore(true), 500);
    searchInput.oninput = () => {
        currentSearch = searchInput.value;
        clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
        debouncedSearch();
    };
    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        searchProductsInFirestore(true);
    };

    // Admin
    document.getElementById('settingsAdminLoginBtn').onclick = () => openPopup('loginModal', 'modal');
    document.getElementById('settingsLogoutBtn').onclick = () => signOut(auth);
    document.getElementById('addProductBtn').onclick = () => openAddProductForm(categories);
    const loginForm = document.getElementById('loginForm');
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            closeCurrentPopup();
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };
    
    // General UI
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    document.getElementById('sheet-overlay').onclick = closeCurrentPopup;
    window.onpopstate = (event) => {
        closeAllPopupsUI();
    };
}

function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

async function init() {
    renderSkeletonLoader();
    setupEventListeners();
    setLanguage(currentLanguage);

    onAuthStateChanged(auth, user => {
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
        isAdmin = user && user.uid === adminUID;
        sessionStorage.setItem('isAdmin', String(isAdmin));
        updateAdminUI(isAdmin, {
            loadAdminData: () => initializeAdminPanel(categories, () => searchProductsInFirestore(true), t)
        });
        renderProducts();
    });

    try {
        const catSnapshot = await getDocs(query(collection(db, "categories"), orderBy("order")));
        const fetchedCategories = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = [{ id: 'all', name_ku_sorani: 'هەموو', name_ku_badini: 'هەمی', name_ar: 'الكل', icon: 'fas fa-th' }, ...fetchedCategories];
        renderMainCategories();
    } catch (error) {
        console.error("Failed to load categories:", error);
    }
    
    await searchProductsInFirestore(true);
    updateCartCount();
}

document.addEventListener('DOMContentLoaded', init);