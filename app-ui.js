// BEŞÊ ÇAREM: app-ui.js
// Fonksiyonên birêvebirina UI, event listener, û navîgasyonê

import {
    auth, messaging, db, // Firebase services if needed directly for UI actions (e.g., signOut)
    state, // Import state for UI logic
    t, // Translation function
    // DOM Elements
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer, scrollTrigger,
    homePageSectionsContainer, mainCategoriesContainer, subcategoriesContainer,
    detailPageLoader, productsContainerOnDetailPage, subSubCategoryContainerOnDetailPage,
    subpageSearchInput, subpageClearSearchBtn,
    // Collections (if needed for direct UI-triggered actions like signout)
    settingsCollection, // Example
    // Constants
    PRODUCTS_PER_PAGE
} from './app-setup.js';

import {
    // Data fetching and state management functions
    setLanguage, saveCart, addToCart, updateQuantity, removeFromCart, getCartTotalItems, getCartTotalPrice,
    saveFavorites, isFavorite, toggleFavorite, saveProfile, fetchCategories, fetchSubcategories, fetchSubSubcategories,
    fetchProducts, searchProductsInFirestore, fetchPolicies, fetchAnnouncements, fetchLatestAnnouncementTimestamp,
    fetchContactMethods, fetchSocialLinks, requestNotificationPermissionAndSaveToken,
    applyFilterState, navigateToFilter, setDeferredPrompt, getDeferredPrompt,
    fetchHomeLayout, fetchPromoCardsForGroup, fetchBrandsForGroup, fetchNewestProducts,
    fetchShortcutRowData, fetchProductsForCategoryRow, fetchInitialAllProductsForHome

} from './app-data.js';

import {
    // HTML Rendering functions
    formatDescription, createProductCardElement, createPromoSliderElement, createBrandsSectionElement,
    createNewestProductsSectionElement, createSingleShortcutRowElement, createSingleCategoryRowElement,
    createAllProductsSectionElement, createSkeletonLoaderHTML, createCategoriesSheetHTML,
    createMainCategoriesHTML, createSubcategoriesHTML, createSubSubcategoriesHTML, createCartItemsHTML, createCartActionButtonsHTML,
    createNotificationsHTML, createContactLinksHTML
} from './app-render.js';

import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // Import getDoc

// --- UI Update Functions ---

/**
 * Shows a temporary notification message.
 * Exported via app-setup for admin.js
 */
export function showNotification(message, type = 'success') {
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
        }, 300); // Matches CSS transition duration
    }, 3000); // Notification display duration
}

/**
 * Updates the cart item count badge in the UI.
 */
