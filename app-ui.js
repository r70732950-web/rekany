// app-ui.js
// Rêveberiya UI, girêdana bûyeran (event listeners), û nûvekirina DOM

import {
    // Import DOM elements needed for UI updates
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    // Elements needed specifically for admin UI rendering within app-ui
    adminPoliciesManagement, adminSocialMediaManagement, adminAnnouncementManagement, adminPromoCardsManagement,
    adminBrandsManagement, adminCategoryManagement, adminContactMethodsManagement, adminShortcutRowsManagement,
    adminHomeLayoutManagement, policiesForm, socialLinksListContainer, announcementForm,
    announcementsListContainer, contactMethodsListContainer, categoryListContainer, addCategoryForm,
    addSubcategoryForm, addSubSubcategoryForm, editCategoryForm,
    // New admin elements from updated HTML
    addPromoGroupForm, promoGroupsListContainer, addPromoCardForm,
    addBrandGroupForm, brandGroupsListContainer, addBrandForm,
    shortcutRowsListContainer, addShortcutRowForm, addCardToRowForm,
    homeLayoutListContainer, addHomeSectionBtn, addHomeSectionModal, addHomeSectionForm,
    // And possibly others if missed in setup.js exports initially
} from './app-setup.js';

import {
    // Import state and core logic functions
    state, t, debounce, formatDescription,
    handleLogin, handleLogout,
    fetchCategories, fetchSubcategories, fetchSubSubcategories, fetchProductById, fetchProducts,
    fetchPolicies, fetchAnnouncements, fetchRelatedProducts, fetchContactMethods,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, generateOrderMessageCore,
    toggleFavoriteCore, isFavorite,
    saveProfileCore, setLanguageCore,
    requestNotificationPermissionCore, checkNewAnnouncementsCore, updateLastSeenAnnouncementTimestamp,
    handleInstallPrompt, forceUpdateCore,
    saveCurrentScrollPositionCore, applyFilterStateCore, navigateToFilterCore,
    initCore, // Import the core initializer
    // Home page section data fetchers
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    // Firebase related imports needed for UI layer tasks (like fetching specific data for details page)
    db, doc, getDoc, collection, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js'; // Import necessary Firestore functions

// --- UI Helper Functions ---

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Add transition for showing
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
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

function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top for new pages, except main page which handles scroll separately
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // Update header based on the page
     if (pageId === 'settingsPage') {
         updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
         updateHeaderView('subcategoryDetailPage', pageTitle);
    } else { // Includes mainPage
         updateHeaderView('mainPage');
    }

    // Update active state in bottom navigation
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
    // Note: Other nav items (cart, profile, categories) handle their active state via openPopup
}


function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    saveCurrentScrollPositionCore(); // Use core function
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI(); // Close any currently open popups first

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        // Trigger rendering content specifically for the opened sheet
        if (id === 'cartSheet') renderCartUI();
        if (id === 'favoritesSheet') renderFavoritesPageUI();
        if (id === 'categoriesSheet') renderCategoriesSheetUI();
        if (id === 'notificationsSheet') renderUserNotificationsUI();
        if (id === 'termsSheet') renderPoliciesUI();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // type === 'modal'
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active'); // Prevent body scroll

    // Push state for back button navigation
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

function closeCurrentPopup() {
    // If the current history state represents a popup, go back
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // Otherwise, just close everything (fallback)
        closeAllPopupsUI();
    }
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

function updateCartCountUI() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

// --- Rendering Functions (UI specific) ---

function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return; // Add check
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
    container.style.display = 'grid'; // Ensure it's visible
}

function createProductCardElementUI(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // Get name in current language or fallback
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
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

    // Favorite Button State
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

    // --- Attach Event Listeners Directly Here ---
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
                   try { document.execCommand('copy'); showNotification('لينكى کاڵا کۆپى کرا!', 'success'); }
                   catch (err) { showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); }
                   document.body.removeChild(textArea);
             }
         } catch (err) {
             console.error('Share error:', err);
              if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
         }
    });

    productCard.querySelector('.favorite-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        handleToggleFavoriteUI(product.id);
    });

    productCard.querySelector('.add-to-cart-btn-card').addEventListener('click', (event) => {
        event.stopPropagation();
        handleAddToCartUI(product.id, event.currentTarget); // Pass the button itself
    });

    if (isAdmin) {
        productCard.querySelector('.edit-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
             if (window.AdminLogic && window.AdminLogic.editProduct) {
                 window.AdminLogic.editProduct(product.id);
             }
        });
        productCard.querySelector('.delete-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
             if (window.AdminLogic && window.AdminLogic.deleteProduct) {
                 window.AdminLogic.deleteProduct(product.id);
             }
        });
    }

    // Click on the card itself (excluding buttons) shows details
    productCard.addEventListener('click', (event) => {
         // Check if the click was on the card but not on any button inside it
        if (!event.target.closest('button')) {
            showProductDetailsUI(product);
        }
    });

    return productCard;
}

