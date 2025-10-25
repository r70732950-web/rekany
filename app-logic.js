// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Bi veqetandina scroll-logic)

import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Ensure these are imported from app-setup
    translations, state, // state object needs sliderIntervals: {} added in app-setup.js
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

// Importên ji Firebase (ji ber ku dibe ku di guhertoya nû de kêm bibin, wan li vir bihêle)
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// Importên ji scroll-logic.js
import {
    saveScrollPosition,
    restoreScrollPosition,
    scrollToTop,
    initializeAnimationObserver,
    observeProductCardAnimations
} from './scroll-logic.js';


function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Function to update the header based on the current page
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

// Function to show a specific page and update history/header
function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        scrollToTop(); // Use imported function
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

// Function to close all modals and sheets
function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

// Function to open a modal or sheet
function openPopup(id, type = 'sheet') {
    saveScrollPosition(); // Use imported function
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

// Function to close the currently open popup
function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

// Function to apply the filter state (category, search, etc.)
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Render subcategories based on main category

    await searchProductsInFirestore(state.currentSearch, true); // Perform search/filter

    if (fromPopState) {
        restoreScrollPosition(filterState.scroll); // Use imported function
    } else if (!fromPopState) {
        scrollToTop('smooth'); // Use imported function
    }
}

// Function to navigate to a new filter state and update history
async function navigateToFilter(newState) {
    // Save current scroll before navigating
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY
    }, '');

    // Define the new state, resetting scroll
    const finalState = { ...history.state, ...newState, scroll: 0 };

    // Update URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the new state to history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI
    await applyFilterState(finalState);
}

// Handle browser back/forward navigation
window.addEventListener('popstate', async (event) => { // Guhertin bo async
    closeAllPopupsUI(); // Close any open popups first
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
        } else {
            // It's a filter state for the main page
            showPage('mainPage');
            applyFilterState(popState, true); // true indicates it's from popstate
        }
    } else {
        // No state, go back to default main page view
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});

// Handle the initial page load based on URL
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // The actual rendering will be triggered by onSnapshot in initializeAppLogic after categories load
    } else if (pageId === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageId, t('settings_title'));
    } else {
        // It's the main page, potentially with filters
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is 0
        };
        history.replaceState(initialState, ''); // Set initial history state
        applyFilterState(initialState); // Apply filters
    }

     // Check if a modal/sheet hash exists for the main page
     const element = document.getElementById(hash);
     if (element && pageId === 'mainPage') {
         const isSheet = element.classList.contains('bottom-sheet');
         const isModal = element.classList.contains('modal');
         if (isSheet || isModal) {
             openPopup(hash, isSheet ? 'sheet' : 'modal');
         }
     }

     // Check if a specific product should be shown
    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // Delay slightly
    }
}

// Get translation based on current language
function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

// Set application language and update UI
function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

    // Update all elements with data-translate-key
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

    // Update active language button style
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

     // Rerender dynamic content that depends on language
     const homeContainer = document.getElementById('homePageSectionsContainer');
     if (homeContainer) {
         homeContainer.innerHTML = ''; // Clear home content to force re-render with new language
     }

     // Determine if currently in home view or filtered view
     const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
     if (isHomeView) {
         renderHomePageContent(); // Rerender home page sections
     } else {
         renderProducts(); // Rerender product list if filtered/searched
     }

     renderMainCategories(); // Rerender main category buttons
     renderCategoriesSheet(); // Rerender category sheet content
     if (document.getElementById('cartSheet').classList.contains('show')) renderCart(); // Rerender cart if open
     if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage(); // Rerender favorites if open
}

// Force update by clearing cache and service worker
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

// Function to update the contact links section in settings (remains the same)
function updateContactLinksUI() {
    if (!state.contactInfo) return;
    // ... logic to render contact links based on state.contactInfo ...
    // This seems to be handled by renderContactLinks, so this function might be redundant
}

// Update the active state of the bottom navigation bar
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Format product description (handling links and newlines)
function formatDescription(text) {
    if (!text) return '';
    // Escape HTML characters
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Find URLs and make them clickable links
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Replace newlines with <br> tags
    return textWithLinks.replace(/\n/g, '<br>');
}

