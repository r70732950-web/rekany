// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Piştî veqetandina home.js)

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

// <<<< زیادکرا: Import کردن لە home.js >>>>
import { renderHomePageContent, clearHomePageIntervals } from './home.js';
// <<<< کۆتایی زیادکردن >>>>

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

export function showPage(pageId, pageTitle = '') { // زیادکرا: export
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

    renderMainCategories(); // Renders main category buttons
    await renderSubcategories(state.currentCategory); // Renders subcategory buttons IF a main category is selected

    // searchProductsInFirestore handles showing home content OR filtered products
    await searchProductsInFirestore(state.currentSearch, true);

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// <<<< زیادکرا: export >>>>
export async function navigateToFilter(newState) {
    // Save current scroll before potentially navigating away
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY // Save current scroll position
    }, '');

    // Merge old state with new state, reset scroll for new view
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

    // Push the new state to history AFTER constructing it
    history.pushState(finalState, '', newUrl);

    // Apply the newly pushed state
    await applyFilterState(finalState);
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
                       // Update the history state title for future pops
                       history.replaceState({ ...popState, title: pageTitle }, '');
                   }
               } catch(e) { console.error("Could not refetch title on popstate", e) }
            }
            showPage(popState.id, pageTitle);
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            openPopup(popState.id, popState.type);
        } else {
            // This is a filter state on the main page
            showPage('mainPage');
            applyFilterState(popState, true); // True indicates it's from popstate
        }
    } else {
        // No state, assume default main page state
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterState(defaultState);
    }
});


function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    let initialStateApplied = false; // Flag to prevent double applying

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // The actual rendering is triggered by onSnapshot in initializeAppLogic AFTER categories load
        // We set the initial history state here
         history.replaceState({ type: 'page', id: pageId, mainCatId: mainCatId, subCatId: subCatId }, '', `#${hash}`);
        // showPage will be called later if categories are ready
    } else if (pageId === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageId, t('settings_title'));
    } else {
        // Main page with potential filters or popups
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0
        };
        history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}`);
        // Apply filter state ONLY IF categories are already loaded (might happen on fast refresh)
        if (state.categories.length > 0) {
            applyFilterState(initialState);
            initialStateApplied = true;
        }
        // Show main page visually regardless of category load state
        showPage('mainPage');

        // Handle opening popups based on hash AFTER potentially applying filters
        const element = document.getElementById(hash);
        if (element && pageId === 'mainPage') {
            const isSheet = element.classList.contains('bottom-sheet');
            const isModal = element.classList.contains('modal');
            if (isSheet || isModal) {
                 // Push popup state onto the existing filter state
                 history.pushState({ type: isSheet ? 'sheet' : 'modal', id: hash }, '', `#${hash}`);
                 // Open popup visually
                 openPopup(hash, isSheet ? 'sheet' : 'modal');
            }
        }
    }

    const productId = params.get('product');
    if (productId) {
         // Add product ID to history state if needed, or handle directly
        setTimeout(() => showProductDetails(productId), 500); // Delay slightly
    }
     return initialStateApplied; // Return whether initial state was applied
}


