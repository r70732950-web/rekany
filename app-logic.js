// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی دووبارەبوونەوەی سلایدەر + Rûpela Nû ya Kategoriyê)

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
    // Only save scroll position for the main page filter state or main category page
    const activePage = document.querySelector('.page.page-active');
    if (activePage && (activePage.id === 'mainPage' || activePage.id === 'mainCategoryDetailPage') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const subpageSearch = subpageHeader.querySelector('.subpage-search'); // Find search within subpage header

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
        // Show search bar only on detail pages (sub and main category)
        subpageSearch.style.display = (pageId === 'subcategoryDetailPage' || pageId === 'mainCategoryDetailPage') ? 'flex' : 'none';
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
    } else if (pageId === 'subcategoryDetailPage' || pageId === 'mainCategoryDetailPage') { // NEW: Include main category page
        updateHeaderView(pageId, pageTitle); // Pass pageId here
    } else {
        updateHeaderView('mainPage');
    }

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    } else {
        // Deselect nav if not home or settings
        updateActiveNav(null);
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

    renderMainCategories(); // Always render main categories
    // Remove subcategory rendering from here, handled by specific pages
    // await renderSubcategories(state.currentCategory);

    // Render content based on whether it's home view or filter view
    await searchProductsInFirestore(state.currentSearch, true); // This now handles home vs filter view internally

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function navigateToFilter(newState) {
    // Save current state scroll before pushing new state
    history.replaceState({
        ...history.state, // Preserve existing state like category, subcategory etc.
        scroll: window.scrollY // Update scroll position
    }, '');

    // Combine current state with new state, reset scroll for new navigation
    const finalState = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        ...newState, // Apply changes from newState
        scroll: 0 // Reset scroll for the new filter state
     };

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    history.pushState(finalState, '', newUrl);

    await applyFilterState(finalState);
}

// Updated popstate handler
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI();
    const popState = event.state;
    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            let pageId = popState.id;

            // Refetch title if needed (for detail pages mainly)
            if ((pageId === 'subcategoryDetailPage' || pageId === 'mainCategoryDetailPage') && !pageTitle && popState.mainCatId) {
                try {
                    let docRef;
                    if (pageId === 'subcategoryDetailPage' && popState.subCatId) {
                        docRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    } else if (pageId === 'mainCategoryDetailPage') {
                        docRef = doc(db, "categories", popState.mainCatId);
                    }

                    if (docRef) {
                        const snap = await getDoc(docRef);
                        if (snap.exists()) {
                            const data = snap.data();
                            pageTitle = data['name_' + state.currentLanguage] || data.name_ku_sorani || 'Details';
                        }
                    }
                } catch (e) { console.error("Could not refetch title on popstate", e) }
            }

            // Show the correct page
            showPage(pageId, pageTitle);

            // If navigating back to a detail page, re-render its content
            if (pageId === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPage(popState.mainCatId, popState.subCatId, true); // Pass true for fromHistory
            } else if (pageId === 'mainCategoryDetailPage' && popState.mainCatId) {
                await showMainCategoryDetailPage(popState.mainCatId, true); // Pass true for fromHistory
            } else if (pageId === 'mainPage') {
                 // If navigating back to main page, apply its filter state
                 applyFilterState(popState, true);
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type);
        } else { // Handle filter states on the main page
            showPage('mainPage');
            applyFilterState(popState, true);
        }
    } else {
        // Default state if no history state exists (e.g., initial load or manual URL change)
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});


