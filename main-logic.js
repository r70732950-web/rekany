// BEŞA YEKEM: main-logic.js
// Ev pel beşê serekî yê mentiqê bernameyê, birêvebirina hilberan, lêgerîn, û rûpela serekî digire nav xwe.

// Firebase and Setup Imports
import {
    db, auth, messaging,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Ensure all collections are here
    translations, state, // state object needs sliderIntervals: {} added in app-setup.js
    PRODUCTS_PER_PAGE,
    productsContainer, skeletonLoader, searchInput, clearSearchBtn, loader,
    settingsPage, mainPage, homeBtn, settingsBtn,
    subSubcategoriesContainer,
    // Add other necessary DOM elements if required by functions moved here
    app, // Import app if needed (e.g., for analytics, though not used here directly)
} from './app-setup.js';

import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { enableIndexedDbPersistence, collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, limit, getDoc, setDoc, where, startAfter, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

// --- Core Utility Functions (Exported for ui-helpers) ---

/**
 * Wergera kilîtekê li gorî zimanê heyî.
 * @param {string} key - Kilîta wergerandinê.
 * @param {object} replacements - Cihgirên ji bo placeholderan.
 * @returns {string} - Nivîsa wergerandî.
 */
export function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * Nîşandana agahdariyek kurt li ser ekranê.
 * @param {string} message - Peyama ku tê nîşandan.
 * @param {string} type - Cureyê agahdariyê ('success' an 'error').
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
             // Ji bo pêşîgirtina li xeletiyê heke notification jixwe hatibe rakirin
            if (document.body.contains(notification)) {
                 document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Fonksiyonek debounce çêdike ku bangên fonksiyonê sînordar dike.
 * @param {Function} func - Fonksiyona ku were debounce kirin.
 * @param {number} delay - Derengiya di milîçirkeyan de.
 * @returns {Function} - Fonksiyona debouncekirî.
 */
export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Elementa karta hilberê çêdike. Exported ji bo ui-helpers (favorite sheet).
 * @param {object} product - Daneyên hilberê.
 * @returns {HTMLElement} - Elementa karta hilberê.
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'});
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

    // Check favorite status using a function potentially defined in ui-helpers (needs import)
    // Assuming isFavorite function will be available via import or global scope later
    const isProdFavorite = window.UIHelpers?.isFavorite(product.id) ?? state.favorites.includes(product.id);
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

    // Event listeners that call functions potentially defined in ui-helpers
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

        if (addToCartButton) {
            // Assume addToCart is in ui-helpers
            if (window.UIHelpers?.addToCart) {
                window.UIHelpers.addToCart(product.id);
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
            } else {
                console.error("addToCart function not found. Ensure ui-helpers.js is loaded and functions are exposed.");
            }
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic?.editProduct(product.id); // Admin logic might still be global
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic?.deleteProduct(product.id); // Admin logic might still be global
        } else if (target.closest('.favorite-btn')) {
            // Assume toggleFavorite is in ui-helpers
             if (window.UIHelpers?.toggleFavorite) {
                 window.UIHelpers.toggleFavorite(product.id, event);
             } else {
                 console.error("toggleFavorite function not found.");
             }
        } else if (target.closest('.share-btn-card')) {
            // Assume handleShare is in ui-helpers
             if (window.UIHelpers?.handleShare) {
                 window.UIHelpers.handleShare(product, nameInCurrentLang);
             } else {
                 console.error("handleShare function not found.");
             }
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
            showProductDetailsWithData(product); // This function remains here as it controls a core sheet
        }
    });
    return productCard;
}

// --- Navigation and Page Management ---

/** Tomarkirina pozîsyona scroll a heyî di dîrokê de. */
function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Tenê pozîsyona scroll ji bo rewşa parzûna rûpela serekî tomar bike
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

/** Nûvekirina dîmena headerê li gorî rûpela çalak. */
function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');
    const mainSearch = document.querySelector('.main-header-content .search-container');
    const subSearch = document.querySelector('.subpage-header-content .subpage-search');


    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
        mainSearch.style.visibility = 'visible'; // Ensure main search is visible
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
        mainSearch.style.visibility = 'hidden'; // Hide main search when not on main page
        // Control subpage search visibility
        subSearch.style.display = (pageId === 'subcategoryDetailPage') ? 'flex' : 'none';
    }
}

/** Rûpelek taybetî nîşan dide û navîgasyona jêrîn nûve dike. */
export function showPage(pageId, pageTitle = '') {
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

/** Navîgasyona jêrîn nûve dike da ku bişkojka çalak nîşan bide. */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/** Rewşa parzûnê ya heyî bicîh tîne û UI nûve dike. */
async function applyFilterState(filterState, fromPopState = false) {
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    renderMainCategories(); // Renders main categories based on state.categories
    await renderSubcategories(state.currentCategory); // Renders subcategories based on current main category

    // This will trigger rendering home page content or products based on the filter state
    await searchProductsInFirestore(state.currentSearch, true);

    if (fromPopState && typeof filterState.scroll === 'number') {
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50); // Restore scroll after rendering
    } else if (!fromPopState) {
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for new filter actions
    }
}

