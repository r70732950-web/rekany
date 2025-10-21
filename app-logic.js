// === app-logic.js (Updated with productCard.js import) ===
// Fonksiyon û mentiqê serekî yê bernameyê

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    translations, state,
    CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
} from './app-setup.js';

// ++ IMPORT THE NEW FUNCTION ++
import { createProductCardElement } from './productCard.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// ++ DEFINE HANDLERS OBJECT (Can be accessed by functions below) ++
const cardHandlers = {
    t: t, // Pass the translation function
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    addToCart: addToCart,
    showProductDetails: showProductDetailsWithData, // Pass the specific function
    showNotification: showNotification,
    AdminLogic: window.globalAdminTools, // Use the globally exposed object from setup
    navigator: navigator
};

// --- Helper Functions (debounce, saveCurrentScrollPosition, etc. remain the same) ---
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Nûvekirina headerê li gorî rûpelê
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else {
        updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
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
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
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

async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories();
    await renderSubcategories(state.currentCategory); // This might not be needed if subcategories aren't shown directly

    // Decide whether to show home or search results
    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHome) {
         document.getElementById('homePageSectionsContainer').style.display = 'block';
         productsContainer.style.display = 'none';
         skeletonLoader.style.display = 'none';
         document.getElementById('scroll-loader-trigger').style.display = 'none';
         if(document.getElementById('homePageSectionsContainer').innerHTML.trim() === '') {
            await renderHomePageContent();
         } else {
            startPromoRotation(); // Restart rotation if content already exists
         }
    } else {
        document.getElementById('homePageSectionsContainer').style.display = 'none';
        await searchProductsInFirestore(state.currentSearch, true); // Trigger search/filter
    }


    if (fromPopState && typeof filterState.scroll === 'number') {
        // Use setTimeout to allow content to render before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState && !shouldShowHome) { // Don't scroll to top if showing home page from initial load
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function navigateToFilter(newState) {
    // Save current scroll before changing state
    history.replaceState({
        ...history.state, // Keep existing state like page type
        scroll: window.scrollY
    }, '');

    // Define the new filter state, resetting scroll
    const finalFilterState = {
         // Keep existing state that isn't filter related (like page type)
        ...(history.state || {}),
        category: newState.category !== undefined ? newState.category : state.currentCategory,
        subcategory: newState.subcategory !== undefined ? newState.subcategory : state.currentSubcategory,
        subSubcategory: newState.subSubcategory !== undefined ? newState.subSubcategory : state.currentSubSubcategory,
        search: newState.search !== undefined ? newState.search : state.currentSearch,
        scroll: 0 // Always reset scroll on new navigation
    };

    // Construct URL parameters based ONLY on filter state
    const params = new URLSearchParams();
    if (finalFilterState.category && finalFilterState.category !== 'all') params.set('category', finalFilterState.category);
    if (finalFilterState.subcategory && finalFilterState.subcategory !== 'all') params.set('subcategory', finalFilterState.subcategory);
    if (finalFilterState.subSubcategory && finalFilterState.subSubcategory !== 'all') params.set('subSubcategory', finalFilterState.subSubcategory);
    if (finalFilterState.search) params.set('search', finalFilterState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`; // Keep hash if it exists

    // Push the new complete state including filter and reset scroll
    history.pushState(finalFilterState, '', newUrl);

    // Apply the changes to the UI
    await applyFilterState(finalFilterState);
}


window.addEventListener('popstate', async (event) => { // Guhertin bo async
    closeAllPopupsUI(); // Close any open sheets/modals first
    const popState = event.state;
    console.log("Popstate triggered:", popState);

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
            // If navigating back TO main page, apply filter state with scroll
            if (popState.id === 'mainPage') {
                applyFilterState(popState, true); // Apply filters and scroll
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the sheet/modal
             openPopup(popState.id, popState.type);
        } else {
             // Assume it's a filter state for the main page
             showPage('mainPage'); // Ensure main page is visible
             applyFilterState(popState, true); // Apply filters and scroll
        }
    } else {
        // No state, go back to default main page view
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState); // Apply default filters, no scroll needed
    }
});


function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage'
                 : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // Don't call showSubcategoryDetailPage yet, wait for categories to load in initializeAppLogic
        // Just set the initial state so popstate works correctly if user navigates away immediately
        history.replaceState({ type: 'page', id: pageId, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
        showPage(pageId, "Loading..."); // Show the page structure immediately
    } else if (pageId === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageId, t('settings_title'));
    } else { // It's the mainPage
        const initialState = {
            type: 'page', // Mark this as a page state initially
            id: 'mainPage',
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}`); // Keep params in URL
        showPage('mainPage');
        // applyFilterState will be called by onSnapshot listener in initializeAppLogic
    }

    // Handle opening sheets/modals from hash AFTER main content is potentially loaded
     setTimeout(() => {
        const elementIdFromHash = window.location.hash.substring(1); // Re-check hash
        const element = document.getElementById(elementIdFromHash);
        if (element && pageId === 'mainPage') { // Only open popups if on the main page
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 openPopup(elementIdFromHash, isSheet ? 'sheet' : 'modal');
            }
        }

        // Handle opening product detail from query param
        const productId = params.get('product');
        if (productId) {
            // Delay slightly to ensure products might be loaded or fetch can start
            showProductDetails(productId);
        }
     }, 300); // Small delay
}


function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key])
                   || (translations['ku_sorani'] && translations['ku_sorani'][key])
                   || (replacements && replacements.defaultValue) // Use default value if provided
                   || key; // Fallback to the key itself
    for (const placeholder in replacements) {
        if (placeholder !== 'defaultValue') { // Don't replace the defaultValue placeholder
             translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
        }
    }
    return translation;
}


// --- Functions setLanguage, forceUpdate, updateContactLinksUI, updateActiveNav, formatDescription, requestNotificationPermission, saveTokenToFirestore remain the same ---
function setLanguage(lang) {
    state.currentLanguage = lang;
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

    // Re-render dynamic content that depends on language
     const homeContainer = document.getElementById('homePageSectionsContainer');
     homeContainer.innerHTML = ''; // Clear home content to force re-render with new lang

    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (isHomeView) {
        renderHomePageContent(); // Regenerate home content
    } else {
        // Re-render product list if not on home view
        renderProducts(); // Assumes state.products is already filtered correctly
    }

    // Re-render other language-dependent UI parts
    renderMainCategories();
    renderCategoriesSheet(); // Update category names in the sheet
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart(); // Update item names in cart
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage(); // Update item names in favorites
    renderContactLinks(); // Update contact link names
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
                window.location.reload(true); // Force reload from server
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

function updateContactLinksUI() {
    // This function seems unused, maybe remove or implement if needed later
    if (!state.contactInfo) return;
    // Update UI based on state.contactInfo
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

function formatDescription(text) {
    if (!text) return '';
    // Basic escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (http, https, www)
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        // Ensure link opens in new tab and is secure
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}


async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', {defaultValue: 'مۆڵەتی ناردنی ئاگەداری درا'}), 'success'); // Fallback
            // Get FCM token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
                showNotification(t('notification_no_token', {defaultValue:'نەتوانرا تۆکن وەربگیرێت'}), 'error'); // Fallback
            }
        } else {
            console.log('Unable to get permission to notify.');
             showNotification(t('notification_permission_denied', {defaultValue:'مۆڵەت نەدرا'}), 'error'); // Fallback
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token: ', error);
         showNotification(t('notification_permission_error', {defaultValue:'هەڵە لە وەرگرتنی مۆڵەت'}), 'error'); // Fallback
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID to prevent duplicates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(),
            // You might want to add user ID here if users log in
            // userId: auth.currentUser ? auth.currentUser.uid : null
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}


