// ui.js

import { t, currentLanguage, setLanguage, deferredPrompt, cart, favorites, userProfile, isAdmin, editingProductId, currentSearch, products, categories, subcategories, contactInfo, lastVisibleProductDoc, isLoadingMoreProducts, allProductsLoaded, PRODUCTS_PER_PAGE, saveCart, updateCartCount, saveFavorites, isFavorite, toggleFavorite, addToCart, updateQuantity, removeFromCart, generateOrderMessage, searchProductsInFirestore, editProductLogic, deleteProductLogic, getSubcategories, getSubSubcategories, saveProductLogic, saveCategoryLogic, updateCategoryLogic, deleteCategoryLogic, savePoliciesLogic, loadPoliciesLogic, sendAnnouncementLogic, deleteAnnouncementLogic, saveContactMethodLogic, deleteContactMethodLogic, saveSocialMediaLinkLogic, deleteSocialMediaLinkLogic, signInAdmin, signOutAdmin, requestNotificationPermissionLogic } from './app.js';
import { getFirestore, collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, onSnapshot, limit, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Global DOM elements (only for repeated access or complex logic)
const db = getFirestore();
const loginModal = document.getElementById('loginModal');
const addProductBtn = document.getElementById('addProductBtn');
const productFormModal = document.getElementById('productFormModal');
const productsContainer = document.getElementById('productsContainer');
const skeletonLoader = document.getElementById('skeletonLoader');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const loginForm = document.getElementById('loginForm');
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const imageInputsContainer = document.getElementById('imageInputsContainer');
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
const productCategorySelect = document.getElementById('productCategoryId');
const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
const productSubcategorySelect = document.getElementById('productSubcategoryId');
const subSubcategorySelectContainer = document.getElementById('subSubcategorySelectContainer');
const productSubSubcategorySelect = document.getElementById('productSubSubcategoryId');
const profileForm = document.getElementById('profileForm');
const settingsPage = document.getElementById('settingsPage');
const mainPage = document.getElementById('mainPage');
const contactToggle = document.getElementById('contactToggle');
const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
const socialLinksListContainer = document.getElementById('socialLinksListContainer');
const socialMediaToggle = document.getElementById('socialMediaToggle');
const notificationBadge = document.getElementById('notificationBadge');
const notificationsListContainer = document.getElementById('notificationsListContainer');
const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
const announcementForm = document.getElementById('announcementForm');
const termsContentContainer = document.getElementById('termsContentContainer');
const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
const policiesForm = document.getElementById('policiesForm');
const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');
let mainPageScrollPosition = 0;


// ------------------------------------------------
// Helper Functions
// ------------------------------------------------

export function debounce(func, delay = 500) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function showPage(pageId) {
    if (!mainPage.classList.contains('page-hidden')) {
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
    
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : 'settingsPage' === pageId ? 'settingsBtn' : 'profilePage' === pageId ? 'profileBtn' : 'homeBtn';
    updateActiveNav(activeBtnId);
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

function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

function openPopup(id, type = 'sheet') {
    const element = document.getElementById(id);
    if (!element) return;

    closeAllPopupsUI();
    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
            document.getElementById('profileName').value = userProfile.name || '';
            document.getElementById('profileAddress').value = userProfile.address || '';
            document.getElementById('profilePhone').value = userProfile.phone || '';
        }
    } else {
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        closeAllPopupsUI();
    }
}

window.addEventListener('popstate', (event) => {
    closeAllPopupsUI();
    const state = event.state;
    if (state && state.type === 'page') {
        showPage(state.id);
    } else if (state && (state.type === 'sheet' || state.type === 'modal')) {
        openPopup(state.id, state.type);
    } else {
        showPage('mainPage');
    }
});

export function handleInitialPageLoad() {
    const hash = window.location.hash.substring(1);
    const element = document.getElementById(hash);

    if (hash === 'settingsPage') {
        showPage('settingsPage');
        history.replaceState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
    } else {
        showPage('mainPage');
        history.replaceState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
    }

    if (element) {
        const isSheet = element.classList.contains('bottom-sheet');
        const isModal = element.classList.contains('modal');
        if (isSheet || isModal) {
            openPopup(hash, isSheet ? 'sheet' : 'modal');
        }
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

// ------------------------------------------------
// Product Rendering
// ------------------------------------------------

function setupScrollAnimations() {
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

export function renderProducts() {
    productsContainer.innerHTML = '';
	if (!products || products.length === 0) {
		return;
	}
    products.forEach(product => {
        const productCard = createProductCardElement(product);
		productCard.classList.add('product-card-reveal');
        productsContainer.appendChild(productCard);
    });
    setupScrollAnimations();
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

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';

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

    // Event listeners attached directly to the card (delegation in app.js is now here)
    productCard.addEventListener('click', async (event) => {
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');
        const favoriteButton = target.closest('.favorite-btn');
        const isExternalLink = target.closest('a');

        if (addToCartButton) {
            addToCart(product.id);
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
        } else if (editButton) {
            handleEditProduct(product.id);
        } else if (deleteButton) {
            const success = await deleteProductLogic(product.id);
            if(success) searchProductsInFirestore(currentSearch, true);
        } else if (favoriteButton) {
            toggleFavorite(product.id);
        } else if (!isExternalLink) {
            showProductDetails(product.id);
        }
    });

    return productCard;
}

// ------------------------------------------------
// Category Rendering (UI)
// ------------------------------------------------

export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat['name_' + currentLanguage] || cat.name;
        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = () => {
            handleCategoryChange(cat.id);
            renderMainCategories(); // Update UI
        };

        container.appendChild(btn);
    });
}

function handleCategoryChange(categoryId) {
    // Logic to update global state is in app.js. Call it here.
    const oldMainCatId = currentCategory;
    currentCategory = categoryId;
    currentSubcategory = 'all';
    currentSubSubcategory = 'all';

    renderSubcategories(currentCategory);
    subSubcategoriesContainer.innerHTML = '';
    searchProductsInFirestore('', true);
}


export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = '';

    if (categoryId === 'all') {
        return;
    }

    const fetchedSubcategories = await getSubcategories(categoryId);
    subcategories.splice(0, subcategories.length, ...fetchedSubcategories); // Update global subcategories list

    if (fetchedSubcategories.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-btn active';
    allBtn.textContent = t('all_categories_label');
    allBtn.onclick = () => {
        currentSubcategory = 'all';
        currentSubSubcategory = 'all';
        document.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        subSubcategoriesContainer.innerHTML = '';
        searchProductsInFirestore('', true);
    };
    subcategoriesContainer.appendChild(allBtn);

    fetchedSubcategories.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = 'subcategory-btn';
        subcatBtn.textContent = subcat['name_' + currentLanguage] || subcat.name_ku_sorani;
        subcatBtn.onclick = () => {
            currentSubcategory = subcat.id;
            currentSubSubcategory = 'all';
            document.querySelectorAll('#subcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            subcatBtn.classList.add('active');
            renderSubSubcategories(categoryId, subcat.id);
            searchProductsInFirestore('', true);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });
}

export async function renderSubSubcategories(mainCatId, subCatId) {
    subSubcategoriesContainer.innerHTML = '';
    if (subCatId === 'all' || !mainCatId) return;

    const fetchedSubSubcategories = await getSubSubcategories(mainCatId, subCatId);
    if (fetchedSubSubcategories.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-btn active';
    allBtn.textContent = t('all_categories_label');
    allBtn.onclick = () => {
        currentSubSubcategory = 'all';
        document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        searchProductsInFirestore('', true);
    };
    subSubcategoriesContainer.appendChild(allBtn);

    fetchedSubSubcategories.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = 'subcategory-btn';
        btn.textContent = subSubcat['name_' + currentLanguage] || subSubcat.name_ku_sorani;
        btn.onclick = () => {
            currentSubSubcategory = subSubcat.id;
            document.querySelectorAll('#subSubcategoriesContainer .subcategory-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            searchProductsInFirestore('', true);
        };
        subSubcategoriesContainer.appendChild(btn);
    });
}

export function renderCategoriesSheet() {
    sheetCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (currentCategory === cat.id) { btn.classList.add('active'); }
        const categoryName = cat['name_' + currentLanguage] || cat.name;
        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = () => {
            handleCategoryChange(cat.id);
            closeCurrentPopup();
            renderCategoriesSheet(); // Re-render to show active state
            showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

// ------------------------------------------------
// Product Detail Sheet Logic
// ------------------------------------------------

function showProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

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
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        closeCurrentPopup();
    };

    openPopup('productDetailSheet');
}

// ------------------------------------------------
// Cart and Favorites Rendering
// ------------------------------------------------

export async function renderCart() {
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
    renderCartActionButtons();

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

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
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    totalAmount.textContent = total.toLocaleString();
    document.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    document.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';

    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt"));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const method = { id: doc.id, ...doc.data() };
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn';
        btn.style.backgroundColor = method.color;

        const name = method['name_' + currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;

        btn.onclick = () => {
            const message = generateOrderMessage();
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
                    link = value;
                    break;
            }

            if (link) {
                window.open(link, '_blank');
            }
        };

        container.appendChild(btn);
    });
}