/** Bi parzûnek nû rêve dibe û dîroka gerokê nûve dike. */
async function navigateToFilter(newState) {
    // Save current scroll position before navigating
    history.replaceState({
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch,
        scroll: window.scrollY // Save current scroll position
    }, '');

    // Create the new state, merging with current and resetting scroll
    const finalState = {
         category: state.currentCategory,
         subcategory: state.currentSubcategory,
         subSubcategory: state.currentSubSubcategory,
         search: state.currentSearch,
        ...newState, // Apply changes from newState
        scroll: 0 // Reset scroll for the new state
     };


    // Create URL parameters based on the final state
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);

    const newUrl = `${window.location.pathname}?${params.toString()}`; // New URL without hash

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI
    await applyFilterState(finalState);
}


// --- Product Fetching and Rendering ---

/** Elementên skeleton loader nîşan dide. */
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
    // Ger konteynera default be, konteynera hilberê veşêre
    if (container === skeletonLoader) {
        productsContainer.style.display = 'none';
        loader.style.display = 'none'; // Veşartina loader-a scroll
    }
}

/** Hilberên heyî di konteynerê de nîşan dide. */
function renderProducts() {
    productsContainer.innerHTML = ''; // Paqijkirina konteynerê berî nîşandanê
    if (!state.products || state.products.length === 0) {
        // No need to show a message here, searchProductsInFirestore handles it
        return;
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Sazkirina anîmasyonan piştî nîşandanê
}

/** Anîmasyonên scroll ji bo kartên hilberê saz dike. */
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing after animation
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the card is visible
    });

    // Observe newly added cards
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Li hilberan li Firestore digere û nîşan dide, an jî naveroka rûpela serekî nîşan dide.
 * @param {string} searchTerm - Peyva lêgerînê.
 * @param {boolean} isNewSearch - Gelo ev lêgerînek nû ye an barkirina bêtir e.
 */
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Diyar bike ka divê naveroka rûpela serekî were nîşandan an na
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Naveroka Rûpela Serekî Nîşan Bide
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none'; // Veşartina trigger-a scroll
        homeSectionsContainer.style.display = 'block';

        // Tenê heke konteyner vala be, naverokê ji nû ve bar bike
        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        } else {
             // Ensure sliders restart if they were stopped
             Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
                 if (state.sliderIntervals[layoutId] === null) { // Check if interval was cleared (null)
                    // Find the slider element and restart its interval (logic might need adjustment based on how intervals are stored/cleared)
                    const sliderElement = document.getElementById(`promoSliderLayout_${layoutId}`);
                    if (sliderElement && sliderElement.dataset.groupId) {
                        // Re-triggering the rendering might be complex, consider a simpler restart function if needed
                        console.log(`Restarting interval for slider ${layoutId}`);
                        // Example: Re-attach interval logic (this is simplified)
                        // This part needs careful implementation based on how intervals are managed in renderPromoCardsSectionForHome
                        // For now, just logging. A full re-render might be safer.
                         // renderPromoCardsSectionForHome(sliderElement.dataset.groupId, layoutId); // Re-render might duplicate
                    }
                 }
             });
        }
        return; // Stop execution here for home page view
    } else {
        // Hilberên Parzûnkirî / Lêgerînkirî Nîşan Bide
        homeSectionsContainer.style.display = 'none'; // Veşartina naveroka rûpela serekî

        // Stop all promo rotations when navigating away from the full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
                 state.sliderIntervals[layoutId] = null; // Mark as cleared
            }
        });
       // state.sliderIntervals = {}; // Resetting might prevent restart logic above, consider marking instead
    }

    // Cache logic (optional, can be simplified or removed if causing issues)
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
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

    // Pêşîgirtina li barkirina ducarî
    if (state.isLoadingMoreProducts && !isNewSearch) return;

    // Ji bo lêgerînek nû vesaz bike an loader-a scroll nîşan bide
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(productsContainer, 8); // Nîşandana skeleton di konteynera hilberê de
        productsContainer.style.display = 'grid'; // Piştrastkirina ku grid tê xuyang kirin
        skeletonLoader.style.display = 'none'; // Veşartina skeleton-a sereke
    } else {
         loader.style.display = 'block'; // Nîşandana loader-a scroll ji bo rûpelên din
    }

     // Rewşa barkirinê kontrol bike
    if (state.allProductsLoaded && !isNewSearch) {
         loader.style.display = 'none';
         return; // Ger hemî hatine barkirin û ne lêgerînek nû be, venegere
    }


    state.isLoadingMoreProducts = true;


    try {
        let productsQuery = collection(db, "products");

        // Fîlterên Kategoriyê bicîh bîne
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Fîltera Lêgerînê bicîh bîne
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        // Rêzkirinê bicîh bîne
        if (finalSearchTerm) {
             // Ger lêgerîn hebe, divê orderBy ya yekem li gorî qada newekheviyê be
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
             // Ger lêgerîn tune be, rêzkirina standard bikar bîne
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Paging bicîh bîne
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // Daneyan bistîne
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Lîsteya hilberan nûve bike
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Rewşa barkirina hemî hilberan û belgeya paşîn nûve bike
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none'; // Veşartina trigger dema ku hemî hatin barkirin
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Nîşandana trigger ji bo barkirina bêtir
            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        }


        // Cache nûve bike (optional)
        if (isNewSearch && state.productCache) {
             state.productCache[cacheKey] = {
                 products: [...state.products], // Kopiyek çêbike
                 lastVisible: state.lastVisibleProductDoc,
                 allLoaded: state.allProductsLoaded
             };
         }


        // Hilberan nîşan bide
        if (isNewSearch) {
            renderProducts(); // Ji bo lêgerînek nû ji nû ve nîşan bide
        } else {
            // Tenê hilberên nû lê zêde bike (ji bo performansa çêtir)
             newProducts.forEach(item => {
                 let element = createProductCardElement(item);
                 element.classList.add('product-card-reveal'); // Add class for animation
                 productsContainer.appendChild(element);
             });
             setupScrollAnimations(); // Ji bo kartên nû anîmasyonan saz bike
        }


        // Ger ti hilber nehat dîtin peyamek nîşan bide
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }

    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Veşartina loader-a scroll
        if (isNewSearch) {
             skeletonLoader.style.display = 'none'; // Veşartina skeleton-a sereke
        }
        productsContainer.style.display = 'grid'; // Piştrastkirina ku grid xuya ye
    }
}


