// app-ui.js: UI rendering, event handling, page navigation

import {
    // Import all necessary DOM elements from app-setup.js
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    homePageSectionsContainer, scrollTrigger, // Added these
    // Import translations and showNotification utility
    translations, showNotification, t
} from './app-setup.js';

import {
    // Import state and core logic functions needed by UI
    state,
    searchProductsInFirestore,
    addToCart,
    toggleFavorite,
    isFavorite,
    updateQuantity as updateQuantityCore, // Rename to avoid conflict if needed
    removeFromCart as removeFromCartCore, // Rename to avoid conflict if needed
    generateOrderMessage,
    fetchPolicies,
    fetchAnnouncements,
    fetchContactLinks,
    fetchCartActionMethods,
    fetchSubcategories,
    fetchSubSubcategories,
    fetchProductsForSubcategoryDetail,
    requestNotificationPermission,
    forceUpdate,
    formatDescription, // UI needs this for rendering
    debounce, // UI needs this for search input
    signInWithEmailAndPassword, // UI needs this for login form
    signOut // UI needs this for logout button
} from './app-core.js';


// --- Navigation and Page/Popup Management ---

function saveCurrentScrollPosition() {
    const currentState = history.state;
    // Only save scroll position for the main page filter state
    if (document.getElementById('mainPage')?.classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (!mainHeader || !subpageHeader || !headerTitle) return; // Add checks

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
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

    // Update header based on the page
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
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

async function openPopup(id, type = 'sheet') { // Make async for data loading popups
    saveCurrentScrollPosition();
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups first

    // Pre-load data if necessary before showing
    if (type === 'sheet') {
         if (id === 'cartSheet') await renderCart(); // Load cart data
         if (id === 'favoritesSheet') await renderFavoritesPage(); // Load favorites data
         if (id === 'categoriesSheet') renderCategoriesSheet(); // Render categories
         if (id === 'notificationsSheet') await renderUserNotifications(); // Load notifications
         if (id === 'termsSheet') await renderPolicies(); // Load policies
         if (id === 'profileSheet') { // Populate profile form
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
         }
    }

    // Now show the popup
    if (type === 'sheet') {
        if (sheetOverlay) sheetOverlay.classList.add('show');
        element.classList.add('show');
    } else { // Modal
        element.style.display = 'block';
    }

    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}


function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Let popstate handle closing
    } else {
        closeAllPopupsUI(); // Fallback if no history state
    }
}

// --- UI Rendering Functions ---

function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function setLanguageUI(lang) { // Renamed to avoid conflict
    // state.currentLanguage = lang; // State is managed in core
    // localStorage.setItem('language', lang); // Saving is managed in core? Or here? Let's keep it simple for now and do it here.
    state.currentLanguage = lang; // Update local state reference if needed, core manages master state
    localStorage.setItem('language', lang);

    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key); // Use t from core/setup
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

    // Re-render language-dependent content
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = ''; // Clear and let it re-render
    }

    // Decide whether to render home page or filtered products based on current state
    const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isHomeView) {
        renderHomePageContent(); // Call separate function for home page rendering
    } else {
        renderProducts(state.products); // Re-render product list with current data
    }

    renderMainCategories(); // Update main category buttons
    renderCategoriesSheet(); // Update categories sheet
    if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart(); // Update cart if open
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage(); // Update favorites if open
    // Update other language-dependent UI elements if necessary
}

function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return;
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
    // Hide other containers when skeleton is shown
    if (container === skeletonLoader) {
        if(productsContainer) productsContainer.style.display = 'none';
        if(loader) loader.style.display = 'none';
    }
}

function setupScrollAnimations() {
     if (!('IntersectionObserver' in window)) {
        console.log("IntersectionObserver not supported, animations disabled.");
        // Make cards visible immediately if observer not supported
        document.querySelectorAll('.product-card-reveal').forEach(card => card.classList.add('visible'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Adjust threshold as needed
    });

    // Observe newly added cards
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
        observer.observe(card);
    });
}


