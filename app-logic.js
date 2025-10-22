// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Hewldana 3yem ji bo çareserkirina scroll position bi sessionStorage)

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
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- GORRANKARIYA 1: Destpêkirin ---
// Guhêrbeliya cîhanî ji bo hilanîna scrollê ya li bendê
state.pendingScrollRestore = null;
const MAIN_PAGE_SCROLL_KEY = 'mainPageScrollPos';
// --- Dawiya Gorrankariyê 1 ---

function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- GORRANKARIYA 2: Fonksiyona nû ji bo tomarkirina scrollê ---
function saveMainPageScrollPosition() {
    // Tenê dema ku li ser rûpela sereke be û popup venekirî be tomar bike
    if (document.getElementById('mainPage').classList.contains('page-active') &&
        !document.body.classList.contains('overlay-active')) {
        const currentScroll = window.scrollY;
        // console.log(`Saving scroll ${currentScroll} to sessionStorage`); // Ji bo debugê
        sessionStorage.setItem(MAIN_PAGE_SCROLL_KEY, currentScroll);
    }
}
// --- Dawiya Gorrankariyê 2 ---

// Fonksiyona saveCurrentScrollPosition êdî ne pêwîst e, lê em dikarin wê bihêlin heke ji bo tiştekî din were bikaranîn
function saveCurrentScrollPosition() {
    const currentState = history.state;
    if (currentState && !currentState.type) { // Dema ku rewşek fîlterê ye
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
    // --- GORRANKARIYA 3: Tomarkirina scrollê berî guhertina rûpelê ---
    if (document.getElementById('mainPage').classList.contains('page-active')) {
         saveMainPageScrollPosition(); // Tomar bike eger ji rûpela sereke derkeve
    }
    // --- Dawiya Gorrankariyê 3 ---

    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0); // Scroll to top for new pages
    }

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

