// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی ونبوونی سکڕۆڵ)

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

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";


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

// ** CHAKKIRÎ: Fonksiyon hate guhertin da ku scrollToCheck bişîne searchProductsInFirestore **
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Render category UI first
    renderMainCategories();
    await renderSubcategories(state.currentCategory); // Render subcategories based on the main category

    // !! LÊZÊDEKIRÎ: Nirxa scrollê ya pêwîst destnîşan bike !!
    const scrollToCheck = (fromPopState && typeof filterState.scroll === 'number') ? filterState.scroll : null;

    // Trigger product search/rendering, passing the scroll value
    // !! CHAKKIRÎ: scrollToCheck wekî argument hate zêdekirin !!
    await searchProductsInFirestore(state.currentSearch, true, scrollToCheck);

    // !! CHAKKIRÎ: Bloka if ji bo scrollTo hate rakirin/guhertin !!
    // Scroll to top only for *new* filter actions, not when coming back via popstate
    if (!fromPopState) {
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


async function navigateToFilter(newState) {
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY // Save current scroll before navigating
    }, '');

    const finalState = { ...history.state, ...newState, scroll: 0 }; // New state scroll is 0 initially

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl); // Push the new filter state

    await applyFilterState(finalState, false); // Apply the new filter state (not from popstate)
}

window.addEventListener('popstate', async (event) => { // Guhertin bo async
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
            applyFilterState(popState, true); // Apply the popped state, indicating it's from history
        }
    } else { // No state, likely initial load or going back beyond app history
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState); // Apply default state
    }
});

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // The actual rendering will be triggered by onSnapshot in initializeAppLogic AFTER categories load
    } else if (pageId === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageId, t('settings_title'));
    } else { // mainPage
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is 0
        };
        history.replaceState(initialState, ''); // Replace history, don't push
        // Apply filter state will be called after categories load in initializeAppLogic
    }

    // Handle opening popups from hash, only if on main page initially
    const element = document.getElementById(hash);
    if (element && pageId === 'mainPage') {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            // Delay slightly to ensure main page content is rendering
            setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
        }
    }

    // Handle opening product detail from query param
    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // Delay to allow initial rendering
    }
}


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

    // Re-render dynamic content based on the new language
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear home content to force re-render with new lang
    }

    // Check current view and re-render appropriate content
    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isHomeView) {
        renderHomePageContent(); // Re-render home content
    } else {
        renderProducts(); // Re-render product list (assuming state.products is still correct)
    }

    renderMainCategories(); // Update main category buttons
    renderCategoriesSheet(); // Update categories sheet
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart(); // Update cart if open
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage(); // Update favorites if open
    // Admin dropdowns might also need updating if admin panel is visible
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
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

function updateContactLinksUI() {
    // This function seems unused currently, might be for future use.
    if (!state.contactInfo) return;
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
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}

