// BEŞÊ DUYEM: app-logic.js
// Fonksiyon û mentiqê serekî yê bernameyê (Çakkirî bo çareserkirina کێشەی scroll - وەشانی 3)

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

// --- Helper Functions ---

function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function t(key, replacements = {}) {
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
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

// --- History & Navigation ---

// Saves the current scroll position ONLY for the main page filter state
function saveCurrentScrollPosition(reason = "unknown") {
    const currentState = history.state;
    const mainPageElement = document.getElementById('mainPage');
    if (mainPageElement && mainPageElement.classList.contains('page-active') && currentState && !currentState.type) {
        const scrollY = window.scrollY;
        // console.log(`Saving scroll position (${reason}):`, scrollY);
        history.replaceState({ ...currentState, scroll: scrollY }, '');
    }
}

// Updates header based on current page
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

// Shows a specific page and updates history/header
function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top ONLY when navigating TO a different page (not main page filter changes)
    if (pageId !== 'mainPage' && window.scrollY !== 0) {
       // console.log(`showPage: Scrolling to top for page ${pageId}`);
       window.scrollTo(0, 0);
    }

    updateHeaderView(pageId, pageTitle);

    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}

// Applies filter state (category, search) and handles scrolling
async function applyFilterState(filterState, fromPopState = false) {
    // console.log("Apply Filter State - Start. fromPopState:", fromPopState, "State:", filterState);

    // Update global state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update UI elements
    searchInput.value = state.currentSearch;
    clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Render potentially changed category/subcategory displays
    renderMainCategories(); // Reflect active main category
    await renderSubcategories(state.currentCategory); // Render subcategories if applicable

    // Await the function that actually renders the content based on the new state
    // 'true' indicates it's a new filter application, potentially clearing existing products
    await searchProductsInFirestore(state.currentSearch, true);

    // --- Scroll Handling ---
    const mainPageElement = document.getElementById('mainPage');
    if (!mainPageElement || !mainPageElement.classList.contains('page-active')) {
       // console.log("Apply Filter State - Scroll skipped: Main page not active.");
       return; // Don't scroll if not on the main page
    }

    if (fromPopState && typeof filterState.scroll === 'number' && filterState.scroll > 0) {
       // Restore scroll position after content is likely rendered
       // console.log("Apply Filter State - Attempting scroll restore to:", filterState.scroll);
       requestAnimationFrame(() => {
           // Double-check page is still active before scrolling
           if (mainPageElement.classList.contains('page-active')) {
               // console.log("Apply Filter State - Restoring scroll inside rAF.");
               window.scrollTo(0, filterState.scroll);
           } else {
              // console.log("Apply Filter State - Scroll restore aborted inside rAF: Main page no longer active.");
           }
       });
    } else if (!fromPopState) {
       // Scroll to top for *new* navigation actions on the main page
       // console.log("Apply Filter State - Scrolling to top for new state.");
       window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (fromPopState && (!filterState.scroll || filterState.scroll <= 0)) {
        // Handle popstate where the saved scroll was 0 or undefined - ensure top
        // console.log("Apply Filter State - Popstate with zero/no scroll, ensuring scroll to top.");
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // console.log("Apply Filter State - End.");
}


// Navigates to a new filter state, updating history
async function navigateToFilter(newState) {
    // 1. Save scroll position of the CURRENT state before changing anything
    saveCurrentScrollPosition("navigateToFilter start");

    // 2. Define the NEW state to be pushed (starts conceptually at scroll 0)
    const finalState = {
        category: newState.category !== undefined ? newState.category : state.currentCategory,
        subcategory: newState.subcategory !== undefined ? newState.subcategory : state.currentSubcategory,
        subSubcategory: newState.subSubcategory !== undefined ? newState.subSubcategory : state.currentSubSubcategory,
        search: newState.search !== undefined ? newState.search : state.currentSearch,
        scroll: 0 // New states always start at 0 scroll conceptually
    };

    // 3. Generate new URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // 4. Push the new state to history
    // console.log("navigateToFilter: Pushing new state", finalState, "to URL:", newUrl);
    try {
        history.pushState(finalState, '', newUrl);
    } catch (e) {
        console.error("Error during history.pushState:", e);
    }

    // 5. Apply the filter state visually (will scroll to top because fromPopState is false)
    await applyFilterState(finalState, false);
}

// Handles browser back/forward buttons
window.addEventListener('popstate', async (event) => {
    // console.log("Popstate event triggered. State:", event.state);
    closeAllPopupsUI(); // Close any popups first
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
            // Navigating between distinct pages (e.g., main <-> settings)
            // console.log("Popstate: Handling page navigation to:", popState.id);
            let pageTitle = popState.title;
            // Re-fetch title if needed (e.g., for subcategory detail page)
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
            // Reopening a previously opened popup
            // console.log("Popstate: Handling popup navigation for:", popState.id);
            openPopup(popState.id, popState.type); // openPopup handles overlay etc.
        } else {
            // Assumed to be a filter state change on the main page
            // console.log("Popstate: Handling filter state change on main page.");
            showPage('mainPage'); // Ensure main page is visible
            // console.log("Popstate: Calling applyFilterState with state:", popState);
            applyFilterState(popState, true); // Pass true to indicate it's from history
        }
    } else {
        // No state - likely initial load or navigating back to initial state
        // console.log("Popstate: No state found, applying default state.");
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        // console.log("Popstate: Calling applyFilterState with default state");
        applyFilterState(defaultState, false); // Treat as new navigation, scroll to top
    }
});


// --- Popups / Sheets ---

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition("openPopup"); // Save scroll before opening
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any existing ones first
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Lazy load content if needed
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
    document.body.classList.add('overlay-active');
    // Push state so back button closes it
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