// =======================================================
// ===== GORRANKARIYA 4: Nûvekirina openPopup ======
// =======================================================
function openPopup(id, type = 'sheet') {
    // --- Destpêka Guhertinê ---
    // Scrollê tomar bike berî ku popup vebe
    saveMainPageScrollPosition();
    // Em ê êdî `scroll`ê di `history.state` de bi awayekî serekî bikar neynin ji bo vegerandinê
    // --- Dawiya Guhertinê ---

    const element = document.getElementById(id);
    if (!element) return;

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        else if (id === 'favoritesSheet') renderFavoritesPage();
        else if (id === 'categoriesSheet') renderCategoriesSheet();
        else if (id === 'notificationsSheet') renderUserNotifications();
        else if (id === 'termsSheet') renderPolicies();
        else if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`); // Hêj stateê ji bo popupê push bike
}
// =====================================================
// ===== Dawiya Gorrankariyê 4: Nûvekirina openPopup =====
// =====================================================


function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Trigger popstate to close
    } else {
        closeAllPopupsUI(); // Fallback
    }
}

// ==============================================================
// ===== GORRANKARIYA 5: Nûvekirina applyFilterState ======
// ==============================================================
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';
    state.pendingScrollRestore = null; // Reset bike

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories();
    await renderSubcategories(state.currentCategory);

    // --- Destpêka Guhertina Nû ---
    // Scrollê ji sessionStorage bistîne eger ji popstate vegeriyaye
    if (fromPopState) {
        const savedScroll = sessionStorage.getItem(MAIN_PAGE_SCROLL_KEY);
        if (savedScroll !== null) {
            state.pendingScrollRestore = parseInt(savedScroll, 10);
            sessionStorage.removeItem(MAIN_PAGE_SCROLL_KEY); // Piştî xwendinê jê bibe
            // console.log(`Retrieved scroll ${state.pendingScrollRestore} from sessionStorage`); // Ji bo debugê
        } else {
             // Ger ji sessionStorage tiştek nehatibe, dîsa jî hewl bide ji history.state bistîne wekî fallback
             if (filterState && typeof filterState.scroll === 'number' && filterState.scroll > 0) {
                 state.pendingScrollRestore = filterState.scroll;
                 // console.log(`Retrieved scroll ${state.pendingScrollRestore} from history state (fallback)`); // Ji bo debugê
             }
        }
    }
    // --- Dawiya Guhertina Nû ---

    // Barkirin û nîşandana naverokê
    await searchProductsInFirestore(state.currentSearch, true);

    // --- Destpêka Guhertina Nû ---
    // Vegerandina scrollê piştî barkirina naverokê
    if (state.pendingScrollRestore !== null && state.pendingScrollRestore > 0) {
        // Dema derengmayînê zêdetir bike da ku piştrast be naveroka dînamîk hatiye barkirin
        setTimeout(() => {
             console.log(`Attempting to restore scroll to: ${state.pendingScrollRestore}`); // Ji bo debugê
             window.scrollTo({ top: state.pendingScrollRestore, behavior: 'auto' });
             // Hewldana duyemîn piştî demekê din
             setTimeout(() => {
                 if (Math.abs(window.scrollY - state.pendingScrollRestore) > 50) { // Ger hê jî dûr be
                     console.log(`Second attempt restore scroll: ${state.pendingScrollRestore}`);
                     window.scrollTo({ top: state.pendingScrollRestore, behavior: 'auto' });
                 }
                 state.pendingScrollRestore = null; // Reset bike piştî hewldanê
             }, 150); // Derengmayîna zêde
        }, 300); // Derengmayîna serekî 300ms
    } else if (!fromPopState) {
        // Ji bo fîlterên nû, here serî
        window.scrollTo({ top: 0, behavior: 'smooth' });
        state.pendingScrollRestore = null; // Reset bike
    } else {
        // Ji popstate vegeriya lê scroll tune bû (yan 0 bû)
        state.pendingScrollRestore = null; // Reset bike
    }
    // --- Dawiya Guhertina Nû ---
}
// ============================================================
// ===== Dawiya Gorrankariyê 5: Nûvekirina applyFilterState =====
// ============================================================


// ==============================================================
// ===== GORRANKARIYA 6: Nûvekirina navigateToFilter ======
// ==============================================================
async function navigateToFilter(newState) {
    // --- Destpêka Guhertinê ---
    // Scrollê tomar bike berî ku here fîlterek nû
    saveMainPageScrollPosition(); // Fonksiyona nû bikar bîne
    // --- Dawiya Guhertinê ---

    // Rewşa heyî ya berî navîgasyonê bistîne (bêyî `scroll`ê ji sessionStorage)
    const currentStateBeforeNavigation = {
         category: state.currentCategory,
         subcategory: state.currentSubcategory,
         subSubcategory: state.currentSubSubcategory,
         search: state.currentSearch
         // Scroll êdî li vir nayê bikaranîn ji bo hilanînê
    };

    const finalState = { ...currentStateBeforeNavigation, ...newState, scroll: 0 }; // `scroll: 0` ji bo cihê nû

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Rewşa nû push bike
    history.pushState(finalState, '', newUrl);

    // Fîlterê bi cih bîne (ev ê scroll bike serî ji ber ku fromPopState = false ye)
    await applyFilterState(finalState, false);
}
// ============================================================
// ===== Dawiya Gorrankariyê 6: Nûvekirina navigateToFilter =====
// ============================================================


window.addEventListener('popstate', async (event) => {
    // console.log("Popstate triggered. State:", event.state); // Ji bo debugê
    closeAllPopupsUI(); // Her popup an sheetê bigire
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
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
             // Bi gelemperî dive ev neqewime, lê wekî parastin
             console.warn("Popstate with popup type detected, closing UI only.");
             // Tenê UI bigire, ji ber ku veger bi gelemperî popupê digire
        }
        // --- GORRANKARIYA 7: Ji bo popstateê ---
        // Ger state type tune be (yanî rewşa fîlterê ya rûpela sereke ye)
        else if (!popState.type) {
            showPage('mainPage'); // Piştrast bike ku rûpela sereke tê nîşandan
            // applyFilterState bang bike û bihêle ew scrollê ji sessionStorage bistîne
            applyFilterState(popState, true);
        }
        // --- Dawiya Gorrankariyê 7 ---
    } else {
         // Rewş tune, vegere rewşa destpêkê ya rûpela sereke
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage');
         applyFilterState(defaultState, false); // Fîlterên destpêkê, scroll bike serî
    }
});

function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    let initialState;
    if (pageId === 'mainPage') {
        initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            // Scroll ji bo barkirina destpêkê girîng nîne
        };
        history.replaceState(initialState, ''); // Rewşa destpêkê saz bike
    } else if (pageId === 'settingsPage') {
        history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
        showPage(pageId, t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        history.replaceState({ type: 'page', id: pageId, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
        // showPage ne li vir, li initializeAppLogic piştî barkirina kategoriyan
    } else {
         initialState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' };
         history.replaceState(initialState, '');
         showPage('mainPage');
    }

    // Handle Popups/Product Detail from URL
    const element = document.getElementById(hash);
    if (pageId === 'mainPage' && element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 50);
        }
    }

    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500);
    }
}


// ... (کۆدی فەنکشنەکانی تر لێرەدا وەک خۆی دەمێنێتەوە) ...
// ... (t, setLanguage, forceUpdate, ...) ...

// === COPY & PASTE ALL UNCHANGED FUNCTIONS FROM THE PREVIOUS `app-logic.js` HERE ===
// (Paste functions: t, setLanguage, forceUpdate, updateContactLinksUI, updateActiveNav, formatDescription,
// requestNotificationPermission, saveTokenToFirestore, saveFavorites, isFavorite, toggleFavorite, renderFavoritesPage,
// saveCart, updateCartCount, showNotification, populateCategoryDropdown, renderCategoriesSheet,
// renderSubSubcategories, showSubcategoryDetailPage, renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPage,
// renderSubcategories, renderMainCategories, showProductDetails, renderRelatedProducts, showProductDetailsWithData,
// createPromoCardElement, createProductCardElement, setupScrollAnimations, renderSkeletonLoader, renderProducts,
// renderSingleShortcutRow, renderSingleCategoryRow, renderBrandsSection, renderNewestProductsSection, renderAllProductsSection,
// renderHomePageContent, renderPromoCardsSectionForHome, searchProductsInFirestore, addToCart, renderCart, updateQuantity,
// removeFromCart, generateOrderMessage, renderCartActionButtons, renderPolicies, checkNewAnnouncements,
// renderUserNotifications, renderContactLinks, showWelcomeMessage, setupGpsButton, setupScrollObserver,
// updateCategoryDependentUI, setupEventListeners, onAuthStateChanged)
// NOTE: init() function is modified below.
// ====================================================================================

// PASTE UNCHANGED FUNCTIONS HERE

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

    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear home content to force re-render with new language
    }

    // Re-apply filter state which will trigger re-render
    const currentState = history.state || { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: window.scrollY };
    applyFilterState(currentState, false); // Apply current filters, scroll to top usually


    // Re-render dynamic elements that depend on language
    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
    if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies();
    renderContactLinks(); // Update contact link names
    // Re-render admin category dropdowns if applicable
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Also update shortcut card dropdowns
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
    // This function seems unused, renderContactLinks handles UI updates. Keeping for now.
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
            createdAt: Date.now(),
            // You could add more info like user agent, last updated time etc.
        });
        console.log('Token saved/updated in Firestore.');
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
    if(event) event.stopPropagation(); // Prevent card click when clicking button

    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        // Remove from favorites
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        // Add to favorites
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Save the updated list to local storage

    // Update heart icon on all cards with this product ID (main page, favorites page, etc.)
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming Font Awesome class
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorited
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart if not
        }
    });

    // If the favorites sheet is currently open, re-render it
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
        // Note: For a very large number of favorites, fetching individually might be slow.
        // Consider alternatives like querying with 'in' operator if performance becomes an issue.
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists()) // Only include products that still exist
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            // If all favorited products were deleted
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            // Optionally clear the favorites list if all were invalid
            // state.favorites = [];
            // saveFavorites();
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
    // Trigger CSS transition
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition finishes
        setTimeout(() => {
            if (document.body.contains(notification)) {
                 document.body.removeChild(notification);
            }
        }, 300); // Should match CSS transition duration
    }, 3000); // Notification visible duration
}

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Use current language, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = ''; // Clear previous buttons
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id; // Store category ID
        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight active category
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Translate "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Use current lang or fallback

        // Use icon if available
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Default icon if missing

        btn.onclick = async () => {
            // Navigate to the selected main category
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
    // This function is intended for the main page, which is now handled differently
    // Sub-subcategories are primarily shown on the detail page now.
    // Keeping it potentially for future use, but clearing the container.
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none'; // Ensure it's hidden
}

async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || subCatName;
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
    }

    if (!fromHistory) {
         // --- GORRANKARIYA 8: Tomarkirina scrollê berî ku here rûpelek din ---
         saveMainPageScrollPosition(); // Tomar bike berî pushState
         // --- Dawiya Gorrankariyê 8 ---
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the page and set header title

    const loader = document.getElementById('detailPageLoader');
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const subSubContainerDetail = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Show loader and clear previous content
    loader.style.display = 'block';
    productsContainerDetail.innerHTML = '';
    subSubContainerDetail.innerHTML = '';

    // Reset search for the detail page
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Load content for the detail page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Load sub-subcategories first
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Load products for the main subcategory initially

    loader.style.display = 'none'; // Hide loader after content is loaded
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Create "All" button for this subcategory
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Active by default
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
            // Handle click on "All"
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Load products for parent subcategory
        };
        container.appendChild(allBtn);

        // Create buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id;
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                // Handle click on specific sub-subcategory
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Load products for this sub-subcategory
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const loaderDetail = document.getElementById('detailPageLoader');
    loaderDetail.style.display = 'block';
    productsContainerDetail.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query depending on whether "All" or a specific sub-subcategory is selected
        if (subSubCatId === 'all') {
            // Query for products directly under the parent subcategory
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
            // Query for products under the specific sub-subcategory
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term if provided
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // When searching, orderBy must match the inequality field first
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default ordering when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // We are loading all products for the detail page, no pagination needed here
        // productsQuery = query(productsQuery, limit(SOME_LIMIT)); // Remove limit if showing all

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Reuse the card creation function
                productsContainerDetail.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loaderDetail.style.display = 'none'; // Hide loader
    }
}


async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous
    subcategoriesContainer.style.display = 'none'; // Hide by default

    if (!categoryId || categoryId === 'all') {
        return; // Don't show subcategories if 'All' is selected or no category
    }

    try {
        const subcategoriesQueryRef = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQueryRef, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (fetchedSubcategories.length === 0) return; // Don't show if empty

        subcategoriesContainer.style.display = 'flex'; // Show the container

        // Create "All" button for the current main category
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
            // Navigate to show all products under the current main category
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
                // category remains the same
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Create buttons for each subcategory
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            // Subcategory buttons now navigate to the detail page
            subcatBtn.className = `subcategory-btn`; // No 'active' state needed here anymore

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            subcatBtn.onclick = () => {
                // Navigate to the detail page for this subcategory
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight the active main category
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-th'}"></i> <span>${categoryName}</span>`; // Default icon

        btn.onclick = async () => {
            // Apply filter for this main category
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory when changing main category
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search when changing category
            });
        };

        container.appendChild(btn);
    });
}