async function requestNotificationPermission() {
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
            createdAt: Date.now()
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Prevent card click

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    // Update heart icon on all cards with this product ID
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Target the icon directly
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite; // The new state
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorited
            heartIcon.classList.toggle('far', !isNowFavorite); // Outline heart if not
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
    favoritesContainer.style.display = 'grid'; // Ensure grid layout is used

    renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while fetching

    try {
        // Fetch details for each favorited product
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Only include products that still exist
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // Handle case where favorited products were deleted
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
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`; // Show error message
    }
}


function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
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
        // Remove from DOM after transition
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function populateCategoryDropdown() {
    // Populate the dropdown in the 'Add/Edit Product' modal
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>'; // Default option
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // Exclude 'All'
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Use name in current language, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    // Render the category list in the bottom sheet popup
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        // Highlight the currently active category
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate 'All'
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang name

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             // Navigate to the selected category filter
             await navigateToFilter({
                 category: cat.id,
                 subcategory: 'all', // Reset subcategory when main category changes
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search
             });
             closeCurrentPopup(); // Close the sheet after selection
             showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// This function is no longer needed on the main page, handled by detail page logic.
// async function renderSubSubcategories(mainCatId, subCatId) {
//     subSubcategoriesContainer.innerHTML = '';
// }

async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        // Fetch the subcategory name for the header title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
    }

    // Push state only if navigating forward, not when coming back from history
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the detail page and update header

    const loader = document.getElementById('detailPageLoader');
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Show loader and clear previous content
    loader.style.display = 'block';
    productsContainerDetail.innerHTML = '';
    subSubContainer.innerHTML = '';

    // Clear the search input specific to this page
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render the sub-subcategories and products for this subcategory
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Initially show all products for this subcategory

    loader.style.display = 'none'; // Hide loader after content is loaded
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // If no sub-subcategories exist, hide the container
        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Create and add the 'All' button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active initially
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Identifier for the 'All' button
        allBtn.onclick = () => {
            // Deactivate other buttons, activate 'All'
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            // Re-render products for the parent subcategory ('all' sub-sub)
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
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                // Deactivate other buttons, activate this one
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                // Re-render products filtered by this sub-subcategory
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide if error occurs
    }
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block'; // Show loader
    productsContainerDetail.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query: Filter by parent subcategory OR specific sub-subcategory
        if (subSubCatId === 'all') {
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term if provided
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // If searching, first orderBy must match inequality field
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // If not searching, order by creation date
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainerDetail.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}


async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous

    // Don't render subcategories if 'All' main categories is selected
    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide the container
        return;
    }
    subcategoriesContainer.style.display = 'flex'; // Show the container

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // If no subcategories, hide the container
        if (state.subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none';
            return;
        }

        // Create 'All' button for subcategories (navigates to the subcategory detail page for the parent category)
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = async () => {
             // Navigate back to the parent category view on the main page
             await navigateToFilter({
                 subcategory: 'all',
                 subSubcategory: 'all'
             });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Create buttons for each subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;
            subcatBtn.onclick = () => {
                 // Navigate to the detail page for this subcategory
                 showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide if error
    }
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Highlight the active main category
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate 'All'
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang name

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

function showProductDetails(productId) {
    const allFetchedProducts = [...state.products]; // Combine initial and potentially loaded more products
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found locally. Fetching from Firestore...");
        // Fetch from Firestore if not found locally
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Show details with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        });
        return;
    }
    showProductDetailsWithData(product); // Show details with locally found data
}


async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous
    section.style.display = 'none'; // Hide initially

    // Determine the most specific category to query by
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        // Query by sub-subcategory, excluding the current product
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Exclude self using document ID
            limit(6) // Limit results
        );
    } else if (currentProduct.subcategoryId) {
        // Query by subcategory
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
        // Query by main category
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
            return; // Don't show the section if no related products
        }

        // Render each related product
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


function showProductDetailsWithData(product) {
    // Scroll sheet content to top
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // Get product name and description in the current language (fallback to Sorani)
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Get image URLs, handle older structure (single image field)
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

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
            if (index === 0) img.classList.add('active'); // Activate first image
            imageContainer.appendChild(img);

            // Create thumbnail element
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // Activate first thumbnail
            thumb.dataset.index = index; // Store index for click handling
            thumbnailContainer.appendChild(thumb);
        });
    }

    // Setup slider controls
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Boundary check
        // Deactivate all images/thumbnails
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
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length); // Previous (wrap around)
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length); // Next (wrap around)
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index))); // Click thumbnail

    // Populate product details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Format description (links, line breaks)

    // Populate price (handle discounts)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        // Show discounted price and original price (strikethrough)
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        // Show regular price
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Setup "Add to Cart" button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close sheet after adding
    };

    // Render related products based on the current product
    renderRelatedProducts(product);

    // Open the product detail sheet
    openPopup('productDetailSheet');
}

// Function to create promo card element (now takes sliderState)
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
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
        // Use currentCard from the closure
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
                // Optionally scroll to the category section
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl; // Update image source
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl; // Update image source
        });
    }

    return cardElement;
}


function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // Get name and image, with fallbacks
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Prepare price and discount badge HTML
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // Prepare shipping info badge HTML
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

    // Prepare favorite button state
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid or outline heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct the card HTML
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
                    showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                } catch (err) {
                    showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
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


    // Add event listener for the entire card (delegates actions)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Check current admin status

        if (addToCartButton) {
            // Handle add to cart with feedback animation
            addToCart(product.id);
            if (!addToCartButton.disabled) { // Prevent multiple clicks during animation
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Success state
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent; // Revert to original
                        addToCartButton.disabled = false;
                    }, 1500); // Duration of success state
                }, 500); // Duration of loading state
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            // Handle edit action (call admin logic)
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            // Handle delete action (call admin logic)
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            // Handle favorite toggle
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Share handled by its own listener above
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description (if any)
            // Default action: Show product details
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}


function setupScrollAnimations() {
    // Use Intersection Observer to add 'visible' class for reveal animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% is visible
    });

    // Observe all elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    // Render placeholder skeleton cards while data is loading
    container.innerHTML = ''; // Clear previous
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
    // Hide actual product container and loader if rendering the main skeleton
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}

function renderProducts() {
    // Render the current list of products in state.products
    productsContainer.innerHTML = ''; // Clear previous
    if (!state.products || state.products.length === 0) {
        // If no products, might display a message (handled in searchProductsInFirestore)
        return;
    }

    // Create and append card elements for each product
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for scroll animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Set up animations for newly added cards
}


async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Row not found

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use name from layout config first, fallback to row data
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        // Create section title
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        // Create container for cards
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

            // Add click listener to navigate to the linked category/subcategories
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

        return sectionContainer; // Return the fully constructed section element
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

// Function updated to handle sub and sub-sub categories
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Default title from layout
    let targetDocRef; // Firestore reference for fetching the category name

    // Determine the query field and value based on the most specific ID provided
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
        return null; // No category specified, cannot render
    }

    try {
        // Fetch the name of the category/subcategory/subsubcategory for a more accurate title
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Use the fetched name if available, otherwise fallback to the name from layout data
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Use the potentially updated title
        header.appendChild(titleEl);

        // Add "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID
            if(subcategoryId) {
                // If subcategory or subsubcategory is linked, go to the subcategory detail page
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else {
                 // If only main category is linked, filter on the main page
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

        // Query products based on the determined category level
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Use the determined field and value
            orderBy('createdAt', 'desc'),
            limit(10) // Limit products shown in the row
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

        // Render product cards
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container; // Return the section element

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}


// Function updated to take groupId
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID per group
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        // Query brands within the specified group
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

            // Add click listener to navigate to linked category
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                    // Navigate to subcategory detail page
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                     // Navigate to main category filter on home page
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

        return sectionContainer; // Return the section element
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

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
        // Query products created within the last 15 days
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit results
        );
        const snapshot = await getDocs(q);

        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Do not render if there are no new products
        } else {
            // Render products in a horizontal scroller
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
            });
        }
        container.appendChild(productsScroller);
        return container; // Return the section element

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add space

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
        // Fetch only a few products initially for the home page section preview
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Don't render if no products exist
        }

        // Render product cards in the grid
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container; // Return the section element
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}


// ** CHAKKIRÎ: Fonksiyon hate guhertin da ku scrollToPosition qebûl bike **
async function renderHomePageContent(scrollToPosition = null) { // scrollToPosition hate zêdekirin
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up any existing slider intervals
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object

        // Fetch and render sections based on layout config
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                // Render section based on type
                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layoutId
                        } else { console.warn("Promo slider section missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section missing groupId."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        } else { console.warn("Shortcut row section missing rowId."); }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Category row section missing categoryId."); }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement); // Add rendered section
                }
            }
        }

        // !! LÊZÊDEKIRÎ: Scroll bike eger pêwîst be piştî renderkirinê !!
        if (scrollToPosition !== null) {
            setTimeout(() => {
                console.log("Restoring scroll from renderHomePageContent:", scrollToPosition);
                window.scrollTo(0, scrollToPosition);
            }, 50); // Small delay to allow layout shifts
        }

    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
        // Skeleton is cleared automatically when content is added
    }
}


async function renderPromoCardsSectionForHome(groupId, layoutId) { // layoutId added
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for layout consistency
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID using layoutId

    try {
        // Fetch cards for the specified group
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null }; // State local to this slider instance
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the slider element
            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            // Setup auto-rotation if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still tracked
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear this specific interval
                            // Also remove from global state if it exists there
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element removed or interval cleared globally
                    }
                    // Rotate to the next card
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl; // Update image source
                };

                // Clear any previous interval for this specific layoutId
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID globally using layoutId
                sliderState.intervalId = setInterval(rotate, 5000); // 5-second rotation
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize global store if needed
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid; // Return the slider element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if error or no cards
}


// ** CHAKKIRÎ: Fonksiyon hate guhertin da ku scrollToPosition qebûl bike û bi kar bîne **
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false, scrollToPosition = null) { // scrollToPosition hate zêdekirin
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    // Determine if the home page sections should be shown instead of the product list
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Show home sections, hide product list/loader
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render home content if empty or if it's a new "search" (meaning filters cleared)
        // Pass scrollToPosition to restore scroll after rendering home content
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) {
             await renderHomePageContent(scrollToPosition); // scrollToPosition hate şandin
        } else {
             // If home content already exists, restore scroll directly
             if (scrollToPosition !== null) {
                 setTimeout(() => {
                     console.log("Restoring scroll from searchProductsInFirestore (home exists):", scrollToPosition);
                     window.scrollTo(0, scrollToPosition);
                 }, 0); // Minimal delay
             }
             // Restart slider rotations if needed (handled within renderHomePageContent logic now)
        }
        // Clear product state as we are showing home page
        state.products = [];
        state.lastVisibleProductDoc = null;
        state.allProductsLoaded = true; // No more products to load in this view
        return; // Stop execution, home page is shown
    } else {
        // Show product list view, hide home sections
        homeSectionsContainer.style.display = 'none';
        // Stop all promo slider rotations when leaving the home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object
    }

    // --- Product List Logic ---

    // Check cache (currently disabled, can be re-enabled if needed)
    // const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    // if (isNewSearch && state.productCache[cacheKey]) { ... return; }

    if (state.isLoadingMoreProducts) return; // Prevent concurrent loading

    if (isNewSearch) {
        // Reset state for a new search/filter
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton for new search
    }

    if (state.allProductsLoaded && !isNewSearch) return; // All loaded, nothing more to fetch

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show bottom loader

    try {
        // Build Firestore query based on current filters and search term
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

        // Apply ordering (different if searching vs. just filtering)
        if (finalSearchTerm) {
            // Order by relevance (searchableName) then date when searching
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Order by date when just filtering
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (start after last visible doc if loading more)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Limit results per page
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Execute query
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
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none'; // Hide trigger if all loaded
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Show trigger to load more
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Update last doc reference

        // Update cache (optional)
        // if (isNewSearch) { state.productCache[cacheKey] = { ... }; }

        // Render the updated product list
        renderProducts();

        // !! LÊZÊDEKIRÎ: Scroll bike piştî renderkirinê eger scrollToPosition hebe !!
        if (scrollToPosition !== null) {
            setTimeout(() => {
                console.log("Restoring scroll from searchProductsInFirestore (products):", scrollToPosition);
                window.scrollTo(0, scrollToPosition);
            }, 0); // Minimal delay after rendering
        }

        // Show message if no products found on a new search
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        // Clean up UI state
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        // Ensure products container is visible only if not showing home sections
        if (!shouldShowHomeSections) {
           productsContainer.style.display = 'grid';
        }
    }
}


function addToCart(productId) {
    const allFetchedProducts = [...state.products]; // Use current products list
    let product = allFetchedProducts.find(p => p.id === productId);

    // If product not found locally, fetch its details first
    if (!product) {
        console.warn("Product not found locally. Fetching details before adding to cart.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++; // Increment quantity
                } else {
                    // Add new item to cart
                    state.cart.push({
                        id: fetchedProduct.id,
                        name: fetchedProduct.name, // Store the name object
                        price: fetchedProduct.price,
                        image: mainImage,
                        quantity: 1
                    });
                }
                saveCart(); // Save updated cart to localStorage
                showNotification(t('product_added_to_cart')); // Show confirmation
            } else {
                showNotification(t('product_not_found_error'), 'error'); // Product deleted?
            }
        });
        return; // Exit function, cart update will happen asynchronously
    }

    // Product found locally, add to cart directly
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++; // Increment quantity
    } else {
        // Add new item to cart
        state.cart.push({
            id: product.id,
            name: product.name, // Store the name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart(); // Save updated cart
    showNotification(t('product_added_to_cart')); // Show confirmation
}

function renderCart() {
    cartItemsContainer.innerHTML = ''; // Clear previous items
    // Show empty message and hide total/actions if cart is empty
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    // Show total/actions if cart has items
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render WhatsApp/Viber buttons etc.

    let total = 0;
    // Create and append elements for each cart item
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get item name in current language
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        // Populate cart item HTML
        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=?'}" alt="${itemNameInCurrentLang}" class="cart-item-image">
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
    // Add event listeners for quantity buttons and remove button
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}


function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Remove item if quantity is zero or less
        } else {
            saveCart(); // Save changes
            renderCart(); // Re-render the cart UI
        }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId); // Filter out the item
    saveCart(); // Save changes
    renderCart(); // Re-render the cart UI
}

function generateOrderMessage() {
    // Generate the order message text for sharing via WhatsApp, etc.
    if (state.cart.length === 0) return ""; // No message if cart is empty
    let message = t('order_greeting') + "\n\n"; // Start with greeting
    // Add details for each item
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    // Add total price
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

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

async function renderCartActionButtons() {
    // Render buttons (WhatsApp, Viber, etc.) for sending the order
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous

    try {
        // Fetch available contact methods from Firestore
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order might need adjustment
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        // Create a button for each method
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Reusing class, maybe rename later
            btn.style.backgroundColor = method.color; // Set button color

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Set icon and text

            // Add click listener to generate message and open link
            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return; // Don't proceed if message generation failed

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                // Construct link based on method type
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber links might need '+' prefix for international numbers
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Opens phone dialer
                        break;
                    case 'url': // For custom URLs (e.g., forms, APIs)
                        link = value; // Assume the value is the full URL
                        break;
                }

                if (link) {
                    window.open(link, '_blank'); // Open the generated link
                }
            };

            container.appendChild(btn); // Add button to the container
        });
    } catch (error) {
        console.error("Error fetching contact methods:", error);
        container.innerHTML = '<p>هەڵە لە هێنانی ڕێگاکانی ناردن.</p>';
    }
}


async function renderPolicies() {
    // Render terms and policies content in the bottom sheet
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading text
    try {
        const docRef = doc(db, "settings", "policies"); // Document path
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content (replace newlines with <br>) or 'not found' message
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`; // Show 'not found'
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show error
    }
}