// --- Category Rendering ---

/** Binkategoriyan ji bo kategoriya hilbijartî nîşan dide. */
async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Paqijkirina konteynerê
    subSubcategoriesContainer.innerHTML = ''; // Paqijkirina konteynera sub-sub
    subSubcategoriesContainer.style.display = 'none'; // Veşartina konteynera sub-sub


    // Ger 'Hemî' hatibe hilbijartin, konteynerê vala bihêle û venegere
    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Veşartina konteynera subcategory
        return;
    }

     subcategoriesContainer.style.display = 'flex'; // Nîşandana konteynera subcategory


    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Ger ti binkategorî tune bin, konteynerê vala bihêle
        if (state.subcategories.length === 0) {
              subcategoriesContainer.style.display = 'none'; // Veşartina konteynerê heke vala be
              return;
         }

        // Bişkoka 'Hemî' ji bo binkategoriyan zêde bike
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
         const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;

        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = async () => {
             // Dema ku 'Hemî' tê klîkkirin, tenê parzûna binkategoriyê nûve bike
            await navigateToFilter({
                 subcategory: 'all',
                 subSubcategory: 'all' // Di heman demê de sub-sub jî vesaz bike
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Bişkokên ji bo her binkategoriyekê zêde bike
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
                 // Dema ku binkategoriyek tê klîkkirin, biçe rûpela hûrguliyan
                 // Assume showSubcategoryDetailPage is defined elsewhere (potentially ui-helpers or remains here if complex)
                 if (window.UIHelpers?.showSubcategoryDetailPage) {
                    window.UIHelpers.showSubcategoryDetailPage(categoryId, subcat.id);
                 } else if (showSubcategoryDetailPage) { // Check if defined locally
                     showSubcategoryDetailPage(categoryId, subcat.id);
                 } else {
                     console.error("showSubcategoryDetailPage function not found.");
                 }

            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
         subcategoriesContainer.style.display = 'none'; // Veşartina konteynerê di rewşa xeletiyê de
    }
}

/** Kategoriyên serekî di headerê de nîşan dide. */
function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Paqijkirina konteynerê

    // Piştrast bike ku state.categories heye û ne vala ye
    if (!state.categories || state.categories.length === 0) {
        console.warn("Categories not loaded yet for renderMainCategories.");
        return;
    }


    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        // Çalakkirina bişkojka li gorî state.currentCategory
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Navê kategoriyê werbigire

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Bikaranîna îkonek default

        // Event listener ji bo klîkkirinê
        btn.onclick = async () => {
            // Dema ku kategoriyek tê klîkkirin, parzûnê nûve bike
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Binkategorî û sub-subkategorî vesaz bike
                subSubcategory: 'all',
                search: '' // Lêgerînê jî vesaz bike
            });
        };

        container.appendChild(btn); // Zêdekirina bişkojê li konteynerê
    });
}

// --- Home Page Section Rendering ---

/** Beşek promo slider ji bo rûpela serekî nîşan dide. */
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Reuse existing grid styles for layout
    promoGrid.style.marginBottom = '24px'; // Add space below slider
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID based on layout item

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // Use an object to hold the current index for this specific slider instance
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Pass cards data

            // Create the initial card element
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass sliderState
            promoGrid.appendChild(promoCardElement);

            // Setup rotation only if there's more than one card
            if (cards.length > 1) {
                const rotate = () => {
                     // Check if the element still exists and if the interval is still registered
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId] || state.sliderIntervals[layoutId] !== sliderState.intervalId) {
                         if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear this specific interval
                         }
                         // Also remove from global state if it matches
                         if (state.sliderIntervals && state.sliderIntervals[layoutId] === sliderState.intervalId) {
                             delete state.sliderIntervals[layoutId];
                         }
                         return; // Stop rotation if element removed or interval overwritten
                     }

                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                 // Clear previous interval for this specific layoutId before setting a new one
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                     clearInterval(state.sliderIntervals[layoutId]);
                 }

                sliderState.intervalId = setInterval(rotate, 5000); // Start rotation
                 // Store the new interval ID in the global state using layoutId as the key
                 if (!state.sliderIntervals) state.sliderIntervals = {};
                 state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid; // Return the created element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}