function updateCartCountUI() {
    const totalItems = getCartTotalItems();
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

/**
 * Fetches cart data and renders the cart sheet UI.
 */
function renderCartUI() {
    const itemsHTML = createCartItemsHTML(state.cart);
    cartItemsContainer.innerHTML = itemsHTML;
    const totalPrice = getCartTotalPrice(); // Calculate total price once

    if (state.cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
    } else {
        emptyCartMessage.style.display = 'none';
        cartTotal.style.display = 'block';
        cartActions.style.display = 'block';
        // Use translation for currency symbol in cart total
        totalAmount.textContent = totalPrice.toLocaleString();
        cartTotal.querySelector('[data-translate-key="currency_symbol"]').textContent = t('currency_symbol', {defaultValue: 'د.ع.'});
        renderCartActionButtonsUI(); // Render buttons after ensuring cart is not empty
    }
    updateCartCountUI();
}


/**
 * Renders the favorite products page/sheet.
 */
async function renderFavoritesUI() {
    favoritesContainer.innerHTML = createSkeletonLoaderHTML(4); // Show skeleton while loading
    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';

    if (state.favorites.length === 0) {
        favoritesContainer.innerHTML = '';
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    try {
        // Fetch details for favorited products
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeleton/previous items

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
                // Make card visible immediately (no scroll animation needed here)
                 setTimeout(() => productCard.classList.add('visible'), 10);
            });
        }
    } catch (error) {
        console.error("Error rendering favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


/**
 * Renders the category selection sheet content.
 */
function renderCategoriesSheetUI() {
    sheetCategoriesContainer.innerHTML = createCategoriesSheetHTML(state.categories, state.currentCategory);
}

/**
 * Renders the main category filter buttons.
 */
function renderMainCategoriesUI() {
    if (mainCategoriesContainer) {
        mainCategoriesContainer.innerHTML = createMainCategoriesHTML(state.categories, state.currentCategory);
    }
}

/**
 * Renders the subcategory filter buttons.
 */
function renderSubcategoriesUI() {
    if (subcategoriesContainer) {
        if (state.currentCategory === 'all' || state.subcategories.length === 0) {
            subcategoriesContainer.innerHTML = ''; // Hide if 'all' main category or no subcategories
            subcategoriesContainer.style.display = 'none';

        } else {
             subcategoriesContainer.innerHTML = createSubcategoriesHTML(state.subcategories, state.currentSubcategory);
             subcategoriesContainer.style.display = 'flex';
        }
    }
     // Always hide sub-sub on main page now
     if(subSubcategoriesContainer){
         subSubcategoriesContainer.innerHTML = '';
         subSubcategoriesContainer.style.display = 'none';
     }
}

/**
 * Renders sub-subcategory filters on the detail page.
 */
async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId, currentSubSubCatId = 'all') {
    const container = subSubCategoryContainerOnDetailPage;
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    const subSubcategories = await fetchSubSubcategories(mainCatId, subCatId);

    if (subSubcategories.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = createSubSubcategoriesHTML(subSubcategories, currentSubSubCatId);
    container.style.display = 'flex';
}


/**
 * Renders product cards in the main products container.
 * Also handles showing/hiding loader/empty messages.
 * @param {boolean} isNewSearch - Indicates if this is a fresh render or appending more products.
 */
function renderProductsUI(isNewSearch) {
    if (isNewSearch) {
        productsContainer.innerHTML = ''; // Clear for new search/filter
    }

    if (!state.products || state.products.length === 0) {
         if (isNewSearch) { // Only show 'no products' if it's a new search resulting in zero items
             productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {defaultValue: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
         }
        // Don't hide container if appending and it's just temporarily empty before new items arrive
         if(isNewSearch) productsContainer.style.display = 'grid'; // Ensure grid display for the message
         skeletonLoader.style.display = 'none';
         loader.style.display = 'none';
         scrollTrigger.style.display = 'none';
         return;
    }

    // Determine which products are new if appending
    const startIndex = isNewSearch ? 0 : productsContainer.children.length;
    const productsToRender = state.products.slice(startIndex);

    productsToRender.forEach(item => {
        let element = createProductCardElement(item);
        // element.classList.add('product-card-reveal'); // Already added in create function
        productsContainer.appendChild(element);
    });

    skeletonLoader.style.display = 'none';
    loader.style.display = 'none';
    productsContainer.style.display = 'grid'; // Ensure it's displayed as a grid
    scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';

    // Trigger scroll animations for newly added cards
    setupScrollAnimations();
}

/**
 * Renders the skeleton loader in the specified container.
 * @param {HTMLElement} container - The container to render into.
 * @param {number} count - Number of skeleton cards.
 */
function renderSkeletonLoaderUI(container = skeletonLoader, count = 8) {
    container.innerHTML = createSkeletonLoaderHTML(count);
    container.style.display = 'grid';
    // Hide other containers when skeleton is shown
    if (container === skeletonLoader) {
        productsContainer.style.display = 'none';
        loader.style.display = 'none';
        homePageSectionsContainer.style.display = 'none'; // Also hide home sections
    }
}

/**
 * Renders the dynamic sections of the home page based on layout config.
 */
async function renderHomePageUI() {
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    // Clear previous slider intervals immediately
    Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
        if (state.sliderIntervals[layoutId]) {
            clearInterval(state.sliderIntervals[layoutId]);
        }
    });
    state.sliderIntervals = {}; // Reset

    renderSkeletonLoaderUI(homePageSectionsContainer, 4); // Show skeleton in home container
    productsContainer.style.display = 'none'; // Hide main product grid
    skeletonLoader.style.display = 'none'; // Hide the default skeleton loader
    scrollTrigger.style.display = 'none'; // Hide scroll trigger
    homePageSectionsContainer.style.display = 'grid'; // Use grid for skeleton

    try {
        const layoutConfig = await fetchHomeLayout();
        homePageSectionsContainer.innerHTML = ''; // Clear skeleton loader

        if (!layoutConfig || layoutConfig.length === 0) {
            console.warn("Home page layout is empty or failed to load.");
            homePageSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('home_layout_empty', {defaultValue:'پەڕەی سەرەکی ڕێکنەخراوە.'})}</p>`;
            return;
        }

        for (const section of layoutConfig) {
            if (!section.enabled) continue; // Skip disabled sections

            let sectionElement = null;
            let sectionData;

            switch (section.type) {
                case 'promo_slider':
                    if (section.groupId) {
                        sectionData = await fetchPromoCardsForGroup(section.groupId);
                        if (sectionData.length > 0) {
                             // Pass layout ID (section.id) for interval management
                            sectionElement = createPromoSliderElement({ cards: sectionData }, section.id);
                        }
                    } else { console.warn("Promo slider section missing groupId:", section.id); }
                    break;
                case 'brands':
                    if (section.groupId) {
                        sectionData = await fetchBrandsForGroup(section.groupId);
                        sectionElement = createBrandsSectionElement(sectionData);
                    } else { console.warn("Brands section missing groupId:", section.id); }
                    break;
                case 'newest_products':
                    sectionData = await fetchNewestProducts();
                    sectionElement = createNewestProductsSectionElement(sectionData);
                    break;
                case 'single_shortcut_row':
                     if (section.rowId) {
                         sectionData = await fetchShortcutRowData(section.rowId);
                         sectionElement = createSingleShortcutRowElement(sectionData, section.name); // Pass layout name object
                     } else { console.warn("Single shortcut row section missing rowId:", section.id); }
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                         sectionData = await fetchProductsForCategoryRow(section.categoryId, section.subcategoryId, section.subSubcategoryId);
                         // Fetch actual category name for better title
                         let actualCategoryName = '';
                         let targetDocRefPath;
                         if(section.subSubcategoryId) targetDocRefPath = `categories/${section.categoryId}/subcategories/${section.subcategoryId}/subSubcategories/${section.subSubcategoryId}`;
                         else if(section.subcategoryId) targetDocRefPath = `categories/${section.categoryId}/subcategories/${section.subcategoryId}`;
                         else targetDocRefPath = `categories/${section.categoryId}`;
                         try {
                              const targetSnap = await getDoc(doc(db, targetDocRefPath));
                              if (targetSnap.exists()) {
                                   const targetData = targetSnap.data();
                                   actualCategoryName = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || '';
                              }
                         } catch(e){ console.warn("Could not fetch category name for row title", e); }

                         sectionElement = createSingleCategoryRowElement(sectionData, section, actualCategoryName);
                     } else { console.warn("Single category row section missing categoryId:", section.id); }
                     break;
                 case 'all_products':
                     sectionData = await fetchInitialAllProductsForHome();
                     sectionElement = createAllProductsSectionElement(sectionData);
                     break;
                default:
                    console.warn(`Unknown home layout section type: ${section.type}`);
            }

            if (sectionElement) {
                homePageSectionsContainer.appendChild(sectionElement);
            }
        }
        homePageSectionsContainer.style.display = 'block'; // Show the container


    } catch (error) {
        console.error("Error rendering home page UI:", error);
        homePageSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_rendering_home', {defaultValue:'هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.'})}</p>`;
    } finally {
        state.isRenderingHomePage = false;
        // Ensure main product grid is hidden when home sections are shown
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
    }
}

/**
 * Fetches and renders the terms and policies content.
 */
async function renderPoliciesUI() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await fetchPolicies();
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

/**
 * Fetches and renders user notifications. Updates the badge.
 */
async function renderUserNotificationsUI() {
    const announcements = await fetchAnnouncements();
    notificationsListContainer.innerHTML = createNotificationsHTML(announcements);

    // Update last seen timestamp and hide badge
    let latestTimestamp = 0;
    if (announcements.length > 0) {
         latestTimestamp = announcements.reduce((max, ann) => Math.max(max, ann.createdAt), 0);
    }
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

/**
 * Checks for new announcements and updates the badge visibility.
 */
async function checkNewAnnouncementsUI() {
    const latestTimestamp = await fetchLatestAnnouncementTimestamp();
    const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;
    notificationBadge.style.display = (latestTimestamp > lastSeenTimestamp) ? 'block' : 'none';
}

/**
 * Fetches and renders the dynamic contact links in settings.
 */
async function renderContactLinksUI() {
    const socialLinks = await fetchSocialLinks();
    const container = document.getElementById('dynamicContactLinksContainer');
    if (container) {
        container.innerHTML = createContactLinksHTML(socialLinks);
    }
}

/**
 * Fetches and renders the cart action buttons (send order methods).
 */
async function renderCartActionButtonsUI() {
    const methods = await fetchContactMethods();
    cartActions.innerHTML = createCartActionButtonsHTML(methods);
}

/**
 * Applies language translations to static UI elements.
 */
function applyLanguageToUI() {
    document.documentElement.lang = state.currentLanguage.startsWith('ar') ? 'ar' : 'ku'; // Set lang on HTML element
    document.documentElement.dir = 'rtl'; // Always RTL for these languages

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            // Special case for currency symbol span inside cart total
            if (element.parentElement?.id === 'cartTotal' && key === 'currency_symbol') {
                element.textContent = translation;
            } else if (!element.closest('#cartTotal') || key !== 'currency_symbol') {
                // Avoid overwriting price in cart total, update others normally
                 element.textContent = translation;
            }
        }
    });

    // Update language buttons state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === state.currentLanguage);
    });
}


