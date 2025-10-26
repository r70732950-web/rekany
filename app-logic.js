// app-logic.js: Main application logic controller / کۆنترۆڵکەری سەرەکی لۆجیکی بەرنامە

// --- Core Imports ---
import {
    db, auth, messaging, // Firebase services
    productsCollection, categoriesCollection, announcementsCollection, // Firestore collections
    promoGroupsCollection, brandGroupsCollection, // Added collections
    state, // Global state object (mutable)
    PRODUCTS_PER_PAGE, // Constants
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, // Core DOM Elements
    searchInput, clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, termsAndPoliciesBtn, subSubcategoriesContainer
} from './app-setup.js';

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Module Imports ---
import { debounce, t, saveCurrentScrollPosition } from './utils.js';
import { saveCart, addToCart, renderCart, updateQuantity, removeFromCart, generateOrderMessage } from './cart.js';
import {
    showNotification, openPopup, closeCurrentPopup, closeAllPopupsUI,
    showPage, updateHeaderView, updateActiveNav,
    renderSkeletonLoader, createProductCardElement, setupScrollAnimations, renderProducts,
    renderMainCategories, renderCategoriesSheet, renderSubcategories,
    isFavorite, saveFavorites, renderFavoritesPage,
    checkNewAnnouncements, renderUserNotifications, renderPolicies, renderContactLinks,
    renderCartActionButtons, // Make sure this is exported from ui.js
    renderSingleCategoryRow, // Assuming these were moved to ui.js or a new home.js
    renderBrandsSection,
    renderNewestProductsSection,
    renderAllProductsSection,
    renderSingleShortcutRow,
    createPromoCardElement // If moved to ui.js
    // Add other UI functions if they were moved e.g., showProductDetails, renderRelatedProducts etc.
} from './ui.js';

// --- Global State & Variables ---
// state is imported from app-setup.js

// --- Initialization ---

/**
 * Initializes the main application logic after DOM content is loaded.
 * Attempts to enable Firestore offline persistence first.
 * دەستپێکردنی لۆجیکی سەرەکی بەرنامە دوای باربوونی ناوەڕۆکی DOM.
 * سەرەتا هەوڵدەدات کۆگای ئۆفلاینی Firestore چالاک بکات.
 */
function init() {
    renderSkeletonLoader(); // Show skeleton loader immediately

    // Attempt to enable offline persistence
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic(); // Initialize core logic after persistence setup
        })
        .catch((err) => {
            // Handle known persistence errors gracefully
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic(); // Initialize core logic even if persistence fails
        });
}

/**
 * Core initialization sequence for the application.
 * Fetches initial data (categories), sets up UI, event listeners, and PWA features.
 * زنجیرەی سەرەکی دەستپێکردن بۆ بەرنامەکە.
 * داتای سەرەتایی وەردەگرێت (جۆرەکان)، UI دادەمەزرێنێت، گوێگرەکانی ڕووداوەکان، و تایبەتمەندییەکانی PWA.
 */
function initializeAppLogic() {
    // Ensure sliderIntervals object exists in state (added for robustness)
     if (!state.sliderIntervals) {
         state.sliderIntervals = {};
     }

    // Fetch categories and set up initial UI based on them
    // Using onSnapshot to listen for real-time category updates
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Add 'All' category at the beginning
        state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: 'هەموو', name_ku_badini: 'هەمی', name_ar:'الكل' }, ...fetchedCategories]; // Add 'All' category dynamically
        updateCategoryDependentUI(); // Update dropdowns and category buttons that depend on categories

        // Handle initial page load based on URL (hash or query params)
        // This needs to run *after* categories are loaded to potentially filter correctly
        handleInitialPageLoad();

        // Apply language after categories are loaded to ensure names are correct
        setLanguage(state.currentLanguage);
    }, (error) => {
        console.error("Error fetching categories:", error);
        // Handle error, maybe show a message to the user
        document.getElementById('mainCategoriesContainer').innerHTML = `<p>${t('error_fetching_categories')}</p>`;
        document.getElementById('sheetCategoriesContainer').innerHTML = `<p>${t('error_fetching_categories')}</p>`;
         handleInitialPageLoad(); // Still try to load based on URL even if categories fail
         setLanguage(state.currentLanguage);
    });

    // Setup other parts of the app
    updateCartCount(); // Initial cart count update
    setupEventListeners(); // Attach all event listeners
    setupScrollObserver(); // Setup infinite scroll
    renderContactLinks(); // Fetch and display contact links
    checkNewAnnouncements(); // Check for notification badge
    // showWelcomeMessage(); // Show only on first visit (Consider if needed)
    setupGpsButton(); // Add GPS functionality to profile address

    // Initial language setup (might be called again after categories load)
    setLanguage(state.currentLanguage);
}


// --- Authentication ---

// Listen for authentication state changes
onAuthStateChanged(auth, async (user) => {
    // IMPORTANT: Use the actual Admin UID from your Firebase project
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Replace with your Admin UID
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Use sessionStorage for temporary admin status
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Ensure admin logic is loaded and DOM is ready before initializing
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  window.AdminLogic.initialize();
             } else {
                  window.addEventListener('load', window.AdminLogic.initialize, { once: true }); // Ensure it runs only once
             }
        } else {
             console.warn("AdminLogic not found or initialize not a function. Admin features might not work.");
        }
        // Close login modal if user successfully logs in as admin
         if (loginModal && loginModal.style.display === 'block') {
             closeCurrentPopup(); // Use the UI function
         }
    } else {
        sessionStorage.removeItem('isAdmin');
        // If a non-admin user is somehow signed in, sign them out.
        if (user) {
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        // Deinitialize admin UI elements if admin logic is loaded
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Clean up admin UI elements
        }
         // Ensure admin UI elements controlled directly here are hidden
         updateAdminUI(false);
    }
});


// --- Language ---

/**
 * Sets the application language, updates UI text, and re-renders relevant content.
 * زمانی بەرنامە دادەنێت، دەقی UI نوێ دەکاتەوە، و ناوەڕۆکی پەیوەندیدار دووبارە پیشان دەداتەوە.
 * @param {string} lang The language code (e.g., 'ku_sorani', 'ku_badini', 'ar'). / کۆدی زمان.
 */