// <<<< زیادکرا: export >>>>
export function t(key, replacements = {}) {
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
    // Clear home container ONLY if it exists to allow re-render with new language
    if (homeContainer) {
        homeContainer.innerHTML = '';
        // Clear intervals associated with the previous language render
        clearHomePageIntervals();
    }


    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    // Trigger re-render of home OR products based on current view
    if (isHomeView && typeof renderHomePageContent === 'function') {
         renderHomePageContent(); // Re-render home content with new language
    } else {
        renderProducts(); // Re-render product list (names/prices might change)
    }

    // Re-render components affected by language change
    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
     if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies();
     // Update Admin UI dropdowns if necessary
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns();
        window.AdminLogic.renderCategoryManagementUI(); // Re-render list with new names
        window.AdminLogic.renderShortcutRowsAdminList(); // Re-render list with new names
        // Add others if needed: Brands, Promos, Layout items etc.
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
    // This function seems unused or incomplete based on previous code.
    // If it's meant to dynamically update links based on state.contactInfo,
    // the logic to fetch and render needs to be here or called from here.
    // Currently, renderContactLinks fetches and renders directly.
    if (!state.contactInfo) return;
    // Potentially add logic here if needed later.
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
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Use your actual VAPID key
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
            // Optionally add user ID if users can log in: userId: auth.currentUser?.uid
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

    // Update heart icons on all matching product cards on the page
    const allProductCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Target the <i> element
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            // Toggle Font Awesome classes directly
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
    favoritesContainer.innerHTML = ''; // Clear previous items

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none'; // Hide grid container
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Show grid container

    renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while fetching

    try {
        // Fetch details for each favorited product ID
        // Note: This fetches one by one, could be slow for many favorites.
        // Consider fetching in batches or using 'in' query if Firestore supports it well for your rules.
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
             // Optionally: Clean up state.favorites by removing IDs that don't exist
             const existingIds = favoritedProducts.map(p => p.id);
             state.favorites = state.favorites.filter(id => existingIds.includes(id));
             saveFavorites();
        } else {
            favoritedProducts.forEach(product => {
                // Assuming createProductCardElement is available
                if (typeof createProductCardElement === 'function') {
                    const productCard = createProductCardElement(product);
                    favoritesContainer.appendChild(productCard);
                }
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
    // Update all elements with the class 'cart-count' (e.g., in nav and sheet title)
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}


function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10); // Small delay to allow element rendering

    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove element after transition finishes
        setTimeout(() => {
             if (document.body.contains(notification)) { // Check if it hasn't been removed already
                 document.body.removeChild(notification);
             }
         }, 300); // Match CSS transition duration
    }, 3000);
}


