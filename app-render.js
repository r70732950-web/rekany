// BEŞÊ SÊYEM: app-render.js
// Fonksiyonên çêkirina elementên HTML

import { state, t } from './app-setup.js'; // Import state for language and t for translation
import { isFavorite } from './app-data.js'; // Import favorite status check

/**
 * Formats description text, converting URLs to links and newlines to <br>.
 * @param {string} text - The description text.
 * @returns {string} - Formatted HTML string.
 */
export function formatDescription(text) {
    if (!text) return '';
    // Basic escaping
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex to find URLs (starting with http/https or www.)
    const urlRegex = /(\b(https?:\/\/[^\s]+)|(www\.[^\s]+))/g;
    // Replace URLs with anchor tags
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        // Ensure the URL starts with http:// or https://
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        // Create the link, opening in a new tab
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; font-weight: bold;">${url}</a>`;
    });
    // Replace newline characters with <br> tags for HTML display
    return textWithLinks.replace(/\n/g, '<br>');
}

/**
 * Creates the HTML element for a single product card.
 * @param {object} product - The product data object.
 * @returns {HTMLElement} - The product card element.
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card product-card-reveal'; // Add reveal class
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // --- Get localized name ---
    const nameInCurrentLang = (product.name && typeof product.name === 'object' && product.name[state.currentLanguage])
                              || (product.name && typeof product.name === 'object' && product.name.ku_sorani)
                              || (typeof product.name === 'string' ? product.name : t('product_no_name', {id: product.id})); // Fallback

    const mainImage = (product.imageUrls && product.imageUrls.length > 0)
                      ? product.imageUrls[0]
                      : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // --- Price and Discount ---
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} ${t('currency_symbol', {defaultValue: 'د.ع.'})}</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container">
                        <span class="product-price">${product.price.toLocaleString()} ${t('currency_symbol', {defaultValue: 'د.ع.'})}</span>
                        <del class="original-price">${product.originalPrice.toLocaleString()} ${t('currency_symbol', {defaultValue: 'د.ع.'})}</del>
                     </div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-${discountPercentage}%</div>`;
    }

    // --- Shipping Info ---
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && typeof product.shippingInfo === 'object' && product.shippingInfo[state.currentLanguage]?.trim();
     if (shippingText) {
         extraInfoHTML = `
             <div class="product-extra-info">
                 <div class="info-badge shipping-badge">
                     <i class="fas fa-truck"></i>${shippingText}
                 </div>
             </div>
         `;
     }

    // --- Favorite Button ---
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=${t('no_image_placeholder', {defaultValue: 'وێنە+نییە'})}';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="${t('add_to_favorites_label', {defaultValue: 'Add to favorites'})}" data-action="toggle-favorite">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="${t('share_product_label', {defaultValue: 'Share product'})}" data-action="share-product">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card" data-action="add-to-cart">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
             ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="${t('edit_product_label', {defaultValue: 'Edit product'})}" data-action="edit-product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="${t('delete_product_label', {defaultValue: 'Delete product'})}" data-action="delete-product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Add click listener for the card itself (excluding buttons)
    productCard.addEventListener('click', (event) => {
        // Only trigger details if the click is not on an interactive element
        if (!event.target.closest('button, a')) {
             document.dispatchEvent(new CustomEvent('showProductDetails', { detail: { productId: product.id } }));
        }
    });

    return productCard;
}

/**
 * Creates the HTML element for a promotional slider section.
 * Manages its own internal slider state and interval.
 * @param {object} cardGroupData - Object containing an array of card data { cards: [...] }.
 * @param {string} layoutId - Unique ID for this slider instance from the layout config.
 * @returns {HTMLElement|null} - The promo slider element or null if no cards.
 */