function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang); // Save preference

    // Set document language and direction
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

    // Update all elements with data-translate-key attribute
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key); // Get translation using utility function
        // Update placeholder or text content based on element type
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) { // Check if placeholder exists
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });

    // Update active state of language buttons in settings
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render components that depend heavily on language
     renderMainCategories(); // Update main category names/icons
     renderCategoriesSheet(); // Update sheet category names/icons
     if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(); // Re-render cart if open
     if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(); // Re-render favorites if open
     if (document.getElementById('notificationsSheet')?.classList.contains('show')) renderUserNotifications(); // Re-render notifications if open
     if (document.getElementById('termsSheet')?.classList.contains('show')) renderPolicies(); // Re-render policies if open
     renderContactLinks(); // Update contact link names
     renderCartActionButtons(); // Update order button names


    // Determine if we need to re-render home page sections or just the product list
    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    // Clear previous home sections before potentially re-rendering them
     if (homeSectionsContainer) {
         homeSectionsContainer.innerHTML = '';
         // Also clear main products container as structure might change
         productsContainer.innerHTML = '';
         productsContainer.style.display = 'none';
         skeletonLoader.style.display = 'none';
         document.getElementById('scroll-loader-trigger').style.display = 'none';
     }


    if (isHomeView) {
        // If on the unfiltered home view, re-render the dynamic home sections
        renderHomePageContent(); // This function now handles rendering sections
    } else {
        // If filters/search are active, re-fetch and render the filtered product list
        searchProductsInFirestore(state.currentSearch, true); // `true` forces a fresh search/render
    }

     // Re-render subcategories if a main category is selected
     renderSubcategories(state.currentCategory);

     // Update titles if subpage is active
     if (document.getElementById('settingsPage')?.classList.contains('page-active')) {
         updateHeaderView('settingsPage', t('settings_title'));
     }
     // Note: Subcategory detail page title update might need specific handling on language change if active
}

// --- PWA & Service Worker ---

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent the default mini-infobar
    state.deferredPrompt = e; // Stash the event
    // Show custom install button in settings
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex'; // Use flex to match other settings items
    }
    console.log('`beforeinstallprompt` event fired.');
});

// Service Worker update handling
if ('serviceWorker' in navigator) {
    const updateNotificationElement = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        // Listen for updates found during registration check or later
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                // If new worker is installed and waiting, and the page is currently controlled
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('New service worker installed and waiting.');
                    // Show the update notification bar
                    if (updateNotificationElement) {
                        updateNotificationElement.classList.add('show');
                    }
                }
            });
        });

        // Event listener for the "Update Now" button
        if (updateNowBtn) {
            updateNowBtn.addEventListener('click', () => {
                // Send message to the waiting SW to skip waiting and activate
                if (registration.waiting) {
                    registration.waiting.postMessage({ action: 'skipWaiting' });
                    // Optionally hide the notification immediately
                    // if (updateNotificationElement) updateNotificationElement.classList.remove('show');
                }
            });
        }

    }).catch(err => {
        console.error('Service Worker registration failed: ', err);
    });

    // Listen for controller change (happens after skipWaiting activates the new worker)
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Ensure refresh happens only once
        if (refreshing) return;
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}

/**
 * Force clears Service Worker registrations and Cache Storage, then reloads.
 * بە زۆر تۆمارەکانی Service Worker و Cache Storage پاک دەکاتەوە، پاشان دووبارە باردەکاتەوە.
 */