// Request permission for push notifications
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
                await saveTokenToFirestore(currentToken); // Save token to Firestore
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

// Save FCM token to Firestore
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy lookup/uniqueness
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now() // Store timestamp for potential cleanup later
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

// Save favorites list to local storage
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

// Check if a product is in the favorites list
function isFavorite(productId) {
    return state.favorites.includes(productId);
}

// Toggle a product's favorite status
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

    // Update heart icon on all cards for this product
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming Font Awesome icon
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle Font Awesome classes for filled/empty heart
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular (outline) heart
        }
    });

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

// Render the favorites page/sheet content
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

        favoritesContainer.innerHTML = ''; // Clear skeleton loader

        // Filter out products that might have been deleted
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // Handle case where all favorited products were deleted
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product); // Reuse card creation logic
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


// Save cart data to local storage and update count
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

// Update the cart item count badge
function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

// Show a temporary notification message
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`; // Apply type class (success/error)
    notification.textContent = message;
    document.body.appendChild(notification);
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    // Animate out and remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300); // Remove after fade out
    }, 3000);
}

// Populate the category dropdown in the product form
function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>'; // Default option
    // Filter out the 'all' category placeholder
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Display name in current language or fallback
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

// Render the categories list in the bottom sheet
function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); } // Highlight active category

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Get translated "All" label
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Get translated category name

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`; // Add icon and name

        btn.onclick = async () => {
            // Navigate to the selected category filter on the main page
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
            closeCurrentPopup(); // Close the sheet
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}


async function renderSubSubcategories(mainCatId, subCatId) {
    // This function is no longer needed on the main page for sub-subcategories.
    // Sub-subcategories are handled on the subcategory detail page.
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden
}

// Show the detail page for a specific subcategory
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
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
        subCatName = 'Details'; // Fallback title
    }

    // Push state to history if not navigating from history (back/forward)
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    // Show the subcategory detail page UI
    showPage('subcategoryDetailPage', subCatName);

    // Get references to page elements
    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Show loader and clear previous content
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';

    // Clear search input on this page
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render the sub-subcategory filter buttons and initial product list
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Initially show all products in this subcategory

    // Hide loader after content is loaded
    loader.style.display = 'none';
}

// Render the sub-subcategory filter buttons on the detail page
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Clear previous buttons

    try {
        // Query sub-subcategories within the current subcategory
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories exist
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Create "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Active by default
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Identifier for the "All" button
        allBtn.onclick = () => {
            // Deactivate other buttons, activate this one
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            // Re-render products for 'all' sub-subcategories, keeping current search term
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        // Create buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Store ID for filtering
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent pixel
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                 // Deactivate other buttons, activate this one
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                 // Re-render products filtered by this sub-subcategory, keeping current search term
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}

// Render products on the subcategory detail page based on filters
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query: filter by subcategory ID
        if (subSubCatId === 'all') {
            // If "All" sub-subcategory is selected, filter only by subcategory
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            // Otherwise, filter by the specific sub-subcategory ID
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term filter if provided
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff') // Firestore prefix search
            );
             // If searching, first orderBy must match the inequality field ('searchableName')
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // If not searching, order by creation date (newest first)
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>'; // No products message
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Create card element
                productsContainer.appendChild(card);
            });
             observeProductCardAnimations(); // Apply animations to newly added cards
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>'; // Error message
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}

// Render subcategory filter buttons (now only used for product form dropdown)
async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear existing buttons
    subcategoriesContainer.style.display = 'none'; // Hide this container on the main page now

    // The logic to populate the dropdown in the admin form remains in AdminLogic.populateSubcategoriesDropdown
}


// Render main category filter buttons
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous buttons

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight active category
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            // Navigate to filter by this main category
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
        };

        container.appendChild(btn);
    });
}

// Show product details in the bottom sheet (triggered by card click)
function showProductDetails(productId) {
    // Find product in already fetched list or fetch if not found
    const allFetchedProducts = [...state.products]; // Combine home page sections and main list
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found locally for details view. Fetching from Firestore...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Show details with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
            console.error("Error fetching product details:", err);
            showNotification(t('error_generic'), 'error');
        });
        return;
    }
    // If found locally, show details immediately
    showProductDetailsWithData(product);
}