function closeCurrentPopup() {
    // Check if the current history state is a popup state
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Use history back to trigger popstate and UI closure
    } else {
        // Fallback if history state isn't as expected
        closeAllPopupsUI();
    }
}

// --- Rendering Functions (Categories, Products, Cart, etc.) ---
// [Includes: renderSkeletonLoader, createProductCardElement, renderProducts, renderMainCategories, renderSubcategories, showSubcategoryDetailPage, renderSubSubcategoriesOnDetailPage, renderProductsOnDetailPage, etc.]
// (No significant changes needed in most rendering functions for the scroll issue itself, keep previous versions)

// Minor adjustment: Ensure skeleton loader clears container before adding skeletons
function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    container.innerHTML = ''; // Clear existing content first
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
    // Hide actual products/loader when skeleton is shown
    if (container === skeletonLoader) {
      productsContainer.style.display = 'none';
      loader.style.display = 'none';
    }
}

async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = ''; // Clear previous

    // Don't show subcategories if 'All' is selected
    if (!categoryId || categoryId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide container
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
            return;
        }

        subcategoriesContainer.style.display = 'flex'; // Show container

        // 'All' button within subcategories (optional, but good UX)
        // You might decide if you want this button or not. If clicked, it should probably just show all products for the main category.
        // const allBtn = document.createElement('button');
        // ... (code for 'All' subcategory button if desired) ...
        // subcategoriesContainer.appendChild(allBtn);

        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            // Check if this subcategory matches the globally stored currentSubcategory
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>
            `;

            // IMPORTANT: Clicking a subcategory button should navigate to its detail page
            subcatBtn.onclick = () => {
                showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none'; // Hide on error
    }
}

// Ensure createProductCardElement is included here (keep previous version)
function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card'; // Add reveal class later if needed
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        const originalPriceFormatted = product.originalPrice.toLocaleString();
        // Updated: Keep original price small and struck-through
        priceHTML = `<div class="product-price-container">
                        <span class="product-price">${product.price.toLocaleString()} د.ع.</span>
                        <del class="original-price" style="display: inline; color: var(--dark-gray); font-size: 13px; margin-right: 5px;">${originalPriceFormatted} د.ع.</del>
                     </div>`;
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
    // Add event listeners (keep previous version's listeners)
    // Share button listener
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

    // Main card click listener (handles add to cart, admin actions, details view)
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Re-check admin status

        if (addToCartButton && !addToCartButton.disabled) {
            event.stopPropagation(); // Prevent opening details view
            addToCart(product.id);
            // --- Add to cart button animation ---
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
            // --- End animation ---
        } else if (isAdminNow && target.closest('.edit-btn')) {
             event.stopPropagation();
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
             event.stopPropagation();
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
             event.stopPropagation();
            toggleFavorite(product.id, event); // Pass event to toggleFavorite
        } else if (target.closest('.share-btn-card')) {
            // Already handled by its own listener, stop propagation
            event.stopPropagation();
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description (if any)
            showProductDetails(product.id); // Show details view
        }
    });

    return productCard;
}

// Ensure renderProducts is included (keep previous version, potentially add reveal class logic back)
function renderProducts(append = false) {
     if (!append) {
         productsContainer.innerHTML = ''; // Clear if not appending
     }
    if (!state.products || state.products.length === 0) {
        if (!append) { // Show message only if it's a fresh render with no results
             productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        }
        return;
    }

    // Determine which products to render (all if not appending, only new ones if appending)
    const productsToRender = append
        ? state.products.slice(productsContainer.children.length) // Get only newly loaded products
        : state.products; // Render all products

    productsToRender.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add animation class
        productsContainer.appendChild(element);
    });

    // Re-setup animations for newly added cards
    setupScrollAnimations();
}

// Function to set up IntersectionObserver for card animations
function setupScrollAnimations() {
    // Use a WeakMap to track observed elements to prevent re-observing
    if (!window.scrollObserver) {
        window.observedElements = new WeakMap();
        window.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    window.scrollObserver.unobserve(entry.target); // Stop observing once visible
                    window.observedElements.delete(entry.target); // Remove from tracking map
                }
            });
        }, {
            threshold: 0.1 // Trigger when 10% is visible
        });
    }

    // Observe only new elements that haven't been observed before
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
        if (!window.observedElements.has(card)) {
            window.scrollObserver.observe(card);
            window.observedElements.set(card, true); // Mark as observed
        }
    });
}

// Ensure renderHomePageContent and related section renderers are included (keep previous, corrected versions)
// [renderHomePageContent, renderPromoCardsSectionForHome, renderBrandsSection, renderNewestProductsSection, renderSingleShortcutRow, renderSingleCategoryRow, renderAllProductsSection]
// Keep the v2 corrected versions from the previous turn

// ======================================
// ===== START: Slider Fix v2 - Functions (Keep these) =====
// ======================================
async function renderHomePageContent() {
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton while loading layout
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up any existing slider intervals before rendering new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">پەڕەی سەرەکی ڕێکنەخراوە.</p>'; // Show message if empty
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

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
                        } else { console.warn("Single shortcut row section missing rowId."); }
                        break;
                    case 'single_category_row':
                         if (section.categoryId) { // Check if categoryId exists
                             sectionElement = await renderSingleCategoryRow(section);
                         } else { console.warn("Single category row section missing categoryId."); }
                        break;
                    case 'all_products':
                        // This usually renders below the dynamic sections via searchProductsInFirestore
                        // But if specifically added, maybe render a header? Or just let the main product grid show.
                        // sectionElement = await renderAllProductsSection(); // Decide if you want this
                         console.log("Found 'all_products' in layout, main grid will handle rendering.");
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
        // Skeleton loader is cleared implicitly when content is added or error message is shown
    }
}

async function renderPromoCardsSectionForHome(groupId, layoutId) { // Accepts layoutId
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item full width
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID using layoutId

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null }; // State local to this slider instance
            const cardData = { cards }; // Data needed by createPromoCardElement

            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass local state
            promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered globally
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear this specific interval
                            // Remove from global state if it exists there (might have been cleared already)
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element removed or interval cleared globally
                    }
                    // Rotate logic
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Clear previous interval for this specific layoutId if it exists in global state
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID both locally and globally
                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId; // Store globally using layoutId
            }
            return promoGrid; // Return the container element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}
// Include other section renderers: renderBrandsSection, renderNewestProductsSection, renderSingleShortcutRow, renderSingleCategoryRow, renderAllProductsSection (Keep previous versions)
// [Ensure these functions return the created element or null]
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
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.style.opacity='0'">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
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
        // Fetch newest based on creation time, limit to e.g., 10
        const q = query(
            productsCollection,
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null; // Do not render if there are no new products
        }

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use name from layout if provided, fallback to row title
        const rowTitle = (sectionNameObj && (sectionNameObj[state.currentLanguage] || sectionNameObj.ku_sorani))
                         || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;


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

        if (cardsSnapshot.empty) return null; // Don't render empty rows

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div'); // Use div instead of button for better structure
            item.className = 'shortcut-card'; // Make it look like a card
            item.role = 'button'; // Indicate it's clickable
            item.tabIndex = 0; // Make it focusable
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.style.opacity='0'">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
             // Add keypress listener for accessibility
             item.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                     item.onclick();
                 }
             });
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
    let title = name[state.currentLanguage] || name.ku_sorani; // Title from layout config
    let targetDocRefPath;

    if (subSubcategoryId && subcategoryId && categoryId) {
        queryField = 'subSubcategoryId'; queryValue = subSubcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`;
    } else if (subcategoryId && categoryId) {
        queryField = 'subcategoryId'; queryValue = subcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}`;
    } else if (categoryId) {
        queryField = 'categoryId'; queryValue = categoryId;
        targetDocRefPath = `categories/${categoryId}`;
    } else { return null; }

    try {
        // Optionally fetch category name for title override
        const targetSnap = await getDoc(doc(db, targetDocRefPath));
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title; // Override with fetched name if exists
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
            if(subcategoryId) { // Navigate to detail page if sub or subsub selected
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else { // Filter on main page if only main category selected
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

async function renderAllProductsSection() {
    // This function might not be needed if 'all_products' in layout
    // simply means the main grid should be shown below dynamic sections.
    // If you want a specific "All Products" header for that section:
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
    // The actual products will be rendered by searchProductsInFirestore triggering renderProducts
    return container; // Return just the header container
}

// ======================================
// ===== END: Slider Fix v2 - Functions =====
// ======================================

// Ensure searchProductsInFirestore is included (keep previous version)
async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const mainPageElement = document.getElementById('mainPage'); // Get main page element

    // Determine if we should show dynamic home sections or the product grid
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // Show home sections, hide product grid/loader
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        loader.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render home sections if not already rendered or if forced by isNewSearch
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) {
           await renderHomePageContent(); // Render dynamic sections
        }
        // No further product fetching needed for home view
        return;
    } else {
        // Show product grid/loader, hide home sections
        homeSectionsContainer.style.display = 'none';
        // Stop all slider intervals when leaving full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals

        // --- Start product fetching logic ---
        if (state.isLoadingMoreProducts) return; // Prevent concurrent loading

        if (isNewSearch) {
            // Reset state for a new search/filter
            state.allProductsLoaded = false;
            state.lastVisibleProductDoc = null;
            state.products = [];
            productsContainer.innerHTML = ''; // Clear previous products immediately
            renderSkeletonLoader(); // Show skeleton loader for new search
        } else if (state.allProductsLoaded) {
             // If not a new search and all are loaded, do nothing
             scrollTrigger.style.display = 'none'; // Ensure trigger is hidden
             return;
        }

        state.isLoadingMoreProducts = true;
        if (!isNewSearch) { // Show bottom loader only when loading *more*
             loader.style.display = 'block';
        }
        scrollTrigger.style.display = 'none'; // Hide trigger while loading

        try {
            let productsQuery = collection(db, "products");
            let constraints = []; // Use an array for constraints

            // Apply category filters
            if (state.currentCategory && state.currentCategory !== 'all') {
                constraints.push(where("categoryId", "==", state.currentCategory));
            }
            if (state.currentSubcategory && state.currentSubcategory !== 'all') {
                 constraints.push(where("subcategoryId", "==", state.currentSubcategory));
            }
            if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
                 constraints.push(where("subSubcategoryId", "==", state.currentSubSubcategory));
            }

            // Apply search term filter
            const finalSearchTerm = searchTerm.trim().toLowerCase();
            if (finalSearchTerm) {
                 constraints.push(where('searchableName', '>=', finalSearchTerm));
                 constraints.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
                 // Order by searchableName first when searching
                 constraints.push(orderBy("searchableName", "asc"));
            }

             // Apply default ordering (newest first) if not searching
             // Also add secondary sort for consistent pagination when searching
             constraints.push(orderBy("createdAt", "desc"));

             // Apply pagination (startAfter) if loading more
            if (state.lastVisibleProductDoc && !isNewSearch) {
                 constraints.push(startAfter(state.lastVisibleProductDoc));
            }

             // Apply limit
             constraints.push(limit(PRODUCTS_PER_PAGE));

             // Build the final query
             productsQuery = query(productsQuery, ...constraints);

            const productSnapshot = await getDocs(productsQuery);
            const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Update product list and pagination state
            if (isNewSearch) {
                state.products = newProducts;
            } else {
                state.products = [...state.products, ...newProducts];
            }

            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Update last doc reference

            if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
                state.allProductsLoaded = true;
            } else {
                state.allProductsLoaded = false;
            }

            // Render products (append if loading more, replace if new search)
            renderProducts(!isNewSearch); // Pass true to append if loading more

        } catch (error) {
            console.error("Error fetching products:", error);
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } finally {
            state.isLoadingMoreProducts = false;
            loader.style.display = 'none'; // Hide bottom loader
            skeletonLoader.style.display = 'none'; // Hide skeleton loader
            productsContainer.style.display = 'grid'; // Ensure product grid is visible
            // Show scroll trigger only if more products might exist
            scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        }
    }
}


// --- Cart Functions ---
// [addToCart, renderCart, updateQuantity, removeFromCart, generateOrderMessage, renderCartActionButtons]
// Keep previous versions

// --- Favorites Functions ---
// [saveFavorites, isFavorite, toggleFavorite, renderFavoritesPage]
// Keep previous versions

// --- Profile & Settings ---
// [setLanguage, saveProfile, setupGpsButton, updateContactLinksUI]
// Keep previous versions

// --- PWA & Notifications ---
// [requestNotificationPermission, saveTokenToFirestore, checkNewAnnouncements, renderUserNotifications]
// Keep previous versions

// --- Policies ---
// [renderPolicies]
// Keep previous versions

// --- Initialization & Event Listeners ---
// [init, initializeAppLogic, setupEventListeners, handleInitialPageLoad]
// Keep previous versions, ensure saveCurrentScrollPosition is called in appropriate places within listeners (like openPopup)

// Minor update to event listener setup to ensure saveCurrentScrollPosition is called before opening popups
function setupEventListeners() {
    // --- Navigation Buttons ---
    homeBtn.onclick = async () => {
        // If already on main page and filters are default, do nothing? Or maybe scroll to top?
        // Current logic: Go to main page state, reset filters, scrolls to top via applyFilterState
        if (!document.getElementById('mainPage').classList.contains('page-active') || state.currentCategory !== 'all' || state.currentSearch !== '') {
            const newState = { type: 'page', id: 'mainPage' };
             // Check if current state is already main page to avoid duplicate history entry
            if (!history.state || history.state.id !== 'mainPage' || history.state.type !== 'page') {
                history.pushState(newState, '', window.location.pathname.split('?')[0]); // Push page state
            }
             showPage('mainPage'); // Show page first
            await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' }); // Then apply default filters
        } else {
            // Already on main page with default filters, just scroll top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
         updateActiveNav('homeBtn'); // Ensure home is active
    };

    settingsBtn.onclick = () => {
         // Save scroll before navigating away from main page
         if (document.getElementById('mainPage').classList.contains('page-active')) {
             saveCurrentScrollPosition("settingsBtn click");
         }
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
        updateActiveNav('settingsBtn');
    };

    // Subpage Header Back Button
    document.getElementById('headerBackBtn').onclick = () => {
        history.back(); // Let popstate handle the view change and scroll restoration
    };

    // --- Bottom Nav Sheet Triggers ---
    profileBtn.onclick = () => {
        openPopup('profileSheet'); // saveCurrentScrollPosition is called inside openPopup
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

    // --- Settings Page Links ---
    settingsFavoritesBtn.onclick = () => openPopup('favoritesSheet');
    settingsAdminLoginBtn.onclick = () => openPopup('loginModal', 'modal');
    termsAndPoliciesBtn?.addEventListener('click', () => openPopup('termsSheet'));

    // --- Popup Closing ---
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    // Close modal if clicking outside content
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
             // Check if the click target IS the modal background itself
             if (e.target.id === 'loginModal' || e.target.id === 'productFormModal' || e.target.id === 'welcomeModal' || e.target.id === 'addHomeSectionModal' || e.target.id === 'editCategoryModal') {
                closeCurrentPopup();
             }
        }
    };


    // --- Forms & Inputs ---
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            // Admin logic init happens via onAuthStateChanged
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
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
        closeCurrentPopup(); // Close the sheet after saving
    };

    // Debounced search for main page
    const debouncedSearch = debounce((term) => {
        // navigateToFilter handles saving scroll and pushing state
        navigateToFilter({ search: term });
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navigateToFilter({ search: '' }); // Trigger navigation to clear search
    };

    // Debounced search for subpage (detail page)
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

    // --- Other UI Interactions ---
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => setLanguage(btn.dataset.lang);
    });

    notificationBtn.addEventListener('click', () => openPopup('notificationsSheet'));
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);

    // PWA Install Button
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                installBtn.style.display = 'none';
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                state.deferredPrompt = null;
            }
        });
    }

     // Foreground FCM messages
     onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body || "";
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; // Show badge
    });

    // --- Scroll Trigger for Infinite Loading ---
    setupScrollObserver(); // Ensure observer is set up
}

// Ensure init and initializeAppLogic are included (keep previous versions)
function init() {
    renderSkeletonLoader(); // Show skeleton immediately

    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("Firestore offline persistence enabled.");
            initializeAppLogic();
        })
        .catch((err) => {
            console.warn("Firestore offline persistence failed:", err.code);
            initializeAppLogic(); // Initialize anyway
        });
}

function initializeAppLogic() {
    // Ensure slider interval state exists
    if (!state.sliderIntervals) {
        state.sliderIntervals = {};
    }

    // Fetch categories first, then handle initial load
    const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories];
        updateCategoryDependentUI(); // Update category displays

        // Now that categories are loaded, handle the initial URL state
        handleInitialPageLoad(); // This will call applyFilterState if needed

         // Apply initial language setting AFTER categories and initial load handled
        setLanguage(state.currentLanguage);
    }, (error) => {
         console.error("Error fetching categories:", error);
         // Handle error, maybe show a message and still try to load products
         handleInitialPageLoad(); // Try to load based on URL even if categories fail
         setLanguage(state.currentLanguage);
    });

    // Setup other non-category dependent parts
    updateCartCount();
    setupEventListeners(); // Setup listeners after DOM is ready
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
    // Scroll observer is set up inside setupEventListeners
}

// Function to handle initial page load based on URL hash/params
function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    let initialState = null;
    let initialPageId = 'mainPage';
    let initialPageTitle = '';

    // Determine initial page and state based on hash
    if (hash.startsWith('subcategory_')) {
        initialPageId = 'subcategoryDetailPage';
        // Title will be fetched later in showSubcategoryDetailPage
    } else if (hash === 'settingsPage') {
        initialPageId = 'settingsPage';
        initialPageTitle = t('settings_title');
    } else {
        // Main page or a popup on the main page
        initialPageId = 'mainPage';
        initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Will be potentially overridden by history API later if applicable
        };
         // If a sheet/modal hash exists, prepare to open it
         if (hash && (document.getElementById(hash)?.classList.contains('bottom-sheet') || document.getElementById(hash)?.classList.contains('modal'))) {
             // Store popup state to be opened after main page/filters applied
             initialState.popup = { id: hash, type: document.getElementById(hash).classList.contains('bottom-sheet') ? 'sheet' : 'modal' };
         }
    }

     // Replace initial history state
     const historyState = initialState
         ? (initialState.popup ? { ...initialState, type: initialState.popup.type, id: initialState.popup.id } : initialState) // If popup, set type/id
         : { type: 'page', id: initialPageId, title: initialPageTitle }; // If page, set type/id/title
     history.replaceState(historyState, '');

    // Show the determined page
    showPage(initialPageId, initialPageTitle);

    // If it's the main page, apply filters
    if (initialPageId === 'mainPage' && initialState) {
        applyFilterState(initialState, false); // Apply filters (will scroll to top)
        // If there was a popup to open, open it now
        if(initialState.popup) {
             // Use setTimeout to ensure the page transition/rendering starts before opening popup
             setTimeout(() => openPopup(initialState.popup.id, initialState.popup.type), 50);
        }
    } else if (initialPageId === 'subcategoryDetailPage') {
        // Extract IDs and call the detail page function
        const ids = hash.split('_');
        if (ids.length >= 3) {
            showSubcategoryDetailPage(ids[1], ids[2], true); // Pass true for 'fromHistory'
        }
    }

    // If a specific product ID is in the URL, show its details
    if (productId) {
        // Use a timeout to ensure the main UI is rendered first
        setTimeout(() => showProductDetails(productId), 300);
    }
}


// --- Authentication Listener ---
onAuthStateChanged(auth, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3"; // !! Double-check this UID !!
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true');
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
             // Wait for DOM content to be fully loaded before initializing admin logic if needed
             if (document.readyState === 'complete' || document.readyState === 'interactive') {
                window.AdminLogic.initialize();
             } else {
                 document.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
             }
        } else { console.warn("AdminLogic not found or initialize not a function."); }
        if (loginModal.style.display === 'block') closeCurrentPopup(); // Close login modal on success
    } else {
        sessionStorage.removeItem('isAdmin');
        if (user) { // If a non-admin is logged in, log them out
            await signOut(auth);
            console.log("Non-admin user signed out.");
        }
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize(); // Clean up admin UI
        }
    }
});

// --- PWA Install Prompt ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
    console.log('`beforeinstallprompt` event fired.');
});

// --- Service Worker Update Handling ---
if ('serviceWorker' in navigator) {
    // ... (Keep the previous Service Worker update code) ...
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
             // Ensure there's a waiting worker before sending the message
             if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
             } else {
                 console.log("Update button clicked, but no waiting service worker found.");
                 // Optionally hide notification or reload anyway if state is unexpected
                 updateNotification.classList.remove('show');
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

// --- App Initialization ---
// Use DOMContentLoaded to ensure basic DOM is ready before starting DB persistence setup
document.addEventListener('DOMContentLoaded', init);


// Expose necessary functions/variables for admin.js
// Ensure all necessary Firebase functions and collections are exposed
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, startAfter, runTransaction, // Added startAfter
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Added shortcutRowsCollection
    clearProductCache,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    populateSubcategoriesDropdown: AdminLogic.populateSubcategoriesDropdown, // Expose helper if needed by admin
    populateSubSubcategoriesDropdown: AdminLogic.populateSubSubcategoriesDropdown, // Expose helper if needed by admin
});

// --- Keep remaining functions (Cart, Favorites, Profile, etc.) here ---
// [These should generally be okay from the previous version unless specific bugs were noted]
// Make sure functions like updateCartCount, saveCart, renderCart, etc. are present.
// Make sure functions like saveFavorites, isFavorite, toggleFavorite, renderFavoritesPage are present.
// Make sure functions like setupGpsButton, setLanguage, renderContactLinks, renderUserNotifications, etc. are present.

// --- Cart Functions ---
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function addToCart(productId) {
    // Attempt to find product in already loaded state.products first
    let product = state.products.find(p => p.id === productId);

    const processAddToCart = (prodData) => {
         const mainImage = (prodData.imageUrls && prodData.imageUrls.length > 0) ? prodData.imageUrls[0] : (prodData.image || '');
         const existingItem = state.cart.find(item => item.id === productId);
         if (existingItem) {
             existingItem.quantity++;
         } else {
             state.cart.push({
                 id: prodData.id,
                 name: prodData.name, // Store the name object
                 price: prodData.price,
                 image: mainImage,
                 quantity: 1
             });
         }
         saveCart();
         showNotification(t('product_added_to_cart'));
         if(document.getElementById('cartSheet').classList.contains('show')) {
             renderCart(); // Re-render cart if it's open
         }
    };

    if (product) {
        processAddToCart(product);
    } else {
        // If not found in state, fetch from DB
        console.warn("Product not found in local state. Fetching from DB for cart.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                processAddToCart(fetchedProduct);
            } else {
                 showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(error => {
             console.error("Error fetching product for cart:", error);
             showNotification(t('error_generic'), 'error');
        });
    }
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
    renderCartActionButtons(); // Make sure this function exists and fetches methods

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language, falling back correctly
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                      || (item.name && item.name.ku_sorani)
                                      || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو'); // Handle older cart items stored just as string?

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
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
    totalAmount.textContent = total.toLocaleString();

    // Re-attach listeners after rendering
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

function updateQuantity(productId, change) {
    const cartItemIndex = state.cart.findIndex(item => item.id === productId);
    if (cartItemIndex > -1) {
        state.cart[cartItemIndex].quantity += change;
        if (state.cart[cartItemIndex].quantity <= 0) {
            state.cart.splice(cartItemIndex, 1); // Remove item if quantity is zero or less
        }
        saveCart();
        renderCart(); // Re-render the cart UI
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
    container.innerHTML = '<div>...بارکردنی ڕێگاکانی ناردن</div>'; // Loading state

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt")); // Assuming createdAt exists, or use another field like 'order' if you add one
        const snapshot = await getDocs(q);

        container.innerHTML = ''; // Clear loading state

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Use a more generic class and rely on inline style for color
            btn.className = 'contact-method-btn';
             // Set base styles here or in CSS for .contact-method-btn
             btn.style.cssText = `
                display: flex; align-items: center; justify-content: center; gap: 8px;
                padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;
                margin-top: 10px; width: 100%; border: none; color: white;
                background-color: ${method.color || 'var(--primary-color)'};
            `;


            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Fallback icon

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
                        // Ensure '+' is added for international numbers if needed, encode value
                         link = `viber://chat?number=%2B${encodeURIComponent(value)}`; // Text might not work reliably
                        // Maybe open chat first, then user pastes message?
                        // link = `viber://add?number=${encodeURIComponent(value)}`;
                        break;
                    case 'telegram':
                        // Remove '@' if present for username links
                        const telegramValue = value.startsWith('@') ? value.substring(1) : value;
                        link = `https://t.me/${telegramValue}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`;
                        break;
                    case 'url':
                        link = value; // Assume 'value' is the full URL
                        // Optionally append message if the URL structure supports it (e.g., mailto:)
                        if (link.startsWith('mailto:')) {
                            link += `?subject=Order&body=${encodedMessage}`;
                        }
                        break;
                     default:
                         console.warn("Unknown contact method type:", method.type);
                         return; // Don't try to open a link
                }

                if (link) {
                    window.open(link, '_blank');
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
         console.error("Error fetching contact methods:", error);
         container.innerHTML = '<p>هەڵە لە بارکردنی ڕێگاکانی ناردن.</p>';
    }
}