// Updated initial page load handler
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    let pageId = 'mainPage'; // Default to main page
    let pageTitle = '';
    let initialState = { scroll: 0 }; // Default state for history

    // Determine page based on hash
    if (hash.startsWith('subcategory_')) {
        pageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        initialState = { type: 'page', id: pageId, mainCatId: ids[1], subCatId: ids[2] };
        // Title will be fetched later in showSubcategoryDetailPage
    } else if (hash.startsWith('maincategory_')) {
        pageId = 'mainCategoryDetailPage';
        const ids = hash.split('_');
        initialState = { type: 'page', id: pageId, mainCatId: ids[1] };
        // Title will be fetched later in showMainCategoryDetailPage
    } else if (hash === 'settingsPage') {
        pageId = 'settingsPage';
        pageTitle = t('settings_title');
        initialState = { type: 'page', id: pageId, title: pageTitle };
    } else {
        // It's the main page, potentially with filters or a popup hash
        pageId = 'mainPage';
        initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
    }

    // Replace initial history entry
    history.replaceState(initialState, '', window.location.href);

    // Show the determined page (content rendering happens in initializeAppLogic or show...Page functions)
    showPage(pageId, pageTitle);

    // If the hash corresponds to a modal or sheet on the main page, open it
    if (pageId === 'mainPage') {
        const element = document.getElementById(hash);
        if (element) {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                openPopup(hash, isSheet ? 'sheet' : 'modal');
            }
        }
    }

    // Handle direct product link
    const productId = params.get('product');
    if (productId) {
        setTimeout(() => showProductDetails(productId), 500); // Delay slightly to ensure page is ready
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

    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear home sections on language change
    }

    // Re-render content based on current view
    const activePage = document.querySelector('.page.page-active');
    if (activePage && activePage.id === 'mainPage') {
         const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
         if (isHomeView) {
             renderHomePageContent(); // Rerender home layout
         } else {
             renderProducts(); // Rerender filtered products
         }
    } else if (activePage && activePage.id === 'mainCategoryDetailPage' && history.state && history.state.mainCatId) {
        showMainCategoryDetailPage(history.state.mainCatId, true); // Re-render main category detail page
    } else if (activePage && activePage.id === 'subcategoryDetailPage' && history.state && history.state.mainCatId && history.state.subCatId) {
        showSubcategoryDetailPage(history.state.mainCatId, history.state.subCatId, true); // Re-render sub category detail page
    }


    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
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
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
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
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorited
            heartIcon.classList.toggle('far', !isNowFavorite); // Regular heart if not
        }
    });


    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}

async function renderFavoritesPage() {
    favoritesContainer.innerHTML = '';

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';

    renderSkeletonLoader(favoritesContainer, 4);

    try {
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = '';

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
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        // Don't mark 'active' here as the sheet shows all options regardless of current filter

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             closeCurrentPopup(); // Close the sheet first
             if (cat.id === 'all') {
                // If 'All' is clicked, navigate to the main page with no filters
                await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
                showPage('mainPage'); // Ensure main page is shown
             } else {
                 // If a specific category is clicked, show its detail page
                 showMainCategoryDetailPage(cat.id);
             }
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// REMOVED renderSubSubcategories function as it's not needed on main page anymore

// Updated function to show subcategory detail page
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
        subCatName = 'Details';
    }

    const pageId = 'subcategoryDetailPage';

    if (!fromHistory) {
        history.pushState({ type: 'page', id: pageId, title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage(pageId, subCatName);

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    if(loader) loader.style.display = 'block';
    if(productsContainer) productsContainer.innerHTML = '';
    if(subSubContainer) subSubContainer.innerHTML = '';

    // Reset search for this page
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render content
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Render filter buttons first
    await renderProductsOnDetailPage(mainCatId, subCatId, 'all', ''); // Then render products (initially all)

    if(loader) loader.style.display = 'none';
}

// New function to render sub-subcategories on the SUBcategory detail page
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = '';

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories
            return;
        }

        container.style.display = 'flex'; // Show if there are sub-subcategories

        // Add 'All' button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Initially active
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Mark as the 'all' button
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(mainCatId, subCatId, 'all', currentSearch); // Fetch all products in this subcategory
        };
        container.appendChild(allBtn);

        // Add buttons for each sub-subcategory
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
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(mainCatId, subCatId, subSubcat.id, currentSearch); // Fetch products in this sub-subcategory
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}

