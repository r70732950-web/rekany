// ui-logic.js
// Handles UI rendering, updates, and interactions.

import { state, translations, productsCollection, db, categoriesCollection } from './app-setup.js';
import { getDoc, doc, query, where, limit, getDocs, orderBy, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { formatDescription, t, showNotification, debounce } from './utils.js'; // Assuming utils.js exists or will be created
import {
    isFavorite, toggleFavorite,
    addToCart, updateQuantity, removeFromCart,
    navigateToFilter, showSubcategoryDetailPage,
    closeCurrentPopup, openPopup, // Might need adjustments if state changes trigger UI
    generateOrderMessage, // This might fit better in data-logic if complex
    saveCurrentScrollPosition
} from './data-logic.js'; // Functions will be moved here later
import { updateAdminCategoryDropdowns, updateShortcutCardCategoryDropdowns } from './admin-helpers.js'; // Assuming admin-helpers.js for admin specific UI updates

// --- DOM Element References (Imported from app-setup.js or passed as arguments) ---
import {
    loginModal, addProductBtn, productFormModal, productsContainer, skeletonLoader, searchInput,
    clearSearchBtn, loginForm, productForm, formTitle, imageInputsContainer, loader,
    cartBtn, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, categoriesBtn, sheetOverlay, sheetCategoriesContainer,
    productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    termsAndPoliciesBtn, termsSheet, termsContentContainer, subSubcategoriesContainer,
    subcategoriesContainer // Ensure this is exported from app-setup
} from './app-setup.js';


/**
 * Updates the header view based on the current page.
 * @param {string} pageId - The ID of the page being shown.
 * @param {string} [title=''] - The title for subpages.
 */
export function updateHeaderView(pageId, title = '') {
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

/**
 * Shows the specified page and hides others.
 * @param {string} pageId - The ID of the page to show.
 * @param {string} [pageTitle=''] - The title for the header if it's a subpage.
 */
export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // Scroll to top only for new page views, history navigation handles scroll restoration
    if (pageId !== 'mainPage' && (!history.state || history.state.id !== pageId)) {
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

/**
 * Closes all modals and bottom sheets.
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay?.classList.remove('show'); // Add check for sheetOverlay
    document.body.classList.remove('overlay-active');
}

/**
 * Updates the active state of the bottom navigation buttons.
 * @param {string} activeBtnId - The ID of the button to mark as active.
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Populates the category dropdown in the product form.
 */
export function populateCategoryDropdown(categories) {
    if (!productCategorySelect) return;
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

/**
 * Renders the categories list in the bottom sheet.
 */
export function renderCategoriesSheet(categories) {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`; // Default icon

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
            closeCurrentPopup();
            showPage('mainPage'); // Ensure main page is shown
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Renders the main category buttons (horizontal scroll).
 */
export function renderMainCategories(categories) {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Default icon

        btn.onclick = async () => {
            await navigateToFilter({
                category: cat.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
             // No need to call showPage here, navigateToFilter handles rendering
        };

        container.appendChild(btn);
    });
}

/**
 * Renders subcategory buttons based on the selected main category.
 */
export async function renderSubcategoriesUI(mainCategoryId, subcategoriesData) {
     if (!subcategoriesContainer) return; // Add check
    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = ''; // Clear sub-subcategories as well
    subSubcategoriesContainer.style.display = 'none'; // Hide sub-sub container

    if (mainCategoryId === 'all' || subcategoriesData.length === 0) {
        subcategoriesContainer.style.display = 'none'; // Hide if 'All' or no subcategories
        return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show the container

    // Add 'All' button for subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
        await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
    };
    subcategoriesContainer.appendChild(allBtn);

    // Add actual subcategory buttons
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
             // Go to detail page when a subcategory is clicked
             showSubcategoryDetailPage(mainCategoryId, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });
}

/**
 * Renders sub-subcategory buttons based on the selected subcategory.
 */
export async function renderSubSubcategoriesUI(mainCatId, subCatId, subSubcategoriesData) {
     if (!subSubcategoriesContainer) return; // Add check
    subSubcategoriesContainer.innerHTML = '';

    if (!subCatId || subCatId === 'all' || subSubcategoriesData.length === 0) {
        subSubcategoriesContainer.style.display = 'none'; // Hide if no subcategory selected or no sub-subs
        return;
    }

    subSubcategoriesContainer.style.display = 'flex'; // Show the container

    // Add 'All' button for sub-subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
        await navigateToFilter({ subSubcategory: 'all' });
    };
    subSubcategoriesContainer.appendChild(allBtn);

    // Add actual sub-subcategory buttons
    subSubcategoriesData.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;

        const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subSubcat.imageUrl || placeholderImg;

        btn.innerHTML = `
            <img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
            <span>${subSubcatName}</span>
        `;

        btn.onclick = async () => {
            await navigateToFilter({ subSubcategory: subSubcat.id });
        };
        subSubcategoriesContainer.appendChild(btn);
    });
}

/**
 * Creates the HTML element for a single product card.
 * @param {object} product - The product data.
 * @param {boolean} isAdmin - Whether the current user is an admin.
 * @returns {HTMLElement} The product card element.
 */
export function createProductCardElement(product, isAdmin) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;

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

    // --- Add Event Listeners ---
    const shareBtn = productCard.querySelector('.share-btn-card');
    if (shareBtn) {
        shareBtn.addEventListener('click', async (event) => {
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
    }


    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true'; // Check current admin status

        if (addToCartButton) {
            event.stopPropagation(); // Prevent opening details view
            addToCart(product.id); // Call data logic function
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
            // Assuming AdminLogic is globally available or imported in app-main
            if (window.AdminLogic && typeof window.AdminLogic.editProduct === 'function') {
                window.AdminLogic.editProduct(product.id);
            }
        } else if (isAdminNow && target.closest('.delete-btn')) {
             event.stopPropagation();
             if (window.AdminLogic && typeof window.AdminLogic.deleteProduct === 'function') {
                window.AdminLogic.deleteProduct(product.id);
            }
        } else if (target.closest('.favorite-btn')) {
            event.stopPropagation();
            toggleFavorite(product.id, event); // Pass event to update UI immediately
        } else if (target.closest('.share-btn-card')) {
             // Event listener is already attached directly to the share button
             event.stopPropagation();
        } else if (!target.closest('a')) { // Prevent triggering if clicking a link in description
             // Open product details (this function needs product data)
             showProductDetailsWithData(product);
        }
    });

    return productCard;
}

/**
 * Sets up Intersection Observer for scroll animations on product cards.
 */
export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Renders skeleton loading placeholders.
 * @param {HTMLElement} [container=skeletonLoader] - The container to render into.
 * @param {number} [count=8] - The number of skeletons to render.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
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
    if (container === skeletonLoader && productsContainer) {
        productsContainer.style.display = 'none';
    }
     if (loader) loader.style.display = 'none'; // Ensure main loader is hidden
}

/**
 * Renders the list of products in the main container.
 */
export function renderProducts(products, isAdmin) {
    if (!productsContainer) return;
    productsContainer.innerHTML = ''; // Clear previous products first
    if (!products || products.length === 0) {
        // Optionally show a "no products found" message if needed
        return;
    }

    products.forEach(item => {
        let element = createProductCardElement(item, isAdmin); // Pass isAdmin status
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Re-apply scroll animations
}

/**
 * Updates the cart UI based on the current cart state.
 */
export function renderCart(cartData) {
    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return;

    cartItemsContainer.innerHTML = '';
    if (!cartData || cartData.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(); // This needs contact methods data

    let total = 0;
    cartData.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
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
    totalAmount.textContent = total.toLocaleString();

    // Attach event listeners after rendering
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/**
 * Renders the action buttons (e.g., WhatsApp, Viber) in the cart.
 * Needs contact methods data fetched separately.
 */
export async function renderCartActionButtons() {
     if (!cartActions) return;
     cartActions.innerHTML = ''; // Clear previous buttons

     try {
         const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
         const q = query(methodsCollection, orderBy("createdAt"));
         const snapshot = await getDocs(q);

         if (snapshot.empty) {
             cartActions.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
             return;
         }

         snapshot.forEach(doc => {
             const method = { id: doc.id, ...doc.data() };
             const btn = document.createElement('button');
             btn.className = 'whatsapp-btn'; // Use a generic class or style based on method.type
             btn.style.backgroundColor = method.color || '#ccc'; // Default color

             const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
             btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Default icon

             btn.onclick = () => {
                 const message = generateOrderMessage(); // Assumes this reads state.cart
                 if (!message) return;

                 let link = '';
                 const encodedMessage = encodeURIComponent(message);
                 const value = method.value;

                 switch (method.type) {
                     case 'whatsapp':
                         link = `https://wa.me/${value}?text=${encodedMessage}`;
                         break;
                     case 'viber':
                         link = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
                         break;
                     case 'telegram':
                         link = `https://t.me/${value}?text=${encodedMessage}`;
                         break;
                     case 'phone':
                         link = `tel:${value}`;
                         break;
                     case 'url':
                         link = value; // Assume the value is the full URL
                         break;
                 }

                 if (link) {
                     window.open(link, '_blank');
                 }
             };

             cartActions.appendChild(btn);
         });
     } catch (error) {
         console.error("Error fetching contact methods for cart:", error);
         cartActions.innerHTML = '<p>هەڵە لە هێنانی ڕێگاکانی ناردن.</p>';
     }
}