/**
 * Shows or hides admin-specific UI elements.
 */
function updateAdminStatusUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    const adminSections = [
        'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
        'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
        'adminContactMethodsManagement', 'adminShortcutRowsManagement', 'adminHomeLayoutManagement' // Added layout section
    ];
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });

    if (isAdmin) {
        settingsLogoutBtn.style.display = 'flex';
        settingsAdminLoginBtn.style.display = 'none';
        addProductBtn.style.display = 'flex';
    } else {
        settingsLogoutBtn.style.display = 'none';
        settingsAdminLoginBtn.style.display = 'flex';
        addProductBtn.style.display = 'none';
    }
}

/**
 * Updates the header appearance based on the current page.
 * @param {string} pageId - ID of the page being shown.
 * @param {string} [title=''] - Title for subpages.
 */
function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return; // Defensive check

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

/**
 * Updates the active state of the bottom navigation buttons.
 * @param {string|null} activeBtnId - ID of the button to activate, or null to deactivate all.
 */
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.id === activeBtnId);
    });
}

// --- Popup and Navigation Management ---

/**
 * Shows the specified page and hides others. Handles history state.
 * @param {string} pageId - ID of the page to show ('mainPage', 'settingsPage', 'subcategoryDetailPage').
 * @param {string} [pageTitle=''] - Title for the header (used for subcategoryDetailPage).
 * @param {object} [additionalState={}] - Extra data to save in history state.
 * @param {boolean} [replaceState=false] - Whether to replace the current history state.
 */
export function showPage(pageId, pageTitle = '', additionalState = {}, replaceState = false) {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top for new pages, unless it's the main page being restored from history
    if (pageId !== 'mainPage' || !history.state?.scroll) {
        window.scrollTo(0, 0);
    }

    updateHeaderView(pageId, pageTitle);

    // Update bottom nav active state
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    updateActiveNav(activeBtnId);


    // Update history state
    const stateData = { type: 'page', id: pageId, title: pageTitle, ...additionalState };
    const url = pageId === 'mainPage' ? window.location.pathname + window.location.search : `#${pageId}`; // Keep search params for main page

    if (replaceState) {
        history.replaceState(stateData, '', url);
    } else if (history.state?.id !== pageId || history.state?.type !== 'page') { // Avoid pushing same state
         history.pushState(stateData, '', url);
    }

}

/**
 * Opens a bottom sheet or modal and manages history state.
 * Exported via app-setup for admin.js
 * @param {string} id - ID of the sheet or modal element.
 * @param {string} [type='sheet'] - Type of popup ('sheet' or 'modal').
 */
export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups first

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger specific renders for sheets
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesUI(); // Changed to async call
        if (id === 'categoriesSheet') renderCategoriesSheetUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') { // Pre-fill profile form
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scroll

    // Push state for popup only if it's not already the current state
    if (history.state?.id !== id || history.state?.type !== type) {
       history.pushState({ type: type, id: id }, '', `#${id}`);
    }
}


/**
 * Closes the currently active popup by simulating a back navigation.
 * If no popup state is found, calls closeAllPopupsUI directly.
 * Exported via app-setup for admin.js
 */
export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Let popstate handle the closing
    } else {
        closeAllPopupsUI(); // Fallback if no history state
    }
}


/**
 * Closes all modals and sheets directly, without using history.
 */
function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * Handles the browser's popstate event (back/forward navigation).
 */
async function handlePopstate(event) {
    closeAllPopupsUI(); // Ensure all popups are closed initially
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Refetch subcategory title if navigating back to detail page
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
            showPage(popState.id, pageTitle, {}, true); // Use replaceState to not create new history entry
             if(popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                  // Re-render content for subcategory detail page
                  detailPageLoader.style.display = 'block';
                  await renderSubSubcategoriesOnDetailPageUI(popState.mainCatId, popState.subCatId); // Pass current sub-sub if stored?
                   // Re-fetch products based on current filters on that page (might need storing search/sub-sub)
                  await searchProductsOnDetailPage(popState.subCatId, 'all', ''); // Reset filters for now
                  detailPageLoader.style.display = 'none';
             }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Re-open the popup based on history state
             openPopup(popState.id, popState.type);
        } else { // Filter state for main page
            showPage('mainPage', '', {}, true); // Show main page, replace state
            applyFilterState(popState); // Update global state
            // Re-render categories based on state
            renderMainCategoriesUI();
            await renderSubcategoriesUI(); // Needs to be async now
            // Trigger search/render based on restored state
            await searchProductsInFirestore(popState.search || '', true); // True for new search based on history state
            // Restore scroll position
            if (typeof popState.scroll === 'number') {
                setTimeout(() => window.scrollTo(0, popState.scroll), 50); // Timeout helps ensure render is complete
            }
        }
    } else { // No state, likely initial load or outside app history
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage', '', {}, true); // Show main page, replace state
         applyFilterState(defaultState);
         renderMainCategoriesUI();
         await renderSubcategoriesUI(); // Async
         await searchProductsInFirestore('', true); // Initial search
    }
}

