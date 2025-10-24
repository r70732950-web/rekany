// app-ui.js: UI rendering, DOM manipulation, event listeners (Fixed Errors v2)

import {
    state, // Import state for UI updates
    t, // Import translation function
    // Import Core functions needed by UI event listeners
    saveCurrentScrollPosition,
    applyFilterState,
    navigateToFilter,
    showProductDetailsWithData, // Use the core function directly now
    fetchSubcategories,
    fetchSubSubcategories,
    fetchProductsForDetailPage,
    fetchAnnouncementsForSheet,
    fetchPolicies,
    addToCart,
    toggleFavorite,
    updateQuantity,
    removeFromCart,
    generateOrderMessage,
    requestNotificationPermission,
    triggerInstallPrompt,
    skipWaiting,
    forceUpdate,
    fetchRelatedProducts,
    fetchAnnouncementsForSheet // Make sure this is imported
} from './app-core.js'; // Import from the new core file

// DOM Elements (assuming they are correctly defined in app-setup.js and exported)
// We might not need to import *all* DOM elements here, only those directly manipulated
import {
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer,
    // Add elements used in UI functions if not already present
    homePageSectionsContainer, scrollLoaderTrigger, welcomeModal, updateNotification, updateNowBtn,
    mainCategoriesContainer, subcategoriesContainer, dynamicContactLinksContainer,
    // Header elements
    appHeader, // Make sure appHeader is exported from setup
    // Subpage elements
    subcategoryDetailPage, subSubCategoryContainerOnDetailPage, productsContainerOnDetailPage, detailPageLoader,
    subpageSearchInput, subpageClearSearchBtn,
    // Detail Sheet elements
    productDetailSheet, sheetProductName, sheetImageContainer, sheetThumbnailContainer,
    sheetPrevBtn, sheetNextBtn, sheetProductPrice, sheetProductDescription, sheetAddToCartBtn,
    relatedProductsSection, relatedProductsContainer,
    // Profile Sheet elements
    profileName, profileAddress, profilePhone, getLocationBtn,
    // Settings elements
    installAppBtn, enableNotificationsBtn, forceUpdateBtn
} from './app-setup.js';