export function createPromoSliderElement(cardGroupData, layoutId) {
    if (!cardGroupData || !cardGroupData.cards || cardGroupData.cards.length === 0) {
        return null;
    }

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container promo-slider-container'; // Unique class
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

    const cards = cardGroupData.cards;
    const sliderState = { currentIndex: 0, intervalId: null };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // Use existing styles

    const updateCardContent = () => {
        const currentCard = cards[sliderState.currentIndex];
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani || 'https://placehold.co/600x200/e2e8f0/2d3748?text=Promo';
        const targetCategoryId = currentCard.categoryId;

        promoCardElement.innerHTML = `
            <div class="product-image-container">
                <img src="${imageUrl}" class="product-image" loading="lazy" alt="${t('promotion_alt', {defaultValue: 'Promotion'})}">
            </div>
            ${cards.length > 1 ? `
            <button class="promo-slider-btn prev" data-action="prev-slide"><i class="fas fa-chevron-left"></i></button>
            <button class="promo-slider-btn next" data-action="next-slide"><i class="fas fa-chevron-right"></i></button>
            ` : ''}
        `;
        promoCardElement.dataset.targetCategory = targetCategoryId; // Store target for click handling
    };

    updateCardContent(); // Initial render
    promoGrid.appendChild(promoCardElement);

    // Event Delegation for Slider and Card Click
    promoGrid.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        const targetCategory = promoCardElement.dataset.targetCategory;

        if (action === 'prev-slide') {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateCardContent();
            resetInterval(); // Reset interval on manual navigation
        } else if (action === 'next-slide') {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateCardContent();
            resetInterval(); // Reset interval on manual navigation
        } else if (targetCategory && targetCategory !== 'null' && targetCategory !== 'undefined') {
            // Clicked on the card itself (not buttons)
            document.dispatchEvent(new CustomEvent('navigateToCategory', { detail: { categoryId: targetCategory } }));
        }
    });

    const startInterval = () => {
        if (cards.length > 1) {
            // Clear existing interval *before* starting a new one
            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
            sliderState.intervalId = setInterval(() => {
                 // Check if the element still exists in the DOM
                 if (!document.getElementById(promoGrid.id)) {
                      clearInterval(sliderState.intervalId);
                      if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                           delete state.sliderIntervals[layoutId];
                      }
                      return;
                 }
                sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                updateCardContent();
            }, 5000);
            // Store the interval ID in the global state
            if (!state.sliderIntervals) state.sliderIntervals = {};
            state.sliderIntervals[layoutId] = sliderState.intervalId;
        }
    };

     const resetInterval = () => {
         if (sliderState.intervalId) {
             clearInterval(sliderState.intervalId);
         }
         startInterval();
     };

    startInterval(); // Start rotation

    return promoGrid;
}


/**
 * Creates the HTML element for a brands section.
 * @param {Array} brands - Array of brand data objects for a specific group.
 * @returns {HTMLElement|null} - The brands section element or null if no brands.
 */
export function createBrandsSectionElement(brands) {
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
                <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.onerror=null;this.style.opacity='0.5';">
            </div>
            <span>${brandName}</span>
        `;
        item.addEventListener('click', () => {
             document.dispatchEvent(new CustomEvent('navigateToBrandTarget', { detail: { brand } }));
        });
        brandsContainer.appendChild(item);
    });

    return sectionContainer;
}

/**
 * Creates the HTML element for the "Newest Products" section.
 * @param {Array} products - Array of newest product data objects.
 * @returns {HTMLElement|null} - The newest products section element or null if no products.
 */
export function createNewestProductsSectionElement(products) {
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    products.forEach(product => {
        const card = createProductCardElement(product);
        productsScroller.appendChild(card);
    });
    container.appendChild(productsScroller);

    return container;
}

/**
 * Creates the HTML element for a single shortcut row section.
 * @param {object} rowData - Data object for the row, including its cards.
 * @param {object} sectionNameObj - The name object {ku_sorani, ku_badini, ar} defined in the layout for this section.
 * @returns {HTMLElement|null} - The shortcut row section element or null if no cards.
 */
export function createSingleShortcutRowElement(rowData, sectionNameObj) {
    if (!rowData || !rowData.cards || rowData.cards.length === 0) return null;

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    const rowTitleText = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
    const titleElement = document.createElement('h3');
    titleElement.className = 'shortcut-row-title';
    titleElement.textContent = rowTitleText;
    sectionContainer.appendChild(titleElement);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'shortcut-cards-container';
    sectionContainer.appendChild(cardsContainer);

    rowData.cards.forEach(cardData => {
        const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
        const item = document.createElement('div');
        item.className = 'shortcut-card';
        item.innerHTML = `
            <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.onerror=null;this.style.opacity='0.5';">
            <div class="shortcut-card-name">${cardName}</div>
        `;
        item.addEventListener('click', () => {
             document.dispatchEvent(new CustomEvent('navigateToCategory', { detail: {
                 categoryId: cardData.categoryId || 'all',
                 subcategoryId: cardData.subcategoryId || 'all',
                 subSubcategoryId: cardData.subSubcategoryId || 'all'
             }}));
        });
        cardsContainer.appendChild(item);
    });

    return sectionContainer;
}

/**
 * Creates the HTML element for a single category row section.
 * @param {Array} products - Array of product data objects for the category.
 * @param {object} sectionData - The layout data for this section {categoryId, subcategoryId, subSubcategoryId, name}.
 * @param {string} actualCategoryName - The fetched, localized name of the category/subcategory.
 * @returns {HTMLElement|null} - The category row section element or null if no products.
 */
export function createSingleCategoryRowElement(products, sectionData, actualCategoryName) {
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'section-title-main';
    // Use fetched name if available, otherwise fallback to layout name
    titleEl.textContent = actualCategoryName || sectionData.name[state.currentLanguage] || sectionData.name.ku_sorani;
    header.appendChild(titleEl);

    const seeAllLink = document.createElement('a');
    seeAllLink.className = 'see-all-link';
    seeAllLink.textContent = t('see_all');
    seeAllLink.href = '#'; // Prevent default link behavior
    seeAllLink.addEventListener('click', (e) => {
        e.preventDefault();
         document.dispatchEvent(new CustomEvent('navigateToCategory', { detail: {
             categoryId: sectionData.categoryId,
             subcategoryId: sectionData.subcategoryId, // Will be null if only main category is targeted
             subSubcategoryId: sectionData.subSubcategoryId // Will be null if only main/sub category is targeted
         }}));
    });
    header.appendChild(seeAllLink);
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    products.forEach(product => {
        const card = createProductCardElement(product);
        productsScroller.appendChild(card);
    });
    container.appendChild(productsScroller);

    return container;
}

/**
 * Creates the HTML element for the "All Products" section preview on the home page.
 * @param {Array} products - Array of initial product data objects.
 * @returns {HTMLElement|null} - The all products section element or null if no products.
 */
export function createAllProductsSectionElement(products) {
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    products.forEach(product => {
        const card = createProductCardElement(product);
        productsGrid.appendChild(card);
    });
    container.appendChild(productsGrid);

    return container;
}


/**
 * Creates skeleton loader cards.
 * @param {number} count - Number of skeleton cards to create.
 * @returns {string} - HTML string for the skeleton loader.
 */
export function createSkeletonLoaderHTML(count = 8) {
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="skeleton-card">
                <div class="skeleton-image shimmer"></div>
                <div class="skeleton-text shimmer"></div>
                <div class="skeleton-price shimmer"></div>
                <div class="skeleton-button shimmer"></div>
            </div>
        `;
    }
    return skeletonHTML;
}