async function forceUpdate() {
    // Use confirm (or a custom modal UI) before proceeding
    if (confirm(t('update_confirm'))) {
        try {
            // Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            // Clear all caches
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload(true); // `true` forces reload from server
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


// --- Data Fetching & Rendering ---

/**
 * Fetches products from Firestore based on current filters (category, subcategory, search) and pagination state.
 * Renders the fetched products or home page sections.
 * وەرگرتنی کاڵاکان لە Firestore بە پشت بەستن بە فلتەرەکانی ئێستا (جۆر، جۆری لاوەکی، گەڕان) و دۆخی پەڕەبەندی.
 * پیشاندانی کاڵا وەرگیراوەکان یان بەشەکانی پەڕەی سەرەکی.
 * @param {string} [searchTerm=''] The current search term. / دەستەواژەی گەڕانی ئێستا.
 * @param {boolean} [isNewSearch=false] If true, clears previous results and starts from the beginning. / ئەگەر true بوو، ئەنجامەکانی پێشوو پاک دەکاتەوە و لە سەرەتاوە دەست پێ دەکات.
 */
async function searchProductsInFirestore(searchTerm = state.currentSearch || '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Determine if the full, unfiltered home page content should be shown
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Show Home Sections ---
        if (productsContainer) productsContainer.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (scrollTrigger) scrollTrigger.style.display = 'none';
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        // Render home content only if the container is empty (or if forced on new search/language change)
        if (homeSectionsContainer && (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch)) {
            await renderHomePageContent(); // Render dynamic sections
        }
        // No need to fetch products list when showing home sections
        return;
    } else {
        // --- Show Filtered Product List ---
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none'; // Hide home sections
        // Stop all promo rotations when navigating away from the full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object

        // --- Caching Logic (Optional but recommended for performance) ---
        // const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
        // if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        //     // Restore from cache if available for a new search
        //     state.products = state.productCache[cacheKey].products;
        //     state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        //     state.allProductsLoaded = state.productCache[cacheKey].allLoaded;
        //
        //     if(skeletonLoader) skeletonLoader.style.display = 'none';
        //     if(loader) loader.style.display = 'none';
        //     if(productsContainer) productsContainer.style.display = 'grid';
        //
        //     renderProducts(state.products, productsContainer, false); // Render cached products
        //     if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        //     return; // Exit after rendering from cache
        // }
        // --- End Caching Logic ---


        // Prevent concurrent loading
        if (state.isLoadingMoreProducts && !isNewSearch) return;

        // Reset state for a new search/filter
        if (isNewSearch) {
            state.allProductsLoaded = false;
            state.lastVisibleProductDoc = null;
            state.products = []; // Clear current products
            renderSkeletonLoader(skeletonLoader); // Show loading state
        }

        // Don't load more if all products are already loaded for the current filter
        if (state.allProductsLoaded && !isNewSearch) return;

        state.isLoadingMoreProducts = true;
        if (loader && !isNewSearch) loader.style.display = 'block'; // Show infinite scroll loader only when loading more

        try {
            let productsQueryRef = productsCollection; // Start with the base collection

            // --- Apply Category Filters ---
            if (state.currentCategory && state.currentCategory !== 'all') {
                productsQueryRef = query(productsQueryRef, where("categoryId", "==", state.currentCategory));
            }
            if (state.currentSubcategory && state.currentSubcategory !== 'all') {
                productsQueryRef = query(productsQueryRef, where("subcategoryId", "==", state.currentSubcategory));
            }
            if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
                productsQueryRef = query(productsQueryRef, where("subSubcategoryId", "==", state.currentSubSubcategory));
            }

            // --- Apply Search Filter ---
            const finalSearchTerm = searchTerm.trim().toLowerCase();
            if (finalSearchTerm) {
                // Apply search range query on 'searchableName' field
                productsQueryRef = query(productsQueryRef,
                    where('searchableName', '>=', finalSearchTerm),
                    where('searchableName', '<=', finalSearchTerm + '\uf8ff') // \uf8ff is a high Unicode character for range end
                );
            }

            // --- Apply Ordering ---
            // If searching, the first orderBy must match the inequality field ('searchableName')
            if (finalSearchTerm) {
                productsQueryRef = query(productsQueryRef, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
            } else {
                // Default ordering by creation date (newest first)
                productsQueryRef = query(productsQueryRef, orderBy("createdAt", "desc"));
            }

            // --- Apply Pagination ---
            // If loading more (not a new search) and we have a previous last document, start after it
            if (state.lastVisibleProductDoc && !isNewSearch) {
                productsQueryRef = query(productsQueryRef, startAfter(state.lastVisibleProductDoc));
            }

            // --- Apply Limit ---
            productsQueryRef = query(productsQueryRef, limit(PRODUCTS_PER_PAGE));

            // --- Execute Query ---
            const productSnapshot = await getDocs(productsQueryRef);
            const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // --- Update State ---
            if (isNewSearch) {
                state.products = newProducts; // Replace products for new search
            } else {
                state.products = [...state.products, ...newProducts]; // Append for infinite scroll
            }

            // Update pagination state
            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Store last doc for next page
            state.allProductsLoaded = productSnapshot.docs.length < PRODUCTS_PER_PAGE; // Check if this was the last page

             // --- Update Cache (Optional) ---
             // if (isNewSearch && state.productCache) {
             //     state.productCache[cacheKey] = {
             //         products: [...state.products], // Store a copy
             //         lastVisible: state.lastVisibleProductDoc,
             //         allLoaded: state.allProductsLoaded
             //     };
             // }
             // --- End Update Cache ---


            // --- Render Results ---
            renderProducts(newProducts, productsContainer, !isNewSearch); // Append if loading more

            if (isNewSearch && state.products.length === 0) {
                 // If it was a new search and no results found, show message
                 productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found')}</p>`;
            }


        } catch (error) {
            console.error("Error fetching/searching products:", error);
             if(productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`; // Show error message
             state.allProductsLoaded = true; // Stop further loading attempts on error
        } finally {
            state.isLoadingMoreProducts = false;
            if(loader) loader.style.display = 'none'; // Hide loading indicator
            if(skeletonLoader && isNewSearch) skeletonLoader.style.display = 'none'; // Hide skeleton loader after new search
            if(productsContainer) productsContainer.style.display = 'grid'; // Ensure product grid is visible
            if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Show/hide infinite scroll trigger
        }
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
                 // If only main category is selected, filter on the main page
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
            const card = createProductCardElement(product); // Use UI function
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}


// Function updated to accept layoutId and pass it to createPromoCardElement
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        state.isRenderingHomePage = false;
        return;
    }

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show loading state
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
            homeSectionsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('home_layout_empty')}</p>`;
        } else {
            // Sequentially render each section based on its type
            for (const docSnapshot of layoutSnapshot.docs) { // Use docSnapshot to avoid naming conflict
                const section = docSnapshot.data();
                const layoutId = docSnapshot.id; // Get the document ID as layoutId
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                             sectionElement = await renderPromoCardsSectionForHome(section.groupId, layoutId); // Pass layoutId
                        } else { console.warn("Promo slider section is missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                             sectionElement = await renderBrandsSection(section.groupId); // Pass groupId
                        } else { console.warn("Brands section is missing groupId."); }
                        break;
                    case 'newest_products':
                         sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                         if (section.rowId) {
                             sectionElement = await renderSingleShortcutRow(section.rowId, section.name); // Pass rowId and name
                         } else { console.warn("Single shortcut row section is missing rowId."); }
                         break;
                    case 'single_category_row':
                         if (section.categoryId) {
                             sectionElement = await renderSingleCategoryRow(section); // Pass the whole section data
                         } else { console.warn("Single category row section is missing categoryId."); }
                         break;
                    case 'all_products':
                         sectionElement = await renderAllProductsSection();
                         break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                // Append the rendered section element if it was created successfully
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_rendering_home')}</p>`;
    } finally {
        state.isRenderingHomePage = false; // Release the rendering lock
         // No need to explicitly hide skeleton, it's cleared by setting innerHTML
    }
}


// Function updated to accept layoutId, create unique ID, and manage its interval
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item slider too
    promoGrid.style.marginBottom = '24px'; // Add spacing below slider
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID using layoutId

    try {
        // Query cards within the specified group, ordered by 'order'
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // Local state for this specific slider instance
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the initial card element
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass sliderState
            promoGrid.appendChild(promoCardElement);

            // Set up automatic rotation only if there's more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        // If element is gone or interval was cleared elsewhere, stop this timer
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            // Clean up global state if necessary (though it should be cleared centrally)
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation
                    }
                    // Advance index and update image
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Clear any pre-existing interval for this layoutId before starting a new one
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start the interval and store its ID globally using layoutId as the key
                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize if needed
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }

            return promoGrid; // Return the container element
        } else {
             console.warn(`No promo cards found for group ${groupId}`);
             return null; // Return null if no cards to render
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
        return null; // Return null on error
    }
}


// --- History and Navigation ---

/**
 * Handles the initial page load, parsing URL parameters and hash to show the correct view.
 * مامەڵە لەگەڵ بارکردنی سەرەتایی پەڕە دەکات، پارامەترەکانی URL و هاش شیدەکاتەوە بۆ پیشاندانی دیمەنی ڕاست.
 */
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    let pageId = 'mainPage'; // Default to main page
    let pageTitle = '';
    let isSubcategoryDetail = false;
    let detailMainCatId = null;
    let detailSubCatId = null;

    // --- Determine Target Page from Hash ---
    if (hash.startsWith('subcategory_')) {
        const ids = hash.split('_');
        if (ids.length >= 3) {
            pageId = 'subcategoryDetailPage';
            isSubcategoryDetail = true;
            detailMainCatId = ids[1];
            detailSubCatId = ids[2];
            // Title will be fetched async in showSubcategoryDetailPage
        }
    } else if (hash === 'settingsPage') {
        pageId = 'settingsPage';
        pageTitle = t('settings_title');
    }
    // Add other hash-based pages here if needed

    // --- Apply Initial State and Show Page ---
    if (pageId === 'mainPage') {
         // Apply filters from URL parameters for the main page
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is always 0
        };
        history.replaceState(initialState, ''); // Set initial history state without adding entry
        applyFilterState(initialState); // Apply filters and fetch products
        showPage('mainPage'); // Show the main page UI

        // Check if a specific popup needs to be opened based on hash
        const element = document.getElementById(hash);
         if (element) {
             const isSheet = element.classList.contains('bottom-sheet');
             const isModal = element.classList.contains('modal');
             if (isSheet || isModal) {
                 openPopup(hash, isSheet ? 'sheet' : 'modal');
             }
         }

    } else if (isSubcategoryDetail) {
         // History state and showing the page are handled within showSubcategoryDetailPage
         // We call it here to trigger the loading process.
         // Pass 'true' for `fromHistory` to prevent adding a new history entry.
         showSubcategoryDetailPage(detailMainCatId, detailSubCatId, true);
    } else {
        // For other pages like settings
        history.replaceState({ type: 'page', id: pageId, title: pageTitle }, '', `#${pageId}`);
        showPage(pageId, pageTitle);
    }


    // --- Handle Direct Product Link ---
    const productId = params.get('product');
    if (productId) {
         // Use setTimeout to ensure the main UI is likely rendered before opening the sheet
        setTimeout(() => showProductDetailsById(productId), 500); // Use specific function
    }
}