function createProductCardElement(product) {
    // This function remains largely the same as in app-logic.js
    // It needs access to `state`, `t`, `isFavorite`, `addToCart`, `toggleFavorite` (from core)
    // It needs access to `showProductDetailsWithData` (defined in this file)
    // It needs access to AdminLogic functions (conditionally, based on session storage)

    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name', {default: 'کاڵای بێ ناو'});
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
        extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
    }

    const isProdFavorite = isFavorite(product.id); // Call core function
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

    // --- Event Listeners specific to this card ---

    // Share Button
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
              if (err.name !== 'AbortError') {
                   showNotification(t('share_error'), 'error');
              }
         }
     });

    // Card Click Logic
    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Re-check admin status

        if (addToCartButton) {
            event.stopPropagation(); // Prevent opening details view
            addToCart(product.id); // Call core function
            // Add visual feedback (spinner, checkmark) - UI logic
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
            event.stopPropagation();
            if(window.AdminLogic?.editProduct) {
                window.AdminLogic.editProduct(product.id);
            }
        } else if (isAdminNow && target.closest('.delete-btn')) {
             event.stopPropagation();
            if(window.AdminLogic?.deleteProduct) {
                window.AdminLogic.deleteProduct(product.id);
            }
        } else if (target.closest('.favorite-btn')) {
            event.stopPropagation();
            const isNowFavorite = toggleFavorite(product.id); // Call core function
            // Update UI based on return value
            const favButton = target.closest('.favorite-btn');
            const heartIcon = favButton?.querySelector('.fa-heart');
            if(favButton && heartIcon) {
                favButton.classList.toggle('favorited', isNowFavorite);
                heartIcon.classList.toggle('fas', isNowFavorite);
                heartIcon.classList.toggle('far', !isNowFavorite);
            }
             // Optionally re-render favorites page if open
            if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
                renderFavoritesPage();
            }
        } else if (target.closest('.share-btn-card')) {
             // Already handled by its own listener
        } else if (!target.closest('a')) { // Don't trigger if clicking a link in description (if any)
            showProductDetailsWithData(product); // Call UI function to show details
        }
    });

    return productCard;
}

// Renders product cards from a given array of product objects
function renderProducts(productsToRender) {
    if (!productsContainer) return;
    // Clear only if it's a new search or initial load? Or always clear?
    // Let's assume searchProductsInFirestore handles clearing for new searches.
    // This function might just append for infinite scroll, or replace for filtering.
    // For simplicity now, let's replace content. searchProductsInFirestore should manage state.products.
    productsContainer.innerHTML = '';

    if (!productsToRender || productsToRender.length === 0) {
        // Handled by searchProductsInFirestore now
        // productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        return;
    }

    productsToRender.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal'); // Add class for animation
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Setup animations for newly added cards
}


// --- Functions to Render Specific UI Sections (Cart, Favorites, Categories etc.) ---