// UI specific state or variables can go here if needed
const AppUI = {

    // --- Page Navigation & View Management ---

    /**
     * Shows a specific page and hides others. Updates header and active nav button.
     * @param {string} pageId The ID of the page to show.
     * @param {string} [pageTitle=''] Optional title for subpages.
     */
    showPage: function(pageId, pageTitle = '') {
        document.querySelectorAll('.page').forEach(page => {
            const isActive = page.id === pageId;
            page.classList.toggle('page-active', isActive);
            page.classList.toggle('page-hidden', !isActive);
        });

        // Scroll to top only for non-main pages navigated to programmatically
        // Scroll restoration for main page handled in applyFilterState
        if (pageId !== 'mainPage' && !history.state?.scroll) { // Check if it's not a popstate navigation with scroll
             window.scrollTo({top: 0, behavior: 'auto'}); // Use 'auto' for instant jump
        }

        // Update header based on the active page
        this.updateHeaderView(pageId, pageTitle);

        // Update active bottom navigation button
        const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
        if (activeBtnId) {
            this.updateActiveNav(activeBtnId);
        } else {
             // If navigating to a page without a dedicated nav button (like detail), ensure no button is active
             this.updateActiveNav(null);
        }
    },

    /**
     * Updates the header appearance based on the current page.
     * @param {string} pageId The ID of the current page ('mainPage', 'settingsPage', 'subcategoryDetailPage', etc.)
     * @param {string} [title=''] The title to display for subpages.
     */
    updateHeaderView: function(pageId, title = '') {
        const mainHeader = document.querySelector('.main-header-content');
        const subpageHeader = document.querySelector('.subpage-header-content');
        const headerTitleEl = document.getElementById('headerTitle'); // Renamed to avoid conflict

        if (!mainHeader || !subpageHeader || !headerTitleEl) {
            console.error("Header elements not found!");
            return;
        }

        if (pageId === 'mainPage') {
            mainHeader.style.display = 'flex';
            subpageHeader.style.display = 'none';
        } else {
            mainHeader.style.display = 'none';
            subpageHeader.style.display = 'flex';
            headerTitleEl.textContent = title || ''; // Ensure title is set
        }
    },

    /**
     * Updates the active state of the bottom navigation buttons.
     * @param {string|null} activeBtnId The ID of the button to activate, or null to deactivate all.
     */
    updateActiveNav: function(activeBtnId) {
        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.id === activeBtnId);
        });
    },

    // --- Popups (Modals & Sheets) ---

    /** Closes all currently open modals and bottom sheets. */
    closeAllPopupsUI: function() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        document.querySelectorAll('.bottom-sheet.show').forEach(sheet => sheet.classList.remove('show'));
        if (sheetOverlay) sheetOverlay.classList.remove('show');
        document.body.classList.remove('overlay-active');
    },

    /**
     * Opens a specific modal or bottom sheet. Handles history state.
     * @param {string} id The ID of the element to open.
     * @param {'sheet'|'modal'} [type='sheet'] The type of popup.
     */
    openPopup: function(id, type = 'sheet') {
        saveCurrentScrollPosition(); // Save scroll before opening
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element with ID "${id}" not found for popup.`);
            return;
        }

        this.closeAllPopupsUI(); // Close any existing popups first

        if (type === 'sheet') {
            if (sheetOverlay) sheetOverlay.classList.add('show');
            element.classList.add('show');
            // Load content specific to the sheet being opened
            if (id === 'cartSheet') this.renderCart();
            if (id === 'favoritesSheet') this.renderFavoritesPage(); // Fetch and render favorites
            if (id === 'categoriesSheet') this.renderCategoriesSheet();
            if (id === 'notificationsSheet') fetchAnnouncementsForSheet(); // Fetch data via core function
            if (id === 'termsSheet') fetchPolicies(); // Fetch data via core function
            if (id === 'profileSheet') this.populateProfileForm(); // Populate form from state
        } else { // Modal
            element.style.display = 'block';
        }

        document.body.classList.add('overlay-active');
        // Push state *after* potentially closing others
        try {
             history.pushState({ type: type, id: id }, '', `#${id}`);
        } catch(e) {
             console.warn("Could not push popup history state:", e);
        }
    },

    /** Closes the currently active popup by simulating a back navigation or directly closing. */
    closeCurrentPopup: function() {
        // Check history state first
        if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
            history.back(); // Let popstate handle closing
        } else {
            this.closeAllPopupsUI(); // Fallback if no history state found
        }
    },

    /** Checks if a specific modal is currently open. */
     isModalOpen: function(modalId) {
         const modal = document.getElementById(modalId);
         return modal && modal.style.display === 'block';
     },


    // --- Notifications & Indicators ---

    /**
     * Shows a temporary notification message.
     * @param {string} message The message text.
     * @param {'success'|'error'} [type='success'] The type of notification.
     */
    showNotification: function(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        // Trigger transition
        setTimeout(() => notification.classList.add('show'), 10);
        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            // Remove from DOM after transition ends
            setTimeout(() => {
                if (document.body.contains(notification)) {
                     document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    /** Shows or hides the main loading spinner. */
    showLoadingIndicator: function(show) {
        if (loader) loader.style.display = show ? 'block' : 'none';
        // Hide skeleton loader when real loader hides (or content appears)
         if (!show && skeletonLoader) skeletonLoader.style.display = 'none';
    },

    /** Shows or hides the notification badge on the bell icon. */
     updateNotificationBadge: function(show) {
         if (notificationBadge) notificationBadge.style.display = show ? 'block' : 'none';
     },

     /** Shows or hides the PWA install button in settings. */
     showInstallButton: function(show) {
         if (installAppBtn) installAppBtn.style.display = show ? 'flex' : 'none';
     },

     /** Shows or hides the service worker update notification bar. */
     showUpdateNotification: function(show) {
         if (updateNotification) {
             updateNotification.classList.toggle('show', show);
         }
     },

    // --- Product Rendering ---

    /** Creates the HTML structure for a single product card. */
    createProductCardElement: function(product) {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.dataset.productId = product.id;
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check current admin status

        // Use helper function to get localized name
        const nameInCurrentLang = this.getLocalizedText(product.name);
        const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

        // Price and Discount Badge
        let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
        let discountBadgeHTML = '';
        const hasDiscount = product.originalPrice && product.originalPrice > product.price;
        if (hasDiscount) {
            priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
            const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
            discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
        }

        // Shipping Info Badge
        let extraInfoHTML = '';
        const shippingText = this.getLocalizedText(product.shippingInfo); // Use helper
         if (shippingText && shippingText.trim()) {
            extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText.trim()}</div></div>`;
        }

        // Favorite Button Status
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

        // --- Add Event Listeners Directly ---
        const addToCartButton = productCard.querySelector('.add-to-cart-btn-card');
        const editButton = productCard.querySelector('.edit-btn');
        const deleteButton = productCard.querySelector('.delete-btn');
        const favoriteButton = productCard.querySelector('.favorite-btn');
        const shareButton = productCard.querySelector('.share-btn-card');

        // Add to Cart
        if (addToCartButton) {
            addToCartButton.addEventListener('click', (event) => {
                event.stopPropagation();
                addToCart(product.id); // Call core function
                // Button feedback animation
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
            });
        }

        // Edit (Admin only)
        if (editButton) {
            editButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.editProduct) {
                    window.AdminLogic.editProduct(product.id);
                }
            });
        }

        // Delete (Admin only)
        if (deleteButton) {
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.deleteProduct) {
                    window.AdminLogic.deleteProduct(product.id);
                }
            });
        }

        // Favorite
        if (favoriteButton) {
            favoriteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleFavorite(product.id); // Call core function
            });
        }

        // Share
        if (shareButton) {
             shareButton.addEventListener('click', async (event) => {
                 event.stopPropagation();
                 this.handleShare(product); // Use a dedicated UI helper for share logic
             });
        }

        // Click on card itself (to show details)
        productCard.addEventListener('click', () => {
             // Pass the full product object from the current scope
            showProductDetailsWithData(product); // Call core function
        });

        return productCard;
    },

    /** Renders skeleton loading placeholders. */
    renderSkeletonLoader: function(container = skeletonLoader, count = 8) {
        if (!container) return;
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
        container.style.display = 'grid';
        // Ensure products container is hidden when skeleton is shown
        if (productsContainer) productsContainer.style.display = 'none';
        // Hide spinner loader when skeleton is shown
        if (loader) loader.style.display = 'none';
    },

    /** Renders the fetched products list. */
     renderFetchedProducts: function() {
        if (!productsContainer) return;
        productsContainer.innerHTML = ''; // Clear previous products or loading message

        if (state.products.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = this.createProductCardElement(item);
                // element.classList.add('product-card-reveal'); // Add class for potential animation
                productsContainer.appendChild(element);
            });
            // setupScrollAnimations(); // Setup animations after rendering
        }

        // Hide skeleton and show products container
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
        // Show/hide scroll trigger based on whether all products are loaded
        if (scrollLoaderTrigger) scrollLoaderTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
    },

    /** Displays products from cache. */
    displayCachedProducts: function() {
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (productsContainer) productsContainer.style.display = 'grid';
        this.renderFetchedProducts(); // Reuse the rendering function
         if (scrollLoaderTrigger) scrollLoaderTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
    },

    /** Shows skeleton loader for a new search/filter action. */
    showSkeletonForNewSearch: function() {
        this.renderSkeletonLoader();
    },

    /** Shows an error message in the products container. */
    showFetchingError: function() {
        if (productsContainer) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
            productsContainer.style.display = 'grid'; // Ensure container is visible
        }
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (scrollLoaderTrigger) scrollLoaderTrigger.style.display = 'none';
    },

    // --- Home Page Sections Rendering ---

    /** Prepares the UI for showing the home page sections (shows container, hides products, shows skeleton). */
    prepareHomePageView: function() {
        if (productsContainer) productsContainer.style.display = 'none';
        if (scrollLoaderTrigger) scrollLoaderTrigger.style.display = 'none';
        if (homePageSectionsContainer) {
            homePageSectionsContainer.style.display = 'block';
            // Show skeleton loader within the home sections container initially
            this.renderSkeletonLoader(homePageSectionsContainer, 4);
        }
        // Stop any active sliders (handled by hideHomePageSectionsAndStopSliders called before this usually)
        this.stopAllPromoSliders();
    },

     /** Clears home page content and stops sliders. */
     clearHomePageContent: function() {
         if (homePageSectionsContainer) homePageSectionsContainer.innerHTML = '';
         this.stopAllPromoSliders();
         state.sliderIntervals = {}; // Reset intervals object
     },

     /** Shows a message when the home page is empty. */
     showEmptyHomePageMessage: function(message = "هیچ بەشێک بۆ پەڕەی سەرەکی دانەنراوە.") {
         if (homePageSectionsContainer) {
             homePageSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${message}</p>`;
             homePageSectionsContainer.style.display = 'block';
         }
         if (productsContainer) productsContainer.style.display = 'none';
         if (skeletonLoader) skeletonLoader.style.display = 'none';
         if (loader) loader.style.display = 'none';
         if (scrollLoaderTrigger) scrollLoaderTrigger.style.display = 'none';
         this.stopAllPromoSliders();
     },


    /** Hides the home sections container and stops sliders. */
    hideHomePageSectionsAndStopSliders: function() {
        if (homePageSectionsContainer) homePageSectionsContainer.style.display = 'none';
        this.stopAllPromoSliders();
    },

    /** Stops all currently running promo slider intervals. */
    stopAllPromoSliders: function() {
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
                 // console.log(`Cleared interval for slider ${layoutId}`);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
    },

    /** Renders a promo card slider section. */
    renderPromoCardsSectionUI: function(sectionData, layoutId, container) {
        if (!sectionData || !sectionData.cards || sectionData.cards.length === 0 || !container) return;

        const promoGrid = document.createElement('div');
        promoGrid.className = 'products-container promo-slider-section'; // Add specific class
        promoGrid.style.marginBottom = '24px';
        promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

        const sliderState = { currentIndex: 0, intervalId: null };

        const promoCardElement = this.createPromoCardSliderElement(sectionData, sliderState); // Use a new helper
        promoGrid.appendChild(promoCardElement);
        container.appendChild(promoGrid); // Append to the main home sections container

        // Start automatic rotation if more than one card
        if (sectionData.cards.length > 1) {
            const rotate = () => {
                // Check if the element still exists and the interval is still registered
                if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                    if (sliderState.intervalId) {
                        clearInterval(sliderState.intervalId);
                        // Ensure it's removed from global state if it somehow still exists
                        if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                           delete state.sliderIntervals[layoutId];
                        }
                    }
                    return; // Stop rotation if element is gone or interval deregistered
                }

                sliderState.currentIndex = (sliderState.currentIndex + 1) % sectionData.cards.length;
                const newImageUrl = this.getLocalizedText(sectionData.cards[sliderState.currentIndex].imageUrls);
                const imgElement = promoCardElement.querySelector('.product-image');
                if (imgElement) {
                    // Optional: Add transition effect
                    imgElement.style.opacity = '0';
                    setTimeout(() => {
                        imgElement.src = newImageUrl;
                        imgElement.style.opacity = '1';
                    }, 200); // Short delay for fade effect
                }
            };

            // Clear any previous interval for this specific layoutId before starting new
            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }

            sliderState.intervalId = setInterval(rotate, 5000); // 5 second rotation
            // Store the interval ID in the global state, keyed by the unique layout ID
            if (!state.sliderIntervals) state.sliderIntervals = {};
            state.sliderIntervals[layoutId] = sliderState.intervalId;
            // console.log(`Started interval ${sliderState.intervalId} for slider ${layoutId}`);
        }
    },

    /** Helper to create the promo card slider element structure and attach listeners. */
    createPromoCardSliderElement: function(cardData, sliderState) {
        const promoCardElement = document.createElement('div');
        promoCardElement.className = 'product-card promo-card-grid-item'; // Use existing styles where possible
        const currentCard = cardData.cards[sliderState.currentIndex];
        const imageUrl = this.getLocalizedText(currentCard.imageUrls);

        promoCardElement.innerHTML = `
            <div class="product-image-container" style="aspect-ratio: auto; height: 100%;">
                <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion" style="object-fit: cover; padding: 0; transition: opacity 0.2s ease-in-out;">
            </div>
            ${cardData.cards.length > 1 ? `
            <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
        `;

        // Click on the card itself (navigate)
        promoCardElement.addEventListener('click', (e) => {
            if (!e.target.closest('button')) { // Ignore clicks on buttons
                const targetCategoryId = currentCard.categoryId;
                 // Use core navigate function
                if (targetCategoryId) {
                    navigateToFilter({
                        category: targetCategoryId,
                        subcategory: 'all', subSubcategory: 'all', search: ''
                    });
                     // Optional: Scroll to categories after navigation (might be jarring)
                     // document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

        // Add listeners for Prev/Next buttons if they exist
        if (cardData.cards.length > 1) {
            const imgElement = promoCardElement.querySelector('.product-image');
            const prevBtn = promoCardElement.querySelector('.promo-slider-btn.prev');
            const nextBtn = promoCardElement.querySelector('.promo-slider-btn.next');

            const updateImage = (newIndex) => {
                 sliderState.currentIndex = newIndex;
                 const newImageUrl = this.getLocalizedText(cardData.cards[sliderState.currentIndex].imageUrls);
                 if (imgElement) {
                     imgElement.style.opacity = '0';
                     setTimeout(() => {
                         imgElement.src = newImageUrl;
                         imgElement.style.opacity = '1';
                     }, 150);
                 }
                 // Reset interval timer on manual navigation
                 const layoutId = promoCardElement.parentElement.id.split('_')[1]; // Get layoutId from parent ID
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                      clearInterval(state.sliderIntervals[layoutId]);
                      // Restart the interval logic would go here if desired, but stopping might be simpler
                      // For now, manual click stops auto-rotate for that slider instance
                      delete state.sliderIntervals[layoutId];
                      console.log(`Stopped interval for slider ${layoutId} due to manual navigation.`);
                 }
            };

            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateImage((sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length);
            });

            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                 updateImage((sliderState.currentIndex + 1) % cardData.cards.length);
            });
        }

        return promoCardElement;
    },


    /** Renders a brands section. */
    renderBrandsSectionUI: function(brandsData, container) {
         if (!brandsData || brandsData.length === 0 || !container) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'brands-section';
        const brandsContainerEl = document.createElement('div'); // Renamed variable
        brandsContainerEl.className = 'brands-container';
        sectionContainer.appendChild(brandsContainerEl);

        brandsData.forEach(brand => {
            const brandName = this.getLocalizedText(brand.name);
            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;
            item.onclick = () => {
                // Use core navigation functions
                if (brand.subcategoryId && brand.categoryId) {
                    this.showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId); // UI function to handle history etc.
                } else if (brand.categoryId) {
                    navigateToFilter({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                }
            };
            brandsContainerEl.appendChild(item);
        });
        container.appendChild(sectionContainer);
    },

    /** Renders the newest products section. */
     renderNewestProductsSectionUI: function(productsData, container) {
        if (!productsData || productsData.length === 0 || !container) return;
        this.renderHorizontalProductScroller(t('newest_products'), productsData, container, () => {
             // 'See All' action for Newest could simply apply a sort filter if available,
             // or navigate to a dedicated "New Arrivals" page if one exists.
             // For now, let's just log it or do nothing.
             console.log("See All Newest clicked - functionality TBD");
        }, false); // Don't show 'See All' for newest for now
    },

    /** Renders a single shortcut row section. */
    renderSingleShortcutRowUI: function(rowData, cardsData, container) {
         if (!rowData || !cardsData || cardsData.length === 0 || !container) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'shortcut-cards-section';
        const rowTitle = this.getLocalizedText(rowData.title);

        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainerEl = document.createElement('div'); // Renamed variable
        cardsContainerEl.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainerEl);

        cardsData.forEach(cardData => {
            const cardName = this.getLocalizedText(cardData.name);
            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;
            item.onclick = () => {
                // Use core navigation function
                navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainerEl.appendChild(item);
        });
        container.appendChild(sectionContainer);
    },

    /** Renders a single category row section. */
     renderSingleCategoryRowUI: function(sectionConfig, productsData, container) {
         if (!sectionConfig || !productsData || productsData.length === 0 || !container) return;

         const title = this.getLocalizedText(sectionConfig.name); // Get title from layout config

         const seeAllAction = () => {
             // Navigate based on the section's category/subcategory config
             if (sectionConfig.subcategoryId && sectionConfig.categoryId) {
                 this.showSubcategoryDetailPage(sectionConfig.categoryId, sectionConfig.subcategoryId);
             } else if (sectionConfig.categoryId) {
                 navigateToFilter({ category: sectionConfig.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             }
         };

         this.renderHorizontalProductScroller(title, productsData, container, seeAllAction);
    },

    /** Renders the 'all products' preview section. */
     renderAllProductsSectionUI: function(productsData, container) {
         if (!productsData || productsData.length === 0 || !container) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        sectionContainer.style.marginTop = '20px';

        const header = document.createElement('div');
        header.className = 'section-title-header';
        const title = document.createElement('h3');
        title.className = 'section-title-main';
        title.textContent = t('all_products_section_title');
        header.appendChild(title);
        // No 'See All' needed for this specific section maybe? Or link to category 'all'
        sectionContainer.appendChild(header);

        const productsGrid = document.createElement('div');
        productsGrid.className = 'products-container'; // Use grid layout
        sectionContainer.appendChild(productsGrid);

        productsData.forEach(product => {
            const card = this.createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        container.appendChild(sectionContainer);
    },

    /** Helper function to render a horizontal product scroller with title and optional 'See All'. */
    renderHorizontalProductScroller: function(title, productsData, container, seeAllAction = null, showSeeAll = true) {
        if (!productsData || productsData.length === 0 || !container) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';

        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        if (showSeeAll && seeAllAction) {
            const seeAllLink = document.createElement('a');
            seeAllLink.className = 'see-all-link';
            seeAllLink.textContent = t('see_all');
            seeAllLink.onclick = seeAllAction; // Assign the provided action
            header.appendChild(seeAllLink);
        }
        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        sectionContainer.appendChild(productsScroller);

        productsData.forEach(product => {
            const card = this.createProductCardElement(product);
            productsScroller.appendChild(card);
        });

        container.appendChild(sectionContainer);
    },


    // --- Category Rendering ---

    /** Renders the main category buttons. */
    renderMainCategories: function() {
        if (!mainCategoriesContainer) return;
        mainCategoriesContainer.innerHTML = '';
        state.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'main-category-btn';
            btn.dataset.category = cat.id;
            if (state.currentCategory === cat.id) btn.classList.add('active');

            // Use helper to get localized name, fallback to ID if needed
            const categoryName = this.getLocalizedText(cat, cat.id);

            btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`;
            btn.onclick = () => {
                // Use core navigation function
                navigateToFilter({ category: cat.id, subcategory: 'all', subSubcategory: 'all', search: '' });
            };
            mainCategoriesContainer.appendChild(btn);
        });
    },

    /** Renders subcategory buttons (usually below main categories). */
    renderSubcategoriesUI: async function(categoryId) {
        if (!subcategoriesContainer) return;
        subcategoriesContainer.innerHTML = ''; // Clear previous

        if (!categoryId || categoryId === 'all') {
            subcategoriesContainer.style.display = 'none'; // Hide if 'All' is selected
            return;
        }

        subcategoriesContainer.style.display = 'flex'; // Show container
         // Optionally show a loading state
         subcategoriesContainer.innerHTML = `<p style="padding: 10px; color: grey;">...بارکردنی جۆرە لاوەکییەکان</p>`;

        const subcats = await fetchSubcategories(categoryId); // Fetch data via core function

        subcategoriesContainer.innerHTML = ''; // Clear loading state

        if (subcats.length === 0) {
            subcategoriesContainer.style.display = 'none'; // Hide if no subcategories found
            return;
        }

        // Add 'All' button for this subcategory level
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = () => {
            // Use core navigation function
            navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Add actual subcategory buttons
        subcats.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            const subcatName = this.getLocalizedText(subcat.name);
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;
            subcatBtn.onclick = () => {
                // Navigate to the subcategory detail page using UI function
                this.showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });
    },

    /** Renders the category list inside the bottom sheet. */
    renderCategoriesSheet: function() {
        if (!sheetCategoriesContainer) return;
        sheetCategoriesContainer.innerHTML = ''; // Clear previous
        state.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'sheet-category-btn';
            btn.dataset.category = cat.id;
            if (state.currentCategory === cat.id) btn.classList.add('active');
            const categoryName = this.getLocalizedText(cat, cat.id === 'all' ? t('all_categories_label') : cat.id); // Use helper
            btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;
            btn.onclick = () => {
                // Use core navigation function
                navigateToFilter({ category: cat.id, subcategory: 'all', subSubcategory: 'all', search: '' });
                this.closeCurrentPopup(); // Close sheet after selection
                this.showPage('mainPage'); // Ensure main page is shown
            };
            sheetCategoriesContainer.appendChild(btn);
        });
    },

     /** Updates all UI elements that depend on category data. */
     updateCategoryDependentUI: function() {
        if (state.categories.length === 0) return; // Wait until categories are loaded
        this.renderMainCategories();
        this.renderCategoriesSheet(); // Update sheet content
        this.renderSubcategoriesUI(state.currentCategory); // Render subcategories based on current state
        // Update admin dropdowns only if admin logic is loaded and user is admin
        if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic?.updateAdminCategoryDropdowns) {
            window.AdminLogic.updateAdminCategoryDropdowns();
            window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update shortcut card dropdowns too
        }
    },

    // --- Subcategory Detail Page ---

    /** Shows the subcategory detail page and loads its content. */
     showSubcategoryDetailPage: async function(mainCatId, subCatId, fromHistory = false) {
        let subCatName = 'Details'; // Default title
         try {
             // Fetch subcategory name for the title (can potentially be cached)
             const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
             const subCatSnap = await getDoc(subCatRef);
             if (subCatSnap.exists()) {
                 subCatName = this.getLocalizedText(subCatSnap.data().name) || subCatName;
             }
         } catch (e) { console.error("Could not fetch subcategory name:", e); }

         // Update history only if not triggered by popstate
         if (!fromHistory) {
             try {
                history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
             } catch(e) { console.warn("Could not push detail page history:", e); }
         }

         this.showPage('subcategoryDetailPage', subCatName); // Show the page UI

         if (!detailPageLoader || !productsContainerOnDetailPage || !subSubCategoryContainerOnDetailPage) return;

         // Show loader and clear previous content
         detailPageLoader.style.display = 'block';
         productsContainerOnDetailPage.innerHTML = '';
         subSubCategoryContainerOnDetailPage.innerHTML = '';
         if(subpageSearchInput) subpageSearchInput.value = ''; // Reset search
         if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';

         // Fetch and render sub-subcategories and products for this page
         await this.renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
         await this.renderProductsOnDetailPage(subCatId, 'all', ''); // Initial load (all sub-subs, no search)

         detailPageLoader.style.display = 'none'; // Hide loader
    },

     /** Renders the sub-subcategory filter buttons on the detail page. */
     renderSubSubcategoriesOnDetailPage: async function(mainCatId, subCatId) {
         if (!subSubCategoryContainerOnDetailPage) return;
         subSubCategoryContainerOnDetailPage.innerHTML = ''; // Clear previous

         const subSubcats = await fetchSubSubcategories(mainCatId, subCatId); // Fetch via core

         if (subSubcats.length === 0) {
             subSubCategoryContainerOnDetailPage.style.display = 'none'; // Hide if none
             return;
         }

         subSubCategoryContainerOnDetailPage.style.display = 'flex'; // Show container

         // Add 'All' button
         const allBtn = document.createElement('button');
         allBtn.className = `subcategory-btn active`; // Active by default
         const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
         allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
         allBtn.dataset.id = 'all';
         allBtn.onclick = () => {
             subSubCategoryContainerOnDetailPage.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
             allBtn.classList.add('active');
             const currentSearch = subpageSearchInput ? subpageSearchInput.value : '';
             this.renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Render 'all' products
         };
         subSubCategoryContainerOnDetailPage.appendChild(allBtn);

         // Add actual sub-subcategory buttons
         subSubcats.forEach(subSubcat => {
             const btn = document.createElement('button');
             btn.className = `subcategory-btn`;
             btn.dataset.id = subSubcat.id;
             const subSubcatName = this.getLocalizedText(subSubcat.name);
             const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
             const imageUrl = subSubcat.imageUrl || placeholderImg;
             btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;
             btn.onclick = () => {
                 subSubCategoryContainerOnDetailPage.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                 btn.classList.add('active');
                 const currentSearch = subpageSearchInput ? subpageSearchInput.value : '';
                 this.renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Render products for this sub-sub
             };
             subSubCategoryContainerOnDetailPage.appendChild(btn);
         });
     },

     /** Renders products on the subcategory detail page based on filters. */
     renderProductsOnDetailPage: async function(subCatId, subSubCatId = 'all', searchTerm = '') {
         if (!productsContainerOnDetailPage || !detailPageLoader) return;
         detailPageLoader.style.display = 'block'; // Show loader
         productsContainerOnDetailPage.innerHTML = ''; // Clear previous

         const products = await fetchProductsForDetailPage(subCatId, subSubCatId, searchTerm); // Fetch via core

         if (products.length === 0) {
             productsContainerOnDetailPage.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
         } else {
             products.forEach(product => {
                 const card = this.createProductCardElement(product); // Reuse card creation
                 productsContainerOnDetailPage.appendChild(card);
             });
         }
         detailPageLoader.style.display = 'none'; // Hide loader
     },


    // --- Cart UI ---

    /** Updates the cart item count display in the navigation. */
    updateCartCount: function() {
        const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = totalItems;
            // Optional: Add animation/highlight on change
        });
    },

    /** Renders the content of the cart bottom sheet. */
    renderCart: function() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = ''; // Clear previous items

        if (state.cart.length === 0) {
            if (emptyCartMessage) emptyCartMessage.style.display = 'block';
            if (cartTotal) cartTotal.style.display = 'none';
            if (cartActions) cartActions.style.display = 'none';
            return;
        }

        if (emptyCartMessage) emptyCartMessage.style.display = 'none';
        if (cartTotal) cartTotal.style.display = 'block';
        if (cartActions) cartActions.style.display = 'block';
        this.updateCartActionButtons(); // Render action buttons

        let total = 0;
        state.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            const itemName = this.getLocalizedText(item.name); // Use helper
            cartItem.innerHTML = `
                <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemName}" class="cart-item-image">
                <div class="cart-item-details">
                    <div class="cart-item-title">${itemName}</div>
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

        if (totalAmount) totalAmount.textContent = total.toLocaleString();

        // Add event listeners for quantity buttons and remove button
        cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
        cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
        cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
    },

    /** Renders the action buttons (WhatsApp, Viber, etc.) in the cart. */
    updateCartActionButtons: function() {
        if (!cartActions) return;
        cartActions.innerHTML = ''; // Clear previous

        if (!state.contactMethods || state.contactMethods.length === 0) {
            cartActions.innerHTML = '<p style="text-align:center; color: var(--dark-gray);">هیچ ڕێگایەکی ناردنی داواکاری دیاری نەکراوە.</p>';
            return;
        }

        state.contactMethods.forEach(method => {
            const btn = document.createElement('button');
            // Use a generic class and rely on inline style for color
            btn.className = 'whatsapp-btn'; // Reusing class for styling consistency
            btn.style.backgroundColor = method.color || '#ccc'; // Use defined color or fallback
            const name = this.getLocalizedText(method.name); // Use helper
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`;

            btn.onclick = () => {
                const message = generateOrderMessage(); // Get message from core
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value;

                switch (method.type) {
                    case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                    case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // May need testing
                    case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                    case 'phone': link = `tel:${value}`; break; // No message prefill for phone
                    case 'url': link = value; break; // Assume full URL is provided
                }

                if (link) {
                    window.open(link, '_blank');
                     // Optionally clear cart after sending?
                     // state.cart = []; saveCart(); this.renderCart();
                } else {
                     this.showNotification(`نەتوانرا لینکی ${method.type} دروست بکرێت`, 'error');
                }
            };
            cartActions.appendChild(btn);
        });
    },

    // --- Favorites UI ---

    /** Renders the content of the favorites bottom sheet. */
     renderFavoritesPage: async function() {
        if (!favoritesContainer || !emptyFavoritesMessage) return;
        favoritesContainer.innerHTML = ''; // Clear previous

        if (state.favorites.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            return;
        }

        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';
        this.renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while fetching

        try {
             // Fetch only favorite products by ID
             const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
             const productSnaps = await Promise.all(fetchPromises);
             const favoritedProducts = productSnaps
                .filter(snap => snap.exists())
                .map(snap => ({ id: snap.id, ...snap.data() }));

            favoritesContainer.innerHTML = ''; // Clear skeleton

            if (favoritedProducts.length === 0) {
                 // This might happen if favorited products were deleted
                emptyFavoritesMessage.style.display = 'block';
                favoritesContainer.style.display = 'none';
            } else {
                favoritedProducts.forEach(product => {
                    const productCard = this.createProductCardElement(product); // Reuse card creation
                    favoritesContainer.appendChild(productCard);
                });
            }
        } catch (error) {
            console.error("Error fetching favorites:", error);
            favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
        }
    },

    /** Updates favorite button appearance on all cards for a given product ID. */
     updateFavoriteButtons: function(productId, isNowFavorite) {
        document.querySelectorAll(`.product-card[data-product-id="${productId}"]`).forEach(card => {
            const favButton = card.querySelector('.favorite-btn');
            const heartIcon = card.querySelector('.fa-heart');
            if (favButton && heartIcon) {
                favButton.classList.toggle('favorited', isNowFavorite);
                heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart if favorite
                heartIcon.classList.toggle('far', !isNowFavorite); // Outline heart if not
            }
        });
    },

    /** Re-renders the favorites page if it's currently open. */
     updateFavoritesPageIfOpen: function() {
        if (favoritesSheet && favoritesSheet.classList.contains('show')) {
            this.renderFavoritesPage();
        }
    },


    // --- Other UI ---

    /** Populates the profile form with data from the state. */
    populateProfileForm: function() {
        if (profileForm) {
            if (profileName) profileName.value = state.userProfile.name || '';
            if (profileAddress) profileAddress.value = state.userProfile.address || '';
            if (profilePhone) profilePhone.value = state.userProfile.phone || '';
        }
    },

     /** Renders the list of announcements in the notification sheet. */
     renderUserNotifications: function(announcements) {
         if (!notificationsListContainer) return;
         notificationsListContainer.innerHTML = ''; // Clear previous

         if (!announcements || announcements.length === 0) {
             notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
             return;
         }

         announcements.forEach(announcement => {
             const date = new Date(announcement.createdAt);
             // Format date as YYYY/MM/DD (adjust locale or format as needed)
             const formattedDate = date.toLocaleDateString('en-CA'); // Example: 2023-10-27

             const title = this.getLocalizedText(announcement.title); // Use helper
             const content = this.getLocalizedText(announcement.content); // Use helper

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
     },

     /** Renders the policies content in the terms sheet. */
     renderPoliciesSheet: function(policiesContent, isError = false) {
         if (!termsContentContainer) return;

         if (isError) {
             termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
             return;
         }

         if (policiesContent) {
             const content = this.getLocalizedText(policiesContent); // Use helper
             termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
         } else {
             termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
         }
     },

     /** Renders the contact links in the settings page. */
     renderContactLinks: function(links) {
         if (!dynamicContactLinksContainer) return;
         dynamicContactLinksContainer.innerHTML = ''; // Clear previous

         if (!links || links.length === 0) {
             dynamicContactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
             return;
         }

         links.forEach(link => {
             const name = this.getLocalizedText(link.name); // Use helper
             const linkElement = document.createElement('a');
             linkElement.href = link.url;
             linkElement.target = '_blank';
             linkElement.className = 'settings-item';
             linkElement.innerHTML = `
                 <div>
                     <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                     <span>${name}</span>
                 </div>
                 <i class="fas fa-external-link-alt"></i>
             `;
             dynamicContactLinksContainer.appendChild(linkElement);
         });
     },


    /** Updates UI elements specific to admin status. */
    updateAdminSpecificUI: function(isAdmin) {
        // Toggle visibility of admin-only buttons on product cards
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        // Toggle visibility of admin sections in settings
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

        // Toggle Add Product button and Login/Logout buttons
        if (settingsLogoutBtn) settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
        if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
        if (addProductBtn) addProductBtn.style.display = isAdmin ? 'flex' : 'none';

         // Re-render category UI to update admin-specific parts if needed
         if (isAdmin && window.AdminLogic?.updateAdminCategoryDropdowns) {
            window.AdminLogic.updateAdminCategoryDropdowns();
            window.AdminLogic.updateShortcutCardCategoryDropdowns();
         }
    },

    /** Updates the UI related to filters (search input, category buttons). */
    updateFilterUI: function() {
        // Update search input value and clear button visibility
        if (searchInput) {
            searchInput.value = state.currentSearch;
             if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';
        }
        // Update active state of main category buttons
        if (mainCategoriesContainer) {
             mainCategoriesContainer.querySelectorAll('.main-category-btn').forEach(btn => {
                 btn.classList.toggle('active', btn.dataset.category === state.currentCategory);
             });
        }
        // Update active state of subcategory buttons (if visible)
        if (subcategoriesContainer && subcategoriesContainer.style.display !== 'none') {
             subcategoriesContainer.querySelectorAll('.subcategory-btn').forEach(btn => {
                 // Check data-id for subcategories (might need adjustment if using different attribute)
                 btn.classList.toggle('active', btn.dataset.id === state.currentSubcategory);
             });
        }
         // Update active state of sheet category buttons
         if (sheetCategoriesContainer) {
              sheetCategoriesContainer.querySelectorAll('.sheet-category-btn').forEach(btn => {
                 btn.classList.toggle('active', btn.dataset.category === state.currentCategory);
              });
         }
        // Trigger rendering of subcategories based on the new main category
        this.renderSubcategoriesUI(state.currentCategory);
    },

    /** Sets the language and updates all translatable elements. */
     setLanguageUI: function(lang) {
        state.currentLanguage = lang; // Update state if needed (though core might handle this)
        localStorage.setItem('language', lang); // Persist setting

        // Update HTML attributes
        document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
        document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

        // Update elements with data-translate-key
        document.querySelectorAll('[data-translate-key]').forEach(element => {
            const key = element.dataset.translateKey;
            const translation = t(key); // Use core translation function
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder) element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update language button active state
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Re-render parts of the UI that depend heavily on language
        this.updateCategoryDependentUI(); // Re-render category names
        this.updateFilterUI(); // Ensure category buttons have correct text & active state

        // Re-render dynamic home sections if currently visible
         const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
         if (isHomeView) {
             renderDynamicHomeLayoutSections(); // Re-fetch and re-render home sections with new language
         } else {
              this.renderFetchedProducts(); // Re-render product cards with new language
         }


        // Re-render open popups if necessary
        if (cartSheet && cartSheet.classList.contains('show')) this.renderCart();
        if (favoritesSheet && favoritesSheet.classList.contains('show')) this.renderFavoritesPage();
        // Re-fetch/render notifications, policies if their sheets are open? Optional.
        if (notificationsSheet && notificationsSheet.classList.contains('show')) fetchAnnouncementsForSheet();
        if (termsSheet && termsSheet.classList.contains('show')) fetchPolicies();
    },

    /** Helper to get localized text from an object or string. */
     getLocalizedText: function(textObject, fallback = '') {
        if (typeof textObject === 'string') {
            return textObject || fallback; // Return string directly or fallback
        }
        if (typeof textObject === 'object' && textObject !== null) {
            return textObject[state.currentLanguage] || textObject['ku_sorani'] || fallback; // Prioritize current, then Sorani, then fallback
        }
        return fallback; // Return fallback if input is invalid
    },

    /** Handles the share action for a product */
     handleShare: async function(product) {
         const nameInCurrentLang = this.getLocalizedText(product.name);
         const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
         const shareData = {
             title: nameInCurrentLang,
             text: `${t('share_text')}: ${nameInCurrentLang}`, // Use translated share text
             url: productUrl,
         };
         try {
             if (navigator.share) {
                 await navigator.share(shareData);
             } else {
                 // Fallback: Copy URL to clipboard
                 const textArea = document.createElement('textarea');
                 textArea.value = productUrl;
                 document.body.appendChild(textArea);
                 textArea.select();
                 try {
                     document.execCommand('copy'); // Use older method for broader compatibility
                     this.showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                 } catch (err) {
                     this.showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
                 }
                 document.body.removeChild(textArea);
             }
         } catch (err) {
             console.error('Share error:', err);
              if (err.name !== 'AbortError') { // Don't show error if user cancelled
                  this.showNotification(t('share_error'), 'error');
              }
         }
     },

     /** Sets up all major UI event listeners. */
     setupEventListeners: function() {
        // Bottom Navigation
        if (homeBtn) homeBtn.onclick = () => {
             // If already on main page, reset filters, otherwise show main page
             if (mainPage && mainPage.classList.contains('page-active')) {
                 navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
             } else {
                 try { history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname); } catch(e) {}
                 this.showPage('mainPage');
                 // Filters will be applied by applyFilterState called within showPage->handleInitialLoad logic if needed
             }
        };
        if (categoriesBtn) categoriesBtn.onclick = () => this.openPopup('categoriesSheet');
        if (cartBtn) cartBtn.onclick = () => this.openPopup('cartSheet');
        if (profileBtn) profileBtn.onclick = () => this.openPopup('profileSheet');
        if (settingsBtn) settingsBtn.onclick = () => {
             try { history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage'); } catch(e) {}
             this.showPage('settingsPage', t('settings_title'));
        };

        // Header Back Button
        document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

        // Search Input (Main Header)
        const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500);
        if (searchInput) searchInput.oninput = () => {
            const searchTerm = searchInput.value;
            if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            debouncedSearch(searchTerm);
        };
        if (clearSearchBtn) clearSearchBtn.onclick = () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            navigateToFilter({ search: '' });
        };

         // Search Input (Subpage Header)
         const debouncedSubpageSearch = debounce(async (term) => {
             const hash = window.location.hash.substring(1);
             if (hash.startsWith('subcategory_')) {
                 const ids = hash.split('_');
                 if (ids.length >= 3) {
                     const subCatId = ids[2];
                     const activeSubSubBtn = subSubCategoryContainerOnDetailPage?.querySelector('.subcategory-btn.active');
                     const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
                     await this.renderProductsOnDetailPage(subCatId, subSubCatId, term); // Re-render products with search
                 }
             }
         }, 500);
         if (subpageSearchInput) subpageSearchInput.oninput = () => {
             const searchTerm = subpageSearchInput.value;
             if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
             debouncedSubpageSearch(searchTerm);
         };
         if (subpageClearSearchBtn) subpageClearSearchBtn.onclick = () => {
             subpageSearchInput.value = '';
             subpageClearSearchBtn.style.display = 'none';
             debouncedSubpageSearch(''); // Trigger search with empty term
         };


        // Popups Closing
        if (sheetOverlay) sheetOverlay.onclick = () => this.closeCurrentPopup();
        document.querySelectorAll('.close').forEach(btn => btn.onclick = () => this.closeCurrentPopup());
        // Close modal if clicking outside content
        window.onclick = (e) => { if (e.target.classList.contains('modal')) this.closeCurrentPopup(); };
        // Handle Escape key to close popups
        window.onkeydown = (e) => { if (e.key === 'Escape') this.closeCurrentPopup(); };

        // Settings Page Links
        if (settingsFavoritesBtn) settingsFavoritesBtn.onclick = () => this.openPopup('favoritesSheet');
        if (settingsAdminLoginBtn) settingsAdminLoginBtn.onclick = () => this.openPopup('loginModal', 'modal');
        if (termsAndPoliciesBtn) termsAndPoliciesBtn.onclick = () => this.openPopup('termsSheet');
        if (notificationBtn) notificationBtn.onclick = () => this.openPopup('notificationsSheet');

        // Contact Us Toggle
        if (contactToggle) contactToggle.onclick = () => {
            const container = document.getElementById('dynamicContactLinksContainer');
            const chevron = contactToggle.querySelector('.contact-chevron');
            container?.classList.toggle('open');
            chevron?.classList.toggle('open');
        };

        // Profile Form Submit
        if (profileForm) profileForm.onsubmit = (e) => {
            e.preventDefault();
            state.userProfile = {
                name: profileName?.value || '',
                address: profileAddress?.value || '',
                phone: profilePhone?.value || '',
            };
            saveProfile(); // Use core function to save
            this.showNotification(t('profile_saved'), 'success');
            this.closeCurrentPopup();
        };

        // Language Buttons
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.onclick = () => this.setLanguageUI(btn.dataset.lang);
        });

        // PWA Install Button
        if (installAppBtn) installAppBtn.onclick = () => triggerInstallPrompt(); // Call core function

        // Notification Permission Button
        if (enableNotificationsBtn) enableNotificationsBtn.onclick = () => requestNotificationPermission(); // Call core function

        // Force Update Button
        if (forceUpdateBtn) forceUpdateBtn.onclick = () => {
             if (confirm(t('update_confirm'))) { // Confirmation in UI layer
                 forceUpdate(); // Call core function
             }
        };

        // Update SW Button
        if (updateNowBtn) updateNowBtn.onclick = () => skipWaiting(); // Call core function

        // GPS Button in Profile
         if (getLocationBtn) this.setupGpsButtonUI(); // Setup GPS button specific UI interactions

        // Login Form Submit (Triggers core auth logic)
        if (loginForm) loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
             // Basic validation
             if (!email || !password) {
                 this.showNotification("تکایە ئیمەیڵ و وشەی نهێنی بنووسە", "error");
                 return;
             }
             const submitButton = loginForm.querySelector('button[type="submit"]');
             submitButton.disabled = true;
             submitButton.textContent = '...چاوەڕوان بە';
            try {
                // Use Firebase auth directly from core/setup
                await signInWithEmailAndPassword(auth, email, password);
                // Auth state change listener in core will handle UI updates and closing modal
            } catch (error) {
                console.error("Login Error:", error);
                 this.showNotification(t('login_error'), 'error');
                 submitButton.disabled = false;
                 submitButton.textContent = t('login_button');
            }
        };

        // Logout Button (Triggers core auth logic)
         if (settingsLogoutBtn) settingsLogoutBtn.onclick = async () => {
             try {
                 await signOut(auth); // Use Firebase auth directly
                 this.showNotification(t('logout_success'), 'success');
                 // Auth state change listener in core handles UI updates
             } catch (error) {
                  console.error("Logout Error:", error);
                  this.showNotification('هەڵە لە چوونەدەرەوە', 'error');
             }
        };

         // Infinite Scroll Setup
         this.setupScrollObserverUI();

        console.log("UI Event listeners attached.");
    },

     /** Sets up the Intersection Observer for infinite scrolling. */
     setupScrollObserverUI: function() {
        if (!scrollLoaderTrigger) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // Fetch next page via core function
                 searchProductsInFirestore(state.currentSearch, false);
            }
        }, { threshold: 0.1 });
        observer.observe(scrollLoaderTrigger);
    },

    /** Sets up UI interactions for the GPS button. */
     setupGpsButtonUI: function() {
         if (!getLocationBtn || !profileAddress) return;
         const btnSpan = getLocationBtn.querySelector('span');
         const originalBtnText = btnSpan?.textContent || '';

         getLocationBtn.addEventListener('click', () => {
             if (!('geolocation' in navigator)) {
                 this.showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
                 return;
             }
             if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
             getLocationBtn.disabled = true;

             navigator.geolocation.getCurrentPosition(
                 async (position) => { // Success
                     const { latitude, longitude } = position.coords;
                     try {
                          // Use Nominatim for reverse geocoding (consider API keys/usage limits for production)
                         const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                         const data = await response.json();
                         if (data?.display_name) {
                             profileAddress.value = data.display_name;
                             this.showNotification('ناونیشان وەرگیرا', 'success');
                         } else {
                             this.showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
                         }
                     } catch (error) {
                         console.error('Reverse Geocoding Error:', error);
                         this.showNotification('هەڵەیەک لە وەرگرتنی ناونیشان', 'error');
                     } finally {
                         if(btnSpan) btnSpan.textContent = originalBtnText;
                         getLocationBtn.disabled = false;
                     }
                 },
                 (error) => { // Error
                     let message = t('error_generic'); // Default message
                     switch (error.code) {
                         case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                         case error.POSITION_UNAVAILABLE: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                         case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                     }
                     this.showNotification(message, 'error');
                     if(btnSpan) btnSpan.textContent = originalBtnText;
                     getLocationBtn.disabled = false;
                 }
             );
         });
     },


     /** Initializes the UI layer. */
     initUI: function() {
        console.log("Initializing UI...");
        this.setupEventListeners();
        // Other UI initializations can go here
        // Example: Set initial active nav button
        this.updateActiveNav('homeBtn'); // Assume starting on home
     }

};

