// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی دووبارەبوونەوەی سلایدەر - v2)
// Guhertinên nû ji bo navîgasyona rûpela jêr-kategoriyê hatine zêdekirin
// Debugging: Define subcategoryDetailPage directly

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection,
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
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer
    // REMOVED: subcategoryDetailPage from import
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- DEBUGGING: Define subcategoryDetailPage directly ---
const subcategoryDetailPage = document.getElementById('subcategoryDetailPage');
console.log("Defining subcategoryDetailPage directly:", typeof subcategoryDetailPage, subcategoryDetailPage); // DEBUGGING LOG 2

// --- Helper Functions ---

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} [delay=500] - The debounce delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Saves the current scroll position to the history state for the main page.
 */
function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state (not popups or other pages)
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

/**
 * Updates the header view (main header vs. subpage header) based on the current page.
 * @param {string} pageId - The ID of the page being shown.
 * @param {string} [title=''] - The title for the subpage header.
 */
function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const subpageSearch = document.querySelector('.subpage-search'); // Get subpage search container

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
        // Show search only on subcategory detail page, hide otherwise (e.g., settings)
        subpageSearch.style.display = (pageId === 'subcategoryDetailPage') ? 'flex' : 'none';
    }
}

/**
 * Shows the specified page and hides others, updating the header and history.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - The title for the page (used in header).
 */
function showPage(pageId, pageTitle = '') {
    // Hide all pages first
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('page-active');
        page.classList.add('page-hidden');
    });

    // Show the target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('page-hidden');
        targetPage.classList.add('page-active');
    } else {
        console.error(`Page with ID "${pageId}" not found.`);
        // Fallback to main page if target page doesn't exist
        document.getElementById('mainPage').classList.remove('page-hidden');
        document.getElementById('mainPage').classList.add('page-active');
        pageId = 'mainPage'; // Update pageId for subsequent logic
    }


    // Scroll to top for new pages (except main page potentially restoring scroll)
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Update the header based on the shown page
    updateHeaderView(pageId, pageTitle);


    // Update active state in bottom navigation
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
        updateActiveNav(activeBtnId);
    } else {
        // If it's a subcategory page, keep 'Home' active visually
        updateActiveNav('homeBtn');
    }
}


/**
 * Closes all open modals and bottom sheets.
 */
function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active'); // Allow body scrolling
}

/**
 * Opens a specific modal or bottom sheet.
 * @param {string} id - The ID of the element to open.
 * @param {('sheet'|'modal')} [type='sheet'] - The type of popup.
 */
function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening popup
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Load content specific to the sheet
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            // Pre-fill profile form
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scrolling
    // Push state for popup handling via back button
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

/**
 * Closes the currently open popup by simulating a back navigation or directly closing.
 */
function closeCurrentPopup() {
    // If the current state is a popup, go back in history to close it
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // Otherwise, just close everything (fallback)
        closeAllPopupsUI();
    }
}

/**
 * Applies the given filter state to the main page UI.
 * @param {object} filterState - An object containing category, subcategory, subSubcategory, search, and scroll properties.
 * @param {boolean} [fromPopState=false] - Indicates if the function is called due to a popstate event.
 */
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input and clear button
    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category bars to reflect active state
    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Render subcategories based on the main category

    // Fetch and render products/home content based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // `true` forces a new search/render

    // Restore scroll position if navigating back/forward
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Delay slightly to ensure content is rendered before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        // Scroll to top for new filter applications
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Updates the filter state and pushes it to the browser history.
 * @param {object} newState - An object containing the new filter properties to merge.
 */
async function navigateToFilter(newState) {
    // Save current scroll position before navigating
    saveCurrentScrollPosition();

    // Create the final state object, merging current state with new state, resetting scroll
    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        ...newState,
        scroll: 0 // Reset scroll for new filter navigation
    };

    // Construct URL parameters based on the final state
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI
    await applyFilterState(finalState);
}


// --- History and Navigation ---

/**
 * Handles browser back/forward navigation (popstate event).
 */
window.addEventListener('popstate', async (event) => { // Guhertin bo async
    closeAllPopupsUI(); // Close any popups first
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Eger ew rûpela jêr-kategoriyê be û sernav tune be (wekî dema forward), ji nû ve bistîne
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
               try {
                   const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                   const subCatSnap = await getDoc(subCatRef);
                   if (subCatSnap.exists()) {
                       const subCat = subCatSnap.data();
                       pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                       // Update the history state title now that we have it
                       history.replaceState({ ...popState, title: pageTitle }, '');
                   }
               } catch(e) { console.error("Could not refetch title on popstate", e); pageTitle = 'Details'; }
            }
            showPage(popState.id, pageTitle);
            // If navigating back TO the subcategory detail page, re-render its content
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await renderSubSubcategoriesOnDetailPage(popState.mainCatId, popState.subCatId);
                await renderProductsOnDetailPage(popState.subCatId, 'all', ''); // Reset filters on back navigation
            }
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Re-open the popup
            openPopup(popState.id, popState.type);
        } else {
            // Assume it's a main page filter state
            showPage('mainPage'); // Make sure main page is visible
            applyFilterState(popState, true); // Apply filters and restore scroll
        }
    } else {
        // No state, assume going back to the initial main page state
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});