// Shows product detail in a bottom sheet
function showProductDetails(productId) {
    // Find product in already loaded products (state.products)
    // If not found, fetch it individually from Firestore
    // Populate the #productDetailSheet elements
    // Open the sheet using openPopup('productDetailSheet')

    const allFetchedProducts = [...state.products]; // Combine initial and potentially loaded more products
    let product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        // If not found in current list (e.g., accessed via direct link or search result from non-visible page)
        console.log("Product not found in local state for details view. Fetching...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Call helper function with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
             console.error("Error fetching single product:", error);
             showNotification(t('error_generic'), 'error');
        });
        return;
    }
    // Product found in state, show details directly
    showProductDetailsWithData(product);
}

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the most specific category to query by
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
        return; // Cannot find related products if no category info
    }

    const q = query(
        productsCollection,
        where(queryField, '==', queryValue),
        where('__name__', '!=', currentProduct.id), // Exclude the current product itself
        limit(6) // Limit the number of related products shown
        // Potential improvement: Add orderBy('random') or fetch more and pick randomly if needed
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Don't show the section if no related products
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Reuse card creation logic
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

// Helper function to populate the product detail sheet with data
function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll sheet content to top
    }

    // Get localized name and description
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []); // Handle legacy single image

    // Image Slider Setup
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Main image
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active'); // Show first image initially
            imageContainer.appendChild(img);

            // Thumbnail image
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // Highlight first thumbnail
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    } else {
         // Show placeholder if no images
         imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="No Image">`;
    }

    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

    function updateSlider(newIndex) {
        if (!images[newIndex] || !thumbnails[newIndex]) return;
        images[currentIndex].classList.remove('active');
        thumbnails[currentIndex].classList.remove('active');
        images[newIndex].classList.add('active');
        thumbnails[newIndex].classList.add('active');
        currentIndex = newIndex;
    }

    // Show/hide slider buttons based on image count
    const showSliderButtons = images.length > 1;
    prevBtn.style.display = showSliderButtons ? 'flex' : 'none';
    nextBtn.style.display = showSliderButtons ? 'flex' : 'none';

    // Add event listeners for slider controls
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => {
        thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index));
    });

    // Populate other details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Use formatter for links/newlines

    // Price display (handle original price for discount)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Add to Cart button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close sheet after adding to cart
    };

    // Render related products section
    renderRelatedProducts(product);

    // Open the sheet
    // --- GORRANKARIYA 9: Tomarkirina scrollê berî vekirina popupê ---
    saveMainPageScrollPosition(); // Tomar bike berî ku hûragahiyan nîşan bide
    // --- Dawiya Gorrankariyê 9 ---
    openPopup('productDetailSheet');
}

// ... (Paste createPromoCardElement unchanged) ...
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
        if (!e.target.closest('button')) {
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                // --- GORRANKARIYA 10: Tomarkirina scrollê berî navîgasyonê ---
                saveMainPageScrollPosition();
                // --- Dawiya Gorrankariyê 10 ---
                await navigateToFilter({
                    category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                });
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

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


// ... (Paste createProductCardElement unchanged - make sure event listeners inside call showProductDetailsWithData) ...
function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';


    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

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

    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

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

    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation();
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        const shareData = {
            title: nameInCurrentLang,
            text: `${t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
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
             if (err.name !== 'AbortError') {
                 showNotification(t('share_error'), 'error');
             }
        }
    });


    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            addToCart(product.id);
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            // Handled above
        } else if (!target.closest('a')) {
            // Call showProductDetailsWithData instead of showProductDetails
            // to avoid unnecessary fetching if data is already available
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}