// --- Favorites Functions ---
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

function toggleFavorite(productId, event) {
    if(event) event.stopPropagation(); // Prevent card click event

    const isCurrentlyFavorite = isFavorite(productId);
    const productName = state.products.find(p => p.id === productId)?.name?.[state.currentLanguage] || 'کاڵاکە'; // Get product name for notification

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites', { product: productName }), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites', { product: productName }), 'success');
    }
    saveFavorites();

    // Update heart icon on all cards with this product ID
    document.querySelectorAll(`.product-card[data-product-id="${productId}"] .favorite-btn`).forEach(favButton => {
        const heartIcon = favButton.querySelector('.fa-heart');
        if (heartIcon) {
             const isNowFavorite = !isCurrentlyFavorite;
             favButton.classList.toggle('favorited', isNowFavorite);
             heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
             heartIcon.classList.toggle('far', !isNowFavorite); // Regular (outline) heart
        }
    });

    // Re-render favorites sheet if it's currently open
    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}


async function renderFavoritesPage() {
    favoritesContainer.innerHTML = ''; // Clear previous

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Use grid layout

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeleton for favorites

    try {
        const fetchPromises = state.favorites.map(id => {
             // Check cache first
             const cachedProduct = state.products.find(p => p.id === id);
             if (cachedProduct) return Promise.resolve({ id: id, ...cachedProduct }); // Use cached if available
             // Fetch from DB if not in cache
             return getDoc(doc(db, "products", id));
        });

        const results = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProductsData = results
            .map(result => {
                // Handle both cached objects and DocSnapshots
                if (result.exists) { // Check if it's a DocSnapshot and exists
                     return { id: result.id, ...result.data() };
                } else if (result.id && result.name) { // Check if it's a cached object
                     return result;
                }
                return null; // Handle cases where product was deleted or fetch failed
            })
            .filter(product => product !== null); // Filter out nulls


        if (favoritedProductsData.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Maybe clear favorites from localStorage if all are invalid?
             // state.favorites = [];
             // saveFavorites();
        } else {
            favoritedProductsData.forEach(product => {
                const productCard = createProductCardElement(product);
                productCard.classList.add('product-card-reveal'); // Add animation class
                favoritesContainer.appendChild(productCard);
            });
            setupScrollAnimations(); // Apply animations
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

// --- Other Utility & UI Functions ---
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function updateCategoryDependentUI() {
    if (state.categories.length === 0) return; // Wait until categories are loaded
    populateCategoryDropdown(); // For admin product form
    renderMainCategories(); // Main category buttons on home page
    renderCategoriesSheet(); // Categories list in the sheet

    // Update admin dropdowns only if admin logic is loaded and user is admin
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
        window.AdminLogic.updateAdminCategoryDropdowns();
         // Update dropdowns specific to shortcut cards as well
        if (typeof window.AdminLogic.updateShortcutCardCategoryDropdowns === 'function') {
             window.AdminLogic.updateShortcutCardCategoryDropdowns();
        }
    }
}

function populateCategoryDropdown() {
    // Populate the dropdown in the admin "Add/Edit Product" modal
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێ سەرەکی هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Display name in current language or fallback
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

function renderCategoriesSheet() {
    // Render the list of categories in the bottom sheet popup
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); } // Highlight current

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        // Include icon if available
        const iconHTML = cat.icon ? `<i class="${cat.icon}"></i>` : '<i class="fas fa-tag"></i>'; // Default icon
        btn.innerHTML = `${iconHTML} ${categoryName}`;

        btn.onclick = async () => {
            // Navigate to filter for this category
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory when changing main category
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
            closeCurrentPopup(); // Close the sheet
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}
// Include other functions like setLanguage, renderContactLinks, checkNewAnnouncements, renderUserNotifications, renderPolicies, setupGpsButton etc. from previous version
function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl'; // Assuming always RTL

    // Update all elements with data-translate-key
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) element.placeholder = translation;
        } else {
            // Find the innermost text node to avoid overwriting icons etc.
             let textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
             if (textNode) {
                 textNode.textContent = translation;
             } else if (element.childNodes.length === 0 || (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE)) {
                  // Fallback for elements with only text or empty
                  element.textContent = translation;
             } else {
                 // If complex content (like icon + text span), find a span or update last text node
                 let span = element.querySelector('span:not([class])') || element.querySelector('span'); // Prioritize spans without class
                 if (span) {
                     span.textContent = translation;
                 } else {
                     // As a last resort, update the element's text content, might break icons in some cases
                     // console.warn("Could not find specific text node/span for translation key:", key, "in element:", element);
                     // element.textContent = translation; // Use cautiously
                 }
             }
        }
    });

    // Update language button active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render components that depend heavily on language
    // - Home Page Content (needs re-render for section titles, brand names etc.)
    // - Product Grid (for names, potentially shipping info)
    // - Category displays
    // - Open sheets/popups

    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isHomeView) {
        // Force re-render of home page sections
         renderHomePageContent(); // This clears and re-renders
    } else {
        // Re-render the product grid with current products but updated language
         renderProducts(); // This just re-renders cards based on state.products
    }

    renderMainCategories();
    renderCategoriesSheet(); // Re-render sheet content
    renderSubcategories(state.currentCategory); // Re-render subcategories if a main one is selected

    // Re-render open popups/sheets if they depend on language
    if (document.getElementById('cartSheet').classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPage();
    if (document.getElementById('productDetailSheet').classList.contains('show')) {
         // Need to find the product and re-show details to update language
         const currentProductId = document.getElementById('productDetailSheet').dataset.currentProductId; // Assume we store this ID on the sheet
         if(currentProductId) showProductDetails(currentProductId);
    }
    if (document.getElementById('notificationsSheet').classList.contains('show')) renderUserNotifications();
    if (document.getElementById('termsSheet').classList.contains('show')) renderPolicies();
    if (document.getElementById('cartActions').style.display === 'block') renderCartActionButtons(); // Re-render action buttons

    // Update admin section titles if admin is active
    if(sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        // Might need specific functions in AdminLogic to update its UI parts based on language
        // e.g., window.AdminLogic.updateUITranslations();
    }
}