function checkNewAnnouncements() {
    // Check for new announcements and show notification badge if needed
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1)); // Get latest
    onSnapshot(q, (snapshot) => { // Listen for real-time updates
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get timestamp of last seen announcement from localStorage
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // Show badge if latest announcement is newer than last seen
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
}

async function renderUserNotifications() {
    // Render the list of announcements in the notification sheet
    const q = query(announcementsCollection, orderBy("createdAt", "desc")); // Get all, newest first
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = ''; // Clear previous
    if (snapshot.empty) {
        // Show 'no notifications' message
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    // Create and append elements for each announcement
    snapshot.forEach(doc => {
        const announcement = doc.data();
        // Keep track of the latest timestamp to update localStorage
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        // Get title and content in current language
        const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

        // Create item element
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

    // Update last seen timestamp and hide badge after opening the sheet
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}


function renderContactLinks() {
    // Render social media links in the settings page
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order might need change

    // Listen for real-time updates
    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        // Create and append link elements
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.className = 'settings-item'; // Use existing style

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

function showWelcomeMessage() {
    // Show welcome modal only on the very first visit
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true'); // Mark as visited
    }
}

function setupGpsButton() {
    // Add functionality to the GPS button in the profile sheet
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return; // Exit if button not found

    getLocationBtn.addEventListener('click', () => {
        // Check if geolocation is supported
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        // Update button state to loading
        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        // Request current position
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        // Handle successful location retrieval
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Use Nominatim (OpenStreetMap) for reverse geocoding (lat/lon -> address)
            // Request address in Kurdish or English
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            // Update address input if address found
            if (data && data.display_name) {
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            // Reset button state
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        // Handle geolocation errors
        let message = '';
        switch (error.code) {
            case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
            case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
            case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
            default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
        }
        showNotification(message, 'error');
        // Reset button state
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


function setupScrollObserver() {
    // Setup Intersection Observer for infinite scrolling
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // If the trigger element is intersecting (visible)
        if (entries[0].isIntersecting) {
            // Load more products if not already loading and not all loaded
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 searchProductsInFirestore(state.currentSearch, false); // Fetch next page (isNewSearch = false)
            }
        }
    }, {
        root: null, // Observe viewport
        threshold: 0.1 // Trigger when 10% visible
    });

    observer.observe(trigger); // Start observing the trigger element
}

function updateCategoryDependentUI() {
    // Update UI elements that depend on the category list (dropdowns, buttons)
    if (state.categories.length === 0) return; // Wait until categories are loaded

    populateCategoryDropdown(); // Update 'Add/Edit Product' modal dropdown
    renderMainCategories(); // Update main category buttons on home page

    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
}


function setupEventListeners() {
    // --- Navigation ---
    homeBtn.onclick = async () => {
        // Navigate to home page and reset filters
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]); // Push state for main page view
            showPage('mainPage');
        }
        // Reset filters by navigating to the default state
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        // Navigate to settings page
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Go back in browser history
    };

    // --- Bottom Sheet Triggers ---
    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => openPopup('termsSheet'));
    }

    // --- Modal Triggers ---
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');

    // --- Closing Popups ---
    sheetOverlay.onclick = () => closeCurrentPopup(); // Click outside sheet
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup); // Click close button
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Click outside modal content

    // --- Forms ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Attempt admin login
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Success handled by onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error'); // Show login error
        }
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        // Save profile data to state and localStorage
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Close profile sheet
    };

    // --- Search ---
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term }); // Navigate with search term
    }, 500); // 500ms delay

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSearch(searchTerm); // Trigger debounced search
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Clear input
        clearSearchBtn.style.display = 'none'; // Hide button
        navigateToFilter({ search: '' }); // Navigate with empty search
    };

    // Subpage search logic (for subcategory detail page)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        // Only run if on the subcategory detail page
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            // const mainCatId = ids[1]; // Not needed directly here
            const subCatId = ids[2];

            // Find the currently active sub-subcategory button on the detail page
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default to 'all'

            // Re-render products on the detail page with the search term
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
        debouncedSubpageSearch(''); // Trigger search with empty term
    };


    // --- Settings Toggles ---
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open'); // Rotate chevron
    };

    // --- Language Selection ---
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang); // Change language on button click
        };
    });

    // --- PWA Install Button ---
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompt
                state.deferredPrompt.prompt(); // Show install prompt
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear saved prompt
            }
        });
    }

    // --- Other Settings Buttons ---
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    // --- Firebase Messaging Foreground Listener ---
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        // Display notification using app's system
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; // Show badge immediately
    });
}