/**
 * Handles the initial page load, parsing URL parameters and hash.
 */
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    // Determine the target page based on hash
    let pageId = 'mainPage'; // Default to main page
    let pageTitle = '';
    let initialSubcategoryState = null;

    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        if (ids.length >= 3) {
            pageId = 'subcategoryDetailPage';
            initialSubcategoryState = { mainCatId: ids[1], subCatId: ids[2] };
            // Title will be fetched later in initializeAppLogic after categories are loaded
        }
    } else if (hash === 'settingsPage') {
        pageId = 'settingsPage';
        pageTitle = t('settings_title');
    }

    // Replace initial history entry
    if (pageId !== 'mainPage') {
         history.replaceState({ type: 'page', id: pageId, title: pageTitle, ...initialSubcategoryState }, '', `#${hash}`);
         showPage(pageId, pageTitle);
         // Content loading for subcategory page happens in initializeAppLogic after categories load
    } else {
        // Handle main page filters from URL parameters
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        const initialUrl = `${window.location.pathname}?${params.toString()}`;
        history.replaceState(initialState, '', initialUrl);
        showPage('mainPage');
        // Applying filter state happens in initializeAppLogic after categories load
    }

     // Handle opening popups directly via hash on main page
     if (pageId === 'mainPage' && hash) {
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 // Open popup *after* main content potentially loads
                setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
            }
        }
    }

    // Handle opening product details directly via query param
    const productId = params.get('product');
    if (productId) {
        // Delay slightly to ensure product data might be available
        setTimeout(() => showProductDetails(productId), 500);
    }
}


// --- Translation ---
function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    // Update static text elements
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) { // Check if placeholder exists
                 element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render dynamic content that depends on language
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear home sections to force re-render with new lang
    }

     // Re-render based on current view
    if (document.getElementById('mainPage').classList.contains('page-active')) {
        const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
        if (isHomeView) {
            renderHomePageContent(); // Re-render home page sections
        } else {
             searchProductsInFirestore(state.currentSearch, true); // Re-render filtered products
        }
         renderMainCategories(); // Update category names
         renderSubcategories(state.currentCategory); // Update subcategory names
    } else if (document.getElementById('subcategoryDetailPage').classList.contains('page-active')) {
        // Re-render subcategory detail page content
        const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
             if (ids.length >= 3) {
                 showSubcategoryDetailPage(ids[1], ids[2], true); // Re-render detail page
             }
         }
    } else if (document.getElementById('settingsPage').classList.contains('page-active')) {
        // Title might need update if settings_title key changed (unlikely but good practice)
        updateHeaderView('settingsPage', t('settings_title'));
        renderContactLinks(); // Update contact link names
    }


    // Re-render open popups if needed
    renderCategoriesSheet(); // Update category names in sheet
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart(); // Update item names, totals
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage(); // Update item names
    if (document.getElementById('notificationsSheet').classList.contains('show')) renderUserNotifications(); // Update notification text
    if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies(); // Update policy text
}


// --- PWA & Updates ---

/**
 * Forces an update by unregistering service workers and clearing caches.
 */
