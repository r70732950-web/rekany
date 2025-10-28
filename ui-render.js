// ui-render.js
// Fonksiyonên taybet bo renderkirina beşên UI
// (تەنها فانکشنەکانی تایبەت بە دروستکردن و نوێکردنەوەی بەشە دیاریکراوەکانی UI لێرەدان)

import {
    // DOM Elements needed for rendering specific parts
    cartItemsContainer, emptyCartMessage, cartTotal, totalAmount, cartActions,
    favoritesContainer, emptyFavoritesMessage, sheetCategoriesContainer,
    notificationsListContainer, notificationBadge, termsContentContainer,
    skeletonLoader, // Exported from setup
    // loginModal, addProductBtn, productFormModal, productsContainer, searchInput,
    // clearSearchBtn, loginForm, productForm, formTitle, loader,
    // cartBtn, categoriesBtn, sheetOverlay,
    // productCategorySelect, subcategorySelectContainer, productSubcategorySelect, subSubcategorySelectContainer,
    // productSubSubcategorySelect, profileForm, settingsPage, mainPage, homeBtn, settingsBtn,
    // settingsFavoritesBtn, settingsAdminLoginBtn, settingsLogoutBtn, profileBtn, contactToggle,
    // notificationBtn, notificationsSheet, termsAndPoliciesBtn, termsSheet,
} from './app-setup.js';

import {
    // Core state and functions needed for rendering logic
    state, t, formatDescription, isFavorite,
    fetchProductById, fetchRelatedProducts, fetchPolicies, fetchAnnouncements,
    fetchContactMethods, fetchSubSubcategories, generateOrderMessageCore,
    addToCartCore, updateCartQuantityCore, removeFromCartCore, toggleFavoriteCore,
    saveFavorites, updateLastSeenAnnouncementTimestamp,
    // Firestore functions needed for rendering (e.g., detail page)
    db, doc, getDoc, collection, query, where, orderBy, getDocs, limit, startAfter, productsCollection
} from './app-core.js';

// --- UI Rendering Functions (EXPORTED) ---

/**
 * Pêşandana skeleton loader di konteynerek diyar de.
 * @param {HTMLElement} container - Konteynera ku dê skeleton tê de bêne pêşandan.
 * @param {number} count - Hejmara kartên skeleton ku bêne çêkirin.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) {
        console.error("Skeleton loader container not found:", container);
        return;
    }
    container.innerHTML = ''; // Paqijkirina skeletonên berê
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
    container.style.display = 'grid'; // Piştrastkirina ku xuya ye
}

/**
 * Çêkirina elementek kartê hilberê bi hemî fonksiyonên pêwîst.
 * @param {object} product - Objekta hilberê ji Firestore.
 * @returns {HTMLElement} - Elementa kartê hilberê ya çêkirî.
 */
export function createProductCardElementUI(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە');

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

    // --- Girêdana Listeneran rasterast li vir ---
    // Bişkoja Parvekirinê
    productCard.querySelector('.share-btn-card').addEventListener('click', async (event) => {
       event.stopPropagation();
       // Bikaranîna window.showNotification ji ui-core.js
       const showNotification = window.showNotification || (() => console.error('showNotification not found'));
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
               try { document.execCommand('copy'); showNotification('لینكى کاڵا کۆپى کرا!', 'success'); }
               catch (err) { showNotification('کۆپیکردن سەرکەوتوو نەبوو!', 'error'); }
               document.body.removeChild(textArea);
           }
       } catch (err) {
           console.error('Share error:', err);
           if (err.name !== 'AbortError') showNotification(t('share_error'), 'error');
       }
    });

    // Bişkoja Favorî
    productCard.querySelector('.favorite-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        handleToggleFavoriteUI(product.id); // Gazî kirina handlerê navxweyî
    });

    // Bişkoja Zêdekirina bo Sebetê
    productCard.querySelector('.add-to-cart-btn-card').addEventListener('click', (event) => {
        event.stopPropagation();
        handleAddToCartUI(product.id, event.currentTarget); // Gazî kirina handlerê navxweyî
    });

    // Bişkojên Admin
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

    // Klik li ser Kartê (Detay)
    productCard.addEventListener('click', (event) => {
        if (!event.target.closest('button')) {
            showProductDetailsUI(product); // Gazî kirina fonksiyona ji vê pelê
        }
    });

    return productCard;
}

/**
 * Sazkirina animasyonên scroll reveal ji bo elementan.
 */
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

/**
 * Pêşandana naveroka pelika (sheet) sebetê kirînê.
 */
export function renderCartUI() {
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
    renderCartActionButtonsUI(); // Pêşandana bişkokên çalakiyê (ji vê pelê)

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

    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => handleUpdateQuantityUI(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => handleRemoveFromCartUI(e.currentTarget.dataset.id));
}