// Render related products section in the product detail sheet
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the category level to query for related products
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q; // Firestore query
    if (currentProduct.subSubcategoryId) {
        // Find others in the same sub-subcategory
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Exclude the current product
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
         // Find others in the same subcategory
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
             where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
         // Find others in the same main category
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
             where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Create card
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the related products section

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

// Populate and show the product detail sheet with product data
function showProductDetailsWithData(product) {
    // Reset scroll position of the sheet content
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // Get product details in the current language
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Combine image URLs from array or single image field
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // Get image slider elements
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = ''; // Clear previous images
    thumbnailContainer.innerHTML = ''; // Clear previous thumbnails

    // Populate image slider and thumbnails
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
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // First thumbnail is active
            thumb.dataset.index = index; // Store index for click handling
            thumbnailContainer.appendChild(thumb);
        });
    }

    // Image slider logic
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Boundary check
        // Deactivate all images and thumbnails
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        // Activate the selected one
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index; // Update current index
    }

    // Show/hide slider buttons based on image count
    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

    // Add event listeners for slider controls
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length); // Previous image
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length); // Next image
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index))); // Thumbnail click

    // Populate other product details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    // Display price (with discount if applicable)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        // Show discounted price and original price
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

    // Open the product detail sheet
    openPopup('productDetailSheet');
}


// Function to create a promo card element (remains mostly the same, uses sliderState passed in)
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Reuse product-card styles for consistency
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ignore clicks on slider buttons
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 // Navigate to the linked category
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                // Optionally scroll to categories section
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    // Add event listeners for slider buttons if multiple cards exist
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
        });
    }

    return cardElement;
}

// Function to create the HTML element for a single product card
function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card'; // Base class
    productCard.dataset.productId = product.id; // Store product ID
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Get name and image URL, handling potential missing data and language fallbacks
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Prepare price display HTML, including discount badge if applicable
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`; // Discount badge
    }

    // Prepare extra info badge (e.g., shipping) HTML
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    // Determine favorite button state and icon class
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid or outline heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct the card's inner HTML
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

    // Add event listener for the share button
    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent card click
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
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
                    showNotification('لينكى کاڵا کۆپى کرا!', 'success'); // Translate if needed
                } catch (err) {
                    showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); // Translate if needed
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') { // Ignore if user cancels share sheet
                  showNotification(t('share_error'), 'error');
             }
        }
    });

    // Add main click listener for the card (delegates actions)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Re-check admin status

        if (addToCartButton) {
            // Add to cart action
            addToCart(product.id);
            // Provide visual feedback on button
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Success state
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent; // Restore original state
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            // Admin edit action
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            // Admin delete action
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            // Toggle favorite action
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Share action (already handled by its own listener)
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            // Default action: Show product details
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}


// Render the skeleton loader UI
function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear previous skeletons
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `; // Shimmer effect applied via CSS
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid layout
    // Hide actual products and loading indicator while skeleton is shown
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}

// Render the list of products
function renderProducts() {
    productsContainer.innerHTML = ''; // Clear existing products first
    if (!state.products || state.products.length === 0) {
        return; // Do nothing if no products to render
    }

    // Create and append card elements for each product
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    observeProductCardAnimations(); // Use imported function to apply animations
}


// --- Functions related to rendering specific home page sections ---