/**
 * Creates the HTML for the category selection sheet.
 * @param {Array} categories - Array of category objects.
 * @param {string} currentCategoryId - The ID of the currently selected category.
 * @returns {string} - HTML string for the category buttons.
 */
export function createCategoriesSheetHTML(categories, currentCategoryId) {
     if (!categories) return '';
     return categories.map(cat => {
         const isActive = currentCategoryId === cat.id;
         const categoryName = cat.id === 'all'
             ? t('all_categories_label')
             : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
         return `
             <button class="sheet-category-btn ${isActive ? 'active' : ''}" data-category-id="${cat.id}" data-action="select-sheet-category">
                 <i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}
             </button>
         `;
     }).join('');
}

/**
* Creates the HTML for the main category filter buttons.
* @param {Array} categories - Array of category objects.
* @param {string} currentCategoryId - The ID of the currently selected category.
* @returns {string} - HTML string for the main category buttons.
*/
export function createMainCategoriesHTML(categories, currentCategoryId) {
    if (!categories) return '';
    return categories.map(cat => {
        const isActive = currentCategoryId === cat.id;
        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        return `
            <button class="main-category-btn ${isActive ? 'active' : ''}" data-category-id="${cat.id}" data-action="select-main-category">
                <i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>
            </button>
        `;
    }).join('');
}

/**
* Creates the HTML for the subcategory filter buttons (shown below main categories).
* @param {Array} subcategories - Array of subcategory objects for the selected main category.
* @param {string} currentSubcategoryId - The ID of the currently selected subcategory.
* @returns {string} - HTML string for the subcategory buttons.
*/
export function createSubcategoriesHTML(subcategories, currentSubcategoryId) {
    if (!subcategories || subcategories.length === 0) return ''; // Don't render if no subcategories

    const allBtnHTML = `
        <button class="subcategory-btn ${currentSubcategoryId === 'all' ? 'active' : ''}" data-subcategory-id="all" data-action="select-subcategory">
             <div class="subcategory-image">
                 <svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>
             </div>
             <span>${t('all_categories_label')}</span>
        </button>
    `;

    const subcatButtonsHTML = subcategories.map(subcat => {
        const isActive = currentSubcategoryId === subcat.id;
        const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subcat.imageUrl || placeholderImg;
        return `
            <button class="subcategory-btn ${isActive ? 'active' : ''}" data-subcategory-id="${subcat.id}" data-main-category-id="${subcat.parentCategoryId || state.currentCategory}" data-action="select-subcategory">
                 <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                 <span>${subcatName}</span>
            </button>
        `;
    }).join('');

    return allBtnHTML + subcatButtonsHTML;
}


