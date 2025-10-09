import { getDocs, collection, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * All functions in this file are responsible for DOM manipulation.
 * They should not contain any business logic or state management.
 * They receive data as arguments and render it to the page.
 */

// --- Page & Popup Management ---

export function showPage(pageId) {
    let mainPageScrollPosition = 0;
    const mainPage = document.getElementById('mainPage');
    if (mainPage && !mainPage.classList.contains('page-hidden')) {
        mainPageScrollPosition = window.scrollY;
    }

    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });

    if (pageId === 'mainPage') {
        setTimeout(() => {
            window.scrollTo(0, mainPageScrollPosition);
        }, 0);
    } else {
        window.scrollTo(0, 0);
    }
    
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : '');
    updateActiveNav(activeBtnId);
}

export function openPopup(id, type = 'sheet', callbacks = {}) {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        document.getElementById('sheet-overlay').classList.add('show');
        element.classList.add('show');
        // Use callbacks to render content, keeping UI logic separate from opening the popup
        if (id === 'cartSheet' && callbacks.renderCart) callbacks.renderCart();
        if (id === 'favoritesSheet' && callbacks.renderFavoritesPage) callbacks.renderFavoritesPage();
        if (id === 'categoriesSheet' && callbacks.renderCategoriesSheet) callbacks.renderCategoriesSheet();
        if (id === 'notificationsSheet' && callbacks.renderUserNotifications) callbacks.renderUserNotifications();
        if (id === 'termsSheet' && callbacks.renderPolicies) callbacks.renderPolicies();
        if (id === 'profileSheet' && callbacks.loadProfileData) callbacks.loadProfileData();
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}


export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    document.getElementById('sheet-overlay').classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add('active');
}

export function showNotification(message, type = 'success') {
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

export function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return textWithLinks.replace(/\n/g, '<br>');
}


// --- Loading States & Skeletons ---

export function renderSkeletonLoader() {
    const skeletonLoader = document.getElementById('skeletonLoader');
    skeletonLoader.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        skeletonLoader.appendChild(skeletonCard);
    }
    skeletonLoader.style.display = 'grid';
    document.getElementById('productsContainer').style.display = 'none';
    document.getElementById('loader').style.display = 'none';
}

export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}


// --- Product Rendering ---

export function createProductCardElement(product, isAdmin, isProdFavorite, t) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;

    const currentLanguage = localStorage.getItem('language') || 'ku_sorani';
    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    if (product.originalPrice && product.originalPrice > product.price) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[currentLanguage] && product.shippingInfo[currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
    }

    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites"><i class="${heartIconClass} fa-heart"></i></button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card"><i class="fas fa-cart-plus"></i><span>${t('add_to_cart')}</span></button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>`;
    return productCard;
}

export function renderProducts(products, isAdmin, favorites, t, eventHandlers) {
    const productsContainer = document.getElementById('productsContainer');
    productsContainer.innerHTML = '';
    if (!products || products.length === 0) return;

    products.forEach(product => {
        const isProdFavorite = favorites.includes(product.id);
        const productCard = createProductCardElement(product, isAdmin, isProdFavorite, t);
        productCard.classList.add('product-card-reveal');
        productCard.addEventListener('click', (event) => eventHandlers.handleCardClick(event, product));
        productsContainer.appendChild(productCard);
    });
}

export function showProductDetails(product, t, addToCartHandler) {
    if (!product) return;
    
    const currentLanguage = localStorage.getItem('language') || 'ku_sorani';
    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }
    
    // Slider Logic
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
    
    prevBtn.style.display = nextBtn.style.display = imageUrls.length > 1 ? 'flex' : 'none';
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText);
    
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCartHandler(product.id);
        closeCurrentPopup();
    };

    openPopup('productDetailSheet');
}

// --- Cart & Favorites Rendering ---

export function updateCartCount(cart) {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

export function renderCart(cart, t, userProfile, quantityHandler, removeHandler) {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const cartActions = document.getElementById('cartActions');
    
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        cartActions.style.display = 'none';
        return;
    }
    
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    cartActions.style.display = 'block';
    renderCartActionButtons(db, t, () => generateOrderMessage(cart, t, userProfile));

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        const currentLanguage = localStorage.getItem('language') || 'ku_sorani';
        const itemNameInCurrentLang = (item.name && item.name[currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');

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
            </div>`;
        cartItemsContainer.appendChild(cartItem);
    });
    
    document.getElementById('totalAmount').textContent = total.toLocaleString();
    
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = () => quantityHandler(btn.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = () => quantityHandler(btn.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = () => removeHandler(btn.dataset.id));
}

export function renderFavoritesPage(products, favorites, isAdmin, t, eventHandlers) {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
    
    favoritesContainer.innerHTML = '';
    const favoritedProducts = products.filter(p => favorites.includes(p.id));

    if (favoritedProducts.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
    } else {
        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';
        favoritedProducts.forEach(product => {
            const productCard = createProductCardElement(product, isAdmin, true, t);
            productCard.addEventListener('click', (event) => eventHandlers.handleCardClick(event, product));
            favoritesContainer.appendChild(productCard);
        });
    }
}


// ... and so on. You'd move ALL UI functions here, making sure to export them
// and pass any necessary data (like `db`, `t`, `currentLanguage`) as arguments.
// This is a partial example to show the structure. You must move all functions from the list.