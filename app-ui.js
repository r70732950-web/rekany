// app-ui.js (V2 - Corrected Imports/Exports, Moved Functions)
// Ev pel ji bo rêveberiya hemî fonksiyonên pêwendîdarî navrûya bikarhêner (UI) ye.

import {
    db, state, translations // Only import what's needed from app-setup
} from './app-setup.js';

// Import necessary data/logic functions
import {
    t, isFavorite, toggleFavorite, addToCart, updateQuantity, removeFromCart,
    generateOrderMessage, navigateToFilter, applyFilterState, searchProductsInFirestore,
    saveProfile, checkNewAnnouncements, requestNotificationPermission, // Removed saveTokenToFirestore
    forceUpdate, saveCurrentScrollPosition, renderProductsOnDetailPage
} from './app-data.js'; // Assuming app-data.js exports these

// Import specific Firestore functions if needed directly (e.g., getting category names)
import { getDoc, doc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Core UI Functions ---

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

export function showPage(pageId, pageTitle = '') {
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });
    if (pageId !== 'mainPage') window.scrollTo(0, 0);
    updateHeaderView(pageId, pageTitle);
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    updateActiveNav(activeBtnId); // Update nav even if null to clear others
}

export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    const overlay = document.getElementById('sheet-overlay');
    if(overlay) overlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

export function openPopup(id, type = 'sheet') {
    saveCurrentScrollPosition(); // Save scroll before opening
    const element = document.getElementById(id);
    if (!element) return;
    closeAllPopupsUI(); // Close others first

    const overlay = document.getElementById('sheet-overlay');
    if (type === 'sheet') {
        if(overlay) overlay.classList.add('show');
        element.classList.add('show');
        // Lazy load content
        if (id === 'cartSheet') renderCart();
        if (id === 'favoritesSheet') renderFavoritesPage();
        if (id === 'categoriesSheet') renderCategoriesSheet();
        if (id === 'notificationsSheet') renderUserNotifications();
        if (id === 'termsSheet') renderPolicies();
        if (id === 'profileSheet') {
             document.getElementById('profileName').value = state.userProfile.name || '';
             document.getElementById('profileAddress').value = state.userProfile.address || '';
             document.getElementById('profilePhone').value = state.userProfile.phone || '';
        }
    } else { // Modal
        element.style.display = 'block';
    }
    document.body.classList.add('overlay-active');
    history.pushState({ type: type, id: id }, '', `#${id}`);
}

export function closeCurrentPopup() {
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back(); // Use browser history to close
    } else {
        closeAllPopupsUI(); // Fallback
    }
}

export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// --- Rendering Functions ---