/**
* Handles the initial setup of the UI based on the URL hash or query parameters.
*/
async function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    // Determine initial page
    let initialPageId = 'mainPage';
    let initialPageTitle = '';
    let additionalState = {};
    if (hash.startsWith('subcategory_')) {
        initialPageId = 'subcategoryDetailPage';
        const ids = hash.split('_');
        additionalState.mainCatId = ids[1];
        additionalState.subCatId = ids[2];
        // Fetch title asynchronously
         try {
              const subCatRef = doc(db, "categories", additionalState.mainCatId, "subcategories", additionalState.subCatId);
              const subCatSnap = await getDoc(subCatRef);
              if (subCatSnap.exists()) {
                   const subCat = subCatSnap.data();
                   initialPageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
              } else { initialPageTitle = 'Details'; }
         } catch(e) { initialPageTitle = 'Details'; console.error("Error getting initial subcat title:", e); }

    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
    }

    // Set initial history state correctly
     const initialStateData = initialPageId === 'mainPage'
       ? { // Filter state for main page
           category: params.get('category') || 'all',
           subcategory: params.get('subcategory') || 'all',
           subSubcategory: params.get('subSubcategory') || 'all',
           search: params.get('search') || '',
           scroll: 0
         }
       : { type: 'page', id: initialPageId, title: initialPageTitle, ...additionalState }; // Page state

    history.replaceState(initialStateData, ''); // Replace initial history entry

    // Show the determined page
    showPage(initialPageId, initialPageTitle, additionalState, true); // Use replaceState=true

    // Apply filters or render content based on the initial state
    if (initialPageId === 'mainPage') {
        applyFilterState(initialStateData); // Apply filters from URL params
        renderMainCategoriesUI();
        await renderSubcategoriesUI();
        await searchProductsInFirestore(initialStateData.search, true);
    } else if (initialPageId === 'subcategoryDetailPage') {
         detailPageLoader.style.display = 'block';
         await renderSubSubcategoriesOnDetailPageUI(additionalState.mainCatId, additionalState.subCatId);
         await searchProductsOnDetailPage(additionalState.subCatId, 'all', ''); // Fetch products for this subcat
         detailPageLoader.style.display = 'none';
    }


    // Open popup if hash matches a popup ID and we are on the main page
    const element = document.getElementById(hash);
     if (element && initialPageId === 'mainPage') {
         const isSheet = element.classList.contains('bottom-sheet');
         const isModal = element.classList.contains('modal');
         if (isSheet || isModal) {
             openPopup(hash, isSheet ? 'sheet' : 'modal');
         }
     }

    // Show product details if specified in URL
    if (productId) {
         // Use timeout to ensure necessary data/UI might be ready
         setTimeout(() => {
              document.dispatchEvent(new CustomEvent('showProductDetails', { detail: { productId } }));
         }, 500);
    }
}


/**
 * Saves the current scroll position in the history state for the main page filter view.
 */
function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state (not popups or other pages)
     if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
         // Check if scroll exists and is different to avoid unnecessary replaces
          if (typeof currentState.scroll !== 'number' || currentState.scroll !== window.scrollY) {
             history.replaceState({ ...currentState, scroll: window.scrollY }, '');
          }
     }
}

/**
 * Initiates search/render for the subcategory detail page.
 */