/** Beşek brand ji bo rûpela serekî nîşan dide. */
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Ger vala be nîşan nede

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
                if (brand.subcategoryId && brand.categoryId) {
                     // Assume showSubcategoryDetailPage is defined
                     if (window.UIHelpers?.showSubcategoryDetailPage) {
                         window.UIHelpers.showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                     } else if (showSubcategoryDetailPage) {
                         showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                     } else {
                         console.error("showSubcategoryDetailPage function not found.");
                     }
                } else if(brand.categoryId) {
                    await navigateToFilter({
                        category: brand.categoryId,
                        subcategory: 'all',
                        subSubcategory: 'all',
                        search: ''
                    });
                }
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer; // Elementa beşê vegerîne
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

/** Beşek ji bo hilberên herî nû nîşan dide. */
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
        // Hilberên 15 rojên dawî bistîne
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Tenê 10 hilberên herî nû nîşan bide
        );
        const snapshot = await getDocs(q);

        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Ger ti hilberên nû tune bin nîşan nede
        } else {
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
            });
        }
        container.appendChild(productsScroller);
        return container; // Elementa beşê vegerîne

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

/** Beşek rêzek kartên shortcut nîşan dide. */
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Ger rêz tune be nîşan nede

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Navê beşê ji daneyên layoutê bikar bîne heke hebe, wekî din navê rêzê
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;


        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        // Kartên ji bo vê rêzê bistîne
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            return null; // Ger ti kart tune bin rêzê nîşan nede
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

            // Event listener ji bo klîkkirina kartê
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

        return sectionContainer; // Elementa beşê vegerîne
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

/** Beşek ji bo rêzek hilberên ji kategoriyek taybetî nîşan dide. */
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Navê default ji layoutê
    let targetDocRef; // Referansa ji bo girtina navê rastîn

    // Qada query û nirxê li gorî ID-ya herî taybet diyar bike
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
        console.warn("Single category row needs at least categoryId.");
        return null; // Ger ti kategorî nehatibe diyarkirin nîşan nede
    }

    try {
        // Navê kategorî/binkategorî/sub-subkategorî ji bo sernavê bistîne
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Navê girtî bikar bîne heke hebe, wekî din navê ji daneyên layoutê
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
         }


        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Sernavê potansiyel nûvekirî bikar bîne
        header.appendChild(titleEl);

        // Girêdana "Hemî Bibîne"
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             // Li gorî ID-ya kategoriyê ya herî taybet rêve bibe
             if(subcategoryId) { // Ger binkategorî an sub-subkategorî hatibe hilbijartin
                 // Biçe rûpela hûrguliyên binkategoriyê
                 if (window.UIHelpers?.showSubcategoryDetailPage) {
                     window.UIHelpers.showSubcategoryDetailPage(categoryId, subcategoryId);
                 } else if (showSubcategoryDetailPage) {
                     showSubcategoryDetailPage(categoryId, subcategoryId);
                 } else {
                    console.error("showSubcategoryDetailPage function not found.");
                 }
             } else { // Ger tenê kategoriya serekî hatibe hilbijartin
                 // Li ser rûpela serekî parzûn bike
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

        // Konteynera ji bo scrollkirina horizontal a hilberan
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Query ji bo girtina hilberan
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Qada û nirxê diyarkirî bikar bîne
            orderBy('createdAt', 'desc'),
            limit(10) // Hejmarek sînordar ji bo rêza horizontal
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Ger ti hilber nehatin dîtin nîşan nede

        // Kartên hilberê lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container; // Elementa beşê vegerîne

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

/** Beşek ji bo nîşandana hemî hilberan (bi sînorkirî) li ser rûpela serekî. */
async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Zêdekirina valahiyê

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    // Konteynera grid ji bo hilberan
    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Stîla grid a heyî bikar bîne
    container.appendChild(productsGrid);

    try {
        // Di destpêkê de tenê çend hilberan ji bo beşa rûpela serekî bistîne
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null; // Ger ti hilber tune bin nîşan nede
        }

        // Kartên hilberê lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container; // Elementa beşê vegerîne
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

/** Naveroka dînamîk a rûpela serekî li gorî layouta diyarkirî nîşan dide. */
async function renderHomePageContent() {
    // Pêşîgirtina li nîşandana ducarî heke jixwe di pêvajoyê de be
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;


    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
         // Paqijkirina konteynerê û nîşandana skeleton loader
        renderSkeletonLoader(homeSectionsContainer, 4); // Skeleton di konteynera sereke de
        homeSectionsContainer.innerHTML = '';

         // === Destpêk: Koda Paqijkirina Interval ===
         // Paqijkirina intervalên heyî berî nîşandana yên nû
         Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
             if (state.sliderIntervals[layoutId]) {
                 clearInterval(state.sliderIntervals[layoutId]);
             }
         });
         state.sliderIntervals = {}; // Objekta intervalan vesaz bike
         // === Dawî: Koda Paqijkirina Interval ===

        // Girtina layouta rûpela serekî ji Firestore
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Layouta rûpela serekî nehatiye diyarkirin.</p>'; // Peyamek ji bikarhêner re
        } else {
            // Li ser her beşê di layoutê de bigere û nîşan bide
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null; // Elementa HTML ji bo beşê

                // Li gorî cureyê beşê elementê çêbike
                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            // layoutId (doc.id) bişîne fonksiyona nîşandanê
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id);
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
                              // Navê beşê (objekt) jî bişîne
                             sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                         } else { console.warn("Single shortcut row section is missing rowId."); }
                         break;
                    case 'single_category_row':
                         if (section.categoryId) {
                             // Hemî daneyên beşê bişîne
                             sectionElement = await renderSingleCategoryRow(section);
                         } else { console.warn("Single category row section is missing categoryId."); }
                         break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                // Ger element hatibe çêkirin, li konteynerê zêde bike
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false; // Nîşankirina ku nîşandan qediya
        // Skeleton loader jixwe bi homeSectionsContainer.innerHTML = '' tê rakirin
    }
}