// ... (Paste setupScrollAnimations, renderSkeletonLoader, renderProducts unchanged) ...
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Re-query the elements each time renderProducts is called might be safer
    // if elements are completely replaced.
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

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
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid layout
    // If rendering the main skeleton loader, hide the actual products container
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none'; // Also hide the bottom loader if showing skeleton
    }
}

function renderProducts() {
    // If state.products is empty (e.g., after initial load or failed fetch),
    // productsContainer might remain empty or show a "no products" message
    // added by searchProductsInFirestore.
    productsContainer.innerHTML = ''; // Clear previous products first

    if (!state.products || state.products.length === 0) {
        // If searchProductsInFirestore didn't add a message, maybe add one here?
        // Or let searchProductsInFirestore handle the empty state message.
        return;
    }

    // Append new product cards
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    // Re-setup scroll animations for newly added cards
    setupScrollAnimations();
}


// ... (Paste renderSingleShortcutRow, renderSingleCategoryRow, renderBrandsSection, renderNewestProductsSection, renderAllProductsSection unchanged) ...
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use provided section name first, fallback to row title
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            return null; // Don't render empty rows
        }

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                 // --- GORRANKARIYA 11: Tomarkirina scrollê berî navîgasyonê ---
                 saveMainPageScrollPosition();
                 // --- Dawiya Gorrankariyê 11 ---
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