async function searchProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
     detailPageLoader.style.display = 'block';
     productsContainerOnDetailPage.innerHTML = '';
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
             // If searching, first orderBy must match inequality field
              productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
         } else {
             // If not searching, use the original orderBy
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
         }

         // Limit results on detail page? Maybe load all initially. For now, limit for consistency.
          productsQuery = query(productsQuery, limit(50)); // Load more products initially?

         const productSnapshot = await getDocs(productsQuery);

         if (productSnapshot.empty) {
             productsContainerOnDetailPage.innerHTML = `<p style="text-align:center; padding: 20px;">${t('no_products_found', {defaultValue: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
         } else {
             productSnapshot.forEach(docSnap => {
                 const product = { id: docSnap.id, ...docSnap.data() };
                 const card = createProductCardElement(product);
                 productsContainerOnDetailPage.appendChild(card);
                 // Make visible immediately
                  setTimeout(() => card.classList.add('visible'), 10);
             });
         }
     } catch (error) {
         console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
         productsContainerOnDetailPage.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
     } finally {
         detailPageLoader.style.display = 'none';
     }
}

/**
 * Sets up animations for product cards appearing on scroll.
 */
function setupScrollAnimations() {
    // Use IntersectionObserver if available
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target); // Stop observing once visible
                }
            });
        }, {
            threshold: 0.1 // Trigger when 10% visible
        });

        // Observe elements with the reveal class that are not yet visible
        document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
            observer.observe(card);
        });
    } else {
        // Fallback for older browsers: make all cards visible immediately
        document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
             card.classList.add('visible');
        });
    }
}


/**
 * Sets up the IntersectionObserver for infinite scrolling.
 */
function setupScrollObserver() {
    if (!scrollTrigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
             // Only load more if not currently loading and not all products are loaded
             if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // Trigger loading more products via search function
                 searchProductsInFirestore(state.currentSearch, false); // false indicates loadMore
             }
        }
    }, {
        root: null, // relative to document viewport
        threshold: 0.1 // trigger when 10% of the element is visible
    });

    observer.observe(scrollTrigger);
}

// --- Event Listeners Setup ---

function setupEventListeners() {
    // --- Navigation ---
    homeBtn.addEventListener('click', async () => {
        if (!mainPage.classList.contains('page-active')) {
            showPage('mainPage'); // showPage handles history
        }
        // Reset filters when clicking home explicitly
         await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    });

    settingsBtn.addEventListener('click', () => {
        showPage('settingsPage', t('settings_title')); // showPage handles history
    });

    document.getElementById('headerBackBtn')?.addEventListener('click', () => {
        history.back(); // Let popstate handle the navigation
    });

    // --- Popups ---
    profileBtn.addEventListener('click', () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn'); // Keep profile active when sheet is open
    });
    cartBtn.addEventListener('click', () => {
        openPopup('cartSheet');
         updateActiveNav('cartBtn'); // Keep cart active
    });
    categoriesBtn.addEventListener('click', () => {
        openPopup('categoriesSheet');
         updateActiveNav('categoriesBtn'); // Keep categories active
    });
    settingsFavoritesBtn.addEventListener('click', () => openPopup('favoritesSheet'));
    settingsAdminLoginBtn.addEventListener('click', () => openPopup('loginModal', 'modal'));
    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    termsAndPoliciesBtn.addEventListener('click', () => openPopup('termsSheet'));

    // Close Popups
    sheetOverlay.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
    // Close modal on outside click
    window.addEventListener('click', (e) => {
         if (e.target.classList.contains('modal') && e.target.style.display === 'block') {
             closeCurrentPopup();
         }
    });

    // --- Search ---
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    });
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' });
    });

    // Subpage Search
     const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2];
             const activeSubSubBtn = subSubCategoryContainerOnDetailPage.querySelector('.subcategory-btn.active');
             // Correctly get subsubcategoryid from dataset
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.subsubcategoryId || 'all') : 'all';
             await searchProductsOnDetailPage(subCatId, subSubCatId, term);
         }
     }, 500);

     subpageSearchInput.addEventListener('input', () => {
         const searchTerm = subpageSearchInput.value;
         subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
         debouncedSubpageSearch(searchTerm);
     });
     subpageClearSearchBtn.addEventListener('click', () => {
         subpageSearchInput.value = '';
         subpageClearSearchBtn.style.display = 'none';
         debouncedSubpageSearch('');
     });


    // --- Forms ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Auth state change will handle UI update and closing modal
        } catch (error) {
            showNotification(t('login_error'), 'error');
            console.error("Login failed:", error);
        }
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        saveProfile(profileData);
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    });

    // --- Settings Actions ---
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
             setLanguage(btn.dataset.lang);
             applyLanguageToUI(); // Update static text
             renderMainCategoriesUI(); // Re-render categories with new lang
             renderCategoriesSheetUI();
             renderSubcategoriesUI(); // Re-render subcategories
             // Re-render current view (home or products)
             searchProductsInFirestore(state.currentSearch, true); // Trigger re-render
        });
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            const prompt = getDeferredPrompt();
            if (prompt) {
                installBtn.style.display = 'none';
                prompt.prompt();
                const { outcome } = await prompt.userChoice;
                console.log(`User response to install prompt: ${outcome}`);
                setDeferredPrompt(null);
            }
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    enableNotificationsBtn?.addEventListener('click', async () => {
         const result = await requestNotificationPermissionAndSaveToken();
         if(result.granted) {
             showNotification(t('notification_permission_granted', {defaultValue:'مۆڵەتی ئاگەداری درا'}), 'success');
         } else if (!result.error) {
             showNotification(t('notification_permission_denied', {defaultValue:'مۆڵەت نەدرا'}), 'error');
         } else {
             showNotification(t('error_generic'), 'error');
         }
    });

    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    forceUpdateBtn?.addEventListener('click', async () => {
         if (confirm(t('update_confirm'))) {
             try {
                 if ('serviceWorker' in navigator) {
                     const registrations = await navigator.serviceWorker.getRegistrations();
                     for (const registration of registrations) { await registration.unregister(); }
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
    });

    contactToggle.addEventListener('click', () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container?.classList.toggle('open');
        chevron?.classList.toggle('open');
    });

    settingsLogoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showNotification(t('logout_success'), 'success');
            // Auth state change listener will handle UI updates
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });

    // --- Dynamic Content Interactions (Event Delegation) ---

    // Product Grid (Main Page)
    productsContainer.addEventListener('click', handleProductCardAction);
    // Product Grid (Favorites Sheet)
    favoritesContainer.addEventListener('click', handleProductCardAction);
     // Product Grid (Detail Page)
     productsContainerOnDetailPage.addEventListener('click', handleProductCardAction);
     // Home Page Sections Container (for cards within sections like newest, category row etc.)
     homePageSectionsContainer.addEventListener('click', handleProductCardAction);

    // Cart Sheet
    cartItemsContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;

        const action = targetButton.dataset.action;
        const id = targetButton.dataset.id;

        if (!action || !id) return;

        if (action === 'increase-quantity') updateQuantity(id, 1);
        if (action === 'decrease-quantity') updateQuantity(id, -1);
        if (action === 'remove-from-cart') removeFromCart(id);
    });

     // Cart Action Buttons (Order Sending)
     cartActions.addEventListener('click', (e) => {
         const button = e.target.closest('button[data-action="send-order"]');
         if (!button) return;

         const methodType = button.dataset.methodType;
         const methodValue = button.dataset.methodValue;
         const message = generateOrderMessage(); // Generate message based on current cart
         if (!message) return;

         let link = '';
         const encodedMessage = encodeURIComponent(message);

         switch (methodType) {
             case 'whatsapp': link = `https://wa.me/${methodValue}?text=${encodedMessage}`; break;
             case 'viber': link = `viber://chat?number=%2B${methodValue}&text=${encodedMessage}`; break; // May need testing
             case 'telegram': link = `https://t.me/${methodValue}?text=${encodedMessage}`; break;
             case 'phone': link = `tel:${methodValue}`; break;
             case 'url': link = methodValue; break; // Assume full URL
         }

         if (link) {
             window.open(link, '_blank');
         }
     });

    // Category Filters
    mainCategoriesContainer?.addEventListener('click', async (e) => {
         const button = e.target.closest('[data-action="select-main-category"]');
         if (button) {
              const categoryId = button.dataset.categoryId;
              if (categoryId !== state.currentCategory) {
                 await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
              }
         }
    });

     subcategoriesContainer?.addEventListener('click', async (e) => {
          const button = e.target.closest('[data-action="select-subcategory"]');
          if (button) {
               const subcategoryId = button.dataset.subcategoryId;
               const mainCategoryId = button.dataset.mainCategoryId || state.currentCategory; // Ensure mainCatId is present

               if (subcategoryId === 'all') {
                    // If 'all' subcategory is clicked, just filter on main page
                    if (state.currentSubcategory !== 'all') {
                         await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
                    }
               } else {
                   // If a specific subcategory is clicked, navigate to its detail page
                   showPage('subcategoryDetailPage', 'Loading...', { mainCatId: mainCategoryId, subCatId: subcategoryId }); // Show loading title initially
                   // Fetch data and update title async
                   detailPageLoader.style.display = 'block';
                   await renderSubSubcategoriesOnDetailPageUI(mainCategoryId, subcategoryId);
                   await searchProductsOnDetailPage(subcategoryId, 'all', '');
                   detailPageLoader.style.display = 'none';
                   // Update header title after fetching subcategory name
                    try {
                         const subCatRef = doc(db, "categories", mainCategoryId, "subcategories", subcategoryId);
                         const subCatSnap = await getDoc(subCatRef);
                         if (subCatSnap.exists()) {
                              const subCat = subCatSnap.data();
                              const subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                              updateHeaderView('subcategoryDetailPage', subCatName);
                              // Update history state title
                              history.replaceState({ ...history.state, title: subCatName }, '');
                         }
                    } catch(err){ console.error("Error updating subcat title after nav:", err); }

               }
          }
     });

     subSubCategoryContainerOnDetailPage?.addEventListener('click', async (e) => {
          const button = e.target.closest('[data-action="select-subsubcategory"]');
           if (button) {
               const subSubcategoryId = button.dataset.subsubcategoryId; // Correct dataset key
               const hash = window.location.hash.substring(1);
               const ids = hash.split('_'); // e.g., #subcategory_mainId_subId
               const subCatId = ids.length > 2 ? ids[2] : null; // Get subCatId from hash
               const searchTerm = subpageSearchInput.value;

               if(!subCatId) {
                   console.error("Could not determine subCatId from hash for sub-subcategory selection.");
                   return;
               }

               // Update active button state visually
               subSubCategoryContainerOnDetailPage.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
               button.classList.add('active');

               // Fetch and render products for the selected sub-subcategory
               await searchProductsOnDetailPage(subCatId, subSubcategoryId, searchTerm);
          }
     });


    sheetCategoriesContainer?.addEventListener('click', async (e) => {
         const button = e.target.closest('[data-action="select-sheet-category"]');
         if (button) {
              const categoryId = button.dataset.categoryId;
               closeCurrentPopup(); // Close the sheet
               await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                // If navigating to main page from another page via category sheet
                if (!mainPage.classList.contains('page-active')) {
                     showPage('mainPage');
                }
         }
    });

    // GPS Button
     setupGpsButton(); // Encapsulated GPS logic

    // --- PWA Install Prompt ---
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        const installBtnElement = document.getElementById('installAppBtn');
        if (installBtnElement) installBtnElement.style.display = 'flex';
        console.log('`beforeinstallprompt` event fired.');
    });

    // --- Service Worker Updates ---
    setupServiceWorkerUpdateNotifications();

    // --- Firebase Auth State Change ---
    onAuthStateChanged(auth, async (user) => {
        // IMPORTANT: Use the actual Admin UID from your Firebase project
        const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
        const isAdmin = user && user.uid === adminUID;

        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false'); // Update session storage
        updateAdminStatusUI(isAdmin); // Update general admin UI visibility

        if (isAdmin) {
             console.log("Admin user detected.");
             // Dynamically load and initialize admin.js if not already done
             if (!window.AdminLogic?.listenersAttached) { // Check if already initialized fully
                 import('./admin.js') // Assuming admin.js exports initialize on window.AdminLogic
                     .then(() => {
                         if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                             window.AdminLogic.initialize();
                         } else {
                              console.error("AdminLogic.initialize not found after import.");
                         }
                     })
                     .catch(error => console.error("Error loading admin.js:", error));
             } else {
                  // If logic exists but maybe UI needs refresh after logout/login
                  if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                       window.AdminLogic.initialize(); // Re-run init to ensure UI is correct
                  }
             }

             // Close login modal if open
             if (loginModal.style.display === 'block') {
                 closeCurrentPopup();
             }
        } else {
             console.log("No admin user or user signed out.");
             // If a non-admin user is somehow signed in, sign them out.
             if (user) {
                 await signOut(auth);
                 console.log("Non-admin user signed out.");
             }
             // Deinitialize admin logic if it exists
             if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                 window.AdminLogic.deinitialize();
             }
        }
    });

    // --- Firebase Foreground Messaging ---
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; // Show badge immediately
    });

    // --- Custom Event Listeners ---
    document.addEventListener('cartUpdated', renderCartUI);
    document.addEventListener('favoritesUpdated', (e) => {
        const { productId, added } = e.detail;
        // Update heart icon on visible cards
        document.querySelectorAll(`.product-card[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
            btn.classList.toggle('favorited', added);
            btn.querySelector('.fa-heart')?.classList.toggle('fas', added);
            btn.querySelector('.fa-heart')?.classList.toggle('far', !added);
        });
        // Re-render favorites sheet if it's currently open
        if (document.getElementById('favoritesSheet').classList.contains('show')) {
            renderFavoritesUI();
        }
    });
    document.addEventListener('categoriesLoaded', () => {
         renderMainCategoriesUI();
         renderCategoriesSheetUI();
         // Update admin dropdowns if admin logic is loaded
         if (window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
              window.AdminLogic.updateAdminCategoryDropdowns();
         }
         // Update dropdowns in product form
         // Check if AdminLogic exists and then call populateCategoryDropdown
         if (window.AdminLogic && typeof window.AdminLogic.populateCategoryDropdown === 'function') {
              window.AdminLogic.populateCategoryDropdown();
         } else if (typeof populateCategoryDropdown === 'function') {
             // Fallback to global if needed, though ideally it's part of admin logic now
              populateCategoryDropdown();
         }
    });
     document.addEventListener('productsFetched', (e) => {
         const { products, allLoaded, error, isNewSearch } = e.detail;
         if (error) {
              productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
              skeletonLoader.style.display = 'none';
              loader.style.display = 'none';
         } else {
              renderProductsUI(isNewSearch);
         }
     });
     document.addEventListener('searchInitiated', (e) => {
          const { isNewSearch, shouldShowHomeSections } = e.detail;
          if (!shouldShowHomeSections) {
               homePageSectionsContainer.style.display = 'none'; // Hide home sections
               // Stop sliders if navigating away from home
                Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
                     if (state.sliderIntervals[layoutId]) {
                          clearInterval(state.sliderIntervals[layoutId]);
                     }
                });
                state.sliderIntervals = {};
               if(isNewSearch) renderSkeletonLoaderUI(); // Show skeleton for new searches/filters
          } else {
               // Show home sections container, hide products/skeleton
               productsContainer.style.display = 'none';
               skeletonLoader.style.display = 'none';
               scrollTrigger.style.display = 'none';
               homePageSectionsContainer.style.display = 'block';
               // Trigger re-render of home page content if needed
                renderHomePageUI(); // Call UI render function
          }
     });
      document.addEventListener('renderHomePage', renderHomePageUI);
      document.addEventListener('showProductDetails', (e) => showProductDetailsUI(e.detail.productId));

     // --- History/Navigation ---
     window.addEventListener('popstate', handlePopstate);

     // --- Save Scroll Position ---
     // Debounce scroll saving to avoid too many history replacements
     const debouncedSaveScroll = debounce(saveCurrentScrollPosition, 200);
     window.addEventListener('scroll', debouncedSaveScroll);

}


/**
 * Handles actions triggered from within product cards (add to cart, fav, share, edit, delete).
 * Uses event delegation.
 */
async function handleProductCardAction(event) {
    // Find the closest button with a data-action attribute
    const actionButton = event.target.closest('button[data-action]');
    // Find the product card itself
     const productCard = event.target.closest('.product-card');
     const productId = productCard?.dataset.productId;

     // If no product ID, exit
     if (!productId) {
          // If the click was not on a button, try to show details
           if (!actionButton && productCard && !event.target.closest('a')) { // Avoid triggering on links inside cards
                event.stopPropagation(); // Prevent potential parent handlers
                document.dispatchEvent(new CustomEvent('showProductDetails', { detail: { productId } }));
           }
         return;
     }

     // If the click was on an action button
    if (actionButton) {
         event.stopPropagation(); // Prevent card click if button is clicked
         const action = actionButton.dataset.action;

        switch (action) {
            case 'add-to-cart':
                const success = await addToCart(productId); // addToCart is async now
                if (success && !actionButton.disabled) {
                     // UI feedback for add to cart
                     const originalContent = actionButton.innerHTML;
                     actionButton.disabled = true;
                     actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                     setTimeout(() => {
                         actionButton.innerHTML = `<i class="fas fa-check"></i>`; // Just checkmark, no text
                         setTimeout(() => {
                             actionButton.innerHTML = originalContent;
                             actionButton.disabled = false;
                         }, 1200); // Shorter duration for checkmark
                     }, 400); // Shorter duration for spinner
                     // showNotification(t('product_added_to_cart')); // Notification shown by addToCart now via event
                } else if (!success) {
                     showNotification(t('product_not_found_error'), 'error');
                }
                break;
            case 'toggle-favorite':
                toggleFavorite(productId); // Let event listener update UI and show notification
                break;
            case 'share-product':
                 shareProduct(productId, productCard); // Encapsulated share logic
                break;
            case 'edit-product':
                if (window.AdminLogic && typeof window.AdminLogic.editProduct === 'function') {
                    window.AdminLogic.editProduct(productId);
                }
                break;
            case 'delete-product':
                if (window.AdminLogic && typeof window.AdminLogic.deleteProduct === 'function') {
                    window.AdminLogic.deleteProduct(productId);
                }
                break;
        }
     } else if (productCard && !event.target.closest('a')) {
         // If click was directly on card (not a button or link), show details
          document.dispatchEvent(new CustomEvent('showProductDetails', { detail: { productId } }));
     }
}

/**
 * Handles sharing a product using Web Share API or clipboard fallback.
 */
async function shareProduct(productId, productCardElement) {
     const productNameElement = productCardElement?.querySelector('.product-name');
     const productName = productNameElement ? productNameElement.textContent : t('product'); // Fallback name
     const productUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`; // Generate share URL

     const shareData = {
         title: productName,
         text: `${t('share_text')}: ${productName}`,
         url: productUrl,
     };

     try {
         if (navigator.share) {
             await navigator.share(shareData);
             console.log('Product shared successfully');
         } else {
             // Fallback: Copy URL to clipboard
             const textArea = document.createElement('textarea');
             textArea.value = productUrl;
             // Make it non-editable and invisible
             textArea.style.position = 'fixed';
             textArea.style.top = '-9999px';
             textArea.style.left = '-9999px';
             textArea.setAttribute('readonly', '');

             document.body.appendChild(textArea);
             textArea.select();
             try {
                 document.execCommand('copy'); // Use execCommand for better iframe compatibility
                 showNotification(t('product_link_copied', {defaultValue: 'لینکی کاڵا کۆپی کرا!'}), 'success');
             } catch (err) {
                 console.error('Clipboard copy failed:', err);
                 showNotification(t('clipboard_copy_failed', {defaultValue: 'کۆپیکردن سەرکەوتوو نەبوو!'}), 'error');
             }
             document.body.removeChild(textArea);
         }
     } catch (err) {
         console.error('Share error:', err);
          // Don't show error if user cancelled the share dialog
          if (err.name !== 'AbortError') {
             showNotification(t('share_error'), 'error');
          }
     }
}


/**
 * Shows the product details sheet, fetching data if necessary.
 */
async function showProductDetailsUI(productId) {
    let product = state.products.find(p => p.id === productId);

    if (!product) {
        // Attempt to fetch if not in current list
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                product = { id: docSnap.id, ...docSnap.data() };
            } else {
                showNotification(t('product_not_found_error'), 'error');
                return;
            }
        } catch (error) {
            console.error("Error fetching product details:", error);
            showNotification(t('error_generic'), 'error');
            return;
        }
    }

    // --- Populate Sheet Content ---
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name', {id: product.id});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
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
             // Add error handling for images
             img.onerror = function() { this.onerror=null; this.src='https://placehold.co/400x400/e2e8f0/2d3748?text=Error'; };
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
             thumb.onerror = function() { this.onerror=null; this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'; };
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    } else {
         imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=${t('no_image_placeholder', {defaultValue:'وێنە+نییە'})}" alt="${nameInCurrentLang}" class="active">`;
    }

    // --- Slider Logic (Internal to this function) ---
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index]) return; // Check if image exists
        images.forEach(img => img.classList.remove('active'));
        images[index].classList.add('active');
         if(thumbnails[index]) { // Check if thumbnail exists
              thumbnails.forEach(thumb => thumb.classList.remove('active'));
              thumbnails[index].classList.add('active');
         }
        currentIndex = index;
    }

    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    prevBtn.style.display = imageUrls.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = imageUrls.length > 1 ? 'flex' : 'none';
    thumbnailContainer.style.display = imageUrls.length > 1 ? 'flex' : 'none';


    // --- Populate Text Content ---
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);

    const priceContainer = document.getElementById('sheetProductPrice');
    const currency = t('currency_symbol', {defaultValue: 'د.ع.'}); // Get currency symbol via translation
    // *** FIX: Use the translated currency symbol ***
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} ${currency}</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} ${currency}</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} ${currency}</span>`;
    }

    // --- Add to Cart Button ---
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    // Remove previous listener before adding new one to avoid multiple additions
    addToCartButton.replaceWith(addToCartButton.cloneNode(true));
    document.getElementById('sheetAddToCartBtn').onclick = async () => {
         // Use data-action for consistency with card handler
         const btn = document.getElementById('sheetAddToCartBtn');
         btn.dataset.action = 'add-to-cart'; // Add action temporarily
         handleProductCardAction({ target: btn, stopPropagation: () => {} }); // Simulate event
         delete btn.dataset.action; // Clean up
         closeCurrentPopup(); // Close sheet after adding
    };


    // --- Render Related Products ---
    renderRelatedProductsUI(product); // Trigger rendering related

    // --- Open the Sheet ---
    openPopup('productDetailSheet');
}

/**
 * Fetches and renders related products within the product details sheet.
 */
async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = createSkeletonLoaderHTML(3); // Show skeleton
    section.style.display = 'block'; // Show section container

    let relatedProducts = [];
    try {
        let q;
        const baseQueryConstraints = [where('__name__', '!=', currentProduct.id), limit(6)];

        // Prioritize fetching based on the most specific category available
        if (currentProduct.subSubcategoryId) {
            q = query(productsCollection, where('subSubcategoryId', '==', currentProduct.subSubcategoryId), ...baseQueryConstraints);
        } else if (currentProduct.subcategoryId) {
            q = query(productsCollection, where('subcategoryId', '==', currentProduct.subcategoryId), ...baseQueryConstraints);
        } else if (currentProduct.categoryId) {
            q = query(productsCollection, where('categoryId', '==', currentProduct.categoryId), ...baseQueryConstraints);
        } else {
            console.log("No category info for related products.");
             section.style.display = 'none'; // Hide section if no category to relate by
            return;
        }

        const snapshot = await getDocs(q);
        relatedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (error) {
        console.error("Error fetching related products:", error);
    }

    container.innerHTML = ''; // Clear skeleton

    if (relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElement(product);
            container.appendChild(card);
             // Make visible immediately
             setTimeout(() => card.classList.add('visible'), 10);
        });
        section.style.display = 'block'; // Ensure section is visible
    } else {
        section.style.display = 'none'; // Hide section if no related products found
    }
}

/**
 * Sets up listeners for Service Worker update notifications.
 */
function setupServiceWorkerUpdateNotifications() {
    if ('serviceWorker' in navigator) {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');
        let newWorker; // To store the waiting worker

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered.');
            registration.addEventListener('updatefound', () => {
                newWorker = registration.installing;
                console.log('SW update found!', newWorker);
                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New worker is waiting
                         console.log("New SW installed, showing update notification.");
                        updateNotification?.classList.add('show');
                    }
                });
            });
        }).catch(err => console.error('SW registration failed: ', err));

        updateNowBtn?.addEventListener('click', () => {
             console.log("Update button clicked, sending skipWaiting.");
             // Use registration.waiting if available, otherwise assume newWorker
             const workerToSignal = registration.waiting || newWorker; // Check registration.waiting first
            workerToSignal?.postMessage({ action: 'skipWaiting' });
             updateNotification?.classList.remove('show'); // Hide notification
        });

        // Reload page when controller changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
             console.log("SW Controller changed, reloading.");
            window.location.reload();
        });
    }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 */
function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


/**
 * Sets up the GPS button functionality.
 */
function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan?.textContent || t('get_gps_location', {defaultValue: 'وەرگرتنی ناونیشانم بە GPS'});

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', {defaultValue: 'وێبگەڕەکەت پشتگیری GPS ناکات'}), 'error');
            return;
        }

        if(btnSpan) btnSpan.textContent = t('waiting', {defaultValue: '...چاوەڕوان بە'});
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback
                 const { latitude, longitude } = position.coords;
                 try {
                     // Using Nominatim (OSM) for reverse geocoding
                     const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,ar,en`); // Added Arabic
                     if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                     const data = await response.json();

                     if (data && data.display_name) {
                         profileAddressInput.value = data.display_name;
                         showNotification(t('address_received', {defaultValue: 'ناونیشان وەرگیرا'}), 'success');
                     } else {
                          // Try just coordinates if reverse geocoding fails
                          profileAddressInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                         showNotification(t('address_not_found_gps', {defaultValue: 'نەتوانرا ناونیشان بدۆزرێتەوە, تەنها کۆردینات دانرا'}), 'error');
                     }
                 } catch (error) {
                     console.error('Reverse Geocoding Error:', error);
                      // Set coordinates as fallback on error
                      profileAddressInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                     showNotification(t('error_getting_address', {defaultValue: 'هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا, تەنها کۆردینات دانرا'}), 'error');
                 } finally {
                     if(btnSpan) btnSpan.textContent = originalBtnText;
                     getLocationBtn.disabled = false;
                 }
            },
            (error) => { // Error Callback
                let messageKey = 'gps_error_unknown';
                switch (error.code) {
                    case 1: messageKey = 'gps_permission_denied'; break;
                    case 2: messageKey = 'gps_position_unavailable'; break;
                    case 3: messageKey = 'gps_timeout'; break;
                }
                showNotification(t(messageKey, {defaultValue: 'هەڵەیەکی نادیار ڕوویدا'}), 'error');
                if(btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
        );
    });
}