/**
 * Navigates to a new filter state, updating the URL and history.
 * دەچێت بۆ دۆخێکی فلتەری نوێ، URL و مێژوو نوێ دەکاتەوە.
 * @param {object} newState Changes to apply to the current filter state (e.g., { category: 'newId' }). / گۆڕانکارییەکان بۆ جێبەجێکردن لەسەر دۆخی فلتەری ئێستا.
 */
async function navigateToFilter(newState) {
    // Save current scroll position before navigating
    saveCurrentScrollPosition();

    // Create the new full state based on current state and changes
    const finalState = {
        category: newState.category !== undefined ? newState.category : state.currentCategory,
        subcategory: newState.subcategory !== undefined ? newState.subcategory : state.currentSubcategory,
        subSubcategory: newState.subSubcategory !== undefined ? newState.subSubcategory : state.currentSubSubcategory,
        search: newState.search !== undefined ? newState.search : state.currentSearch,
        scroll: 0 // Reset scroll for new filter navigation
    };

    // Construct URL search parameters based on the new state
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    // Create the new URL
    const newUrl = `${window.location.pathname}?${params.toString()}`; // Maintain base path, update params

    // Push the new state and URL to the browser history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state (fetches data and updates UI)
    await applyFilterState(finalState);
}


/**
 * Applies a given filter state, updating the UI and fetching relevant products.
 * دۆخێکی فلتەری دیاریکراو جێبەجێ دەکات، UI نوێ دەکاتەوە و کاڵا پەیوەندیدارەکان وەردەگرێت.
 * @param {object} filterState The filter state object { category, subcategory, subSubcategory, search, scroll }. / ئۆبجێکتی دۆخی فلتەر.
 * @param {boolean} [fromPopState=false] Indicates if the function is called due to a popstate event (history navigation). / ئاماژە بەوە دەکات کە ئایا فەنکشنەکە بەهۆی ڕووداوی popstate ـەوە بانگ کراوە.
 */