function setupScrollAnimations() {
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

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

// Renders product cards (assumes state.products is populated)
function renderProductsUI(newProductsOnly = false) {
    const container = productsContainer; // Assuming productsContainer is the main grid
    if (!container) return;

    // If only rendering new products (infinite scroll), append them
    if (newProductsOnly && Array.isArray(newProductsOnly)) { // Check if it's an array
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item);
            element.classList.add('product-card-reveal'); // Add animation class
            container.appendChild(element);
        });
    } else {
        // Otherwise, clear and render all products from state
        container.innerHTML = '';
        if (!state.products || state.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = createProductCardElementUI(item);
                element.classList.add('product-card-reveal'); // Add animation class
                container.appendChild(element);
            });
        }
    }

    setupScrollAnimations(); // Re-setup animations for newly added cards
}


function renderCartUI() {
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
    renderCartActionButtonsUI(); // Render action buttons

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

        cartItem.innerHTML = `
            <img src="${item.image}" alt="${itemNameInCurrentLang}" class="cart-item-image">
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

    // Attach listeners for quantity changes and removal
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    container.innerHTML = ''; // Clear previous buttons

    const methods = await fetchContactMethods(); // Get methods from core logic

    if (!methods || methods.length === 0) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; // Use a generic class or adjust CSS
        btn.style.backgroundColor = method.color;

        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessageCore(); // Use core function
            if (!message) return;

            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;

            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break; // Needs testing
                case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${value}`; break;
                case 'url': link = value; break; // Assume full URL
            }

            if (link) {
                window.open(link, '_blank');
            }
        };
        container.appendChild(btn);
    });
}


async function renderFavoritesPageUI() {
    favoritesContainer.innerHTML = '';

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, 4); // Show skeleton while fetching

    try {
        // Fetch details for all favorited products
        const fetchPromises = state.favorites.map(id => fetchProductById(id));
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);

        favoritesContainer.innerHTML = ''; // Clear skeleton

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
             // Optionally sync local storage if products were deleted
            state.favorites = [];
            saveFavorites();
        } else {
             // Sync favorites if some were deleted
            if(favoritedProducts.length !== state.favorites.length) {
                state.favorites = favoritedProducts.map(p => p.id);
                saveFavorites();
            }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error rendering favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}

function renderCategoriesSheetUI() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = async () => {
             await handleCategorySelection(cat.id); // Separate handler
              closeCurrentPopup();
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            await handleCategorySelection(cat.id); // Separate handler
        };

        container.appendChild(btn);
    });
}