async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRef;

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
        return null;
    }

    try {
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             // --- GORRANKARIYA 12: Tomarkirina scrollê berî navîgasyonê ---
             saveMainPageScrollPosition();
             // --- Dawiya Gorrankariyê 12 ---
            if(subcategoryId) {
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else {
                 await navigateToFilter({
                     category: categoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                 });
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

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

async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`;
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

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

            item.onclick = async () => {
                 // --- GORRANKARIYA 13: Tomarkirina scrollê berî navîgasyonê ---
                 saveMainPageScrollPosition();
                 // --- Dawiya Gorrankariyê 13 ---
                if (brand.subcategoryId && brand.categoryId) {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                    await navigateToFilter({
                        category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                    });
                }
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
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
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown on home page
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

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add some space before this section

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
        // Fetch only a limited number of products initially for the home page section
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Don't render if no products exist at all
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

// ... (Paste renderHomePageContent, renderPromoCardsSectionForHome unchanged) ...
async function renderHomePageContent() {
    if (state.isRenderingHomePage) {
        // console.log("Already rendering home page, skipping."); // Ji bo debugê
        return;
    }
    state.isRenderingHomePage = true;
    // console.log("Starting renderHomePageContent"); // Ji bo debugê

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Nîşandana skeleton loader
        homeSectionsContainer.innerHTML = ''; // Paqijkirina naveroka berê

        // Paqijkirina intervalên berê
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            homeSectionsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">ڕووکاری لاپەڕەی سەرەکی دیاری نەکراوە.</p>';
        } else {
            // Promise array ji bo renderkirina beşên async
            const sectionRenderPromises = layoutSnapshot.docs.map(doc => {
                 const section = doc.data();
                 const layoutId = doc.id; // IDya belgeyê ji bo slideran bikar bîne

                 switch (section.type) {
                     case 'promo_slider':
                         return section.groupId ? renderPromoCardsSectionForHome(section.groupId, layoutId) : Promise.resolve(null);
                     case 'brands':
                         return section.groupId ? renderBrandsSection(section.groupId) : Promise.resolve(null);
                     case 'newest_products':
                         return renderNewestProductsSection();
                     case 'single_shortcut_row':
                         return section.rowId ? renderSingleShortcutRow(section.rowId, section.name) : Promise.resolve(null);
                     case 'single_category_row':
                         return section.categoryId ? renderSingleCategoryRow(section) : Promise.resolve(null);
                     case 'all_products':
                         return renderAllProductsSection();
                     default:
                         console.warn(`Unknown home layout section type: ${section.type}`);
                         return Promise.resolve(null);
                 }
            });

            // Li benda hemû beşan be ku render bibin
            const renderedSections = await Promise.all(sectionRenderPromises);

            // Tenê beşên ku bi serkeftî hatine renderkirin lê zêde bike
            renderedSections.forEach(sectionElement => {
                 if (sectionElement) {
                     homeSectionsContainer.appendChild(sectionElement);
                 }
            });
             // console.log("Finished rendering home sections"); // Ji bo debugê
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
        // console.log("renderHomePageContent finished"); // Ji bo debugê
    }
}

async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // IDya yekta

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass sliderState
            promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                const rotate = () => {
                    // Kontrol bike ka element hê jî heye û interval di state de ye
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return;
                    }
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Intervala berê paqij bike
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId; // Di stateê de hilîne
            }
            return promoGrid; // Elementê vegerîne
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Null vegerîne eger tiştek tune be yan jî xeletî çêbibe
}


// ... (Paste searchProductsInFirestore, addToCart, renderCart unchanged) ...
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Nîşandana naveroka rûpela sereke ---
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none'; // Veşartina triggerê
        homeSectionsContainer.style.display = 'block';

        // Naveroka rûpela sereke render bike eger vala be
        if (homeSectionsContainer.innerHTML.trim() === '') {
            // console.log("Home container empty, calling renderHomePageContent"); // Ji bo debugê
            await renderHomePageContent();
        } else {
            // console.log("Home container not empty, assuming content exists"); // Ji bo debugê
        }
        return; // Ji fonksiyonê derkeve piştî nîşandana rûpela sereke
    } else {
        // --- Nîşandana encamên fîlterê/lêgerînê ---
        homeSectionsContainer.style.display = 'none'; // Veşartina beşên rûpela sereke

        // Rawestandina hemû sliderên promo
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset bike
    }

    // --- Barkirina berheman ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;

    // Ji bo lêgerîn/fîlterên nû, cacheê kontrol bike (eger pêwîst be)
    // Ev beş dikare were rakirin eger cache bûye sedema pirsgirêkan
    /*
    if (isNewSearch && state.productCache[cacheKey]) {
        // ... (koda cacheê) ...
        // return;
    }
    */

    if (state.isLoadingMoreProducts && !isNewSearch) return; // Pêşî li barkirina hevdem bigire

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = []; // Lîsteya berheman vala bike
        renderSkeletonLoader(); // Skeleton loader nîşan bide
        productsContainer.innerHTML = ''; // Piştrast bike ku vala ye
    }

    if (state.allProductsLoaded && !isNewSearch) return; // Hemû berhem hatine barkirin

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Nîşandana loadera binî

    try {
        let productsQuery = collection(db, "products");

        // Fîlteran bicîh bîne
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Rêzkirinê bicîh bîne
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Pagination
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            state.products = newProducts; // Ji bo lêgerîna nû, lîsteyê binivîse
        } else {
            state.products = [...state.products, ...newProducts]; // Berhemên nû lê zêde bike
        }

        // Rewşa paginationê nûve bike
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none'; // Triggerê veşêre
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Triggerê nîşan bide
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Cacheê nûve bike (eger bikar tê)
        /*
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                 products: state.products, lastVisible: state.lastVisibleProductDoc, allLoaded: state.allProductsLoaded
            };
        }
        */

        // Berheman render bike (eger isNewSearch be, ev ê yên berê paqij bike)
        renderProducts();

        // Peyama "tiştek nehat dîtin" nîşan bide eger pêwîst be
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Loadera binî veşêre
        skeletonLoader.style.display = 'none'; // Skeleton loader veşêre
        productsContainer.style.display = 'grid'; // Konteynera berheman nîşan bide
        // console.log("Finished searchProductsInFirestore"); // Ji bo debugê
    }
}

function addToCart(productId) {
    // Find product in state.products first
    let product = state.products.find(p => p.id === productId);

    // If not found in state (e.g., added from related products not in current list)
    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching details to add.");
        // Fetch product details to add essential info to cart
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || ''); // Handle image source
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++; // Increment quantity if already in cart
                } else {
                    // Add new item with essential details
                    state.cart.push({
                        id: fetchedProduct.id,
                        name: fetchedProduct.name, // Store the name object
                        price: fetchedProduct.price,
                        image: mainImage,
                        quantity: 1
                    });
                }
                saveCart(); // Save updated cart to local storage and update count
                showNotification(t('product_added_to_cart')); // Show confirmation
            } else {
                 showNotification(t('product_not_found_error'), 'error'); // Product deleted?
            }
        }).catch(err => {
             console.error("Error fetching product details for cart:", err);
             showNotification(t('error_generic'), 'error');
        });
        return; // Exit function while fetching
    }

    // Product found in state.products
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || ''); // Handle image source
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
    saveCart(); // Save updated cart and update count
    showNotification(t('product_added_to_cart')); // Show confirmation
}

function renderCart() {
    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block'; // Show empty message
        cartTotal.style.display = 'none'; // Hide total
        cartActions.style.display = 'none'; // Hide actions
        return;
    }

    // Cart is not empty
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Render action buttons (WhatsApp, Viber etc.)

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get localized name, fallback to Sorani or ID if name object missing
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : item.id); // Fallback added
        const itemImage = item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'; // Placeholder if image missing

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
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

    // Update total amount display
    totalAmount.textContent = total.toLocaleString();

    // Add event listeners for quantity buttons and remove button
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}


// ... (Paste updateQuantity, removeFromCart, generateOrderMessage, renderCartActionButtons, renderPolicies unchanged) ...
function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            // Remove item if quantity drops to 0 or below
            removeFromCart(productId);
        } else {
            // Save changes and re-render cart UI
            saveCart();
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId); // Filter out the item
    saveCart(); // Save changes
    renderCart(); // Re-render cart UI
}

function generateOrderMessage() {
    if (state.cart.length === 0) return ""; // Return empty if cart is empty

    let message = t('order_greeting') + "\n\n"; // "Hello! I need the following items:"

    // Add each cart item to the message
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || item.id; // Get localized name
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity }); // "Price: {price} IQD | Quantity: {quantity}"
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    // Add total price
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // "Total: {total} IQD"

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
        const q = query(methodsCollection, orderBy("createdAt")); // Order by creation time (can be changed)
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>'; // Message if no methods configured
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class, specific styles handled by inline style
            btn.className = 'whatsapp-btn'; // Keeping class name for potential shared styles
            btn.style.backgroundColor = method.color; // Apply color from Firestore

            // Get localized button text
            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`; // Set icon and text

            btn.onclick = () => {
                const message = generateOrderMessage(); // Generate the order details
                if (!message) return; // Don't proceed if cart is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                // Construct link based on method type
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber link format might need %2B for the plus sign
                        link = `viber://chat?number=%2B${value.replace('+', '')}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        // Assumes value is username (without @)
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Opens dialer
                        break;
                    case 'url': // For custom external links
                        link = value; // Use the value directly as URL
                        break;
                }

                if (link) {
                    window.open(link, '_blank'); // Open the link in a new tab/app
                }
            };

            container.appendChild(btn); // Add the button to the container
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = '<p>هەڵە لە هێنانی ڕێگاکانی ناردن.</p>';
    }
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading message
    try {
        const docRef = doc(db, "settings", "policies"); // Path to the policies document
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content; // Get the content object
            // Get content for current language, fallback to Sorani, then empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content, replace newlines with <br> for HTML rendering
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Document doesn't exist or has no content field
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show generic error
    }
}


// ... (Paste checkNewAnnouncements, renderUserNotifications, renderContactLinks, showWelcomeMessage, setupGpsButton unchanged) ...
function checkNewAnnouncements() {
    // Listen for the latest announcement
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));

    // Use onSnapshot for real-time updates (optional, could be getDocs if only checking on load)
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const latestTimestamp = latestAnnouncement.createdAt;
            // Get the timestamp of the last announcement the user saw
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // If the latest announcement is newer than the last seen one, show badge
            if (latestTimestamp > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
             notificationBadge.style.display = 'none'; // No announcements at all
        }
    }, (error) => {
         console.error("Error listening for announcements:", error);
         notificationBadge.style.display = 'none'; // Hide badge on error
    });
}

async function renderUserNotifications() {
    // Fetch all announcements, ordered newest first
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));

    try {
        const snapshot = await getDocs(q);
        notificationsListContainer.innerHTML = ''; // Clear previous list

        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Keep track of the newest timestamp among all fetched announcements
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            // Format date (e.g., YYYY/MM/DD)
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

            // Get localized title and content
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            // Create notification item HTML
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
            `;
            notificationsListContainer.appendChild(item);
        });

        // Update the last seen timestamp in local storage after viewing
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        notificationBadge.style.display = 'none'; // Hide the badge

    } catch (error) {
        console.error("Error fetching notifications:", error);
        notificationsListContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    // Path to the social links subcollection
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    // Query ordered by creation time (can be changed if an 'order' field is added)
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Or asc if preferred

    // Use onSnapshot for real-time updates
    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            // Get localized name
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            // Create link element
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security best practice
            linkElement.className = 'settings-item'; // Use existing style

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
         console.error("Error fetching social links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە هێنانی لینکەکان.</p>';
    });
}