function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>'; // Default option
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // Exclude 'All'
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
         // Use current language name, fallback to Sorani
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = ''; // Clear previous buttons
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); } // Highlight active

         // Get category name, handle 'All' category label
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        // Set button content with icon and name
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Default icon if missing

        btn.onclick = async () => {
             // Navigate to the selected category on the main page
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


async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous subcategories
     subSubcategoriesContainer.innerHTML = ''; // Clear sub-subcategories too
     subSubcategoriesContainer.style.display = 'none';

    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide if 'All' is selected
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show the container

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) {
             subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
             return;
        }

        // Add "All" button for subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Navigate within the current main category, showing all subcategories
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all'
                // category remains state.currentCategory
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Add buttons for each subcategory
        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

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

         // If a specific subcategory was active, render its sub-subcategories
         // This logic might be better placed in applyFilterState or a dedicated function
         // if (state.currentSubcategory !== 'all') {
         //      await renderSubSubcategories(categoryId, state.currentSubcategory);
         // }


    } catch (error) {
        console.error("Error fetching subcategories: ", error);
         subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

// Renders Sub-Subcategories on Main Page (potentially remove if not needed)
async function renderSubSubcategories(mainCatId, subCatId) {
     subSubcategoriesContainer.innerHTML = ''; // Clear previous

    if (!mainCatId || !subCatId || subCatId === 'all') {
         subSubcategoriesContainer.style.display = 'none';
        return;
    }

    subSubcategoriesContainer.style.display = 'flex'; // Show container

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
             subSubcategoriesContainer.style.display = 'none';
            return;
        }

        // Add "All" button for sub-subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
        // Reusing the same 'All' icon logic
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
            await navigateToFilter({ subSubcategory: 'all' });
        };
        subSubcategoriesContainer.appendChild(allBtn);

        // Add buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const subSubcatBtn = document.createElement('button');
            subSubcatBtn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;

            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
             const imageUrl = subSubcat.imageUrl || placeholderImg;

            subSubcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
                <span>${subSubcatName}</span>
            `;
            subSubcatBtn.onclick = async () => {
                await navigateToFilter({ subSubcategory: subSubcat.id });
            };
            subSubcategoriesContainer.appendChild(subSubcatBtn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
         subSubcategoriesContainer.style.display = 'none';
    }
}


// <<<< زیادکرا: export >>>>
export async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
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

    // Push state ONLY if not navigating from history popstate
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    // Show the page visually
    showPage('subcategoryDetailPage', subCatName);

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Show loader and clear previous content
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';

    // Reset search for the detail page
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render content for the detail page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Renders the top filter buttons
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Renders initial products ('all' sub-sub)

    loader.style.display = 'none'; // Hide loader after content is rendered
}


// Renders Sub-Subcategories specifically on the detail page
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories exist
            return;
        }

        container.style.display = 'flex'; // Show the container

        // Add "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active by default
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Mark as the 'all' button
        allBtn.onclick = () => {
            // Update active state and re-render products for 'all' sub-subcategories
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Fetch for 'all'
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
                // Update active state and re-render products for this specific sub-subcategory
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Fetch for specific ID
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}


// Renders products specifically on the detail page based on filters
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query: filter by the main subcategory of the page
        productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));

        // Further filter by sub-subcategory if 'all' is not selected
        if (subSubCatId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term if provided
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // Firestore requires the first orderBy to match the inequality field
             productsQuery = query(productsQuery,
                 where('searchableName', '>=', finalSearchTerm),
                 where('searchableName', '<=', finalSearchTerm + '\uf8ff'),
                 orderBy("searchableName", "asc"), // First order by the inequality field
                 orderBy("createdAt", "desc")      // Then secondary sort
             );
        } else {
             // Default sort if no search term
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Limit results (optional, but good for performance if many products)
        // productsQuery = query(productsQuery, limit(50));

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                // Assuming createProductCardElement is available
                if (typeof createProductCardElement === 'function') {
                    const card = createProductCardElement(product);
                    productsContainer.appendChild(card);
                }
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}


function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear existing

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active'); // Highlight active category
        }

        // Get name, handle 'All'
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Default icon

        btn.onclick = async () => {
            // Navigate to this main category
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset sub filters
                subSubcategory: 'all',
                search: '' // Clear search
            });
        };

        container.appendChild(btn);
    });
}

// <<<< زیادکرا: export >>>>
export function showProductDetails(productId) { // Moved export here
    // Find product in already loaded state.products first
    const allFetchedProducts = [...state.products]; // Use current products list
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found in current list. Fetching directly...");
        // Fetch directly from Firestore if not found locally
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct); // Show details with fetched data
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
             console.error("Error fetching product details directly:", error);
             showNotification(t('error_generic'), 'error');
         });
        return;
    }
    // If found in state.products, show details directly
    showProductDetailsWithData(product);
}


// Renders related products in the product detail sheet
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous
    section.style.display = 'none'; // Hide initially

    // Determine the best field to query for related products
    let queryField, queryValue;
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId'; queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId'; queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId'; queryValue = currentProduct.categoryId;
    } else {
        return; // Cannot find related products without a category
    }

    // Query for products in the same category/subcategory, excluding the current one
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue),
        where('__name__', '!=', currentProduct.id), // Exclude self using document ID
        limit(6) // Limit the number of related products shown
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // Assuming createProductCardElement is available
            if (typeof createProductCardElement === 'function') {
                const card = createProductCardElement(product);
                // Adjust card width for horizontal scrolling if needed (use CSS or inline style)
                card.style.width = '140px'; // Example fixed width
                card.style.flexShrink = '0';
                container.appendChild(card);
            }
        });

        section.style.display = 'block'; // Show the section if products were found

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


// Internal function to display product details in the sheet
function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll to top when opening
    }

    // Get localized name and description
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);
    const placeholderImg = "https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image";

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = ''; // Clear previous images
    thumbnailContainer.innerHTML = ''; // Clear previous thumbnails

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Main image
            const img = document.createElement('img');
            img.src = url || placeholderImg; // Use placeholder if URL is empty/null
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            img.onerror = () => img.src = placeholderImg; // Set placeholder on error
            imageContainer.appendChild(img);

            // Thumbnail image
            const thumb = document.createElement('img');
            thumb.src = url || placeholderImg;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumb.onerror = () => thumb.src = placeholderImg.replace('400x400', '60x60'); // Smaller placeholder
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


    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (index < 0 || index >= images.length) return; // Boundary check
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        if(thumbnails[index]) thumbnails[index].classList.add('active'); // Check if thumbnail exists
        currentIndex = index;
    }

    // Show/hide slider buttons based on image count
    const showSliderBtns = imageUrls.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    // Add event listeners only if there are multiple images
    if (showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
    } else {
         prevBtn.onclick = null; // Remove listeners if not needed
         nextBtn.onclick = null;
    }


    // Set product details
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Use formatted description

    // Set price (handle discounts)
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Set up "Add to Cart" button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup(); // Close sheet after adding to cart
    };

    // Render related products section
    renderRelatedProducts(product);

    // Open the sheet
    openPopup('productDetailSheet');
}


// <<<< زیادکرا: export >>>>
// Function to create product card element - needs to be accessible by home.js
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Store product ID for interactions
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    // Get localized name, fallback to Sorani, then default
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage])
                              || (product.name && product.name.ku_sorani)
                              || (typeof product.name === 'string' ? product.name : 'کاڵای بێ ناو'); // Handle old string format

     // Determine main image, use first from array or fallback
     const placeholderImg = 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image';
     const mainImage = (product.imageUrls && product.imageUrls.length > 0 && product.imageUrls[0])
                       || product.image // Fallback to old single 'image' field
                       || placeholderImg;


    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
         // Show discounted price and strikethrough original price
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price" style="display:inline; margin-right: 5px; color: var(--dark-gray); font-size: 13px;">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`; // Discount badge
    }

    // Shipping info badge
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

    // Favorite button state
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Solid vs regular heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // Construct card HTML
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='${placeholderImg}';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                 <i class="${heartIconClass} fa-heart"></i>
             </button>
             <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
             </button>
             ${isAdmin ? `
                 <div class="product-actions" style="display: flex;">
                     <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
                     <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
                 </div>
             ` : ''}
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
    `;


     // --- Event Listeners ---

    // Share Button
    productCard.querySelector('.share-btn-card')?.addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent card click
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`; // Generate share URL
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

     // Favorite Button
     productCard.querySelector('.favorite-btn')?.addEventListener('click', (event) => {
         toggleFavorite(product.id, event); // Pass event to stop propagation
     });

     // Add to Cart Button
     productCard.querySelector('.add-to-cart-btn-card')?.addEventListener('click', (event) => {
         event.stopPropagation(); // Prevent card click
         addToCart(product.id);
         // Visual feedback for add to cart
         const btn = event.currentTarget;
         if (!btn.disabled) {
             const originalContent = btn.innerHTML;
             btn.disabled = true;
             btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading spinner
             setTimeout(() => {
                 btn.innerHTML = `<i class="fas fa-check"></i>`; // Checkmark
                 setTimeout(() => {
                     btn.innerHTML = originalContent; // Restore original icon
                     btn.disabled = false;
                 }, 1500); // Duration checkmark is shown
             }, 500); // Duration spinner is shown
         }
     });

     // Edit Button (Admin only)
     productCard.querySelector('.edit-btn')?.addEventListener('click', (event) => {
         event.stopPropagation();
         if (window.AdminLogic && typeof window.AdminLogic.editProduct === 'function') {
            window.AdminLogic.editProduct(product.id);
         }
     });

     // Delete Button (Admin only)
     productCard.querySelector('.delete-btn')?.addEventListener('click', (event) => {
         event.stopPropagation();
         if (window.AdminLogic && typeof window.AdminLogic.deleteProduct === 'function') {
            window.AdminLogic.deleteProduct(product.id);
         }
     });


    // Card Click (for details view) - Add last
    productCard.addEventListener('click', (event) => {
        // Prevent opening details if a button inside the card was clicked
        if (!event.target.closest('button')) {
             showProductDetailsWithData(product); // Show details using the internal function
        }
    });

    return productCard;
}