// --- Functions saveFavorites, isFavorite, toggleFavorite remain the same ---
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Stop card click when clicking favorite

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update UI only for the clicked button and potentially others for the same product
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Get the icon directly
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // The new state
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle Font Awesome classes for solid/regular heart
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorited
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart if not
        }
    });

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}


// --- renderFavoritesPage now uses the imported createProductCardElement ---
async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // Clear previous items

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Ensure grid display is set

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeleton while loading

    try {
        // Fetch details for all favorited products concurrently
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton loader

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Only include products that still exist
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // Handle case where favorite IDs exist but products were deleted
             emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
            if(state.favorites.length > 0) {
                // Optionally clean up local storage if products don't exist
                console.warn("Some favorited products no longer exist in DB.");
                // state.favorites = favoritedProducts.map(p => p.id); // Uncomment to clean local storage
                // saveFavorites();
            }
        } else {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status once
            favoritedProducts.forEach(product => {
                // ++ USE IMPORTED FUNCTION ++
                const productCard = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">${t('error_generic')}</p>`; // Span across grid columns
    }
}


// --- Functions saveCart, updateCartCount, showNotification remain the same ---
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements with the cart-count class
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => {
            if (document.body.contains(notification)) {
                 document.body.removeChild(notification);
            }
        }, 300); // Should match CSS transition duration
    }, 3000); // Notification display duration
}


// --- Functions populateCategoryDropdown, renderCategoriesSheet, renderSubcategories, renderMainCategories remain the same ---
function populateCategoryDropdown() {
    productCategorySelect.innerHTML = `<option value="" disabled selected>-- ${t('choose_category')} --</option>`; // Translate placeholder
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // Exclude 'all' option
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Display name in current language, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = ''; // Clear previous categories
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        // Get category name, handle 'all' category specially
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang, fallback Sorani

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Use default icon if missing

        btn.onclick = async () => {
             // Navigate to the selected category (clearing subcats and search)
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search term
            });
            closeCurrentPopup(); // Close the category sheet
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous

    // Don't show subcategories if 'all' main categories are selected
    if (!categoryId || categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide the container
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show the container

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        // Store fetched subcategories in state (might be useful elsewhere)
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Don't show the subcategory bar if there are no subcategories
        if (state.subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none';
            return;
        }


        // Add "All" button for the current main category's subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        // SVG icon for 'All'
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Navigate, keeping main category but resetting sub/subsub
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Add buttons for each actual subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = () => {
                // Navigate to the dedicated subcategory detail page
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

async function renderSubSubcategories(mainCatId, subCatId) {
    // This function is no longer needed on the main page, handled by subcategory detail page
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden on main page
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Highlight if it's the currently active main category
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Get category name, handle 'all' category specially
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang, fallback Sorani

        // Use a default icon if none is provided
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-th'}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            // Navigate to this main category, resetting sub-levels and search
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


// --- showProductDetails and showProductDetailsWithData remain mostly the same, but pass the full product object to showProductDetailsWithData ---
function showProductDetails(productIdOrObject) {
    let product = null;

    if (typeof productIdOrObject === 'string') {
        // If only ID is passed, try to find it in the current list or fetch it
        const allFetchedProducts = [...state.products]; // Combine maybe?
        product = allFetchedProducts.find(p => p.id === productIdOrObject);

        if (!product) {
            console.log("Product not found locally. Fetching details...");
            getDoc(doc(db, "products", productIdOrObject)).then(docSnap => {
                if (docSnap.exists()) {
                    const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                    // Now call the function that handles the data
                    showProductDetailsWithData(fetchedProduct);
                } else {
                    showNotification(t('product_not_found_error'), 'error');
                }
            }).catch(error => {
                 console.error("Error fetching product details by ID:", error);
                 showNotification(t('error_generic'), 'error');
            });
            return; // Exit here, the async fetch will handle showing details
        }
    } else if (typeof productIdOrObject === 'object' && productIdOrObject.id) {
        // If the full product object is passed
        product = productIdOrObject;
    }

    if (product) {
        // Call the function that handles the data
        showProductDetailsWithData(product);
    } else {
         console.error("Invalid argument passed to showProductDetails:", productIdOrObject);
         showNotification(t('error_generic'), 'error');
    }
}

// This function now expects the full product object
function showProductDetailsWithData(product) {
    // Scroll sheet content to top when opened
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Ensure imageUrls is always an array, fallback to product.image if needed
    const imageUrls = Array.isArray(product.imageUrls) && product.imageUrls.length > 0 ? product.imageUrls
                    : (product.image ? [product.image] : []); // Fallback to single image URL if imageUrls is missing/empty

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';
    const placeholderImg = "https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە"; // Placeholder

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url || placeholderImg; // Use placeholder if URL is empty/null
            img.alt = nameInCurrentLang;
             img.onerror = function() { this.onerror = null; this.src = placeholderImg; }; // Add onerror handler
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url || placeholderImg;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
             thumb.onerror = function() { this.onerror = null; this.src = placeholderImg; };
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    } else {
         // Show placeholder if no images at all
         const img = document.createElement('img');
         img.src = placeholderImg;
         img.alt = nameInCurrentLang;
         img.classList.add('active');
         imageContainer.appendChild(img);
    }


    // Slider Logic (remains the same)
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return; // Check thumbnails only if they exist
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active')); // Safe even if thumbnails is empty
        images[index].classList.add('active');
         if (thumbnails.length > 0) { // Check if thumbnails exist before accessing
            thumbnails[index].classList.add('active');
         }
        currentIndex = index;
    }

    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    // Ensure buttons don't throw errors if they don't exist (though they should)
    if(prevBtn) prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    if(nextBtn) nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));


    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    // Price Display Logic (remains the same)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Add to Cart Button Logic (remains the same)
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close the sheet after adding
    };

    // Render related products (pass the full product object)
    renderRelatedProducts(product);

    // Open the sheet
    openPopup('productDetailSheet');
}