async function forceUpdate() {
    // Replace confirm with a custom modal if possible
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

            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload(true); // Force reload ignoring cache
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

// --- UI Updates ---

function updateContactLinksUI() {
    // This function seems unused, maybe integrate its logic into renderContactLinks?
    if (!state.contactInfo) return;
    // ... logic to update UI based on state.contactInfo ...
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

/**
 * Formats description text: escapes HTML, converts URLs to links, replaces newlines with <br>.
 * @param {string} text - The raw description text.
 * @returns {string} - The formatted HTML string.
 */
function formatDescription(text) {
    if (!text) return '';
    // Basic HTML escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    // Replace URLs with anchor tags
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`; // Ensure protocol
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newline characters with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}


// --- Notifications ---

async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success'); // Translate if needed
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Your VAPID key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Save token
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification('مۆڵەت نەدرا', 'error'); // Translate if needed
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy checking/updates
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now() // Store timestamp
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

// --- Favorites ---

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Prevent card click when clicking button

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update heart icon on all instances of this product card
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // More specific selector
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle Font Awesome classes for solid/regular heart
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorite
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart if not
        }
    });

    // Re-render favorites sheet if it's currently open
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // Clear previous content

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout

    renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while loading

    try {
        // Fetch details for all favorited products
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        // Filter out products that might have been deleted
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


// --- Cart ---

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount(); // Update the badge count whenever cart changes
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Update all elements with the cart-count class
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/**
 * Displays a toast-like notification message.
 * @param {string} message - The message to display.
 * @param {('success'|'error')} [type='success'] - The type of notification.
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove element after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// --- Categories ---

/**
 * Populates the category dropdown in the product form (admin).
 */
function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>'; // Translate if needed
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Use current language name, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

/**
 * Renders the category list in the categories bottom sheet.
 */
function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // "All" label
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Category name

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        // Navigate to filter when a category is selected
        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory when changing main category
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
            closeCurrentPopup(); // Close the sheet
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders sub-subcategory buttons for the main page (likely unused now).
 * @param {string} mainCatId
 * @param {string} subCatId
 */
async function renderSubSubcategories(mainCatId, subCatId) {
     // This function is likely no longer needed on the main page after the navigation change.
     // Kept here for reference or potential future use, but clears the container.
     subSubcategoriesContainer.innerHTML = '';
     subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden
}

/**
 * Navigates to and renders the subcategory detail page.
 * @param {string} mainCatId - ID of the parent main category.
 * @param {string} subCatId - ID of the subcategory to display.
 * @param {boolean} [fromHistory=false] - Indicates if called via popstate.
 */
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        // Fetch subcategory name for the header title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
    }

    // Push state to history if navigating directly (not via back/forward)
    if (!fromHistory) {
         // Include mainCatId and subCatId in state for potential use during popstate
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }

    // Show the detail page UI
    showPage('subcategoryDetailPage', subCatName);

    // Get references to elements within the detail page
    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Show loader and clear previous content
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';

    // Clear the subpage search input
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';


    // Render the content for the detail page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Render sub-subcategories first
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Then render products (initially all for this subcategory)

    loader.style.display = 'none'; // Hide loader after content is loaded
}

/**
 * Renders the sub-subcategory filter buttons within the subcategory detail page.
 * @param {string} mainCatId
 * @param {string} subCatId
 */
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Clear previous buttons

    try {
        // Fetch sub-subcategories for the current subcategory
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // If no sub-subcategories exist, hide the container
        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Create and add the "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // "All" is active by default
        // SVG icon for "All"
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Set ID for easy identification
        allBtn.onclick = () => {
            // Update active state and render products for 'all' sub-subcategories
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Render products for the parent subcategory
        };
        container.appendChild(allBtn);

        // Create and add buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Set ID
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                // Update active state and render products for this specific sub-subcategory
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Pass subSubcat.id
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide if error occurs
    }
}

/**
 * Fetches and renders products within the subcategory detail page, applying filters.
 * @param {string} subCatId - The ID of the parent subcategory.
 * @param {string} [subSubCatId='all'] - The ID of the selected sub-subcategory ('all' for no filter).
 * @param {string} [searchTerm=''] - The search term to filter by.
 */
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query: filter by the parent subcategory ID
        productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));

        // Add sub-subcategory filter if selected
        if (subSubCatId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
        }

        // Add search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff') // Firestore prefix search
            );
             // When searching, orderBy must match the inequality field first
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default sort order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Limit the results (optional, could add pagination later)
        productsQuery = query(productsQuery, limit(50)); // Limit to 50 for detail page initially

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>'; // Translate
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
            // Add products to the global state so product detail view can find them
            const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            state.products = [...state.products, ...newProducts.filter(np => !state.products.some(sp => sp.id === np.id))];

        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>'; // Translate
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}


/**
 * Renders the subcategory buttons on the main page.
 * @param {string} categoryId - The ID of the currently selected main category.
 */
async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous

    // Don't show subcategory bar if 'All' is selected
    if (categoryId === 'all') {
         subcategoriesContainer.style.display = 'none'; // Hide the container
         // Also hide sub-subcategories if they were somehow visible
         document.getElementById('subSubcategoriesContainer').style.display = 'none';
        return;
    }

     subcategoriesContainer.style.display = 'flex'; // Show the container


    try {
        // Fetch subcategories for the selected main category
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // If no subcategories, hide the bar
        if (state.subcategories.length === 0) {
             subcategoriesContainer.style.display = 'none';
             return;
        }


        // Create and add buttons for each subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn`; // No 'active' state needed here anymore

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // **CHANGED:** On click, navigate to the detail page
            subcatBtn.onclick = () => {
                 showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories:", error);
         subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

/**
 * Renders the main category filter buttons.
 */
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Highlight the active category
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        // Set filter state on click
        btn.onclick = async () => {
             // Reset sub/sub-sub/search when changing main category
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


// --- Product Details ---

/**
 * Finds product data (local or fetched) and shows the details sheet.
 * @param {string} productId - The ID of the product to show.
 */
function showProductDetails(productId) {
    // Look in the currently rendered products first
    const allFetchedProducts = [...state.products]; // Combine home and potentially loaded products
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found locally. Fetching from Firestore...");
        // Fetch from Firestore if not found locally
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                // Add fetched product to state.products if not already there,
                // avoids re-fetching if user opens details multiple times
                if (!state.products.some(p => p.id === fetchedProduct.id)) {
                    state.products.push(fetchedProduct);
                }
                showProductDetailsWithData(fetchedProduct); // Show details with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
        });
        return;
    }
    // Show details if product found locally
    showProductDetailsWithData(product);
}

/**
 * Renders related products based on category/subcategory.
 * @param {object} currentProduct - The product currently being viewed.
 */
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the category level to query based on the current product's data
    let queryField, queryValue;
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    } else {
        return; // Cannot find related products if no category info exists
    }

    // Construct the Firestore query
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue), // Filter by the determined category level
        where('__name__', '!=', currentProduct.id), // Exclude the current product itself
        limit(6) // Limit the number of related products
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Exit if no related products
        }

        // Render each related product
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
             // Ensure related products are also added to state.products for potential detail view
             if (!state.products.some(p => p.id === product.id)) {
                state.products.push(product);
            }
        });

        section.style.display = 'block'; // Show the section

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


/**
 * Populates and opens the product details bottom sheet with product data.
 * @param {object} product - The product data object.
 */