onAuthStateChanged(auth, async (user) => {
    // Handle changes in admin authentication state
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! IMPORTANT: Replace with your actual Admin UID !!
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Store admin status in session
        // Initialize admin logic if available
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Ensure DOM is ready before initializing admin UI
             if (document.readyState === 'complete') {
                 window.AdminLogic.initialize();
             } else {
                 window.addEventListener('load', window.AdminLogic.initialize);
             }
        } else {
            console.warn("AdminLogic not found or initialize not a function.");
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

    // Close login modal automatically if login was successful
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately

    // Attempt to enable Firestore offline persistence
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Initialize app after persistence setup
        })
        .catch((err) => {
            // Handle persistence errors (multiple tabs, browser support)
            if (err.code == 'failed-precondition') {
                console.warn('Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Persistence failed: Browser not supported.');
            } else {
                console.error("Error enabling persistence:", err);
            }
            initializeAppLogic(); // Initialize app even if persistence fails
        });
}

function initializeAppLogic() {
    // Add sliderIntervals property if it doesn't exist
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories and then initialize UI based on URL/state
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => { // Use async here
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // Add 'All'
        updateCategoryDependentUI(); // Update dropdowns, category buttons

        // Handle initial page load/filter state *after* categories are loaded
        handleInitialPageLoad();

        // Apply language *after* categories and initial state are processed
        setLanguage(state.currentLanguage);
    });

    // Setup other parts of the app that don't depend strictly on categories being loaded first
    updateCartCount();
    setupEventListeners(); // Setup general event listeners
    setupScrollObserver(); // Setup infinite scroll
    renderContactLinks(); // Fetch and display contact links
    checkNewAnnouncements(); // Check for notification badge
    showWelcomeMessage(); // Show only on first visit
    setupGpsButton(); // Add GPS functionality
}


// Expose necessary functions/variables for admin.js via a global object
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Pass new collections
    shortcutRowsCollection, // Pass shortcut rows collection

    // Helper functions for admin logic
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Clear home page to force re-render
        }
        // Optionally trigger a re-render if the user is on the home page
        // searchProductsInFirestore(state.currentSearch, true);
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Provide categories to admin
    getCurrentLanguage: () => state.currentLanguage // Provide language to admin
});

// Start the application initialization process
document.addEventListener('DOMContentLoaded', init);

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent default browser prompt
    state.deferredPrompt = e; // Save the event
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Show our custom install button
    }
    console.log('`beforeinstallprompt` event fired.');
});


// Service Worker update handling
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered.');

        // Listen for updates found
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                // If new worker is installed and waiting
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show'); // Show update bar
                }
            });
        });

        // Button to activate the new worker
        updateNowBtn.addEventListener('click', () => {
            // Send message to SW to skip waiting
            registration.waiting?.postMessage({ action: 'skipWaiting' });
            updateNotification.classList.remove('show'); // Hide bar
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Reload page when controller changes (new SW activates)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading...');
        window.location.reload();
    });
}
