// scripts/ui.js

import { translations } from './translations.js';

let appContext = {};

export function initializeUI(context) {
    appContext = context;
}

function t(key, replacements = {}) {
    const { currentLanguage } = appContext;
    let translation = translations[currentLanguage]?.[key] || translations['ku_sorani']?.[key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

export function applyLanguageUI(lang) {
    appContext.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const fetchedCategories = appContext.categories.filter(cat => cat.id !== 'all');
    appContext.categories = [{ id: 'all', name: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories];
    
    renderProducts();
    renderMainCategories();
    renderCategoriesSheet();
    if (document.getElementById('cartSheet')?.classList.contains('show')) renderCart();
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) renderFavoritesPage();
}

export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('page-hidden', page.id !== pageId);
    });
}

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeBtnId)?.classList.add('active');
}

export function formatDescription(text) {
    if (!text) return '';
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    let textWithLinks = escapedText.replace(urlRegex, url => `<a href="${url.startsWith('http') ? url : `https://${url}`}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    return textWithLinks.replace(/\n/g, '<br>');
}

export function _closeAllPopupsWithoutHistory() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    document.getElementById('sheet-overlay').classList.remove('show');
    document.body.classList.remove('overlay-active');
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

export function updateCartCount() {
    const totalItems = appContext.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

export function renderSkeletonLoader() {
    const { skeletonLoader, loader } = appContext;
    skeletonLoader.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        skeletonLoader.innerHTML += `<div class="skeleton-card"><div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div><div class="skeleton-price shimmer"></div><div class="skeleton-button shimmer"></div></div>`;
    }
    skeletonLoader.style.display = 'grid';
    loader.style.display = 'none';
}

function createProductCardElement(product) {
    const { currentLanguage, favorites, isAdmin } = appContext;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = product.id;

    const name = product.name?.[currentLanguage] || product.name?.ku_sorani || product.name;
    const image = product.imageUrls?.[0] || product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image';
    const isFav = favorites.includes(product.id);
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadge = '';

    if (product.originalPrice && product.originalPrice > product.price) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const percent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadge = `<div class="discount-badge">-%${percent}</div>`;
    }

    card.innerHTML = `
        <div class="product-image-container">
            <img src="${image}" alt="${name}" class="product-image" loading="lazy">
            ${discountBadge}
            <button class="favorite-btn ${isFav ? 'favorited' : ''}" aria-label="Add to favorites"><i class="${isFav ? 'fas' : 'far'} fa-heart"></i></button>
        </div>
        <div class="product-info">
            <div class="product-name">${name}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card"><i class="fas fa-cart-plus"></i> <span>${t('add_to_cart')}</span></button>
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn"><i class="fas fa-edit"></i></button>
            <button class="delete-btn"><i class="fas fa-trash"></i></button>
        </div>`;
    return card;
}

export function renderProducts() {
    const { productsContainer, products, currentCategory, currentSubcategory, currentSearch } = appContext;
    productsContainer.innerHTML = '';

    const filtered = products.filter(p => {
        const name = p.name?.[appContext.currentLanguage] || p.name?.ku_sorani || '';
        const catMatch = currentCategory === 'all' || p.categoryId === currentCategory;
        const subCatMatch = currentSubcategory === 'all' || !p.subcategoryId || p.subcategoryId === currentSubcategory;
        const searchMatch = name.toLowerCase().includes(currentSearch.toLowerCase());
        return catMatch && subCatMatch && searchMatch;
    });

    if (filtered.length === 0) {
        productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--dark-gray);">${t('product_not_found_error')}</div>`;
    } else {
        filtered.forEach(product => {
            const card = createProductCardElement(product);
            card.classList.add('product-card-reveal');
            productsContainer.appendChild(card);
        });
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.product-card-reveal').forEach(c => observer.observe(c));
    }
}

export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    container.innerHTML = '';
    appContext.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `main-category-btn ${appContext.currentCategory === cat.id ? 'active' : ''}`;
        btn.dataset.categoryId = cat.id;
        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${cat['name_' + appContext.currentLanguage] || cat.name}</span>`;
        container.appendChild(btn);
    });
}

export function renderSubcategoriesUI() {
    const { subcategoriesContainer, subcategories, currentLanguage } = appContext;
    subcategoriesContainer.innerHTML = '';

    if (subcategories.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-btn active';
    allBtn.textContent = t('all_categories_label');
    allBtn.dataset.subcategoryId = 'all';
    subcategoriesContainer.appendChild(allBtn);

    subcategories.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = 'subcategory-btn';
        subcatBtn.textContent = subcat['name_' + currentLanguage] || subcat.name_ku_sorani;
        subcatBtn.dataset.subcategoryId = subcat.id;
        subcategoriesContainer.appendChild(subcatBtn);
    });
}

export function renderCategoriesSheet() {
    const container = document.getElementById('sheetCategoriesContainer');
    container.innerHTML = '';
    appContext.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `sheet-category-btn ${appContext.currentCategory === cat.id ? 'active' : ''}`;
        btn.dataset.categoryId = cat.id;
        btn.innerHTML = `<i class="${cat.icon}"></i> ${cat['name_' + appContext.currentLanguage] || cat.name}`;
        container.appendChild(btn);
    });
}

export function renderCart() {
    const { cart, cartItemsContainer, emptyCartMessage, cartTotal, totalAmount } = appContext;
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartTotal.style.display = 'none';
        document.getElementById('cartActions').style.display = 'none';
        return;
    }
    emptyCartMessage.style.display = 'none';
    cartTotal.style.display = 'block';
    document.getElementById('cartActions').style.display = 'block';

    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const name = item.name?.[appContext.currentLanguage] || item.name?.ku_sorani || 'کاڵای بێ ناو';
        const cartItemHTML = `
            <img src="${item.image}" alt="${name}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${name}</div>
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
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = cartItemHTML;
        cartItemsContainer.appendChild(cartItem);
    });
    totalAmount.textContent = total.toLocaleString();
    renderCartActionButtons(); // <-- This line is added
}