// --- renderRelatedProducts now uses the imported createProductCardElement ---
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the best field to query for related products
    let queryField = null;
    let queryValue = null;

    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    }

    // If no category information is available, we cannot find related products
    if (!queryField || !queryValue) {
        console.log("Cannot determine related products: Missing category info for product ID:", currentProduct.id);
        return;
    }

    // Construct the Firestore query
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue), // Find products in the same category/subcat
        where('__name__', '!=', currentProduct.id), // Exclude the current product itself
        limit(6) // Limit the number of related products
        // Consider adding orderBy('createdAt', 'desc') if you want newest related first
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Don't show the section if no related products are found
        }

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status once

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // ++ USE IMPORTED FUNCTION ++
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            container.appendChild(card);
        });

        // Show the section only if related products were found and added
        section.style.display = 'block';

    } catch (error) {
        console.error("Error fetching related products:", error);
        // Do not show the section in case of an error
    }
}


// --- createPromoCardElement might be moved to productCard.js as well ---
// --- If kept here, it remains the same ---
function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Use existing classes for layout

    // Select image based on current language, fallback to Sorani
    const imageUrl = (card.imageUrls && card.imageUrls[state.currentLanguage])
                  || (card.imageUrls && card.imageUrls.ku_sorani)
                  || 'https://placehold.co/600x200/e2e8f0/2d3748?text=Promo'; // Fallback image

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev" aria-label="Previous Promo"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next" aria-label="Next Promo"><i class="fas fa-chevron-right"></i></button>
    `;

    // Click on the card itself navigates to the target category
    cardElement.addEventListener('click', async (e) => {
        // Prevent navigation if a slider button was clicked
        if (!e.target.closest('button.promo-slider-btn')) {
            const targetCategoryId = card.categoryId;
            // Check if the target category exists in our loaded categories
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (targetCategoryId && categoryExists) {
                // Navigate to the target category
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all', // Reset subcategory
                    subSubcategory: 'all', // Reset sub-subcategory
                    search: '' // Clear search
                });
                // Optional: Scroll to the top or to the category section
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (targetCategoryId) {
                 console.warn(`Promo card target category "${targetCategoryId}" not found.`);
            }
        }
    });

    // Add event listeners for previous/next buttons
    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        changePromoCard(-1); // Function to handle changing the displayed card
    });

    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        changePromoCard(1); // Function to handle changing the displayed card
    });

    return cardElement;
}
// --- Functions setupScrollAnimations, renderSkeletonLoader remain the same ---
function setupScrollAnimations() {
    // Options for the observer (which part of the item must be visible)
    const options = {
      root: null, // relative to document viewport
      rootMargin: '0px',
      threshold: 0.1 // 10% of item needed
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, options);

    // Observe all elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear previous skeletons or content
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        // Simplified skeleton structure
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid layout

    // If rendering the main skeleton loader, hide the actual products container and loading dots
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none'; // Hide the spinning loader if skeleton is shown
      document.getElementById('homePageSectionsContainer').style.display = 'none'; // Hide home sections too
    }
}


// --- renderProducts now uses the imported createProductCardElement ---
function renderProducts() {
    productsContainer.innerHTML = ''; // Clear previous products
    if (!state.products || state.products.length === 0) {
        // Optionally display a message if needed, handled by searchProductsInFirestore
        return;
    }

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status once

    state.products.forEach(item => {
        let element;
        if (item.isPromoCard) {
            // Promo card rendering (if createPromoCardElement is still here)
             element = createPromoCardElement(item);
        } else {
            // ++ USE IMPORTED FUNCTION ++
            element = createProductCardElement(item, cardHandlers, state.currentLanguage, isAdmin);
        }
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    // Set up animations for newly added cards
    setupScrollAnimations();
}

// --- Functions renderHomePageContent, renderPromoCardsSectionForHome, etc. now use the imported createProductCardElement ---
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent multiple concurrent renders
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        // Show skeleton loader while fetching layout and content
        renderSkeletonLoader(homeSectionsContainer, 4); // Use the home container for skeleton

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        homeSectionsContainer.innerHTML = ''; // Clear skeleton loader

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled. Showing default 'all products'.");
            // Optionally render 'all products' as a fallback
            const allProductsSection = await renderAllProductsSection();
            if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        } else {
            // Use Promise.all to fetch/render sections concurrently where possible
            const renderPromises = layoutSnapshot.docs.map(doc => {
                 const section = doc.data();
                 const sectionNameObj = (typeof section.name === 'object' ? section.name : { ku_sorani: section.name, ku_badini: section.name, ar: section.name });

                 switch (section.type) {
                     case 'promo_slider':
                         return renderPromoCardsSectionForHome(); // Assumes this fetches data if needed
                     case 'brands':
                         return renderBrandsSection();
                     case 'newest_products':
                         return renderNewestProductsSection();
                     case 'single_shortcut_row':
                         return section.rowId ? renderSingleShortcutRow(section.rowId, sectionNameObj) : Promise.resolve(null);
                     case 'single_category_row':
                         return section.categoryId ? renderSingleCategoryRow(section.categoryId, sectionNameObj) : Promise.resolve(null);
                     case 'all_products':
                          // This usually involves pagination, maybe just show title here or first few?
                          // For simplicity, let's keep renderAllProductsSection fetching a limited number
                         return renderAllProductsSection();
                     default:
                         console.warn(`Unknown home layout section type: ${section.type}`);
                         return Promise.resolve(null); // Return null for unknown types
                 }
            });

            const renderedSections = await Promise.all(renderPromises);

            // Append rendered sections in the correct order
            renderedSections.forEach(sectionElement => {
                if (sectionElement) { // Only append if rendering was successful and returned an element
                    homeSectionsContainer.appendChild(sectionElement);
                }
            });
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_loading_home', {defaultValue: 'هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.'})}</p>`; // Fallback message
    } finally {
        // Skeleton loader is cleared inside the try block now
        state.isRenderingHomePage = false;
    }
}

async function renderPromoCardsSectionForHome() {
    // Fetch promo cards only if not already fetched or if empty
    if (!state.allPromoCards || state.allPromoCards.length === 0) {
        try {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            state.allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
        } catch (error) {
             console.error("Error fetching promo cards:", error);
             state.allPromoCards = []; // Ensure it's an empty array on error
             return null; // Don't render section if fetch fails
        }
    }

    if (state.allPromoCards.length > 0) {
        // Reset index if it's out of bounds
        if (state.currentPromoCardIndex >= state.allPromoCards.length || state.currentPromoCardIndex < 0) {
             state.currentPromoCardIndex = 0;
        }

        // Create the element for the current promo card
        const promoCardElement = createPromoCardElement(state.allPromoCards[state.currentPromoCardIndex]);

        // Create a container grid for the promo card (so it takes full width)
        const promoGrid = document.createElement('div');
        promoGrid.className = 'products-container'; // Use products-container to manage grid layout
        promoGrid.style.marginBottom = '16px'; // Add some space below
        promoGrid.id = 'promo-card-home-container'; // Add ID for easier replacement
        promoGrid.appendChild(promoCardElement);

        startPromoRotation(); // Start or restart the automatic rotation
        return promoGrid;
    }
    // Return null if there are no promo cards to display
    return null;
}