async function renderCart() { // Make async if product details need fetching
    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

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
    await renderCartActionButtons(); // Fetch and render buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Get name in current language
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('product_no_name', {default: 'کاڵای بێ ناو'}));
        const itemImage = item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'; // Placeholder

        cartItem.innerHTML = `
            <img src="${itemImage}" alt="${itemNameInCurrentLang}" class="cart-item-image">
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

    // Add event listeners for cart item buttons (must be done after adding elements)
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => {
        btn.onclick = (e) => {
            if (updateQuantityCore(e.currentTarget.dataset.id, 1)) {
                renderCart(); // Re-render if quantity changed
            }
        };
    });
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => {
         btn.onclick = (e) => {
            if (updateQuantityCore(e.currentTarget.dataset.id, -1)) {
                renderCart(); // Re-render if quantity changed or item removed
            }
        };
    });
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
         btn.onclick = (e) => {
            if (removeFromCartCore(e.currentTarget.dataset.id)) {
                 renderCart(); // Re-render after removing
            }
        };
    });
}

async function renderCartActionButtons() {
    if (!cartActions) return;
    cartActions.innerHTML = ''; // Clear previous buttons

    const methods = await fetchCartActionMethods(); // Use core function

    if (!methods || methods.length === 0) {
        cartActions.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        // Use a more generic class or style directly
        btn.className = 'whatsapp-btn'; // Keeping original class for styling compatibility
        btn.style.backgroundColor = method.color || '#ccc'; // Use defined color or fallback

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani || 'Send';
        btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Fallback icon

        btn.onclick = () => {
            const message = generateOrderMessage(); // Use core function
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp':
                    link = `https://wa.me/${value}?text=${encodedMessage}`;
                    break;
                case 'viber':
                    // Viber URI scheme might need adjustments based on device/platform
                    link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                    // Attempt fallback for desktop?
                    // link = `viber://forward?text=${encodedMessage}`;
                    break;
                case 'telegram':
                     // Assumes value is username without '@'
                    link = `https://t.me/${value}?text=${encodedMessage}`;
                    break;
                case 'phone':
                    link = `tel:${value}`;
                    break;
                case 'url': // For custom URLs like Facebook Messenger, etc.
                    // Assume the value is the full URL, potentially needing message appended?
                    // This might require specific formatting per service.
                    // Simple approach: just open the URL. User pastes the message.
                    link = value;
                     // Or try appending if it looks like a known pattern (e.g., m.me)
                    // if (value.includes("m.me")) { link = `${value}?text=${encodedMessage}`; }
                    break;
                default:
                    console.warn("Unknown contact method type:", method.type);
            }

            if (link) {
                window.open(link, '_blank');
            } else {
                 showNotification(`Could not generate link for type: ${method.type}`, 'error');
            }
        };
        cartActions.appendChild(btn);
    });
}

async function renderFavoritesPage() {
    if (!favoritesContainer || !emptyFavoritesMessage) return;

    favoritesContainer.innerHTML = ''; // Clear previous content

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Assuming grid layout

    renderSkeletonLoader(favoritesContainer, state.favorites.length); // Show skeletons

    try {
        // Fetch details for favorite products (consider caching)
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProductsData = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProductsData.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Update state if some favorites were deleted from DB
            state.favorites = favoritedProductsData.map(p => p.id);
            saveFavorites();
        } else {
            favoritedProductsData.forEach(product => {
                const productCard = createProductCardElement(product); // Use UI function
                favoritesContainer.appendChild(productCard);
            });
             // Update state in case some favorites were deleted from DB
             if(favoritedProductsData.length !== state.favorites.length){
                 state.favorites = favoritedProductsData.map(p => p.id);
                 saveFavorites();
             }
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

function renderCategoriesSheet() {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Clear previous

    if (!state.categories || state.categories.length === 0) return;

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani || cat.id); // Fallback to ID

        const iconHTML = cat.icon ? `<i class="${cat.icon}"></i>` : ''; // Handle missing icon

        btn.innerHTML = `${iconHTML} ${categoryName}`;

        btn.onclick = async () => {
             // Navigate using history API (triggers searchProductsInFirestore via popstate/applyFilterState)
             await navigateToFilter({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             });
             closeCurrentPopup(); // Close the sheet
             showPage('mainPage'); // Ensure main page is shown
         };

        sheetCategoriesContainer.appendChild(btn);
    });
}

function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!state.categories || state.categories.length === 0) return;

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani || cat.id);

        const iconHTML = cat.icon ? `<i class="${cat.icon}"></i>` : '';

        btn.innerHTML = `${iconHTML} <span>${categoryName}</span>`;

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all', // Reset subcategory when main changes
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search
            });
         };
        container.appendChild(btn);
    });
}