/**
 * Pêşandana bişkokên ji bo şandina naveroka sebetê.
 */
export async function renderCartActionButtonsUI() {
    const container = document.getElementById('cartActions');
    container.innerHTML = '';
    const methods = await fetchContactMethods(); // Assume fetchContactMethods is in app-core

    if (!methods || methods.length === 0) {
        container.innerHTML = '<p>هیچ ڕێگایەکی ناردن دیاری نەکراوە.</p>';
        return;
    }

    methods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = 'whatsapp-btn'; // Use a generic class name or update based on type
        btn.style.backgroundColor = method.color;
        const name = method['name_' + state.currentLanguage] || method.name_ku_sorani;
        btn.innerHTML = `<i class="${method.icon}"></i> <span>${name}</span>`;
        btn.onclick = () => {
            const message = generateOrderMessageCore(); // Assume this is in app-core
            if (!message) return;
            let link = '';
            const encodedMessage = encodeURIComponent(message);
            const value = method.value;
            switch (method.type) {
                case 'whatsapp': link = `https://wa.me/${value}?text=${encodedMessage}`; break;
                case 'viber': link = `viber://chat?number=%2B${value}&text=${encodedMessage}`; break;
                case 'telegram': link = `https://t.me/${value}?text=${encodedMessage}`; break;
                case 'phone': link = `tel:${value}`; break; // No message for phone call
                case 'url': link = value; break; // Custom URL (might not support message)
                default: console.warn("Unknown contact method type:", method.type);
            }
            if (link) window.open(link, '_blank');
        };
        container.appendChild(btn);
    });
}

/**
 * Pêşandana naveroka pelika (sheet) lîsta hez jê kirîyan (favorî).
 */
export async function renderFavoritesPageUI() {
    favoritesContainer.innerHTML = '';
    if (state.favorites.length === 0) {
        emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none';
        return;
    }

    emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid';
    renderSkeletonLoader(favoritesContainer, 4); // Use function from this file

    try {
        const fetchPromises = state.favorites.map(id => fetchProductById(id)); // Assume fetchProductById is in app-core
        const favoritedProducts = (await Promise.all(fetchPromises)).filter(p => p !== null);
        favoritesContainer.innerHTML = '';

        if (favoritedProducts.length === 0) {
            emptyFavoritesMessage.style.display = 'block';
            favoritesContainer.style.display = 'none';
            state.favorites = [];
            saveFavorites(); // Assume saveFavorites is in app-core
        } else {
            // Remove IDs from state.favorites if the product no longer exists
            if (favoritedProducts.length !== state.favorites.length) {
                state.favorites = favoritedProducts.map(p => p.id);
                saveFavorites();
            }
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElementUI(product); // Use function from this file
                favoritesContainer.appendChild(productCard);
            });
        }
    } catch (error) {
        console.error("Error rendering favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    }
}

/**
 * Pêşandana naveroka pelika (sheet) kategoriyan.
 */
export function renderCategoriesSheetUI() {
    sheetCategoriesContainer.innerHTML = '';
    // Assume navigateToFilterCore, updateProductViewUI, closeCurrentPopup are globally available via ui-core.js
    const navigateToFilterCore = window.navigateToFilterCore || (() => console.error('navigateToFilterCore not found'));
    const updateProductViewUI = window.updateProductViewUI || (() => console.error('updateProductViewUI not found'));
    const closeCurrentPopup = window.closeCurrentPopup || (() => console.error('closeCurrentPopup not found'));

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
            await navigateToFilterCore({
                category: cat.id, subcategory: 'all', subSubcategory: 'all', search: ''
            });
            await updateProductViewUI(true); // Call function from home.js (made global)
            closeCurrentPopup(); // Call function from ui-core.js (made global)
        };
        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Pêşandana bin-bin-kategoriyan (sub-subcategories) li ser rûpela detayan.
 * @param {string} mainCatId - ID ya kategoriya sereke.
 * @param {string} subCatId - ID ya bin-kategoriyê.
 */
async function renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    container.innerHTML = '';
    const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); // Assume fetchSubSubcategories is in app-core

    if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    // Add "All" button
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn active`; // Start with 'All' active
    allBtn.dataset.id = 'all';
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
    allBtn.onclick = () => {
        container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        const currentSearch = document.getElementById('subpageSearchInput').value;
        renderProductsOnDetailPageUI(subCatId, 'all', currentSearch); // From this file
    };
    container.appendChild(allBtn);

    // Add specific buttons
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
            renderProductsOnDetailPageUI(subCatId, subSubcat.id, currentSearch); // From this file
        };
        container.appendChild(btn);
    });
}

/**
 * Pêşandana hilberan li ser rûpela detayan li gorî fîlteran.
 * @param {string} subCatId - ID ya bin-kategoriyê.
 * @param {string} [subSubCatId='all'] - ID ya bin-bin-kategoriyê (optional).
 * @param {string} [searchTerm=''] - Peyva lêgerînê (optional).
 */
async function renderProductsOnDetailPageUI(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    renderSkeletonLoader(productsContainer, 4); // Use exported function

    try {
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
            // Ji ber ku lêgerîn heye, yekem rêzkirin divê li gorî wê be
            orderByClauses.push(orderBy("searchableName", "asc"));
        }
        // Her tim rêzkirina duyemîn li gorî createdAt be
        orderByClauses.push(orderBy("createdAt", "desc"));

        let detailQuery = query(productsCollection, ...conditions, ...orderByClauses);
        const productSnapshot = await getDocs(detailQuery);
        const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        productsContainer.innerHTML = '';
        if (products.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            products.forEach(product => {
                const card = createProductCardElementUI(product); // Use exported function
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

/**
 * Pêşandana rûpela detayan a bin-kategoriyê.
 * @param {string} mainCatId - ID ya kategoriya sereke.
 * @param {string} subCatId - ID ya bin-kategoriyê.
 * @param {boolean} [fromHistory=false] - Nîşan dide ka navîgasyon ji dîrokê ye yan na.
 */
export async function showSubcategoryDetailPageUI(mainCatId, subCatId, fromHistory = false) {
    // Assume showPage is globally available via ui-core.js
    const showPage = window.showPage || (() => console.error('showPage not found'));

    let subCatName = 'Details';
    try {
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) { console.error("Could not fetch subcategory name:", e); }

    if (!fromHistory) {
        // Use full URL path for history state
        const url = new URL(window.location);
        url.hash = `#subcategory_${mainCatId}_${subCatId}`;
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', url.toString());
    }
    showPage('subcategoryDetailPage', subCatName); // Call global showPage

    const loader = document.getElementById('detailPageLoader');
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const subSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    loader.style.display = 'block';
    productsContainer.innerHTML = '';
    subSubContainer.innerHTML = '';
    document.getElementById('subpageSearchInput').value = ''; // Reset search
    document.getElementById('subpageClearSearchBtn').style.display = 'none';

    await renderSubSubcategoriesOnDetailPageUI(mainCatId, subCatId); // Use function from this file
    await renderProductsOnDetailPageUI(subCatId, 'all', ''); // Use function from this file
    loader.style.display = 'none';
}