async function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if(!contactLinksContainer) return;

    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc")); // Or order by 'order' field if added

    try {
        const snapshot = await getDocs(q); // Fetch once, or use onSnapshot if real-time needed

        contactLinksContainer.innerHTML = ''; // Clear previous

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani; // Use current language

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer'; // Security best practice
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
    } catch (error) {
         console.error("Error fetching contact links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە بارکردنی لینکەکان.</p>';
    }
}

function checkNewAnnouncements() {
    // Check if there are new announcements compared to the last seen timestamp
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => { // Use onSnapshot for real-time check
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            // Use 0 if timestamp not found in localStorage
            const lastSeenTimestamp = parseInt(localStorage.getItem('lastSeenAnnouncementTimestamp') || '0', 10);

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block'; // Show badge if newer exists
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
             notificationBadge.style.display = 'none'; // No announcements, hide badge
        }
    }, (error) => {
         console.error("Error checking new announcements:", error);
         notificationBadge.style.display = 'none'; // Hide badge on error
    });
    // Consider returning unsubscribe if you need to detach the listener later
}

async function renderUserNotifications() {
    // Render the list of announcements for the user in the notifications sheet
    notificationsListContainer.innerHTML = '<p style="text-align: center; padding: 15px;">...بارکردن</p>'; // Loading state
    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(30)); // Limit displayed notifications
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Clear loading state
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            localStorage.removeItem('lastSeenAnnouncementTimestamp'); // Clear timestamp if no notifications
            notificationBadge.style.display = 'none';
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt; // Find the timestamp of the newest one displayed
            }

            const date = new Date(announcement.createdAt);
            // Format date as YYYY/MM/DD
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

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

        // Update last seen timestamp only if new notifications were actually loaded
        if (latestTimestamp > 0) {
            localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        }
        notificationBadge.style.display = 'none'; // Hide badge after viewing

    } catch(error) {
         console.error("Error rendering user notifications:", error);
         notificationsListContainer.innerHTML = `<p style="text-align: center; padding: 15px;">${t('error_generic')}</p>`;
         notificationBadge.style.display = 'none'; // Hide badge on error
    }
}

