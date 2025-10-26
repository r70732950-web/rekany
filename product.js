// product.js
// Berpirs e ji bo çêkirin û nîşandana kartên kałayan û hûrguliyên wan.

import {
    db,
    state,
    productsCollection
} from './app-setup.js';
import { t, formatDescription } from './utils.js';
import { getDoc, doc, collection, query, orderBy, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { openPopup } from './ui.js';
import { isFavorite } from './favorites.js'; // Pêdivî ye ku isFavorite were import kirin

/**
 * Tuخم (element) HTML ya kartê kałayê çêdike
 * Ev fonksiyon tenê HTMLê çêdike û 'data-action' datîne.
 * 'app-logic.js' dê 'event listener'an birêve bibe.
 * @param {Object} product - Objekta kałayê
 * @returns {HTMLElement} - Tuخم (element) HTML ya kartê
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card product-card-reveal'; // 'product-card-reveal' zêde kir
    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // 1. Amadekirina Nav û Wêne
    const name = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // 2. Amadekirina Biha û Daxistin
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // 3. Amadekirina Agahiyên Zêde (mînak: Gihandin)
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

    // 4. Amadekirina Bişkoja Dilxwaz (Favorite)
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // 5. Avakirina HTML ya Kartê
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
             <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="Share product">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${name}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" data-action="edit-product" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" data-action="delete-product" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // 6. Danîna 'data-action' ji bo birêvebirina klîkan
    // (Ev ê ji hêla 'app-logic.js' ve were birêvebirin)
    productCard.dataset.action = 'open-details'; // Ev ji bo klîka giştî ye
    productCard.querySelector('.add-to-cart-btn-card').dataset.action = 'add-to-cart';
    productCard.querySelector('.favorite-btn').dataset.action = 'toggle-favorite';
    productCard.querySelector('.share-btn-card').dataset.action = 'share-product';

    // === START: ÇAKKIRIN / FIX ===
    // 'return' a ku ji bîr kiribû hate zêdekirin
    return productCard;
    // === END: ÇAKKIRIN / FIX ===
}

/**
 * Hûrguliyên kałayê ji state ya giştî an ji Firestore dibîne û nîşan dide
 * @param {string} productId - ID ya kałayê
 */
export function showProductDetails(productId) {
    // Pêşî hewl bide ku kałayê ji state.products (kałayên barkirî) bibîne
    let product = state.products.find(p => p.id === productId);

    if (product) {
        // Heke hate dîtin, rasterast nîşan bide
        showProductDetailsWithData(product);
    } else {
        // Heke nehate dîtin, wê ji Firestore bîne
        console.log("Kała di state de nehate dîtin. Ji Firestore tê anîn...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                showNotification(t('product_not_found_error'), 'error');
            }
        }).catch(err => {
            console.error("Error fetching product details:", err);
            showNotification(t('error_generic'), 'error');
        });
    }
}


/**
 * Pop-up a hûrguliyên kałayê bi daneyên amadekirî nîşan dide
 * @param {Object} product - Objekta kałayê ya temam
 */
function showProductDetailsWithData(product) {
    // Scroll bike serî
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) {
        sheetContent.scrollTop = 0;
    }

    // 1. Datalên sereke amade bike
    const name = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const description = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // 2. Beşa Slîderê Wêneyan
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = name;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumbnailContainer.appendChild(thumb);
        });
    }

    // 3. Logîka Slîderê
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

    // 4. Danîna Agahiyên Din
    document.getElementById('sheetProductName').textContent = name;
    document.getElementById('sheetProductDescription').innerHTML = formatDescription(description);

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // 5. Bişkoja Zêdekirinê
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.dataset.action = 'add-to-cart-sheet'; // Danîna 'data action'
    addToCartButton.dataset.productId = product.id; // Danîna 'product id'

    // 6. Nîşandana Kałayên Pêwendîdar
    renderRelatedProducts(product);

    // 7. Vekirina Pop-up
    openPopup('productDetailSheet');
}

/**
 * Kałayên pêwendîdar (related products) li gorî kategoriya kałaya niha nîşan dide
 * @param {Object} currentProduct - Objekta kałaya ku niha tê nîşandan
 */
export async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    // 1. Pêşî kontrol bike ka kategorî hene
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return; // Heke ti kategorî tune be, venegere
    }

    // 2. Query saz bike
    let q;
    if (currentProduct.subSubcategoryId) {
        // Li gorî jêr-jêr-kategorî (herî taybet)
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Kałayê bixwe derxe
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        // Li gorî jêr-kategorî
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
        // Li gorî kategoriya sereke
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    // 3. Query bişîne û encaman nîşan bide
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Naha ev ê bi rêkûpêk kar bike
            container.appendChild(card); // Naha ev ê bi rêkûpêk kar bike
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
    }
}

/**
 * Skrîna barkirinê (skeleton loader) ji bo kartên kałayan nîşan dide
 * @param {HTMLElement} container - Konteynera ku dê skeleton tê de were nîşandan
 * @param {number} count - Hejmara kartên skeleton
 */
export function renderSkeletonLoader(container, count = 8) {
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
    // Heke 'skeletonLoader' a sereke be, 'productsContainer' veşêre
    if (container.id === 'skeletonLoader') {
      document.getElementById('productsContainer').style.display = 'none';
      document.getElementById('loader').style.display = 'none';
    }
}

/**
 * Animasyonên scroll-ê ji bo kartên kałayan saz dike
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
        threshold: 0.1 // 10% ji kartê xuya bibe
    });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

