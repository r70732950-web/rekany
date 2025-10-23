// app-data.js (V2 - Corrected Imports/Exports)
// Ev pel ji bo rêveberiya data, rewş (state), û lojîka bingehîn a sepanê ye.

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
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
    renderHomePageContent, // Correctly imported from app-ui
    updateHeaderView, setLanguage, renderCartActionButtons, renderPolicies,
    showSubcategoryDetailPage, // Import function to show detail page
    // createProductCardElement is NOT needed here, it's a UI function
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
    // updateCartCount is in app-ui.js, called from there or where needed
    // We can call it here if necessary, assuming updateCartCount is exported from app-ui
    // import { updateCartCount } from './app-ui.js'; // Needs import
    // updateCartCount();
    // For now, let's assume it's called appropriately elsewhere (e.g., when rendering cart)
    // Correction: It's better to update the count immediately after modifying the cart.
    // Let's import and call updateCartCount.
    import('./app-ui.js').then(uiModule => uiModule.updateCartCount());

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
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

// --- Cart Logic ---
export function addToCart(productId) {
    const allFetchedProducts = [...state.products];
    let product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found locally. Fetching from DB...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart(); // Update local storage and UI count
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
    saveCart(); // Update local storage and UI count
    showNotification(t('product_added_to_cart'));
}


export function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
    }
}

export function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

export function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    // Ensure totalAmount element exists and has content before using it
    const totalAmountElement = document.getElementById('totalAmount');
    const totalText = totalAmountElement ? totalAmountElement.textContent : '0';
    message += `\n${t('order_total')}: ${totalText} د.ع.\n`;

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

    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite);
            heartIcon.classList.toggle('far', !isNowFavorite);
        }
    });

    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

// --- Data Fetching & Filtering ---
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const loader = document.getElementById('loader');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) { // Rerender if empty or explicitly new search
            await renderHomePageContent(); // UI function imported from app-ui.js
        }
        return; // Stop here for home view
    } else {
        homeSectionsContainer.style.display = 'none';
        // Stop all promo rotations when navigating away
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
    }

    // --- Caching logic ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';
        renderProducts(); // Render cached products
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    // --- Loading checks ---
    if (state.isLoadingMoreProducts) return;
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton
    }
    if (state.allProductsLoaded && !isNewSearch) return; // Already loaded all

    // --- Start fetching ---
    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show bottom loader

    try {
        let productsQuery = collection(db, "products");

        // Apply filters
        if (state.currentCategory !== 'all') productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        if (state.currentSubcategory !== 'all') productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        if (state.currentSubSubcategory !== 'all') productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Execute query
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update state
        if (isNewSearch) state.products = newProducts;
        else state.products = [...state.products, ...newProducts];

        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';

        // Cache result if new search
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        renderProducts(); // Render the fetched products

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

export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const loaderDetail = document.getElementById('detailPageLoader');
    loaderDetail.style.display = 'block';
    productsContainerDetail.innerHTML = ''; // Clear previous

    try {
        let productsQuery;
        // Base query for subcategory or sub-subcategory
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             // Order by name first when searching
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
             // Need createProductCardElement from app-ui.js
             const uiModule = await import('./app-ui.js');
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = uiModule.createProductCardElement(product); // Use imported function
                productsContainerDetail.appendChild(card);
            });
             // Setup animations if needed for these cards too
             uiModule.setupScrollAnimations();
        }
    } catch (error) {
        console.error(`Error fetching products for detail page:`, error);
        productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loaderDetail.style.display = 'none';
    }
}


// --- Navigation & Routing ---
export async function applyFilterState(filterState, fromPopState = false) {
    // Update global state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input UI
    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Update category UI elements
    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Fetches and renders subcats

    // Fetch and render products based on the new state
    await searchProductsInFirestore(state.currentSearch, true);

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for new filter action
    }
}

export async function navigateToFilter(newState) {
    history.replaceState({ // Save current state before navigating
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    const finalState = { ...history.state, ...newState, scroll: 0 }; // New state scrolls to top

    // Update URL
    const params = new URLSearchParams();
    if (finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl); // Push new state

    await applyFilterState(finalState); // Apply the changes
}


// --- Notifications & Permissions ---
async function saveTokenToFirestore(token) { // Not exported, only used internally
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), { createdAt: Date.now() });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, { vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Call internal save function
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

export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
            const badge = document.getElementById('notificationBadge'); // Get badge element
            if (badge) { // Check if badge element exists
                 badge.style.display = latestAnnouncement.createdAt > lastSeenTimestamp ? 'block' : 'none';
            }
        }
    }, error => {
         console.error("Error checking announcements:", error); // Handle potential errors
    });
}