export function renderFavoritesPage() {
    favoritesContainer.innerHTML = '';
    const favoritedProducts = products.filter(p => favorites.includes(p.id));

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

// ------------------------------------------------
// Admin UI and Modals
// ------------------------------------------------

function createProductImageInputs(imageUrls = []) {
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
}

async function handleEditProduct(productId) {
    const product = await editProductLogic(productId);
    if (!product) return;

    editingProductId = productId;
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

    if (product.name && typeof product.name === 'object') {
        document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
        document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
        document.getElementById('productNameAr').value = product.name.ar || '';
    } else {
        document.getElementById('productNameKuSorani').value = product.name;
        document.getElementById('productNameKuBadini').value = '';
        document.getElementById('productNameAr').value = '';
    }
    
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';

    const categoryId = product.categoryId || product.category;
    document.getElementById('productCategoryId').value = categoryId;

    if (product.description) {
        document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
        document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
        document.getElementById('productDescriptionAr').value = product.description.ar || '';
    }

    const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
    createProductImageInputs(imageUrls);
    document.getElementById('productExternalLink').value = product.externalLink || '';
    
    if (product.shippingInfo) {
        document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
        document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
        document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
    } else {
        document.getElementById('shippingInfoKuSorani').value = '';
        document.getElementById('shippingInfoKuBadini').value = '';
        document.getElementById('shippingInfoAr').value = '';
    }

    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);
    await populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    openPopup('productFormModal', 'modal');
}

