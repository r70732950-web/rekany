// app-data.js
// Ev pel ji bo rêveberiya data, rewş (state), û lojîka bingehîn a sepanê ye.

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Add shortcutRowsCollection
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, searchInput, clearSearchBtn,
    loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Import UI functions needed in this file
import {
    showPage, openPopup, closeCurrentPopup, closeAllPopupsUI, showNotification,
    renderSkeletonLoader, renderProducts, renderCart, renderFavoritesPage,
    renderCategoriesSheet, renderSubcategories, renderMainCategories,
    renderUserNotifications, renderContactLinks, showWelcomeMessage,
    setupGpsButton, updateActiveNav, updateCategoryDependentUI,
    renderHomePageContent, updateHeaderView, setLanguage,
    renderCartActionButtons, renderPolicies
} from './app-ui.js';

// --- Utility Functions ---
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
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// --- State Management & Local Storage ---
export function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // UI function imported from app-ui.js
}

export function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

export function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    showNotification(t('profile_saved'), 'success');
    closeCurrentPopup();
}

export function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

// --- Cart Logic ---
export function addToCart(productId) {
    const allFetchedProducts = [...state.products];
    let product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching from DB...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart();
                showNotification(t('product_added_to_cart'));
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) { existingItem.quantity++; }
    else { state.cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 }); }
    saveCart();
    showNotification(t('product_added_to_cart'));
}

export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); } // Re-render cart UI
    }
}

export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Re-render cart UI
}

export function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // Use textContent from UI element

    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

// --- Favorites Logic ---
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

export function toggleFavorite(productId, event) {
    if(event) event.stopPropagation();
    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update UI for all cards with this product ID
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart
        }
    });

    // Re-render favorites page if it's currently open
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

// --- Data Fetching & Filtering ---
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        } else {
             // Rêstartkirina slideran dê di hundirê renderHomePageContent de bête kirin
        }
        return;
    } else {
        homeSectionsContainer.style.display = 'none';
        // Rawestandina hemî slideran dema ku ji dîmena malê derdikevin
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
    }

    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts();
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (state.isLoadingMoreProducts) return;

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader();
    }

    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block';

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering
        if (finalSearchTerm) {
            // If searching, first orderBy must match inequality field
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default sort by creation date
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (startAfter)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update products state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Cache results for new searches
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the products (UI function)
        renderProducts();

        // Handle empty results display
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

// Function to fetch products for subcategory detail page
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const loaderDetail = document.getElementById('detailPageLoader');
    loaderDetail.style.display = 'block';
    productsContainerDetail.innerHTML = '';

    try {
        let productsQuery;
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                 // createProductCardElement is now in app-ui.js, we need to import it if it's not already
                 // Assuming createProductCardElement is globally available or imported
                 const card = window.createProductCardElement(product); // Temporary fix: make it global or import
                productsContainerDetail.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loaderDetail.style.display = 'none';
    }
}


// --- Navigation & Routing ---
export async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(); // UI Function
    await renderSubcategories(state.currentCategory); // UI Function that fetches subcats

    await searchProductsInFirestore(state.currentSearch, true); // Fetch products based on new state

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50); // Restore scroll
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for new filter
    }
}

export async function navigateToFilter(newState) {
    // Save current scroll position before changing state
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    // Define the new state, setting scroll to 0 for navigation
    const finalState = { ...history.state, ...newState, scroll: 0 };

    // Update URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state (fetch data and update UI)
    await applyFilterState(finalState);
}


// --- Notifications & Permissions ---
export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
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
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now() // Store timestamp for potential cleanup later
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // UI Element
            } else {
                notificationBadge.style.display = 'none'; // UI Element
            }
        }
    });
}

// --- PWA & Service Worker ---
export async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }
            // Clear caches
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }
            showNotification(t('update_success'), 'success');
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload(true); // Force reload bypassing cache
            }, 1500);
        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

// --- Initialization & Event Listeners Setup ---
export function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 searchProductsInFirestore(state.currentSearch, false); // Fetch next page
            }
        }
    }, { root: null, threshold: 0.1 });

    observer.observe(trigger);
}

export function setupEventListeners() {
    // Navigation
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };
    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };
    document.getElementById('headerBackBtn').onclick = () => history.back();

    // Popups
    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    if (termsAndPoliciesBtn) termsAndPoliciesBtn.addEventListener('click', () => openPopup('termsSheet'));

    // Close Popups
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forms
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Admin logic will init via onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        saveProfile(); // Saves to local storage and shows notification
    };

    // Search
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
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

    // Subpage search
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
        }
    }, 500);
    subpageSearchInput.oninput = () => {
        const searchTerm = subpageSearchInput.value;
        subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    };
    subpageClearSearchBtn.onclick = () => {
        subpageSearchInput.value = '';
        subpageClearSearchBtn.style.display = 'none';
        debouncedSubpageSearch('');
    };


    // Settings Actions
    document.querySelectorAll('.lang-btn').forEach(btn => btn.onclick = () => setLanguage(btn.dataset.lang));
    contactToggle.onclick = () => {
        document.getElementById('dynamicContactLinksContainer').classList.toggle('open');
        contactToggle.querySelector('.contact-chevron').classList.toggle('open');
    };
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            installBtn.style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) forceUpdateBtn.addEventListener('click', forceUpdate);

    // Foreground FCM messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block';
    });
}