function showProductDetailsWithData(product) {
    // Scroll sheet content to top
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // Get product details in the current language (fallback to Sorani)
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Consolidate image sources
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // --- Image Slider Setup ---
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Create main image element
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active'); // First image is active
            imageContainer.appendChild(img);

            // Create thumbnail element
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // First thumb is active
            thumb.dataset.index = index; // Store index for click handling
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Display placeholder if no images
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="No Image" class="active">`;
    }

    // Slider controls logic
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return; // Boundary check
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        if (thumbnails[index]) thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // Show/hide slider buttons based on image count
    const showSliderBtns = images.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    // Attach event listeners for slider controls
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // --- Populate Other Details ---
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Format description

    // Display price (with discount if applicable)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        // Show discounted price and original price crossed out
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        // Show regular price
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Configure "Add to Cart" button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close sheet after adding to cart
    };

    // Render related products section
    renderRelatedProducts(product);

    // Open the bottom sheet
    openPopup('productDetailSheet');
}

// --- Product Card Creation ---

/**
 * Creates the HTML element for a product card.
 * @param {object} product - The product data object.
 * @returns {HTMLElement} - The product card div element.
 */
function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Store product ID
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Get product details in current language
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // --- Price and Discount ---
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`; // Show original price
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`; // Discount badge
    }

    // --- Shipping Info ---
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
    }

    // --- Favorite Button ---
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid or regular heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // --- Card HTML Structure ---
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // --- Event Listeners for Card Buttons ---

    // Share Button
    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent card click
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`; // Generate share URL
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`, // Translate "Check out this product:"
            url: productUrl,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData); // Use Web Share API if available
            } else {
                // Fallback: Copy URL to clipboard
                const textArea = document.createElement('textarea');
                textArea.value = productUrl;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showNotification('لينكى کاڵا کۆپى کرا!', 'success'); // Translate
                } catch (err) {
                    showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); // Translate
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Share error:', err);
            if (err.name !== 'AbortError') { // Don't show error if user cancelled
                showNotification(t('share_error'), 'error');
            }
        }
    });

    // General Card Click (handles add to cart, admin actions, favorites, details view)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton && !addToCartButton.disabled) {
            // Add to Cart Logic
            addToCart(product.id);
            // Button feedback animation
            const originalContent = addToCartButton.innerHTML;
            addToCartButton.disabled = true;
            addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading spinner
            setTimeout(() => {
                addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Checkmark
                setTimeout(() => { // Revert after delay
                    addToCartButton.innerHTML = originalContent;
                    addToCartButton.disabled = false;
                }, 1500);
            }, 500);
        } else if (isAdminNow && target.closest('.edit-btn')) {
            // Admin Edit
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            // Admin Delete
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            // Toggle Favorite
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
             // Share action already handled by its own listener
        } else if (!target.closest('a')) { // Don't trigger if clicking a link in description (future proofing)
            // Show Product Details
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}

// --- Skeleton Loader ---

/**
 * Sets up intersection observer for reveal-on-scroll animations.
 */
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible'); // Add class when visible
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% visible
    });

    // Observe all elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}


/**
 * Renders skeleton loading cards.
 * @param {HTMLElement} [container=skeletonLoader] - The container to render into.
 * @param {number} [count=8] - Number of skeleton cards to render.
 */
function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear container
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid layout
    // Hide actual products/loader when showing skeleton
    if (container === skeletonLoader) {
        productsContainer.style.display = 'none';
        loader.style.display = 'none';
    }
}


// --- Rendering Products on Main Page ---

/**
 * Renders the product cards from the state.products array into the main products container.
 */
function renderProducts() {
    productsContainer.innerHTML = ''; // Clear existing products
    if (!state.products || state.products.length === 0) {
        // Optionally display a "No products found" message here if needed
        return;
    }

    // Create and append card for each product
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for scroll animation
        productsContainer.appendChild(element);
    });

    // Set up scroll animations for the newly added cards
    setupScrollAnimations();
}


// --- Home Page Sections Rendering ---

/**
 * Renders a single row of shortcut cards.
 * @param {string} rowId - The ID of the shortcut row document.
 * @param {object} sectionNameObj - The multilingual name object for the section title.
 * @returns {Promise<HTMLElement|null>} - The section element or null if error/empty.
 */
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Row not found

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Get title in current language, fallback to Sorani from rowData or sectionNameObj
        const rowTitle = sectionNameObj[state.currentLanguage]
                         || (rowData.title && rowData.title[state.currentLanguage])
                         || (rowData.title && rowData.title.ku_sorani)
                         || sectionNameObj.ku_sorani;


        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        // Fetch cards for this row
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            return null; // Don't render empty rows
        }

        // Create and append each card
        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            // Navigate to the linked category/subcategory on click
            item.onclick = async () => {
                 // Navigate based on the most specific ID available
                 if (cardData.subcategoryId && cardData.categoryId) {
                     showSubcategoryDetailPage(cardData.categoryId, cardData.subcategoryId);
                 } else if (cardData.categoryId) {
                     await navigateToFilter({
                         category: cardData.categoryId,
                         subcategory: 'all',
                         subSubcategory: 'all',
                         search: ''
                     });
                 }
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

/**
 * Renders a horizontal row of products from a specific category/subcategory/subsubcategory.
 * @param {object} sectionData - Data from the home_layout document.
 * @returns {Promise<HTMLElement|null>} - The section element or null.
 */
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Default title from layout
    let targetDocRef; // Firestore ref to fetch the actual category name

    // Determine the most specific filter and the document to fetch name from
    if (subSubcategoryId && subcategoryId && categoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId && categoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else {
        console.warn("Single category row section is missing categoryId in layout config.");
        return null; // Cannot render without at least categoryId
    }

    try {
        // Attempt to fetch the actual category/sub name for a better title
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Use fetched name if available, otherwise fallback to layout name
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        // Create section container and header
        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Use potentially updated title
        header.appendChild(titleEl);

        // "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             // Navigate based on the most specific category ID defined in sectionData
            if (subcategoryId && categoryId) {
                 // Go to subcategory detail page
                 showSubcategoryDetailPage(categoryId, subcategoryId);
             } else if (categoryId) {
                 // Filter on main page for the main category
                 await navigateToFilter({
                     category: categoryId,
                     subcategory: 'all',
                     subSubcategory: 'all',
                     search: ''
                 });
             }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        // Horizontal product scroller
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Fetch products for this category/sub
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Filter by the determined field
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number of products shown horizontally
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

        // Render product cards
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
             // Ensure these products are in state.products
             if (!state.products.some(p => p.id === product.id)) {
                state.products.push(product);
            }
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row (${queryValue}):`, error);
        return null;
    }
}