// Function to display a specific promo card by index (used by rotation and prev/next)
function displayPromoCard(index) {
    const promoCardContainer = document.getElementById('promo-card-home-container');
    if (!promoCardContainer || !state.allPromoCards || state.allPromoCards.length === 0) return;

    // Ensure index is within bounds
    if (index < 0) index = state.allPromoCards.length - 1;
    if (index >= state.allPromoCards.length) index = 0;
    state.currentPromoCardIndex = index; // Update the current index

    const cardData = state.allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    newCardElement.classList.add('product-card-reveal'); // For potential fade-in effect

    // Replace the content of the container
    promoCardContainer.innerHTML = ''; // Clear previous card
    promoCardContainer.appendChild(newCardElement);

    // Trigger animation if desired
    setTimeout(() => {
        newCardElement.classList.add('visible');
    }, 10);
}

// Function called by setInterval for automatic rotation
function rotatePromoCard() {
    if (state.allPromoCards.length <= 1) return; // No need to rotate if only one or zero cards
    const nextIndex = (state.currentPromoCardIndex + 1) % state.allPromoCards.length;
    displayPromoCard(nextIndex);
}

// Function called by prev/next buttons
function changePromoCard(direction) {
    if (state.allPromoCards.length <= 1) return;
    const newIndex = state.currentPromoCardIndex + direction;
    displayPromoCard(newIndex); // displayPromoCard handles wrapping around
    startPromoRotation(); // Reset the interval timer after manual change
}

// Function to start/restart the automatic rotation timer
function startPromoRotation() {
    // Clear any existing interval
    if (state.promoRotationInterval) {
        clearInterval(state.promoRotationInterval);
        state.promoRotationInterval = null; // Reset interval ID
    }
    // Start new interval only if there's more than one card
    if (state.allPromoCards && state.allPromoCards.length > 1) {
        state.promoRotationInterval = setInterval(rotatePromoCard, 5000); // Rotate every 5 seconds
    }
}


// --- Functions renderBrandsSection, renderNewestProductsSection, renderSingleCategoryRow, renderSingleShortcutRow, renderAllProductsSection now use the imported createProductCardElement ---
async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section'; // Add main class for styling
    const brandsContainer = document.createElement('div');
    // brandsContainer.id = 'brandsContainer'; // ID might not be necessary
    brandsContainer.className = 'brands-container'; // Class for horizontal scrolling
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30)); // Fetch brands ordered
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null; // Don't render the section if no brands exist
        }

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            // Get name in current language, fallback to Sorani
            const brandName = (brand.name && brand.name[state.currentLanguage]) || (brand.name && brand.name.ku_sorani);

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl || 'https://placehold.co/65x65/e2e8f0/2d3748?text=Brand'}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.src='https://placehold.co/65x65/e2e8f0/2d3748?text=Err'">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                // Navigate to the category/subcategory linked to the brand
                await navigateToFilter({
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all', // Brands usually link to main or sub category
                    search: '' // Clear search
                });
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer; // Return the fully populated section
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null; // Return null on error
    }
}

async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section'; // Class for general section styling
    const header = document.createElement('div');
    header.className = 'section-title-header'; // Class for title and optional 'See All' link
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products'); // Translate title
    header.appendChild(title);
    // Optional: Add a "See All New Products" link here if needed
    // const seeAllLink = document.createElement('a'); ...
    container.appendChild(header);

    try {
        // Calculate timestamp for 15 days ago
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        // Query for products created within the last 15 days, newest first, limit to 10
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null; // Don't render section if no new products found
        }

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container'; // For horizontal scroll
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // ++ USE IMPORTED FUNCTION ++
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsScroller.appendChild(card);
        });

        container.appendChild(productsScroller);
        return container; // Return the populated section

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null; // Return null on error
    }
}

async function renderSingleCategoryRow(categoryId, sectionNameObj) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category || category.id === 'all') {
         console.warn(`Attempted to render single category row for invalid/all category ID: ${categoryId}`);
         return null; // Don't render if category not found or is 'all'
    }

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';

    const title = document.createElement('h3');
    title.className = 'section-title-main';
    // Use provided name object first, fallback to category data, fallback to Sorani
    const categoryName = (sectionNameObj && sectionNameObj[state.currentLanguage])
                       || (category['name_' + state.currentLanguage])
                       || category.name_ku_sorani;
    title.innerHTML = `<i class="${category.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Use default icon if missing
    header.appendChild(title);

    // "See All" link for this specific category
    const seeAllLink = document.createElement('a');
    seeAllLink.className = 'see-all-link';
    seeAllLink.textContent = t('see_all'); // Translate "See All"
    seeAllLink.onclick = async () => {
        await navigateToFilter({
            category: category.id, // Set the main category
            subcategory: 'all', // Reset subcategory
            subSubcategory: 'all', // Reset sub-subcategory
            search: '' // Clear search
        });
    };
    header.appendChild(seeAllLink);
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container'; // For horizontal scroll
    container.appendChild(productsScroller);

    try {
        // Query for products in this category, newest first, limit 10
        const q = query(
            productsCollection,
            where('categoryId', '==', categoryId),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
             console.log(`No products found for single category row: ${categoryName}`);
             return null; // Don't render empty sections
        }

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // ++ USE IMPORTED FUNCTION ++
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsScroller.appendChild(card);
        });
        return container; // Return the populated section

    } catch (error) {
        console.error(`Error fetching products for single category row ${categoryId}:`, error);
        return null; // Return null on error
    }
}

async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section'; // Main class for styling

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) {
            console.warn(`Shortcut row with ID ${rowId} not found.`);
            return null; // Don't render if row doesn't exist
        }

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Determine title: Use provided name object, fallback to row data, fallback Sorani
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage])
                       || (rowData.title && rowData.title[state.currentLanguage])
                       || (rowData.title && rowData.title.ku_sorani);


        // Add title element if a title exists
        if(rowTitle) {
            const titleElement = document.createElement('h3');
            titleElement.className = 'shortcut-row-title';
            titleElement.textContent = rowTitle;
            sectionContainer.appendChild(titleElement);
        }

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container'; // For horizontal scroll
        sectionContainer.appendChild(cardsContainer);

        // Fetch cards within this row, ordered
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            console.log(`Shortcut row "${rowTitle || rowId}" has no cards.`);
            // Decide if you want to show empty rows or not. Returning null hides it.
            return null;
        }

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            // Get card name, fallback to Sorani
            const cardName = (cardData.name && cardData.name[state.currentLanguage])
                           || (cardData.name && cardData.name.ku_sorani);

            const item = document.createElement('div');
            item.className = 'shortcut-card'; // Styling for individual card
            item.innerHTML = `
                <img src="${cardData.imageUrl || 'https://placehold.co/100x100/e2e8f0/2d3748?text=Card'}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.src='https://placehold.co/100x100/e2e8f0/2d3748?text=Err'">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                // Navigate to the filter defined by the card
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: '' // Clear search
                });
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer; // Return populated section
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null; // Return null on error
    }
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section'; // General section styling
    container.style.marginTop = '20px'; // Add some top margin

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title'); // Translate title
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Use the main grid layout
    container.appendChild(productsGrid);

    try {
        // Fetch only the first few products for the home page section
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10)); // Limit initial load
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
             console.log("No products found for 'All Products' home section.");
             return null; // Don't render if no products exist at all
        }

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // ++ USE IMPORTED FUNCTION ++
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsGrid.appendChild(card);
        });

        // Optionally add a "Load More" or "See All Products" button/link here
        // that triggers a navigation or loads more products into this grid.

        return container; // Return the populated section

    } catch (error) {
        console.error("Error fetching initial products for 'All Products' home section:", error);
        return null; // Return null on error
    }
}