// Renders subcategories based on fetched data
async function renderSubcategoriesUI(mainCatId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous

    if (!mainCatId || mainCatId === 'all') {
        subcategoriesContainer.style.display = 'none'; // Hide if 'All' is selected
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show container

    const subcategoriesData = await fetchSubcategories(mainCatId); // Use core function

    if (subcategoriesData.length === 0) {
        // Optionally hide or show a message if no subcategories exist
        subcategoriesContainer.style.display = 'none';
        return;
    }

    // "All" button for subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    // Reusing SVG icon for "All"
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
    allBtn.onclick = async () => {
        await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
    };
    subcategoriesContainer.appendChild(allBtn);

    // Render actual subcategory buttons
    subcategoriesData.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
        const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani || subcat.id;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subcat.imageUrl || placeholderImg;

        subcatBtn.innerHTML = `
            <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
            <span>${subcatName}</span>`;

        subcatBtn.onclick = () => {
             // Navigate to the subcategory detail page
             showSubcategoryDetailPage(mainCatId, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });
}

// --- Renders for Detail Page ---
async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = '';
    try {
        // Fetch subcategory name (maybe move this to core?)
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
        subCatName = 'Details'; // Fallback title
    }

    if (!fromHistory) {
         history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the page UI

    const loader = document.getElementById('detailPageLoader');
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const subSubContainerDetail = document.getElementById('subSubCategoryContainerOnDetailPage');

    if(loader) loader.style.display = 'block';
    if(productsContainerDetail) productsContainerDetail.innerHTML = ''; // Clear previous products
    if(subSubContainerDetail) subSubContainerDetail.innerHTML = ''; // Clear previous sub-subs

    // Clear search on detail page
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    if(subpageSearchInput) subpageSearchInput.value = '';
    if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';

    // Render sub-subcategories and products for this page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId);
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Initial render with 'all' sub-sub and no search

    if(loader) loader.style.display = 'none';
}

async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); // Use core function

    if (subSubcategoriesData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Add "All" button
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn active`; // Default active
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
    allBtn.dataset.id = 'all';
    allBtn.onclick = () => {
        container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
        renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Fetch products for 'all'
    };
    container.appendChild(allBtn);

    // Render actual sub-subcategory buttons
    subSubcategoriesData.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = `subcategory-btn`;
        btn.dataset.id = subSubcat.id;
        const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani || subSubcat.id;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subSubcat.imageUrl || placeholderImg;
        btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

        btn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Fetch products for this specific sub-sub
        };
        container.appendChild(btn);
    });
}

async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const loaderDetail = document.getElementById('detailPageLoader');

    if(loaderDetail) loaderDetail.style.display = 'block';
    if(productsContainerDetail) productsContainerDetail.innerHTML = ''; // Clear previous

    const products = await fetchProductsForSubcategoryDetail(subCatId, subSubCatId, searchTerm); // Use core function

    if (products.length === 0) {
        if(productsContainerDetail) productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
    } else {
        products.forEach(product => {
            const card = createProductCardElement(product); // Use UI function
            if(productsContainerDetail) productsContainerDetail.appendChild(card);
        });
    }

    if(loaderDetail) loaderDetail.style.display = 'none';
}


// --- Other UI Rendering Functions (Notifications, Policies, Contact Links etc.) ---

async function renderUserNotifications() {
    if (!notificationsListContainer) return;
    notificationsListContainer.innerHTML = ''; // Clear

    const announcements = await fetchAnnouncements(); // Use core function

    if (announcements.length === 0) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    announcements.forEach(announcement => {
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

    // Mark as seen
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    if (notificationBadge) notificationBadge.style.display = 'none'; // Update badge UI
}

async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await fetchPolicies(); // Use core function
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? formatDescription(content) : `<p>${t('no_policies_found')}</p>`; // Use formatDescription
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

async function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;
    contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">...بارکردن</p>'; // Loading indicator

    const links = await fetchContactLinks(); // Use core function

    contactLinksContainer.innerHTML = ''; // Clear loading/previous
    if (links.length === 0) {
        contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
        return;
    }

    links.forEach(link => {
        const name = link['name_' + state.currentLanguage] || link.name_ku_sorani || link.url; // Fallback name
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
            <i class="fas fa-external-link-alt"></i>`;
        contactLinksContainer.appendChild(linkElement);
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
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location'; // Fallback text

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback
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
                        profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback to coordinates
                        showNotification('نەتوانرا ناونیشانی ورد بدۆزرێتەوە', 'warning');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    profileAddressInput.value = `${latitude}, ${longitude}`; // Fallback
                    showNotification('هەڵەیەک لە وەرگرتنی ناوی ناونیشان ڕوویدا', 'error');
                } finally {
                    if(btnSpan) btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let message = t('error_generic'); // Default message
                switch (error.code) {
                    case error.PERMISSION_DENIED: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                    case error.POSITION_UNAVAILABLE: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                    case error.TIMEOUT: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                }
                showNotification(message, 'error');
                 if(btnSpan) btnSpan.textContent = originalBtnText;
                 getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
        );
    });
}