// --- Detail Views and Popups ---

/** Detayên hilberê di bottom sheet de nîşan dide. */
async function showProductDetailsWithData(product) {
    // Assume this function uses elements defined in app-setup.js or passed as arguments
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0; // Scroll to top
    }

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('unnamed_product', {defaultValue: 'کاڵای بێ ناو'});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    // Wêneyan û thumbnailan bar bike
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    } else {
         // Placeholder heke wêne tune be
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

    // Fonksiyon ji bo nûvekirina sliderê
    function updateSlider(index) {
        if (!images[index]) return; // Ji bo pêşîgirtina li xeletiyê heke wêne tune be
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
         if (thumbnails[index]) thumbnails[index].classList.add('active'); // Kontrol bike heke thumbnail hebe
        currentIndex = index;
    }

    // Bişkokên sliderê û thumbnailan saz bike
    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }


    // Nav, danasîn, û bihayê nûve bike
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    // Assume formatDescription is defined in ui-helpers or passed/imported
     document.getElementById('sheetProductDescription').innerHTML = window.UIHelpers?.formatDescription(descriptionText) ?? descriptionText.replace(/\n/g, '<br>');


    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Bişkoka "Zêdekirin bo Sebetê" saz bike
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        // Assume addToCart is in ui-helpers
         if (window.UIHelpers?.addToCart) {
             window.UIHelpers.addToCart(product.id);
             window.UIHelpers?.closeCurrentPopup(); // Assume closeCurrentPopup is in ui-helpers
         } else {
            console.error("addToCart or closeCurrentPopup function not found.");
         }
    };

    // Hilberên pêwendîdar nîşan bide
    renderRelatedProducts(product);

    // Assume openPopup is in ui-helpers
    if (window.UIHelpers?.openPopup) {
       window.UIHelpers.openPopup('productDetailSheet');
    } else {
         console.error("openPopup function not found.");
    }

}

/** Hilberên pêwendîdar li gorî kategoriya hilbera heyî nîşan dide. */
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Paqijkirina konteynerê
    section.style.display = 'none'; // Veşartina beşê

    // Ger ti kategorî tune be, venegere
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return;
    }

    // Query li gorî kategoriya herî taybet ava bike
    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Hilbera heyî derxe
            limit(6) // Hejmarek sînordar
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else { // Tenê kategoriya serekî
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
            return; // Ger ti hilberên pêwendîdar tune bin, venegere
        }

        // Kartên hilberên pêwendîdar lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Karta hilberê çêbike
            container.appendChild(card);
        });

        section.style.display = 'block'; // Beşê nîşan bide

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}


// --- Initialization and Event Listeners ---