function showWelcomeMessage() {
    // Show welcome message only on the very first visit
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true'); // Mark as visited
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn?.querySelector('span'); // Use optional chaining
    const originalBtnText = btnSpan?.textContent || 'وەرگرتنی ناونیشانم بە GPS'; // Fallback text

    if (!getLocationBtn || !profileAddressInput || !btnSpan) return; // Exit if elements not found

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        // Show loading state
        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
            enableHighAccuracy: true, // Request more accurate position
            timeout: 10000, // Set timeout to 10 seconds
            maximumAge: 0 // Force fresh location data
        });
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Using OpenStreetMap Nominatim for reverse geocoding
            // It's free but has usage limits. Consider alternatives if needed.
            // Request Kurdish ('ku') first, fallback to English ('en')
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            if (!response.ok) {
                throw new Error(`Geocoding request failed: ${response.statusText}`);
            }
            const data = await response.json();

            if (data && data.display_name) {
                profileAddressInput.value = data.display_name; // Set the address input
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                console.warn("Geocoding response missing display_name:", data);
                // Fallback: show coordinates if address not found
                profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
                showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە', 'error');
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            // Restore button state
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'زانیاری شوێن بەردەست نییە';
                break;
            case error.TIMEOUT:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار لە GPS ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        // Restore button state
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


// ... (Paste setupScrollObserver unchanged) ...
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Check if the trigger element is intersecting with the viewport
        if (entries[0].isIntersecting) {
            // Only load more if not currently loading and not all products are loaded
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                // console.log("Scroll trigger hit, loading more products..."); // Ji bo debugê
                searchProductsInFirestore(state.currentSearch, false); // Fetch next page
            }
        }
    }, {
        root: null, // Use the viewport as the root
        rootMargin: '0px', // No margin
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Start observing the trigger element
    observer.observe(trigger);
}