function setupScrollObserver() {
    if (!scrollTrigger || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
             console.log("Scroll trigger hit, loading more...");
             searchProductsInFirestore(state.currentSearch, false); // Call core function to load more
        }
    }, { threshold: 0.1 });

    observer.observe(scrollTrigger);
}

// --- Event Listeners Setup ---

function setupEventListeners() {
    // Navigation Buttons
    homeBtn?.addEventListener('click', async () => {
        if (!mainPage?.classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
    });
    settingsBtn?.addEventListener('click', () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    });
    profileBtn?.addEventListener('click', () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); });
    cartBtn?.addEventListener('click', () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); });
    categoriesBtn?.addEventListener('click', () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); });

    // Header Back Button
    document.getElementById('headerBackBtn')?.addEventListener('click', () => history.back());

    // Settings Page Links
    settingsFavoritesBtn?.addEventListener('click', () => openPopup('favoritesSheet'));
    settingsAdminLoginBtn?.addEventListener('click', () => openPopup('loginModal', 'modal'));
    termsAndPoliciesBtn?.addEventListener('click', () => openPopup('termsSheet'));
    notificationBtn?.addEventListener('click', () => openPopup('notificationsSheet'));
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('forceUpdateBtn')?.addEventListener('click', forceUpdate);

    // Logout
    settingsLogoutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth); // Call core auth function
            showNotification(t('logout_success'), 'success');
            // Admin UI cleanup is handled by onAuthStateChanged
        } catch (error) {
            console.error("Logout error:", error);
            showNotification(t('error_generic'), 'error');
        }
    });


    // Popup Closing
    sheetOverlay?.addEventListener('click', closeCurrentPopup);
    document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', closeCurrentPopup));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); });


    // Login Form
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        if (!email || !password) return;
        try {
            await signInWithEmailAndPassword(auth, email, password); // Use imported function
            // Success is handled by onAuthStateChanged triggering AdminLogic.initialize
            // Optionally add loading state here
        } catch (error) {
            console.error("Login error:", error);
            showNotification(t('login_error'), 'error');
        }
    });

    // Profile Form
    profileForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Update state (managed in core)
        state.userProfile = {
            name: document.getElementById('profileName')?.value || '',
            address: document.getElementById('profileAddress')?.value || '',
            phone: document.getElementById('profilePhone')?.value || '',
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile)); // Save profile locally
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    });

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguageUI(btn.dataset.lang)); // Call UI language function
    });

    // Contact Us Toggle
    contactToggle?.addEventListener('click', () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container?.classList.toggle('open');
        chevron?.classList.toggle('open');
    });

    // Search Input (Main)
    const debouncedSearch = debounce(async (term) => {
        await navigateToFilter({ search: term }); // Use navigateToFilter
    }, 500);

    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        if (clearSearchBtn) clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    });

    clearSearchBtn?.addEventListener('click', async () => {
        if(searchInput) searchInput.value = '';
        if(clearSearchBtn) clearSearchBtn.style.display = 'none';
        await navigateToFilter({ search: '' }); // Use navigateToFilter
    });

    // Search Input (Subpage)
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
         if (hash.startsWith('subcategory_')) {
             const ids = hash.split('_');
             const subCatId = ids[2];
             const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
             const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
             await renderProductsOnDetailPage(subCatId, subSubCatId, term); // Re-render products in detail page
         }
     }, 500);

    subpageSearchInput?.addEventListener('input', () => {
        const searchTerm = subpageSearchInput.value;
        if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSubpageSearch(searchTerm);
    });

    subpageClearSearchBtn?.addEventListener('click', () => {
         if(subpageSearchInput) subpageSearchInput.value = '';
         if(subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';
         debouncedSubpageSearch('');
    });


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

    // Service Worker Update Button
    document.getElementById('update-now-btn')?.addEventListener('click', () => {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
        });
    });

    // History navigation (Popstate) - Handles back/forward browser buttons
    window.addEventListener('popstate', async (event) => { // Make async
        closeAllPopupsUI(); // Close any open popups when navigating history
        const popState = event.state;
        if (popState) {
            if (popState.type === 'page') {
                let pageTitle = popState.title;
                 // Refetch title for subcategory detail if missing (might happen on direct load/refresh)
                 if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                    try {
                        const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                        const subCatSnap = await getDoc(subCatRef);
                        if (subCatSnap.exists()) {
                            const subCat = subCatSnap.data();
                            pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                        }
                    } catch (e) { console.error("Could not refetch title on popstate", e); }
                 }
                showPage(popState.id, pageTitle);
            } else if (popState.type === 'sheet' || popState.type === 'modal') {
                await openPopup(popState.id, popState.type); // Await ensures data loads before showing
            } else { // Filter state on main page
                showPage('mainPage');
                await applyFilterState(popState, true); // Apply filters and scroll position
            }
        } else { // No state - likely initial load or back to initial state
            const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
            showPage('mainPage');
            await applyFilterState(defaultState); // Apply default filters
        }
    });

} // End of setupEventListeners