// Updated function to render products on the SUBcategory detail page
async function renderProductsOnDetailPage(mainCatId, subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    if(loader) loader.style.display = 'block';
    if(productsContainer) productsContainer.innerHTML = '';

    try {
        let productsQuery;
        // Base query depends on whether a specific sub-subcategory is selected
        if (subSubCatId === 'all') {
             // Query products belonging to the parent subcategory only
             productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else {
             // Query products belonging specifically to the selected sub-subcategory
             productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term if present
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             // When searching, orderBy must match the inequality field first
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
             // Default order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Limit results (optional, could add pagination later if needed)
        // productsQuery = query(productsQuery, limit(50));

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

// REMOVED renderSubcategories function (replaced by rendering on detail pages)

// Updated renderMainCategories to navigate instead of filter
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // No 'active' state needed here anymore as we navigate away
        // if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        // CHANGED onclick behavior
        btn.onclick = async () => {
             if (cat.id === 'all') {
                // If 'All' is clicked, go back to unfiltered main page view
                await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
                showPage('mainPage'); // Ensure main page is shown
             } else {
                 // If a specific category is clicked, show its detail page
                 showMainCategoryDetailPage(cat.id);
             }
        };

        container.appendChild(btn);
    });
}

function showProductDetails(productId) {
    // Attempt to find product in cached state.products first
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // If not found in cache, try fetching directly
        console.log("Product not found locally for details view. Fetching from DB...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Show details with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
        });
        return; // Exit here, showProductDetailsWithData will be called by the promise
    }

    // If found in cache, show details directly
    showProductDetailsWithData(product);
}


