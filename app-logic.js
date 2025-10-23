// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی دووبارەبوونەوەی سلایدەر + Guhertina navîgasyona kategoriyan + Fix Freeze on Back Navigation - TEMAM)

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
    // Avoid saving if the current state is a page type (detail/settings)
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

// *** UPDATED: updateHeaderView Function ***
// Now handles titles correctly for both detail pages (main cat and sub cat)
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
        // Show search only on subcategory detail page, not main category detail page initially
        const currentState = history.state;
        if (currentState && currentState.id === 'subcategoryDetailPage' && currentState.subCatId) {
             subpageSearch.style.display = 'block'; // Show search for subcategory
        } else if (currentState && currentState.id === 'subcategoryDetailPage' && currentState.mainCatId && !currentState.subCatId) {
            subpageSearch.style.display = 'none'; // Hide search when viewing main category
        } else if (pageId === 'settingsPage') {
             subpageSearch.style.display = 'none'; // Hide search on settings
        } else {
             // Default might need adjustment depending on other pages
             subpageSearch.style.display = 'none';
        }
    }
}


function showPage(pageId, pageTitle = '') {
    console.log(`Showing page: ${pageId} with title: "${pageTitle}"`); // Logging
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    if (pageId !== 'mainPage') {
        // Only scroll to top if NOT navigating back with existing scroll state
        const currentState = history.state;
        if (!currentState || currentState.scroll === undefined || currentState.scroll === 0) {
             window.scrollTo(0, 0);
        }
    }


    updateHeaderView(pageId, pageTitle); // Use the updated header function

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    } else {
        // If navigating to detail page, deactivate all nav buttons
        if (pageId === 'subcategoryDetailPage') {
            updateActiveNav(null);
        }
    }
}


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening popup
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Lazy load content for specific sheets
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
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scroll
    history.pushState({ type: type, id: id }, '', `#${id}`); // Push popup state
}


function closeCurrentPopup() {
    // Check if the current state is a popup state
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Use browser back to close popup and restore previous state
    } else {
        // Fallback if history state is somehow incorrect
        closeAllPopupsUI();
    }
}


async function applyFilterState(filterState, fromPopState = false) {
    console.log("Applying filter state:", filterState, "fromPopState:", fromPopState); // Add logging
    // Ensure we are applying this state to the main page
    if (!document.getElementById('mainPage').classList.contains('page-active')) {
         console.log("applyFilterState: Not on main page, switching and applying.");
         showPage('mainPage'); // Switch to main page if not already visible
    }

    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all'; // Usually 'all' for main page filters
    state.currentSubSubcategory = filterState.subSubcategory || 'all'; // Usually 'all'
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(); // Rerender main categories to show active state

    // Trigger content rendering (will decide between home sections and product grid)
    // Pass true for isNewSearch to force refresh based on the filterState
    await searchProductsInFirestore(state.currentSearch, true);

    // Scrolling is handled within searchProductsInFirestore based on isNewSearch and popState scroll
    if (fromPopState && typeof filterState.scroll === 'number') {
        console.log("Scrolling to popped state:", filterState.scroll);
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50); // Restore scroll after rendering
    } else if (!fromPopState) {
        // If not from popstate, scrolling to top is handled by searchProductsInFirestore
    }
     updateHeaderView('mainPage'); // Ensure header is correct
}


async function navigateToFilter(newState) {
     // Save scroll position of the current main page state BEFORE navigating
    if (document.getElementById('mainPage').classList.contains('page-active')) {
        history.replaceState({
            category: state.currentCategory,
            // subcategory: state.currentSubcategory, // Not needed for main page filters
            // subSubcategory: state.currentSubSubcategory, // Not needed
            search: state.currentSearch,
            scroll: window.scrollY
        }, '');
        console.log("Saved current main page state before navigating:", history.state);
    }


    const finalState = {
        category: newState.category !== undefined ? newState.category : 'all', // Default to 'all'
        // subcategory: 'all', // Always 'all' for main page filters
        // subSubcategory: 'all', // Always 'all'
        search: newState.search !== undefined ? newState.search : '', // Default to empty search
        scroll: 0 // Reset scroll for new filter state
     };

    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    // No need for subcategory/subsubcategory params on main page
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Push the NEW filter state
    console.log("Pushing new filter state:", finalState);
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state
    await applyFilterState(finalState);
}