function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible'); // Add class when visible
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% is visible
    });

    // Observe elements with the reveal class
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}


function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear previous skeletons
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card'; // Use existing skeleton style
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid display is set

    // Hide actual products and loader if using the main skeletonLoader
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}


function renderProducts() {
    // Renders the products currently in state.products into productsContainer
    productsContainer.innerHTML = ''; // Clear existing products
    if (!state.products || state.products.length === 0) {
        // Optionally display a "No products found" message here if needed after search/filter
        // productsContainer.innerHTML = '<p>No products found.</p>';
        return;
    }

    state.products.forEach(item => {
        // Assuming createProductCardElement is available
        if (typeof createProductCardElement === 'function') {
            let element = createProductCardElement(item);
            element.classList.add('product-card-reveal'); // Add class for animation
            productsContainer.appendChild(element);
        } else {
             console.error("createProductCardElement is not defined when rendering products");
        }
    });

    setupScrollAnimations(); // Setup animations for newly added cards
}


// Fetches and displays products based on current filters and search term
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Determine if we should show the home page layout or the product list
    const shouldShowHomeSections = !searchTerm
                                  && state.currentCategory === 'all'
                                  && state.currentSubcategory === 'all'
                                  && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none'; // Hide product grid
        skeletonLoader.style.display = 'none'; // Hide skeleton
        scrollTrigger.style.display = 'none'; // Hide infinite scroll trigger
        homeSectionsContainer.style.display = 'block'; // Show home sections

        // Render home content if it's not already rendered or needs re-rendering (e.g., language change)
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) { // Render if empty or forced new search
             if (typeof renderHomePageContent === 'function') {
                await renderHomePageContent();
            } else {
                 console.error("renderHomePageContent is not available");
            }
        }
        return; // Stop further execution as we are showing the home page
    } else {
        // We are showing filtered products, hide home sections and clear intervals
        homeSectionsContainer.style.display = 'none';
        if (typeof clearHomePageIntervals === 'function') {
            clearHomePageIntervals(); // Stop sliders etc. when leaving home view
        }
    }

    // --- Product Fetching Logic ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;

    // Use cache only for initial load of a new filter/search
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

    // Prevent concurrent fetches for pagination
    if (state.isLoadingMoreProducts && !isNewSearch) return;

    if (isNewSearch) {
        // Reset state for a new search/filter
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show skeleton for new search
    }

    // If all products are already loaded for the current filter, don't fetch more
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (!isNewSearch) loader.style.display = 'block'; // Show bottom loader only for pagination

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

        // Apply ordering - MUST match inequality field first if searching
        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (startAfter) if not a new search
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Limit results per page
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

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
            scrollTrigger.style.display = 'block'; // Show trigger for more
            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Set last doc for next page
        }


        // Cache results only on the first page load of a new search/filter
        if (isNewSearch) {
            state.productCache[cacheKey] = {
                products: state.products,
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // Render the products (either initial list or appended list)
        renderProducts();

        // Show "No products" message if initial search yields nothing
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        scrollTrigger.style.display = 'none'; // Hide trigger on error
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Hide bottom loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product grid is visible
    }
}