async function applyFilterState(filterState, fromPopState = false) {
    // Update global state variables
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update search input field and clear button visibility
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category UI elements to reflect the current state
    renderMainCategories(); // Highlight active main category
    await renderSubcategories(state.currentCategory); // Render relevant subcategories (or hide)
    // No need to render sub-subcategories on main page renderSubSubcategories(state.currentCategory, state.currentSubcategory);

    // Fetch and render products based on the new state
    // Pass `true` for `isNewSearch` to clear previous results and fetch fresh data
    await searchProductsInFirestore(state.currentSearch, true);

    // Restore scroll position if navigating back/forward in history
    if (fromPopState && typeof filterState.scroll === 'number') {
         // Use setTimeout to ensure content is rendered before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        // Scroll to top for new filter applications (unless restoring from popstate)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// --- Event Listeners Setup ---

/**
 * Attaches all primary event listeners for the application UI.
 * هەموو گوێگرە سەرەکییەکانی ڕووداوەکان بۆ UI ی بەرنامەکە دادەمەزرێنێت.
 */
function setupEventListeners() {
    // --- Bottom Navigation ---
    homeBtn.onclick = async () => {
        // If not already on the main page, navigate to it
        if (!mainPage.classList.contains('page-active')) {
             // Push state for page navigation (clears filters/search in URL)
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage'); // Show the main page UI
        }
        // Always reset filters when explicitly clicking the home button
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
         // Push state for page navigation
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title')); // Show settings page UI
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet'); // Open profile bottom sheet
        updateActiveNav('profileBtn'); // Highlight profile in nav
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet'); // Open cart bottom sheet
        updateActiveNav('cartBtn'); // Highlight cart in nav
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet'); // Open categories bottom sheet
        updateActiveNav('categoriesBtn'); // Highlight categories in nav
    };

    // --- Header Buttons ---
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Use browser history to go back
    };

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet'); // Open notifications sheet
    });

    // --- Search Input ---
    const debouncedSearch = debounce((term) => {
         // Use navigateToFilter to update URL and trigger search
        navigateToFilter({ search: term, category: 'all', subcategory: 'all', subSubcategory: 'all' }); // Reset categories on new search from header
    }, 500); // 500ms delay

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none'; // Show/hide clear button
        debouncedSearch(searchTerm); // Trigger debounced search
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = ''; // Clear input field
        clearSearchBtn.style.display = 'none'; // Hide clear button
        navigateToFilter({ search: '' }); // Trigger search with empty term
    };

     // Subpage search logic (for subcategory detail page)
     const subpageSearchInput = document.getElementById('subpageSearchInput');
     const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

     const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         // Ensure we are on the subcategory detail page
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2]; // Get subcategory ID from hash

             // Find the currently active sub-subcategory button on the detail page
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default to 'all'

             // Re-render products on the detail page with the new search term
             await renderProductsOnDetailPage(subCatId, subSubCatId, term); // Function defined in ui.js
         }
     }, 500);

     if (subpageSearchInput) {
         subpageSearchInput.oninput = () => {
             const searchTerm = subpageSearchInput.value;
             if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
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


    // --- Popup Closing ---
    const sheetOverlay = document.getElementById('sheet-overlay');
    if (sheetOverlay) sheetOverlay.onclick = closeCurrentPopup; // Close on overlay click
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup); // Close buttons
    // Close modals if clicked outside the content area
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // --- Forms ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = '...چوونەژوورەوە';

        try {
            // Attempt Firebase sign-in
            await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            // Success: onAuthStateChanged will handle UI updates and closing the modal
        } catch (error) {
            console.error("Login error:", error);
            showNotification(t('login_error'), 'error'); // Show specific error message
            submitButton.disabled = false; // Re-enable button on error
            submitButton.textContent = originalButtonText;
        }
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        // Update profile state
        state.userProfile = {
            name: document.getElementById('profileName').value.trim(),
            address: document.getElementById('profileAddress').value.trim(),
            phone: document.getElementById('profilePhone').value.trim(),
        };
        // Save profile to local storage
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
        showNotification(t('profile_saved'), 'success'); // Show confirmation
        closeCurrentPopup(); // Close the profile sheet
    };

    // --- Settings Page Buttons ---
    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet'); // Open favorites sheet
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal'); // Open admin login modal
    };

    settingsLogoutBtn.onclick = async () => {
        try {
            await signOut(auth); // Sign out from Firebase
            showNotification(t('logout_success'), 'success'); // Show confirmation
            // onAuthStateChanged will handle UI updates
        } catch (error) {
             console.error("Logout error:", error);
             showNotification(t('error_generic'), 'error');
        }
    };

    contactToggle.onclick = () => {
        // Toggle visibility of contact links section in settings
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        if (container && chevron) {
            container.classList.toggle('open');
            chevron.classList.toggle('open'); // Rotate chevron icon
        }
    };

    termsAndPoliciesBtn.addEventListener('click', () => {
        openPopup('termsSheet'); // Open terms and policies sheet
    });

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission); // Request permission
    }

    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate); // Trigger force update
    }

    // Install App button (visibility handled by 'beforeinstallprompt' listener)
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none'; // Hide button after prompting
                state.deferredPrompt.prompt(); // Show the install prompt
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null; // Clear the saved prompt event
            }
        });
    }

     // --- Category Selection in Sheets/Main Page ---
     // Add listeners for dynamically created category buttons
     document.body.addEventListener('click', async (e) => {
         // Main category button click (top horizontal scroll)
         const mainCatBtn = e.target.closest('.main-category-btn');
         if (mainCatBtn) {
             await navigateToFilter({
                 category: mainCatBtn.dataset.category,
                 subcategory: 'all', // Reset subcategory when main changes
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search when changing category
             });
             return; // Stop further processing
         }

         // Subcategory button click (only visible when a main category is selected)
         // Note: This now navigates to a detail page, not filter on main page
         const subCatBtn = e.target.closest('#subcategoriesContainer .subcategory-btn:not([data-id="all"])'); // Exclude the 'All' button if it exists
         if (subCatBtn) {
              const mainCatId = state.currentCategory; // Get current main category
              const subCatId = subCatBtn.dataset.id; // Get subcategory ID from button
              if (mainCatId && mainCatId !== 'all' && subCatId) {
                  showSubcategoryDetailPage(mainCatId, subCatId); // Navigate to detail page
              }
              return;
         }
          // 'All' subcategory button click (if present)
          const allSubCatBtn = e.target.closest('#subcategoriesContainer .subcategory-btn[data-id="all"]');
          if (allSubCatBtn) {
              await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
              return;
          }


         // Category button click inside the bottom sheet
         const sheetCatBtn = e.target.closest('#sheetCategoriesContainer .sheet-category-btn');
         if (sheetCatBtn) {
             await navigateToFilter({
                 category: sheetCatBtn.dataset.category,
                 subcategory: 'all', // Reset subcategory
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search
             });
             closeCurrentPopup(); // Close the sheet after selection
             showPage('mainPage'); // Ensure main page is shown
             return;
         }

         // Product card click (excluding buttons within the card)
         const productCard = e.target.closest('.product-card:not(.promo-card-grid-item)'); // Exclude promo sliders
         if (productCard && !e.target.closest('button, a')) { // Check if click was not on button/link
             const productId = productCard.dataset.productId;
             if (productId) {
                 showProductDetailsById(productId); // Show details sheet
             }
             return;
         }

         // Product card Add to Cart button
         const addToCartBtnCard = e.target.closest('.add-to-cart-btn-card');
         if (addToCartBtnCard) {
              const card = addToCartBtnCard.closest('.product-card');
              const productId = card?.dataset.productId;
              if (productId && !addToCartBtnCard.disabled) {
                  addToCart(productId); // Add to cart logic from cart.js
                  // -- Visual feedback --
                  const originalContent = addToCartBtnCard.innerHTML;
                  addToCartBtnCard.disabled = true;
                  addToCartBtnCard.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
                  setTimeout(() => {
                      addToCartBtnCard.innerHTML = `<i class="fas fa-check"></i>`; // Success state
                      setTimeout(() => {
                          // Restore original button state after a delay
                          addToCartBtnCard.innerHTML = originalContent;
                          addToCartBtnCard.disabled = false;
                      }, 1500);
                  }, 500);
                  // -- End visual feedback --
              }
              return;
         }

         // Product card Favorite button
         const favBtnCard = e.target.closest('.favorite-btn');
         if (favBtnCard) {
             const card = favBtnCard.closest('.product-card');
             const productId = card?.dataset.productId;
             if (productId) {
                 toggleFavorite(productId); // Toggle favorite status
             }
             return;
         }

          // Product card Share button
          const shareBtnCard = e.target.closest('.share-btn-card');
          if (shareBtnCard) {
              const card = shareBtnCard.closest('.product-card');
              const productId = card?.dataset.productId;
              if (productId) {
                  shareProduct(productId); // Handle sharing
              }
              return;
          }

     });


    // --- Foreground FCM Message Handling ---
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success'); // Display notification using UI function
        // Optionally update the badge immediately
        if (notificationBadge) notificationBadge.style.display = 'block';
    });
}

// --- Helper Functions Specific to app-logic ---

/**
 * Updates UI elements that depend on the categories being loaded.
 * نوێکردنەوەی توخمەکانی UI کە پشت بە بارکردنی جۆرەکان دەبەستن.
 */
function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    renderMainCategories(); // Render top category buttons
    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns(); // Update dropdowns in admin forms
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update dropdowns in shortcut card form
    }
}

/**
 * Requests permission for notifications and saves the FCM token if granted.
 * داواکردنی مۆڵەت بۆ ئاگادارییەکان و پاشەکەوتکردنی تۆکنی FCM ئەگەر مۆڵەت درا.
 */
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            showNotification(t('notification_permission_granted', {default:'مۆڵەتی ئاگاداری درا'}), 'success');
            // Get FCM token
            const currentToken = await getToken(messaging, {
                 // Ensure your VAPID key is correctly configured in your Firebase project settings
                 // And ideally, load it from a config file or environment variable
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ' // Consider securing this key
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken); // Save token to backend
            } else {
                console.log('No registration token available. Request permission to generate one.');
                showNotification(t('notification_no_token', {default: 'تۆکن وەرنەگیرا. تکایە دووبارە هەوڵبدەوە.'}), 'error');
            }
        } else {
            console.log('Unable to get permission to notify.');
            showNotification(t('notification_permission_denied', {default: 'مۆڵەتی ئاگاداری ڕەتکرایەوە'}), 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting notification permission: ', error);
         showNotification(t('notification_permission_error', {default: 'هەڵە لە داواکردنی مۆڵەتی ئاگاداری'}), 'error');
    }
}

