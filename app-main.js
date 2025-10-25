// app-main.js
// Entry point, event listener setup, initialization coordination.

// --- Imports ---
import {
    auth, state, // From app-setup
    CART_KEY, FAVORITES_KEY, PROFILE_KEY // Constants
} from './app-setup.js';

import {
    // UI Update Functions
    updateHeaderView, showPage, closeAllPopupsUI, updateActiveNav,
    populateCategoryDropdown, renderCategoriesSheet, renderMainCategories,
    renderSubcategoriesUI, renderSubSubcategoriesUI, createProductCardElement,
    setupScrollAnimations, renderSkeletonLoader, renderProducts,
    renderCart, renderFavoritesPage, renderUserNotificationsUI,
    renderPoliciesUI, renderContactLinksUI, showWelcomeMessage,
    setupGpsButton, createProductImageInputs, populateSubcategoriesDropdown,
    populateSubSubcategoriesDropdown, updateCategoryDependentUI, updateAdminUI,
    renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPageUI, showProductDetailsWithData
} from './ui-logic.js';

import {
    // Data & Logic Functions
    handleAuthStateChange, initializeFirestorePersistence, setupCategoryListener,
    fetchSubcategories, fetchSubSubcategories, searchProducts, applyFilterState,
    navigateToFilter, addToCart, updateQuantity, removeFromCart,
    toggleFavorite, isFavorite, saveProfile, loadProfile,
    setupAnnouncementsListener, fetchAnnouncements, fetchPolicies,
    setupContactLinksListener, saveDeferredPrompt, triggerInstallPrompt,
    registerServiceWorker, requestNotificationPermissionAndToken,
    setupForegroundMessageHandler, openPopup, closeCurrentPopup,
    handlePopstate, handleInitialPageLoad
} from './data-logic.js';

import {
    t, debounce, formatDescription // Assuming these are now in utils.js
} from './utils.js';

import {
    clearProductCache,
    updateAdminCategoryDropdowns,
    updateShortcutCardCategoryDropdowns
    // Make sure these are defined and exported from admin-helpers.js
} from './admin-helpers.js';

// Re-export functions needed by admin.js through globalAdminTools if necessary
// (Alternatively, admin.js could import them if it becomes a module)
// For now, assume globalAdminTools populated in app-setup.js is sufficient.


// --- Global Variables/State (Minimize usage here) ---
// Most state is managed within state object imported from app-setup.js


// --- Initialization Function ---
async function initApp() {
    console.log("Initializing app...");

    // 1. Initialize Firestore Persistence (async)
    initializeFirestorePersistence(persistenceEnabled => {
        console.log(`Firestore persistence ${persistenceEnabled ? 'enabled' : 'failed, running online'}.`);

        // 2. Setup Core Listeners (run regardless of persistence)
        setupCoreListeners();

        // 3. Load initial local data
        loadProfile(); // Load profile from localStorage

        // 4. Setup general UI event listeners
        setupGeneralEventListeners();

        // 5. Register Service Worker (can happen in parallel)
        registerServiceWorker();

        // 6. Setup Foreground Push Message Handler
        setupForegroundMessageHandler();

        // 7. Show welcome message if first visit
        showWelcomeMessage();

        // 8. Setup GPS Button
        setupGpsButton();

        // Note: Initial page load (handleInitialPageLoad) is called
        // within the category listener callback in setupCoreListeners
        // to ensure categories are ready before filtering or showing pages.
    });
}