function addToCart(productId) {
    // Find product in already loaded state.products first
    let product = state.products.find(p => p.id === productId);

    // If not found in current list (e.g., added from favorites or direct link), fetch it
    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching for cart.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                 // Determine image URL similarly to createProductCardElement
                 const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0 && fetchedProduct.imageUrls[0])
                                   || fetchedProduct.image
                                   || ''; // Or a placeholder if preferred
                const existingItem = state.cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++;
                } else {
                     // Ensure name object exists before pushing
                     const nameData = fetchedProduct.name && typeof fetchedProduct.name === 'object' ? fetchedProduct.name : { ku_sorani: fetchedProduct.name || 'Unknown' };
                     state.cart.push({ id: fetchedProduct.id, name: nameData, price: fetchedProduct.price, image: mainImage, quantity: 1 });
                }
                saveCart();
                // No visual notification here as the button click provides feedback
                // showNotification(t('product_added_to_cart'));
            } else {
                 console.error(`Product ${productId} not found in DB for adding to cart.`);
            }
        }).catch(err => console.error("Error fetching product for cart:", err));
        return; // Exit early, let the async fetch handle it
    }

    // If product found in state.products
    const mainImage = (product.imageUrls && product.imageUrls.length > 0 && product.imageUrls[0])
                      || product.image
                      || ''; // Or a placeholder
    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
         // Ensure name object exists before pushing
         const nameData = product.name && typeof product.name === 'object' ? product.name : { ku_sorani: product.name || 'Unknown' };
        state.cart.push({ id: product.id, name: nameData, price: product.price, image: mainImage, quantity: 1 });
    }
    saveCart();
    // Notification handled by button click feedback
    // showNotification(t('product_added_to_cart'));
}