// ... (Paste updateCategoryDependentUI unchanged) ...
function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded

    // Populate category dropdown in the product form
    populateCategoryDropdown();

    // Render the main category buttons/tabs
    renderMainCategories();

    // Re-render the categories sheet if it might be open or opened later
    renderCategoriesSheet();

    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
    }
}

// ... (Paste setupEventListeners unchanged, ensuring showSubcategoryDetailPage is called correctly) ...
function setupEventListeners() {
    // --- Navigation ---
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            // --- GORRANKARIYA 14: Tomarkirina scrollê berî guhertina rûpelê ---
            // Em li vir tomar nakin ji ber ku showPage dê bike
            // --- Dawiya Gorrankariyê 14 ---
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        // Reset filters when explicitly clicking home button
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        // --- GORRANKARIYA 15: Tomarkirina scrollê berî guhertina rûpelê ---
        saveMainPageScrollPosition(); // Tomar bike berî ku here settings
        // --- Dawiya Gorrankariyê 15 ---
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser back functionality
    };

    // --- Popups / Sheets ---
    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn'); // Highlight nav item
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn');
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn');
    };

    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet');
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal');
    };

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

    // Close popups/sheets
    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    // Close modal if clicking outside content
    window.onclick = (e) => {
        if (e.target.classList.contains('modal') && e.target.style.display === 'block') {
             closeCurrentPopup();
        }
    };


    // --- Forms ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginButton = e.target.querySelector('button[type="submit"]');
        const originalText = loginButton.textContent;
        loginButton.disabled = true;
        loginButton.textContent = '...چاوەڕێ بە';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Success: onAuthStateChanged will handle UI updates and close modal
            // No need to manually close here, prevents race conditions
        } catch (error) {
            console.error("Login Error:", error);
            showNotification(t('login_error'), 'error');
            loginButton.disabled = false; // Re-enable button on error
            loginButton.textContent = originalText;
        }
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        // Save profile data to state and local storage
        state.userProfile = {
            name: document.getElementById('profileName').value.trim(),
            address: document.getElementById('profileAddress').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup(); // Close the profile sheet
    };

    // --- Search ---
    const debouncedSearch = debounce((term) => {
        // --- GORRANKARIYA 16: Tomarkirina scrollê berî navîgasyonê ---
        // navigateToFilter dê scrollê tomar bike
        // --- Dawiya Gorrankariyê 16 ---
        navigateToFilter({ search: term }); // Apply search filter
    }, 500); // 500ms delay after user stops typing

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSearch(searchTerm); // Trigger debounced search
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Clear input
        clearSearchBtn.style.display = 'none'; // Hide clear button
        // --- GORRANKARIYA 17: Tomarkirina scrollê berî navîgasyonê ---
        // navigateToFilter dê scrollê tomar bike
        // --- Dawiya Gorrankariyê 17 ---
        navigateToFilter({ search: '' }); // Apply empty search filter
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
            await renderProductsOnDetailPage(subCatId, subSubCatId, term); // Re-render products on detail page
        }
        // Add logic here if search is needed on other subpages
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

    // --- Settings Actions ---
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open'); // Rotate chevron
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang); // Change language
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after use
                state.deferredPrompt.prompt(); // Show install prompt
                try {
                    const { outcome } = await state.deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                } catch (error) {
                     console.error("Error showing install prompt:", error);
                }
                state.deferredPrompt = null; // Clear prompt event
            }
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

    // --- Product Form Category Dependencies ---
    document.getElementById('productCategoryId').addEventListener('change', (e) => {
        const categoryId = e.target.value;
        // Populate subcategories based on main category selection
        window.AdminLogic.populateSubcategoriesDropdown(categoryId);
        // Reset and hide sub-subcategory dropdown
        window.AdminLogic.populateSubSubcategoriesDropdown(null, null);
    });

    document.getElementById('productSubcategoryId').addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId').value;
        const subcategoryId = e.target.value;
        // Populate sub-subcategories based on subcategory selection
        window.AdminLogic.populateSubSubcategoriesDropdown(mainCatId, subcategoryId);
    });

    // --- Image Preview for Product Form ---
    document.getElementById('imageInputsContainer').addEventListener('input', (e) => {
        if (e.target.classList.contains('productImageUrl')) {
            const previewImg = e.target.nextElementSibling; // Get the img element next to the input
            const url = e.target.value.trim();
            if (url && previewImg) {
                previewImg.src = url; // Update preview source
            } else if (previewImg) {
                // Reset to placeholder if URL is cleared
                const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        }
    });

    // --- Admin Form Submissions (delegated to admin.js) ---
    // Ensure admin.js adds its specific form submit listeners
}