// *** UPDATED: popstate Handler ***
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Close any popups first
    const popState = event.state;
    console.log("Popstate received:", popState); // Add logging

    if (popState) {
        if (popState.type === 'page') {
            let pageTitle = popState.title;
            // Fetch title if missing (especially important for detail pages)
            if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId) {
                console.log("Popstate: Detail page missing title, fetching...");
                try {
                    let catRef, catSnap, catData;
                    if(popState.subCatId) { // Popped to subcategory view
                         catRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                    } else { // Popped to main category view
                         catRef = doc(db, "categories", popState.mainCatId);
                    }
                    catSnap = await getDoc(catRef);
                    if (catSnap.exists()) {
                        catData = catSnap.data();
                        pageTitle = catData['name_' + state.currentLanguage] || catData.name_ku_sorani || (popState.subCatId ? 'Details' : 'Category');
                        popState.title = pageTitle; // Update title in state
                        // No need to replaceState here as we are applying the popped state
                    } else {
                         pageTitle = popState.subCatId ? 'Details' : 'Category'; // Fallback title
                    }
                } catch(e) { console.error("Could not refetch title on popstate", e); pageTitle = popState.subCatId ? 'Details' : 'Category'; } // Fallback title on error
            } else if (popState.id === 'settingsPage' && !pageTitle) {
                pageTitle = t('settings_title'); // Ensure settings title is set
            }

            console.log(`Popstate: Showing page ${popState.id} with title "${pageTitle}"`);
            showPage(popState.id, pageTitle);

            // If popping back TO a detail page, re-render its content cleanly
            if (popState.id === 'subcategoryDetailPage' && popState.mainCatId) {
                 const loader = document.getElementById('detailPageLoader');
                 const productsContainer = document.getElementById('productsContainerOnDetailPage');
                 const subCatContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
                 loader.style.display = 'block'; // Show loader while rendering
                 productsContainer.innerHTML = '';
                 subCatContainer.innerHTML = '';

                 if (popState.subCatId) {
                     // Popped back to a specific subcategory view
                     console.log("Popstate: Re-rendering subcategory detail", popState);
                     await renderSubSubcategoriesOnDetailPage(popState.mainCatId, popState.subCatId);
                     await renderProductsOnDetailPage(popState.subCatId, 'all', ''); // Reset search on back
                 } else {
                     // Popped back to a main category view
                     console.log("Popstate: Re-rendering main category detail", popState);
                     await renderSubcategoriesOnDetailPage(popState.mainCatId);
                     await renderProductsOnDetailPage(null, 'all', '', popState.mainCatId); // Fetch by mainCatId
                 }
                 loader.style.display = 'none'; // Hide loader after rendering
             }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             console.log("Popstate: Opening popup", popState);
            openPopup(popState.id, popState.type);
        } else {
            // Popped to a main page filter state (or potentially initial state if it had filters)
            console.log("Popstate: Applying main page filter state", popState);
            // applyFilterState will call showPage('mainPage') if needed
            applyFilterState(popState, true); // Apply filters and restore scroll
        }
    } else {
        // Popped to the initial state (no state object) - the base URL before any navigation
        console.log("Popstate: Popped to initial state (base URL). Applying default state.");
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        // applyFilterState will call showPage('mainPage')
        applyFilterState(defaultState, true); // Apply default filters, scroll handled by applyFilterState
    }
});



// *** UPDATED: handleInitialPageLoad Function ***
// Handles initial load for main category views, subcategory views, and filters
async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product'); // Check for product detail first

    let pageId = 'mainPage';
    let mainCatId = null;
    let subCatId = null;
    let pageTitle = '';
    let initialStateForHistory = null;

    // Determine page based on hash
    if (hash.startsWith('category_')) {
        pageId = 'subcategoryDetailPage'; // Use detail page for main category view
        mainCatId = hash.split('_')[1];
    } else if (hash.startsWith('subcategory_')) {
        pageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        mainCatId = ids[1];
        subCatId = ids[2];
    } else if (hash === 'settingsPage') {
        pageId = 'settingsPage';
        pageTitle = t('settings_title');
    }

    // Wait for categories to load before potentially fetching titles
    await waitForCategories();

    // Fetch titles if needed for detail pages
    if (pageId === 'subcategoryDetailPage') {
         try {
             let catRef, catSnap, catData;
             if (subCatId) {
                  catRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
             } else {
                  catRef = doc(db, "categories", mainCatId);
             }
             catSnap = await getDoc(catRef);
             if (catSnap.exists()) {
                 catData = catSnap.data();
                 pageTitle = catData['name_' + state.currentLanguage] || catData.name_ku_sorani || (subCatId ? 'Details' : 'Category');
             } else {
                 pageTitle = subCatId ? 'Details' : 'Category'; // Fallback if not found
             }
         } catch(e) {
             console.error("Error fetching title on initial load", e);
             pageTitle = subCatId ? 'Details' : 'Category'; // Fallback on error
         }
         initialStateForHistory = { type: 'page', id: pageId, title: pageTitle, mainCatId: mainCatId, subCatId: subCatId };
    } else if (pageId === 'settingsPage') {
         initialStateForHistory = { type: 'page', id: pageId, title: pageTitle };
    } else { // It's the mainPage
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: 'all', // Always 'all' on main page
            subSubcategory: 'all', // Always 'all' on main page
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is 0
        };
        initialStateForHistory = initialState;
        // Apply filters immediately for main page
        applyFilterState(initialState);
    }

    // Replace initial history entry AFTER determining page and potentially applying filters
    console.log("Replacing initial history state with:", initialStateForHistory);
    history.replaceState(initialStateForHistory, '', window.location.href); // Use full href

    // Show the determined page (applyFilterState handles this for main page)
    if (pageId !== 'mainPage') {
        showPage(pageId, pageTitle);

        // Render content for the detail page if applicable
        if (pageId === 'subcategoryDetailPage') {
            const loader = document.getElementById('detailPageLoader');
            loader.style.display = 'block';
            if (subCatId) {
                await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
                await renderProductsOnDetailPage(subCatId, 'all', '');
            } else {
                await renderSubcategoriesOnDetailPage(mainCatId); // Render subcategories here
                await renderProductsOnDetailPage(null, 'all', '', mainCatId); // Render main category products
            }
             loader.style.display = 'none';
        }
    } else {
         // Check if a popup needs to be opened based on hash on the main page
         const element = document.getElementById(hash);
          if (element && pageId === 'mainPage') {
              const isSheet = element.classList.contains('bottom-sheet');
              const isModal = element.classList.contains('modal');
              if (isSheet || isModal) {
                  // Don't call openPopup directly, let popstate handle it if needed
                  // or potentially push state *after* initial replaceState if necessary
                  // For simplicity, let's assume popups aren't opened on initial load via hash for now
                  console.log("Initial load hash matches a popup, but skipping auto-open.");
              }
          }
    }


    // Handle direct product link LAST, potentially opening over the current view
    if (productId) {
        // Ensure the base page (main or detail) is rendered before opening product details
        setTimeout(() => showProductDetails(productId), pageId === 'mainPage' ? 100 : 600); // Delay slightly longer if detail page is loading
    }
}