async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q;
    // Prioritize finding products in the narrowest category possible
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Exclude the current product
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Fallback to main category if no subcategories
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
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section only if products were found

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll to top when opening
    }

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Add a placeholder if no images
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="No Image Available" class="active">`;
    }


    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return; // Check thumbnails only if they exist
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
         if (thumbnails.length > 0) thumbnails[index].classList.add('active'); // Update thumbnail only if they exist
        currentIndex = index;
    }

    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        thumbnailContainer.style.display = 'flex'; // Show thumbnails if multiple images
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        thumbnailContainer.style.display = 'none'; // Hide thumbnails if only one image
    }


    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close details sheet after adding
    };

    renderRelatedProducts(product); // Fetch and render related products

    openPopup('productDetailSheet'); // Open the bottom sheet
}

// Function to create promo card element (now takes sliderState)
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Reuse product-card for styling consistency

    // Function to update the image based on sliderState.currentIndex
    const updateImage = () => {
        const currentCard = cardData.cards[sliderState.currentIndex];
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;
        const imgElement = cardElement.querySelector('.product-image');
        if (imgElement) {
             imgElement.src = imageUrl;
             imgElement.alt = `Promotion ${sliderState.currentIndex + 1}`;
        }
         // Update click handler to use the current card's category ID
         cardElement.onclick = async (e) => {
             if (!e.target.closest('button')) { // Ignore clicks on buttons
                const targetCategoryId = currentCard.categoryId; // Use currentCard from closure
                if (targetCategoryId) {
                     showMainCategoryDetailPage(targetCategoryId); // Navigate to the category detail page
                }
             }
        };
    };

    // Initial HTML structure
    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    // Set initial image and click handler
    updateImage();

    // Add event listeners for prev/next buttons if they exist
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            updateImage(); // Update image and click handler
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            updateImage(); // Update image and click handler
        });
    }

    return cardElement;
}


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
        // Show discounted price and strikethrough original price
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    let extraInfoHTML = '';
    // Display shipping info if available in the current language or fallback
    const shippingText = (product.shippingInfo && product.shippingInfo[state.currentLanguage]?.trim()) || (product.shippingInfo && product.shippingInfo.ku_sorani?.trim());
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
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // fas for solid, far for regular
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
                 // Fallback: Copy link to clipboard
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
             if (err.name !== 'AbortError') { // Don't show error if user cancelled share
                 showNotification(t('share_error'), 'error');
             }
        }
    });


    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
             event.stopPropagation(); // Prevent opening details when clicking add to cart
            addToCart(product.id);
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Show spinner
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Show checkmark
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent; // Restore original button
                        addToCartButton.disabled = false;
                    }, 1500); // Duration to show checkmark
                }, 500); // Delay before showing checkmark
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
             event.stopPropagation();
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
             event.stopPropagation();
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event); // Pass event to stop propagation
        } else if (target.closest('.share-btn-card')) {
             // Event listener is already attached, propagation stopped there
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            showProductDetailsWithData(product); // Open details sheet
        }
    });
    return productCard;
}

function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% is visible
    });

    // Apply to newly added cards as well
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
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
    container.style.display = 'grid'; // Ensure it's displayed as grid

     // Hide actual products container if showing skeleton on main page
     if (container === skeletonLoader) {
        productsContainer.style.display = 'none';
        loader.style.display = 'none'; // Hide the small spinner too
     }
}

// Updated renderProducts for main page filtering
function renderProducts() {
    productsContainer.innerHTML = ''; // Clear previous products
    if (!state.products || state.products.length === 0) {
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        return;
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Observe newly added cards
}


async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Don't render if row doesn't exist

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use section name from layout config first, fallback to row title
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || (rowData.title && rowData.title[state.currentLanguage]) || (rowData.title && rowData.title.ku_sorani) || 'Row';

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
            const cardName = (cardData.name && cardData.name[state.currentLanguage]) || (cardData.name && cardData.name.ku_sorani);

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                // Determine the target category/page based on linked IDs
                if (cardData.subcategoryId && cardData.categoryId) {
                     // If subcategory is linked, go to subcategory detail page
                     showSubcategoryDetailPage(cardData.categoryId, cardData.subcategoryId);
                } else if (cardData.categoryId) {
                     // If only main category is linked, go to main category detail page
                     showMainCategoryDetailPage(cardData.categoryId);
                } else {
                     // If no category linked, filter all products (or do nothing)
                     await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
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


// Function updated to handle sub and sub-sub categories
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani) || 'Category Row'; // Use name from layout first
    let targetDocRef;

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
        // Fetch the name of the category/subcategory/subsubcategory for a more accurate title if needed
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Override with fetched name if available
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

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID
            if(subcategoryId) {
                 // If subcategory or subsubcategory is selected, go to the subcategory detail page
                 showSubcategoryDetailPage(categoryId, subcategoryId);
            } else if (categoryId) {
                 // If only main category is selected, go to main category detail page
                 showMainCategoryDetailPage(categoryId);
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Use the determined field and value
            orderBy('createdAt', 'desc'),
            limit(10) // Limit products shown in the row
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

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


// Function updated to take groupId
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID per group
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30)); // Fetch brands from specific group
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = (brand.name && brand.name[state.currentLanguage]) || (brand.name && brand.name.ku_sorani);

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                // Navigate based on linked category/subcategory
                if (brand.subcategoryId && brand.categoryId) {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                     showMainCategoryDetailPage(brand.categoryId);
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
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000); // Products added in the last 15 days
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo), // Filter by creation date
            orderBy('createdAt', 'desc'), // Show newest first
            limit(10) // Limit number shown in the row
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

// Renders the 'All Products' section on the home page (shows a limited grid)
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
        // Fetch only a few products initially for the home page section
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10)); // Limit to e.g., 10
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


// Updated renderHomePageContent to handle layout and slider cleanup
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        // Show skeleton loader while fetching layout
        renderSkeletonLoader(homeSectionsContainer, 1); // Show a simple loader

        // === START: Interval Cleanup Code ===
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
        // === END: Interval Cleanup Code ===

        homeSectionsContainer.innerHTML = ''; // Clear skeleton loader

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">لاپەڕەی سەرەکی هێشتا ڕێکنەخراوە.</p>';
        } else {
            // Use Promise.all to fetch and render sections concurrently (might improve perceived performance)
            const renderPromises = layoutSnapshot.docs.map(doc => {
                const section = doc.data();
                const layoutId = doc.id; // Get the unique ID for this layout item

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

            const renderedSections = await Promise.all(renderPromises);
            renderedSections.forEach(sectionElement => {
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            });
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
    }
}


// Updated renderPromoCardsSectionForHome to accept layoutId
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single promo slider too
    promoGrid.style.marginBottom = '16px'; // Consistent margin
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID using layoutId

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Pass all cards to the element creator

            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass sliderState
            promoGrid.appendChild(promoCardElement);

            // Setup automatic rotation only if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                             // Clean up global state if interval is cleared here
                             if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                             }
                        }
                        return; // Stop rotation if element is gone or interval deregistered
                    }
                    // Trigger the 'next' button's click logic programmatically
                    const nextButton = promoCardElement.querySelector('.promo-slider-btn.next');
                    if (nextButton) nextButton.click();
                };

                // Clear any previous interval for this specific layout item
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID
                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid; // Return the container with the promo card(s)
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}


// Updated search function to handle home vs filter view
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    // Toggle visibility between home layout and product grid
    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render home content only if it's empty (avoids re-rendering on every 'all' click)
        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        } else {
             // Ensure sliders restart if they were stopped (needed if navigating back to home)
             // This might need refinement based on how intervals are managed
             console.log("Home content already exists, potentially restarting sliders if needed.");
        }
        return; // Stop here for home view
    } else {
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        // Stop all promo rotations when navigating away from the full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
    }

    // --- Product Fetching Logic (only runs if not home view) ---

    // Cache logic (optional, keep if needed)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        // ... (cache retrieval logic remains the same)
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
        state.products = []; // Clear current products
        renderSkeletonLoader(); // Show skeleton for new search/filter
    }

    if (state.allProductsLoaded && !isNewSearch) return; // Don't load more if already loaded all

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show bottom loader for pagination

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        // Subcategory filters are now handled by detail pages, remove from here if causing issues
        // if (state.currentSubcategory && state.currentSubcategory !== 'all') {
        //     productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        // }
        // if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
        //     productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        // }


        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             // When searching, orderBy must match the inequality field first
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
             // Default order when not searching
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

        if (isNewSearch) {
            state.products = newProducts; // Replace products for new search
        } else {
            state.products = [...state.products, ...newProducts]; // Append for pagination
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none'; // Hide trigger if all loaded
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Show trigger for more
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        // Update cache if new search (optional)
        if (isNewSearch && state.productCache) {
             state.productCache[cacheKey] = {
                 products: state.products,
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
        }

        // Render the products (either initial batch or appended batch)
        renderProducts();

        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Hide bottom loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product grid is visible
    }
}


function addToCart(productId) {
    // Attempt to find product in locally cached state.products array first
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // If not found locally (e.g., added from favorites or direct link), fetch minimal data
        console.warn("Product not found in local 'products' array. Fetching minimal data for cart.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++;
                } else {
                    // Add only necessary info to cart
                    state.cart.push({
                        id: fetchedProduct.id,
                        name: fetchedProduct.name, // Store the name object
                        price: fetchedProduct.price,
                        image: mainImage,
                        quantity: 1
                    });
                }
                saveCart();
                showNotification(t('product_added_to_cart'));
            } else {
                showNotification(t('product_not_found_error'), 'error'); // Notify user if product doesn't exist anymore
            }
        }).catch(error => {
            console.error("Error fetching product for cart:", error);
            showNotification(t('error_generic'), 'error');
        });
        return; // Exit after initiating fetch
    }

    // If product found locally
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Add only necessary info to cart
        state.cart.push({
            id: product.id,
            name: product.name, // Store the name object
            price: product.price,
            image: mainImage,
            quantity: 1
        });
    }
    saveCart();
    showNotification(t('product_added_to_cart'));
}


function renderCart() {
    cartItemsContainer.innerHTML = '';
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Make sure action buttons are rendered

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language or fallback
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const placeholderImg = "https://placehold.co/60x60/e2e8f0/2d3748?text=N/A";

        cartItem.innerHTML = `
            <img src="${item.image || placeholderImg}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='${placeholderImg}'">
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
    totalAmount.textContent = total.toLocaleString();

     // Re-attach event listeners after rendering
     document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
     document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
     document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Remove if quantity reaches 0 or less
        } else {
            saveCart(); // Save changes
            renderCart(); // Re-render the cart UI
        }
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function generateOrderMessage() {
    if (state.cart.length === 0) return "";
    let message = t('order_greeting') + "\n\n";
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

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

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order might be needed

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Use a generic class or style directly
            btn.style.backgroundColor = method.color;
            btn.style.color = '#ffffff'; // Assume white text is best

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Viber link for initiating chat with text
                        link = `viber://chat?number=%2B${value}&draft=${encodedMessage}`;
                        // Fallback or alternative link if the above doesn't work well:
                        // link = `viber://add?number=${value}`; // Just adds contact
                        break;
                    case 'telegram':
                         // Use tg://resolve?domain=USERNAME&text=MESSAGE for usernames
                         // or tg://msg_url?url=URL&text=MESSAGE (less common for orders)
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        // Cannot prefill message for phone calls
                        break;
                    case 'url': // For custom URLs (e.g., forms, other messengers)
                        link = value; // Assume the value is the full URL
                        // Cannot easily pass order details via standard GET to an arbitrary URL
                        break;
                }

                if (link) {
                    window.open(link, '_blank');
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = '<p>Error loading sending options.</p>';
    }
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // Show badge
            } else {
                notificationBadge.style.display = 'none'; // Hide badge
            }
        } else {
             notificationBadge.style.display = 'none'; // Hide if no announcements
        }
    });
}