// Render a single row of shortcut cards
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Don't render if row doesn't exist

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Get title in current language or fallback
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        // Add section title
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        // Add container for cards
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

        // Create and add each card element
        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            // Set click handler to navigate to the linked category/filter
            item.onclick = async () => {
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

// Render a single horizontal row of products from a specific category
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Default title from layout
    let targetDocRef; // Reference to fetch category name

    // Determine the most specific category level to filter by and fetch name from
    if (subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else {
        return null; // Cannot render without a category ID
    }

    try {
        // Fetch the actual category/subcategory name for a more accurate title
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

        // Add "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID provided in sectionData
            if(subcategoryId) {
                 // If subcategory or subsubcategory is specified, go to the subcategory detail page
                 showSubcategoryDetailPage(categoryId, subcategoryId);
            } else {
                 // If only main category is specified, filter on the main page
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

        // Create horizontal scroller for products
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Fetch products for this category row (limit 10 for home page)
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Filter by the determined category level
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

        // Add product cards to the scroller
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}


// Render a horizontal row of brand logos
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID for potential multiple brand sections
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        // Fetch brands from the specified group
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

        // Create and add each brand item
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

            // Set click handler to navigate to the linked category
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                    // Go to subcategory detail page if specified
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                    // Filter main page by main category if specified
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

// Render a horizontal row of the newest products (added within last 15 days)
async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000); // Timestamp 15 days ago
        // Query products created after this timestamp
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit to 10 for home page row
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
            });
        }
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

// Render a grid section showing a preview of all products (newest first)
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
        // Fetch only a limited number of products for the home page preview
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Don't render if no products exist
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

// Render the entire home page content based on the configured layout
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton while loading
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clear existing slider intervals before rendering new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object

        // Fetch the enabled home page layout sections, ordered correctly
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Optionally display a message to the user
        } else {
            // Iterate through layout sections and render each one
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                // Call the appropriate rendering function based on section type
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
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                // Append the rendered section element to the container
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا.</p>`;
    } finally {
        state.isRenderingHomePage = false; // Reset rendering flag
    }
}


// Fetch products from Firestore based on current filters and search term
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // Toggle between home page sections and product list view
    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none'; // Hide infinite scroll trigger
        homeSectionsContainer.style.display = 'block'; // Show home sections

        // Render home content if it's not already rendered
        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        }
        return; // Stop here if showing home page
    } else {
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        // Stop all promo slider intervals when leaving the home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object
    }

    // --- Product Fetching Logic ---

    // Check cache first for new searches
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        // Load from cache if available
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts(); // Render cached products
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Show/hide trigger
        return;
    }

    // Prevent concurrent loading
    if (state.isLoadingMoreProducts) return;

    // Reset state for a new search/filter
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton for new search
    }

    // Stop if all products are already loaded for the current filter
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show loading indicator at the bottom

    try {
        let productsQuery = collection(db, "products"); // Base query

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        // Subcategory filtering is now handled by navigating to the detail page
        // Sub-subcategory filtering is now handled on the detail page


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
            // Order by relevance (searchableName) then date when searching
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Order by date (newest first) when browsing/filtering categories
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (start after the last fetched document)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Limit results per page
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Execute query
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Append or replace product list
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true; // No more products to load
            scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // More products might exist
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Store last doc for next page

        // Cache results for new searches
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the updated product list
        renderProducts();

        // Show message if no products found for a new search
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>'; // Error message
    } finally {
        state.isLoadingMoreProducts = false; // Reset loading flag
        loader.style.display = 'none'; // Hide bottom loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product grid is visible
    }
}

// Add a product to the cart
function addToCart(productId) {
    // Find product in local state first
    const allFetchedProducts = [...state.products]; // Combine potential sources
    let product = allFetchedProducts.find(p => p.id === productId);

    // If not found locally, fetch from Firestore (limited data)
    if (!product) {
        console.warn("Product not found in local state. Fetching minimal data for cart.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                // Add to cart logic (check existing, update quantity or add new)
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++;
                } else {
                    state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 });
                }
                saveCart(); // Save and update count
                showNotification(t('product_added_to_cart')); // Show confirmation
            } else {
                showNotification(t('product_not_found_error'), 'error'); // Product deleted?
            }
        }).catch(err => {
            console.error("Error fetching product for cart:", err);
            showNotification(t('error_generic'), 'error');
        });
        return;
    }

    // If found locally, proceed with adding to cart
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++; // Increment quantity
    } else {
        // Add new item to cart
        state.cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 });
    }
    saveCart(); // Save and update count
    showNotification(t('product_added_to_cart')); // Show confirmation
}

// Render the cart items and total in the cart sheet
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
    // Create and append elements for each cart item
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get item name in current language or fallback
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

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
                <div>${t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    // Update total amount display
    totalAmount.textContent = total.toLocaleString();
    // Add event listeners for quantity and remove buttons
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

// Update quantity of an item in the cart
function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Remove if quantity reaches 0
        } else {
            saveCart(); // Save changes
            renderCart(); // Re-render cart UI
        }
    }
}

// Remove an item from the cart
function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId); // Filter out the item
    saveCart(); // Save changes
    renderCart(); // Re-render cart UI
}

// Generate the order message for WhatsApp/Viber etc.
function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // No message if cart is empty
    let message = t('order_greeting') + "\n\n"; // Start with greeting
    // Add each item details
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // Add total

    // Add user profile info if available
    if (state.userProfile.name && state.userProfile.address && state.userProfile.phone) {
        message += `\n${t('order_user_info')}\n`;
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
    } else {
        // Prompt user to add info if missing
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

// Render the action buttons (WhatsApp, Viber, etc.) in the cart
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    // Fetch available contact methods from Firestore
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt")); // Order might need adjustment

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>'; // No methods configured message
        return;
    }

    // Create a button for each method
    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        // Use a generic class, specific styles handled by inline style
        btn.className = 'whatsapp-btn'; // Consider renaming class if needed
        btn.style.backgroundColor = method.color; // Set button color

        // Get button text in current language
        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Add icon and text

        // Set click handler to generate message and open link
        btn.onclick = () => {
            const message = generateOrderMessage();
            if (!message) return; // Don't proceed if message is empty

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value; // Phone number, username, or URL

            // Generate appropriate link based on method type
            switch (method.type) {
                case 'whatsapp':
                    link = `https://wa.me/${value}?text=${encodedMessage}`;
                    break;
                case 'viber':
                    // Viber chat link format (may require testing on different devices)
                    link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                    break;
                case 'telegram':
                    link = `https://t.me/${value}?text=${encodedMessage}`;
                    break;
                case 'phone':
                    link = `tel:${value}`; // Opens phone dialer
                    break;
                case 'url': // For custom external order forms/links
                    link = value; // Assume 'value' is the full URL
                    break;
            }

            // Open the generated link in a new tab/app
            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
}