/**
* Creates the HTML for the sub-subcategory filter buttons (shown on detail page).
* @param {Array} subSubcategories - Array of sub-subcategory objects.
* @param {string} currentSubSubcategoryId - The ID of the currently selected sub-subcategory.
* @returns {string} - HTML string for the sub-subcategory buttons.
*/
export function createSubSubcategoriesHTML(subSubcategories, currentSubSubcategoryId) {
     if (!subSubcategories || subSubcategories.length === 0) return ''; // Don't render if none

     const allBtnHTML = `
         <button class="subcategory-btn ${currentSubSubcategoryId === 'all' ? 'active' : ''}" data-subsubcategory-id="all" data-action="select-subsubcategory">
              <div class="subcategory-image">
                  <svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>
              </div>
              <span>${t('all_categories_label')}</span>
         </button>
     `;

     const subSubcatButtonsHTML = subSubcategories.map(subSubcat => {
         const isActive = currentSubSubcategoryId === subSubcat.id;
         const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subSubcat.imageUrl || placeholderImg;
         return `
             <button class="subcategory-btn ${isActive ? 'active' : ''}" data-subsubcategory-id="${subSubcat.id}" data-action="select-subsubcategory">
                  <img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                  <span>${subSubcatName}</span>
             </button>
         `;
     }).join('');

     return allBtnHTML + subSubcatButtonsHTML;
}


/**
 * Creates the HTML for the cart items.
 * @param {Array} cartItems - Array of items currently in the cart.
 * @returns {string} - HTML string for the cart items.
 */
export function createCartItemsHTML(cartItems) {
    if (!cartItems || cartItems.length === 0) return '';
    return cartItems.map(item => {
        const itemTotal = item.price * item.quantity;
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage])
                                      || (item.name && item.name.ku_sorani)
                                      || (typeof item.name === 'string' ? item.name : t('cart_item_no_name', {defaultValue: 'کاڵای بێ ناو'}));
        const placeholderImg = 'https://placehold.co/60x60/e2e8f0/2d3748?text=?';

        return `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image || placeholderImg}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='${placeholderImg}';">
                <div class="cart-item-details">
                    <div class="cart-item-title">${itemNameInCurrentLang}</div>
                    <div class="cart-item-price">${item.price.toLocaleString()} ${t('currency_symbol', {defaultValue: 'د.ع.'})}</div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn increase-btn" data-action="increase-quantity" data-id="${item.id}">+</button>
                        <span class="quantity-text">${item.quantity}</span>
                        <button class="quantity-btn decrease-btn" data-action="decrease-quantity" data-id="${item.id}">-</button>
                    </div>
                </div>
                <div class="cart-item-subtotal">
                    <div>${t('total_price')}</div>
                    <span>${itemTotal.toLocaleString()} ${t('currency_symbol', {defaultValue: 'د.ع.'})}</span>
                    <button class="cart-item-remove" data-action="remove-from-cart" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}


/**
 * Creates the HTML for the cart action buttons (e.g., Send via WhatsApp).
 * @param {Array} contactMethods - Array of available contact method objects.
 * @returns {string} - HTML string for the action buttons.
 */
export function createCartActionButtonsHTML(contactMethods) {
    if (!contactMethods || contactMethods.length === 0) {
        return `<p style="text-align: center; color: var(--dark-gray);">${t('no_order_methods', {defaultValue: 'هیچ ڕێگایەکی ناردن دیاری نەکراوە.'})}</p>`;
    }
    return contactMethods.map(method => {
        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        return `
            <button class="whatsapp-btn" style="background-color: ${method.color};" data-action="send-order" data-method-type="${method.type}" data-method-value="${method.value}">
                <i class="${method.icon}"></i> <span>${name}</span>
            </button>
        `;
    }).join('');
}

/**
 * Creates the HTML for the user notifications list.
 * @param {Array} announcements - Array of announcement objects.
 * @returns {string} - HTML string for the notifications list.
 */
export function createNotificationsHTML(announcements) {
    if (!announcements || announcements.length === 0) {
        return `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
    }
    return announcements.map(announcement => {
        const date = new Date(announcement.createdAt);
        // Format date as YYYY/MM/DD
        const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';
        return `
            <div class="notification-item">
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }).join('');
}

/**
 * Creates the HTML for the dynamic contact links in settings.
 * @param {Array} socialLinks - Array of social link objects.
 * @returns {string} - HTML string for the contact links.
 */
export function createContactLinksHTML(socialLinks) {
     if (!socialLinks || socialLinks.length === 0) {
         return `<p style="padding: 15px; text-align: center;">${t('no_contact_links', {defaultValue: 'هیچ لینکی پەیوەندی نییە.'})}</p>`;
     }
     return socialLinks.map(link => {
         const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
         return `
             <a href="${link.url}" target="_blank" class="settings-item">
                 <div>
                     <i class="${link.icon}" style="margin-left: 10px;"></i>
                     <span>${name}</span>
                 </div>
                 <i class="fas fa-external-link-alt"></i>
             </a>
         `;
     }).join('');
}