/**
 * Renders the favorites list in the favorites sheet.
 */
export async function renderFavoritesPage(favoriteIds, isAdmin) {
    if (!favoritesContainer || !emptyFavoritesMessage) return;
    favoritesContainer.innerHTML = '';

    if (!favoriteIds || favoriteIds.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';

    renderSkeletonLoader(favoritesContainer, favoriteIds.length); // Show skeletons

    try {
        const fetchPromises = favoriteIds.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Clear skeletons

        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product, isAdmin);
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

/**
 * Renders user notifications in the notifications sheet.
 */
export async function renderUserNotificationsUI(announcements) {
    if (!notificationsListContainer || !notificationBadge) return;
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

    // Mark notifications as seen
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp.toString());
    notificationBadge.style.display = 'none';
}

/**
 * Renders the terms and policies content.
 */
export function renderPoliciesUI(policiesData) {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;

    if (policiesData && policiesData.content) {
        const policies = policiesData.content;
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

/**
 * Renders the social media contact links in the settings page.
 */
export function renderContactLinksUI(links) {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;
    contactLinksContainer.innerHTML = '';

    if (!links || links.length === 0) {
        contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
        return;
    }

    links.forEach(link => {
        const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
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
        contactLinksContainer.appendChild(linkElement);
    });
}

/**
 * Shows the initial welcome message modal if it's the first visit.
 */
export function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        // Need openPopup from data-logic or app-main
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

/**
 * Sets up the GPS button functionality in the profile sheet.
 */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return;
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan?.textContent || 'وەرگرتنی ناونیشانم بە GPS'; // Provide default

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        if (btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    async function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

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
            if (btnSpan) btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
            case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
            case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
            default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
        }
        showNotification(message, 'error');
        if (btnSpan) btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}

/**
 * Creates the image input fields in the product form.
 */
export function createProductImageInputs(imageUrls = []) {
     if (!imageInputsContainer) return;
    imageInputsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const isRequired = i === 0 ? 'required' : '';
        const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
        const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `<input type="text" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}><img src="${previewSrc}" class="image-preview-small" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;
        imageInputsContainer.appendChild(inputGroup);
    }

    // Add input listeners for previews immediately
    imageInputsContainer.querySelectorAll('.productImageUrl').forEach(input => {
        input.addEventListener('input', (e) => {
            const previewImg = e.target.nextElementSibling;
            const newUrl = e.target.value;
             const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
            if (newUrl) {
                previewImg.src = newUrl;
            } else {
                 previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        });
    });
}

/**
 * Populates the subcategories dropdown based on the selected main category.
 */
export async function populateSubcategoriesDropdown(mainCategoryId, subcategoriesData, selectedSubcategoryId = null) {
    if (!subcategorySelectContainer || !productSubcategorySelect) return;

    if (!mainCategoryId) {
        subcategorySelectContainer.style.display = 'none';
        document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Also hide sub-sub
        return;
    }

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    productSubcategorySelect.disabled = true;
    subcategorySelectContainer.style.display = 'block';

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

    if (!subcategoriesData || subcategoriesData.length === 0) {
        productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
        document.getElementById('subSubcategorySelectContainer').style.display = 'none'; // Hide sub-sub
    } else {
        subcategoriesData.forEach(subcat => {
            const option = document.createElement('option');
            option.value = subcat.id;
            option.textContent = subcat.name_ku_sorani || subcat.id; // Fallback to ID
            if (subcat.id === selectedSubcategoryId) {
                option.selected = true;
            }
            productSubcategorySelect.appendChild(option);
        });
    }
    productSubcategorySelect.disabled = false;
}

/**
 * Populates the sub-subcategories dropdown based on the selected subcategory.
 */
export async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, subSubcategoriesData, selectedSubSubcategoryId = null) {
    const container = document.getElementById('subSubcategorySelectContainer');
    const select = document.getElementById('productSubSubcategoryId');
    if (!container || !select) return;

    if (!mainCategoryId || !subcategoryId) {
        container.style.display = 'none';
        select.innerHTML = '';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    select.disabled = true;
    container.style.display = 'block';

    select.innerHTML = '<option value="">-- هیچ --</option>'; // Add 'None' option
    if (subSubcategoriesData && subSubcategoriesData.length > 0) {
        subSubcategoriesData.forEach(subSubcat => {
            const option = document.createElement('option');
            option.value = subSubcat.id;
            option.textContent = subSubcat.name_ku_sorani;
            if (subSubcat.id === selectedSubSubcategoryId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    select.disabled = false;
}

/**
 * Updates UI elements that depend on the loaded categories.
 */
export function updateCategoryDependentUI(categories) {
    if (!categories || categories.length === 0) return;
    populateCategoryDropdown(categories);
    renderMainCategories(categories);
    renderCategoriesSheet(categories); // Update sheet as well

    // Update admin dropdowns only if admin logic is loaded and user is admin
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (isAdmin && window.AdminLogic) {
         updateAdminCategoryDropdowns(categories); // Function expected in admin-helpers.js
         updateShortcutCardCategoryDropdowns(categories); // Function expected in admin-helpers.js
    }
}

/**
 * Updates the admin-specific UI visibility and potentially content.
 * Needs access to AdminLogic functions/state if content needs updates.
 */
export function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

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

    if (settingsLogoutBtn) settingsLogoutBtn.style.display = isAdmin ? 'flex' : 'none';
    if (settingsAdminLoginBtn) settingsAdminLoginBtn.style.display = isAdmin ? 'none' : 'flex';
    if (addProductBtn) addProductBtn.style.display = isAdmin ? 'flex' : 'none';

     // Rerender product cards if the admin status changes to show/hide edit/delete buttons
     const currentProducts = document.querySelectorAll('#productsContainer .product-card');
     if (currentProducts.length > 0) {
         const productIds = Array.from(currentProducts).map(card => card.dataset.productId);
         // You might need to fetch product data again or use cached data
         // For simplicity, just re-rendering existing cards might not update buttons correctly
         // A full re-render triggered from app-main might be better
         console.log("Admin status changed, consider re-rendering products if necessary.");
     }
}

// --- Functions related to Subcategory Detail Page ---

export async function renderSubSubcategoriesOnDetailPage(subSubcategoriesData, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Add 'All' button
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn active`; // Initially active
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
    allBtn.dataset.id = 'all';
    allBtn.onclick = () => {
        container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        const currentSearch = document.getElementById('subpageSearchInput').value || '';
        renderProductsOnDetailPageUI(subCatId, 'all', currentSearch); // Trigger product rendering for this selection
    };
    container.appendChild(allBtn);

    // Add specific sub-subcategory buttons
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
            const currentSearch = document.getElementById('subpageSearchInput').value || '';
            renderProductsOnDetailPageUI(subCatId, subSubcat.id, currentSearch); // Trigger product rendering
        };
        container.appendChild(btn);
    });
}

export async function renderProductsOnDetailPageUI(subCatId, subSubCatId, searchTerm) {
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const detailLoader = document.getElementById('detailPageLoader');
    if (!productsContainerDetail || !detailLoader) return;

    detailLoader.style.display = 'block';
    productsContainerDetail.innerHTML = '';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

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
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product, isAdmin);
                productsContainerDetail.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error rendering products for detail page UI:`, error);
        productsContainerDetail.innerHTML = '<p style="text-align:center; padding: 20px;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        detailLoader.style.display = 'none';
    }
}
// --- END: Subcategory Detail Page Functions ---

// Add other UI-related functions here as needed...