// --- History and Filter State Management ---

async function applyFilterState(filterState, fromPopState = false) {
    // Update core state
    state.currentCategory = filterState.category || 'all';
    state.currentSubcategory = filterState.subcategory || 'all';
    state.currentSubSubcategory = filterState.subSubcategory || 'all';
    state.currentSearch = filterState.search || '';

    // Update UI elements
    if (searchInput) searchInput.value = state.currentSearch;
    if (clearSearchBtn) clearSearchBtn.style.display = state.currentSearch ? 'block' : 'none';

    // Re-render category/subcategory bars based on new state
    renderMainCategories();
    await renderSubcategoriesUI(state.currentCategory); // Render subcategories based on currentCategory
    // Sub-subcategories are generally not shown on the main page list

    // Trigger product search/render based on the new state
    await searchProductsInFirestore(state.currentSearch, true); // True indicates a new filter application

    // Handle scroll position restoration
    if (fromPopState && typeof filterState.scroll === 'number') {
        // Delay slightly to allow content to render before scrolling
        setTimeout(() => window.scrollTo(0, filterState.scroll), 50);
    } else if (!fromPopState) {
        // Scroll to top for new filter applications initiated by user click
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Function to update history and trigger filter application
async function navigateToFilter(newState) {
    // Save current scroll position before changing state
    history.replaceState({
        ...history.state, // Keep existing state type if it's a popup/page
        scroll: window.scrollY // Update scroll position
    }, '');

    // Merge new filter state with current filter state
    const currentStateFilters = {
        category: state.currentCategory,
        subcategory: state.currentSubcategory,
        subSubcategory: state.currentSubSubcategory,
        search: state.currentSearch
    };
    const finalState = { ...currentStateFilters, ...newState, scroll: 0 }; // Reset scroll for new navigation

    // Create new URL query parameters
    const params = new URLSearchParams();
    if (finalState.category && finalState.category !== 'all') params.set('category', finalState.category);
    if (finalState.subcategory && finalState.subcategory !== 'all') params.set('subcategory', finalState.subcategory);
    if (finalState.subSubcategory && finalState.subSubcategory !== 'all') params.set('subSubcategory', finalState.subSubcategory);
    if (finalState.search) params.set('search', finalState.search);
    const newQueryString = params.toString();
    const newUrl = `${window.location.pathname}${newQueryString ? '?' + newQueryString : ''}`; // Add '?' only if params exist

    // Push the new state and URL to history
    history.pushState(finalState, '', newUrl);

    // Apply the new filter state to the UI and fetch data
    await applyFilterState(finalState);
}


// --- Initial UI Setup ---

function handleInitialPageLoad(categories) { // Receive categories from core
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const pageId = hash.startsWith('subcategory_') ? 'subcategoryDetailPage' : (hash === 'settingsPage' ? 'settingsPage' : 'mainPage');

    if (pageId === 'subcategoryDetailPage') {
        const ids = hash.split('_');
        const mainCatId = ids[1];
        const subCatId = ids[2];
        if (categories && categories.length > 1) { // Ensure categories are loaded
            showSubcategoryDetailPage(mainCatId, subCatId, true); // true = from history/load
        } else {
             console.warn("Categories not ready for initial subcategory page load.");
             // Optionally show a loading state or default to main page
             showPage('mainPage');
             applyFilterState({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 });
        }
    } else if (pageId === 'settingsPage') {
        history.replaceState({ type: 'page', id: pageId, title: t('settings_title') }, '', `#${hash}`);
        showPage(pageId, t('settings_title'));
    } else { // MainPage
        showPage('mainPage');
        const initialState = {
            category: params.get('category') || 'all',
            subcategory: params.get('subcategory') || 'all',
            subSubcategory: params.get('subSubcategory') || 'all',
            search: params.get('search') || '',
            scroll: 0 // Initial scroll is 0
        };
        history.replaceState(initialState, '', window.location.pathname + window.location.search); // Set initial state with query params
        applyFilterState(initialState); // Apply filters from URL

        // Check if a specific popup needs to be opened based on hash
        if(hash && !hash.startsWith('subcategory_') && hash !== 'settingsPage'){
             const element = document.getElementById(hash);
             if (element) {
                 const isSheet = element.classList.contains('bottom-sheet');
                 const isModal = element.classList.contains('modal');
                 if (isSheet || isModal) {
                      // Use setTimeout to ensure the main page UI is settled
                     setTimeout(() => openPopup(hash, isSheet ? 'sheet' : 'modal'), 100);
                 }
             }
        }
    }

     // Check if a specific product detail needs to be shown
    const productId = params.get('product');
    if (productId && pageId === 'mainPage') { // Only show details if landing on main page with product param
        setTimeout(() => showProductDetails(productId), 500); // Delay slightly
    }
}


// --- Product Details Rendering --- (Moved from core as it's UI specific)
async function showProductDetails(productId) {
     let product = state.products.find(p => p.id === productId); // Check current products

     if (!product) {
         console.log("Product not in current list. Fetching details...");
         try {
            const docSnap = await getDoc(doc(db, "products", productId));
             if (docSnap.exists()) {
                 product = { id: docSnap.id, ...docSnap.data() };
             } else {
                 showNotification(t('product_not_found_error'), 'error');
                 return;
             }
         } catch(error) {
              console.error("Error fetching product details:", error);
              showNotification(t('error_generic'), 'error');
              return;
         }
     }
     showProductDetailsWithData(product); // Call the rendering function
 }

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Cannot find related if no category info
    }

    let q;
    const baseQuery = productsCollection;
    const limitCount = 6;

    try {
        if (currentProduct.subSubcategoryId) {
            q = query(baseQuery, where('subSubcategoryId', '==', currentProduct.subSubcategoryId), where('__name__', '!=', currentProduct.id), limit(limitCount));
        } else if (currentProduct.subcategoryId) {
            q = query(baseQuery, where('subcategoryId', '==', currentProduct.subcategoryId), where('__name__', '!=', currentProduct.id), limit(limitCount));
        } else { // Only categoryId available
            q = query(baseQuery, where('categoryId', '==', currentProduct.categoryId), where('__name__', '!=', currentProduct.id), limit(limitCount));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
             console.log("No related products found.");
             return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the section

    } catch (error) {
        console.error("Error fetching related products:", error);
        // Do not show the section on error
    }
}


function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name', {default: 'کاڵای بێ ناو'});
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    if (!imageContainer || !thumbnailContainer) return; // Exit if elements not found

    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

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
            thumbnailContainer.appendChild(thumb);
        });
    } else {
         // Display placeholder if no images
         imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
    }

    // Slider controls logic
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || (thumbnails.length > 0 && !thumbnails[index])) return; // Check index validity
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
         if(thumbnails[index]) thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    if (imageUrls.length > 1) {
        if(prevBtn) prevBtn.style.display = 'flex';
        if(nextBtn) nextBtn.style.display = 'flex';
        if(prevBtn) prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        if(nextBtn) nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
        thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));
    } else {
        if(prevBtn) prevBtn.style.display = 'none';
        if(nextBtn) nextBtn.style.display = 'none';
    }

    // Product Info
    const sheetProductName = document.getElementById('sheetProductName');
    const sheetProductDescription = document.getElementById('sheetProductDescription');
    const priceContainer = document.getElementById('sheetProductPrice');
    const addToCartButton = document.getElementById('sheetAddToCartBtn');

    if (sheetProductName) sheetProductName.textContent = nameInCurrentLang;
    if (sheetProductDescription) sheetProductDescription.innerHTML = formatDescription(descriptionText); // Use core function

    if (priceContainer) {
        if (product.originalPrice && product.originalPrice > product.price) {
            priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
        } else {
            priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
        }
    }

    if (addToCartButton) {
        addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
        addToCartButton.onclick = () => {
            addToCart(product.id); // Call core function
            closeCurrentPopup(); // Close the details sheet
        };
    }

    // Render related products section
     renderRelatedProducts(product); // Use async UI function

    // Open the sheet
    openPopup('productDetailSheet', 'sheet');
}