// Renders subcategories based on fetched data
function renderSubcategoriesUI(subcategoriesData) {
     const subcategoriesContainer = document.getElementById('subcategoriesContainer');
      subcategoriesContainer.innerHTML = ''; // Clear previous

      if (!subcategoriesData || subcategoriesData.length === 0) {
           subcategoriesContainer.style.display = 'none'; // Hide if no subcategories
           return;
      }

      subcategoriesContainer.style.display = 'flex'; // Show if there are subcategories

      // Add "All" button for the current category's subcategories
      const allBtn = document.createElement('button');
      allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
      const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
      allBtn.innerHTML = `
          <div class="subcategory-image">${allIconSvg}</div>
          <span>${t('all_categories_label')}</span>
      `;
      allBtn.onclick = async () => {
          // When "All" subcategory is clicked, just filter products for the main category
          await handleCategorySelection(state.currentCategory, 'all');
      };
      subcategoriesContainer.appendChild(allBtn);

      // Add buttons for each actual subcategory
      subcategoriesData.forEach(subcat => {
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
              // Navigate to the subcategory detail page
              showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
          };
          subcategoriesContainer.appendChild(subcatBtn);
      });
 }

 // Renders sub-subcategories on the detail page
 async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId) {
      const container = document.getElementById('subSubCategoryContainerOnDetailPage');
      container.innerHTML = ''; // Clear previous

      const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId);

      if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
          container.style.display = 'none';
          return;
      }

      container.style.display = 'flex';

      // Add "All" button
      const allBtn = document.createElement('button');
      allBtn.className = `subcategory-btn active`; // Default to active
      allBtn.dataset.id = 'all';
      const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
      allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
      allBtn.onclick = () => {
          container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
          allBtn.classList.add('active');
          const currentSearch = document.getElementById('subpageSearchInput').value;
          renderProductsOnDetailPageUI(subCatId, 'all', currentSearch); // Fetch products for the parent subcategory
      };
      container.appendChild(allBtn);

      // Add buttons for each sub-subcategory
      subSubcategoriesData.forEach(subSubcat => {
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
              renderProductsOnDetailPageUI(subCatId, subSubcat.id, currentSearch); // Fetch products for this specific sub-subcategory
          };
          container.appendChild(btn);
      });
 }

 // Renders products on the detail page based on fetched data
 async function renderProductsOnDetailPageUI(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); // Show skeleton while fetching

    // Use fetchProducts from core, adapted for detail page context
     try {
         // Construct query parameters similar to fetchProducts logic
         let conditions = [];
         let orderByClauses = [];

         if (subSubCatId === 'all') {
             conditions.push(where("subcategoryId", "==", subCatId));
         } else {
             conditions.push(where("subSubcategoryId", "==", subSubCatId));
         }

         const finalSearchTerm = searchTerm.trim().toLowerCase();
         if (finalSearchTerm) {
             conditions.push(where('searchableName', '>=', finalSearchTerm));
             conditions.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
             orderByClauses.push(orderBy("searchableName", "asc"));
         }
         orderByClauses.push(orderBy("createdAt", "desc")); // Always sort by creation date

         let detailQuery = query(productsCollection, ...conditions, ...orderByClauses);
         // No pagination needed for detail page usually, load all matching
         // detailQuery = query(detailQuery, limit(SOME_LIMIT)); // Optional: Add limit if needed

         const productSnapshot = await getDocs(detailQuery);
         const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

         productsContainer.innerHTML = ''; // Clear skeleton/previous content

         if (products.length === 0) {
             productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
         } else {
             products.forEach(product => {
                 const card = createProductCardElementUI(product);
                 productsContainer.appendChild(card);
             });
         }
     } catch (error) {
         console.error(`Error rendering products on detail page:`, error);
         productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
     } finally {
         loader.style.display = 'none';
     }
}


async function showSubcategoryDetailPageUI(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        // Fetch subcategory name for the title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name:", e); }

    // Push state only if navigating forward
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the page and set title

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');

    // Reset UI elements
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';
    document.getElementById('subpageSearchInput').value = '';
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    // Render content
    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId); // Render sub-sub buttons first
    await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Then load initial products (all for this subcat)

    loader.style.display = 'none'; // Hide loader after content is loaded
}


async function showProductDetailsUI(productData) {
    const product = productData || await fetchProductById(state.currentProductId); // Fetch if needed
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }

    state.currentProductId = product.id; // Keep track of the currently viewed product

     const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll to top

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // Image Slider Setup
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url; img.alt = nameInCurrentLang; if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);
            const thumb = document.createElement('img');
            thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active'); thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }

    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return;
        images.forEach(img => img.classList.remove('active'));
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active');
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    // Show/hide slider buttons based on image count
    const showSliderBtns = imageUrls.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none';
    nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    // Remove previous listeners before adding new ones
    prevBtn.onclick = null;
    nextBtn.onclick = null;
    thumbnails.forEach(thumb => thumb.onclick = null);

    // Add new listeners
    if(showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    }
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // Update Product Info
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Use formatter

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Add to Cart Button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        handleAddToCartUI(product.id, addToCartButton); // Use UI handler
        // Optionally close the sheet after adding
        // closeCurrentPopup();
    };

    // Render Related Products section
    renderRelatedProductsUI(product);

    // Open the sheet and update history
    openPopup('productDetailSheet');
}

async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none'; // Hide initially

    const relatedProducts = await fetchRelatedProducts(currentProduct); // Fetch data

    if (relatedProducts && relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElementUI(product); // Create UI element
            container.appendChild(card);
        });
        section.style.display = 'block'; // Show section if products exist
    }
}

async function renderPoliciesUI() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await fetchPolicies(); // Fetch from core
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

async function renderUserNotificationsUI() {
    const announcements = await fetchAnnouncements(); // Fetch from core
    notificationsListContainer.innerHTML = '';

    if (!announcements || announcements.length === 0) {
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

    updateLastSeenAnnouncementTimestamp(latestTimestamp); // Update timestamp in core/localStorage
    notificationBadge.style.display = 'none'; // Hide badge after viewing
}

function updateAdminUIAuth(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    const adminSections = [ /* ... list all admin section IDs ... */
         'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
         'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
         'adminContactMethodsManagement', 'adminShortcutRowsManagement',
         'adminHomeLayoutManagement'
    ];
    adminSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = isAdmin ? 'block' : 'none';
    });

    settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    addProductBtn.style.display = isAdmin ? 'flex' : 'none';

    // Rerender product cards to show/hide admin buttons if the view is currently products
    if (productsContainer.style.display === 'grid' && !document.getElementById('homePageSectionsContainer').style.display === 'block') {
         renderProductsUI();
    }
    // Similar logic might be needed for detail page if admin buttons are there too
}