async function renderUserNotifications() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = '';
    if (snapshot.empty) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        const date = new Date(announcement.createdAt);
        // Simple date formatting
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

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

    // Update last seen timestamp and hide badge
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order might be useful

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.className = 'settings-item'; // Reuse existing style

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    });
}

function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;


    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Using Nominatim for reverse geocoding (OpenStreetMap data)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('ناونیشان وەرگیرا', 'success');
                    } else {
                        profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`; // Fallback to coordinates
                        showNotification('نەتوانرا ناوی ناونیشان بدۆزرێتەوە، تەنها شوێن وەرگیرا.', 'error');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`; // Fallback
                    showNotification('هەڵەیەک لە وەرگرتنی ناوی ناونیشان ڕوویدا', 'error');
                } finally {
                    btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let message = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'شوێنەکەت نەدۆزرایەوە';
                        break;
                    case error.TIMEOUT:
                        message = 'کاتی داواکارییەکە تەواو بوو';
                        break;
                    default:
                        message = 'هەڵەیەکی نادیار ڕوویدا';
                        break;
                }
                showNotification(message, 'error');
                btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { // Options
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds timeout
                maximumAge: 0 // Force fresh location
            }
        );
    });
}


function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Trigger only when entering viewport and not already loading/finished
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
             console.log("Scroll trigger intersected, loading more products...");
            // Load more products based on the current filter/search state on the MAIN page
            searchProductsInFirestore(state.currentSearch, false);
        }
    }, {
        root: null, // relative to document viewport
        threshold: 0.1 // trigger when 10% of the element is visible
    });

    observer.observe(trigger);
}