// Render the Terms & Policies content in its sheet
async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Loading message
    try {
        const docRef = doc(db, "settings", "policies"); // Document reference
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language or fallback to Sorani
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content, replacing newlines with <br>
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Show message if no policies are found
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Error message
    }
}

// Check for new announcements and show notification badge
function checkNewAnnouncements() {
    // Query the latest announcement by creation time
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // Listen for real-time updates
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get the timestamp of the last announcement the user saw
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // If the latest announcement is newer than the last seen, show the badge
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
}

// Render the list of announcements for the user in the notifications sheet
async function renderUserNotifications() {
    // Fetch all announcements, newest first
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = ''; // Clear previous list
    if (snapshot.empty) {
        // Show message if no notifications exist
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0; // Track the newest announcement timestamp
    // Create elements for each announcement
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt; // Update latest timestamp
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`; // Format date

        // Get title and content in current language or fallback
        const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${title}</span>
                <span class="notification-date">${formattedDate}</span>
            </div>
            <p class="notification-content">${content}</p>
        `;
        notificationsListContainer.appendChild(item);
    });

    // Update the last seen timestamp in local storage
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    // Hide the notification badge since the user has now seen the latest
    notificationBadge.style.display = 'none';
}

// Render social media links in the settings page contact section
function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order might need adjustment

    // Listen for real-time updates to social links
    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            // Show message if no links are configured
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        // Create elements for each social link
        snapshot.forEach(doc => {
            const link = doc.data();
            // Get name in current language or fallback
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security measure
            linkElement.className = 'settings-item'; // Reuse settings item style

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> <!-- External link icon -->
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    });
}

// Show welcome modal on the user's first visit
function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) { // Check if 'hasVisited' flag exists
        openPopup('welcomeModal', 'modal'); // Show modal
        localStorage.setItem('hasVisited', 'true'); // Set flag
    }
}