export function populateCategoryDropdown() {
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + currentLanguage] || cat.name;
        productCategorySelect.appendChild(option);
    });
}

export async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
    if (!categoryId) {
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        return;
    }

    productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    productSubcategorySelect.disabled = true;
    subcategorySelectContainer.style.display = 'block';

    const fetchedSubcategories = await getSubcategories(categoryId);
    
    productSubcategorySelect.innerHTML = '<option value="">-- هەڵبژاردن نییە --</option>'; // Allow null selection

    if (fetchedSubcategories.length === 0) {
        productSubcategorySelect.innerHTML = '<option value="">-- هیچ جۆرێکی لاوەکی نییە --</option>';
        subSubcategorySelectContainer.style.display = 'none';
    } else {
        fetchedSubcategories.forEach(subcat => {
            const option = document.createElement('option');
            option.value = subcat.id;
            option.textContent = subcat.name_ku_sorani || subcat.id;
            if (subcat.id === selectedSubcategoryId) {
                option.selected = true;
            }
            productSubcategorySelect.appendChild(option);
        });
    }

    productSubcategorySelect.disabled = false;
    // Call sub-sub dropdown update in case of edit
    if (selectedSubcategoryId) {
        const subSubCatId = document.getElementById('productSubSubcategoryId').value; // Might need to pass this through the main edit call
        populateSubSubcategoriesDropdown(categoryId, selectedSubcategoryId, subSubCatId);
    }
}