/**
 * Renders a horizontal row of brand logos.
 * @param {string} groupId - The ID of the brand group document.
 * @returns {Promise<HTMLElement|null>} - The section element or null.
 */
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        // Fetch brands within the specified group
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

        // Render each brand item
        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;

            // Navigate to linked category/subcategory on click
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                     showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                 } else if(brand.categoryId) {
                     await navigateToFilter({
                         category: brand.categoryId,
                         subcategory: 'all',
                         subSubcategory: 'all',
                         search: ''
                     });
                 }
                 // If no category linked, clicking does nothing
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}


/**
 * Renders a horizontal row of the newest products.
 * @returns {Promise<HTMLElement|null>} - The section element or null.
 */
async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    // Optionally add a "See All" link specifically for newest products if needed
    container.appendChild(header);

    try {
        // Fetch products added within the last 15 days (adjust as needed)
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown horizontally
        );
        const snapshot = await getDocs(q);

        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Do not render if there are no new products
        } else {
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
                 // Ensure these products are in state.products
                if (!state.products.some(p => p.id === product.id)) {
                    state.products.push(product);
                }
            });
        }
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

/**
 * Renders a grid section showing a preview of all products on the home page.
 * @returns {Promise<HTMLElement|null>} - The section element or null.
 */
async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add space before this section

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Use existing grid style
    container.appendChild(productsGrid);

    try {
        // Fetch only a limited number of recent products for the home page preview
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Don't render if no products exist
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
             // Ensure these products are in state.products
            if (!state.products.some(p => p.id === product.id)) {
                state.products.push(product);
            }
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page preview:", error);
        return null;
    }
}