// --- Listener Setup ---
function setupCoreListeners() {
    // a. Authentication State Listener
    onAuthStateChanged(auth, handleAuthStateChange); // handleAuthStateChange is in data-logic

    // b. Category Listener (triggers initial load/render after categories arrive)
    const unsubscribeCategories = setupCategoryListener(async (categories) => {
        console.log("Categories updated:", categories);
        // Update UI elements that depend on categories
        updateCategoryDependentUI(categories);

        // *** Trigger initial page load/filter application *after* categories are loaded ***
        if (!state.initialLoadComplete) { // Prevent re-running on subsequent category updates
             await handleInitialPageLoad(categories); // Pass categories if needed by handler
             state.initialLoadComplete = true; // Mark initial load as complete
             console.log("Initial page load sequence completed.");
        } else {
             // If categories update later (e.g., admin adds one), refresh relevant UI parts
             renderMainCategories(categories);
             renderCategoriesSheet(categories);
             // Potentially refresh product view if category names changed significantly
        }
    });

    // c. Announcements Listener (for badge)
    const unsubscribeAnnouncements = setupAnnouncementsListener(showBadge => {
         const badge = document.getElementById('notificationBadge');
         if (badge) badge.style.display = showBadge ? 'block' : 'none';
    });

    // d. Contact Links Listener
    const unsubscribeContacts = setupContactLinksListener(links => {
        renderContactLinksUI(links); // Update contact links in settings
    });

    // Store unsubscribe functions if needed for cleanup later (e.g., in a complex SPA)
    // window.unsubscribeAppListeners = { unsubscribeCategories, unsubscribeAnnouncements, unsubscribeContacts };
}