// --- searchProductsInFirestore remains largely the same, but decides between home/search ---
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const currentSearchTerm = searchTerm.trim().toLowerCase(); // Normalize search term

    // Determine if we should show the home page layout or search/filter results
    const shouldShowHomeSections = !currentSearchTerm
                                && state.currentCategory === 'all'
                                && state.currentSubcategory === 'all'
                                && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Show Home Page ---
        productsContainer.style.display = 'none';    // Hide product grid
        skeletonLoader.style.display = 'none';     // Hide skeleton loader
        scrollTrigger.style.display = 'none';      // Hide infinite scroll trigger
        loader.style.display = 'none';             // Hide small loading indicator
        homeSectionsContainer.style.display = 'block'; // Show home sections

        // Render home content only if it's not already there
        if (homeSectionsContainer.innerHTML.trim() === '') {
             await renderHomePageContent();
        } else {
             startPromoRotation(); // Ensure promo rotation is active if content exists
        }
        return; // Stop execution, home page is displayed
    } else {
        // --- Show Search/Filter Results ---
        homeSectionsContainer.style.display = 'none'; // Hide home sections
         stopPromoRotation(); // Stop promo rotation when not on home view
    }


    // --- Caching Logic (Optional but recommended for performance) ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${currentSearchTerm}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        console.log("Loading from cache:", cacheKey);
        // Restore state from cache
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid'; // Ensure grid is visible

        renderProducts(); // Render cached products
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Show/hide trigger based on cache
        return; // Stop execution, loaded from cache
    }

    // --- Firestore Query Logic ---
    if (state.isLoadingMoreProducts && !isNewSearch) return; // Prevent concurrent loads

    if (isNewSearch) {
        // Reset state for a new search/filter
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        productsContainer.innerHTML = ''; // Clear previous results immediately
        renderSkeletonLoader(); // Show skeleton for new search
    }

    // Don't fetch more if all are loaded (unless it's a new search)
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = isNewSearch ? 'none' : 'block'; // Show spinning loader only when loading more

    try {
        let productsQuery = collection(db, "products"); // Start with base collection

        // --- Apply Filters ---
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // --- Apply Search Term Filter ---
        if (currentSearchTerm) {
             // Firestore requires the first orderBy to match the inequality field
            productsQuery = query(productsQuery,
                where('searchableName', '>=', currentSearchTerm),
                where('searchableName', '<=', currentSearchTerm + '\uf8ff'),
                 orderBy("searchableName", "asc") // First order by the search field
                 // You can add a secondary sort field *after* the search field
                 // orderBy("createdAt", "desc") // Example: then sort by date
            );
        } else {
             // Default sort order when not searching (e.g., newest first)
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }


        // --- Apply Pagination ---
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // --- Apply Limit ---
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // --- Execute Query ---
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Update State ---
        if (isNewSearch) {
            state.products = newProducts; // Replace products for new search
        } else {
            state.products = [...state.products, ...newProducts]; // Append for load more
        }

        // Update pagination state
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;


        // --- Update Cache (if new search) ---
         if (isNewSearch) {
             if(!state.productCache) state.productCache = {}; // Initialize cache if needed
             state.productCache[cacheKey] = {
                 products: state.products,
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
              console.log("Saved to cache:", cacheKey);
         }

        // --- Render Results ---
        if (isNewSearch) {
            renderProducts(); // Render the newly fetched products
        } else {
             // Append only the new products to the container
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            newProducts.forEach(product => {
                 const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
                 card.classList.add('product-card-reveal'); // Add animation class
                 productsContainer.appendChild(card);
            });
            setupScrollAnimations(); // Setup animation for newly added cards
        }


        // Handle empty results for a new search
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {defaultValue:'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`; // Fallback message
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        // Display error message in the container
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_fetching_products', {defaultValue:'هەڵەیەک لە هێنانی کاڵاکان ڕوویدا.'})}</p>`; // Fallback
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Hide small loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product grid is visible
         scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Update scroll trigger visibility
    }
}


// --- Functions addToCart, renderCart, updateQuantity, removeFromCart, generateOrderMessage, renderCartActionButtons remain the same ---
function addToCart(productId) {
    // Try finding product in already loaded state.products first for efficiency
    let product = state.products.find(p => p.id === productId);
    let mainImage = '';
    let productName = null; // Store name object
    let productPrice = 0;

    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
        saveCart();
        showNotification(t('product_added_to_cart'));
        return; // Exit early if item already exists
    }

    // If product details are available in state.products
    if (product) {
        mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
        productName = product.name; // Get the name object
        productPrice = product.price;

        state.cart.push({
            id: product.id,
            name: productName, // Store the name object
            price: productPrice,
            image: mainImage,
            quantity: 1
        });
        saveCart();
        showNotification(t('product_added_to_cart'));

    } else {
        // If product not found in state, fetch minimal details from Firestore
        console.warn("Product not in state.products. Fetching minimal details for cart...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = docSnap.data();
                mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                productName = fetchedProduct.name; // Get the name object
                productPrice = fetchedProduct.price;

                state.cart.push({
                    id: productId,
                    name: productName, // Store the name object
                    price: productPrice,
                    image: mainImage,
                    quantity: 1
                });
                saveCart();
                showNotification(t('product_added_to_cart'));
            } else {
                 console.error("Product not found in Firestore either:", productId);
                 showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
            console.error("Error fetching product details for cart:", error);
            showNotification(t('error_generic'), 'error');
        });
    }
}