/**
 * Renders the dynamic sections on the home page based on Firestore configuration.
 */
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // --- Interval Cleanup ---
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object
        // --- End Interval Cleanup ---

        // Fetch enabled layout sections ordered by 'order'
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Optionally display a message if home page is empty
        } else {
            // Render each section based on its type
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID
                        } else { console.warn("Promo slider section is missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section is missing groupId."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        } else { console.warn("Single shortcut row section is missing rowId."); }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section is missing categoryId."); }
                        break;
                    case 'all_products':
                        // This section type might be implicitly handled by searchProductsInFirestore
                        // Or render a preview grid:
                         sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا.</p>`; // Translate
    } finally {
        skeletonLoader.style.display = 'none'; // Hide skeleton loader after rendering
        state.isRenderingHomePage = false;
    }
}


/**
 * Renders the promo card slider section for the home page.
 * Manages the automatic rotation interval specific to this section instance.
 * @param {string} groupId - The ID of the promo group.
 * @param {string} layoutId - The unique ID of this section instance from the home_layout collection.
 * @returns {Promise<HTMLElement|null>} - The section element or null.
 */
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for layout consistency
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID for this instance

    try {
        // Fetch cards for the specified group
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // State specific to this slider instance
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the card element (which includes image and buttons)
            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            // Set up automatic rotation if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still valid in the global state
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear this specific interval
                            // Clean up global state if necessary (though it should be cleared elsewhere too)
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element is gone or interval globally cleared
                    }
                    // Rotate index and update image source
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Clear any previous interval for this specific layout ID before starting a new one
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start the new interval and store its ID globally using the unique layoutId
                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize global store if needed
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid; // Return the created section element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}


/**
 * Fetches products based on filters/search, manages pagination and caching.
 * Also handles switching between home page sections and product grid view.
 * @param {string} [searchTerm=''] - The search term.
 * @param {boolean} [isNewSearch=false] - True if it's a new filter/search, false if loading more.
 */
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    // Determine if the full home page sections should be shown
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Show home sections, hide product grid/loaders
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none'; // Hide infinite scroll loader too
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render home content if it's not already rendered
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) { // Re-render if new search brings back to home
            await renderHomePageContent();
        }
        return; // Stop execution, home page is shown
    } else {
        // Hide home sections, prepare for product grid
        homeSectionsContainer.style.display = 'none';
        // --- Stop Promo Rotations ---
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object when leaving home view
        // --- End Stop Promo Rotations ---
    }

    // --- Product Fetching Logic ---

    // Cache key based on current filters and search
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;

    // If it's a new search and data exists in cache, use cached data
    if (isNewSearch && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts(); // Render from cache
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return; // Stop execution, rendered from cache
    }

    // Prevent concurrent loading
    if (state.isLoadingMoreProducts) return;

    // Reset state for a new search
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton for new search
    }

    // Stop if all products are already loaded for the current filter (when scrolling)
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show infinite scroll loader

    try {
        // --- Build Firestore Query ---
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

        // Apply search filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering (different based on search)
        if (finalSearchTerm) {
             // Order by name first when searching
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default order by creation date
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (start after last visible doc if loading more)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Limit results per page
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // --- Execute Query and Process Results ---
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Append or replace products in state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true; // All loaded for this filter
            scrollTrigger.style.display = 'none'; // Hide scroll trigger
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Show scroll trigger
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Update last visible doc

        // Update cache for new searches
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the products (either initial batch or appended)
        renderProducts();

        // Display "No products found" message if applicable
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>'; // Translate
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>'; // Translate
    } finally {
        state.isLoadingMoreProducts = false; // Reset loading flag
        loader.style.display = 'none'; // Hide infinite scroll loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product grid is visible
    }
}


// --- Cart Logic ---

/**
 * Adds a product to the cart or increments its quantity.
 * @param {string} productId - The ID of the product to add.
 */
function addToCart(productId) {
    // Find product in local state first
    const allFetchedProducts = [...state.products];
    let product = allFetchedProducts.find(p => p.id === productId);
    let productName = null;
    let productPrice = null;
    let productImage = '';

    if (product) {
        productName = product.name;
        productPrice = product.price;
        productImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    }

    const existingItem = state.cart.find(item => item.id === productId);

    if (existingItem) {
        // Increment quantity if item already in cart
        existingItem.quantity++;
        saveCart();
        showNotification(t('product_added_to_cart')); // Use translated message
    } else if (product) {
        // Add new item if found locally
        state.cart.push({ id: product.id, name: productName, price: productPrice, image: productImage, quantity: 1 });
        saveCart();
        showNotification(t('product_added_to_cart'));
    } else {
        // Fetch from Firestore if not found locally (e.g., added from related products not yet fully loaded)
        console.warn("Product not found locally for cart. Fetching...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                productImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                // Double-check if added concurrently
                const stillNotExisting = !state.cart.find(item => item.id === productId);
                if (stillNotExisting) {
                    state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: productImage, quantity: 1 });
                    saveCart();
                    showNotification(t('product_added_to_cart'));
                } else {
                    // If added concurrently, find it and increment
                    const concurrentItem = state.cart.find(item => item.id === productId);
                    if (concurrentItem) concurrentItem.quantity++;
                    saveCart();
                    showNotification(t('product_added_to_cart'));
                }
            } else {
                showNotification("ناتوانرێت زیاد بکرێت: کاڵا نەدۆزرایەوە", "error"); // Translate
            }
        }).catch(err => {
             console.error("Error fetching product to add to cart:", err);
             showNotification(t('error_generic'), "error");
        });
    }
}


/**
 * Renders the items in the shopping cart bottom sheet.
 */
function renderCart() {
    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        // Show empty cart message
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    // Hide empty message, show total and actions
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render WhatsApp/Viber buttons

    let total = 0;
    // Create element for each cart item
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get item name in current language
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو'); // Translate

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                <div>${t('total_price')}</div> <!-- Subtotal label -->
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    // Update total amount display
    totalAmount.textContent = total.toLocaleString();

    // Add event listeners to quantity and remove buttons
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/**
 * Updates the quantity of a product in the cart.
 * @param {string} productId - The ID of the product.
 * @param {number} change - The change in quantity (+1 or -1).
 */
function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            // Remove item if quantity drops to 0 or below
            removeFromCart(productId);
        } else {
            // Save and re-render cart
            saveCart();
            renderCart();
        }
    }
}

/**
 * Removes a product completely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // Re-render the cart UI
}

/**
 * Generates the order message string for sharing via WhatsApp/Viber etc.
 * @returns {string} - The formatted order message.
 */
function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // No message if cart is empty

    let message = t('order_greeting') + "\n\n"; // "Hello! I need the following items:"

    // Add each item details
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity }); // "Price: {price} IQD | Quantity: {quantity}"
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    // Add total price
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // "Total:"

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

/**
 * Renders the action buttons (e.g., Send via WhatsApp) in the cart.
 */
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    try {
        // Fetch available contact methods from Firestore
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order might not be necessary here
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>'; // Translate
            return;
        }

        // Create a button for each contact method
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class, specific styles handled inline or via type
            btn.className = 'whatsapp-btn'; // Reusing class for consistent styling initially
            btn.style.backgroundColor = method.color; // Apply custom color

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            // Set onclick handler to generate message and open link
            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return; // Don't proceed if cart is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                // Generate appropriate link based on method type
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber links need testing, especially '+' encoding
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Opens phone dialer
                        break;
                    case 'url': // For custom external links
                        link = value; // Assumes value is a full URL
                        break;
                }

                // Open the generated link
                if (link) {
                    window.open(link, '_blank'); // Open in new tab/app
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}


// --- Policies ---

/**
 * Fetches and renders the terms and policies content.
 */
async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading message
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Render content, replacing newlines with <br>
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`; // Show not found message
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show error message
    }
}

// --- Announcements ---

/**
 * Checks for new announcements and updates the notification badge.
 */
function checkNewAnnouncements() {
    // Query for the latest announcement
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // Listen for real-time updates
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get timestamp of the last seen announcement from local storage
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // Show badge if the latest announcement is newer than the last seen one
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
             notificationBadge.style.display = 'none'; // Hide if no announcements exist
        }
    }, (error) => {
         console.error("Error checking new announcements:", error); // Handle listener errors
         notificationBadge.style.display = 'none'; // Hide badge on error
    });
}