async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Get content in current language, fallback to Sorani, then empty string
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Render content, replacing newlines with <br> for HTML display
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn?.querySelector('span'); // Use optional chaining

    if (!getLocationBtn || !profileAddressInput || !btnSpan) return; // Exit if elements not found

    const originalBtnText = btnSpan.textContent;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success callback
                const { latitude, longitude } = position.coords;
                try {
                    // Using Nominatim for reverse geocoding (OpenStreetMap data)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('ناونیشان وەرگیرا', 'success');
                    } else {
                         // Fallback if display_name is missing
                         profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
                         showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە، تەنها کۆردینات دانرا.', 'warning');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                     profileAddressInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
                    showNotification('هەڵەیەک لە وەرگرتنی ناوی ناونیشان ڕوویدا، تەنها کۆردینات دانرا.', 'error');
                } finally {
                    btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error callback
                let message = t('error_generic'); // Default error message
                switch (error.code) {
                    case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                    case error.POSITION_UNAVAILABLE: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                    case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                }
                showNotification(message, 'error');
                btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 } // Geolocation options
        );
    });
}
// Infinite scroll observer setup
function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) {
        console.warn("Scroll trigger element not found.");
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        // Trigger loading more only if:
        // 1. The trigger element is intersecting (visible)
        // 2. We are not already loading more products
        // 3. Not all products have already been loaded
        // 4. We are currently on the main page (avoid triggering on other pages)
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded && document.getElementById('mainPage').classList.contains('page-active')) {
             // console.log("Scroll trigger intersected, loading more products...");
             searchProductsInFirestore(state.currentSearch, false); // Fetch next page (false means append)
        }
    }, {
        root: null, // Use the viewport as the root
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(trigger);
}