function renderCart() {
    cartItemsContainer.innerHTML = ''; // Clear previous items
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        updateCartCount(); // Ensure count is 0
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Make sure buttons are rendered

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language, fallback to Sorani, then handle potential string name
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                   || (item.name && item.name.ku_sorani)
                                   || (typeof item.name === 'string' ? item.name : t('unnamed_product', {defaultValue:'کاڵای بێ ناو'}));

         const placeholderImg = "https://placehold.co/60x60/e2e8f0/2d3748?text=X";

        cartItem.innerHTML = `
            <img src="${item.image || placeholderImg}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='${placeholderImg}';">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}" aria-label="Increase quantity">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    totalAmount.textContent = total.toLocaleString(); // Update total display

    // Add event listeners after rendering all items
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));

    updateCartCount(); // Update the badge count
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Remove item if quantity drops to 0 or below
        } else {
            saveCart(); // Save changes
            renderCart(); // Re-render the cart UI
        }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart(); // Save the updated cart
    renderCart(); // Re-render the cart UI
}


function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // No message if cart is empty

    let message = t('order_greeting') + "\n\n"; // "Hello! I need these items:"

    state.cart.forEach(item => {
        // Get name in current language, fallback Sorani, then handle string name
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                   || (item.name && item.name.ku_sorani)
                                   || (typeof item.name === 'string' ? item.name : t('unnamed_product', {defaultValue:'کاڵای بێ ناو'}));
        // Format item details using translation
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    // Add total price
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

    // Add user profile info if available
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`; // "--- Customer Info ---"
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`; // "Name:"
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`; // "Address:"
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`; // "Phone:"
    } else {
         // Prompt user to provide info if profile is incomplete
        message += `\n${t('order_prompt_info')}\n`; // "Please send your address and details for delivery."
    }

    return message;
}

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order by creation time or a specific 'order' field if you add one

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = `<p>${t('no_order_methods', {defaultValue: 'هیچ ڕێگایەکی ناردنی داواکاری دیاری نەکراوە.'})}</p>`; // Fallback message
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a common class and rely on inline style for background
            btn.className = 'whatsapp-btn'; // Maybe rename this class to 'order-action-btn'
            btn.style.backgroundColor = method.color || 'var(--primary-color)'; // Use color from DB or default

            // Get button text in current language, fallback to Sorani
            const name = (method['name_' + state.currentLanguage]) || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Default icon

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return; // Don't proceed if cart is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, URL etc.

                switch (method.type) {
                    case 'whatsapp':
                        // Ensure number starts correctly (e.g., remove leading +, add country code if missing)
                        const whatsappNumber = value.replace(/^\+|^00/, ''); // Basic cleaning
                        link = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                         // Viber links are tricky, might need number with country code
                         const viberNumber = value.startsWith('+') ? value : `+${value}`; // Ensure +
                         link = `viber://chat?number=${encodeURIComponent(viberNumber)}` // Might need text parameter depending on app version
                        // link = `viber://pa?chatURI=${value}&text=${encodedMessage}`; // For Public Accounts
                        break;
                    case 'telegram':
                        // Assumes value is a username (without @) or a public channel link
                        link = value.startsWith('https://t.me/') ? `${value}?text=${encodedMessage}` : `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url':
                        // For custom URLs, decide if you want to append the message
                        // Example: link = `${value}?order=${encodedMessage}`;
                        link = value; // Open the raw URL for now
                        break;
                     default:
                         console.warn("Unknown contact method type:", method.type);
                         return; // Don't try to open a link
                }

                if (link) {
                    window.open(link, '_blank'); // Open in new tab/app
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = `<p>${t('error_loading_methods', {defaultValue: 'هەڵە لە بارکردنی ڕێگاکانی ناردن.'})}</p>`; // Fallback
    }
}


// --- Functions renderPolicies, checkNewAnnouncements, renderUserNotifications, renderContactLinks, showWelcomeMessage, setupGpsButton, setupScrollObserver, updateCategoryDependentUI remain the same ---
async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani, then empty string
            const content = policies[state.currentLanguage]
                         || policies.ku_sorani
                         || '';
            // Render content, replace newlines with <br> or display message if empty
            termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function checkNewAnnouncements() {
    // Only check if notification badge element exists
    if (!notificationBadge) return;

    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // Use onSnapshot to listen for real-time changes
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get the timestamp of the last announcement the user saw
            const lastSeenTimestamp = parseInt(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0');

            // If the latest announcement is newer than the last seen one
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // Show the notification dot
            } else {
                notificationBadge.style.display = 'none'; // Hide the dot
            }
        } else {
             notificationBadge.style.display = 'none'; // Hide if no announcements exist
        }
    }, (error) => {
         console.error("Error listening for new announcements:", error);
         // Optionally handle the error, e.g., stop listening
         // unsubscribe();
    });
    // Note: Consider calling unsubscribe() when the app closes or user logs out
    // to prevent memory leaks, although for a simple PWA it might not be critical.
}


async function renderUserNotifications() {
    notificationsListContainer.innerHTML = `<p>${t('loading_notifications', {defaultValue: '...بارکردنی ئاگەدارییەکان'})}</p>`; // Loading state

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc")); // Get all, newest first
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading message
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            // Update last seen timestamp even if empty, so badge hides after opening
            localStorage.setItem('lastSeenAnnouncementTimestamp', Date.now().toString());
            notificationBadge.style.display = 'none';
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Keep track of the newest announcement timestamp
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
            // Simple date format YYYY/MM/DD
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

            // Get title and content in current language, fallback to Sorani
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${formatDescription(content)}</p> {/* Use formatDescription */}
            `;
            notificationsListContainer.appendChild(item);
        });

        // Store the timestamp of the latest announcement shown
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp.toString());
        notificationBadge.style.display = 'none'; // Hide the badge after viewing

    } catch (error) {
        console.error("Error fetching notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}


function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    // Ensure container exists
    if (!contactLinksContainer) return;

    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    // Order by a field if needed, e.g., 'order' or 'createdAt'
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Example: newest first

    // Use onSnapshot to listen for real-time updates to social links
    const unsubscribe = onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('no_contact_links', {defaultValue:'هیچ لینکی پەیوەندی نییە.'})}</p>`; // Fallback message
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            // Get name in current language, fallback to Sorani
            const name = (link['name_' + state.currentLanguage]) || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url || '#'; // Add fallback href
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security measure
            linkElement.className = 'settings-item'; // Use settings item styling

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i> {/* Default icon */}
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> {/* Icon indicating external link */}
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
         console.error("Error fetching social links:", error);
         contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('error_generic')}</p>`;
         // Optionally unsubscribe on error
         // unsubscribe();
    });
     // Consider calling unsubscribe() elsewhere if needed (e.g., on app close)
}