/**
 * Renders the list of announcements for the user in the notifications sheet.
 */
async function renderUserNotifications() {
    // Fetch all announcements, ordered by newest first
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    notificationsListContainer.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>`; // Show loading spinner

    try {
        const snapshot = await getDocs(q);
        notificationsListContainer.innerHTML = ''; // Clear spinner

        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        // Render each announcement item
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Track the timestamp of the newest announcement rendered
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            // Format date
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

            // Get title and content in current language (fallback to Sorani)
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> <!-- Replace newlines -->
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update the last seen timestamp in local storage
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        notificationBadge.style.display = 'none'; // Hide the badge

    } catch (error) {
        console.error("Error rendering user notifications:", error);
        notificationsListContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


// --- Contact/Social Links ---

/**
 * Renders the social media links in the settings page.
 */
function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    // Reference to the socialLinks subcollection
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order by creation time

    // Listen for real-time updates
    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>'; // Translate
            return;
        }

        // Create an element for each link
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani; // Get name in current language

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security measure
            linkElement.className = 'settings-item';

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> <!-- External link icon -->
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
        console.error("Error fetching contact links:", error);
        contactLinksContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    });
}


// --- Miscellaneous UI ---

/**
 * Shows the welcome message modal on the first visit.
 */
function showWelcomeMessage() {
    // Check if the user has visited before using local storage
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // Open the modal
        localStorage.setItem('hasVisited', 'true'); // Mark as visited
    }
}

/**
 * Sets up the functionality for the "Get Location via GPS" button in the profile sheet.
 */
function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn?.querySelector('span'); // Use optional chaining
    const originalBtnText = btnSpan?.textContent;

    if (!getLocationBtn || !profileAddressInput || !btnSpan) return; // Exit if elements not found

    getLocationBtn.addEventListener('click', () => {
        // Check if geolocation is supported
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error'); // Translate
            return;
        }

        // Update button state to indicate loading
        btnSpan.textContent = '...چاوەڕوان بە'; // Translate
        getLocationBtn.disabled = true;

        // Request current position
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
             enableHighAccuracy: true, // Request more accurate position if possible
             timeout: 10000, // Set timeout to 10 seconds
             maximumAge: 0 // Force fresh location data
        });
    });

    // Success callback for geolocation
    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Use Nominatim API for reverse geocoding (lat/lon to address)
            // Request Kurdish and English results
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            // Update address input if address found
            if (data && data.display_name) {
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success'); // Translate
            } else {
                profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە، تەنها شوێن وەرگیرا', 'error'); // Translate
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates on error
            showNotification('هەڵەیەک لە وەرگرتنی ناوی ناونیشان ڕوویدا', 'error'); // Translate
        } finally {
            // Reset button state
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    // Error callback for geolocation
    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; // Translate
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'شوێنەکەت نەدۆزرایەوە'; // Translate
                break;
            case error.TIMEOUT:
                message = 'کاتی داواکارییەکە تەواو بوو'; // Translate
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا'; // Translate
                break;
        }
        showNotification(message, 'error');
        // Reset button state
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


// --- Infinite Scroll ---

/**
 * Sets up the Intersection Observer to trigger loading more products when scrolling.
 */
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // If the trigger element is intersecting (visible)
        if (entries[0].isIntersecting) {
            // Check if on main page and not already loading/all loaded
            if (document.getElementById('mainPage').classList.contains('page-active') &&
                !state.isLoadingMoreProducts && !state.allProductsLoaded)
            {
                console.log("Scroll trigger intersected, loading more products...");
                searchProductsInFirestore(state.currentSearch, false); // Fetch next page of products
            }
        }
    }, {
        root: null, // Observe intersections relative to the viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger); // Start observing the trigger element
}


// --- Initialization ---

/**
 * Updates UI elements that depend on the category list being loaded.
 */
function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // Populate admin product form dropdown
    renderMainCategories(); // Render main category filter buttons
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
}

/**
 * Sets up all main event listeners for the application.
 */
function setupEventListeners() {
    // --- Bottom Navigation ---
    homeBtn.onclick = async () => {
         // If not already on main page, navigate there
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]); // Clean URL
            showPage('mainPage');
        }
        // Always reset filters when clicking home explicitly
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn'); // Keep profile button visually active
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn'); // Keep cart button visually active
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn'); // Keep categories button visually active
    };

    // --- Header ---
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser history for back navigation
    };

    // --- Popups ---
    sheetOverlay.onclick = () => closeCurrentPopup(); // Close on overlay click
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup); // Close buttons
    // Close modal on background click
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // --- Login ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Admin logic initialization happens via onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };

    // --- Search ---
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term }); // Update history and trigger search
    }, 500); // 500ms delay

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Trigger search with empty term
    };

    // --- Subpage Search Logic ---
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        // Only perform search if currently on the subcategory detail page
        if (document.getElementById('subcategoryDetailPage').classList.contains('page-active')) {
            const hash = window.location.hash.substring(1);
            if (hash.startsWith('subcategory_')) {
                const ids = hash.split('_');
                const subCatId = ids[2]; // Get parent subcategory ID from hash

                // Find the currently active sub-subcategory button on the detail page
                const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
                const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default to 'all'

                // Re-render products on the detail page with the search term
                await renderProductsOnDetailPage(subCatId, subSubCatId, term);
            }
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
        debouncedSubpageSearch(''); // Trigger search with empty term
    };


    // --- Settings Page ---
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    // Contact Us toggle
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
        chevron.classList.toggle('fa-chevron-down', !container.classList.contains('open'));
        chevron.classList.toggle('fa-chevron-up', container.classList.contains('open')); // Change icon direction
    };
    // Profile form submission
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile)); // Save profile
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Close profile sheet
    };
    // Language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });
    // Install PWA button
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompting
                state.deferredPrompt.prompt(); // Show install prompt
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear prompt
            }
        });
    }
    // Notifications button (header)
    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    // Terms & Policies button
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => openPopup('termsSheet'));
    }
    // Enable Notifications button
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }
    // Force Update button
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    // --- Firebase Messaging (Foreground) ---
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'New Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Show toast
        notificationBadge.style.display = 'block'; // Show badge
    });
}

// --- Authentication State ---
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Replace with your actual Admin User UID from Firebase Authentication
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Store admin status in session
        // Initialize admin-specific logic if the admin script is loaded
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Ensure DOM is ready before initializing admin UI elements
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                 window.AdminLogic.initialize();
            } else {
                 window.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
            }
        } else {
            console.warn("AdminLogic not found or initialize not a function. Ensure admin.js is loaded.");
        }
    } else {
        sessionStorage.removeItem('isAdmin'); // Remove admin status
        // If a non-admin user is signed in (shouldn't happen with email/pass), sign them out.
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // De-initialize admin UI elements if the admin script is loaded
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal automatically on successful admin login
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


// --- App Initialization ---

/**
 * Initializes the main application logic after DOM is loaded and Firestore persistence is attempted.
 */
function initializeAppLogic() {
    // Ensure sliderIntervals object exists in state
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories first, as they are needed for initial rendering and navigation
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani:'هەموو', name_ku_badini: 'هەمی', name_ar:'الكل' }, ...fetchedCategories]; // Add 'All' category

        // Update UI elements dependent on categories (dropdowns, filter buttons)
        updateCategoryDependentUI();

        // Now that categories are loaded, handle the initial page load based on URL
        handleInitialPageLoad(); // Parses URL, shows correct page/filters

        // Apply the initially determined language (might re-render some parts)
        setLanguage(state.currentLanguage);

    }, (error) => {
         console.error("Error fetching categories:", error);
         // Handle error, maybe show error message to user
         document.getElementById('mainCategoriesContainer').innerHTML = `<p>${t('error_generic')}</p>`;
         handleInitialPageLoad(); // Try to load page even if categories fail
         setLanguage(state.currentLanguage);
    });

    // Setup other parts of the app that don't strictly depend on categories finishing first
    updateCartCount(); // Initial cart count
    setupEventListeners(); // Setup all button clicks, search, etc.
    setupScrollObserver(); // Setup infinite scroll
    renderContactLinks(); // Fetch and display contact links in settings
    checkNewAnnouncements(); // Check for notification badge initially
    showWelcomeMessage(); // Show only on first visit
    setupGpsButton(); // Add GPS functionality
}


/**
 * Main entry point: Called after DOMContentLoaded. Attempts to enable Firestore persistence.
 */
function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately

    // Attempt to enable Firestore offline persistence
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
        })
        .catch((err) => {
            // Handle known reasons for failure gracefully
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            } else {
                 console.error("Error enabling persistence:", err);
            }
        })
        .finally(() => {
            // Initialize the rest of the app logic regardless of persistence success/failure
            initializeAppLogic();
        });
}

// --- Global Exports for Admin ---
// Expose necessary Firebase services and app functions to the admin.js script
Object.assign(window.globalAdminTools || {}, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore/Auth
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore, // UI/Logic functions
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Collections
    // Helper functions for admin logic to interact with app state/UI
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear product cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = ''; // Clear home page to force re-render
        // Optionally trigger a re-render if needed, depending on current view
        // if (document.getElementById('mainPage').classList.contains('page-active')) {
        //    searchProductsInFirestore(state.currentSearch, true);
        // }
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide categories array to admin
    getCurrentLanguage: () => state.currentLanguage, // Provide current language
    // Add any other functions admin.js needs to call from app-logic.js
});

// --- PWA Installation Prompt ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent default mini-infobar
    state.deferredPrompt = e; // Save the event
    // Show custom install button in settings
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
    console.log('`beforeinstallprompt` event fired.');
});


// --- Service Worker Update Handling ---
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        // Listen for updates found during registration check
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            // Listen for state changes on the new worker
            newWorker.addEventListener('statechange', () => {
                // If installed and a controller exists (meaning current page is controlled)
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Show the update notification bar
                    if(updateNotification) updateNotification.classList.add('show');
                }
            });
        });

        // Handle click on the "Update Now" button
        if (updateNowBtn) {
            updateNowBtn.addEventListener('click', () => {
                // Send message to the waiting worker to skip waiting
                 if (registration.waiting) {
                     registration.waiting.postMessage({ action: 'skipWaiting' });
                 }
                 if(updateNotification) updateNotification.classList.remove('show'); // Hide notification
            });
        }

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Listen for controllerchange (when the new SW takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload(); // Reload page to use the new service worker
    });
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', init);
ئەمە کودێ app-logic.js کودێ من درست نەکە هەتا ئەس بێشمە تە

