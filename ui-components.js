import { db } from './firebase-config.js';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import * as state from './state.js';
import * as service from './firestore-service.js';
import * as admin from './admin.js';

// DOM Elements
const mainPage = document.getElementById('mainPage');
const productsContainer = document.getElementById('productsContainer');
const skeletonLoader = document.getElementById('skeletonLoader');
const loader = document.getElementById('loader');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const emptyCartMessage = document.getElementById('emptyCartMessage');
const cartTotal = document.getElementById('cartTotal');
const totalAmount = document.getElementById('totalAmount');
const cartActions = document.getElementById('cartActions');
const favoritesContainer = document.getElementById('favoritesContainer');
const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
const sheetOverlay = document.getElementById('sheet-overlay');
const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
const subcategoriesContainer = document.getElementById('subcategoriesContainer');
const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
const notificationsListContainer = document.getElementById('notificationsListContainer');
const termsContentContainer = document.getElementById('termsContentContainer');


export function showPage(pageId) {
    if (!mainPage.classList.contains('page-hidden')) {
        state.setMainPageScrollPosition(window.scrollY);
    }

    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });

    if (pageId === 'mainPage') {
        setTimeout(() => {
            window.scrollTo(0, state.mainPageScrollPosition);
        }, 0);
    } else {
        window.scrollTo(0, 0);
    }
    
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : 'settingsBtn';
    updateActiveNav(activeBtnId);
}

export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function openPopup(id, type = 'sheet') {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') service.renderUserNotifications();
        if (id === 'termsSheet') service.renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = state.userProfile.name || '';
            document.getElementById('profileAddress').value = state.userProfile.address || '';
            document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
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

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
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

export function renderFavoritesPage() {
    favoritesContainer.innerHTML = '';
    const favoritedProducts = state.products.filter(p => state.favorites.includes(p.id));

    if (favoritedProducts.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
    } else {
        emptyFavoritesMessage.style.display = 'none';
        favoritesContainer.style.display = 'grid';
        favoritedProducts.forEach(product => {
            const productCard = createProductCardElement(product);
            favoritesContainer.appendChild(productCard);
        });
    }
}

export function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }
        
        const categoryName = cat.id === 'all' 
            ? state.t('all_categories_label') 
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = () => {
            state.setCurrentCategory(cat.id);
            state.setCurrentSubcategory('all');
            state.setCurrentSubSubcategory('all');
            renderSubcategories(state.currentCategory);
            renderSubSubcategories(state.currentCategory, state.currentSubcategory);
            service.searchProductsInFirestore('', true);
            history.back();
            renderMainCategories();
            showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

export function renderMainCategories() {
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
            ? state.t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = () => {
            state.setCurrentCategory(cat.id);
            state.setCurrentSubcategory('all');
            state.setCurrentSubSubcategory('all');
            renderMainCategories();
            renderSubcategories(state.currentCategory);
            service.searchProductsInFirestore('', true);
        };

        container.appendChild(btn);
    });
}

export async function renderSubcategories(categoryId) {
    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') {
        return;
    }
    // Logic moved to firestore-service.js
    const subcats = await service.fetchSubcategories(categoryId);
    
    if (subcats.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-btn active';
    allBtn.textContent = state.t('all_categories_label');
    allBtn.onclick = () => {
        state.setCurrentSubcategory('all');
        state.setCurrentSubSubcategory('all');
        document.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        subSubcategoriesContainer.innerHTML = '';
        service.searchProductsInFirestore('', true);
    };
    subcategoriesContainer.appendChild(allBtn);

    subcats.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = 'subcategory-btn';
        subcatBtn.textContent = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
        subcatBtn.onclick = () => {
            state.setCurrentSubcategory(subcat.id);
            state.setCurrentSubSubcategory('all');
            document.querySelectorAll('#subcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            subcatBtn.classList.add('active');
            renderSubSubcategories(categoryId, subcat.id);
            service.searchProductsInFirestore('', true);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });
}