/** Fonksiyonên destpêkê û guhdarên bûyeran saz dike. */
function initializeAppLogic() {
    // Piştrast bike ku state.sliderIntervals heye
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }


    // Kategoriyan bistîne û UI-ya destpêkê li gorî wan saz bike
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    // Guhdariya guhertinên di kategoriyan de bike
    onSnapshot(categoriesQuery, async (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Kategoriya 'Hemî' lê zêde bike
        state.categories = [{ id: 'all', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label', {}, 'ku_badini'), name_ar: t('all_categories_label', {}, 'ar'), icon: 'fas fa-th' }, ...fetchedCategories];
         updateCategoryDependentUI(); // Dropdown û bişkokên kategoriyê nûve bike

         // Barkirina rûpela destpêkê li gorî URL-ê birêve bibe
         // Pêdivî ye ku ev piştî barkirina kategoriyan were meşandin da ku potansiyel rast parzûn bike
         const currentHash = window.location.hash.substring(1);
         const isInitialLoad = !state.initialLoadComplete; // Kontrol bike ka barkirina destpêkê ye


          if (isInitialLoad) {
             state.initialLoadComplete = true; // Nîşankirina ku barkirina destpêkê qediya
             handleInitialPageLoad(); // Barkirina rûpel/parzûna destpêkê birêve bibe
         }


         // Zimanê piştî barkirina kategoriyan bicîh bîne da ku nav rast bin
         // Ev ê her weha nîşandana naverokê (mal / hilber) bike
         // setLanguage(state.currentLanguage); // Ev ê du caran nîşandanê bike, jixwe di handleInitialPageLoad de tê kirin
    }, error => {
         console.error("Error fetching categories: ", error);
         // Handle error appropriately, maybe show a message to the user
    });

    // Beşên din ên sepanê saz bike
     // updateCartCount(); // Ev ê di ui-helpers.js de be
    setupEventListeners(); // Guhdarên bûyerên sereke saz bike
    setupScrollObserver(); // Guhdarê scroll ji bo barkirina bêtir saz bike
     // setLanguage(state.currentLanguage); // Zimanê destpêkê bicîh bîne - di handleInitialPageLoad de tê kirin
     // renderContactLinks(); // Ev ê di ui-helpers.js de be
     // checkNewAnnouncements(); // Ev ê di ui-helpers.js de be
     // showWelcomeMessage(); // Ev ê di ui-helpers.js de be
     // setupGpsButton(); // Ev ê di ui-helpers.js de be

     // Guhdariya guhertinên rewşa têketinê bike
     onAuthStateChanged(auth, async (user) => {
         const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // Vê bi UID-ya Admin-a xwe biguherîne
         const isAdmin = user && user.uid === adminUID;

         if (isAdmin) {
             sessionStorage.setItem('isAdmin', 'true');
             // Piştrast bike ku mantiqê admin hatî barkirin berî destpêkirinê
              if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
                 // Ger belge jixwe barkirî be tavilê dest pê bike, wekî din li benda 'load' bimîne
                  if (document.readyState === 'complete' || document.readyState === 'interactive') {
                      window.AdminLogic.initialize();
                  } else {
                      window.addEventListener('load', window.AdminLogic.initialize, { once: true });
                  }
              } else {
                 console.warn("AdminLogic not found or initialize not a function when auth state changed.");
                 // Hûn dikarin li vir mekanîzmayek dubarekirinê an barkirina dînamîk biceribînin
              }
         } else {
             sessionStorage.removeItem('isAdmin');
             // Ger bikarhênerek ne-admin bi rengekî têketî be, wî derxe.
             if (user) {
                 await signOut(auth);
                 console.log("Non-admin user signed out.");
             }
             // UI-ya admin paqij bike heke hebe
              if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
                 window.AdminLogic.deinitialize();
             }
         }

          // Ger bikarhêner wekî admin bi serfirazî têkeve, modala têketinê bigire
         const loginModalElement = document.getElementById('loginModal'); // Ji setup.js nehatiye importkirin
          if (loginModalElement && loginModalElement.style.display === 'block' && isAdmin && window.UIHelpers?.closeCurrentPopup) {
             window.UIHelpers.closeCurrentPopup();
         }
     });

}


/** Fonksiyonek ji bo birêvebirina barkirina rûpela destpêkê li gorî URL. */
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageIdFromHash = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageIdFromHash === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        // Nîşandana rastîn dê ji hêla onSnapshot di initializeAppLogic de were destpêkirin
        // Lê em hewce ne ku state û rûpelê rast saz bikin
        // showSubcategoryDetailPage(mainCatId, subCatId, true); // Ev ê di onSnapshot a kategoriyan de were kirin
         // Sazkirina rûpela çalak bêyî nîşandanê
         showPage(pageIdFromHash, ''); // Dibe ku sernav paşê were nûve kirin
    } else if (pageIdFromHash === 'settingsPage') {
         history.replaceState({ type: 'page', id: pageIdFromHash, title: t('settings_title') }, '', `#${hash}`);
         showPage(pageIdFromHash, t('settings_title'));
    } else { // Rûpela Serekî
        showPage('mainPage'); // Pêşî rûpela serekî nîşan bide
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Destpêkê scroll li 0 ye
        };
        history.replaceState(initialState, '', `${window.location.pathname}?${params.toString()}`); // URL-ê bêyî hash nûve bike
        applyFilterState(initialState); // Parzûnên destpêkê bicîh bîne (ev ê nîşandanê bike)
    }

    // Ger hash ji bo modal an sheet be, piştî ku rûpel hat saz kirin veke
     if (pageIdFromHash === 'mainPage') {
         const element = document.getElementById(hash);
         if (element && window.UIHelpers?.openPopup) {
             const isSheet = element.classList.contains('bottom-sheet');
             const isModal = element.classList.contains('modal');
             if (isSheet || isModal) {
                 // Piçek derengî bide da ku pê ewle bibe ku rûpel hatîye nîşandan
                 setTimeout(() => window.UIHelpers.openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
             }
         }
     }


    // Ger parametreya 'product' hebe, hûrguliyan nîşan bide
    const productId = params.get('product');
    if (productId) {
        // Derengiyek bide da ku pê ewle bibe ku hilber hatine barkirin
        setTimeout(() => showProductDetailsWithDataById(productId), 500); // Fonksiyonek nû ji bo girtina rasterast
    }
}