/**
 * Pêşandana naveroka pelika (sheet) detayan a hilberê.
 * @param {object} productData - Objekta hilberê ya ku bê pêşandan.
 */
export async function showProductDetailsUI(productData) { // Exported because direct link needs it
    // Assume openPopup is globally available via ui-core.js
    const openPopup = window.openPopup || (() => console.error('openPopup not found'));
    const showNotification = window.showNotification || (() => console.error('showNotification not found'));

    // Fetch product data if not provided (e.g., from direct link)
    const product = productData || await fetchProductById(state.currentProductId); // Assume state.currentProductId is managed elsewhere if needed

    if (!product) {
        showNotification(t('product_not_found_error'), 'error');
        return;
    }
    state.currentProductId = product.id; // Update current product ID in state

    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Reset scroll

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    // Render images and thumbnails
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img'); img.src = url; img.alt = nameInCurrentLang; if (index === 0) img.classList.add('active'); imageContainer.appendChild(img);
            const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.className = 'thumbnail'; if (index === 0) thumb.classList.add('active'); thumb.dataset.index = index; thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Add placeholder if no images
        const img = document.createElement('img'); img.src = 'https://placehold.co/400x400/e2e8f0/2d3748?text=وێنە+نییە'; img.alt = nameInCurrentLang; img.classList.add('active'); imageContainer.appendChild(img);
    }

    // Slider logic setup
    let currentIndex = 0;
    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    function updateSlider(index) {
        if (!images[index] || !thumbnails[index]) return; // Check if index is valid for both
        images.forEach(img => img.classList.remove('active')); thumbnails.forEach(thumb => thumb.classList.remove('active'));
        images[index].classList.add('active'); thumbnails[index].classList.add('active'); currentIndex = index;
    }

    const showSliderBtns = imageUrls.length > 1;
    prevBtn.style.display = showSliderBtns ? 'flex' : 'none'; nextBtn.style.display = showSliderBtns ? 'flex' : 'none';

    // Clear previous listeners before attaching new ones
    prevBtn.onclick = null; nextBtn.onclick = null; thumbnails.forEach(thumb => thumb.onclick = null);

    if (showSliderBtns) {
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);
    }
    thumbnails.forEach(thumb => thumb.onclick = () => updateSlider(parseInt(thumb.dataset.index)));

    // Update text content
    document.getElementById('sheetProductName').textContent = nameInCurrentLang;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(descriptionText); // Assume formatDescription is in app-core
    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Setup Add to Cart button
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => handleAddToCartUI(product.id, addToCartButton); // Use local handler

    // Render related products
    renderRelatedProductsUI(product); // Use function from this file

    // Open the sheet
    openPopup('productDetailSheet'); // Call global openPopup
}