export async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
    const container = document.getElementById('subSubcategorySelectContainer');
    const select = document.getElementById('productSubSubcategoryId');
    
    if (!mainCategoryId || !subcategoryId) {
        container.style.display = 'none';
        select.innerHTML = '';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
    select.disabled = true;
    container.style.display = 'block';

    const fetchedSubSubcategories = await getSubSubcategories(mainCategoryId, subcategoryId);

    select.innerHTML = '<option value="">-- هیچ --</option>'; 
    if (fetchedSubSubcategories.length > 0) {
        fetchedSubSubcategories.forEach(subSubcat => {
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

export function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminCategoryManagement = document.getElementById('adminCategoryManagement');
    const adminContactMethodsManagement = document.getElementById('adminContactMethodsManagement');

    if (adminPoliciesManagement) {
        adminPoliciesManagement.style.display = isAdmin ? 'block' : 'none';
    }
    if (adminSocialMediaManagement) adminSocialMediaManagement.style.display = isAdmin ? 'block' : 'none';
    if (adminAnnouncementManagement) {
        adminAnnouncementManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) renderAdminAnnouncementsList();
    }

    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
    
    if (isAdmin) {
        settingsLogoutBtn.style.display = 'flex';
        settingsAdminLoginBtn.style.display = 'none';
        addProductBtn.style.display = 'flex';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'block';
            renderCategoryManagementUI();
        }
        if (adminContactMethodsManagement) {
            adminContactMethodsManagement.style.display = 'block';
            renderContactMethodsAdmin();
        }
    } else {
        settingsLogoutBtn.style.display = 'none';
        settingsAdminLoginBtn.style.display = 'flex';
        addProductBtn.style.display = 'none';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'none';
        }
        if (adminContactMethodsManagement) {
            adminContactMethodsManagement.style.display = 'none';
        }
    }
}

export function populateParentCategorySelect() {
    const select = document.getElementById('parentCategorySelect');
    select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
    try {
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat['name_' + currentLanguage] || cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating parent category select:", error);
        select.innerHTML = '<option value="">-- هەڵەیەک ڕوویدا --</option>';
    }
}

export function updateAdminCategorySelects() {
    const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
    const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
    
    if (!mainCatSelectForSubSub || !subCatSelectForSubSub) return;

    mainCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name_ku_sorani || cat.name;
        mainCatSelectForSubSub.appendChild(option);
    });

    // Check if the listener is already attached to avoid multiple calls
    if (!mainCatSelectForSubSub.listenerAttached) {
        mainCatSelectForSubSub.addEventListener('change', async () => {
            const mainCategoryId = mainCatSelectForSubSub.value;
            if (!mainCategoryId) {
                subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                return;
            };
            
            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>...خەریکی بارکردنە</option>';
            subCatSelectForSubSub.disabled = true;

            const fetchedSubcategories = await getSubcategories(mainCategoryId);
            
            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
            if (fetchedSubcategories.length > 0) {
                fetchedSubcategories.forEach(subcat => {
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani || subcat.name_ku_badini || 'بێ ناو';
                    subCatSelectForSubSub.appendChild(option);
                });
            } else {
                subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
            }
            subCatSelectForSubSub.disabled = false;
        });
        mainCatSelectForSubSub.listenerAttached = true;
    }
}