// --- UI Event Handlers ---

async function handleAddToCartUI(productId, buttonElement) {
    const result = await addToCartCore(productId); // Call core logic
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        updateCartCountUI(); // Update UI count
        // Animate button if provided
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Added state
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; // Revert state
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }
    }
}

function handleUpdateQuantityUI(productId, change) {
    if (updateCartQuantityCore(productId, change)) { // Call core logic
        renderCartUI(); // Re-render cart UI
        updateCartCountUI(); // Update overall count
    }
}

function handleRemoveFromCartUI(productId) {
    if (removeFromCartCore(productId)) { // Call core logic
        renderCartUI(); // Re-render cart UI
        updateCartCountUI(); // Update overall count
    }
}

function handleToggleFavoriteUI(productId) {
    const result = toggleFavoriteCore(productId); // Call core logic
    showNotification(result.message, result.favorited ? 'success' : 'error');

    // Update all relevant heart icons on the page
    document.querySelectorAll(`[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('favorited', result.favorited);
        const icon = btn.querySelector('.fa-heart');
        if (icon) {
            icon.classList.toggle('fas', result.favorited);
            icon.classList.toggle('far', !result.favorited);
        }
    });

    // If the favorites sheet is open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPageUI();
    }
}

async function handleCategorySelection(categoryId, subcategoryId = 'all') {
    // Navigate using the core function, which updates state and history
    await navigateToFilterCore({
        category: categoryId,
        subcategory: subcategoryId, // Reset subcategory when main category changes
        subSubcategory: 'all', // Reset sub-subcategory
        search: '' // Clear search
    });

    // Trigger UI updates based on the new state
    await updateProductViewUI(true); // true indicates a new filter/search
}

// Handles applying the current filter state to the UI (fetching & rendering)
async function updateProductViewUI(isNewSearch = false) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    // Show skeleton loader for new searches/filters
    if (isNewSearch) {
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        productsContainer.style.display = 'none';
        renderSkeletonLoader();
        skeletonLoader.style.display = 'grid';
        scrollTrigger.style.display = 'none'; // Hide scroll trigger during initial load
    }

    // Fetch products based on current state (state updated by navigateToFilterCore)
    const result = await fetchProducts(state.currentSearch, isNewSearch);

    if (result === null) return; // Loading is already in progress or all loaded

    skeletonLoader.style.display = 'none'; // Hide skeleton loader

    if (result.isHome) {
        homeSectionsContainer.style.display = 'block';
        productsContainer.style.display = 'none';
        scrollTrigger.style.display = 'none';
         if (homeSectionsContainer.innerHTML.trim() === '') {
             await renderHomePageContentUI(); // Render home content if it's empty
         }
    } else {
        homeSectionsContainer.style.display = 'none';
        productsContainer.style.display = 'grid';
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             // Append if not a new search, replace if it is
             renderProductsUI(isNewSearch ? null : result.products);
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block';
    }

    // Update category button states AFTER fetching and rendering
    renderMainCategoriesUI();
    const subcats = await fetchSubcategories(state.currentCategory);
    renderSubcategoriesUI(subcats); // Render subcategory buttons

     // Scroll logic
    if (isNewSearch) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Function to render home page sections (UI Part)
async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    homeSectionsContainer.innerHTML = ''; // Clear previous
    renderSkeletonLoader(homeSectionsContainer, 3); // Show skeleton

    const layout = await fetchHomeLayout(); // Fetch layout from core

    homeSectionsContainer.innerHTML = ''; // Clear skeleton

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        // Optionally render a fallback (e.g., just the 'all products' section)
         const allProductsSection = await createAllProductsSectionElement();
         if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Clean up any existing intervals before rendering new ones
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of layout) {
        let sectionElement = null;
        try {
             switch (section.type) {
                case 'promo_slider':
                    if (section.groupId) {
                        sectionElement = await createPromoSliderElement(section.groupId, section.id);
                    } else console.warn("Promo slider missing groupId:", section);
                    break;
                case 'brands':
                     if (section.groupId) {
                         sectionElement = await createBrandsSectionElement(section.groupId);
                    } else console.warn("Brands section missing groupId:", section);
                    break;
                case 'newest_products':
                    sectionElement = await createNewestProductsSectionElement();
                    break;
                case 'single_shortcut_row':
                     if (section.rowId) {
                         sectionElement = await createSingleShortcutRowElement(section.rowId, section.name);
                      } else console.warn("Shortcut row missing rowId:", section);
                    break;
                case 'single_category_row':
                    if (section.categoryId) {
                         sectionElement = await createSingleCategoryRowElement(section);
                    } else console.warn("Category row missing categoryId:", section);
                    break;
                 case 'all_products':
                      sectionElement = await createAllProductsSectionElement();
                    break;
                default:
                    console.warn(`Unknown home layout section type: ${section.type}`);
            }
        } catch(error) {
            console.error(`Error rendering home section type ${section.type}:`, error);
             // Optionally add a placeholder indicating an error for this section
        }

        if (sectionElement) {
            homeSectionsContainer.appendChild(sectionElement);
        }
    }
}

// --- UI Element Creation Functions for Home Page ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // Styles for container

    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image-container';
    const imgElement = document.createElement('img');
    imgElement.className = 'product-image';
    imgElement.loading = 'lazy';
    imgElement.alt = 'Promotion';
    imageContainer.appendChild(imgElement);
    promoCardElement.appendChild(imageContainer);

    const updateImage = (index) => {
        const currentCard = cardData.cards[index];
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;
        imgElement.src = imageUrl;
    };
    updateImage(sliderState.currentIndex); // Initial image

    // Add buttons only if multiple cards
    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(nextBtn);

        // Auto-rotation logic
        const rotate = () => {
             // Check if the element still exists and the interval is still tracked
            if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); // Clear this specific interval
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId]; // Remove from global state
                return;
            }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]); // Clear previous if any
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[layoutId] = sliderState.intervalId; // Store globally
        };
        const resetInterval = () => {
             if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            startInterval();
        };

        startInterval(); // Start on render
    }

    // Click on the card navigates
    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ignore clicks on buttons
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await handleCategorySelection(targetCategoryId);
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });

    promoGrid.appendChild(promoCardElement);
    return promoGrid;
}

async function createBrandsSectionElement(groupId) {
    const brands = await fetchBrandGroupBrands(groupId);
    if (!brands || brands.length === 0) return null;

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

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
        item.onclick = async () => {
             if (brand.subcategoryId && brand.categoryId) {
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId);
             } else if(brand.categoryId) {
                 await handleCategorySelection(brand.categoryId);
             }
        };
        brandsContainer.appendChild(item);
    });
    return sectionContainer;
}

async function createNewestProductsSectionElement() {
    const products = await fetchNewestProducts();
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('newest_products')}</h3>
            </div>
        <div class="horizontal-products-container"></div>
    `;
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product);
        productsScroller.appendChild(card);
    });
    return container;
}