function showWelcomeMessage() {
    // Check if the user has visited before using localStorage
    if (!localStorage.getItem('hasVisited')) {
        // Find the welcome modal
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) {
             openPopup('welcomeModal', 'modal'); // Open the modal
             // Set the flag in localStorage so it doesn't show again
             localStorage.setItem('hasVisited', 'true');

             // Optional: Auto-close after a few seconds
             /*
             setTimeout(() => {
                 // Check if the modal is still open before closing
                 if (welcomeModal.style.display === 'block') {
                     closeCurrentPopup();
                 }
             }, 5000); // Close after 5 seconds
             */
        }
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    // Ensure both elements exist
    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location'; // Fallback text

    getLocationBtn.addEventListener('click', () => {
        // Check if Geolocation is supported
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', {defaultValue:'وێبگەڕەکەت پشتگیری GPS ناکات'}), 'error'); // Fallback
            return;
        }

        // Disable button and show loading state
        if(btnSpan) btnSpan.textContent = t('gps_loading', {defaultValue:'...چاوەڕوان بە'}); // Fallback
        getLocationBtn.disabled = true;

        // Request current position
        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback (async for fetch)
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Use Nominatim reverse geocoding (OpenStreetMap data)
                    // Request language preference: Kurdish (ku), then English (en)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name; // Set input value
                         showNotification(t('gps_success', {defaultValue:'ناونیشان وەرگیرا'}), 'success'); // Fallback
                    } else {
                         showNotification(t('gps_no_address', {defaultValue:'نەتوانرا ناونیشان بدۆزرێتەوە'}), 'error'); // Fallback
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification(t('gps_error_fetching', {defaultValue:'هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا'}), 'error'); // Fallback
                } finally {
                     // Restore button state regardless of success/error
                     if(btnSpan) btnSpan.textContent = originalBtnText;
                     getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let messageKey = 'gps_error_unknown'; // Default error key
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        messageKey = 'gps_error_permission';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        messageKey = 'gps_error_unavailable';
                        break;
                    case error.TIMEOUT:
                        messageKey = 'gps_error_timeout';
                        break;
                }
                // Show translated error message with fallback
                 showNotification(t(messageKey, {defaultValue: 'هەڵەیەکی نادیار ڕوویدا'}), 'error');

                // Restore button state
                if(btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { // Geolocation options (optional)
                enableHighAccuracy: false, // More battery efficient
                timeout: 10000, // 10 seconds timeout
                maximumAge: 60000 // Allow cached position up to 1 minute old
            }
        );
    });
}


function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) {
        console.warn("Scroll trigger element not found.");
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        // Trigger only when the element starts intersecting the viewport
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
            console.log("Scroll trigger intersected, loading more products...");
            // Load the next page of products based on the current search/filter state
            searchProductsInFirestore(state.currentSearch, false); // false indicates it's not a new search
        }
    }, {
        root: null, // Observe intersection with the viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger);
}


function updateCategoryDependentUI() {
    // Only proceed if categories have been loaded
    if (!state.categories || state.categories.length === 0) {
        console.warn("Attempted to update category UI before categories were loaded.");
        return;
    }

    // Populate category dropdown in the product form (admin)
    populateCategoryDropdown();

    // Render the main category buttons/tabs on the main page
    renderMainCategories();

    // Render categories in the slide-up sheet
    renderCategoriesSheet();

    // If admin logic is loaded, update dropdowns within admin forms
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update dropdowns for shortcut cards too
    }
}

// --- stopPromoRotation function ---
function stopPromoRotation() {
    if (state.promoRotationInterval) {
        clearInterval(state.promoRotationInterval);
        state.promoRotationInterval = null;
    }
}


// --- setupEventListeners remains mostly the same, ensure correct function calls ---
function setupEventListeners() {
    // --- Navigation Buttons ---
    homeBtn.onclick = async () => {
        // If not already on the main page, navigate there
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
             // Push a simple state for the main page itself
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        // Always reset filters when home button is explicitly clicked
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser's back functionality
    };

    // --- Bottom Sheet/Modal Triggers ---
    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn'); // Highlight profile button
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn'); // Highlight cart button
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn'); // Highlight categories button
    };

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
        // No nav button to highlight for this one
    });


    // --- Settings Page Links ---
    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet');
        // No nav button to highlight, maybe highlight settings?
        // updateActiveNav('settingsBtn');
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal');
    };

     if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }


    // --- Popup Closing ---
    sheetOverlay.onclick = () => closeCurrentPopup();
    // Close buttons within modals/sheets
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    // Clicking outside modal content closes modal
    window.onclick = (e) => {
         if (e.target.classList.contains('modal')) {
              closeCurrentPopup();
         }
    };

    // --- Forms ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = loginButton.textContent;
        loginButton.disabled = true;
        loginButton.textContent = '...چوونەژوور';

        try {
            await signInWithEmailAndPassword(auth, email, password);
             // onAuthStateChanged will handle UI updates and closing modal
        } catch (error) {
            console.error("Login failed:", error);
            showNotification(t('login_error'), 'error');
             loginButton.disabled = false; // Re-enable button on error
             loginButton.textContent = originalButtonText;
        }
         // No finally needed here as onAuthStateChanged handles success state
    };

     profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value.trim(),
            address: document.getElementById('profileAddress').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Close profile sheet after saving
    };


    // --- Search ---
     const debouncedSearch = debounce(async (term) => {
        // Navigate with the new search term, reset category filters
        await navigateToFilter({ search: term, category: 'all', subcategory:'all', subSubcategory:'all' });
    }, 500); // Wait 500ms after user stops typing

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        // Navigate back to default home view when search is cleared
        navigateToFilter({ search: '', category:'all', subcategory:'all', subSubcategory:'all' });
    };

     // --- Subpage Search (for subcategory detail page) ---
     const subpageSearchInput = document.getElementById('subpageSearchInput');
     const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

     const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2];

             // Find the currently active sub-subcategory filter on the detail page
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';

             // Re-render products on the detail page with the new search term and existing filters
             await renderProductsOnDetailPage(subCatId, subSubCatId, term);
         }
     }, 500);

     if(subpageSearchInput) {
        subpageSearchInput.oninput = () => {
            const searchTerm = subpageSearchInput.value;
            subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            debouncedSubpageSearch(searchTerm);
        };
     }
     if(subpageClearSearchBtn) {
        subpageClearSearchBtn.onclick = () => {
            subpageSearchInput.value = '';
            subpageClearSearchBtn.style.display = 'none';
            debouncedSubpageSearch(''); // Trigger search with empty term
        };
     }


    // --- Settings Toggles ---
    if(contactToggle) {
        contactToggle.onclick = () => {
            const container = document.getElementById('dynamicContactLinksContainer');
            const chevron = contactToggle.querySelector('.contact-chevron');
            container?.classList.toggle('open'); // Use optional chaining
            chevron?.classList.toggle('open');
        };
    }

    // --- Language Buttons ---
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    // --- PWA Install Button ---
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after clicking
                state.deferredPrompt.prompt(); // Show the install prompt
                // Wait for the user to respond to the prompt
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, discard it
                state.deferredPrompt = null;
            }
        });
    }

     // --- Firebase Messaging Listener (Foreground) ---
     onMessage(messaging, (payload) => {
         console.log('Foreground message received: ', payload);
         // Extract title and body, providing defaults
         const title = payload.notification?.title || 'New Notification';
         const body = payload.notification?.body || '';
         // Show notification using our function
         showNotification(`${title}${body ? ': ' + body : ''}`, 'success'); // Combine title and body
         // Optional: Update the notification badge immediately
         if (notificationBadge) notificationBadge.style.display = 'block';
     });
}