export async function renderSubSubcategories(mainCatId, subCatId) {
    subSubcategoriesContainer.innerHTML = '';
    if (subCatId === 'all' || !mainCatId) return;

    const subSubcats = await service.fetchSubSubcategories(mainCatId, subCatId);

    if (subSubcats.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-btn active';
    allBtn.textContent = state.t('all_categories_label');
    allBtn.onclick = () => {
        state.setCurrentSubSubcategory('all');
        document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        service.searchProductsInFirestore('', true);
    };
    subSubcategoriesContainer.appendChild(allBtn);

    subSubcats.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = 'subcategory-btn';
        btn.textContent = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
        btn.onclick = () => {
            state.setCurrentSubSubcategory(subSubcat.id);
            document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            service.searchProductsInFirestore('', true);
        };
        subSubcategoriesContainer.appendChild(btn);
    });
}

export function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';

    const imageUrl = card.imageUrls[state.currentLanguage] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = card.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                state.setCurrentCategory(targetCategoryId);
                state.setCurrentSubcategory('all');
                state.setCurrentSubSubcategory('all');
                renderMainCategories();
                renderSubcategories(state.currentCategory);
                service.searchProductsInFirestore('', true);
                document.getElementById('mainCategoriesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(-1);
    });
    
    cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
        e.stopPropagation();
        changePromoCard(1);
    });

    return cardElement;
}

export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';

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

    const isProdFavorite = service.isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${state.t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${state.isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');

        if (addToCartButton) {
            service.addToCart(product.id);
            if (!addToCartButton.disabled) {
                const originalContent = addToCartButton.innerHTML;
                addToCartButton.disabled = true;
                addToCartButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                setTimeout(() => {
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${state.t('added_to_cart')}</span>`;
                    setTimeout(() => {
                        addToCartButton.innerHTML = originalContent;
                        addToCartButton.disabled = false;
                    }, 1500);
                }, 500);
            }
        } else if (target.closest('.edit-btn')) {
            admin.editProduct(product.id);
        } else if (target.closest('.delete-btn')) {
            admin.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            service.toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}

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

export function renderSkeletonLoader() {
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
    productsContainer.style.display = 'none';
    loader.style.display = 'none';
}

export function renderProducts() {
    productsContainer.innerHTML = '';
	if (!state.products || state.products.length === 0) {
		return;
	}

    state.products.forEach(item => {
        let element;
        if (item.isPromoCard) {
            element = createPromoCardElement(item);
        } else {
            element = createProductCardElement(item);
        }
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });

    setupScrollAnimations();
}

export function showProductDetailsWithData(product) {
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
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
            thumb.alt = `Thumbnail of ${nameInCurrentLang}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
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

    if (imageUrls.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }

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
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${state.t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        service.addToCart(product.id);
        closeCurrentPopup();
    };

    openPopup('productDetailSheet');
}

export function renderCart() {
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
    service.renderCartActionButtons();

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
                <div>${state.t('total_price')}</div>
                <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    totalAmount.textContent = total.toLocaleString();
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => service.updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => service.updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => service.removeFromCart(e.currentTarget.dataset.id));
}

export function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot) return;

    const cardData = state.allPromoCards[index];
    const newCardElement = createPromoCardElement(cardData);
    newCardElement.classList.add('product-card-reveal');

    promoCardSlot.style.opacity = 0;
    setTimeout(() => {
        if (promoCardSlot.parentNode) {
            promoCardSlot.parentNode.replaceChild(newCardElement, promoCardSlot);
            setTimeout(() => {
                newCardElement.classList.add('visible');
            }, 10);
        }
    }, 300);
}

export function changePromoCard(direction) {
    if (state.allPromoCards.length <= 1) return;

    let newIndex = state.currentPromoCardIndex + direction;

    if (newIndex >= state.allPromoCards.length) {
        newIndex = 0;
    } else if (newIndex < 0) {
        newIndex = state.allPromoCards.length - 1;
    }
    state.setCurrentPromoCardIndex(newIndex);
    displayPromoCard(state.currentPromoCardIndex);
    startPromoRotation(); // Reset the timer
}

export function startPromoRotation() {
    if (state.promoRotationInterval) {
        clearInterval(state.promoRotationInterval);
    }
    if (state.allPromoCards.length > 1) {
        const interval = setInterval(rotatePromoCard, 5000);
        state.setPromoRotationInterval(interval);
    }
}

function rotatePromoCard() {
    if (state.allPromoCards.length <= 1) return;
    const newIndex = (state.currentPromoCardIndex + 1) % state.allPromoCards.length;
    state.setCurrentPromoCardIndex(newIndex);
    displayPromoCard(state.currentPromoCardIndex);
}