/**
 * Saves the FCM device token to Firestore.
 * پاشەکەوتکردنی تۆکنی ئامێری FCM لە Firestore.
 * @param {string} token The FCM token to save. / تۆکنی FCM بۆ پاشەکەوتکردن.
 */
async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        // Use the token itself as the document ID for easy lookup/uniqueness
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now(), // Store timestamp when token was added/updated
            // You could add userId here if users log in: userId: auth.currentUser?.uid
        });
        console.log('FCM Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving FCM token to Firestore: ', error);
        // Optionally notify the user or retry
    }
}

/**
 * Toggles a product's favorite status and updates UI accordingly.
 * گۆڕینی دۆخی دڵخوازی کاڵایەک و نوێکردنەوەی UI بە شێوەیەکی گونجاو.
 * @param {string} productId The ID of the product to toggle. / ID ی کاڵاکە.
 */
function toggleFavorite(productId) {
    // event?.stopPropagation(); // Prevent card click when clicking button

    const isCurrentlyFavorite = isFavorite(productId); // Check current status

    if (isCurrentlyFavorite) {
        // Remove from favorites array
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        // Add to favorites array
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Save updated favorites list to local storage

    // Update the heart icon on all cards representing this product
    const allProductCards = document.querySelectorAll(`.product-card[data-product-id="${productId}"]`);
    allProductCards.forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart'); // Assuming icon has fa-heart class
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite); // Add/remove 'favorited' class
            heartIcon.classList.toggle('fas', isNowFavorite); // Toggle solid icon (fas)
            heartIcon.classList.toggle('far', !isNowFavorite); // Toggle regular icon (far)
            // Update aria-label for accessibility
            favButton.setAttribute('aria-label', isNowFavorite ? t('remove_from_favorites') : t('add_to_favorites'));
        }
    });

    // If the favorites sheet is currently open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}

/**
 * Shares a product using the Web Share API or copies the link as a fallback.
 * هاوبەشیکردنی کاڵایەک بە بەکارهێنانی Web Share API یان کۆپیکردنی لینک وەک چارەسەری یەدەگ.
 * @param {string} productId The ID of the product to share. / ID ی کاڵاکە.
 */