// Helper function to wait until categories are loaded
function waitForCategories() {
    return new Promise(resolve => {
        if (state.categories.length > 0) {
            resolve();
        } else {
            const interval = setInterval(() => {
                if (state.categories.length > 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        }
    });
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
        // Rerender content based on current view
        const currentPage = document.querySelector('.page.page-active');
        if(currentPage && currentPage.id === 'mainPage') {
            const isHomeView = state.currentCategory === 'all' && !state.currentSearch;
            if (isHomeView) {
                renderHomePageContent(); // Rerender home content with new language
            } else {
                renderProducts(); // Rerender filtered products
            }
        } else if (currentPage && currentPage.id === 'subcategoryDetailPage') {
            // Re-fetch title and potentially re-render content if needed
            const currentState = history.state;
             if(currentState && currentState.type === 'page' && currentState.id === 'subcategoryDetailPage') {
                waitForCategories().then(async () => { // Ensure categories are loaded for title lookup
                    let pageTitle = '';
                     try {
                         let catRef, catSnap, catData;
                         if (currentState.subCatId) {
                              catRef = doc(db, "categories", currentState.mainCatId, "subcategories", currentState.subCatId);
                         } else {
                              catRef = doc(db, "categories", currentState.mainCatId);
                         }
                         catSnap = await getDoc(catRef);
                         if (catSnap.exists()) {
                             catData = catSnap.data();
                             pageTitle = catData['name_' + state.currentLanguage] || catData.name_ku_sorani || (currentState.subCatId ? 'Details' : 'Category');
                             currentState.title = pageTitle; // Update title in state
                             history.replaceState(currentState, ''); // Update history state title
                             updateHeaderView(currentState.id, pageTitle); // Update header immediately
                             // Optionally re-render product names if needed, but usually handled by createProductCardElement
                             // Re-render sub/subsub category buttons if they exist
                             if(currentState.subCatId) {
                                 await renderSubSubcategoriesOnDetailPage(currentState.mainCatId, currentState.subCatId);
                             } else {
                                 await renderSubcategoriesOnDetailPage(currentState.mainCatId);
                             }
                             // Re-render products to update names
                             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
                            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
                            const currentSearch = document.getElementById('subpageSearchInput').value;
                             await renderProductsOnDetailPage(currentState.subCatId, subSubCatId, currentSearch, currentState.mainCatId);


                         }
                     } catch(e) { console.error("Error updating title on language change", e); }
                });
            }
        }
    }


    renderMainCategories(); // Rerender main category buttons
    renderCategoriesSheet(); // Rerender category sheet
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
    if (document.getElementById('settingsPage').classList.contains('page-active')) updateHeaderView('settingsPage', t('settings_title'));

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
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
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
            heartIcon.classList.toggle('fas', isNowFavorite);
            heartIcon.classList.toggle('far', !isNowFavorite);
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
        setTimeout(() => {
             if (notification.parentNode === document.body) {
                document.body.removeChild(notification);
             }
        }, 300);
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

        // Active state only shown if on main page and category matches
        if (state.currentCategory === cat.id && document.getElementById('mainPage').classList.contains('page-active')) {
             btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             closeCurrentPopup(); // Close sheet first
            if (cat.id === 'all') {
                 // If 'All' is clicked, ensure we are on the main page and reset filters
                 if (!document.getElementById('mainPage').classList.contains('page-active')) {
                      history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
                      showPage('mainPage');
                 }
                await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
            } else {
                showMainCategoryDetailPage(cat.id); // Navigate to detail page
            }
        };


        sheetCategoriesContainer.appendChild(btn);
    });
}


