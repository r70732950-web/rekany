import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, doc, getDoc, getDocs, query, orderBy, limit, where, startAfter, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";

//======================================================================
//============= بەشی ١: ڕێکخستن و پەیوەندیکردن بە فایەربەیس ==============
//======================================================================

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBxyy9e0FIsavLpWCFRMqgIbUU2IJV8rqE",
    authDomain: "maten-store.firebaseapp.com",
    projectId: "maten-store",
    storageBucket: "maten-store.appspot.com",
    messagingSenderId: "137714858202",
    appId: "1:137714858202:web:e2443a0b26aac6bb56cde3",
    measurementId: "G-1PV3DRY2V2"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
    .then(() => console.log("Firestore offline persistence enabled successfully."))
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore Persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore Persistence failed: Browser not supported.');
        }
        console.error("Error enabling persistence, running online mode only:", err);
    });

// Firestore Collections
const productsCollection = collection(db, "products");
const categoriesCollection = collection(db, "categories");
const announcementsCollection = collection(db, "announcements");
const promoCardsCollection = collection(db, "promo_cards");
const brandsCollection = collection(db, "brands");

// Export Firebase services to be used in other files
export { db, auth, messaging, categoriesCollection, productsCollection, announcementsCollection, promoCardsCollection, brandsCollection };


//======================================================================
//=================== بەشی ٢: گۆڕاوە گشتییەکان و ستەیت ====================
//======================================================================

export let products = [];
export let categories = [];
export let subcategories = [];
export let allPromoCards = [];
export let currentPromoCardIndex = 0;
export let promoRotationInterval = null;

let lastVisibleProductDoc = null;
let isLoadingMoreProducts = false;
let allProductsLoaded = false;
const PRODUCTS_PER_PAGE = 25;
let isRenderingHomePage = false;
let productCache = {};

// Cart, Favorites, Profile state management
const CART_KEY = "maten_store_cart";
export let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];

const FAVORITES_KEY = "maten_store_favorites";
export let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];

const PROFILE_KEY = "maten_store_profile";
export let userProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};

// A variable to hold UI functions from app.js
let UI;
let AppLogic;

/**
 * Initializes the data logic module with UI functions and app logic functions.
 * @param {object} uiFuncs - An object containing functions for UI manipulation.
 * @param {object} appLogicFuncs - An object containing general app logic functions.
 */
export function initializeDataLogic(uiFuncs, appLogicFuncs) {
    UI = uiFuncs;
    AppLogic = appLogicFuncs;
}

//======================================================================
//================= بەشی ٣: لۆجیکی سەبەتە و دڵخوازەکان ===================
//======================================================================

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    UI.updateCartCount();
}

export function addToCart(productId) {
    const allFetchedProducts = [...products];
    let product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.warn("Product not found in local 'products' array. Fetching from DB.");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                const existingItem = cart.find(item => item.id === productId);
                if (existingItem) {
                    existingItem.quantity++;
                } else {
                    cart.push({ id: fetchedProduct.id, name: fetchedProduct.name, price: fetchedProduct.price, image: mainImage, quantity: 1 });
                }
                saveCart();
                UI.showNotification(AppLogic.t('product_added_to_cart'));
            }
        });
        return;
    }

    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, image: mainImage, quantity: 1 });
    }
    saveCart();
    UI.showNotification(AppLogic.t('product_added_to_cart'));
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

export function toggleFavorite(productId) {
    const productIndex = favorites.indexOf(productId);
    if (productIndex > -1) {
        favorites.splice(productIndex, 1);
        UI.showNotification(AppLogic.t('product_removed_from_favorites'), 'error');
    } else {
        favorites.push(productId);
        UI.showNotification(AppLogic.t('product_added_to_favorites'), 'success');
    }
    saveFavorites();

    const { currentSearch, currentCategory, currentSubcategory, currentSubSubcategory } = AppLogic.getCurrentFilterState();
    const isHomeView = !currentSearch && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';

    if (isHomeView) {
        const homeContainer = document.getElementById('homePageSectionsContainer');
        if (homeContainer) {
            homeContainer.innerHTML = '';
        }
        renderHomePageContent();
    } else {
        UI.renderProducts();
    }

    if (document.getElementById('favoritesSheet').classList.contains('show')) {
        renderFavoritesPage();
    }
}


//======================================================================
//================ بەشی ٤: دروستکردن و پیشاندانی ئێلێمێنتەکان ==============
//======================================================================

function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[AppLogic.getCurrentLanguage()]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
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
    const shippingText = product.shippingInfo && product.shippingInfo[AppLogic.getCurrentLanguage()] && product.shippingInfo[AppLogic.getCurrentLanguage()].trim();

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
                <span>${AppLogic.t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    productCard.addEventListener('click', (event) => {
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
                    addToCartButton.innerHTML = `<i class="fas fa-check"></i> <span>${AppLogic.t('added_to_cart')}</span>`;
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
            toggleFavorite(product.id);
        } else if (!target.closest('a')) {
            showProductDetailsWithData(product);
        }
    });
    return productCard;
}

function createPromoCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';

    const imageUrl = card.imageUrls[AppLogic.getCurrentLanguage()] || card.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
    `;

    cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) {
            const targetCategoryId = card.categoryId;
            const categoryExists = categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await AppLogic.navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
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

export async function showProductDetails(productId) {
    const allFetchedProducts = [...products];
    const product = allFetchedProducts.find(p => p.id === productId);

    if (!product) {
        console.log("Product not found for details view. Trying to fetch...");
        getDoc(doc(db, "products", productId)).then(docSnap => {
            if (docSnap.exists()) {
                const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                showProductDetailsWithData(fetchedProduct);
            } else {
                UI.showNotification(AppLogic.t('product_not_found_error'), 'error');
            }
        });
        return;
    }
    showProductDetailsWithData(product);
}

function showProductDetailsWithData(product) {
    const currentLanguage = AppLogic.getCurrentLanguage();
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
    document.getElementById('sheetProductDescription').innerHTML = UI.formatDescription(descriptionText);

    const priceContainer = document.getElementById('sheetProductPrice');
    if (product.originalPrice && product.originalPrice > product.price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${AppLogic.t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        AppLogic.closeCurrentPopup();
    };

    const shareButton = document.getElementById('sheetShareBtn');
    shareButton.onclick = async () => {
        const nameInCurrentLang = (product.name && product.name[currentLanguage]) || (product.name && product.name.ku_sorani);
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;

        const shareData = {
            title: nameInCurrentLang,
            text: `${AppLogic.t('share_text')}: ${nameInCurrentLang}`,
            url: productUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                console.log('Product shared successfully');
            } catch (err) {
                console.error('Share error:', err);
                if (err.name !== 'AbortError') {
                    UI.showNotification(AppLogic.t('share_error'), 'error');
                }
            }
        } else {
            try {
                navigator.clipboard.writeText(productUrl);
                UI.showNotification('لینکی کاڵا کۆپی کرا!', 'success');
            } catch (err) {
                console.error('Fallback share error:', err);
                UI.showNotification(AppLogic.t('share_error'), 'error');
            }
        }
    };

    renderRelatedProducts(product);

    AppLogic.openPopup('productDetailSheet');
}


//======================================================================
//============== بەشی ٥: فەنکشنەکانی هێنانی داتا لە فایەربەیس ==============
//======================================================================

async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none';

    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return;
    }

    let q;
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    } else {
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(6)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("هیچ کاڵایەکی هاوشێوە نەدۆزرایەوە.");
            return;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            container.appendChild(card);
        });

        section.style.display = 'block';

    } catch (error) {
        console.error("هەڵە لە هێنانی کاڵا هاوشێوەکان:", error);
    }
}

async function renderShortcutRows() {
    const mainContainer = document.createDocumentFragment();

    try {
        const shortcutRowsCollection = collection(db, "shortcut_rows");
        const rowsQuery = query(shortcutRowsCollection, orderBy("order", "asc"));
        const rowsSnapshot = await getDocs(rowsQuery);

        if (rowsSnapshot.empty) {
            return null;
        }

        for (const rowDoc of rowsSnapshot.docs) {
            const rowData = { id: rowDoc.id, ...rowDoc.data() };
            const rowTitle = rowData.title[AppLogic.getCurrentLanguage()] || rowData.title.ku_sorani;

            const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
            const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
            const cardsSnapshot = await getDocs(cardsQuery);

            if (!cardsSnapshot.empty) {
                const sectionContainer = document.createElement('div');
                sectionContainer.className = 'shortcut-cards-section';

                const titleElement = document.createElement('h3');
                titleElement.className = 'shortcut-row-title';
                titleElement.textContent = rowTitle;
                sectionContainer.appendChild(titleElement);

                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'shortcut-cards-container';
                sectionContainer.appendChild(cardsContainer);

                cardsSnapshot.forEach(cardDoc => {
                    const cardData = cardDoc.data();
                    const cardName = cardData.name[AppLogic.getCurrentLanguage()] || cardData.name.ku_sorani;

                    const item = document.createElement('div');
                    item.className = 'shortcut-card';
                    item.innerHTML = `
                        <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                        <div class="shortcut-card-name">${cardName}</div>
                    `;

                    item.onclick = async () => {
                        await AppLogic.navigateToFilter({
                            category: cardData.categoryId || 'all',
                            subcategory: cardData.subcategoryId || 'all',
                            subSubcategory: cardData.subSubcategoryId || 'all',
                            search: ''
                        });
                    };
                    cardsContainer.appendChild(item);
                });

                mainContainer.appendChild(sectionContainer);
            }
        }

        return mainContainer;

    } catch (error) {
        console.error("Error fetching shortcut rows:", error);
        return null;
    }
}

async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = 'brandsContainer';
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[AppLogic.getCurrentLanguage()] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                await AppLogic.navigateToFilter({
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all',
                    search: ''
                });
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null;
    }
}

async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = AppLogic.t('newest_products');
    header.appendChild(title);
    container.appendChild(header);
    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    container.appendChild(productsScroller);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderCategorySections() {
    const mainContainer = document.createElement('div');
    const categoriesToRender = categories.filter(cat => cat.id !== 'all');
    categoriesToRender.sort((a, b) => (a.order || 99) - (b.order || 99));

    for (const category of categoriesToRender) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'dynamic-section';

        const header = document.createElement('div');
        header.className = 'section-title-header';

        const title = document.createElement('h3');
        title.className = 'section-title-main';
        const categoryName = category['name_' + AppLogic.getCurrentLanguage()] || category.name_ku_sorani;
        title.innerHTML = `<i class="${category.icon}"></i> ${categoryName}`;
        header.appendChild(title);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = AppLogic.t('see_all');
        seeAllLink.onclick = async () => {
            await AppLogic.navigateToFilter({
                category: category.id,
                subcategory: 'all',
                subSubcategory: 'all',
                search: ''
            });
        };
        header.appendChild(seeAllLink);

        sectionContainer.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        sectionContainer.appendChild(productsScroller);

        try {
            const q = query(
                productsCollection,
                where('categoryId', '==', category.id),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const card = createProductCardElement(product);
                    productsScroller.appendChild(card);
                });
                mainContainer.appendChild(sectionContainer);
            }
        } catch (error) {
            console.error(`Error fetching products for category ${category.id}:`, error);
        }
    }
    return mainContainer;
}

async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = AppLogic.t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

export async function renderHomePageContent() {
    if (isRenderingHomePage) {
        return;
    }
    isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        UI.renderSkeletonLoader();
        homeSectionsContainer.innerHTML = '';

        if (allPromoCards.length === 0) {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
        }

        let promoGrid = null;
        if (allPromoCards.length > 0) {
            if (currentPromoCardIndex >= allPromoCards.length) currentPromoCardIndex = 0;
            const promoCardElement = createPromoCardElement(allPromoCards[currentPromoCardIndex]);
            promoGrid = document.createElement('div');
            promoGrid.className = 'products-container';
            promoGrid.style.marginBottom = '24px';
            promoGrid.appendChild(promoCardElement);
            startPromoRotation();
        }

        const [brandsSection, newestSection, categorySections, shortcutRowsFragment, allProductsSection] = await Promise.all([
            renderBrandsSection(),
            renderNewestProductsSection(),
            renderCategorySections(),
            renderShortcutRows(),
            renderAllProductsSection()
        ]);

        if (promoGrid) homeSectionsContainer.appendChild(promoGrid);
        if (brandsSection) homeSectionsContainer.appendChild(brandsSection);
        if (newestSection) homeSectionsContainer.appendChild(newestSection);
        if (categorySections) homeSectionsContainer.appendChild(categorySections);
        if (shortcutRowsFragment) homeSectionsContainer.appendChild(shortcutRowsFragment);
        if (allProductsSection) homeSectionsContainer.appendChild(allProductsSection);

    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p>هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        document.getElementById('skeletonLoader').style.display = 'none';
        isRenderingHomePage = false;
    }
}

export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const loader = document.getElementById('loader');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    const { currentCategory, currentSubcategory, currentSubSubcategory } = AppLogic.getCurrentFilterState();

    const shouldShowHomeSections = !searchTerm && currentCategory === 'all' && currentSubcategory === 'all' && currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        if (homeSectionsContainer.innerHTML.trim() === '') {
            await renderHomePageContent();
        } else {
            startPromoRotation();
        }
        return;
    } else {
        homeSectionsContainer.style.display = 'none';
        if(promoRotationInterval) clearInterval(promoRotationInterval);
    }

    const cacheKey = `${currentCategory}-${currentSubcategory}-${currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    if (isNewSearch && productCache[cacheKey]) {
        products = productCache[cacheKey].products;
        lastVisibleProductDoc = productCache[cacheKey].lastVisible;
        allProductsLoaded = productCache[cacheKey].allLoaded;
        skeletonLoader.style.display = 'none';
        loader.style.display = 'none';
        productsContainer.style.display = 'grid';
        UI.renderProducts();
        scrollTrigger.style.display = allProductsLoaded ? 'none' : 'block';
        return;
    }

    if (isLoadingMoreProducts) return;

    if (isNewSearch) {
        allProductsLoaded = false;
        lastVisibleProductDoc = null;
        products = [];
        UI.renderSkeletonLoader();
    }

    if (allProductsLoaded && !isNewSearch) return;

    isLoadingMoreProducts = true;
    loader.style.display = 'block';

    try {
        let productsQuery = collection(db, "products");

        if (currentCategory && currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", currentCategory));
        }
        if (currentSubcategory && currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", currentSubcategory));
        }
        if (currentSubSubcategory && currentSubSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", currentSubSubcategory));
        }

        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
        }

        if (finalSearchTerm) {
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        if (lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(lastVisibleProductDoc));
        }

        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        products = isNewSearch ? newProducts : [...products, ...newProducts];

        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            allProductsLoaded = true;
            scrollTrigger.style.display = 'none';
        } else {
            allProductsLoaded = false;
            scrollTrigger.style.display = 'block';
        }

        lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];

        if (isNewSearch) {
            productCache[cacheKey] = {
                products: products,
                lastVisible: lastVisibleProductDoc,
                allLoaded: allProductsLoaded
            };
        }

        UI.renderProducts();

        if (products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ కాڵایەک نەدۆزرایەوە.</p>';
        }
    } catch (error) {
        console.error("Error fetching content:", error);
        productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
    } finally {
        isLoadingMoreProducts = false;
        loader.style.display = 'none';
        skeletonLoader.style.display = 'none';
        productsContainer.style.display = 'grid';
    }
}