async function shareProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    const nameInCurrentLang = (product?.name && product.name[state.currentLanguage]) || (product?.name && product.name.ku_sorani) || t('this_product');
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`; // Construct product URL

    const shareData = {
        title: nameInCurrentLang,
        text: `${t('share_text')}: ${nameInCurrentLang}`, // e.g., "Check out this product: [Product Name]"
        url: productUrl,
    };

    try {
        if (navigator.share) {
            // Use Web Share API if available
            await navigator.share(shareData);
            console.log('Product shared successfully');
        } else {
            // Fallback: Copy URL to clipboard
             // Use the old execCommand method for broader compatibility in potential iframe scenarios
             const textArea = document.createElement('textarea');
             textArea.value = productUrl;
             textArea.style.position = 'fixed'; // Prevent scrolling issues
             textArea.style.left = '-9999px';
             document.body.appendChild(textArea);
             textArea.select();
             try {
                 document.execCommand('copy');
                 showNotification(t('link_copied', { default: 'لینک کۆپی کرا!' }), 'success');
             } catch (err) {
                 console.error('Fallback copy error:', err);
                 showNotification(t('copy_failed', { default: 'کۆپیکردن سەرکەوتوو نەبوو!' }), 'error');
             }
             document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('Share error:', err);
         // Don't show error if user cancelled the share action
         if (err.name !== 'AbortError') {
             showNotification(t('share_error'), 'error');
         }
    }
}


/**
 * Fetches product details by ID and shows the details sheet.
 * وەرگرتنی وردەکارییەکانی کاڵا بە ID و پیشاندانی شیتی وردەکارییەکان.
 * @param {string} productId The ID of the product. / ID ی کاڵاکە.
 */
async function showProductDetailsById(productId) {
    try {
         const productRef = doc(db, "products", productId);
         const productSnap = await getDoc(productRef);

         if (productSnap.exists()) {
             const product = { id: productSnap.id, ...productSnap.data() };
             showProductDetailsSheet(product); // Call the function to render the sheet UI
         } else {
             showNotification(t('product_not_found_error'), 'error');
         }
    } catch (error) {
         console.error("Error fetching product details by ID:", error);
         showNotification(t('error_generic'), 'error');
    }
}

/**
 * Renders the product details bottom sheet with the provided product data.
 * پیشاندانی شیتی بنی وردەکارییەکانی کاڵا بە داتای کاڵای دابینکراو.
 * @param {object} product The product data object. / ئۆبجێکتی داتای کاڵاکە.
 */
async function showProductDetailsSheet(product) {
     const sheetElement = document.getElementById('productDetailSheet');
     if (!sheetElement) return;

    // Scroll sheet content to top when opening
    const sheetContent = sheetElement.querySelector('.sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // Get localized name and description
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_unnamed', {id: product.id});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    // Get image URLs, fallback from array to single image, then empty array
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // --- Image Slider Setup ---
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');
    imageContainer.innerHTML = ''; // Clear previous images
    thumbnailContainer.innerHTML = ''; // Clear previous thumbnails

    let currentIndex = 0; // State for the slider

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Create main image element
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active'); // Show first image initially
            imageContainer.appendChild(img);

            // Create thumbnail image element
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1} of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); // Highlight first thumbnail
            thumb.dataset.index = index; // Store index for click handler
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Show placeholder if no images
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
    }

    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

    // Function to update which image/thumbnail is active
    function updateSlider(index) {
        if (index < 0 || index >= images.length) return; // Boundary check
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        if (images[index]) images[index].classList.add('active');
        if (thumbnails[index]) thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // Show/hide slider buttons based on image count
    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        // Remove previous listeners before adding new ones
        prevBtn.replaceWith(prevBtn.cloneNode(true)); // Simple way to remove listeners
        nextBtn.replaceWith(nextBtn.cloneNode(true));
        document.getElementById('sheetPrevBtn').onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        document.getElementById('sheetNextBtn').onclick = () => updateSlider((currentIndex + 1) % images.length);
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }
    // Add click listeners to thumbnails
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
    // --- End Image Slider Setup ---

    // Set product name, description, and price
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Format description

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        // Display discounted price and original price
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        // Display regular price
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Setup "Add to Cart" button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    // Clone and replace to remove previous listeners
    const newAddToCartButton = addToCartButton.cloneNode(true);
    addToCartButton.parentNode.replaceChild(newAddToCartButton, addToCartButton);
    newAddToCartButton.onclick = () => {
        addToCart(product.id); // Add product to cart
        closeCurrentPopup(); // Close the sheet after adding
    };

    // Render related products section
    await renderRelatedProducts(product); // Fetch and display related items

    openPopup('productDetailSheet'); // Finally, open the sheet
}


/**
 * Fetches and renders related products based on the current product's category/subcategory.
 * وەرگرتن و پیشاندانی کاڵا پەیوەندیدارەکان بە پشت بەستن بە جۆر/جۆری لاوەکی کاڵای ئێستا.
 * @param {object} currentProduct The product object for which to find related items. / ئۆبجێکتی کاڵای ئێستا.
 */
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the best category field to query by (most specific available)
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
        return; // Cannot find related products without any category info
    }

    // Construct the Firestore query
    const q = query(
        productsCollection,
        where(queryField, '==', queryValue), // Filter by the chosen category field
        where('__name__', '!=', currentProduct.id), // Exclude the current product itself
        // orderBy('createdAt', 'desc'), // Optionally order results (might require index)
        limit(8) // Limit the number of related products shown
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Exit if no related products found
        }

        // Render each related product card
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use the UI function
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section now that it has content

    } catch (error) {
        console.error("Error fetching related products:", error);
        // Optionally hide section or show an error message within it
    }
}

/**
 * Handles showing the detail page for a subcategory. Fetches necessary data and renders content.
 * مامەڵە لەگەڵ پیشاندانی پەڕەی وردەکاری بۆ جۆرێکی لاوەکی دەکات. داتای پێویست وەردەگرێت و ناوەڕۆک پیشان دەدات.
 * @param {string} mainCatId The ID of the parent main category. / ID ی جۆری سەرەکی باوان.
 * @param {string} subCatId The ID of the subcategory to display. / ID ی جۆری لاوەکی بۆ پیشاندان.
 * @param {boolean} [fromHistory=false] Indicates if called due to history navigation. / ئاماژە بەوە دەکات کە ئایا بەهۆی گەشتیاری مێژووەوە بانگ کراوە.
 */
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        // Fetch the subcategory name for the header title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || subCatName;
        }
    } catch (e) {
        console.error("Could not fetch subcategory name for detail page:", e);
    }

    // Update history only if not triggered by popstate (back/forward)
    if (!fromHistory) {
         // Save current scroll of main page before navigating away
         saveCurrentScrollPosition();
         // Push new history state for the detail page
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    // Show the detail page UI
    showPage('subcategoryDetailPage', subCatName);

    // Get references to elements within the detail page
    const detailLoader = document.getElementById('detailPageLoader');
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailSubSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    const detailSearchInput = document.getElementById('subpageSearchInput');
    const detailClearSearchBtn = document.getElementById('subpageClearSearchBtn');


    if (!detailLoader || !detailProductsContainer || !detailSubSubContainer || !detailSearchInput || !detailClearSearchBtn) {
         console.error("Required elements for subcategory detail page not found!");
         return;
     }

    // Show loading state and clear previous content
    detailLoader.style.display = 'block';
    detailProductsContainer.innerHTML = '';
    detailSubSubContainer.innerHTML = '';
    detailSearchInput.value = ''; // Clear search input
    detailClearSearchBtn.style.display = 'none'; // Hide clear button

    try {
        // Render sub-subcategories first (if any)
        await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
        // Then render products for the selected subcategory (initially 'all' sub-subcategories)
        await renderProductsOnDetailPage(subCatId, 'all', ''); // 'all' sub-sub, no search term initially
    } catch (error) {
         console.error("Error rendering subcategory detail content:", error);
         detailProductsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    } finally {
        detailLoader.style.display = 'none'; // Hide loader
    }
}

/**
 * Renders sub-subcategory buttons on the subcategory detail page.
 * پیشاندانی دوگمەکانی جۆرە لاوەکییەکانی لاوەکی لە پەڕەی وردەکاریی جۆری لاوەکی.
 * @param {string} mainCatId Parent main category ID. / ID ی جۆری سەرەکی باوان.
 * @param {string} subCatId Parent subcategory ID. / ID ی جۆری لاوەکی باوان.
 */
async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous
    container.style.display = 'none'; // Hide initially

    try {
        // Query sub-subcategories, ordered by 'order'
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // If no sub-subcategories, keep container hidden and exit
        if (snapshot.empty) {
            return;
        }

        container.style.display = 'flex'; // Show container

        // --- Create 'All' button ---
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active initially
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Special ID for 'All'
        allBtn.onclick = () => {
            // Update active state and re-render products for 'all' sub-subs
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        // --- Create buttons for each sub-subcategory ---
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`; // Not active initially
            btn.dataset.id = subSubcat.id; // Store ID

            // Get name and image URL with fallbacks
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;

            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                // Update active state and re-render products filtered by this sub-sub
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
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

/**
 * Renders products on the subcategory detail page, filtered by sub-subcategory and search term.
 * پیشاندانی کاڵاکان لە پەڕەی وردەکاریی جۆری لاوەکی، فلتەرکراو بە جۆری لاوەکی لاوەکی و دەستەواژەی گەڕان.
 * @param {string} subCatId The parent subcategory ID. / ID ی جۆری لاوەکی باوان.
 * @param {string} [subSubCatId='all'] The selected sub-subcategory ID ('all' for no filter). / ID ی جۆری لاوەکی لاوەکی هەڵبژێردراو ('all' بۆ بێ فلتەر).
 * @param {string} [searchTerm=''] The search term entered by the user. / دەستەواژەی گەڕانی بەکارهێنەر.
 */
async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    if (!productsContainer || !loader) return;

    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQueryRef = productsCollection; // Start with base collection

        // --- Apply Category Filters ---
        // Always filter by the parent subcategory ID first
        productsQueryRef = query(productsQueryRef, where("subcategoryId", "==", subCatId));
        // If a specific sub-subcategory is selected (not 'all'), filter by it too
        if (subSubCatId !== 'all') {
            productsQueryRef = query(productsQueryRef, where("subSubcategoryId", "==", subSubCatId));
        }

        // --- Apply Search Filter ---
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQueryRef = query(productsQueryRef,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // --- Apply Ordering ---
        if (finalSearchTerm) {
            // If searching, order by name first (required for Firestore range queries)
            productsQueryRef = query(productsQueryRef, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default order by creation date (newest first)
            productsQueryRef = query(productsQueryRef, orderBy("createdAt", "desc"));
        }

        // --- Execute Query ---
        // Note: No pagination implemented here, loads all matching products for the detail page
        const productSnapshot = await getDocs(productsQueryRef);

        // --- Render Results ---
        if (productSnapshot.empty) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found')}</p>`;
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Use UI function
                card.classList.add('product-card-reveal'); // Add animation class
                productsContainer.appendChild(card);
            });
            setupScrollAnimations(); // Apply animations
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}

