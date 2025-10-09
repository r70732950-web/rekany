/**
 * All functions in this file are responsible for DOM manipulation.
 * They should not contain any business logic or state management.
 * They receive data as arguments and render it to the page.
 */
import { getDocs, collection, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


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
    
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : 'settingsBtn';
    updateActiveNav(activeBtnId);
}

export function openPopup(id, type = 'sheet', callbacks = {}) {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        document.getElementById('sheet-overlay').classList.add('show');
        element.classList.add('show');
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

export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
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


// --- Product Rendering ---

export function createProductCardElement(product, isAdmin, isProdFavorite, t) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id; // Add product id for event delegation

    const currentLanguage = localStorage.getItem('language') || 'ku_sorani';
    const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
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
//... all other UI-related functions...