export async function renderCategoryManagementUI() {
    const container = document.getElementById('categoryListContainer');
    if (!container) return;
    container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

    let content = '';
    const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

    for (const mainDoc of mainCategoriesSnapshot.docs) {
        const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
        const mainPath = `categories/${mainCategory.id}`;
        content += `
            <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                    <div>
                        <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;

        const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
        const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
        for (const subDoc of subCategoriesSnapshot.docs) {
            const subCategory = { id: subDoc.id, ...subDoc.data() };
            const subPath = `${mainPath}/subcategories/${subCategory.id}`;
            content += `
                <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                        <div>
                            <button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-path="${subPath}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            
            const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
            const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
            for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                content += `
                    <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;
            }
        }
    }

    container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.path, btn.dataset.level));
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.path, btn.dataset.name));
    });
}

async function openEditCategoryModal(docPath, level) {
    const docRef = doc(db, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
        return;
    }
    const category = docSnap.data();
    
    document.getElementById('editCategoryDocPath').value = docPath;
    document.getElementById('editCategoryLevel').value = level;
    
    document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || '';
    document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || '';
    document.getElementById('editCategoryNameAr').value = category.name_ar || '';
    document.getElementById('editCategoryOrder').value = category.order || 0;

    const iconField = document.getElementById('editIconField');
    if (level === '1') {
        iconField.style.display = 'block';
        document.getElementById('editCategoryIcon').value = category.icon || '';
    } else {
        iconField.style.display = 'none';
    }

    openPopup('editCategoryModal', 'modal');
}

async function handleDeleteCategory(docPath, categoryName) {
    const success = await deleteCategoryLogic(docPath, categoryName);
    if(success) renderCategoryManagementUI();
}

export async function renderContactMethodsAdmin() {
    const container = document.getElementById('contactMethodsListContainer');
    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
    const q = query(methodsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const name = method['name_' + currentLanguage] || method.name_ku_sorani;

            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${method.icon}" style="color: ${method.color};"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${method.value}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteContactMethodLogic(method.id);
            container.appendChild(item);
        });
    });
}

export function renderSocialMediaLinks() {
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        socialLinksListContainer.innerHTML = '';
        if (snapshot.empty) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const link = { id: doc.id, ...doc.data() };
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${link.icon}"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${link.url}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;

            item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLinkLogic(link.id);
            socialLinksListContainer.appendChild(item);
        });
    });
}

export function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

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
    });
}

export async function renderPolicies() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await loadPoliciesLogic();

    const content = policies[currentLanguage] || policies.ku_sorani || '';
    termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
}

export async function loadPoliciesForAdmin() {
    const policies = await loadPoliciesLogic();
    document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || '';
    document.getElementById('policiesContentKuBadini').value = policies.ku_badini || '';
    document.getElementById('policiesContentAr').value = policies.ar || '';
}

// ------------------------------------------------
// Notification Logic (UI)
// ------------------------------------------------

export function checkNewAnnouncements() {
    const announcementsCollection = collection(db, "announcements");
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
}

export async function renderUserNotifications() {
    const announcementsCollection = collection(db, "announcements");
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = '';
    if (snapshot.empty) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        const title = (announcement.title && announcement.title[currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

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

    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

export function renderAdminAnnouncementsList() {
    const announcementsCollection = collection(db, "announcements");
    const container = document.getElementById('announcementsListContainer');
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
            return;
        }
        snapshot.forEach(doc => {
            const announcement = { id: doc.id, ...doc.data() };
            const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان';
            const item = document.createElement('div');
            item.className = 'admin-notification-item';
            item.innerHTML = `
                <div class="admin-notification-details">
                    <div class="notification-title">${title}</div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').addEventListener('click', async () => {
                const success = await deleteAnnouncementLogic(announcement.id);
                if(success) renderAdminAnnouncementsList();
            });
            container.appendChild(item);
        });
    });
}

// ------------------------------------------------
// Event Listeners Setup
// ------------------------------------------------