async function renderSubSubcategories(mainCatId, subCatId) {
    // This function is no longer needed on the main page.
    subSubcategoriesContainer.innerHTML = '';
}

// *** NEW Function: showMainCategoryDetailPage ***
// Handles navigation when a main category button is clicked
async function showMainCategoryDetailPage(mainCatId, fromHistory = false) {
    let mainCatName = '';
     try {
         const catRef = doc(db, "categories", mainCatId);
         const catSnap = await getDoc(catRef);
         if (catSnap.exists()) {
             const catData = catSnap.data();
             mainCatName = catData['name_' + state.currentLanguage] || catData.name_ku_sorani || 'Category';
         }
     } catch (e) {
         console.error("Could not fetch main category name:", e);
         mainCatName = 'Category';
     }

     // Use a distinct hash for main category view
     const newHash = `#category_${mainCatId}`;

     if (!fromHistory) {
         history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: mainCatName, mainCatId: mainCatId, subCatId: null }, '', newHash);
     }
     showPage('subcategoryDetailPage', mainCatName);

     const loader = document.getElementById('detailPageLoader');
     const productsContainer = document.getElementById('productsContainerOnDetailPage');
     const subCatContainer = document.getElementById('subSubCategoryContainerOnDetailPage'); // We'll reuse this container

     loader.style.display = 'block';
     productsContainer.innerHTML = '';
     subCatContainer.innerHTML = '';

     document.getElementById('subpageSearchInput').value = '';
     document.getElementById('subpageClearSearchBtn').style.display = 'none';

     await renderSubcategoriesOnDetailPage(mainCatId); // Render subcategories into the designated container
     await renderProductsOnDetailPage(null, 'all', '', mainCatId); // Render products for the main category

     loader.style.display = 'none';
}

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

    const newHash = `#subcategory_${mainCatId}_${subCatId}`;

    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', newHash);
    }
    showPage('subcategoryDetailPage', subCatName);

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';

    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Load all products for this subcategory initially

    loader.style.display = 'none';
}


// *** NEW Function: renderSubcategoriesOnDetailPage ***
// Renders subcategory buttons when viewing a main category on the detail page
async function renderSubcategoriesOnDetailPage(mainCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage'); // Reuse container
    container.innerHTML = ''; // Clear previous content (like sub-subcategories)

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex'; // Make sure it's visible

        // Add 'All' button for this main category view
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active initially
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
             container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
             allBtn.classList.add('active');
             renderProductsOnDetailPage(null, 'all', '', mainCatId); // Load all main category products
        };
        container.appendChild(allBtn);


        snapshot.forEach(doc => {
            const subcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subcat.id;
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;

            btn.onclick = () => {
                // When a subcategory is clicked FROM the main category view, navigate to the subcategory detail view
                showSubcategoryDetailPage(mainCatId, subcat.id);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching subcategories for detail page:", error);
        container.style.display = 'none';
    }
}


async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = '';

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Ji bo nasîna bişkojê
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Fetch products for the parent subcategory
        };
        container.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Ji bo nasîna bişkojê
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Fetch products for this specific sub-subcategory
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}