// ... (Paste onAuthStateChanged unchanged) ...
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Use sessionStorage for temporary admin status
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Ensure admin logic is loaded before initializing
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
             console.warn("AdminLogic not found or initialize not a function. Admin features might not work.");
             // Attempt to load admin.js dynamically if needed (more complex setup)
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            // If a non-admin user is somehow signed in, sign them out.
            // This might happen if admin logs out and another Firebase user exists in browser cache.
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // Deinitialize admin UI if admin logic exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Clean up admin UI elements
        }
    }

    // Close login modal automatically only if login was successful (isAdmin is true)
    if (loginModal.style.display === 'block' && isAdmin) {
        // Find the close button and click it, or directly close
        const closeButton = loginModal.querySelector('.close');
        if (closeButton) {
             closeButton.click(); // Simulate clicking close
        } else {
             loginModal.style.display = 'none'; // Directly hide if no close button found
             document.body.classList.remove('overlay-active'); // Ensure overlay is removed
        }
    } else if (loginModal.style.display === 'block' && !isAdmin && user) {
         // If login attempted but failed (user exists but not admin), re-enable form
         const loginButton = loginForm.querySelector('button[type="submit"]');
         if (loginButton) {
              loginButton.disabled = false;
              loginButton.textContent = t('login_button');
         }
    }

    // Update general UI based on admin status (e.g., show/hide edit buttons)
    // This part might be better handled inside AdminLogic.initialize/deinitialize
    // Or call a specific function here:
    if (window.AdminLogic) {
         window.AdminLogic.updateAdminUI(isAdmin);
    } else if (!isAdmin) {
         // Ensure admin elements are hidden if AdminLogic hasn't loaded but user is not admin
         document.querySelectorAll('.product-actions').forEach(el => el.style.display = 'none');
         document.getElementById('addProductBtn').style.display = 'none';
         // Hide specific settings sections if needed
    }
});



// --- GORRANKARIYA 18: Nûvekirina init() ---
function init() {
    // --- Destpêka Guhertinê ---
    // Scroll restorationê manual bike
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
        // console.log("Scroll restoration set to manual."); // Ji bo debugê
    }
    // --- Dawiya Guhertinê ---

    renderSkeletonLoader(); // Skeleton nîşan bide

    // Hewl bide persistenceê çalak bike
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic(); // Mantiqê sepanê dest pê bike
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic(); // Her çawa be, sepanê dest pê bike
        });
}
// --- Dawiya Gorrankariyê 18 ---

function initializeAppLogic() {
    if (!state.sliderIntervals) state.sliderIntervals = {}; // Piştrast bike ku heye

    // Kategoriyan barke û UIya destpêkê saz bike
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // 'All' lê zêde bike
        updateCategoryDependentUI(); // Dropdown û bişkokan nûve bike

        // Barkirina rûpela destpêkê li gorî URLê (piştî barkirina kategoriyan)
        handleInitialPageLoad(); // Ev ê applyFilterState jî bang bike eger pêwîst be

        // Ziman bicîh bike piştî barkirina kategoriyan ji bo navên rast
        setLanguage(state.currentLanguage);

    }, (error) => {
         console.error("Error fetching categories:", error);
         // Hewl bide ku sepanê bê kategoriyan bidomîne yan peyamekê nîşan bide
         handleInitialPageLoad(); // Hewl bide dîsa jî rûpelê barke
         setLanguage(state.currentLanguage);
    });

    // Beşên din ên sepanê saz bike
    updateCartCount();
    setupEventListeners(); // Guhdarên bûyeran saz bike
    setupScrollObserver(); // Çavdêriya scrollê ji bo barkirina bêtir saz bike
    // setLanguage(state.currentLanguage); // Êdî di hundirê onSnapshot de tê kirin
    renderContactLinks(); // Lînkên têkiliyê barke
    checkNewAnnouncements(); // Kontrol bike ji bo agahdariyên nû
    showWelcomeMessage(); // Peyama bi xêr hatinê (tenê carekê)
    setupGpsButton(); // Fonksiyona GPSê ji bo profaylê
}

// Fonksiyon/guhêrbarên pêwîst ji bo admin.js eşkere bike
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Koleksiyonên nû

    // Fonksiyonên alîkar ji bo mantiqê admin
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Cacheê paqij bike
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Naveroka rûpela sereke paqij bike ji bo renderkirina nû
        }
    },
    setEditingProductId: (id) => { state.editingProductId = id; },
    getEditingProductId: () => state.editingProductId,
    getCategories: () => state.categories, // Kategoriyan bide admin
    getCurrentLanguage: () => state.currentLanguage // Zimanê heyî bide admin
});

// Destpêkirina sepanê
document.addEventListener('DOMContentLoaded', init);

// Handling PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Pêşî li info-barê bigire
    state.deferredPrompt = e; // Bûyerê hilîne
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex'; // Bişkokê nîşan bide
    console.log('`beforeinstallprompt` event fired.');
});


// Service Worker update handling
if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show'); // Agahdariya nûvekirinê nîşan bide
                }
            });
        });
        updateNowBtn.addEventListener('click', () => {
             // Ji SW re bêje ku skipWaiting bike
            registration.waiting?.postMessage({ action: 'skipWaiting' });
        });
    }).catch(err => console.log('Service Worker registration failed: ', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload(); // Rûpelê ji nû ve barke
    });
}