/**
 * Pêşandana hilberên pêwendîdar di pelika (sheet) detayan de.
 * @param {object} currentProduct - Objekta hilberê ya niha.
 */
async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = ''; // Clear previous
    section.style.display = 'none'; // Hide initially
    const relatedProducts = await fetchRelatedProducts(currentProduct); // Assume fetchRelatedProducts is in app-core

    if (relatedProducts && relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElementUI(product); // Use exported function
            container.appendChild(card);
        });
        section.style.display = 'block'; // Show section if products exist
    }
}

/**
 * Pêşandana polîtîkayan di pelika (sheet) mercan de.
 */
export async function renderPoliciesUI() {
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`;
    const policies = await fetchPolicies(); // Assume fetchPolicies is in app-core
    if (policies) {
        const content = policies[state.currentLanguage] || policies.ku_sorani || '';
        termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`;
    } else {
        termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`;
    }
}

/**
 * Pêşandana agahdariyan (notifications) ji bo bikarhêneran di pelika (sheet) agahdariyan de.
 */
export async function renderUserNotificationsUI() {
    const announcements = await fetchAnnouncements(); // Assume fetchAnnouncements is in app-core
    notificationsListContainer.innerHTML = '';

    if (!announcements || announcements.length === 0) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        notificationBadge.style.display = 'none'; // Hide badge if no notifications
        return;
    }

    let latestTimestamp = 0;
    announcements.forEach(announcement => {
        if (announcement.createdAt > latestTimestamp) latestTimestamp = announcement.createdAt;
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
            <p class="notification-content">${content.replace(/\n/g, '<br>')}</p>
        `;
        notificationsListContainer.appendChild(item);
    });

    // Update last seen timestamp and hide badge after viewing
    updateLastSeenAnnouncementTimestamp(latestTimestamp); // Assume this is in app-core
    notificationBadge.style.display = 'none';
}

// --- UI Event Handlers (Internal to Rendering Logic) ---
// These functions handle events triggered by elements created in this file
// They rely on functions made globally available by ui-core.js (showNotification, updateCartCountUI)

async function handleAddToCartUI(productId, buttonElement) {
    const showNotification = window.showNotification || (() => console.error('showNotification not found'));
    const updateCartCountUI = window.updateCartCountUI || (() => console.error('updateCartCountUI not found'));

    const result = await addToCartCore(productId); // Assume addToCartCore is in app-core
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        updateCartCountUI(); // Update global count

        // Button animation feedback
        if (buttonElement && !buttonElement.disabled) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading state
            setTimeout(() => {
                buttonElement.innerHTML = `<i class="fas fa-check"></i> <span>${t('added_to_cart')}</span>`; // Added state
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent; // Reset after a delay
                    buttonElement.disabled = false;
                }, 1500);
            }, 500);
        }
    }
}

function handleUpdateQuantityUI(productId, change) {
    const updateCartCountUI = window.updateCartCountUI || (() => console.error('updateCartCountUI not found'));

    if (updateCartQuantityCore(productId, change)) { // Assume updateCartQuantityCore is in app-core
        renderCartUI(); // Re-render cart UI (from this file)
        updateCartCountUI(); // Update overall count (global)
    }
}

function handleRemoveFromCartUI(productId) {
    const updateCartCountUI = window.updateCartCountUI || (() => console.error('updateCartCountUI not found'));

    if (removeFromCartCore(productId)) { // Assume removeFromCartCore is in app-core
        renderCartUI(); // Re-render cart UI (from this file)
        updateCartCountUI(); // Update overall count (global)
    }
}

function handleToggleFavoriteUI(productId) {
    const showNotification = window.showNotification || (() => console.error('showNotification not found'));

    const result = toggleFavoriteCore(productId); // Assume toggleFavoriteCore is in app-core
    showNotification(result.message, result.favorited ? 'success' : 'error');

    // Update heart icon on all cards with this product ID
    document.querySelectorAll(`[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('favorited', result.favorited);
        const icon = btn.querySelector('.fa-heart');
        if (icon) {
            icon.classList.toggle('fas', result.favorited);
            icon.classList.toggle('far', !result.favorited);
        }
    });

    // If the favorites sheet is currently open, re-render it
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPageUI(); // Re-render favorites (from this file)
    }
}