// *** UPDATED: renderProductsOnDetailPage Function ***
// Now accepts mainCatId to fetch products for a main category view
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '', mainCatId = null) {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';

    try {
        let productsQuery;

        if (mainCatId && !subCatId) {
            // Fetching for a main category view
            productsQuery = query(productsCollection, where("categoryId", "==", mainCatId));
        } else if (subCatId && subSubCatId === 'all') {
             // Fetching for a subcategory (all its sub-subcategories)
            productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));
        } else if (subSubCatId !== 'all') {
            // Fetching for a specific sub-subcategory
            productsQuery = query(productsCollection, where("subSubcategoryId", "==", subSubCatId));
        } else {
             // Fallback or error case? Should not happen with new navigation
             console.error("Invalid state for renderProductsOnDetailPage");
             productsContainer.innerHTML = '<p>Error loading products.</p>';
             loader.style.display = 'none';
             return;
        }


        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // If searching, first orderBy must match inequality field
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // If not searching, use the original orderBy
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

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
        console.error(`Error fetching products for detail page (mainCatId: ${mainCatId}, subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none';
    }
}


async function renderSubcategories(categoryId) {
    // This function is no longer needed on the main page for subcategory buttons.
    // It's replaced by renderSubcategoriesOnDetailPage for the detail view.
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Keep it cleared on the main page
    subcategoriesContainer.style.display = 'none'; // Hide the container on main page
}

// *** UPDATED: renderMainCategories Function ***
// Onclick now navigates to detail page instead of filtering main page
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Active state is now only relevant if we are on the main page AND 'all' is selected
         if (state.currentCategory === cat.id && document.getElementById('mainPage').classList.contains('page-active')) {
             btn.classList.add('active');
         }


        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             if (cat.id === 'all') {
                // If 'All' is clicked, ensure we are on the main page and reset filters
                 if (!document.getElementById('mainPage').classList.contains('page-active')) {
                      history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
                      showPage('mainPage');
                 }
                await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
             } else {
                 // For specific categories, navigate to the detail page view
                 showMainCategoryDetailPage(cat.id);
             }
         };


        container.appendChild(btn);
    });
}


function showProductDetails(productId) {
    const allFetchedProducts = [...state.products];
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found for details view. Trying to fetch...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        });
        return;
    }
    showProductDetailsWithData(product);
}

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return;
    }

    let q;
    let baseQuery; // Start with the base collection

    // Determine the most specific category level
    if (currentProduct.subSubcategoryId) {
        baseQuery = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId)
        );
    } else if (currentProduct.subcategoryId) {
         baseQuery = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId)
        );
    } else {
         baseQuery = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId)
        );
    }

    // Add condition to exclude the current product and limit
    // Note: Firestore requires the first orderBy to match the inequality field if used.
    q = query(
        baseQuery,
        where('__name__', '!=', currentProduct.id), // Exclude the current product
        orderBy('__name__'), // Order by document ID first because of inequality
        limit(6)
    );
     // Add a final ordering if desired (e.g., by creation date)
     q = query(q, orderBy('createdAt', 'desc'));


    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
         // You might see errors here if composite indexes are missing in Firestore
         // especially when combining `where` on one field and `orderBy` on another.
         // Check Firestore console for index creation links if errors occur.
    }
}



function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
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
         const img = document.createElement('img');
         img.src = 'https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image';
         img.alt = nameInCurrentLang;
         img.classList.add('active');
         imageContainer.appendChild(img);
    }


    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return; // Check thumbnails length
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        if (thumbnails[index]) thumbnails[index].classList.add('active'); // Check if thumbnail exists
        currentIndex = index;
    }


    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
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
        closeCurrentPopup();
    };

    renderRelatedProducts(product); // Fetch and render related products

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
        if (!e.target.closest('button')) {
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 // Navigate to the main category detail page
                 showMainCategoryDetailPage(targetCategoryId);
                 document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' }); // Scroll if needed
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
            // Event listener is already attached
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            showProductDetailsWithData(product);
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
        threshold: 0.1
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = '';
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
    container.style.display = 'grid';
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none'; // Ensure real products are hidden
      loader.style.display = 'none';
      document.getElementById('homePageSectionsContainer').style.display = 'none'; // Hide home sections
    }
}


function renderProducts() {
    productsContainer.innerHTML = ''; // Clear previous products first
    if (!state.products || state.products.length === 0) {
        // If products array is empty after a filter/search, display message in productsContainer
         const shouldShowHomeSections = !state.currentSearch && state.currentCategory === 'all';
         if (!shouldShowHomeSections) { // Only show 'not found' if not in home view
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
            productsContainer.style.display = 'grid'; // Ensure container is visible for the message
         }
        return;
    }


    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
}


async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
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
                 // Navigate based on linked category/subcategory/subsubcategory
                 if (cardData.subcategoryId && cardData.categoryId) {
                      showSubcategoryDetailPage(cardData.categoryId, cardData.subcategoryId); // Go to subcategory detail page
                 } else if (cardData.categoryId) {
                      showMainCategoryDetailPage(cardData.categoryId); // Go to main category detail page
                 } else {
                     // If no category linked, maybe just go home or do nothing
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
    let title = name[state.currentLanguage] || name.ku_sorani;
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
        // Fetch the name of the category/subcategory/subsubcategory for the title
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

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID
            if(subcategoryId) {
                 // If subcategory or subsubcategory is selected, go to the subcategory detail page
                 showSubcategoryDetailPage(categoryId, subcategoryId);
            } else {
                 // If only main category is selected, go to the main category detail page
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
            limit(10)
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
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

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
                // Navigate based on linked category/subcategory
                if (brand.subcategoryId && brand.categoryId) {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId) {
                     showMainCategoryDetailPage(brand.categoryId); // Navigate to main category detail page
                }
                // If no category linked, clicking does nothing for now
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
            limit(10)
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
     // This function is no longer used directly to render a section on home page.
     // The main product grid is handled by searchProductsInFirestore.
     // This function *could* be repurposed if needed later.
     console.log("renderAllProductsSection called (currently inactive for home page layout)");
     return null;
}


// Function updated to accept layoutId and pass it to renderPromoCardsSectionForHome
async function renderHomePageContent() {
    if (state.isRenderingHomePage) {
         console.log("Already rendering home page content, returning.");
         return;
    }
    console.log("Rendering home page content...");
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton while loading layout
        homeSectionsContainer.innerHTML = ''; // Clear previous content first
        console.log("Cleared home sections container and showed skeleton.");

        // === START: Interval Cleanup Code ===
        console.log("Cleaning up existing slider intervals...");
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
                 console.log(`Cleared interval for layout ID: ${layoutId}`);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object
        // === END: Interval Cleanup Code ===

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        console.log("Fetching home layout...");
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled. Falling back to all products.");
             // Fallback: Show 'all products' grid directly
             homeSectionsContainer.style.display = 'none'; // Hide the sections container
             productsContainer.style.display = 'grid'; // Ensure product grid is visible
             await searchProductsInFirestore('', true); // Trigger loading all products

        } else {
             console.log(`Found ${layoutSnapshot.size} enabled sections in layout.`);
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;
                console.log(`Processing layout section type: ${section.type} (ID: ${doc.id})`);

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id);
                        } else { console.warn("Promo slider section is missing groupId in layout config."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section is missing groupId in layout config."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        } else { console.warn("Single shortcut row section is missing rowId in layout config."); }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section is missing categoryId in layout config."); }
                        break;
                    case 'all_products':
                         // This type indicates where the main product grid should appear *logically*
                         // but we don't render it *inside* the homeSectionsContainer.
                         // Its visibility is controlled by searchProductsInFirestore.
                        console.log("Encountered 'all_products' layout type - main grid handled separately.");
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    console.log(`Appending section element for type: ${section.type}`);
                    homeSectionsContainer.appendChild(sectionElement);
                } else {
                     console.log(`No element rendered for section type: ${section.type}`);
                }
            }
             // After rendering sections, ensure the main product grid and its loader are hidden
             console.log("Hiding main product grid and loader after rendering home sections.");
             productsContainer.style.display = 'none';
             skeletonLoader.style.display = 'none';
             document.getElementById('scroll-loader-trigger').style.display = 'none';
             homeSectionsContainer.style.display = 'block'; // Make sure sections container is visible


        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
        homeSectionsContainer.style.display = 'block'; // Ensure error message is visible
        // Hide product grid and loaders on error
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        document.getElementById('scroll-loader-trigger').style.display = 'none';
    } finally {
        console.log("Finished rendering home page content.");
        state.isRenderingHomePage = false;
        // Hide the main skeleton loader if it was shown initially for the home page sections
        if (skeletonLoader.parentElement === document.getElementById('mainPage') || skeletonLoader === homeSectionsContainer) {
            skeletonLoader.style.display = 'none';
        }
    }
}


// Function updated to accept layoutId, create unique ID, and manage its interval in state.sliderIntervals
async function renderPromoCardsSectionForHome(groupId, layoutId) { // ZÊDEKIRÎ: layoutId
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use products-container for grid layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`;

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };

            const promoCardElement = createPromoCardElement(cardData, sliderState);
             // Add the single promo card element to the grid container
             promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                const rotate = () => {
                     // Check if interval should still run
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId] || !document.getElementById('mainPage').classList.contains('page-active') || state.currentCategory !== 'all' || state.currentSearch !== '') {
                         if (sliderState.intervalId) {
                             clearInterval(sliderState.intervalId);
                              console.log(`Auto-cleared interval for slider ${layoutId} due to state change.`);
                             if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                 delete state.sliderIntervals[layoutId];
                             }
                         }
                         return; // Stop rotation if element removed, interval cleared, not on home view
                     }


                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Clear previous interval for this specific layoutId if it exists
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                     console.log(`Clearing pre-existing interval for slider ${layoutId}`);
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
                 console.log(`Started new interval ${sliderState.intervalId} for slider ${layoutId}`);
            }

            return promoGrid; // Return the container with the card element
        } else {
             console.log(`No promo cards found for group ${groupId}`);
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}