// Function to show welcome message on first visit
function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal'); // openPopup handles history state
        localStorage.setItem('hasVisited', 'true');
    }
}

// Force update function
async function forceUpdate() {
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
            // Clear local storage related to the app (use with caution!)
            // localStorage.removeItem(CART_KEY);
            // localStorage.removeItem(FAVORITES_KEY);
            // localStorage.removeItem(PROFILE_KEY);
            // localStorage.removeItem('language');
            // localStorage.removeItem('lastSeenAnnouncementTimestamp');
            // localStorage.removeItem('hasVisited');
            // console.log('App local storage cleared.');

            showNotification(t('update_success'), 'success');
            // Reload the page from the server
            setTimeout(() => window.location.reload(true), 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


// --- Keep the Auth State Change Listener ---
onAuthStateChanged(auth, async (user) => {
    // !! IMPORTANT: Double-check this Admin UID from your Firebase project !!
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    const isAdmin = user && user.uid === adminUID;

    if (isAdmin) {
        sessionStorage.setItem('isAdmin', 'true'); // Use sessionStorage for session-only admin status
        if (window.AdminLogic && typeof window.AdminLogic.initialize === 'function') {
            // Ensure DOM is ready before initializing admin logic
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                window.AdminLogic.initialize();
            } else {
                // Defer initialization until DOM is loaded
                document.addEventListener('DOMContentLoaded', window.AdminLogic.initialize, { once: true });
            }
        } else {
            console.warn("AdminLogic not found or initialize function missing.");
        }
         // Close login modal automatically if it was open
        if (document.getElementById('loginModal').style.display === 'block') {
             closeCurrentPopup();
        }
    } else {
        sessionStorage.removeItem('isAdmin'); // Clear admin status
        if (user) {
            // If a non-admin user is somehow signed in, sign them out.
            await signOut(auth);
            console.log("Non-admin user automatically signed out.");
        }
        // Deinitialize admin UI if the logic is loaded
        if (window.AdminLogic && typeof window.AdminLogic.deinitialize === 'function') {
            window.AdminLogic.deinitialize();
        }
    }

    // Update general UI based on admin status (e.g., show/hide admin buttons on cards)
    // This needs to happen regardless of whether AdminLogic is fully loaded yet
    document.querySelectorAll('.product-actions').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
     document.getElementById('addProductBtn').style.display = isAdmin ? 'flex' : 'none';
     document.getElementById('settingsLogoutBtn').style.display = isAdmin ? 'flex' : 'none';
     document.getElementById('settingsAdminLoginBtn').style.display = isAdmin ? 'none' : 'flex';

     // Hide admin-specific sections in settings if not admin
      const adminSections = [
         'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
         'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
         'adminContactMethodsManagement', 'adminShortcutRowsManagement',
         'adminHomeLayoutManagement'
     ];
     adminSections.forEach(id => {
         const section = document.getElementById(id);
         if (section) section.style.display = isAdmin ? 'block' : 'none';
     });

}); // End onAuthStateChanged

// --- Ensure Global Tools Exposure is present ---
Object.assign(window.globalAdminTools, {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, startAfter, runTransaction, // Added startAfter
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Added shortcutRowsCollection
    clearProductCache,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    // Expose necessary rendering functions if admin needs them (use with caution)
    // populateSubcategoriesDropdown: AdminLogic.populateSubcategoriesDropdown,
    // populateSubSubcategoriesDropdown: AdminLogic.populateSubSubcategoriesDropdown,
});