// --- onAuthStateChanged remains the same ---
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Replace with YOUR actual admin user UID
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your admin UID
    const isAdmin = user && user.uid === adminUID;

    console.log("Auth state changed. User:", user ? user.uid : 'null', "Is Admin:", isAdmin);


    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        // Initialize admin logic if it exists and hasn't been initialized
         if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function' && !window.AdminLogic.listenersAttached) {
             window.AdminLogic.initialize();
         } else if (window.AdminLogic) {
             // If already initialized (e.g., page reload while logged in), just update UI
             window.AdminLogic.updateAdminUI(true);
             // Ensure dropdowns are populated if categories loaded after admin init
             window.AdminLogic.updateAdminCategoryDropdowns?.();
             window.AdminLogic.updateShortcutCardCategoryDropdowns?.();
         }
         // Close login modal if open
         if (loginModal.style.display === 'block') {
            closeCurrentPopup();
         }
    } else {
        sessionStorage.removeItem('isAdmin');
        // If a non-admin user is somehow logged in, log them out.
        if (user) {
            console.log("Non-admin user detected, logging out.");
            await signOut(auth).catch(err => console.error("Error signing out non-admin:", err));
        }
        // Deinitialize admin UI elements if admin logic exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        } else if (window.AdminLogic) {
             // Fallback if deinitialize doesn't exist, just hide UI
             window.AdminLogic.updateAdminUI(false);
        }
    }

     // Re-render products if the admin status changed to show/hide admin buttons on cards
     // Avoid re-rendering if products haven't loaded yet
     if(state.products.length > 0) {
        renderProducts();
        // Also re-render favorites if the sheet is open
        if (document.getElementById('favoritesSheet').classList.contains('show')) {
            renderFavoritesPage();
        }
     }
});

// --- Initialization Logic ---
function init() {
    renderSkeletonLoader(); // Show skeleton immediately

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open?');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            } else {
                 console.error("Error enabling persistence:", err);
            }
            console.warn("Running in online-only mode.");
        })
        .finally(() => {
             // Initialize core app logic regardless of persistence success/failure
             initializeAppLogic();
        });
}

function initializeAppLogic() {
    // Listener for Categories - This drives the initial data load for categories
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add the "All" category at the beginning
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani:'هەموو', name_ku_badini:'هەمی', name_ar:'الكل' }, ...fetchedCategories];

        // Update all UI elements that depend on categories
        updateCategoryDependentUI();

        // Now that categories are loaded, handle the initial page/filter state
        handleInitialPageLoad(); // This will call applyFilterState internally

    }, (error) => {
         console.error("Error fetching categories:", error);
         // Handle error, maybe show a message to the user
         document.getElementById('mainCategoriesContainer').innerHTML = `<p>${t('error_loading_categories', {defaultValue:'هەڵە لە بارکردنی جۆرەکان'})}</p>`;
         productsContainer.innerHTML = `<p>${t('error_loading_categories', {defaultValue:'هەڵە لە بارکردنی جۆرەکان'})}</p>`;
         skeletonLoader.style.display = 'none';
    });

    // --- Other Initializations ---
    updateCartCount();       // Update cart badge from localStorage
    setupEventListeners();   // Setup all button clicks, form submits, etc.
    setupScrollObserver();   // Initialize infinite scroll
    setLanguage(state.currentLanguage); // Apply initial language
    renderContactLinks();    // Fetch and display contact links
    checkNewAnnouncements(); // Check for new notifications and update badge
    showWelcomeMessage();    // Show welcome modal on first visit
    setupGpsButton();        // Enable GPS functionality in profile

     // Initialize Admin Logic IF the user is already determined to be admin (e.g. from sessionStorage on reload)
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.initialize === 'function' && !window.AdminLogic.listenersAttached) {
        window.AdminLogic.initialize();
     }

}


// Make essential functions/data available for admin.js
// Use globalAdminTools object defined in app-setup.js
Object.assign(window.globalAdminTools, {
    // Firestore essentials passed from setup are already here
    // Add functions needed by admin.js that are defined in this file
    showNotification,
    t,
    openPopup,
    closeCurrentPopup,
    searchProductsInFirestore, // To refresh list after admin actions
    clearProductCache, // Allow admin to clear cache
    setEditingProductId: (id) => { state.editingProductId = id; }, // Manage editing state
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide category data
    getCurrentLanguage: () => state.currentLanguage, // Provide current language
    populateSubcategoriesDropdown: AdminLogic.populateSubcategoriesDropdown, // Expose dropdown logic
    populateSubSubcategoriesDropdown: AdminLogic.populateSubSubcategoriesDropdown // Expose dropdown logic
});


// Start the initialization process when the DOM is ready
document.addEventListener('DOMContentLoaded', init);

// --- PWA Service Worker Logic ---
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    state.deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Show the install button in settings
        console.log('`beforeinstallprompt` event fired.');
    }
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        // Listen for updates to the service worker
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                 // When the new worker is installed and waiting to activate
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                     // Show the update notification bar
                     if(updateNotification) updateNotification.classList.add('show');
                }
            });
        });

        // Handle the button click to activate the new worker
         if(updateNowBtn) {
            updateNowBtn.addEventListener('click', () => {
                // Check if there is a waiting worker
                if (registration.waiting) {
                    // Send message to the waiting worker to skip waiting
                    registration.waiting.postMessage({ action: 'skipWaiting' });
                    // Optionally hide the notification after clicking
                    if(updateNotification) updateNotification.classList.remove('show');
                }
            });
         }

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Listen for controller change (new worker activated)
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return; // Prevent multiple refreshes
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}