// --- PWA & Service Worker ---
export async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) await registration.unregister();
                console.log('Service Workers unregistered.');
            }
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }
            showNotification(t('update_success'), 'success');
            setTimeout(() => window.location.reload(true), 1500);
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
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
            searchProductsInFirestore(state.currentSearch, false); // Load more
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
        } catch (error) { showNotification(t('login_error'), 'error'); }
    };
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        saveProfile();
    };

    // Search (Main Page)
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

    // Search (Subpage)
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
        const title = payload.notification?.title; // Use optional chaining
        const body = payload.notification?.body;
        if(title && body){ // Only show if title and body exist
             showNotification(`${title}: ${body}`, 'success');
        }
        const badge = document.getElementById('notificationBadge');
        if(badge) badge.style.display = 'block'; // Show badge on new message
    });
}

// History (Popstate) Handling
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Close any open sheets/modals
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Refetch title for subcategory page if needed
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                try {
                    const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    const subCatSnap = await getDoc(subCatRef);
                    if (subCatSnap.exists()) {
                        const subCat = subCatSnap.data();
                        pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e); }
            }
            showPage(popState.id, pageTitle); // Show the correct page
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type); // Reopen the popup
        } else { // Filter state on main page
            showPage('mainPage');
            applyFilterState(popState, true); // Apply filters and restore scroll
        }
    } else { // No state, go to default main page view
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
        // Ensure DOM is ready before initializing AdminLogic
        const initializeAdmin = () => {
             if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                 window.AdminLogic.initialize();
             } else {
                 console.error("AdminLogic not ready for initialization.");
             }
         };
         if (document.readyState === 'complete' || document.readyState === 'interactive') {
             initializeAdmin();
         } else {
             document.addEventListener('DOMContentLoaded', initializeAdmin, { once: true });
         }

    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) await signOut(auth); // Sign out non-admins
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal if admin logs in successfully
    if (document.getElementById('loginModal')?.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


// --- App Initialization ---
export function initializeAppLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {}; // Ensure slider interval state exists

    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribe = onSnapshot(categoriesQuery, async (snapshot) => { // Use async here
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories];
        updateCategoryDependentUI();

        // Handle initial page load AFTER categories are available
        handleInitialPageLoad();

        // Apply language AFTER categories and initial load logic
        setLanguage(state.currentLanguage);

    }, error => {
         console.error("Error fetching categories:", error);
         // Handle error, maybe show a message to the user
         handleInitialPageLoad(); // Still try to load based on URL even if categories fail
         setLanguage(state.currentLanguage); // Apply language anyway
    });


    // Setup other non-category dependent parts
    import('./app-ui.js').then(uiModule => uiModule.updateCartCount()); // Initial cart count
    setupEventListeners();
    setupScrollObserver();
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
}

export function init() {
    renderSkeletonLoader(); // Show skeleton immediately
    enableIndexedDbPersistence(db)
        .then(() => console.log("Firestore offline persistence enabled."))
        .catch((err) => console.error("Error enabling persistence:", err))
        .finally(() => initializeAppLogic()); // Initialize regardless of persistence success/failure
}

// Make essential functions globally available if needed
// Use sparingly
// Expose showProductDetailsById for potential direct calls (e.g., from notifications)
window.showProductDetailsById = async (id) => {
    try {
        const uiModule = await import('./app-ui.js');
        const product = state.products.find(p => p.id === id);
        if (product) {
            uiModule.showProductDetailsWithData(product);
        } else {
            const docSnap = await getDoc(doc(db, "products", id));
            if (docSnap.exists()) {
                uiModule.showProductDetailsWithData({ id: docSnap.id, ...docSnap.data() });
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }
    } catch (error) {
        console.error("Error showing product details by ID:", error);
        showNotification(t('error_generic'), 'error');
    }
};

// --- PWA Install Prompt & Service Worker --- (Keep as is)
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
                    if (updateNotification) updateNotification.classList.add('show');
                }
            });
        });
        if(updateNowBtn) updateNowBtn.addEventListener('click', () => {
            registration.waiting?.postMessage({ action: 'skipWaiting' });
        });
    }).catch(err => console.log('SW registration failed: ', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New SW activated. Reloading...');
        window.location.reload();
    });
}

// --- Start the App ---
// Use DOMContentLoaded to ensure basic HTML is parsed before init
document.addEventListener('DOMContentLoaded', init);


// Expose necessary functions/variables for admin.js via global object
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore/Auth functions
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore, // Core utils/data functions
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Collections
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage, // State accessors/setters
    clearProductCache: () => { // Helper for admin
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {};
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = '';
        // Optionally trigger re-render if needed
        // searchProductsInFirestore(state.currentSearch, true);
    }
});