function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // The actual rendering will be triggered by onSnapshot in initializeAppLogic after categories load
         // No need to call showSubcategoryDetailPage here, it happens later
    } else if (pageId === 'settingsPage') {
        history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
        showPage(pageId, t('settings_title'));
    } else { // It's mainPage or invalid hash treated as mainPage
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, '');
        applyFilterState(initialState); // Apply filters from URL params
    }

    // Check if hash points to a modal or sheet on the main page
    const element = document.getElementById(hash);
    if (element && pageId === 'mainPage') {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
    }

    // Check if URL has a specific product to show
    const productId = params.get('product');
    if (productId) {
        // Delay slightly to ensure product data might be loaded
        setTimeout(() => window.showProductDetailsById(productId), 500); // Use a globally exposed function
    }
}

// History (Popstate) Handling
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI();
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
             // Eger ew rûpela jêr-kategoriyê be û sernav tune be, ji nû ve bistîne
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e) }
            }
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type);
        } else { // Filter state on main page
            showPage('mainPage');
            applyFilterState(popState, true);
        }
    } else { // No state, likely initial load or manual URL change
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});


// --- Authentication Listener ---
onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // **گرنگ:** UID ی ئەدمینی خۆت لێرە دابنێ
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Wait for DOM content to be fully loaded if not already
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  document.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
             }
        } else {
             console.warn("AdminLogic not found or initialize not a function. Retrying after DOM load.");
              document.addEventListener('DOMContentLoaded', () => {
                  if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                      window.AdminLogic.initialize();
                  } else {
                      console.error("AdminLogic still not available after DOM load.");
                  }
              }, { once: true });
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) { // If a non-admin user is signed in, sign them out
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Clean up admin UI
        }
    }

    // Close login modal if admin logs in successfully
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});

// --- App Initialization ---
export function initializeAppLogic() {
     // Piştrastkirina ku state.sliderIntervals heye
     if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories first, then handle initial load
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // Add 'All' category with localized names

        updateCategoryDependentUI(); // Update dropdowns, main category buttons etc.

         // Handle initial page load ONLY after categories are loaded
         handleInitialPageLoad(); // Handles main page filters, detail page hash, settings page hash etc.

        // Re-apply language after categories are loaded to ensure names are correct
        setLanguage(state.currentLanguage);
    });

    // Setup other parts
    updateCartCount(); // Initial cart count UI update
    setupEventListeners();
    setupScrollObserver();
    setLanguage(state.currentLanguage); // Initial language setting
    renderContactLinks(); // Fetch and display contact links
    checkNewAnnouncements(); // Check for notification badge
    showWelcomeMessage(); // Show only on first visit
    setupGpsButton(); // Add GPS functionality
}

export function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Initialize after persistence setup
        })
        .catch((err) => {
            console.error("Error enabling persistence, running online:", err);
            initializeAppLogic(); // Initialize even if persistence fails
        });
}

// Make essential functions globally available if needed by HTML onclick or admin.js before modules fully load
// Use this sparingly
window.showProductDetailsById = (id) => {
    // This is a temporary solution. Ideally, you'd find the product data
    // or fetch it if not found, then call the UI function.
    // Assuming showProductDetailsWithData exists in app-ui.js
     const product = state.products.find(p => p.id === id);
     if (product) {
         window.showProductDetailsWithData(product); // Assuming showProductDetailsWithData is made global from app-ui.js
     } else {
         getDoc(doc(db, "products", id)).then(docSnap => {
             if (docSnap.exists()) {
                 window.showProductDetailsWithData({ id: docSnap.id, ...docSnap.data() });
             } else {
                 showNotification(t('product_not_found_error'), 'error');
             }
         });
     }
};


// --- PWA Install Prompt & Service Worker ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
    console.log('`beforeinstallprompt` event fired.');
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('SW registered.');
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New SW found!', newWorker);
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });
        updateNowBtn.addEventListener('click', () => {
            registration.waiting?.postMessage({ action: 'skipWaiting' });
        });
    }).catch(err => console.log('SW registration failed: ', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New SW activated. Reloading...');
        window.location.reload();
    });
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', init); // Ensure DOM is ready before init