function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // For admin product form
    renderMainCategories(); // For main page navigation/buttons
    renderCategoriesSheet(); // For the categories bottom sheet

    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Ensure shortcut dropdowns are also updated
    }
}

function setupEventListeners() {
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            // Push state ONLY if navigating FROM another page (like settings)
            history.pushState({ type: 'page', id: 'mainPage', ...{ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 } }, '', window.location.pathname); // Reset URL path
            showPage('mainPage');
        }
        // Always reset filters when home button is explicitly clicked
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };


    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    // Make the back button always use history.back()
    document.getElementById('headerBackBtn').onclick = () => {
        history.back();
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn');
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

    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Admin logic initialization will happen via onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };

    // --- Search Logic ---
    // Debounced function for main page search
    const debouncedMainSearch = debounce((term) => {
        navigateToFilter({ search: term }); // Use navigateToFilter for main page search
    }, 500);

    // Debounced function for subpage (detail page) search
    const debouncedSubpageSearch = debounce(async (term) => {
         const activePage = document.querySelector('.page.page-active');
         if (!activePage) return;

         if (activePage.id === 'subcategoryDetailPage' && history.state && history.state.mainCatId && history.state.subCatId) {
             const mainCatId = history.state.mainCatId;
             const subCatId = history.state.subCatId;
             // Find active sub-sub button
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
             await renderProductsOnDetailPage(mainCatId, subCatId, subSubCatId, term);
         } else if (activePage.id === 'mainCategoryDetailPage' && history.state && history.state.mainCatId) {
             const mainCatId = history.state.mainCatId;
              // Find active sub button
             const activeSubBtn = document.querySelector('#subCategoryContainerOnMainDetailPage .subcategory-btn.active');
             const subCatId = activeSubBtn ? (activeSubBtn.dataset.id || 'all') : 'all';
             await renderProductsOnMainDetailPage(mainCatId, subCatId, term);
         }
    }, 500);

    // Main page search input
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedMainSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        debouncedMainSearch(''); // Trigger search with empty term
    };

    // Subpage search input
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

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
    // --- End Search Logic ---


    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open'); // Toggle chevron direction
    };


    profileForm.onsubmit = (e) => {
        e.preventDefault();
        state.userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompting
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear prompt
            }
        });
    }

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

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

    // Handle foreground FCM messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; // Show badge immediately
    });
}