export function renderSkeletonLoader(container = document.getElementById('skeletonLoader'), count = 8) {
    if (!container) return; // Add check
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
    if (container.id === 'skeletonLoader') {
        const productsContainer = document.getElementById('productsContainer');
        const loader = document.getElementById('loader');
        if(productsContainer) productsContainer.style.display = 'none';
        if(loader) loader.style.display = 'none';
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

// Keep globally accessible TEMPORARILY
export function createProductCardElement(product) { // Exporting it now
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
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
        extraInfoHTML = `<div class="product-extra-info"><div class="info-badge shipping-badge"><i class="fas fa-truck"></i>${shippingText}</div></div>`;
    }

    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="Add to favorites"><i class="${heartIconClass} fa-heart"></i></button>
            <button class="share-btn-card" aria-label="Share product"><i class="fas fa-share-alt"></i></button>
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
        </div>
    `;

    productCard.addEventListener('click', async (event) => { // Make async for potential clipboard fallback
        const target = event.target;
        const addToCartButton = target.closest('.add-to-cart-btn-card');
        const isAdminNow = sessionStorage.getItem('isAdmin') === 'true';

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
        } else if (isAdminNow && target.closest('.edit-btn')) {
            window.AdminLogic.editProduct(product.id);
        } else if (isAdminNow && target.closest('.delete-btn')) {
            window.AdminLogic.deleteProduct(product.id);
        } else if (target.closest('.favorite-btn')) {
            toggleFavorite(product.id, event);
        } else if (target.closest('.share-btn-card')) {
            event.stopPropagation();
            const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
            const shareData = { title: nameInCurrentLang, text: `${t('share_text')}: ${nameInCurrentLang}`, url: productUrl };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else if (navigator.clipboard) { // Fallback to clipboard
                    await navigator.clipboard.writeText(productUrl);
                    showNotification('لينكى کاڵا کۆپى کرا!', 'success');
                } else { // Older fallback (less reliable)
                    const textArea = document.createElement('textarea');
                    textArea.value = productUrl; document.body.appendChild(textArea); textArea.select();
                    try { document.execCommand('copy'); showNotification('لينكى کاڵا کۆپى کرا!', 'success'); }
                    catch (err) { showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); }
                    document.body.removeChild(textArea);
                }
            } catch (err) {
                console.error('Share error:', err);
                if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
            }
        } else if (!target.closest('a')) {
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}
// Make it global for now
window.createProductCardElement = createProductCardElement;


export function renderProducts() {
    const productsContainer = document.getElementById('productsContainer');
    if (!productsContainer) return; // Add check
    productsContainer.innerHTML = '';

    if (!state.products || state.products.length === 0) return;

    state.products.forEach(item => {
        let element = createProductCardElement(item);
        element.classList.add('product-card-reveal');
        productsContainer.appendChild(element);
    });
    setupScrollAnimations();
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
    document.querySelectorAll('.product-card-reveal').forEach(card => observer.observe(card));
}

// Function to show product details - Made global
export function showProductDetailsWithData(product) { // Exporting it now
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0;

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description.ku_sorani) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img'); img.src = url; img.alt = nameInCurrentLang; if (index === 0) img.classList.add('active'); imageContainer.appendChild(img);
            const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.className = 'thumbnail'; if (index === 0) thumb.classList.add('active'); thumb.dataset.index = index; thumbnailContainer.appendChild(thumb);
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

    const showButtons = imageUrls.length > 1;
    prevBtn.style.display = showButtons ? 'flex' : 'none';
    nextBtn.style.display = showButtons ? 'flex' : 'none';

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
    addToCartButton.onclick = () => { addToCart(product.id); closeCurrentPopup(); };

    renderRelatedProducts(product); // Call the UI function to render related items
    openPopup('productDetailSheet');
}
// Make global for now
window.showProductDetailsWithData = showProductDetailsWithData;


export async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return; // Add checks
    container.innerHTML = '';
    section.style.display = 'none';

    let q; // Firestore query
    if (currentProduct.subSubcategoryId) q = query(collection(db,"products"), where('subSubcategoryId', '==', currentProduct.subSubcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    else if (currentProduct.subcategoryId) q = query(collection(db,"products"), where('subcategoryId', '==', currentProduct.subcategoryId), where('__name__', '!=', currentProduct.id), limit(6));
    else if (currentProduct.categoryId) q = query(collection(db,"products"), where('categoryId', '==', currentProduct.categoryId), where('__name__', '!=', currentProduct.id), limit(6));
    else return;

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use exported function
            container.appendChild(card);
        });
        section.style.display = 'block';
    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

// --- Category Rendering ---

export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) btn.classList.add('active');

        const categoryName = cat.id === 'all' ? t('all_categories_label') : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
            await navigateToFilter({ category: cat.id, subcategory: 'all', subSubcategory: 'all', search: '' });
        };
        container.appendChild(btn);
    });
}

export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); // Get sub-sub container
    if (!subcategoriesContainer || !subSubcategoriesContainer) return; // Add checks

    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none'; // Always hide sub-sub initially

    if (categoryId === 'all') {
        subcategoriesContainer.style.display = 'none';
        return;
    }
    subcategoriesContainer.style.display = 'flex';

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        state.subcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (state.subcategories.length === 0) {
            subcategoriesContainer.style.display = 'none';
            return;
        }

        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = async () => await navigateToFilter({ subcategory: 'all', subSubcategory: 'all' });
        subcategoriesContainer.appendChild(allBtn);

        state.subcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;
            subcatBtn.onclick = () => showSubcategoryDetailPage(categoryId, subcat.id); // Go to detail page
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        subcategoriesContainer.style.display = 'none';
    }
}

export async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name:", e); }

    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }
    showPage('subcategoryDetailPage', subCatName); // Show the page UI

    // Get elements for detail page
    const loader = document.getElementById('detailPageLoader');
    const productsContainerDetail = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    // Reset UI elements
    if (loader) loader.style.display = 'block';
    if (productsContainerDetail) productsContainerDetail.innerHTML = '';
    if (subSubContainer) subSubContainer.innerHTML = '';
    if (subpageSearchInput) subpageSearchInput.value = '';
    if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';


    // Render content for the detail page
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Render sub-subcategories first
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Then render products for 'all' sub-sub initially

    if(loader) loader.style.display = 'none'; // Hide loader after content is loaded
}

// Function to render sub-subcategories specifically for the detail page
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories
            return;
        }
        container.style.display = 'flex'; // Show container

        // Add "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Active by default
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => {
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsOnDetailPage(subCatId, 'all', currentSearch); // Render products for 'all'
        };
        container.appendChild(allBtn);

        // Add buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
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
                const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch); // Render products for this specific sub-sub
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none';
    }
}


export function renderCategoriesSheet() {
    const sheetCategoriesContainer = document.getElementById('sheetCategoriesContainer');
    if (!sheetCategoriesContainer) return; // Add check
    sheetCategoriesContainer.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) btn.classList.add('active');
        const categoryName = cat.id === 'all' ? t('all_categories_label') : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> ${categoryName}`;
        btn.onclick = async () => {
            await navigateToFilter({ category: cat.id, subcategory: 'all', subSubcategory: 'all', search: '' });
            closeCurrentPopup();
            showPage('mainPage');
        };
        sheetCategoriesContainer.appendChild(btn);
    });
}