/** Hûrguliyên hilberê li gorî ID-yê digire û nîşan dide. */
async function showProductDetailsWithDataById(productId) {
     try {
         const docSnap = await getDoc(doc(db, "products", productId));
         if (docSnap.exists()) {
             const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
             showProductDetailsWithData(fetchedProduct); // Fonksiyona heyî bikar bîne
         } else {
             showNotification(t('product_not_found_error'), 'error');
         }
     } catch (error) {
         console.error("Error fetching product by ID:", error);
         showNotification(t('error_generic'), 'error');
     }
}


/** UI-yên girêdayî kategoriyê nûve dike piştî ku kategorî hatin barkirin. */
function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Li benda barkirina kategoriyan bimîne
    // populateCategoryDropdown(); // Ev ê di admin.js an ui-helpers.js de be
    renderMainCategories(); // Kategoriyên serekî nîşan bide
    // Nûvekirina dropdownên admin tenê heke mantiqê admin hatibe barkirin û bikarhêner admin be
     if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns();
         window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Dropdownên karta shortcut jî nûve bike
    }
}

/** Guhdarên bûyerên bingehîn saz dike. */
function setupEventListeners() {
    homeBtn.onclick = async () => {
         // Ger ne li ser rûpela serekî be, biçe wir
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]); // URL-ê paqij bike
            showPage('mainPage');
        }
        // Parzûnan vesaz bike dema ku li malê tê klîkkirin
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    };

    settingsBtn.onclick = () => {
         // Çûna rûpela mîhengan
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    // Bişkoka paşveçûnê di subpage header de
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Vegere dîroka gerokê
    };

    // Lêgerîna rûpela serekî
    const debouncedSearch = debounce((term) => {
        navigateToFilter({ search: term, category: 'all', subcategory: 'all', subSubcategory: 'all' }); // Lêgerîn parzûnan vesaz dike
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '', category: 'all', subcategory: 'all', subSubcategory: 'all' }); // Lêgerîn û parzûnan vesaz bike
    };

    // Lêgerîna Subpage (mînak, di rûpela hûrguliyên binkategoriyê de)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
         const hash = window.location.hash.substring(1);
         // Tenê heke li ser rûpela hûrguliyên binkategoriyê be lêgerînê bike
         if (hash.startsWith('subcategory_') && window.UIHelpers?.renderProductsOnDetailPage) {
             const ids = hash.split('_');
             const subCatId = ids[2];

             // Bişkojka sub-subkategoriyê ya çalak a heyî bibîne
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all'; // Default 'all'

             // Fonksiyona nîşandana hilberan li ser rûpela hûrguliyan bang bike (divê li ui-helpers be)
             window.UIHelpers.renderProductsOnDetailPage(subCatId, subSubCatId, term);
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
        debouncedSubpageSearch(''); // Lêgerînê bi peyvek vala bike
    };

     // Guhdarê Popstate ji bo birêvebirina paşveçûn/pêşveçûna gerokê
     window.addEventListener('popstate', async (event) => {
          // Hemî popupan bigire dema ku state diguhere
          if (window.UIHelpers?.closeAllPopupsUI) window.UIHelpers.closeAllPopupsUI();

         const popState = event.state;
         if (popState) {
             if (popState.type === 'page') { // Ger state ji bo rûpelek be
                 let pageTitle = popState.title;
                  // Ger ew rûpela hûrguliyên binkategoriyê be û sernav tune be, ji nû ve bistîne
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
                  showPage(popState.id, pageTitle); // Rûpelê nîşan bide
             } else if (popState.type === 'sheet' || popState.type === 'modal') { // Ger state ji bo popup be
                  // Popupê ji nû ve veke
                  if(window.UIHelpers?.openPopup) window.UIHelpers.openPopup(popState.id, popState.type);
             } else { // Ger state ji bo parzûna rûpela serekî be
                 showPage('mainPage'); // Piştrast bike ku rûpela serekî çalak e
                 applyFilterState(popState, true); // Parzûn û scrollê bicîh bîne
             }
         } else { // Ger state tune be (mînak, barkirina destpêkê an paşveçûna berî state a yekem)
             // Vegere rewşa default a rûpela serekî
             const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
             showPage('mainPage');
             applyFilterState(defaultState);
         }
     });


}

/** Guhdarê scroll ji bo barkirina bêtir hilberan saz dike. */
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Ger trigger xuya bibe û em ne di nav barkirinê de bin û hemî hilber nehatibin barkirin
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
             // Tenê heke em li ser rûpela serekî bin û ne di dîmena malê de bin, bêtir bar bike
            const isMainPageActive = document.getElementById('mainPage').classList.contains('page-active');
            const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
             if (isMainPageActive && !isHomeView) {
                 console.log("Scroll trigger hit, loading more products...");
                 searchProductsInFirestore(state.currentSearch, false); // Rûpela din bistîne
             }
        }
    }, {
        root: null, // Li gorî dîmendera gerokê
        threshold: 0.1 // Dema ku 10% ji elementê xuya bibe trigger bike
    });

    observer.observe(trigger); // Dest bi çavdêriya trigger bike
}