async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    console.log(`searchProductsInFirestore called: searchTerm="${searchTerm}", isNewSearch=${isNewSearch}`);
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    console.log(`Should show home sections? ${shouldShowHomeSections}`);

    if (shouldShowHomeSections) {
        console.log("Showing home sections view.");
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Re-render home content if it's empty or if it's a new "search" (meaning filters reset to home)
         if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) {
             console.log("Rendering home page content because container empty or isNewSearch=true");
             await renderHomePageContent();
         } else {
             console.log("Home page content already exists, skipping re-render.");
             // Restart slider intervals if they were stopped previously
             Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
                // Find the slider element and its data if needed to restart
                const promoGrid = document.getElementById(`promoSliderLayout_${layoutId}`);
                // Re-attach or restart logic might be needed here if intervals don't auto-resume
                 console.log(`Slider ${layoutId} should resume (implementation might be needed)`);
             });
         }
        if (isNewSearch) window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for home view on new navigation
        return;
    } else {
        console.log("Showing product grid view.");
        homeSectionsContainer.style.display = 'none';
        // Stop all promo rotations when navigating away from the full home view
        console.log("Stopping slider intervals because not in home view.");
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
                 console.log(`Stopped interval for layout ID: ${layoutId}`);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
    }

     // --- Cache Logic ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache[cacheKey]) {
        console.log(`Cache hit for key: ${cacheKey}. Restoring from cache.`);
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';

        renderProducts();
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
         console.log(`Cache restored. All loaded: ${state.allProductsLoaded}`);
         if (isNewSearch) window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top when restoring from cache on new search
        return;
    } else if(isNewSearch) {
         console.log(`Cache miss for key: ${cacheKey}.`);
    }

    // --- Loading State ---
    if (state.isLoadingMoreProducts) {
         console.log("Already loading more products, returning.");
         return;
    }

    if (isNewSearch) {
        console.log("New search/filter: Resetting products and showing skeleton.");
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton loader for new searches/filters
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for new filter/search
    } else {
         console.log("Loading more products...");
    }


    if (state.allProductsLoaded && !isNewSearch) {
         console.log("All products already loaded, returning.");
         return; // Don't fetch if all loaded and not a new search
    }


    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show bottom loader when loading more

    try {
        console.log("Building Firestore query...");
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
             console.log(`Filtered by categoryId: ${state.currentCategory}`);
        }
        // Subcategory/SubSubcategory filters are usually handled on detail page,
        // but include them here for robustness in case main page state includes them
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
             console.log(`Filtered by subcategoryId: ${state.currentSubcategory}`);
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
            console.log(`Filtered by subSubcategoryId: ${state.currentSubSubcategory}`);
        }


        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            console.log(`Applying search term: ${finalSearchTerm}`);
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Apply ordering
        if (finalSearchTerm) {
            // If searching, order by searchableName first (required by Firestore)
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
             console.log("Ordering by searchableName, then createdAt desc.");
        } else {
            // Otherwise, order by creation date
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
             console.log("Ordering by createdAt desc.");
        }

        // Apply pagination (startAfter) if loading more
        if (state.lastVisibleProductDoc && !isNewSearch) {
            console.log("Applying pagination: starting after", state.lastVisibleProductDoc.id);
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));
         console.log(`Applying limit: ${PRODUCTS_PER_PAGE}`);

        // Execute query
        console.log("Executing Firestore query...");
        const productSnapshot = await getDocs(productsQuery);
        console.log(`Query returned ${productSnapshot.docs.length} documents.`);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE;
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Will be undefined if empty

        console.log(`Updated products state. Total: ${state.products.length}. All loaded: ${state.allProductsLoaded}. Last visible: ${state.lastVisibleProductDoc?.id}`);

        // Update cache if it was a new search
        if (isNewSearch) {
             console.log(`Updating cache for key: ${cacheKey}`);
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render UI
        if (isNewSearch) {
             renderProducts(); // Render replaces skeleton loader
        } else {
             // Append new products if loading more
             newProducts.forEach(item => {
                let element = createProductCardElement(item);
                element.classList.add('product-card-reveal'); // Add reveal class for animation
                productsContainer.appendChild(element);
            });
            setupScrollAnimations(); // Observe newly added cards
        }


        // Show "not found" message if needed
        if (state.products.length === 0 && isNewSearch) {
             console.log("No products found for this filter/search.");
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

        // Update visibility of scroll trigger
        scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';


    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        productsContainer.style.display = 'grid'; // Ensure error is visible
        homeSectionsContainer.style.display = 'none'; // Hide home sections on error
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Hide bottom loader
         // Hide skeleton loader ONLY if it's the main one used for initial page load/new search
         if (isNewSearch) {
            skeletonLoader.style.display = 'none';
         }
        productsContainer.style.display = 'grid'; // Ensure product grid is visible (even if empty message is shown)
         console.log("Finished searchProductsInFirestore.");
    }
}