// Function to populate category dropdown in product form (Used by Admin)
export function populateCategoryDropdown() {
    const productCategorySelect = document.getElementById('productCategoryId');
    if (!productCategorySelect) return; // Add check
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani;
        productCategorySelect.appendChild(option);
    });
}

// --- Cart Rendering ---
export function renderCart() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    const totalAmount = document.getElementById('totalAmount');
    const cartActions = document.getElementById('cartActions');
    if (!cartItemsContainer || !emptyCartMessage || !cartTotal || !totalAmount || !cartActions) return; // Add checks

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
    renderCartActionButtons();

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        cartItem.innerHTML = `
            <img src="${item.image || 'placeholder.jpg'}" alt="${itemNameInCurrentLang}" class="cart-item-image">
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

    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

export async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return; // Add check
    container.innerHTML = '';

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>'; return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = 'whatsapp-btn'; // Use generic class
            btn.style.backgroundColor = method.color;
            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
            btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;
            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;
                let link = ''; const encodedMessage = encodeURIComponent(message); const value = method.value;
                switch (method.type) {
                    case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                    case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break;
                    case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                    case 'phone': link = `tel:${value}`; break;
                    case 'url': link = value; break;
                }
                if (link) window.open(link, '_blank');
            };
            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error fetching cart action methods:", error);
        container.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// --- Favorites Rendering ---
export async function renderFavoritesPage() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    const emptyFavoritesMessage = document.getElementById('emptyFavoritesMessage');
    if (!favoritesContainer || !emptyFavoritesMessage) return; // Add checks
    favoritesContainer.innerHTML = '';

    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, 4);

    try {
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);
        favoritesContainer.innerHTML = ''; // Clear skeletons
        const favoritedProducts = productSnaps.filter(snap => snap.exists()).map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
        } else {
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product);
                favoritesContainer.appendChild(productCard);
            });
             setupScrollAnimations(); // Add animations for loaded favorites
        }
    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}

// --- Notifications & Policies Rendering ---
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return; // Add check
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    try {
        const snapshot = await getDocs(q);
        notificationsListContainer.innerHTML = '';
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`; return;
        }
        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            if (announcement.createdAt > latestTimestamp) latestTimestamp = announcement.createdAt;
            const date = new Date(announcement.createdAt);
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';
            const item = document.createElement('div'); item.className = 'notification-item';
            item.innerHTML = `<div class="notification-header"><span class="notification-title">${title}</span><span class="notification-date">${formattedDate}</span></div><p class="notification-content">${content}</p>`;
            notificationsListContainer.appendChild(item);
        });
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        const badge = document.getElementById('notificationBadge');
        if(badge) badge.style.display = 'none';
    } catch (error) {
        console.error("Error fetching user notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

export async function renderPolicies() {
    const termsContentContainer = document.getElementById('termsContentContainer');
    if (!termsContentContainer) return; // Add check
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

// --- Other UI Helpers ---
export function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalItems;
        el.style.display = totalItems > 0 ? 'flex' : 'none';
    });
}

export function updateCategoryDependentUI() {
    if (state.categories.length === 0) return;
    populateCategoryDropdown();
    renderMainCategories();
    // Update admin only if admin logic is available
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic) {
        window.AdminLogic.updateAdminCategoryDropdowns();
         window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Update shortcut dropdowns too
    }
}