// Auth state change handler
onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
         // Ensure admin logic is initialized only once and after page load
         const initializeAdmin = () => {
            if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                 window.AdminLogic.initialize();
            } else {
                 console.warn("AdminLogic not found or initialize not a function.");
            }
         };
         if (document.readyState === 'complete') {
            initializeAdmin();
         } else {
             window.addEventListener('load', initializeAdmin, { once: true }); // Ensure it runs only once
         }

    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            // If a non-admin user is somehow signed in, sign them out.
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
         // Deinitialize admin UI if admin logic exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Close login modal if admin logs in successfully
    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


// Main initialization function
function init() {
    renderSkeletonLoader(productsContainer); // Show skeleton on the main product grid initially

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Init app after persistence setup
        })
        .catch((err) => {
            console.error("Error enabling persistence, running online:", err);
            initializeAppLogic(); // Init app even if persistence fails
        });
}

// Function to initialize core app logic after persistence setup
function initializeAppLogic() {
    if (!state.sliderIntervals) { // Ensure sliderIntervals object exists
        state.sliderIntervals = {};
    }

    // Fetch categories first, then handle initial page load
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: 'هەموو', name_ku_badini: 'هەمی', name_ar: 'الكل' }, ...fetchedCategories];
        updateCategoryDependentUI(); // Update UI that depends on categories

        // Now that categories are loaded, handle the initial URL state correctly
        handleInitialPageLoad();

        // Apply language AFTER categories and initial load handling
        setLanguage(state.currentLanguage);

         // Initial setup that doesn't strictly depend on categories
         updateCartCount();
         setupEventListeners();
         setupScrollObserver();
         renderContactLinks();
         checkNewAnnouncements();
         showWelcomeMessage();
         setupGpsButton();

    }, error => {
         console.error("Error fetching categories:", error);
          // Handle error, maybe show a message to the user
         document.getElementById('mainCategoriesContainer').innerHTML = '<p>Error loading categories</p>';
         productsContainer.innerHTML = '<p>Error loading app content.</p>'; // Show error in product area too
         skeletonLoader.style.display = 'none';
    });
}


// Expose necessary functions/variables for admin.js
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, // Pass new collections

    // Helper functions for admin logic
    clearProductCache: () => {
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {}; // Clear the cache
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Clear home page to force re-render
        }
        // Force re-render of current view (home or filtered products)
        const activePage = document.querySelector('.page.page-active');
        if (activePage && activePage.id === 'mainPage'){
             searchProductsInFirestore(state.currentSearch, true);
        }
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
    e.preventDefault(); // Prevent the default mini-infobar
    state.deferredPrompt = e; // Stash the event
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex'; // Show install button
    console.log('`beforeinstallprompt` event fired.');
});