function addToCart(productId) {
    const allFetchedProducts = [...state.products];
    let product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local 'products' array. Adding with limited data.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) { existingItem.quantity++; }
                else { state.cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 }); }
                saveCart();
                showNotification(t('product_added_to_cart'));
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
    renderCartActionButtons();

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
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
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}


function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) { removeFromCart(productId); }
        else { saveCart(); renderCart(); }
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
    container.innerHTML = '';

    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; // Maybe change class name later if needed
        btn.style.backgroundColor = method.color;

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessage();
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp':
                    link = `https://wa.me/${value}?text=${encodedMessage}`;
                    break;
                case 'viber':
                    // Viber links can be tricky, might need testing
                    link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                    break;
                case 'telegram':
                    link = `https://t.me/${value}?text=${encodedMessage}`;
                    break;
                case 'phone':
                    link = `tel:${value}`;
                    break;
                case 'url': // For custom URLs
                    link = value; // Assume the value is the full URL
                    break;
            }

            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
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
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
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
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

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

    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.className = 'settings-item';

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
     if (!getLocationBtn || !profileAddressInput) return; // Add check

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;


    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
            // Using Nominatim for reverse geocoding
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

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
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1: // PERMISSION_DENIED
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case 2: // POSITION_UNAVAILABLE
                message = 'شوێنەکەت نەدۆزرایەوە';
                break;
            case 3: // TIMEOUT
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
         // Only trigger if on main page and not showing home sections
        if (entries[0].isIntersecting && document.getElementById('mainPage').classList.contains('page-active') && document.getElementById('homePageSectionsContainer').style.display === 'none') {
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 searchProductsInFirestore(state.currentSearch, false); // Fetch next page
            }
        }
    }, {
        root: null, // relative to document viewport
        threshold: 0.1 // trigger when 10% of the element is visible
    });

    observer.observe(trigger);
}