export function renderFavoritesPage() {
    const { favoritesContainer, emptyFavoritesMessage, products, favorites } = appContext;
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

export function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    document.getElementById('addProductBtn').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('settingsLogoutBtn').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('settingsAdminLoginBtn').style.display = isAdmin ? 'none' : 'flex';
    document.getElementById('adminCategoryManagement').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('adminContactMethodsManagement').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('adminSocialMediaManagement').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('adminAnnouncementManagement').style.display = isAdmin ? 'block' : 'none';
}

export function populateCategoryDropdown() {
    const { categories, currentLanguage, productCategorySelect } = appContext;
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + currentLanguage] || cat.name;
        productCategorySelect.appendChild(option);
    });
}

// Function to render announcements for users
export function renderAnnouncements() {
    const container = document.getElementById('notificationsListContainer');
    if (!container) return;

    // Check if the function exists to avoid errors
    if (typeof getFirestore !== 'undefined' && typeof collection !== 'undefined' && typeof query !== 'undefined' && typeof orderBy !== 'undefined' && typeof onSnapshot !== 'undefined') {
        const { getFirestore, collection, query, orderBy, onSnapshot } = window.firebase.firestore;
        const db = getFirestore();
        const announcementsCollection = collection(db, "announcements");
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
                document.getElementById('notificationBadge').style.display = 'none';
                return;
            }

            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            const hasNew = snapshot.docs.some(doc => doc.data().createdAt > twentyFourHoursAgo);
            document.getElementById('notificationBadge').style.display = hasNew ? 'block' : 'none';

            snapshot.forEach(doc => {
                const item = doc.data();
                const title = item.title?.[appContext.currentLanguage] || item.title?.ku_sorani || '';
                const content = item.content?.[appContext.currentLanguage] || item.content?.ku_sorani || '';
                const date = new Date(item.createdAt).toLocaleDateString('ku-IQ');

                const notificationEl = document.createElement('div');
                notificationEl.className = 'notification-item';
                notificationEl.innerHTML = `
                    <div class="notification-header">
                        <div class="notification-title">${title}</div>
                        <div class="notification-date">${date}</div>
                    </div>
                    <div class="notification-content">${content}</div>
                `;
                container.appendChild(notificationEl);
            });
        }, (error) => {
            console.error("Error fetching announcements: ", error);
            container.innerHTML = `<div class="cart-empty"><p>${t('error_generic')}</p></div>`;
        });
    }
}

// Function to render the cart action buttons (WhatsApp, Viber, etc.)
export function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;

    if (typeof getFirestore !== 'undefined' && typeof collection !== 'undefined' && typeof getDocs !== 'undefined') {
        const { getFirestore, collection, getDocs, orderBy, query } = window.firebase.firestore;
        const db = getFirestore();
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt", "desc"));

        getDocs(q).then(snapshot => {
            container.innerHTML = '';
            if (snapshot.empty) {
                return;
            }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
                const name = method['name_' + appContext.currentLanguage] || method.name_ku_sorani;
                const button = document.createElement('button');
                button.className = 'whatsapp-btn';
                button.style.backgroundColor = method.color;
                button.innerHTML = `<i class="${method.icon}"></i> ${name}`;

                button.onclick = () => {
                    sendOrderVia(method.type, method.value);
                };
                container.appendChild(button);
            });
        }).catch(error => {
            console.error("Error fetching contact methods:", error);
        });
    }
}

// Function to handle sending the order
function sendOrderVia(type, value) {
    const { cart, userProfile } = appContext;
    if (cart.length === 0) return;

    let message = `*${t('order_greeting')}*\n\n`;
    let total = 0;
    cart.forEach(item => {
        const name = item.name?.[appContext.currentLanguage] || item.name?.ku_sorani || 'کاڵا';
        const price = item.price.toLocaleString();
        total += item.price * item.quantity;
        message += `*${name}*\n`;
        message += `_${t('order_item_details', { price: price, quantity: item.quantity })}_\n\n`;
    });
    message += `*${t('order_total')}: ${total.toLocaleString()} د.ع.*\n\n`;
    message += `*--- ${t('order_user_info')} ---*\n`;
    message += `*${t('order_user_name')}:* ${userProfile.name || ''}\n`;
    message += `*${t('order_user_address')}:* ${userProfile.address || ''}\n`;
    message += `*${t('order_user_phone')}:* ${userProfile.phone || ''}\n\n`;
    message += `_${t('order_prompt_info')}_`;

    const encodedMessage = encodeURIComponent(message);
    let url;

    switch (type) {
        case 'whatsapp':
            url = `https://wa.me/${value}?text=${encodedMessage}`;
            break;
        case 'viber':
            url = `viber://chat?number=%2B${value}&text=${encodedMessage}`;
            break;
        case 'telegram':
            url = `https://t.me/${value}?text=${encodedMessage}`;
            break;
        case 'phone':
            url = `tel:${value}`;
            break;
        case 'url':
            url = value;
            break;
        default:
            console.error("Unknown contact method type:", type);
            return;
    }
    window.open(url, '_blank');
}