export function setupUIEventListeners() {
    // Navigation and Popups
    document.getElementById('homeBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        showPage('mainPage');
    };
    document.getElementById('settingsBtn').onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        showPage('settingsPage');
    };
    document.getElementById('profileBtn').onclick = () => openPopup('profileSheet');
    document.getElementById('cartBtn').onclick = () => openPopup('cartSheet');
    document.getElementById('categoriesBtn').onclick = () => openPopup('categoriesSheet');
    document.getElementById('settingsFavoritesBtn').onclick = () => openPopup('favoritesSheet');
    document.getElementById('settingsAdminLoginBtn').onclick = () => openPopup('loginModal', 'modal');
    document.getElementById('addProductBtn').onclick = () => {
        editingProductId = null;
        productForm.reset();
        createProductImageInputs();
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        formTitle.textContent = 'زیادکردنی کاڵای نوێ';
        productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        openPopup('productFormModal', 'modal');
    };
    document.getElementById('settingsLogoutBtn').onclick = signOutAdmin;

    sheetOverlay.onclick = closeCurrentPopup;
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    // Forms
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await signInAdmin(email, password);
        closeCurrentPopup();
    };

    productCategorySelect.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value);
        populateSubSubcategoriesDropdown(null, null);
    });

    productSubcategorySelect.addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId').value;
        populateSubSubcategoriesDropdown(mainCatId, e.target.value);
    });

    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
        if (imageUrls.length === 0) {
            showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
            return;
        }

        const productData = {
            name: {
                ku_sorani: document.getElementById('productNameKuSorani').value,
                ku_badini: document.getElementById('productNameKuBadini').value,
                ar: document.getElementById('productNameAr').value
            },
            searchableName: document.getElementById('productNameKuSorani').value.toLowerCase(),
            price: parseInt(document.getElementById('productPrice').value),
            originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
            categoryId: document.getElementById('productCategoryId').value,
            subcategoryId: document.getElementById('productSubcategoryId').value || null,
            subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
            description: {
                ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                ku_badini: document.getElementById('productDescriptionKuBadini').value,
                ar: document.getElementById('productDescriptionAr').value
            },
            imageUrls: imageUrls,
            createdAt: editingProductId ? undefined : Date.now(),
            externalLink: document.getElementById('productExternalLink').value || null,
            shippingInfo: {
                ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                ar: document.getElementById('shippingInfoAr').value.trim()
            }
        };

        const success = await saveProductLogic(productData, !!editingProductId);
        if (success) closeCurrentPopup();
    };

    imageInputsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('productImageUrl')) {
            const previewImg = e.target.nextElementSibling;
            const url = e.target.value;
            if (url) { previewImg.src = url; }
            else {
                const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        }
    });

    const debouncedSearch = debounce((term) => {
        searchProductsInFirestore(term, true);
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        currentSearch = searchTerm;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        searchProductsInFirestore('', true);
    };

    // Settings
    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    socialMediaToggle.onclick = () => {
        const container = adminSocialMediaManagement.querySelector('.contact-links-container');
        const chevron = socialMediaToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        userProfile.name = document.getElementById('profileName').value;
        userProfile.address = document.getElementById('profileAddress').value;
        userProfile.phone = document.getElementById('profilePhone').value;
        localStorage.setItem('maten_store_profile', JSON.stringify(userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                installBtn.style.display = 'none';
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
        });
    }

    // Admin Category Management
    const addCategoryForm = document.getElementById('addCategoryForm');
    const addSubcategoryForm = document.getElementById('addSubcategoryForm');
    const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');

    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const categoryData = {
                name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                name_ar: document.getElementById('mainCategoryNameAr').value,
                icon: document.getElementById('mainCategoryIcon').value,
                order: parseInt(document.getElementById('mainCategoryOrder').value)
            };

            const success = await saveCategoryLogic(categoryData, false, false);
            if(success) addCategoryForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
        });
    }

    if (addSubcategoryForm) {
        addSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            const parentCategoryId = document.getElementById('parentCategorySelect').value;

            if (!parentCategoryId) { showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error'); return; }

            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const subcategoryData = {
                name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
                name_ar: document.getElementById('subcategoryNameAr').value,
                order: parseInt(document.getElementById('subcategoryOrder').value) || 0
            };

            const success = await saveCategoryLogic(subcategoryData, true, false, parentCategoryId);
            if(success) addSubcategoryForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
        });
    }
    
    if (addSubSubcategoryForm) {
        addSubSubcategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
            const mainCatId = mainCatSelect.value;
            const subCatId = subCatSelect.value;

            if (!mainCatId || !subCatId) { showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error'); return; }

            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const subSubcategoryData = {
                name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                name_ar: document.getElementById('subSubcategoryNameAr').value,
                order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                createdAt: Date.now()
            };

            const success = await saveCategoryLogic(subSubcategoryData, false, true, mainCatId, subCatId);
            if(success) {
                addSubSubcategoryForm.reset();
                mainCatSelect.value = '';
                subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
            }
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی جۆری نوێ';
        });
    }
    
    const editCategoryForm = document.getElementById('editCategoryForm');
    if (editCategoryForm) {
        editCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const docPath = document.getElementById('editCategoryDocPath').value;
            const level = document.getElementById('editCategoryLevel').value;

            let updateData = {
                name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                name_ar: document.getElementById('editCategoryNameAr').value,
                order: parseInt(document.getElementById('editCategoryOrder').value) || 0
            };

            if (level === '1') {
                updateData.icon = document.getElementById('editCategoryIcon').value;
            }
            
            const success = await updateCategoryLogic(docPath, updateData);
            if(success) closeCurrentPopup();
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
        });
    }

    // Admin Contact Methods
    const addContactMethodForm = document.getElementById('addContactMethodForm');
    if (addContactMethodForm) {
        addContactMethodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const methodData = {
                type: document.getElementById('contactMethodType').value,
                value: document.getElementById('contactMethodValue').value,
                name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                name_ar: document.getElementById('contactMethodNameAr').value,
                icon: document.getElementById('contactMethodIcon').value,
                color: document.getElementById('contactMethodColor').value,
                createdAt: Date.now()
            };

            const success = await saveContactMethodLogic(methodData);
            if(success) addContactMethodForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی شێواز';
        });
    }

    // Admin Social Media Management
    const addSocialMediaForm = document.getElementById('addSocialMediaForm');
    if (addSocialMediaForm) {
        addSocialMediaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const linkData = {
                name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                name_ku_badini: document.getElementById('socialNameKuBadini').value,
                name_ar: document.getElementById('socialNameAr').value,
                url: document.getElementById('socialUrl').value,
                icon: document.getElementById('socialIcon').value,
                createdAt: Date.now()
            };

            const success = await saveSocialMediaLinkLogic(linkData);
            if(success) addSocialMediaForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردنی لینک';
        });
    }

    // Admin Announcements
    document.getElementById('notificationBtn').addEventListener('click', () => openPopup('notificationsSheet'));
    if (announcementForm) {
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...ناردن';

            const announcementData = {
                title: {
                    ku_sorani: document.getElementById('announcementTitleKuSorani').value,
                    ku_badini: document.getElementById('announcementTitleKuBadini').value,
                    ar: document.getElementById('announcementTitleAr').value,
                },
                content: {
                    ku_sorani: document.getElementById('announcementContentKuSorani').value,
                    ku_badini: document.getElementById('announcementContentKuBadini').value,
                    ar: document.getElementById('announcementContentAr').value,
                },
                createdAt: Date.now()
            };

            await sendAnnouncementLogic(announcementData);
            announcementForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = t('send_announcement_button');
        });
    }

    // Policies
    document.getElementById('termsAndPoliciesBtn').addEventListener('click', () => openPopup('termsSheet'));
    if (policiesForm) {
        policiesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...پاشەکەوت دەکرێت';

            const policiesData = {
                content: {
                    ku_sorani: document.getElementById('policiesContentKuSorani').value,
                    ku_badini: document.getElementById('policiesContentKuBadini').value,
                    ar: document.getElementById('policiesContentAr').value,
                }
            };

            await savePoliciesLogic(policiesData);
            submitButton.disabled = false;
            submitButton.textContent = 'پاشەکەوتکردن';
        });
    }

    // Notifications and Updates
    document.getElementById('enableNotificationsBtn').addEventListener('click', requestNotificationPermissionLogic);
    document.getElementById('forceUpdateBtn').addEventListener('click', async () => {
        if (confirm(t('update_confirm'))) {
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }

                if (window.caches) {
                    const keys = await window.caches.keys();
                    await Promise.all(keys.map(key => window.caches.delete(key)));
                }

                showNotification(t('update_success'), 'success');

                setTimeout(() => {
                    window.location.reload(true);
                }, 1500);

            } catch (error) {
                console.error('Error during force update:', error);
                showNotification(t('error_generic'), 'error');
            }
        }
    });

    // PWA Scroll Observer
    setupScrollObserver();

    // Welcome message display
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            searchProductsInFirestore(currentSearch, false);
        }
    }, {
        root: null,
        threshold: 0.1
    });

    observer.observe(trigger);
}

export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    if (!getLocationBtn) return;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
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
            showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
        } finally {
            btnSpan.textContent = originalBtnText;
            getLocationBtn.disabled = false;
        }
    }

    function errorCallback(error) {
        let message = '';
        switch (error.code) {
            case 1:
                message = 'ڕێگەت نەدا GPS بەکاربهێنرێت';
                break;
            case 2:
                message = 'شوێنەکەت نەدۆزرایەوە';
                break;
            case 3:
                message = 'کاتی داواکارییەکە تەواو بوو';
                break;
            default:
                message = 'هەڵەیەکی نادیار ڕوویدا';
                break;
        }
        showNotification(message, 'error');
        btnSpan.textContent = originalBtnText;
        getLocationBtn.disabled = false;
    }
}