function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown();
    renderMainCategories();
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
    }
}

function setupEventListeners() {
    homeBtn.onclick = async () => {
         // If already on main page, reset filters. If not, show main page and reset filters.
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

    const debouncedSearch = debounce((term) => {
         // Only navigate if on main page
         if (document.getElementById('mainPage').classList.contains('page-active')) {
             navigateToFilter({ search: term });
         }
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        // Only navigate if on main page
         if (document.getElementById('mainPage').classList.contains('page-active')) {
            navigateToFilter({ search: '' });
         }
    };

    // Subpage search logic
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
         const currentState = history.state;
         // Check if we are on the subcategory detail page (not main category view)
         if (currentState && currentState.type === 'page' && currentState.id === 'subcategoryDetailPage' && currentState.subCatId) {
            const subCatId = currentState.subCatId;
             // Find the currently active sub-subcategory button
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default to 'all' if none active
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
         }
         // Add search logic for main category detail view if needed in the future
         // else if (currentState && currentState.type === 'page' && currentState.id === 'subcategoryDetailPage' && currentState.mainCatId && !currentState.subCatId) { ... }

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
                installBtn.style.display = 'none'; // Hide the button after prompting
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear the saved prompt
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

    // Handle foreground messages
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block';
    });
}

onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true });
             }
        } else {
            console.warn("AdminLogic not found or initialize not a function.");
        }
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    if (loginModal.style.display === 'block' && isAdmin) {
        closeCurrentPopup();
    }
});


function init() {
     console.log("DOM Loaded, starting init...");
    renderSkeletonLoader(); // Show skeleton loader immediately

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic(); // Initialize after persistence setup
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic(); // Initialize even if persistence fails
        });
}

function initializeAppLogic() {
     console.log("Initializing app logic...");
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories and then handle initial page load
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => {
         console.log("Categories snapshot received.");
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories];
        updateCategoryDependentUI(); // Update dropdowns and category buttons

        // Handle initial page load AFTER categories are available for the first time
        // This prevents race conditions where handleInitialPageLoad runs before categories exist
        if (!initializeAppLogic.initialLoadHandled) { // Add a flag
            console.log("Categories loaded, handling initial page load...");
            await handleInitialPageLoad(); // Now safe to call
            initializeAppLogic.initialLoadHandled = true; // Set flag
        }


        // Apply language AFTER categories are loaded to ensure names are correct
         console.log("Applying initial language...");
        setLanguage(state.currentLanguage);
         // No need to call handleInitialPageLoad again here

         // Note: If categories change later, handleInitialPageLoad shouldn't run again.
         // We might need to refresh parts of the UI if categories change live.
    }, error => {
         console.error("Error fetching categories: ", error);
         // Handle error, maybe show a message to the user
         // Still try to initialize other parts?
         if (!initializeAppLogic.initialLoadHandled) {
            handleInitialPageLoad(); // Try to load even without categories? Risky.
            initializeAppLogic.initialLoadHandled = true;
         }
         setLanguage(state.currentLanguage);
    });
     initializeAppLogic.initialLoadHandled = false; // Initialize flag


    // Setup other parts of the app that don't depend heavily on initial category load
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    // setLanguage(state.currentLanguage); // Moved inside onSnapshot
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
     console.log("Finished basic initialization.");
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
        // Force re-render if on home page
        if(document.getElementById('mainPage').classList.contains('page-active') && state.currentCategory === 'all') {
            searchProductsInFirestore('', true);
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
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
    console.log('`beforeinstallprompt` event was fired.');
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
                    updateNotification.classList.add('show');
                }
            });
        });

        updateNowBtn.addEventListener('click', () => {
             if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
             }
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}