function renderCart() {
    cartItemsContainer.innerHTML = ''; // Clear previous items
    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }

    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // Update action buttons (e.g., WhatsApp, Viber)

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get localized name, fallback to Sorani, then handle potential old string format
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                      || (item.name && item.name.ku_sorani)
                                      || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
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

    totalAmount.textContent = total.toLocaleString(); // Update total display

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
            removeFromCart(productId); // Remove if quantity reaches 0 or less
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
    if (state.cart.length === 0) return ""; // Return empty if cart is empty

    let message = t('order_greeting') + "\n\n"; // Start with greeting
    // Add each item details
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
        // Prompt user to provide info if profile is incomplete
        message += `\n${t('order_prompt_info')}\n`;
    }
    return message;
}

// Renders buttons (WhatsApp, Viber etc.) based on Firestore settings
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Order by creation time
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a generic class, specific styles applied via inline style
            btn.className = 'whatsapp-btn'; // Reusing class, but style overrides
            btn.style.backgroundColor = method.color; // Set color from Firestore data

            // Get localized name for the button
            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Default icon

            btn.onclick = () => {
                const message = generateOrderMessage(); // Generate the order text
                if (!message) return; // Don't proceed if cart is empty

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Phone number, username, or URL

                // Construct the appropriate link based on method type
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                         // Viber desktop link structure might differ
                        link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                        break;
                    case 'telegram':
                        link = `https://t.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Will prompt to call
                        break;
                    case 'url': // For custom URLs (e.g., website order form)
                        link = value; // Assume the value is the full URL
                        // Optionally append message data if the target URL supports it
                        // link += `?order=${encodedMessage}`;
                        break;
                }

                if (link) {
                    window.open(link, '_blank'); // Open the link in a new tab/app
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = '<p>هەڵە لە هێنانی ڕێگاکانی ناردن.</p>';
    }

}


async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Show loading text
    try {
        const docRef = doc(db, "settings", "policies"); // Path to policies document
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content for current language, fallback to Sorani, then empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Display content, replace newlines with <br> for HTML rendering
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            // Show message if document doesn't exist or has no content field
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Show generic error
    }
}


function checkNewAnnouncements() {
    // Listen for the latest announcement
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Get the timestamp of the last announcement the user saw
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
    }, error => {
         console.error("Error checking for new announcements:", error);
         notificationBadge.style.display = 'none'; // Hide badge on error
     });
}


async function renderUserNotifications() {
    // Fetch all announcements, ordered by newest first
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    try {
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear previous notifications
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Keep track of the timestamp of the newest announcement rendered
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            // Format date for display
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

            // Get localized title and content, fallback to Sorani
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            // Create notification item element
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

        // Update the last seen timestamp to the newest one rendered
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        notificationBadge.style.display = 'none'; // Hide the badge after viewing
    } catch (error) {
         console.error("Error rendering user notifications:", error);
         notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-exclamation-circle"></i><p>${t('error_generic')}</p></div>`;
     }
}


// Renders social media links in the settings page contact section
function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Order by newest

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Clear previous links

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            // Get localized name, fallback to Sorani
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;

            // Create link element
            const linkElement = document.createElement('a');
            linkElement.href = link.url; // Set the URL
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security measure
            linkElement.className = 'settings-item'; // Use existing style

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, error => {
         console.error("Error fetching contact links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە هێنانی لینکەکان.</p>';
     });
}


function showWelcomeMessage() {
    // Show welcome modal only if the user hasn't visited before
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // Open the modal
        localStorage.setItem('hasVisited', 'true'); // Mark as visited
    }
}