export async function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return; // Add check
    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));
    try {
        const snapshot = await getDocs(q);
        contactLinksContainer.innerHTML = '';
        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>'; return;
        }
        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani;
            const linkElement = document.createElement('a'); linkElement.href = link.url; linkElement.target = '_blank'; linkElement.className = 'settings-item';
            linkElement.innerHTML = `<div><i class="${link.icon}" style="margin-left: 10px;"></i><span>${name}</span></div><i class="fas fa-external-link-alt"></i>`;
            contactLinksContainer.appendChild(linkElement);
        });
    } catch (error) {
        console.error("Error fetching contact links:", error);
        contactLinksContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}

export function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    if (!getLocationBtn || !profileAddressInput) return;
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan ? btnSpan.textContent : 'Get Location';

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) { showNotification('GPS not supported', 'error'); return; }
        if (btnSpan) btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
            async (position) => { /* Success callback as before */
                 const { latitude, longitude } = position.coords;
                 try {
                     const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                     const data = await response.json();
                     profileAddressInput.value = data?.display_name || 'Not found';
                     showNotification(data?.display_name ? 'ناونیشان وەرگیرا' : 'نەتوانرا ناونیشان بدۆزرێتەوە', data?.display_name ? 'success' : 'error');
                 } catch (error) {
                     console.error('Reverse Geocoding Error:', error); showNotification('هەڵەیەک لە وەرگرتنی ناونیشان', 'error');
                 } finally {
                     if (btnSpan) btnSpan.textContent = originalBtnText; getLocationBtn.disabled = false;
                 }
            },
            (error) => { /* Error callback as before */
                 let message = t('error_generic');
                 switch(error.code) { /* ... */ }
                 showNotification(message, 'error');
                 if (btnSpan) btnSpan.textContent = originalBtnText; getLocationBtn.disabled = false;
            }
        );
    });
}

// --- Functions Moved from app-logic.js (Now app-data.js) that render UI ---
// These need access to createProductCardElement, t, state, etc.

// Function to create promo card element (now takes sliderState) - Needs createPromoCardElement
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
    // Ensure cardData and cards array exist and index is valid
    if (!cardData || !cardData.cards || cardData.cards.length === 0 || sliderState.currentIndex >= cardData.cards.length) {
         console.error("Invalid card data or index for promo slider:", cardData, sliderState);
         return cardElement; // Return empty element
    }
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 await navigateToFilter({ // navigateToFilter is in app-data.js
                     category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                 });
                 document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image'); if(imgElement) imgElement.src = newImageUrl;
        });
        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image'); if(imgElement) imgElement.src = newImageUrl;
        });
    }
    return cardElement;
}


// Renders a specific promo card slider section for the home page layout
export async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID for interval management

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Use local UI function
            promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                const rotate = () => {
                     // Check if element and interval still exist in state
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                             clearInterval(sliderState.intervalId);
                             // Clean up global state if needed
                             if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId];
                        }
                        return;
                    }
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                };

                // Clear previous interval for this layout ID
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000);
                // Store interval ID in global state
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid; // Return the created element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if error or no cards
}

// Renders a horizontal row of brands for the home page layout
export async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`;
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
            const item = document.createElement('div'); item.className = 'brand-item';
            item.innerHTML = `<div class="brand-image-wrapper"><img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image"></div><span>${brandName}</span>`;
            item.onclick = async () => { // Navigate based on linked category
                if (brand.subcategoryId && brand.categoryId) {
                     showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId); // UI function
                } else if(brand.categoryId) {
                     await navigateToFilter({ // Data function
                         category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                     });
                }
            };
            brandsContainer.appendChild(item);
        });
        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error); return null;
    }
}

// Renders a horizontal row of newest products for the home page layout
export async function renderNewestProductsSection() {
    const container = document.createElement('div'); container.className = 'dynamic-section';
    const header = document.createElement('div'); header.className = 'section-title-header';
    const title = document.createElement('h3'); title.className = 'section-title-main'; title.textContent = t('newest_products');
    header.appendChild(title); container.appendChild(header);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(collection(db,"products"), where('createdAt', '>=', fifteenDaysAgo), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const productsScroller = document.createElement('div'); productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error); return null;
    }
}