export function setupScrollObserver() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            const { currentSearch } = AppLogic.getCurrentFilterState();
            searchProductsInFirestore(currentSearch, false);
        }
    }, {
        root: null,
        threshold: 0.1
    });

    observer.observe(trigger);
}


//======================================================================
//============ بەشی ٦: فەنکشنەکانی ئاگەداری و ڕێکخستنی پەیوەندی ============
//======================================================================

export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            UI.showNotification('مۆڵەتی ناردنی ئاگەداری درا', 'success');
            const currentToken = await getToken(messaging, {
                vapidKey: 'BIepTNN6INcxIW9Of96udIKoMXZNTmP3q3aflB6kNLY3FnYe_3U6bfm3gJirbU9RgM3Ex0o1oOScF_sRBTsPyfQ'
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            UI.showNotification('مۆڵەت نەدرا', 'error');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission: ', error);
    }
}

async function saveTokenToFirestore(token) {
    try {
        const tokensCollection = collection(db, 'device_tokens');
        await setDoc(doc(tokensCollection, token), {
            createdAt: Date.now()
        });
        console.log('Token saved to Firestore.');
    } catch (error) {
        console.error('Error saving token to Firestore: ', error);
    }
}

function displayPromoCard(index) {
    const promoCardSlot = document.querySelector('.promo-card-grid-item');
    if (!promoCardSlot) return;

    const cardData = allPromoCards[index];
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

function rotatePromoCard() {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex = (currentPromoCardIndex + 1) % allPromoCards.length;
    displayPromoCard(currentPromoCardIndex);
}

function changePromoCard(direction) {
    if (allPromoCards.length <= 1) return;
    currentPromoCardIndex += direction;
    if (currentPromoCardIndex >= allPromoCards.length) {
        currentPromoCardIndex = 0;
    } else if (currentPromoCardIndex < 0) {
        currentPromoCardIndex = allPromoCards.length - 1;
    }
    displayPromoCard(currentPromoCardIndex);
    startPromoRotation();
}

function startPromoRotation() {
    if (promoRotationInterval) {
        clearInterval(promoRotationInterval);
    }
    if (allPromoCards.length > 1) {
        promoRotationInterval = setInterval(rotatePromoCard, 5000);
    }
}

function generateOrderMessage() {
    if (cart.length === 0) return "";
    let message = AppLogic.t('order_greeting') + "\n\n";
    cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[AppLogic.getCurrentLanguage()]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : 'کاڵای بێ ناو');
        const itemDetails = AppLogic.t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity });
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });
    message += `\n${AppLogic.t('order_total')}: ${document.getElementById('totalAmount').textContent} د.ع.\n`;

    if (userProfile.name && userProfile.address && userProfile.phone) {
        message += `\n${AppLogic.t('order_user_info')}\n`;
        message += `${AppLogic.t('order_user_name')}: ${userProfile.name}\n`;
        message += `${AppLogic.t('order_user_address')}: ${userProfile.address}\n`;
        message += `${AppLogic.t('order_user_phone')}: ${userProfile.phone}\n`;
    } else {
        message += `\n${AppLogic.t('order_prompt_info')}\n`;
    }
    return message;
}

export function clearProductCache() {
    console.log("Product cache and home page cleared.");
    productCache = {};
    const homeContainer = document.getElementById('homePageSectionsContainer');
    if (homeContainer) {
        homeContainer.innerHTML = '';
    }
}