// --- General Event Listener Setup ---
function setupGeneralEventListeners() {
    const homeBtn = document.getElementById('homeBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const profileBtn = document.getElementById('profileBtn');
    const cartBtn = document.getElementById('cartBtn');
    const categoriesBtn = document.getElementById('categoriesBtn');
    const settingsFavoritesBtn = document.getElementById('settingsFavoritesBtn');
    const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const addProductBtn = document.getElementById('addProductBtn'); // Assuming it's still needed
    const loginForm = document.getElementById('loginForm');
    const productForm = document.getElementById('productForm');
    const profileForm = document.getElementById('profileForm');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const sheetOverlay = document.getElementById('sheet-overlay');
    const contactToggle = document.getElementById('contactToggle');
    const installBtn = document.getElementById('installAppBtn');
    const notificationBtn = document.getElementById('notificationBtn');
    const termsAndPoliciesBtn = document.getElementById('termsAndPoliciesBtn');
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    const headerBackBtn = document.getElementById('headerBackBtn');
    const imageInputsContainer = document.getElementById('imageInputsContainer');
    const productCategorySelect = document.getElementById('productCategoryId');
    const productSubcategorySelect = document.getElementById('productSubcategoryId');

    // Navigation
    if (homeBtn) {
        homeBtn.onclick = async () => {
             const mainPageEl = document.getElementById('mainPage');
            if (!mainPageEl?.classList.contains('page-active')) {
                 // Push state only if navigating *to* the main page view
                 history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('#')[0].split('?')[0]); // Clean URL
                 showPage('mainPage');
            }
             // Reset filters when clicking home specifically
            await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        };
    }
    if (settingsBtn) {
        settingsBtn.onclick = () => {
             saveCurrentScrollPosition(); // Save scroll before navigating
            history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
            showPage('settingsPage', t('settings_title'));
        };
    }
     if (headerBackBtn) headerBackBtn.onclick = () => history.back();

    // Popups / Sheets
    if (profileBtn) profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    if (cartBtn) cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    if (categoriesBtn) categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    if (settingsFavoritesBtn) settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    if (settingsAdminLoginBtn) settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    if (notificationBtn) notificationBtn.onclick = () => openPopup('notificationsSheet');
    if (termsAndPoliciesBtn) termsAndPoliciesBtn.onclick = () => openPopup('termsSheet');

    // Close Popups
    if (sheetOverlay) sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target?.classList.contains('modal')) closeCurrentPopup(); }; // Use optional chaining

    // Forms
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;
            if (!email || !password) return; // Basic validation
            try {
                // signInWithEmailAndPassword will trigger onAuthStateChanged
                await signInWithEmailAndPassword(auth, email, password);
                // Admin logic initialization is handled by onAuthStateChanged listener
            } catch (error) {
                console.error("Login failed:", error);
                showNotification(t('login_error'), 'error');
            }
        };
    }
    if (profileForm) {
        profileForm.onsubmit = (e) => {
            e.preventDefault();
            const profileData = {
                name: document.getElementById('profileName')?.value || '',
                address: document.getElementById('profileAddress')?.value || '',
                phone: document.getElementById('profilePhone')?.value || '',
            };
            saveProfile(profileData); // Save profile data
            closeCurrentPopup(); // Close the profile sheet
        };
    }

    // Product Form (Admin only, but listener can be attached)
    if (productForm) {
         // Moved submit logic to admin.js, triggered via AdminLogic.setupAdminEventListeners
         // Keep category dropdown listeners here as they affect UI immediately
        if (productCategorySelect) {
            productCategorySelect.addEventListener('change', async (e) => {
                const mainCatId = e.target.value;
                 // Fetch and populate subcategories
                 const subcategories = await fetchSubcategories(mainCatId);
                 populateSubcategoriesDropdown(mainCatId, subcategories);
                 // Reset and hide sub-subcategories
                 populateSubSubcategoriesDropdown(null, null, []);
            });
        }
        if (productSubcategorySelect) {
             productSubcategorySelect.addEventListener('change', async (e) => {
                 const mainCatId = productCategorySelect?.value; // Get main category ID again
                 const subCatId = e.target.value;
                  // Fetch and populate sub-subcategories
                  const subSubcategories = await fetchSubSubcategories(mainCatId, subCatId);
                  populateSubSubcategoriesDropdown(mainCatId, subCatId, subSubcategories);
             });
        }
    }
     // Image preview listener for product form
     if (imageInputsContainer) {
         imageInputsContainer.addEventListener('input', (e) => {
             const target = e.target;
             if (target && target.classList.contains('productImageUrl')) {
                 const previewImg = target.nextElementSibling;
                 if (previewImg && previewImg.tagName === 'IMG') {
                     const url = target.value;
                     const index = Array.from(target.parentElement.parentElement.children).indexOf(target.parentElement);
                     previewImg.src = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
                 }
             }
         });
     }


    // Search
    const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
    if (searchInput) {
        searchInput.oninput = () => {
            const searchTerm = searchInput.value;
            if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            debouncedSearch(searchTerm);
        };
    }
    if (clearSearchBtn) {
        clearSearchBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            navigateToFilter({ search: '' }); // Trigger filter update
        };
    }
    // Subpage Search
     const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            // Find active sub-sub button
             const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
             const activeSubSubBtn = subSubContainer?.querySelector('.subcategory-btn.active');
            const subSubCatId = activeSubSubBtn?.dataset.id || 'all';
            await renderProductsOnDetailPageUI(subCatId, subSubCatId, term); // Call UI function
        }
    }, 500);

    if (subpageSearchInput) {
        subpageSearchInput.oninput = () => {
             const searchTerm = subpageSearchInput.value;
             if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
             debouncedSubpageSearch(searchTerm);
        };
    }
     if (subpageClearSearchBtn) {
         subpageClearSearchBtn.onclick = () => {
             if (subpageSearchInput) subpageSearchInput.value = '';
             subpageClearSearchBtn.style.display = 'none';
             debouncedSubpageSearch(''); // Trigger search with empty term
         };
     }


    // Settings Actions
    if (settingsLogoutBtn) {
        settingsLogoutBtn.onclick = async () => {
            try {
                await signOut(auth);
                showNotification(t('logout_success'), 'success');
                 // Auth state change listener will handle UI updates
            } catch (error) {
                console.error("Logout error:", error);
                 showNotification(t('error_generic'), 'error');
            }
        };
    }
    if (contactToggle) {
        contactToggle.onclick = () => {
            const container = document.getElementById('dynamicContactLinksContainer');
            const chevron = contactToggle.querySelector('.contact-chevron');
            container?.classList.toggle('open');
            chevron?.classList.toggle('open');
        };
    }
    if (installBtn) installBtn.addEventListener('click', triggerInstallPrompt);
    if (enableNotificationsBtn) enableNotificationsBtn.addEventListener('click', requestNotificationPermissionAndToken);
    if (forceUpdateBtn) {
         forceUpdateBtn.addEventListener('click', async () => { // Make async
             if (confirm(t('update_confirm'))) {
                 try {
                     // Unregister service workers
                     if ('serviceWorker' in navigator) {
                         const registrations = await navigator.serviceWorker.getRegistrations();
                         for (const registration of registrations) {
                             await registration.unregister();
                         }
                         console.log('Service Workers unregistered.');
                     }
                     // Clear caches
                     if (window.caches) {
                         const keys = await window.caches.keys();
                         await Promise.all(keys.map(key => window.caches.delete(key)));
                         console.log('All caches cleared.');
                     }
                     showNotification(t('update_success'), 'success');
                     // Reload the page after a short delay
                     setTimeout(() => window.location.reload(true), 1500);
                 } catch (error) {
                     console.error('Error during force update:', error);
                     showNotification(t('error_generic'), 'error');
                 }
             }
         });
    }

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
             const lang = btn.dataset.lang;
             if (lang && lang !== state.currentLanguage) {
                // Update state
                state.currentLanguage = lang;
                localStorage.setItem('language', lang);

                // Update HTML lang/dir
                document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
                document.documentElement.dir = 'rtl'; // Always RTL for these languages

                 // Translate static elements
                 document.querySelectorAll('[data-translate-key]').forEach(element => {
                     const key = element.dataset.translateKey;
                     const translation = t(key); // Use updated state via t()
                     if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                         if (element.placeholder !== undefined) element.placeholder = translation;
                     } else {
                         element.textContent = translation;
                     }
                 });

                 // Update active language button
                 document.querySelectorAll('.lang-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.lang === lang);
                });

                 // Re-render dynamic content that depends on language
                 clearProductCache(); // Clear cache as names/descriptions change
                 searchProducts(state.currentSearch, true); // Re-fetch/render products
                 renderMainCategories(state.categories); // Re-render categories
                 renderCategoriesSheet(state.categories); // Re-render sheet categories
                 if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(state.cart);
                 if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(state.favorites, sessionStorage.getItem('isAdmin') === 'true');
                 if (document.getElementById('notificationsSheet')?.classList.contains('show')) {
                    fetchAnnouncements().then(announcements => renderUserNotificationsUI(announcements));
                 }
                 if (document.getElementById('termsSheet')?.classList.contains('show')) {
                    fetchPolicies().then(policies => renderPoliciesUI(policies));
                 }
                 // Re-render contact links if names changed
                 setupContactLinksListener(renderContactLinksUI); // Re-setup listener to re-render

                  // Re-render sub/sub-sub if necessary (might be complex, consider just re-navigating or simpler update)
                 if(state.currentCategory !== 'all') {
                     fetchSubcategories(state.currentCategory).then(data => renderSubcategoriesUI(state.currentCategory, data));
                 }
                 if (state.currentSubcategory !== 'all') {
                    fetchSubSubcategories(state.currentCategory, state.currentSubcategory).then(data => renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory, data));
                 }
            }
        };
    });

    // Infinite Scroll Setup
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // Load more products only when the main page product grid is visible
                 const mainPageActive = document.getElementById('mainPage')?.classList.contains('page-active');
                 const homeSectionsHidden = document.getElementById('homePageSectionsContainer')?.style.display === 'none';
                 if(mainPageActive && homeSectionsHidden) {
                     searchProducts(state.currentSearch, false); // false = load more
                 }
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }

    // History navigation listener
    window.addEventListener('popstate', handlePopstate);

    // PWA install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); // Prevent mini-infobar
        saveDeferredPrompt(e); // Save the event in data-logic state
    });

     console.log("General event listeners attached.");
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);