function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    // Ensure elements exist before adding listener
    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS'; // Fallback text

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        // Disable button and show loading text
        if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        // Get current position
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
            // Use Nominatim API for reverse geocoding (lat/lon to address)
            // Request Kurdish ('ku') or English ('en') language results
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
            const data = await response.json();

            if (data && data.display_name) {
                // Set the address input value and notify user
                profileAddressInput.value = data.display_name;
                showNotification('ناونیشان وەرگیرا', 'success');
            } else {
                showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
            }
        } catch (error) {
            console.error('Reverse Geocoding Error:', error);
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            // Re-enable button and restore original text
            if(btnSpan) btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        // Provide user-friendly error messages based on error code
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
        // Re-enable button and restore text
        if(btnSpan) btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}


// Sets up the Intersection Observer for infinite scrolling
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return; // Exit if trigger element doesn't exist

    const observer = new IntersectionObserver((entries) => {
        // Check if the trigger element is intersecting (visible)
        if (entries[0].isIntersecting) {
            // Load more products only if not currently loading and not all products are loaded
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 console.log("Scroll trigger hit, loading more products..."); // Debug log
                searchProductsInFirestore(state.currentSearch, false); // Fetch next page (false means not a new search)
            }
        }
    }, {
        root: null, // Observe intersection relative to the viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger); // Start observing the trigger element
}


function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // Update product form dropdown
    renderMainCategories(); // Render category buttons on main page
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns(); // Update admin category dropdowns
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update shortcut card dropdowns
    }
}


// --- Event Listener Setup ---
function setupEventListeners() {
    // --- Bottom Navigation ---
    homeBtn.onclick = async () => {
        // Go to home page only if not already there
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]); // Push state for main page
            showPage('mainPage');
        }
        // Reset filters when clicking home icon explicitly
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
        // Navigate to settings page
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

     // Back button in subpage header
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser history back
    };


    // --- Popups (Sheets & Modals) ---
    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => openPopup('termsSheet'));
    }

    // Close popups
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); }; // Close modal on background click


    // --- Forms ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Attempt login
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Success is handled by onAuthStateChanged
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
        navigateToFilter({ search: term }); // Use navigate function for search
    }, 500); // 500ms debounce

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show clear button if text exists
        debouncedSearch(searchTerm); // Trigger debounced search
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Clear input
        clearSearchBtn.style.display = 'none'; // Hide clear button
        navigateToFilter({ search: '' }); // Trigger search with empty term
    };

    // Subpage search logic (for subcategory detail page)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        // Only perform search if on a subcategory detail page
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            // const mainCatId = ids[1]; // Not needed for product query here
            const subCatId = ids[2];

            // Find the currently active sub-subcategory button on the detail page
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            // Get its ID, default to 'all' if none is active
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';

            // Re-render products on the detail page with the search term
            await renderProductsOnDetailPage(subCatId, subSubCatId, term);
        }
    }, 500); // 500ms debounce

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


    // --- Settings Page Actions ---
    contactToggle.onclick = () => { // Toggle visibility of contact links
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
        chevron.classList.toggle('fa-chevron-down', !container.classList.contains('open'));
        chevron.classList.toggle('fa-chevron-up', container.classList.contains('open'));

    };

    document.querySelectorAll('.lang-btn').forEach(btn => { // Language selection buttons
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });

    const installBtn = document.getElementById('installAppBtn'); // PWA Install button
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompting
                state.deferredPrompt.prompt(); // Show install prompt
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear prompt once used
            }
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn'); // Notification permission
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }

    const forceUpdateBtn = document.getElementById('forceUpdateBtn'); // Force update/clear cache
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    // --- Firebase Messaging ---
    // Handle messages received while the app is in the foreground
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'ئاگەداری نوێ';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Display using app's notification system
        notificationBadge.style.display = 'block'; // Show badge immediately
    });
}