async function createSingleShortcutRowElement(rowId, sectionNameObj) {
     const rowDocRef = doc(db, "shortcut_rows", rowId);
     const rowDocSnap = await getDoc(rowDocRef);
     if (!rowDocSnap.exists()) return null;

     const rowData = rowDocSnap.data();
     const cards = await fetchShortcutRowCards(rowId);
     if (!cards || cards.length === 0) return null;

     const sectionContainer = document.createElement('div');
     sectionContainer.className = 'shortcut-cards-section';
     const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
     sectionContainer.innerHTML = `<h3 class="shortcut-row-title">${rowTitle}</h3><div class="shortcut-cards-container"></div>`;
     const cardsContainer = sectionContainer.querySelector('.shortcut-cards-container');

     cards.forEach(cardData => {
         const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
         const item = document.createElement('div');
         item.className = 'shortcut-card';
         item.innerHTML = `
              <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
              <div class="shortcut-card-name">${cardName}</div>
         `;
         item.onclick = async () => {
              await navigateToFilterCore({ // Use core navigation
                   category: cardData.categoryId || 'all',
                   subcategory: cardData.subcategoryId || 'all',
                   subSubcategory: cardData.subSubcategoryId || 'all',
                   search: ''
              });
              await updateProductViewUI(true); // Trigger UI update
         };
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = name[state.currentLanguage] || name.ku_sorani;

    // Try to get a more specific title from category data
    try {
        let targetDocRef;
        if (subSubcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        else if (subcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        else targetDocRef = doc(db, `categories/${categoryId}`);
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }
    } catch(e) { console.warn("Could not fetch specific title for category row", e); }


    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${title}</h3>
            <a class="see-all-link">${t('see_all')}</a>
        </div>
        <div class="horizontal-products-container"></div>
    `;
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product);
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
         if(subcategoryId) { // Includes subSubcategoryId case
            showSubcategoryDetailPageUI(categoryId, subcategoryId);
         } else {
             await handleCategorySelection(categoryId);
         }
    };
    return container;
}

async function createAllProductsSectionElement() {
    const products = await fetchInitialProductsForHome();
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
            </div>
        <div class="products-container"></div>
    `;
    const productsGrid = container.querySelector('.products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product);
        productsGrid.appendChild(card);
    });
    return container;
}


// --- Setup Functions ---

function setupUIEventListeners() {
    homeBtn.onclick = async () => {
        if (!document.getElementById('mainPage').classList.contains('page-active')) {
            history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname.split('?')[0]);
            showPage('mainPage');
        }
        await handleCategorySelection('all'); // Go to home means reset filters
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', '#settingsPage');
        showPage('settingsPage', t('settings_title'));
    };

    document.getElementById('headerBackBtn').onclick = () => { history.back(); };

    profileBtn.onclick = () => { openPopup('profileSheet'); updateActiveNav('profileBtn'); };
    cartBtn.onclick = () => { openPopup('cartSheet'); updateActiveNav('cartBtn'); };
    categoriesBtn.onclick = () => { openPopup('categoriesSheet'); updateActiveNav('categoriesBtn'); };
    settingsFavoritesBtn.onclick = () => { openPopup('favoritesSheet'); };
    settingsAdminLoginBtn.onclick = () => { openPopup('loginModal', 'modal'); };
    notificationBtn.addEventListener('click', () => { openPopup('notificationsSheet'); });
    termsAndPoliciesBtn?.addEventListener('click', () => { openPopup('termsSheet'); });

    // Popups closing
    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Login Form
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await handleLogin(document.getElementById('email').value, document.getElementById('password').value);
            // Auth change listener in core will handle UI update and admin init
            closeCurrentPopup(); // Close modal on successful attempt (auth listener confirms)
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    // Main Search
    const debouncedSearch = debounce(async (term) => {
        // Navigate first (updates state and history)
        navigateToFilterCore({ search: term });
        // Then update the UI based on the new state
        await updateProductViewUI(true);
    }, 500);
    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };
    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        debouncedSearch(''); // Trigger empty search
    };

     // Subpage Search
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');
    const debouncedSubpageSearch = debounce(async (term) => {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('subcategory_')) {
            const ids = hash.split('_');
            const subCatId = ids[2];
            const activeSubSubBtn = document.querySelector('#subSubCategoryContainerOnDetailPage .subcategory-btn.active');
            const subSubCatId = activeSubSubBtn ? (activeSubSubBtn.dataset.id || 'all') : 'all';
            await renderProductsOnDetailPageUI(subCatId, subSubCatId, term); // Re-render products on detail page
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


    // Profile Form
    profileForm.onsubmit = (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        const message = saveProfileCore(profileData); // Call core logic
        showNotification(message, 'success');
        closeCurrentPopup();
    };

    // Language Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            handleSetLanguage(btn.dataset.lang);
        };
    });

    // Contact Us Toggle
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // Install Button
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', () => handleInstallPrompt(installBtn));
    }

    // Enable Notifications Button
    document.getElementById('enableNotificationsBtn')?.addEventListener('click', async () => {
        const result = await requestNotificationPermissionCore();
        showNotification(result.message, result.granted ? 'success' : 'error');
    });

    // Force Update Button
    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
        const result = await forceUpdateCore();
        if (result.success) {
            showNotification(result.message, 'success');
            // Reload after showing notification
            setTimeout(() => window.location.reload(true), 1500);
        } else if (result.message !== 'Update cancelled.') {
            showNotification(result.message, 'error');
        }
    });

    // --- Infinite Scroll ---
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    if (scrollTrigger) {
        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 loader.style.display = 'block'; // Show loader before fetching
                 const result = await fetchProducts(state.currentSearch, false); // Fetch next page
                 loader.style.display = 'none'; // Hide loader after fetching
                 if(result && result.products.length > 0) {
                      renderProductsUI(result.products); // Append new products
                 }
                 // Update scroll trigger visibility based on allLoaded status from core
                 scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
            }
        }, { threshold: 0.1 });
        observer.observe(scrollTrigger);
    }

    // --- Custom Event Listeners (from app-core) ---
    document.addEventListener('authChange', (e) => {
        updateAdminUIAuth(e.detail.isAdmin);
        // Close login modal if it was open and login succeeded
        if(e.detail.isAdmin && loginModal.style.display === 'block') {
             closeCurrentPopup();
        }
    });

    document.addEventListener('fcmMessage', (e) => {
        const payload = e.detail;
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`, 'success');
        notificationBadge.style.display = 'block'; // Show badge
    });

    document.addEventListener('installPromptReady', () => {
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = 'flex';
    });

    document.addEventListener('swUpdateReady', (e) => {
        const updateNotification = document.getElementById('update-notification');
        const updateNowBtn = document.getElementById('update-now-btn');
        updateNotification.classList.add('show');
        // Make sure the button listener is active
        updateNowBtn.onclick = () => {
             e.detail.registration?.waiting?.postMessage({ action: 'skipWaiting' });
        };
    });

    // Listener to re-render home page when admin makes changes
    document.addEventListener('clearCacheTriggerRender', async () => {
        console.log("UI received clearCacheTriggerRender event.");
        if(state.currentCategory === 'all' && !state.currentSearch) {
            await updateProductViewUI(true); // Re-render the home view
        }
    });

    // GPS Button in Profile
    setupGpsButtonUI();
}

// Handles language change and triggers necessary UI updates
async function handleSetLanguage(lang) {
    setLanguageCore(lang); // Update core state and localStorage

    // Update static text immediately
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if(element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    // Update active language button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-render dynamic content that depends on language
    renderMainCategoriesUI(); // Re-render main category buttons
    renderCategoriesSheetUI(); // Re-render sheet categories
    if (document.getElementById('cartSheet').classList.contains('show')) renderCartUI();
    if (document.getElementById('favoritesSheet').classList.contains('show')) renderFavoritesPageUI();
    // Re-render product list or home page sections
    await updateProductViewUI(true); // Treat as new search to fetch/render everything in new lang
    // Rerender contact links in settings
    await renderContactLinksUI();

    // Re-render admin lists if admin is active
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
         window.AdminLogic.renderAdminAnnouncementsList?.();
         window.AdminLogic.renderSocialMediaLinks?.();
         window.AdminLogic.renderContactMethodsAdmin?.();
         window.AdminLogic.renderCategoryManagementUI?.();
         // Add other admin list rerenders if needed (promo, brand, shortcut)
         window.AdminLogic.renderPromoGroupsAdminList?.();
         window.AdminLogic.renderBrandGroupsAdminList?.();
         window.AdminLogic.renderShortcutRowsAdminList?.();
         window.AdminLogic.renderHomeLayoutAdmin?.();
    }
}

// History/Navigation Handler (Popstate)
window.addEventListener('popstate', async (event) => {
    closeAllPopupsUI(); // Close any open popups when navigating back/forward
    const popState = event.state;

    if (popState) {
        if (popState.type === 'page') {
             let pageTitle = popState.title;
             // Refetch title for detail page if needed
             if (popState.id === 'subcategoryDetailPage' && !pageTitle && popState.mainCatId && popState.subCatId) {
                 try {
                     const subCatRef = doc(db, "categories", popState.mainCatId, "subcategories", popState.subCatId);
                     const subCatSnap = await getDoc(subCatRef);
                     if (subCatSnap.exists()) {
                         const subCat = subCatSnap.data();
                         pageTitle = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
                         // Update the state title so it's correct next time
                         history.replaceState({ ...popState, title: pageTitle }, '', window.location.href);
                     }
                 } catch(e) { console.error("Could not refetch title on popstate", e) }
             }
             // Show the target page
             showPage(popState.id, pageTitle);

              // If navigating back to the subcategory detail page, re-render its content
             if (popState.id === 'subcategoryDetailPage' && popState.mainCatId && popState.subCatId) {
                await showSubcategoryDetailPageUI(popState.mainCatId, popState.subCatId, true); // true = fromHistory
            }

        } else if (popState.type === 'sheet' || popState.type === 'modal') {
            // Re-open the specific popup
            openPopup(popState.id, popState.type);
        } else { // It's a filter state for the main page
            showPage('mainPage'); // Ensure main page is visible
            applyFilterStateCore(popState); // Apply the state logically
            await updateProductViewUI(true); // Re-render products based on popped state
            // Restore scroll position
            if (typeof popState.scroll === 'number') {
                 setTimeout(() => window.scrollTo(0, popState.scroll), 50); // Small delay
            }
        }
    } else {
        // No state, go to default main page view
        const defaultState = { category: 'all', subcategory: 'all', subSubcategory: 'all', search: '', scroll: 0 };
        showPage('mainPage');
        applyFilterStateCore(defaultState);
        await updateProductViewUI(true);
    }
});


// Initial UI setup on Load
async function initializeUI() {
    // *** گۆڕانکاری لێرە: await زیادکرا ***
    await initCore(); // Initialize core logic first (enables persistence, fetches initial data)

    // // Wait briefly for core init and initial data fetch (categories)
    // // A more robust solution might use events or promises from initCore
    // await new Promise(resolve => setTimeout(resolve, 200)); // <-- لابرا یان کرایە کۆمێنت

    // Initial language application (static text)
    setLanguageCore(state.currentLanguage); // Set core state
     document.querySelectorAll('[data-translate-key]').forEach(element => { // Apply static text
         const key = element.dataset.translateKey;
         const translation = t(key);
         if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') { if(element.placeholder) element.placeholder = translation; }
         else { element.textContent = translation; }
    });
     document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === state.currentLanguage)); // Set active lang button

    // Render initial dynamic UI elements based on fetched categories
    renderMainCategoriesUI();
    renderCategoriesSheetUI();

    // Setup basic UI event listeners
    setupUIEventListeners();

    // Handle initial page load based on URL (hash/query params) AFTER core init
    handleInitialPageLoadUI(); // Categories should be ready now

    // Render dynamic contact links
    renderContactLinksUI();

    // Check notification status
    const announcements = await fetchAnnouncements();
     if(announcements.length > 0 && checkNewAnnouncementsCore(announcements[0].createdAt)) {
         notificationBadge.style.display = 'block';
     }

    // Show welcome message only on first visit
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

// Handles initial page state based on URL, triggering necessary rendering
async function handleInitialPageLoadUI() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);

    const isSettings = hash === 'settingsPage';
    const isSubcategoryDetail = hash.startsWith('subcategory_');

    if (isSettings) {
         history.replaceState({ type: 'page', id: 'settingsPage', title: t('settings_title') }, '', `#${hash}`);
         showPage('settingsPage', t('settings_title'));
    } else if (isSubcategoryDetail) {
         const ids = hash.split('_');
         const mainCatId = ids[1];
         const subCatId = ids[2];
         // Ensure categories are loaded before showing detail page
         if (state.categories.length > 1) { // Check if categories are loaded (state.categories includes 'all')
             await showSubcategoryDetailPageUI(mainCatId, subCatId, true); // true = fromHistory/initial load
         } else {
             // Fallback to main page if categories aren't ready (should be rare now)
             console.warn("Categories not ready on initial load, showing main page instead of detail.");
             showPage('mainPage');
             await updateProductViewUI(true);
         }
    } else { // Default to main page
         showPage('mainPage');
         const initialState = {
             category: params.get('category') || 'all',
             subcategory: params.get('subcategory') || 'all',
             subSubcategory: params.get('subSubcategory') || 'all',
             search: params.get('search') || '',
             scroll: 0
         };
         history.replaceState(initialState, ''); // Set initial history state for main page
         applyFilterStateCore(initialState); // Apply the state
         await updateProductViewUI(true); // Render content based on state

         // Check if a specific popup needs to be opened on initial load
         const element = document.getElementById(hash);
         if (element) {
             const isSheet = element.classList.contains('bottom-sheet');
             const isModal = element.classList.contains('modal');
             if (isSheet || isModal) {
                 openPopup(hash, isSheet ? 'sheet' : 'modal');
             }
         }

         // Check if a specific product detail needs to be shown
          const productId = params.get('product');
          if (productId) {
              const product = await fetchProductById(productId);
              if (product) {
                  setTimeout(() => showProductDetailsUI(product), 300); // Delay slightly
              }
          }
    }
}