// --- PWA and Service Worker ---

/** Guhdariya bûyera 'beforeinstallprompt' dike ji bo sazkirina PWA. */
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Pêşî li infobar a biçûk bigire
    state.deferredPrompt = e; // Bûyerê tomar bike ji bo paşê
    // UI nûve bike da ku bikarhêner bizanibe ku dikare PWA saz bike
    const installBtn = document.getElementById('installAppBtn'); // Assume defined in ui-helpers or app-setup
    if (installBtn) {
        installBtn.style.display = 'flex'; // Bişkoka sazkirinê nîşan bide
    }
    console.log('`beforeinstallprompt` event was fired.');
});

/** Service worker tomar dike û birêvebirina nûvekirinan saz dike. */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        const updateNotificationElement = document.getElementById('update-notification'); // Assume defined in ui-helpers or app-setup
        const updateNowBtn = document.getElementById('update-now-btn'); // Assume defined in ui-helpers or app-setup

        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered successfully.');

            // Guhertinên di Service Worker de bişopîne.
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker found!', newWorker);

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Karkerek nû hatî saz kirin û li bendê ye
                         if (updateNotificationElement) updateNotificationElement.classList.add('show'); // Agahdariya nûvekirinê nîşan bide
                    }
                });
            });

            // Guhdarê bûyerê ji bo bişkoka nûvekirinê
             if (updateNowBtn) {
                 updateNowBtn.addEventListener('click', () => {
                     // Peyamek bişîne SW da ku li bendê nemîne û tavilê çalak bibe
                     if (registration.waiting) {
                         registration.waiting.postMessage({ action: 'skipWaiting' });
                     }
                 });
             }

        }).catch(err => {
            console.log('Service Worker registration failed: ', err);
        });

        // Guhdariya guhertina controller bike ku piştî skipWaiting tê bang kirin
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Dema ku service worker ku vê rûpelê kontrol dike diguhere ev tê avêtin
            console.log('New Service Worker activated. Reloading page...');
            window.location.reload(); // Rûpelê ji nû ve bar bike da ku service worker nû bikar bîne
        });
    }
}


// --- Initialization ---

/** Fonksiyona sereke ji bo destpêkirina sepanê. */
function init() {
    renderSkeletonLoader(productsContainer, 8); // Di destpêkê de skeleton loader nîşan bide

    // Hewl bide ku persistenca offline çalak bike
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic(); // Mantiqê sepanê dest pê bike
        })
        .catch((err) => {
            console.error("Error enabling persistence, running online:", err);
            initializeAppLogic(); // Tevî têkçûnê jî mantiqê sepanê dest pê bike
        });

     setupServiceWorker(); // Service worker saz bike
}

// --- Global Exposure for Admin ---
// Ev beş pêdivî ye ku fonksîyonên ku ji hêla admin.js ve têne bikar anîn peyda bike.
// Piştrast bike ku hemî fonksîyonên pêwîst li vir an di ui-helpers.js de hatine diyarkirin û export kirin.
window.globalAdminTools = {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction,
    showNotification, t,
    // openPopup, closeCurrentPopup, // Moved to ui-helpers potentially
    searchProductsInFirestore, // Keep core search here
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Collections
    // setEditingProductId, getEditingProductId, // These might be handled within AdminLogic itself now
    getCategories: () => state.categories, // Provide categories
    getCurrentLanguage: () => state.currentLanguage, // Provide language
    clearProductCache: () => { // Function to clear cache
        console.log("Product cache and home page cleared due to admin action.");
        state.productCache = {};
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) homeContainer.innerHTML = '';
        // Trigger re-render if on home page after clearing
         const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
         if(isHomeView) {
            renderHomePageContent();
         } else {
             searchProductsInFirestore(state.currentSearch, true); // Re-render product list
         }
    },
    // Add other functions needed by admin.js if they remain in this file
     createProductCardElement, // Might be needed by admin preview?
     navigateToFilter, // Allow admin to trigger navigation
     showPage, // Allow admin to trigger page changes
     applyFilterState, // Allow admin to apply filters programmatically
     // Add functions that admin needs to interact with UI managed by main-logic
};


// Destpêkirina sepanê dema ku DOM amade ye
document.addEventListener('DOMContentLoaded', init);

// Exportên ji bo ui-helpers.js (û potansiyel admin.js)
export {
    // Export state, db, auth etc. if ui-helpers needs direct access
    state, db, auth, messaging, analytics,
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    // Export core utilities
    // t, // Already exported
    // showNotification, // Already exported
    // debounce, // Already exported
    // createProductCardElement, // Already exported
    renderSkeletonLoader, // If needed by ui-helpers
    updateActiveNav, // If needed
    // Export navigation functions if ui-helpers needs them
    navigateToFilter,
    // showPage, // Already exported
    applyFilterState,
    // Export other necessary functions...
    searchProductsInFirestore, // ui-helpers might need to trigger search?
    renderMainCategories, // For updating on language change?
    renderSubcategories, // For updating on language change?
    showProductDetailsWithData, // For showing details from favorites/cart?
    formatDescription, // Exported from ui-helpers but potentially needed here too or move definition
};