/**
 * Sets up the IntersectionObserver for infinite scrolling.
 * دامەزراندنی IntersectionObserver بۆ سکڕۆڵی بێ کۆتا.
 */
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    // Use a single observer instance
    const observer = new IntersectionObserver((entries) => {
        // Check if the trigger element is intersecting (visible)
        if (entries[0].isIntersecting) {
            // Only load more if not currently loading and not all products are loaded
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // Check if we are on the main page (where infinite scroll applies)
                 if (document.getElementById('mainPage')?.classList.contains('page-active')) {
                     searchProductsInFirestore(state.currentSearch, false); // Fetch next page (false means append)
                 }
            }
        }
    }, {
        root: null, // Observe intersections relative to the viewport
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger); // Start observing the trigger element
}

/**
 * Sets up the GPS button functionality in the profile sheet.
 * کارایی دوگمەی GPS لە شیتی پڕۆفایلدا دادەمەزرێنێت.
 */
function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return; // Exit if elements not found

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location'; // Store original text

    getLocationBtn.addEventListener('click', () => {
        // Check if geolocation is supported by the browser
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported', {default:'وێبگەڕەکەت پشتگیری GPS ناکات'}), 'error');
            return;
        }

        // Disable button and show loading text
        if (btnSpan) btnSpan.textContent = t('gps_loading', {default:'...چاوەڕوان بە'});
        getLocationBtn.disabled = true;

        // Request current position
        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success callback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Use Nominatim (OpenStreetMap) for reverse geocoding (lat/lon to address)
                    // Request language preference order: Kurdish, then English as fallback
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) {
                        throw new Error(`Nominatim request failed with status ${response.status}`);
                    }
                    const data = await response.json();

                    // If address found, populate the input field
                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification(t('address_retrieved', {default:'ناونیشان وەرگیرا'}), 'success');
                    } else {
                        // Handle case where geocoding returns no address
                        console.warn("Nominatim reverse geocoding returned no address for:", latitude, longitude, data);
                        showNotification(t('address_not_found', {default:'نەتوانرا ناونیشان بدۆزرێتەوە'}), 'error');
                        // Optionally fill with coordinates as fallback:
                        // profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
                    }
                } catch (error) {
                    // Handle fetch or JSON parsing errors
                    console.error('Reverse Geocoding Error:', error);
                    showNotification(t('address_error', {default:'هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا'}), 'error');
                } finally {
                    // Re-enable button and restore original text
                    if (btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error callback
                let message = '';
                // Provide user-friendly error messages based on error code
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = t('gps_permission_denied', {default:'ڕێگەت نەدا GPS بەکاربهێنرێت'});
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = t('gps_position_unavailable', {default:'شوێنەکەت نەدۆزرایەوە'});
                        break;
                    case error.TIMEOUT:
                        message = t('gps_timeout', {default:'کاتی داواکارییەکە تەواو بوو'});
                        break;
                    default:
                        message = t('gps_unknown_error', {default:'هەڵەیەکی نادیار ڕوویدا'});
                        break;
                }
                showNotification(message, 'error'); // Show error notification
                // Re-enable button and restore text
                if (btnSpan) btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { // Geolocation options (optional)
                enableHighAccuracy: true, // Request more accurate position
                timeout: 10000, // Maximum time (ms) to wait for position
                maximumAge: 0 // Force fresh position retrieval
            }
        );
    });
}


// --- Popstate Listener (History Navigation) ---
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Close any open popups when navigating history
    const popState = event.state; // Get the state associated with the history entry

    if (popState) {
        if (popState.type === 'page') {
             // Handle navigation between pages (main, settings, subcategory detail)
            let pageTitle = popState.title;
             // Special handling to refetch title for subcategory detail page if missing
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
                 } catch(e) { console.error("Could not refetch subcategory title on popstate", e); }
             }
            showPage(popState.id, pageTitle); // Show the target page
        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Re-open the specific popup (sheet or modal)
            openPopup(popState.id, popState.type);
        } else {
            // Assume it's a filter state for the main page
             showPage('mainPage'); // Ensure main page is visible
             await applyFilterState(popState, true); // Apply filters and restore scroll (true indicates from popstate)
        }
    } else {
        // If state is null (e.g., initial load or navigating outside app history scope)
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         showPage('mainPage'); // Show main page
         await applyFilterState(defaultState); // Apply default filters
    }
});


// --- Start Application ---
document.addEventListener('DOMContentLoaded', init); // Initialize when DOM is ready


// --- Export for Admin ---
// Re-export functions needed by the non-module admin.js onto the global scope
Object.assign(window.globalAdminTools, {
    // Firebase services/functions needed by admin
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    // UI/Util functions needed by admin
    showNotification, t, openPopup, closeCurrentPopup,
    // Data/State functions needed by admin
    searchProductsInFirestore, // Might be needed if admin actions should refresh product list
    setEditingProductId, getEditingProductId, // For product editing form
    getCategories: () => state.categories, // Provide current categories to admin
    getCurrentLanguage: () => state.currentLanguage, // Provide current language to admin
    clearProductCache: () => { // Function to clear cache after admin changes
        console.log("Product cache and home page cleared due to admin action.");
        // state.productCache = {}; // Clear cache if using caching
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = ''; // Clear home page to force re-render
        }
         // Trigger a re-render/refetch of the current view
         if (document.getElementById('mainPage')?.classList.contains('page-active')) {
            searchProductsInFirestore(state.currentSearch, true); // Refresh main page view
         } else if (document.getElementById('subcategoryDetailPage')?.classList.contains('page-active')) {
             // Refresh detail page view (extract IDs from hash)
             const hash = window.location.hash.substring(1);
             if (hash.startsWith('subcategory_')) {
                 const ids = hash.split('_');
                 const mainCatId = ids[1];
                 const subCatId = ids[2];
                 showSubcategoryDetailPage(mainCatId, subCatId, true); // Refresh detail page
             }
         }
         // Also re-render admin lists that might be affected
         if(window.AdminLogic) {
            window.AdminLogic.renderCategoryManagementUI?.(); // Using optional chaining
            window.AdminLogic.renderHomeLayoutAdmin?.();
            window.AdminLogic.renderPromoGroupsAdminList?.();
            window.AdminLogic.renderBrandGroupsAdminList?.();
            window.AdminLogic.renderShortcutRowsAdminList?.();
         }

    },
    // Collections needed by admin
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, // Pass new collections
    // Add other exports if admin.js needs them
});