// Set up the GPS button functionality in the profile sheet
function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn?.querySelector('span'); // Use optional chaining
    if (!getLocationBtn || !btnSpan) return; // Exit if elements not found

    const originalBtnText = btnSpan.textContent;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error'); // Translate if needed
            return;
        }

        // Provide user feedback
        btnSpan.textContent = '...چاوەڕوان بە'; // Translate if needed
        getLocationBtn.disabled = true;

        // Request location
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    // Success callback for geolocation
    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Use Nominatim (OpenStreetMap) for reverse geocoding (lat/lon to address)
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            if (data && data.display_name) {
                profileAddressInput.value = data.display_name; // Set address input value
                showNotification('ناونیشان وەرگیرا', 'success'); // Translate if needed
            } else {
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error'); // Translate if needed
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error'); // Translate if needed
        } finally {
            // Restore button state
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    // Error callback for geolocation
    function errorCallback(error) {
        let message = '';
        // Provide user-friendly error messages based on error code
        switch (error.code) {
            case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break; // Translate
            case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break; // Translate
            case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break; // Translate
            default: message = 'هەڵەیەکی نادیار ڕوویدا'; break; // Translate
        }
        showNotification(message, 'error');
        // Restore button state
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

// Set up Intersection Observer for infinite scrolling (kept in app-logic.js)
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // If the trigger element is intersecting (visible)
        if (entries[0].isIntersecting) {
            // Load more products if not already loading and not all loaded
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // false indicates it's not a new search, load next page
                searchProductsInFirestore(state.currentSearch, false);
            }
        }
    }, {
        root: null, // Observe relative to the viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger); // Start observing the trigger element
}

// Update UI elements that depend on the categories list (e.g., dropdowns)
function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // Populate product form dropdown
    renderMainCategories(); // Render main category filter buttons
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns(); // Update admin form dropdowns
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update shortcut card form dropdowns
    }
}

// Set up all major event listeners for UI interactions
function setupEventListeners() {
    // Bottom navigation clicks
    homeBtn.onclick = async () => {
        // Go to main page and reset filters
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };
    settingsBtn.onclick = () => {
        // Go to settings page
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };
    profileBtn.onclick = () => {
        openPopup('profileSheet'); // Open profile sheet
        updateActiveNav('profileBtn');
    };
    cartBtn.onclick = () => {
        openPopup('cartSheet'); // Open cart sheet
        updateActiveNav('cartBtn');
    };
    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet'); // Open categories sheet
        updateActiveNav('categoriesBtn');
    };

    // Header back button
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser history back
    };

    // Settings page links
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); }; // Open favorites
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); }; // Open admin login

    // Popup closing mechanisms
    sheetOverlay.onclick = () => closeCurrentPopup(); // Click outside sheet
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup); // Click close button
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Click outside modal

    // Admin login form submission
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Attempt sign-in
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Success handled by onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error'); // Show login error
        }
    };

    // Main search input handling (debounced)
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term }); // Update filter state with search term
    }, 500); // 500ms delay

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Clear input
        clearSearchBtn.style.display = 'none'; // Hide clear button
        navigateToFilter({ search: '' }); // Reset search filter
    };

    // Subpage search handling (debounced)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
         // Check if on subcategory detail page
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2]; // Get subcategory ID from hash

            // Find the currently active sub-subcategory filter button
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default to 'all'

            // Re-render products on the detail page with the new search term
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
        }
    }, 500); // 500ms delay

    subpageSearchInput.oninput = () => {
        const searchTerm = subpageSearchInput.value;
        subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSubpageSearch(searchTerm);
    };

    subpageClearSearchBtn.onclick = () => {
        subpageSearchInput.value = ''; // Clear input
        subpageClearSearchBtn.style.display = 'none'; // Hide clear button
        debouncedSubpageSearch(''); // Trigger search with empty term
    };


    // Contact section toggle in settings
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open'); // Toggle visibility
        chevron.classList.toggle('open'); // Toggle chevron icon direction
    };


    // Profile form submission
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        // Save profile data to state and local storage
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success'); // Show confirmation
        closeCurrentPopup(); // Close profile sheet
    };

    // Language selection buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang); // Set language on click
        };
    });

    // PWA Install button (if available)
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompting
                state.deferredPrompt.prompt(); // Show install prompt
                const { outcome } = await state.deferredPrompt.userChoice; // Wait for user choice
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear the saved prompt
            }
        });
    }

    // Notifications button
    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet'); // Open notifications sheet
    });

    // Terms & Policies button
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet'); // Open terms sheet
        });
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

    // Listen for Firebase Cloud Messages when app is in foreground
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        // Show notification to user
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        // Optionally update the badge immediately
        notificationBadge.style.display = 'block';
    });
}

