// app-ui.js: UI rendering, DOM manipulation, event listeners

import {
    state,
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    // Import other needed DOM elements from app-setup
} from './app-setup.js';

import {
    t,
    saveCart, saveFavorites, saveProfile,
    isFavorite,
    searchProductsInFirestore,
    addToCart, updateQuantity, removeFromCart,
    toggleFavorite,
    requestNotificationPermission,
    triggerInstallPrompt, skipWaiting, forceUpdate,
    applyFilterState, navigateToFilter, saveCurrentScrollPosition, handleInitialPageLoad,
    fetchAnnouncementsForSheet, fetchPolicies,
    fetchSubcategories, fetchSubSubcategories, fetchProductsForDetailPage, fetchRelatedProducts
    // Import other necessary core functions
} from './app-core.js';

const AppUI = {

    // --- Notifications & Messages ---

    /**
     * Shows a notification message on the screen.
     * @param {string} message The message to display.
     * @param {'success'|'error'} [type='success'] The type of notification.
     */
    showNotification: function(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);
        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            // Remove from DOM after transition
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    /** Updates the visibility of the notification badge. */
    updateNotificationBadge: function(show) {
        notificationBadge.style.display = show ? 'block' : 'none';
    },

    /** Shows or hides the PWA update notification bar. */
    showUpdateNotification: function(show) {
        const updateNotification = document.getElementById('update-notification');
        if (updateNotification) {
            updateNotification.classList.toggle('show', show);
        }
    },

    /** Shows or hides the PWA install button. */
    showInstallButton: function(show) {
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) {
            installBtn.style.display = show ? 'flex' : 'none';
        }
    },

    // --- Popups (Modals & Sheets) ---

    /** Closes all open modals and sheets and removes the overlay. */
    closeAllPopupsUI: function() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
        sheetOverlay.classList.remove('show');
        document.body.classList.remove('overlay-active'); // Allow body scrolling
    },

    /**
     * Opens a specific modal or sheet.
     * @param {string} id The ID of the element to open.
     * @param {'sheet'|'modal'} [type='sheet'] The type of popup.
     */
    openPopup: async function(id, type = 'sheet') {
        saveCurrentScrollPosition(); // Save scroll before opening
        const element = document.getElementById(id);
        if (!element) return;

        this.closeAllPopupsUI(); // Close any currently open popups

        if (type === 'sheet') {
            sheetOverlay.classList.add('show');
            element.classList.add('show');
            // Load content specific to the sheet
            if (id === 'cartSheet') this.renderCart();
            if (id === 'favoritesSheet') await this.renderFavoritesPage(); // Make async if needed
            if (id === 'categoriesSheet') this.renderCategoriesSheet();
            if (id === 'notificationsSheet') await fetchAnnouncementsForSheet(); // Use core function
            if (id === 'termsSheet') await fetchPolicies(); // Use core function
            if (id === 'profileSheet') this.populateProfileForm();
        } else { // Modal
            element.style.display = 'block';
        }
        document.body.classList.add('overlay-active'); // Prevent body scrolling

        // Push state for back button navigation
        history.pushState({ type: type, id: id }, '', `#${id}`);
    },

    /** Closes the currently active popup using history navigation or direct close. */
    closeCurrentPopup: function() {
        // Check if the current history state represents a popup
        if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
            history.back(); // Use browser back to close and restore previous state
        } else {
            this.closeAllPopupsUI(); // Fallback if history state is not a popup
        }
    },

    /** Checks if a specific modal is currently open. */
    isModalOpen: function(id) {
        const modal = document.getElementById(id);
        return modal && modal.style.display === 'block';
    },

    // --- Page Navigation & Header ---

    /** Updates the header view based on the current page. */
    updateHeaderView: function(pageId, title = '') {
        const mainHeader = document.querySelector('.main-header-content');
        const subpageHeader = document.querySelector('.subpage-header-content');
        const headerTitleEl = document.getElementById('headerTitle');

        if (!mainHeader || !subpageHeader || !headerTitleEl) return;

        if (pageId === 'mainPage') {
            mainHeader.style.display = 'flex';
            subpageHeader.style.display = 'none';
        } else {
            mainHeader.style.display = 'none';
            subpageHeader.style.display = 'flex';
            headerTitleEl.textContent = title;
            // Reset subpage search on navigation
            document.getElementById('subpageSearchInput').value = '';
            document.getElementById('subpageClearSearchBtn').style.display = 'none';
        }
    },

    /** Shows a specific page and hides others, updating the header. */
    showPage: function(pageId, pageTitle = '') {
        document.querySelectorAll('.page').forEach(page => {
            const isActive = page.id === pageId;
            page.classList.toggle('page-active', isActive);
            page.classList.toggle('page-hidden', !isActive);
        });

        // Scroll to top for new page views (except potentially main page handled by applyFilterState)
        if (pageId !== 'mainPage') {
            window.scrollTo({ top: 0, behavior: 'auto' }); // Use auto for instant scroll on page change
        }

        this.updateHeaderView(pageId, pageTitle);

        // Update active state in bottom navigation
        const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
        this.updateActiveNav(activeBtnId);
    },

    /** Updates the active state of the bottom navigation bar. */
    updateActiveNav: function(activeBtnId) {
        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
        if (activeBtnId) {
            const activeBtn = document.getElementById(activeBtnId);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    },

    // --- Language & UI Text ---

    /** Applies the selected language to all translatable elements. */
    setLanguageUI: function(lang) {
        document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
        document.documentElement.dir = 'rtl'; // Assuming always RTL for these languages

        document.querySelectorAll('[data-translate-key]').forEach(element => {
            const key = element.dataset.translateKey;
            const translation = t(key); // Use core translation function
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder !== undefined) { // Check if placeholder exists
                    element.placeholder = translation;
                }
            } else if (element.tagName === 'BUTTON' && element.classList.contains('lang-btn')) {
                // Don't overwrite language button text
            }
             else {
                // Use innerHTML for elements that might contain icons (like sheet titles)
                // Find icon if present
                const icon = element.querySelector('i');
                if (icon) {
                    element.innerHTML = `${icon.outerHTML} ${translation}`;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Update language button active state
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    },

    // --- Product Rendering ---

    /** Creates a skeleton loader element. */
    createSkeletonCard: function() {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        return skeletonCard;
    },

    /** Renders skeleton loaders in a container. */
    renderSkeletonLoader: function(container = skeletonLoader, count = 8) {
        container.innerHTML = ''; // Clear previous skeletons/content
        for (let i = 0; i < count; i++) {
            container.appendChild(this.createSkeletonCard());
        }
        container.style.display = 'grid'; // Ensure grid layout
        if (container === skeletonLoader) {
            productsContainer.style.display = 'none'; // Hide actual products
            loader.style.display = 'none'; // Hide loading spinner
        }
    },

    /** Creates the HTML element for a single product card. */
    createProductCardElement: function(product) {
        const productCard = document.createElement('div');
        productCard.className = 'product-card product-card-reveal'; // Add reveal class
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

        const isProdFavorite = isFavorite(product.id); // Use core function
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

        // Add event listeners within the UI function
        this.addProductCardEventListeners(productCard, product);

        return productCard;
    },

    /** Attaches event listeners to a product card. */
    addProductCardEventListeners: function(productCard, product) {
        const productId = product.id;

        productCard.addEventListener('click', (event) => {
            const target = event.target;
            const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Check current admin status

            // Find closest buttons or links
            const addToCartButton = target.closest('.add-to-cart-btn-card');
            const editButton = target.closest('.edit-btn');
            const deleteButton = target.closest('.delete-btn');
            const favoriteButton = target.closest('.favorite-btn');
            const shareButton = target.closest('.share-btn-card');
            const link = target.closest('a'); // Check if click is on a link within description (if shown)

            if (addToCartButton) {
                event.stopPropagation(); // Prevent opening details
                addToCart(productId); // Call core function
                // --- Add to Cart Button Animation ---
                if (!addToCartButton.disabled) {
                    const originalContent = addToCartButton.innerHTML;
                    addToCartButton.disabled = true;
                    addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = `<i class="fas fa-check"></i>`; // Change to checkmark
                        setTimeout(() => {
                            addToCartButton.innerHTML = originalContent; // Revert back
                            addToCartButton.disabled = false;
                        }, 1000); // Duration checkmark is shown
                    }, 500); // Delay before showing checkmark
                }
                // --- End Animation ---
            } else if (isAdminNow && editButton) {
                event.stopPropagation();
                // Ensure AdminLogic exists before calling
                 if (window.AdminLogic && typeof window.AdminLogic.editProduct === 'function') {
                    window.AdminLogic.editProduct(productId);
                } else {
                    console.error("AdminLogic.editProduct is not available.");
                }
            } else if (isAdminNow && deleteButton) {
                event.stopPropagation();
                 // Ensure AdminLogic exists before calling
                 if (window.AdminLogic && typeof window.AdminLogic.deleteProduct === 'function') {
                    window.AdminLogic.deleteProduct(productId);
                } else {
                     console.error("AdminLogic.deleteProduct is not available.");
                 }
            } else if (favoriteButton) {
                event.stopPropagation();
                toggleFavorite(productId); // Call core function
            } else if (shareButton) {
                event.stopPropagation();
                this.shareProduct(product); // Call UI share function
            } else if (!link) { // If not clicking on any button or link, show details
                this.showProductDetails(product); // Use the provided product data directly
            }
        });
    },

    /** Handles sharing a product using Web Share API or fallback. */
    shareProduct: async function(product) {
        const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
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
                // Fallback for browsers that don't support navigator.share
                const textArea = document.createElement('textarea');
                textArea.value = productUrl;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    // Use execCommand for broader compatibility within iframes/sandboxed envs
                    document.execCommand('copy');
                    this.showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    this.showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error');
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Share error:', err);
             if (err.name !== 'AbortError') { // Don't show error if user cancelled share
                 this.showNotification(t('share_error'), 'error');
             }
        }
    },


    /** Sets up Intersection Observer for scroll animations. */
    setupScrollAnimations: function() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
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
    },

    /** Renders the products currently in the state.products array. */
    renderProducts: function() {
        // Decide which container to use based on the active page
        const containerId = document.getElementById('subcategoryDetailPage').classList.contains('page-active')
            ? 'productsContainerOnDetailPage'
            : 'productsContainer';
        const currentContainer = document.getElementById(containerId);

        if (!currentContainer) return; // Exit if container not found

        // If it's not a detail page, clear the main container
        if (containerId === 'productsContainer') {
            productsContainer.innerHTML = '';
        }
        // If it *is* a detail page, we assume it was cleared before fetching in core logic

        if (!state.products || state.products.length === 0) {
            // Display empty message only if it's a new search result (not just loading more)
            if (state.lastVisibleProductDoc === null && !state.isLoadingMoreProducts) {
                 currentContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
            }
             return; // Don't render if no products
        }

        const fragment = document.createDocumentFragment();
        state.products.forEach(item => {
            let element = this.createProductCardElement(item);
            fragment.appendChild(element); // Append to fragment first
        });

        currentContainer.appendChild(fragment); // Append all at once
        this.setupScrollAnimations(); // Re-run animations setup for new cards
    },


    /** Clears product container and shows skeleton loader for a new search. */
    showSkeletonForNewSearch: function() {
        this.renderSkeletonLoader();
    },

    /** Displays products when fetched or retrieved from cache. */
    displayCachedProducts: function() {
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';
        this.renderProducts();
        this.updateScrollTriggerVisibility();
    },

    /** Renders products after fetching. */
    renderFetchedProducts: function() {
        skeletonLoader.style.display = 'none'; // Hide skeleton
        productsContainer.style.display = 'grid'; // Ensure grid is visible
        this.renderProducts(); // Render the actual products
        this.updateScrollTriggerVisibility();
    },

    /** Shows an error message in the products container. */
    showFetchingError: function() {
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        productsContainer.style.display = 'grid'; // Ensure it's visible
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
    },

    /** Shows/hides the loading spinner. */
    showLoadingIndicator: function(isLoading) {
        loader.style.display = isLoading ? 'block' : 'none';
    },

    /** Updates visibility of the infinite scroll trigger. */
    updateScrollTriggerVisibility: function() {
        const scrollTrigger = document.getElementById('scroll-loader-trigger');
        if (scrollTrigger) {
             scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        }
    },


    // --- Category Rendering ---

    /** Renders the main category buttons. */
    renderMainCategories: function() {
        const container = document.getElementById('mainCategoriesContainer');
        if (!container) return;
        container.innerHTML = ''; // Clear existing buttons

        state.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'main-category-btn';
            btn.dataset.category = cat.id;

            if (state.currentCategory === cat.id) {
                btn.classList.add('active');
            }

            const categoryName = cat.id === 'all'
                ? t('all_categories_label') // Use translation for 'All'
                : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Fallback logic

            btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Added fallback icon

            btn.onclick = () => {
                navigateToFilter({ // Use core navigation function
                    category: cat.id,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: '' // Clear search when changing category
                });
            };

            container.appendChild(btn);
        });
    },

    /** Renders the subcategory buttons (usually below main categories). */
    renderSubcategories: async function(categoryId) {
        const subcategoriesContainer = document.getElementById('subcategoriesContainer');
        subcategoriesContainer.innerHTML = ''; // Clear previous

        // Don't render if 'All' main categories is selected or no categoryId
        if (!categoryId || categoryId === 'all') {
            subcategoriesContainer.style.display = 'none';
            return;
        }

        const subcategories = await fetchSubcategories(categoryId); // Fetch data

        if (subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
            return;
        }

        subcategoriesContainer.style.display = 'flex'; // Show container

        // Create 'All' button for subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>
        `;
        allBtn.onclick = () => {
             // Navigate to the detail page for the main category (effectively showing all subcategories)
            // This behavior might need adjustment depending on desired UX
             this.showSubcategoryDetailPage(categoryId, 'all'); // Pass 'all' as subCatId? Or adjust navigation
        };
        subcategoriesContainer.appendChild(allBtn);


        // Create buttons for each subcategory
        subcategories.forEach(subcat => {
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
                // Navigate to the specific subcategory detail page
                this.showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });
    },

     /** Renders sub-subcategory buttons on the detail page. */
     renderSubSubcategoriesOnDetailPage: async function(mainCatId, subCatId) {
        const container = document.getElementById('subSubCategoryContainerOnDetailPage');
        container.innerHTML = ''; // Clear previous

        const subSubcategories = await fetchSubSubcategories(mainCatId, subCatId); // Fetch data

        if (subSubcategories.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        // 'All' button for sub-subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Initially active
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput').value;
            this.renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Use UI render function
        };
        container.appendChild(allBtn);

        // Buttons for each sub-subcategory
        subSubcategories.forEach(subSubcat => {
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id;
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const currentSearch = document.getElementById('subpageSearchInput').value;
                 this.renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Use UI render function
            };
            container.appendChild(btn);
        });
    },

    /** Renders products on the subcategory detail page. */
    renderProductsOnDetailPage: async function(subCatId, subSubCatId = 'all', searchTerm = '') {
        const productsContainer = document.getElementById('productsContainerOnDetailPage');
        const loader = document.getElementById('detailPageLoader');
        loader.style.display = 'block';
        productsContainer.innerHTML = ''; // Clear previous products

        const products = await fetchProductsForDetailPage(subCatId, subSubCatId, searchTerm); // Fetch data

        if (products.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            const fragment = document.createDocumentFragment();
            products.forEach(product => {
                const card = this.createProductCardElement(product);
                fragment.appendChild(card);
            });
            productsContainer.appendChild(fragment);
        }
        loader.style.display = 'none';
    },

    /** Navigates to the subcategory detail page UI. */
    showSubcategoryDetailPage: async function(mainCatId, subCatId, fromHistory = false) {
        let subCatName = 'Details'; // Default title
        try {
            // Attempt to fetch the actual name for the title
            const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
            const subCatSnap = await getDoc(subCatRef);
            if (subCatSnap.exists()) {
                const subCat = subCatSnap.data();
                subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
            }
        } catch (e) {
            console.error("Could not fetch subcategory name:", e);
        }

        // Update history if not navigating from back/forward
        if (!fromHistory) {
            history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
        }

        // Show the page UI
        this.showPage('subcategoryDetailPage', subCatName);

        const loader = document.getElementById('detailPageLoader');
        const productsContainer = document.getElementById('productsContainerOnDetailPage');
        const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

        // Show loader and clear content areas
        loader.style.display = 'block';
        productsContainer.innerHTML = '';
        subSubContainer.innerHTML = '';

        // Render the content for the detail page
        await this.renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
        await this.renderProductsOnDetailPage(subCatId, 'all', ''); // Initial load with 'all' sub-sub and no search

        loader.style.display = 'none'; // Hide loader after rendering
    },


    /** Renders the category list in the bottom sheet. */
    renderCategoriesSheet: function() {
        sheetCategoriesContainer.innerHTML = ''; // Clear previous
        state.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'sheet-category-btn';
            btn.dataset.category = cat.id;
            if (state.currentCategory === cat.id) { btn.classList.add('active'); }

            const categoryName = cat.id === 'all'
                ? t('all_categories_label')
                : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

            btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;

            btn.onclick = () => {
                navigateToFilter({ // Use core navigation function
                    category: cat.id,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: '' // Clear search
                });
                this.closeCurrentPopup(); // Use UI close function
                this.showPage('mainPage'); // Ensure main page is shown
            };

            sheetCategoriesContainer.appendChild(btn);
        });
    },

    /** Updates UI elements that depend on the loaded categories. */
    updateCategoryDependentUI: function() {
        if (state.categories.length === 0) return; // Wait until categories are loaded

        this.renderMainCategories();
        this.renderCategoriesSheet(); // Update sheet if open

        // Update admin dropdowns if admin logic is loaded and user is admin
        if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && typeof window.AdminLogic.updateAdminCategoryDropdowns === 'function') {
             window.AdminLogic.updateAdminCategoryDropdowns();
             window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Also update shortcut dropdowns
        }
    },

    /** Updates the UI based on the current filter state. */
    updateFilterUI: function() {
        // Update search input
        searchInput.value = state.currentSearch;
        clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

        // Update main category buttons active state
        document.querySelectorAll('#mainCategoriesContainer .main-category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === state.currentCategory);
        });

        // Update subcategory buttons active state (if visible)
        document.querySelectorAll('#subcategoriesContainer .subcategory-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subcategory === state.currentSubcategory);
        });

        // Update sub-subcategory buttons active state (if visible)
         document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subSubcategory === state.currentSubSubcategory);
        });

        // Re-render subcategories if main category changed
        this.renderSubcategories(state.currentCategory);
        // Re-render sub-subcategories if subcategory changed
        // this.renderSubSubcategories(state.currentCategory, state.currentSubcategory); // This was removed, might need re-evaluation if needed on main page
    },

    // --- Cart Rendering ---

    /** Renders the cart items and total in the cart sheet. */
    renderCart: function() {
        cartItemsContainer.innerHTML = ''; // Clear previous items
        if (state.cart.length === 0) {
            emptyCartMessage.style.display = 'block';
            cartTotal.style.display = 'none';
            cartActions.style.display = 'none';
            this.updateCartCount(); // Ensure count is 0
            return;
        }

        emptyCartMessage.style.display = 'none';
        cartTotal.style.display = 'block';
        cartActions.style.display = 'block'; // Show actions container
        this.renderCartActionButtons(); // Render buttons inside the actions container

        let total = 0;
        const fragment = document.createDocumentFragment();
        state.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';

            // Get translated name, fallback gracefully
            const itemNameInCurrentLang = (item.name && typeof item.name === 'object')
                ? (item.name[state.currentLanguage] || item.name.ku_sorani)
                : (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو'); // Handle if name is missing or just a string

            cartItem.innerHTML = `
                <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=N/A';">
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
            // Add event listeners directly here
            cartItem.querySelector('.increase-btn').onclick = () => updateQuantity(item.id, 1); // Use core function
            cartItem.querySelector('.decrease-btn').onclick = () => updateQuantity(item.id, -1); // Use core function
            cartItem.querySelector('.cart-item-remove').onclick = () => removeFromCart(item.id); // Use core function
            fragment.appendChild(cartItem);
        });

        cartItemsContainer.appendChild(fragment);
        totalAmount.textContent = total.toLocaleString();
        this.updateCartCount(); // Update badge count
    },

    /** Updates the cart item count badge. */
    updateCartCount: function() {
        const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
        document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
    },

    /** Renders the action buttons (WhatsApp, Viber, etc.) in the cart. */
    renderCartActionButtons: function() {
        const container = document.getElementById('cartActions');
        container.innerHTML = ''; // Clear previous buttons

        if (!state.contactMethods || state.contactMethods.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--dark-gray); margin-top: 10px;">هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
            return;
        }

        state.contactMethods.forEach(method => {
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Reusing class, maybe rename later if styles differ significantly
            btn.style.backgroundColor = method.color || '#ccc'; // Default color

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Fallback icon

            btn.onclick = () => {
                const message = this.generateOrderMessage(); // Generate message within UI logic
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value;

                switch (method.type) {
                    case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                    case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // Needs '+' for international format
                    case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                    case 'phone': link = `tel:${value}`; break; // No message for phone
                    case 'url': link = value; break; // Assume full URL
                    default: console.warn("Unknown contact method type:", method.type);
                }

                if (link && method.type !== 'phone') { // Open link for non-phone types
                    window.open(link, '_blank');
                } else if (link && method.type === 'phone') { // Initiate call for phone type
                     window.location.href = link;
                }
            };

            container.appendChild(btn);
        });
    },

     /** Updates cart action buttons if contact methods change while cart is open. */
     updateCartActionButtons: function() {
        if (document.getElementById('cartSheet').classList.contains('show')) {
            this.renderCartActionButtons();
        }
    },


    /** Generates the order message text based on cart and profile. */
    generateOrderMessage: function() {
        if (state.cart.length === 0) return "";
        let message = t('order_greeting') + "\n\n";
        state.cart.forEach(item => {
            const itemName = (item.name && typeof item.name === 'object') ? (item.name[state.currentLanguage] || item.name.ku_sorani) : item.name;
            const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
            message += `- ${itemName} | ${itemDetails}\n`;
        });
        message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`;

        if (state.userProfile.name || state.userProfile.address || state.userProfile.phone) {
            message += `\n${t('order_user_info')}\n`;
            if (state.userProfile.name) message += `${t('order_user_name')}: ${state.userProfile.name}\n`;
            if (state.userProfile.address) message += `${t('order_user_address')}: ${state.userProfile.address}\n`;
            if (state.userProfile.phone) message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`;
        } else {
            message += `\n${t('order_prompt_info')}\n`;
        }
        return message;
    },

    // --- Favorites Rendering ---

    /** Renders the favorites list in the favorites sheet. */
    renderFavoritesPage: async function() {
        favoritesContainer.innerHTML = ''; // Clear previous

        if (state.favorites.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            return;
        }

        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';

        this.renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeletons

        try {
            // Fetch details for favorited products
            const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
            const productSnaps = await Promise.all(fetchPromises);

            favoritesContainer.innerHTML = ''; // Clear skeletons

            const favoritedProducts = productSnaps
                .filter(snap => snap.exists())
                .map(snap => ({ id: snap.id, ...snap.data() }));

            if (favoritedProducts.length === 0) {
                emptyFavoritesMessage.style.display = 'block';
                favoritesContainer.style.display = 'none';
            } else {
                const fragment = document.createDocumentFragment();
                favoritedProducts.forEach(product => {
                    const productCard = this.createProductCardElement(product);
                    fragment.appendChild(productCard);
                });
                favoritesContainer.appendChild(fragment);
            }
        } catch (error) {
            console.error("Error fetching favorites:", error);
            favoritesContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">${t('error_generic')}</p>`;
        }
    },

    /** Updates favorite buttons on product cards. */
    updateFavoriteButtons: function(productId, isNowFavorite) {
        const allProductCards = document.querySelectorAll(`.product-card[data-product-id="${productId}"]`);
        allProductCards.forEach(card => {
            const favButton = card.querySelector('.favorite-btn');
            const heartIcon = card.querySelector('.fa-heart');
            if (favButton && heartIcon) {
                favButton.classList.toggle('favorited', isNowFavorite);
                heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
                heartIcon.classList.toggle('far', !isNowFavorite); // Regular (outline) heart
            }
        });
    },

    /** Re-renders the favorites page if it's currently open. */
    updateFavoritesPageIfOpen: function() {
        if (document.getElementById('favoritesSheet').classList.contains('show')) {
            this.renderFavoritesPage();
        }
    },

    // --- Other UI Rendering ---

     /** Formats text description with links and line breaks. */
     formatDescription: function(text) {
        if (!text) return '';
        // Basic escaping
        let escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Regex to find URLs (handles http, https, www)
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        let textWithLinks = escapedText.replace(urlRegex, (url) => {
            const hyperLink = url.startsWith('http') ? url : `https://${url}`;
            // Simple link styling
            return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline;">${url}</a>`;
        });
        // Convert newlines to <br> tags
        return textWithLinks.replace(/\n/g, '<br>');
    },

    /** Shows the product details sheet with fetched product data. */
    showProductDetails: async function(product) {
        const sheet = document.getElementById('productDetailSheet');
        const sheetContent = sheet.querySelector('.sheet-content');
        if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

        const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
        const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
        const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

        const imageContainer = document.getElementById('sheetImageContainer');
        const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
        const prevBtn = document.getElementById('sheetPrevBtn');
        const nextBtn = document.getElementById('sheetNextBtn');

        imageContainer.innerHTML = '';
        thumbnailContainer.innerHTML = '';

        let currentIndex = 0;

        // Image Slider Setup
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
                thumb.onclick = () => updateSliderUI(index); // Attach click listener
                thumbnailContainer.appendChild(thumb);
            });
        } else {
            // Show placeholder if no images
            imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
        }

        const images = imageContainer.querySelectorAll('img');
        const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

        function updateSliderUI(index) {
            if (!images[index]) return; // Check if image exists at index
            images.forEach(img => img.classList.remove('active'));
            thumbnails.forEach(thumb => thumb.classList.remove('active'));
            images[index].classList.add('active');
             // Check if thumbnail exists before adding active class
            if (thumbnails[index]) {
                thumbnails[index].classList.add('active');
            }
            currentIndex = index;
        }


        // Slider Buttons Logic
        if (imageUrls.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            // Use anonymous functions to avoid issues with `this`
            prevBtn.onclick = () => updateSliderUI((currentIndex - 1 + images.length) % images.length);
            nextBtn.onclick = () => updateSliderUI((currentIndex + 1) % images.length);
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            prevBtn.onclick = null; // Remove previous listeners
            nextBtn.onclick = null;
        }

        // Product Info
        document.getElementById('sheetProductName').textContent = nameInCurrentLang;
        document.getElementById('sheetProductDescription').innerHTML = this.formatDescription(descriptionText);

        // Price display with potential discount
        const priceContainer = document.getElementById('sheetProductPrice');
        if (product.originalPrice && product.originalPrice > product.price) {
            priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
        } else {
            priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
        }

        // Add to Cart Button
        const addToCartButton = document.getElementById('sheetAddToCartBtn');
        addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
        // Use anonymous function to ensure correct product ID is passed
        addToCartButton.onclick = () => {
            addToCart(product.id); // Call core function
            this.closeCurrentPopup(); // Close sheet after adding
        };

        // Fetch and render related products
        const relatedProducts = await fetchRelatedProducts(product);
        this.renderRelatedProductsUI(relatedProducts);


        this.openPopup('productDetailSheet'); // Open the sheet
    },

    /** Fetches product by ID and shows details sheet. */
    showProductDetailsById: async function(productId) {
         // Try finding in current state first
        let product = state.products.find(p => p.id === productId);
        if (product) {
            this.showProductDetails(product);
            return;
        }
        // If not found, fetch from Firestore
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                this.showProductDetails(fetchedProduct);
            } else {
                this.showNotification(t('product_not_found_error'), 'error');
            }
        } catch (error) {
            console.error("Error fetching product details by ID:", error);
            this.showNotification(t('error_generic'), 'error');
        }
    },


    /** Renders related products in the product details sheet. */
    renderRelatedProductsUI: function(relatedProducts) {
        const section = document.getElementById('relatedProductsSection');
        const container = document.getElementById('relatedProductsContainer');
        container.innerHTML = ''; // Clear previous

        if (!relatedProducts || relatedProducts.length === 0) {
            section.style.display = 'none';
            return;
        }

        const fragment = document.createDocumentFragment();
        relatedProducts.forEach(product => {
            const card = this.createProductCardElement(product);
            fragment.appendChild(card);
        });
        container.appendChild(fragment);
        section.style.display = 'block'; // Show the section
    },


    /** Renders the list of contact links in the settings. */
    renderContactLinks: function(links) {
        const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
        contactLinksContainer.innerHTML = ''; // Clear previous

        if (!links || links.length === 0) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--dark-gray);">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        links.forEach(link => {
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer'; // Security best practice
            linkElement.className = 'settings-item';
            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;
            fragment.appendChild(linkElement);
        });
        contactLinksContainer.appendChild(fragment);
    },

    /** Renders the user notifications list. */
    renderUserNotifications: function(announcements) {
        notificationsListContainer.innerHTML = ''; // Clear previous
        if (!announcements || announcements.length === 0) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        announcements.forEach(announcement => {
            const date = new Date(announcement.createdAt);
            // Simple date format (YYYY/MM/DD)
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
            fragment.appendChild(item);
        });
        notificationsListContainer.appendChild(fragment);
    },

     /** Renders the terms and policies in the sheet. */
     renderPoliciesSheet: function(policiesContent, isError = false) {
        if (isError) {
            termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
        } else if (policiesContent) {
            const content = policiesContent[state.currentLanguage] || policiesContent.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    },


    /** Populates the profile form with saved data. */
    populateProfileForm: function() {
        document.getElementById('profileName').value = state.userProfile.name || '';
        document.getElementById('profileAddress').value = state.userProfile.address || '';
        document.getElementById('profilePhone').value = state.userProfile.phone || '';
    },

     /** Updates admin-specific UI elements based on login status. */
     updateAdminSpecificUI: function(isAdmin) {
        // Toggle visibility of admin sections in settings
        const adminSections = [
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
            'adminContactMethodsManagement', 'adminShortcutRowsManagement', 'adminHomeLayoutManagement'
        ];
        adminSections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = isAdmin ? 'block' : 'none';
        });

        // Toggle admin login/logout buttons
        if (settingsLogoutBtn) settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
        if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';

        // Toggle add product button
        if (addProductBtn) addProductBtn.style.display = isAdmin ? 'flex' : 'none';

        // Toggle edit/delete buttons on existing product cards
        document.querySelectorAll('.product-actions').forEach(el => {
            el.style.display = isAdmin ? 'flex' : 'none';
        });
    },

     // --- Home Page Sections Rendering (Called by Core Logic) ---

    /** Clears the home page sections container. */
    clearHomePageContent: function() {
        const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
        if (homeSectionsContainer) {
            homeSectionsContainer.innerHTML = '';
        }
        // Also stop sliders associated with the home page
        this.stopAllSliders();
    },

    /** Renders the dynamic sections on the home page. */
    renderHomePageSections: async function() {
        // This function will now primarily call the core logic to fetch layout
        // and then call specific UI rendering functions based on the layout data.
        // The actual fetching and iterating logic is better kept in app-core.js.
        // For simplicity in this refactor, we assume app-core calls the specific
        // section render functions below directly after fetching the layout.
        if (state.isRenderingHomePage) return; // Prevent concurrent rendering
        // Show skeleton loader for home sections
        this.renderSkeletonLoader(document.getElementById('homePageSectionsContainer'), 4);
        // Core logic will fetch layout and call render functions like renderPromoCardsSectionUI etc.
         searchProductsInFirestore('', true); // Trigger the core logic for home page rendering

    },

    /** Renders a promo card slider section. */
    renderPromoCardsSectionUI: function(cardData, sliderState, container) {
        // This is simplified; the actual element creation is complex and needs careful handling
        // of state (currentIndex) and intervals, likely managed in core logic.
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card promo-card-grid-item'; // Example structure
        // ... Populate based on cardData and sliderState.currentIndex ...
        // ... Add event listeners for prev/next buttons that update sliderState and re-render ...
        container.appendChild(cardElement);
    },

    /** Renders a brands section. */
    renderBrandsSectionUI: function(brands, container) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'brands-section';
        const brandsContainer = document.createElement('div');
        brandsContainer.className = 'brands-container';
        sectionContainer.appendChild(brandsContainer);

        if (!brands || brands.length === 0) return; // Don't append if empty

        brands.forEach(brand => {
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;
            item.onclick = () => {
                // Navigate based on linked category/subcategory
                 if (brand.subcategoryId && brand.categoryId) {
                     this.showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                 } else if(brand.categoryId) {
                     navigateToFilter({ // Use core navigation
                         category: brand.categoryId,
                         subcategory: 'all',
                         subSubcategory: 'all',
                         search: ''
                     });
                 }
            };
            brandsContainer.appendChild(item);
        });
        container.appendChild(sectionContainer);
    },

    /** Renders a section with the newest products. */
    renderNewestProductsSectionUI: function(products, container) {
        if (!products || products.length === 0) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const title = document.createElement('h3');
        title.className = 'section-title-main';
        title.textContent = t('newest_products');
        header.appendChild(title);
        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        products.forEach(product => {
            productsScroller.appendChild(this.createProductCardElement(product));
        });
        sectionContainer.appendChild(productsScroller);
        container.appendChild(sectionContainer);
    },

    /** Renders a single row of shortcut cards. */
    renderSingleShortcutRowUI: function(rowData, cards, container) {
         if (!cards || cards.length === 0) return; // Don't render empty rows

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'shortcut-cards-section';

        const rowTitle = rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        cards.forEach(cardData => {
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;
            item.onclick = () => {
                navigateToFilter({ // Use core navigation
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainer.appendChild(item);
        });
        container.appendChild(sectionContainer);
    },

    /** Renders a single row of products from a specific category. */
    renderSingleCategoryRowUI: function(sectionData, products, container) {
         if (!products || products.length === 0) return;

        let title = sectionData.name[state.currentLanguage] || sectionData.name.ku_sorani;
        // Optionally fetch the real category name here if needed, but keep it simple for now

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = () => {
            if (sectionData.subcategoryId) {
                 this.showSubcategoryDetailPage(sectionData.categoryId, sectionData.subcategoryId);
            } else {
                 navigateToFilter({ // Use core navigation
                     category: sectionData.categoryId,
                     subcategory: 'all',
                     subSubcategory: 'all',
                     search: ''
                 });
            }
        };
        header.appendChild(seeAllLink);
        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        products.forEach(product => {
            productsScroller.appendChild(this.createProductCardElement(product));
        });
        sectionContainer.appendChild(productsScroller);
        container.appendChild(sectionContainer);
    },

    /** Renders the 'All Products' section on the home page. */
    renderAllProductsSectionUI: function(products, container) {
        if (!products || products.length === 0) return;

        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';
        sectionContainer.style.marginTop = '20px';

        const header = document.createElement('div');
        header.className = 'section-title-header';
        const title = document.createElement('h3');
        title.className = 'section-title-main';
        title.textContent = t('all_products_section_title');
        header.appendChild(title);
        sectionContainer.appendChild(header);

        const productsGrid = document.createElement('div');
        productsGrid.className = 'products-container';
        products.forEach(product => {
            productsGrid.appendChild(this.createProductCardElement(product));
        });
        sectionContainer.appendChild(productsGrid);
        container.appendChild(sectionContainer);
    },

     /** Hides home page sections and stops sliders. */
     hideHomePageSectionsAndStopSliders: function() {
        const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
        if (homeSectionsContainer) {
            homeSectionsContainer.style.display = 'none';
        }
        this.stopAllSliders();
    },

    /** Stops all active promo sliders. */
    stopAllSliders: function() {
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
    },



    // --- Event Listener Setup ---

    /** Sets up all major event listeners for the application UI. */
    setupEventListeners: function() {
        // Bottom Navigation
        homeBtn.onclick = () => {
            if (!mainPage.classList.contains('page-active')) {
                 // Push state for page navigation
                history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
                this.showPage('mainPage');
            }
            // Reset filters when clicking home (uses core logic)
            navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        };
        settingsBtn.onclick = () => {
            // Push state for page navigation
             history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
             this.showPage('settingsPage', t('settings_title'));
        };
        profileBtn.onclick = () => { this.openPopup('profileSheet'); this.updateActiveNav('profileBtn'); };
        cartBtn.onclick = () => { this.openPopup('cartSheet'); this.updateActiveNav('cartBtn'); };
        categoriesBtn.onclick = () => { this.openPopup('categoriesSheet'); this.updateActiveNav('categoriesBtn'); };

        // Header Buttons
        document.getElementById('headerBackBtn').onclick = () => history.back(); // Use browser back navigation
        notificationBtn.onclick = () => this.openPopup('notificationsSheet');

        // Popups Closing
        sheetOverlay.onclick = () => this.closeCurrentPopup();
        document.querySelectorAll('.close').forEach(btn => btn.onclick = () => this.closeCurrentPopup());
        // Close modal on outside click
        window.onclick = (e) => {
            if (e.target.classList.contains('modal')) {
                 this.closeCurrentPopup();
            }
        };
        // Close popups on Escape key press
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCurrentPopup();
            }
        });

        // Search Input (Main)
        const debouncedSearch = debounce((term) => navigateToFilter({ search: term }), 500); // Use core navigation
        searchInput.oninput = () => {
            const searchTerm = searchInput.value;
            clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            debouncedSearch(searchTerm);
        };
        clearSearchBtn.onclick = () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            navigateToFilter({ search: '' }); // Use core navigation
        };

        // Search Input (Subpage Detail)
         const subpageSearchInput = document.getElementById('subpageSearchInput');
         const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
         const debouncedSubpageSearch = debounce(async (term) => {
            const hash = window.location.hash.substring(1);
            if (hash.startsWith('subcategory_')) {
                const ids = hash.split('_');
                const subCatId = ids[2];
                // Find the currently active sub-subcategory button
                const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
                const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
                // Re-render products on the detail page using the UI function
                 await this.renderProductsOnDetailPage(subCatId, subSubCatId, term);
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
            debouncedSubpageSearch(''); // Trigger search with empty term
        };


        // Settings Page Items
        settingsFavoritesBtn.onclick = () => this.openPopup('favoritesSheet');
        settingsAdminLoginBtn.onclick = () => this.openPopup('loginModal', 'modal');
        termsAndPoliciesBtn.onclick = () => this.openPopup('termsSheet');
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission); // Core function
        document.getElementById('forceUpdateBtn')?.addEventListener('click', () => {
             if (confirm(t('update_confirm'))) { // Confirmation in UI
                forceUpdate(); // Call core function
            }
        });
        document.getElementById('installAppBtn')?.addEventListener('click', triggerInstallPrompt); // Core function


        // Profile Form
        profileForm.onsubmit = (e) => {
            e.preventDefault();
            state.userProfile = { // Update state directly
                name: document.getElementById('profileName').value,
                address: document.getElementById('profileAddress').value,
                phone: document.getElementById('profilePhone').value,
            };
            saveProfile(); // Use core save function
            this.showNotification(t('profile_saved'), 'success');
            this.closeCurrentPopup();
        };

        // Language Buttons
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.onclick = () => {
                const newLang = btn.dataset.lang;
                state.currentLanguage = newLang; // Update state
                localStorage.setItem('language', newLang); // Persist choice
                this.setLanguageUI(newLang); // Update UI text
                // Re-render dynamic content that depends on language
                this.updateCategoryDependentUI();
                this.updateFavoritesPageIfOpen();
                this.renderCart(); // Re-render cart with translated names
                 // Re-render home page sections if currently visible
                const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
                 if (homeSectionsContainer && homeSectionsContainer.style.display !== 'none') {
                    this.clearHomePageContent(); // Clear old content
                    searchProductsInFirestore('', true); // Trigger re-render via core logic
                } else if (!homeSectionsContainer || homeSectionsContainer.style.display === 'none') {
                    this.renderProducts(); // Re-render product list if not on home sections view
                }

            };
        });

        // Contact Links Toggle (Settings)
        contactToggle.onclick = () => {
            const container = document.getElementById('dynamicContactLinksContainer');
            const chevron = contactToggle.querySelector('.contact-chevron');
            container.classList.toggle('open');
            chevron.classList.toggle('open');
        };

         // Service Worker Update Button
         const updateNowBtn = document.getElementById('update-now-btn');
         if(updateNowBtn) {
             updateNowBtn.addEventListener('click', () => skipWaiting()); // Call core function
         }

         // GPS Button
         this.setupGpsButton();

         // Infinite Scroll Trigger
         this.setupScrollObserver();

          // History Navigation (Popstate) - Handles back/forward button clicks
        window.addEventListener('popstate', async (event) => {
            this.closeAllPopupsUI(); // Close any popups when navigating history
            const popState = event.state;

            if (popState) {
                if (popState.type === 'page') {
                    // Restore page view
                    let pageTitle = popState.title;
                     // Refetch title for subcategory detail page if needed
                    if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                         try {
                             const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                             const subCatSnap = await getDoc(subCatRef);
                             if (subCatSnap.exists()) {
                                 const subCat = subCatSnap.data();
                                 pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                                 // Update the state title potentially
                                 history.replaceState({...popState, title: pageTitle}, '');
                             }
                         } catch(e) { console.error("Could not refetch title on popstate", e) }
                    }
                    this.showPage(popState.id, pageTitle);
                     // If navigating back *to* the subcategory detail page, re-render its content
                    if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                         await this.renderSubSubcategoriesOnDetailPage(popState.mainCatId, popState.subCatId);
                         await this.renderProductsOnDetailPage(popState.subCatId, 'all', ''); // Reset search on back nav
                    }

                } else if (popState.type === 'sheet' || popState.type === 'modal') {
                    // Restore popup view
                    this.openPopup(popState.id, popState.type);
                } else {
                    // Restore main page filter state
                    this.showPage('mainPage');
                    await applyFilterState(popState, true); // Use core function, indicate from popstate
                }
            } else {
                // No state - default to main page with no filters
                const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
                this.showPage('mainPage');
                await applyFilterState(defaultState); // Use core function
            }
        });

    },

     /** Sets up the GPS button functionality. */
     setupGpsButton: function() {
        const getLocationBtn = document.getElementById('getLocationBtn');
        const profileAddressInput = document.getElementById('profileAddress');

        if (!getLocationBtn || !profileAddressInput) return;

        const btnSpan = getLocationBtn.querySelector('span');
        const originalBtnText = btnSpan.textContent; // Store original text

        getLocationBtn.addEventListener('click', () => {
            if (!('geolocation' in navigator)) {
                this.showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
                return;
            }

            btnSpan.textContent = '...چاوەڕوان بە'; // Update button text
            getLocationBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
               async (position) => { // Success
                    const { latitude, longitude } = position.coords;
                    try {
                        // Using Nominatim for reverse geocoding (OpenStreetMap data)
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const data = await response.json();

                        if (data && data.display_name) {
                            profileAddressInput.value = data.display_name;
                            this.showNotification('ناونیشان وەرگیرا', 'success');
                        } else {
                            profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                            this.showNotification('نەتوانرا ناوی ناونیشان بدۆزرێتەوە، هێڵی پانی و درێژی دانرا', 'error');
                        }
                    } catch (error) {
                        console.error('Reverse Geocoding Error:', error);
                         profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback
                        this.showNotification('هەڵەیەک لە وەرگرتنی ناوی ناونیشان ڕوویدا', 'error');
                    } finally {
                        btnSpan.textContent = originalBtnText; // Restore original text
                        getLocationBtn.disabled = false;
                    }
                },
                (error) => { // Error
                    let message = '';
                    switch (error.code) {
                        case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                        case error.POSITION_UNAVAILABLE: message = 'زانیاری شوێن بەردەست نییە'; break;
                        case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                        default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
                    }
                    this.showNotification(message, 'error');
                    btnSpan.textContent = originalBtnText; // Restore text
                    getLocationBtn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
            );
        });
    },

     /** Sets up the Intersection Observer for infinite scrolling. */
     setupScrollObserver: function() {
        const trigger = document.getElementById('scroll-loader-trigger');
        if (!trigger) return;

        const observer = new IntersectionObserver((entries) => {
            // Check if trigger is intersecting and not all products are loaded and not currently loading
            if (entries[0].isIntersecting && !state.allProductsLoaded && !state.isLoadingMoreProducts) {
                 searchProductsInFirestore(state.currentSearch, false); // Fetch next page using core function
            }
        }, {
            root: null, // Use the viewport
            threshold: 0.1 // Trigger when 10% of the element is visible
        });

        observer.observe(trigger);
    },


};

// Expose the UI object globally
window.AppUI = AppUI;

// Initial setup of event listeners when the script loads
// We rely on DOMContentLoaded in app-core.js to call the main init,
// which in turn calls initializeAppLogic, which sets up listeners via AppUI.setupEventListeners()
// So, we don't need a DOMContentLoaded listener here.
AppUI.setupEventListeners();