// Expose the AppUI object globally after defining it
window.AppUI = AppUI;

// Initialize the UI once the DOM is ready
// Note: Core logic initialization (init function in app-core.js) might still be running
// or waiting for persistence. UI setup should be safe here.
document.addEventListener('DOMContentLoaded', () => {
    // Ensure AppUI exists before initializing
     if (window.AppUI && typeof window.AppUI.initUI === 'function') {
         window.AppUI.initUI();
     } else {
         console.error("AppUI failed to initialize on DOMContentLoaded.");
     }
});

// Listener for popstate to handle browser back/forward navigation for pages and popups
window.addEventListener('popstate', async (event) => {
    AppUI.closeAllPopupsUI(); // Close any open popups first
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             // Show the correct page based on history state
             let pageTitle = popState.title || '';
             // Special handling to refetch title for detail page if needed
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         pageTitle = AppUI.getLocalizedText(subCatSnap.data().name) || 'Details';
                         // Optionally update the history state title silently
                         // history.replaceState({ ...popState, title: pageTitle }, '', window.location.href);
                     }
                 } catch(e) { console.error("Could not refetch title on popstate", e); }
             }
             AppUI.showPage(popState.id, pageTitle);

             // If navigating *back* to the main page, apply its filter state
             if (popState.id === 'mainPage') {
                 // Ensure filter state properties exist before applying
                 const filterStateToApply = {
                    category: popState.category || 'all',
                    subcategory: popState.subcategory || 'all',
                    subSubcategory: popState.subSubcategory || 'all',
                    search: popState.search || '',
                    scroll: popState.scroll // Pass the stored scroll position
                 };
                await applyFilterState(filterStateToApply, true); // True indicates it's from popstate
             } else if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                 // If navigating back/forward to detail page, re-render its content
                 await AppUI.showSubcategoryDetailPage(popState.mainCatId, popState.subCatId, true);
             }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
             // Reopen the popup based on history state
            AppUI.openPopup(popState.id, popState.type);
        } else {
             // If state has no type (assumed filter state for main page)
             AppUI.showPage('mainPage'); // Show main page UI
             await applyFilterState(popState, true); // Apply filters and scroll
        }
    } else {
         // No state, assume it's the initial state (main page, no filters)
         const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
         AppUI.showPage('mainPage');
         await applyFilterState(defaultState); // Apply default filters, scroll to top
    }
});