// Renders a horizontal row of shortcut cards for the home page layout
export async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';
    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;
        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        const titleElement = document.createElement('h3'); titleElement.className = 'shortcut-row-title'; titleElement.textContent = rowTitle; sectionContainer.appendChild(titleElement);
        const cardsContainer = document.createElement('div'); cardsContainer.className = 'shortcut-cards-container'; sectionContainer.appendChild(cardsContainer);

        const cardsQuery = query(collection(db, "shortcut_rows", rowData.id, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        if (cardsSnapshot.empty) return null;

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
            const item = document.createElement('div'); item.className = 'shortcut-card';
            item.innerHTML = `<img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy"><div class="shortcut-card-name">${cardName}</div>`;
            item.onclick = async () => { // Navigate using data function
                 await navigateToFilter({
                     category: cardData.categoryId || 'all', subcategory: cardData.subcategoryId || 'all', subSubcategory: cardData.subSubcategoryId || 'all', search: ''
                 });
            };
            cardsContainer.appendChild(item);
        });
        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error); return null;
    }
}

// Renders a horizontal row of products from a single category for the home page
export async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue, targetDocRef;
    let title = name[state.currentLanguage] || name.ku_sorani;

    if (subSubcategoryId) { queryField = 'subSubcategoryId'; queryValue = subSubcategoryId; targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`); }
    else if (subcategoryId) { queryField = 'subcategoryId'; queryValue = subcategoryId; targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`); }
    else if (categoryId) { queryField = 'categoryId'; queryValue = categoryId; targetDocRef = doc(db, `categories/${categoryId}`); }
    else return null;

    try {
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div'); container.className = 'dynamic-section';
        const header = document.createElement('div'); header.className = 'section-title-header';
        const titleEl = document.createElement('h3'); titleEl.className = 'section-title-main'; titleEl.textContent = title; header.appendChild(titleEl);
        const seeAllLink = document.createElement('a'); seeAllLink.className = 'see-all-link'; seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            if(subcategoryId) showSubcategoryDetailPage(categoryId, subcategoryId); // UI function
            else await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' }); // Data function
        };
        header.appendChild(seeAllLink); container.appendChild(header);
        const productsScroller = document.createElement('div'); productsScroller.className = 'horizontal-products-container'; container.appendChild(productsScroller);

        const q = query(collection(db,"products"), where(queryField, '==', queryValue), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error(`Error fetching products for single category row:`, error); return null;
    }
}

// Renders the 'All Products' section preview for the home page
export async function renderAllProductsSection() {
    const container = document.createElement('div'); container.className = 'dynamic-section'; container.style.marginTop = '20px';
    const header = document.createElement('div'); header.className = 'section-title-header';
    const title = document.createElement('h3'); title.className = 'section-title-main'; title.textContent = t('all_products_section_title');
    header.appendChild(title); container.appendChild(header);
    const productsGrid = document.createElement('div'); productsGrid.className = 'products-container'; container.appendChild(productsGrid);

    try {
        const q = query(collection(db,"products"), orderBy('createdAt', 'desc'), limit(10)); // Limit for home page preview
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error); return null;
    }
}


// Renders the entire home page content based on the layout configuration
export async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) { state.isRenderingHomePage = false; return; } // Exit if container not found

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up existing intervals before rendering new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
        });
        state.sliderIntervals = {}; // Reset intervals object

        // Fetch layout configuration
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home layout not configured or all sections disabled.");
            homeSectionsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">پەڕەی سەرەکی هێشتا ڕێکنەخراوە.</p>'; // User message
        } else {
             // Use Promise.all to render sections concurrently where possible
             const renderPromises = layoutSnapshot.docs.map(async (doc) => {
                 const section = { id: doc.id, ...doc.data() }; // Include doc id as layoutId
                 let element = null;
                 switch (section.type) {
                     case 'promo_slider':
                         element = section.groupId ? await renderPromoCardsSectionForHome(section.groupId, section.id) : null;
                         break;
                     case 'brands':
                         element = section.groupId ? await renderBrandsSection(section.groupId) : null;
                         break;
                     case 'newest_products':
                         element = await renderNewestProductsSection();
                         break;
                     case 'single_shortcut_row':
                          element = section.rowId ? await renderSingleShortcutRow(section.rowId, section.name) : null;
                          break;
                     case 'single_category_row':
                         element = section.categoryId ? await renderSingleCategoryRow(section) : null;
                         break;
                     case 'all_products':
                         element = await renderAllProductsSection();
                         break;
                     default:
                         console.warn(`Unknown home layout section type: ${section.type}`);
                 }
                 return { order: section.order, element: element }; // Return element with its order
             });

             const renderedSections = await Promise.all(renderPromises);

             // Sort sections by order and append valid elements
             renderedSections
                 .sort((a, b) => a.order - b.order)
                 .forEach(section => {
                     if (section.element) homeSectionsContainer.appendChild(section.element);
                 });
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا.</p>`;
    } finally {
        state.isRenderingHomePage = false; // Allow rendering again
    }
}