// --- Initialization ---

/**
 * Initializes the main application UI logic.
 */
async function initAppUI() {
    renderSkeletonLoaderUI(); // Show skeleton immediately
    applyLanguageToUI(); // Apply initial language to static elements

    // Fetch essential data first
    await fetchCategories(); // Fetch categories to build menus

    // Now safe to handle initial page load which might depend on categories
    handleInitialPageLoad(); // Sets up initial view based on URL

    // Setup remaining UI elements and listeners
    updateCartCountUI();
    setupEventListeners(); // Sets up all static and dynamic listeners
    setupScrollObserver(); // For infinite scroll
    renderContactLinksUI(); // Fetch and display contact links
    checkNewAnnouncementsUI(); // Check for notification badge
    // showWelcomeMessage(); // Show only on first visit (Removed for now, can be re-added)

     // Initial check for admin status (in case user is already logged in)
     const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
     updateAdminStatusUI(isAdmin);
     if (isAdmin && window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
         // Initialize admin if already logged in and logic is available (e.g., after refresh)
          window.AdminLogic.initialize();
     } else if (!window.AdminLogic && isAdmin) {
         // If admin but logic not loaded yet (edge case, handled by onAuthStateChanged too)
         import('./admin.js').then(() => window.AdminLogic?.initialize());
     }

}

// Start the UI initialization when the DOM is ready
document.addEventListener('DOMContentLoaded', initAppUI);