// --- PWA related UI ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e; // Store in core state
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex'; // Show button
    console.log('`beforeinstallprompt` event fired.');
});

// Update notification UI (Service Worker update)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration) return;
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    const updateNotification = document.getElementById('update-notification');
                    if (updateNotification) updateNotification.classList.add('show');
                }
            });
        });
    });
     // Reload page on controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
         console.log('New Service Worker activated. Reloading page...');
         window.location.reload();
     });
}

// --- Initialize UI ---
function initializeUI(categories) { // Receives categories from core init
    // Update UI that depends on categories immediately
    updateCategoryDependentUI();

    // Setup basic UI state and event listeners
    updateCartCount();
    setupEventListeners();
    setupScrollObserver();
    renderContactLinks(); // Initial render
    showWelcomeMessage();
    setupGpsButton();

    // PWA install button initial state
    const installBtn = document.getElementById('installAppBtn');
    if(installBtn) installBtn.style.display = state.deferredPrompt ? 'flex' : 'none';

    // Note: Initial page load (handleInitialPageLoad) and language setting (setLanguageUI)
    // are now called from initializeCoreLogic in app-core.js *after* categories are fetched.
}

// --- Export functions needed by app-core.js ---
export {
    updateCartCount,
    renderProducts,
    renderSkeletonLoader,
    showPage,
    closeCurrentPopup,
    updateCategoryDependentUI,
    handleInitialPageLoad, // Core needs to call this after fetching categories
    setLanguageUI as setLanguage, // Export with original name
    renderHomePageContent, // Core needs to trigger home page rendering
    // Export potentially needed by Admin logic via global object
    openPopup,
    createProductCardElement, // If admin wants to reuse card creation
    createPromoCardElement // If admin wants to reuse promo card creation
};

// --- Initial setup trigger ---
// The main initialization (fetching data) happens in app-core.js.
// We might need a way for core to signal UI readiness after initial data fetch.
// For now, let's assume core calls necessary UI functions like handleInitialPageLoad.
// We can call parts of UI init that don't depend on async data here.
document.addEventListener('DOMContentLoaded', () => {
    // Basic setup that doesn't rely on Firebase data yet
    setupEventListeners(); // Setup basic listeners
    setupGpsButton();
    setupScrollObserver();
    // Other non-data dependent UI setup...
});