// Service Worker update handling
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
                    updateNotification.classList.add('show'); // Show update bar
                }
            });
        });

        updateNowBtn.addEventListener('click', () => {
             // Ensure registration.waiting exists before posting message
             if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
             } else {
                 console.warn("No waiting service worker found to skip.");
                 // Optionally hide the notification or reload directly
                 updateNotification.classList.remove('show');
                 window.location.reload();
             }
        });

    }).catch(err => console.log('SW registration failed: ', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New SW activated. Reloading...');
        window.location.reload(); // Reload page to use the new SW
    });
}

// --- NEW FUNCTIONS FOR MAIN CATEGORY DETAIL PAGE ---

// Renders subcategory buttons on the main category detail page
async function renderSubcategoriesOnMainDetailPage(mainCatId) {
    const container = document.getElementById('subCategoryContainerOnMainDetailPage');
    container.innerHTML = ''; // Clear previous

    try {
        const subcategoriesQuery = collection(db, "categories", mainCatId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        // Add 'All' button first
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active initially
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnMainDetailPage(mainCatId, 'all', currentSearch); // Fetch all products in main category
        };
        container.appendChild(allBtn);

        if (querySnapshot.empty && container.children.length <= 1) { // If only 'All' button exists
            container.style.display = 'none'; // Hide container if no actual subcategories
        } else {
             container.style.display = 'flex'; // Ensure visible if subcategories exist
             querySnapshot.forEach(subDoc => {
                const subcat = { id: subDoc.id, ...subDoc.data() };
                const subcatBtn = document.createElement('button');
                subcatBtn.className = `subcategory-btn`;
                subcatBtn.dataset.id = subcat.id;

                const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
                const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                const imageUrl = subcat.imageUrl || placeholderImg;

                subcatBtn.innerHTML = `
                    <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                    <span>${subcatName}</span>
                `;

                subcatBtn.onclick = () => {
                     // Check if this subcategory has sub-subcategories
                     const subSubRef = collection(db, "categories", mainCatId, "subcategories", subcat.id, "subSubcategories");
                     getDocs(query(subSubRef, limit(1))).then(snap => {
                        if (!snap.empty) {
                             // If it has sub-subcategories, navigate to the subcategory detail page
                             showSubcategoryDetailPage(mainCatId, subcat.id);
                        } else {
                             // Otherwise, filter products on the current main category page
                             container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                             subcatBtn.classList.add('active');
                             const currentSearch = document.getElementById('subpageSearchInput').value;
                             renderProductsOnMainDetailPage(mainCatId, subcat.id, currentSearch);
                        }
                     });
                };
                container.appendChild(subcatBtn);
            });
        }

    } catch (error) {
        console.error("Error fetching subcategories for main detail page:", error);
        container.innerHTML = '<p>Error loading subcategories.</p>';
        container.style.display = 'flex'; // Ensure container is visible to show error
    }
}


// Renders products on the main category detail page, filtered by subcategory
async function renderProductsOnMainDetailPage(mainCatId, subCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnMainDetailPage');
    const loader = document.getElementById('mainDetailPageLoader');
    if(loader) loader.style.display = 'block';
    if(productsContainer) productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query depends on whether 'All' or a specific subcategory is selected
        if (subCatId === 'all') {
             // Query products belonging to the main category
             productsQuery = query(productsCollection, where("categoryId", "==", mainCatId));
        } else {
             // Query products belonging specifically to the selected subcategory
             // (We assume products tagged with a subcategory also have the main category ID)
             productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        }

        // Apply search term if present
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             // When searching, orderBy must match the inequality field first
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
             // Default order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Limit results (optional, could add pagination later)
        // productsQuery = query(productsQuery, limit(50));

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsContainer.appendChild(card);
            });
            setupScrollAnimations(); // Apply scroll animations to newly added cards
        }
    } catch (error) {
        console.error(`Error fetching products for main detail page (mainCatId: ${mainCatId}, subCatId: ${subCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

// --- END NEW FUNCTIONS ---