// Listen for authentication state changes (login/logout)
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // <<<<<==== گۆڕینی ئەمە بۆ UID ی ئەدمینی خۆت
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        console.log("Admin user detected.");
        sessionStorage.setItem('isAdmin', 'true'); // Mark as admin in session storage
        // Ensure admin.js is loaded and initialize it
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Defer initialization slightly if document isn't fully ready
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                window.AdminLogic.initialize();
             } else {
                 window.addEventListener('DOMContentLoaded', window.AdminLogic.initialize);
             }
        } else {
             console.warn("AdminLogic not found or initialize function missing. Admin features may not work.");
        }
        // Close login modal if it was open
        if (loginModal.style.display === 'block') {
             closeCurrentPopup();
        }
    } else {
        console.log("No admin user / User logged out.");
        sessionStorage.removeItem('isAdmin'); // Remove admin marker
        // If a non-admin user is somehow signed in, sign them out.
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out automatically.");
        }
        // Deinitialize admin UI elements if admin logic exists
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
        // Redirect non-admins away from admin-specific views if necessary (optional)
        // e.g., if (window.location.hash.includes('admin')) { window.location.hash = ''; }
    }

    // Update UI elements that depend on admin status (redundant with AdminLogic.initialize/deinitialize but safe)
    if (window.AdminLogic) window.AdminLogic.updateAdminUI(isAdmin);

});


// --- Initialization Function ---
function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately on load

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
            // Initialize core app logic REGARDLESS of persistence outcome
            initializeAppLogic();
        });
}


// Core application logic initialization (runs after persistence setup attempt)
function initializeAppLogic() {
     // Ensure sliderIntervals exists in state (for home.js)
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories first, as other rendering depends on them
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories]; // Add 'All' category

        updateCategoryDependentUI(); // Update dropdowns and category buttons

        // Handle initial page load state (filters, popups, detail pages)
        // This needs categories to be loaded first
        const initialStateApplied = handleInitialPageLoad();

        // Apply language AFTER categories and initial load handling
        // This ensures correct names are used everywhere
        setLanguage(state.currentLanguage);

         // If initial state wasn't applied during handleInitialPageLoad (because categories weren't ready), apply it now.
         if (!initialStateApplied) {
             const params = new URLSearchParams(window.location.search);
             const initialState = {
                 category: params.get('category') || 'all',
                 subcategory: params.get('subcategory') || 'all',
                 subSubcategory: params.get('subSubcategory') || 'all',
                 search: params.get('search') || '',
                 scroll: 0
             };
              // Only apply if we are on the main page, otherwise let detail page logic handle it
              if (!window.location.hash || window.location.hash === '#') {
                 applyFilterState(initialState);
              }
         }


    }, error => {
         console.error("Error fetching categories:", error);
         // Handle error, maybe show an error message to the user
         mainPage.innerHTML = '<p style="text-align:center; padding: 30px;">هەڵەیەک لە هێنانی جۆرەکان ڕوویدا. تکایە دووبارە هەوڵبدەرەوە.</p>';
         skeletonLoader.style.display = 'none';
     });


    // Setup other non-category-dependent parts
    updateCartCount(); // Initial cart count display
    setupEventListeners(); // Add all button clicks, form submits, etc.
    setupScrollObserver(); // Enable infinite scroll
    renderContactLinks(); // Fetch and display contact/social links
    checkNewAnnouncements(); // Check for notification badge
    showWelcomeMessage(); // Show only on first visit
    setupGpsButton(); // Add GPS functionality to profile address

    // Initial language setting (might be redundant if called after categories load, but safe)
    setLanguage(state.currentLanguage);
}


// --- Global Exports for Admin ---
// Expose necessary functions/variables for admin.js via a global object
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, // Firestore/Auth essentials
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore, // UI/Util functions
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, homeLayoutCollection, // Collections
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage, // State accessors/mutators
    clearProductCache // Cache management
});

// --- Start the App ---
document.addEventListener('DOMContentLoaded', init); // Start initialization when DOM is ready

// --- PWA & Service Worker ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent mini-infobar
    state.deferredPrompt = e; // Save the event
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex'; // Show install button
    console.log('`beforeinstallprompt` event fired.');
});


if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => { // Register service worker
        console.log('Service Worker registered successfully.');

        registration.addEventListener('updatefound', () => { // Listen for updates
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                // When new worker is installed and waiting, show update prompt
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });

        // Button click tells waiting worker to activate
        updateNowBtn.addEventListener('click', () => {
            if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    // Reload page when new worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}