async function renderContactLinksUI() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    // Fetch social links data (assuming fetchSocialLinks exists in app-core.js or similar)
    // For now, using direct fetch here, but ideally from core
     try {
         const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
         const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
         const snapshot = await getDocs(q); // Use getDocs for one-time fetch if real-time not needed

         contactLinksContainer.innerHTML = ''; // Clear previous links

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
     } catch (error) {
         console.error("Error fetching/rendering social links:", error);
         contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هەڵە لە بارکردنی لینکەکان.</p>';
     }
}

function setupGpsButtonUI() {
     const getLocationBtn = document.getElementById('getLocationBtn');
     const profileAddressInput = document.getElementById('profileAddress');

     if (!getLocationBtn || !profileAddressInput) return;

     const btnSpan = getLocationBtn.querySelector('span');
     const originalBtnText = btnSpan ? btnSpan.textContent : 'وەرگرتنی ناونیشانم بە GPS';

     getLocationBtn.addEventListener('click', () => {
         if (!('geolocation' in navigator)) {
             showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
             return;
         }

         if(btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
         getLocationBtn.disabled = true;

         navigator.geolocation.getCurrentPosition(
              async (position) => { // Success callback
                  const { latitude, longitude } = position.coords;
                  try {
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
                       if(btnSpan) btnSpan.textContent = originalBtnText;
                      getLocationBtn.disabled = false;
                  }
              },
              (error) => { // Error callback
                  let message = t('error_generic'); // Default error
                  switch (error.code) {
                      case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                      case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                      case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                  }
                  showNotification(message, 'error');
                   if(btnSpan) btnSpan.textContent = originalBtnText;
                  getLocationBtn.disabled = false;
              }
         );
     });
}


// --- Start UI Initialization ---
document.addEventListener('DOMContentLoaded', initializeUI);