// Handle authentication state changes
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Replace with your actual Admin User ID from Firebase Auth
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Store admin status in session
        // Initialize admin-specific logic if available
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Wait for page load if not already complete
             if (document.readyState === 'complete') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize);
             }
        } else {
             console.warn("AdminLogic not found or initialize function missing.");
        }
    } else {
        sessionStorage.removeItem('isAdmin'); // Remove admin status
        // If a non-admin user is somehow signed in, sign them out
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // Deinitialize admin UI elements if admin logic is available
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal automatically if admin logs in successfully
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


// Main initialization function called on DOMContentLoaded
function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately

    // Attempt to enable Firestore offline persistence
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Proceed with app logic
        })
        .catch((err) => {
            // Handle specific errors for persistence failure
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode:", err);
            initializeAppLogic(); // Proceed even if persistence fails
        });
}

// Initialize core application logic (called after persistence setup attempt)
function initializeAppLogic() {
     // Ensure sliderIntervals object exists in state
     if (!state.sliderIntervals) {
         state.sliderIntervals = {};
     }

    // Fetch categories and set up initial UI based on them
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    // Listen for real-time category updates
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add the "All" category option
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories];
        updateCategoryDependentUI(); // Update UI elements dependent on categories

        // Handle initial page load/routing *after* categories are loaded
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            // If hash indicates subcategory detail page, render it
            const ids = hash.split('_');
            const mainCatId = ids[1];
            const subCatId = ids[2];
            // Ensure categories are loaded before showing detail page
            if (state.categories.length > 1) { // Check if more than just 'all' exists
                showSubcategoryDetailPage(mainCatId, subCatId, true); // true = from history/load
            }
        } else {
            // Otherwise, handle main page filters or other hashes
            handleInitialPageLoad();
        }

        // Apply language after categories are loaded to ensure names are available
        setLanguage(state.currentLanguage);
    });

    // Setup other parts of the app
    updateCartCount(); // Initial cart count
    setupEventListeners(); // Set up UI interactions
    setupScrollObserver(); // Set up infinite scroll observer ** (Kept in app-logic.js) **
    initializeAnimationObserver(); // Set up animation observer ** (Imported from scroll-logic.js) **
    setLanguage(state.currentLanguage); // Apply initial language
    renderContactLinks(); // Fetch and display contact links
    checkNewAnnouncements(); // Check for notification badge
    showWelcomeMessage(); // Show only on first visit
    setupGpsButton(); // Add GPS functionality
}

// Expose necessary functions/variables for admin.js via global object
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Pass collections

    // Helper functions for admin logic
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Clear home page to force re-render
        }
        // Optionally trigger a re-render if needed
        // searchProductsInFirestore(state.currentSearch, true);
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide categories to admin
    getCurrentLanguage: () => state.currentLanguage // Provide language to admin
});

// Start the application initialization process when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// --- PWA and Service Worker Logic ---

// Listen for the PWA install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent default browser install prompt
    state.deferredPrompt = e; // Save the event for later use
    // Show custom install button in settings
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
    console.log('`beforeinstallprompt` event fired.');
});


// Service Worker registration and update handling
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        // Listen for updates found for the service worker
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            // Listen for state changes in the new worker
            newWorker.addEventListener('statechange', () => {
                // If the new worker is installed and waiting to activate
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Show the update notification bar
                    updateNotification.classList.add('show');
                }
            });
        });

        // Event listener for the "Update Now" button in the notification bar
        updateNowBtn.addEventListener('click', () => {
            // Tell the waiting service worker to skip waiting and activate
            if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Listen for the controllerchange event (when a new SW takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page to use the new service worker
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}
