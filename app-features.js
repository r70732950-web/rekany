// app-features.js
// Fonksiyonên taybetmendî, UI rendering, data fetching, û kiryarên bikarhêner

import {
    // Firebase services ji setup
    db, auth,
    // Collections ji setup
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Koleksiyonên nû
    // State û constants ji setup
    state, CART_KEY, FAVORITES_KEY, PROFILE_KEY, PRODUCTS_PER_PAGE, translations,
    // DOM Elements (yên ku features rasterast bikar tînin)
    productsContainer, skeletonLoader, cartItemsContainer, emptyCartMessage,
    cartTotal, totalAmount, cartActions, favoritesContainer, emptyFavoritesMessage,
    sheetCategoriesContainer, productCategorySelect, subcategorySelectContainer,
    productSubcategorySelect, subSubcategorySelectContainer, productSubSubcategorySelect,
    profileForm, mainPage, settingsPage, // Ji bo kontrolkirina visibility hinek caran
    notificationBadge, notificationsListContainer, termsContentContainer,
    subcategoriesContainer, subSubcategoriesContainer, // Ji bo rendering
    // Modal û Sheet containers
    productFormModal, formTitle, imageInputsContainer,
    // ... û elementên din ên ku ji hêla taybetmendiyan ve têne rêvebirin
} from './app-setup.js';

// Import servicesên Firebase ku rasterast di features de têne bikaranîn
import { doc, getDoc, getDocs, collection, query, orderBy, where, limit, startAfter, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import fonksiyonên core ku dibe ku hewce bin (mînak: t, showNotification)
// Ev êdî ne hewce ne ger em wan rasterast ji globalTools bikar bînin an jî li vir ji nû ve pênase bikin
// import { t, showNotification } from './app-core.js'; // Yan jî rasterast pênase bikin

// === Helper Functions (Taybet bi Features) ===

/**
 * Fonksiyon ji bo wergerandinê (kopiyek ji core an jî gazîkirina wê)
 * Translates a key using the current language.
 * @param {string} key - The translation key.
 * @param {object} [replacements={}] - Placeholder replacements.
 * @returns {string} The translated string.
 */
function t(key, replacements = {}) {
    // Pêdivî ye ku ev fonksiyon bigihîje `state.currentLanguage` û `translations`
    let translation = (translations[state.currentLanguage] && translations[state.currentLanguage][key]) || (translations['ku_sorani'] && translations['ku_sorani'][key]) || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

/**
 * Fonksiyon ji bo nîşandana notification (kopiyek ji core an jî gazîkirina wê)
 * Displays a short notification message.
 * @param {string} message - The message to display.
 * @param {('success'|'error')} [type='success'] - The type of notification.
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove from DOM after transition ends
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

/**
 * Fonksiyon ji bo formatkirina description (ji bo lînkan û rêzên nû).
 * @param {string} text - Nivîsa description.
 * @returns {string} HTML formatkirî.
 */
function formatDescription(text) {
    if (!text) return '';
    // Escaping HTML characters first
    let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Regex ji bo dîtina URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    // Guhertina URLs bo lînkên HTML
    let textWithLinks = escapedText.replace(urlRegex, (url) => {
        const hyperLink = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Guhertina rêzên nû (\n) bo <br>
    return textWithLinks.replace(/\n/g, '<br>');
}


// === Data Loading and Rendering ===

/**
 * Barkirina daneyên destpêkê (mînak: kategorî).
 */
export async function loadInitialData() {
    return new Promise((resolve, reject) => {
        const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
        const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
            const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            state.categories = [{ id: 'all', icon: 'fas fa-th' }, ...fetchedCategories]; // 'All' lê zêde bike
            console.log("Categories loaded:", state.categories);
            updateCategoryDependentUI(); // UIyên girêdayî nûve bike
            resolve(); // Promise resolve bike piştî barkirina yekem
        }, (error) => {
            console.error("Error loading initial categories:", error);
            reject(error); // Promise reject bike ger xeletî hebe
        });
        // Têbînî: Ji bo sepanên real-time, dibe ku hûn bixwazin unsubscribe nehêlin
        // lê ji bo barkirina destpêkê, em dikarin wê piştî barkirina yekem rawestînin ger ne hewce be
        // Ji bo naha, em ê bihêlin çalak be ji bo nûvekirinên real-time
    });
}

/**
 * UIyên girêdayî kategoriyan nûve dike (dropdowns, bişkokên kategoriyan).
 */
function updateCategoryDependentUI() {
    if (!state.categories || state.categories.length === 0) return;
    populateCategoryDropdown();
    renderMainCategories();
    renderCategoriesSheet(); // Categories di sheet de nûve bike
    // Nûvekirina dropdownên admin ger pêwîst be (bi rêya globalTools an jî fonksiyonek rasterast)
    if (sessionStorage.getItem('isAdmin') === 'true' && window.AdminLogic && window.AdminLogic.updateAdminCategoryDropdowns) {
        window.AdminLogic.updateAdminCategoryDropdowns();
        window.AdminLogic.updateShortcutCardCategoryDropdowns(); // Dropdownên shortcut card jî nûve bike
    }
}

/**
 * Dropdowna kategoriyan di forma productê de tije dike.
 */
function populateCategoryDropdown() {
    // Piştrast be ku element heye
    if (!productCategorySelect) return;
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    // Filter bike 'all'
    const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // Navê kategoriyê li gorî zimanê niha bistîne
        option.textContent = cat['name_' + state.currentLanguage] || cat.name_ku_sorani; // Fallback bo Sorani
        productCategorySelect.appendChild(option);
    });
}

/**
 * Bişkokên kategoriyên sereke di rûpela sereke de render dike.
 */
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Paqij bike

    // Ger categories nehatibin barkirin, tiştek neke
    if (!state.categories || state.categories.length === 0) return;

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id; // ID tomar bike

        // Çalak bike ger kategoriya niha be
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Nav û îkonê li gorî ziman bistîne
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Werger ji bo 'All'
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani); // Fallback

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        // Event listener ji bo klikkirinê
        btn.onclick = () => {
             // Ji app-core.js fonksiyona navîgasyonê bang bike
             if (window.navigateToFilter) window.navigateToFilter({
                 category: cat.id,
                 subcategory: 'all', // Subcategory reset bike
                 subSubcategory: 'all', // Sub-subcategory reset bike
                 search: '' // Lêgerînê reset bike
             });
        };

        container.appendChild(btn);
    });
}

/**
 * Kategoriyan di bottom sheet de render dike.
 */
export function renderCategoriesSheet() {
    if (!sheetCategoriesContainer) return;
    sheetCategoriesContainer.innerHTML = ''; // Paqij bike

    if (!state.categories || state.categories.length === 0) return;

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'sheet-category-btn';
        btn.dataset.category = cat.id;
        if (state.currentCategory === cat.id) { btn.classList.add('active'); }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> ${categoryName}`;

        btn.onclick = () => {
            // Ji app-core.js fonksiyona navîgasyonê bang bike
             if (window.navigateToFilter) window.navigateToFilter({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             });
             // Ji app-core.js fonksiyona girtinê bang bike
            if(window.closeCurrentPopup) window.closeCurrentPopup();
            // Bawer be ku rûpela sereke tê nîşandan (eger berê ne li wir be)
            if(window.showPage) window.showPage('mainPage');
        };

        sheetCategoriesContainer.appendChild(btn);
    });
}

/**
 * Subkategoriyan li binê kategoriyên sereke render dike (ger hebin).
 * @param {string} categoryId - ID ya kategoriya sereke ya hilbijartî.
 */
export async function renderSubcategories(categoryId) {
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Paqij bike
    subcategoriesContainer.style.display = 'none'; // Veşêre bi default

    // Subkategoriyan tenê nîşan bide ger kategoriyek sereke (ji bilî 'all') hatibe hilbijartin
    if (!categoryId || categoryId === 'all') {
         if (subSubcategoriesContainer) subSubcategoriesContainer.style.display = 'none'; // SubSub jî veşêre
        return;
    }

    try {
        const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQuery, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Ger subkategorî tune bin, tiştek nîşan nede
        if (fetchedSubcategories.length === 0) {
             if (subSubcategoriesContainer) subSubcategoriesContainer.style.display = 'none';
            return;
        }

        subcategoriesContainer.style.display = 'flex'; // Konteynerê nîşan bide

        // Bişkojka 'Hemû' ji bo subkategoriyan
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = () => {
             if (window.navigateToFilter) window.navigateToFilter({
                 subcategory: 'all',
                 subSubcategory: 'all' // SubSub jî reset bike
             });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Bişkok ji bo her subkategoriyekê
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;
            subcatBtn.innerHTML = `<img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subcatName}</span>`;
            subcatBtn.onclick = () => {
                 // Navîgasyon bike bo rûpela detaylan (bi rêya core)
                 if (window.showSubcategoryDetailPage) window.showSubcategoryDetailPage(categoryId, subcat.id);
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

        // Sub-subkategoriyan render bike ger subkategoriyek hilbijartî hebe
         await renderSubSubcategories(categoryId, state.currentSubcategory);

    } catch (error) {
        console.error("Error fetching subcategories:", error);
    }
}

/**
 * Sub-subkategoriyan render dike (ger hebin).
 * @param {string} mainCatId - ID ya kategoriya sereke.
 * @param {string} subCatId - ID ya subkategoriya hilbijartî.
 */
async function renderSubSubcategories(mainCatId, subCatId) {
    if (!subSubcategoriesContainer) return;
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none';

    if (!mainCatId || !subCatId || subCatId === 'all') {
        return; // Tenê nîşan bide ger subkategoriyek taybet hatibe hilbijartin
    }

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return; // Ger tune bin, tiştek neke

        subSubcategoriesContainer.style.display = 'flex';

        // Bişkojka 'Hemû' ji bo sub-subkategoriyan
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M3 11H11V3H3V11ZM5 5H9V9H5V5Z M3 21H11V13H3V21ZM5 15H9V19H5V15Z M13 11H21V3H13V11ZM15 5H19V9H15V5Z M13 21H21V13H13V21ZM15 15H19V19H15V15Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.onclick = () => {
            if (window.navigateToFilter) window.navigateToFilter({ subSubcategory: 'all' });
        };
        subSubcategoriesContainer.appendChild(allBtn);

        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;
            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                if (window.navigateToFilter) window.navigateToFilter({ subSubcategory: subSubcat.id });
            };
            subSubcategoriesContainer.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories:", error);
    }
}

/**
 * Skeleton loader nîşan dide dema ku data tê barkirin.
 * @param {HTMLElement} container - Konteynera ku skeleton tê de were nîşandan.
 * @param {number} [count=8] - Hejmara kartên skeleton.
 */
export function renderSkeletonLoader(container = skeletonLoader, count = 8) {
    if (!container) return;
    container.innerHTML = ''; // Paqij bike
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
    container.style.display = 'grid'; // Piştrast be ku grid e
    // Konteynera productan veşêre dema ku skeleton çalak e (tenê ji bo skeletona sereke)
    if (container === skeletonLoader && productsContainer) {
        productsContainer.style.display = 'none';
    }
    // Loaderê bizivir veşêre
     const loaderElement = document.getElementById('loader');
     if(loaderElement) loaderElement.style.display = 'none';
}

/**
 * Anîmasyonên scrollê ji bo kartên productan saz dike.
 */
function setupScrollAnimations() {
    // Piştrast be ku IntersectionObserver heye
    if (!('IntersectionObserver' in window)) {
        console.warn("IntersectionObserver not supported, scroll animations disabled.");
        // Hemû kartan rasterast nîşan bide ger observer tune be
         document.querySelectorAll('.product-card-reveal').forEach(card => {
             card.classList.add('visible');
             card.classList.remove('product-card-reveal'); // Klasê jê bibe da ku ji nû ve neyê trigger kirin
         });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Piştî ku carekê xuya bû, êdî neşopîne
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // 10% ji kartê xuya bibe
    });

    // Hemû kartên ku hewceyî anîmasyonê ne bişopîne
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}


// === Product Rendering ===

/**
 * Elementa HTML ji bo kartek productê diafirîne.
 * @param {object} product - Objekta daneya productê.
 * @returns {HTMLElement} Elementa div a kartekê.
 */
export function createProductCardElement(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card'; // Klasa bingehîn
    productCard.classList.add('product-card-reveal'); // Klas ji bo anîmasyonê
    productCard.dataset.productId = product.id; // ID tomar bike

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // Navê productê li gorî zimanê niha
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name'); // Fallback

    // Wêneya sereke
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // Beşa bihayê û discount
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    if (hasDiscount) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // Zanyariyên zêde (mînak: shipping)
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>`;
    }

    // Bişkoka favorite
    const isProdFavorite = isFavorite(product.id);
    const heartIconClass = isProdFavorite ? 'fas' : 'far'; // Filled or outline heart
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // HTMLya tevahî ya kartê
    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            <button class="${favoriteBtnClass}" aria-label="${t('toggle_favorite')}">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
            <button class="share-btn-card" aria-label="${t('share_product')}">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card" aria-label="${t('add_to_cart')}">
                <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="${t('edit_product')}"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="${t('delete_product')}"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Event listener ji bo tevahiya kartê (ji bilî bişkokan)
    productCard.addEventListener('click', (event) => {
        // Tenê detayan nîşan bide ger li ser kartê hatibe klikkirin, ne li ser bişkokekê
        if (!event.target.closest('button')) {
             showProductDetailsWithData(product); // Assume product object is available
        }
    });

    // Event listener ji bo bişkokan (bi delegation ji kartê)
    productCard.addEventListener('click', async (event) => {
        const target = event.target;
        const currentProductId = product.id; // ID ji closure bistîne

        // Bişkoka Add to Cart
        if (target.closest('.add-to-cart-btn-card')) {
            event.stopPropagation(); // Pêşî li triggerkirina clicka kartê bigire
            const btn = target.closest('.add-to-cart-btn-card');
            addToCart(currentProductId); // Fonksiyona addToCart bang bike
            // Feedback dîtbarî bide bikarhêner
             if (!btn.disabled) {
                 const originalContent = btn.innerHTML;
                 btn.disabled = true;
                 btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; // Loading
                 setTimeout(() => {
                     btn.innerHTML = `<i class="fas fa-check"></i>`; // Added
                     setTimeout(() => {
                         btn.innerHTML = originalContent; // Vegerîne rewşa normal
                         btn.disabled = false;
                     }, 1500);
                 }, 500);
             }
        }
        // Bişkoka Favorite
        else if (target.closest('.favorite-btn')) {
            event.stopPropagation();
            toggleFavorite(currentProductId); // Fonksiyona toggleFavorite bang bike
        }
        // Bişkoka Share
        else if (target.closest('.share-btn-card')) {
            event.stopPropagation();
             await shareProduct(product); // Fonksiyona shareProduct bang bike (pêdivî ye were çêkirin)
        }
        // Bişkokên Admin
        else if (isAdmin && target.closest('.edit-btn')) {
            event.stopPropagation();
            if (window.AdminLogic && window.AdminLogic.editProduct) {
                window.AdminLogic.editProduct(currentProductId);
            }
        } else if (isAdmin && target.closest('.delete-btn')) {
            event.stopPropagation();
            if (window.AdminLogic && window.AdminLogic.deleteProduct) {
                window.AdminLogic.deleteProduct(currentProductId);
            }
        }
    });

    return productCard;
}

/**
 * Productên ku hatine barkirin di konteynerê de render dike.
 */
function renderProducts() {
    if (!productsContainer) return;
    productsContainer.innerHTML = ''; // Konteynerê paqij bike

    if (!state.products || state.products.length === 0) {
        // Ger ti product tune bin (piştî lêgerînê/filterkirinê), peyamek nîşan bide
        // Ev tenê piştî ku skeleton loader winda dibe tê nîşandan
        // productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found')}</p>`;
        return;
    }

    // Ji bo her productekê kartekê çêbike û lê zêde bike
    state.products.forEach(item => {
        let element = createProductCardElement(item);
        productsContainer.appendChild(element);
    });

    // Anîmasyonên scrollê saz bike ji bo kartên nû
    setupScrollAnimations();
}


// === Product Details ===

/**
 * Fonksiyon ji bo dîtina productekê bi ID û nîşandana detaylan.
 * @param {string} productId - ID ya productê.
 */
export async function showProductDetailsById(productId) {
     const allFetchedProducts = [...(state.products || [])]; // Kopiyek çêbike
     let product = allFetchedProducts.find(p => p.id === productId);

     if (!product) {
          console.log(`Product ${productId} not in local state. Fetching...`);
          try {
               const docSnap = await getDoc(doc(db, "products", productId));
               if (docSnap.exists()) {
                    product = { id: docSnap.id, ...docSnap.data() };
               } else {
                    showNotification(t('product_not_found_error'), 'error');
                    return;
               }
          } catch (error) {
               console.error("Error fetching product details:", error);
               showNotification(t('error_generic'), 'error');
               return;
          }
     }
     // Niha ku product heye, detayan nîşan bide
     showProductDetailsWithData(product);
}

/**
 * Detayên productekê di bottom sheet de nîşan dide.
 * @param {object} product - Objekta daneya productê.
 */
export function showProductDetailsWithData(product) {
    const sheetContent = document.querySelector('#productDetailSheet .sheet-content');
    if (sheetContent) sheetContent.scrollTop = 0; // Scroll bike jor

    // Daneyên productê ji bo zimanê niha bistîne
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name');
    const descriptionText = (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '';
    const imageUrls = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []);

    // Elementên DOMê yên di sheetê de
    const imageContainer = document.getElementById('sheetImageContainer');
    const thumbnailContainer = document.getElementById('sheetThumbnailContainer');
    const productNameTitle = document.getElementById('sheetProductName');
    const productPriceContainer = document.getElementById('sheetProductPrice');
    const productDescription = document.getElementById('sheetProductDescription');
    const addToCartButton = document.getElementById('sheetAddToCartBtn');
    const prevBtn = document.getElementById('sheetPrevBtn');
    const nextBtn = document.getElementById('sheetNextBtn');

    // Piştrast be ku hemû element hene
    if (!imageContainer || !thumbnailContainer || !productNameTitle || !productPriceContainer || !productDescription || !addToCartButton || !prevBtn || !nextBtn) {
        console.error("One or more elements missing in product detail sheet.");
        return;
    }

    // Slidera wêneyan saz bike
    imageContainer.innerHTML = '';
    thumbnailContainer.innerHTML = '';
    let currentIndex = 0;

    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            // Wêneya mezin
            const img = document.createElement('img');
            img.src = url;
            img.alt = nameInCurrentLang;
            if (index === 0) img.classList.add('active');
            imageContainer.appendChild(img);

            // Thumbnail
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.dataset.index = index;
            thumb.onclick = () => updateSlider(index); // Event ji bo klikkirina thumbnail
            thumbnailContainer.appendChild(thumb);
        });
    } else {
        // Wêneyek default nîşan bide ger tune be
        imageContainer.innerHTML = `<img src="https://placehold.co/400x400/e2e8f0/2d3748?text=No+Image" alt="${nameInCurrentLang}" class="active">`;
    }

    const images = imageContainer.querySelectorAll('img');
    const thumbnails = thumbnailContainer.querySelectorAll('.thumbnail');

    // Fonksiyon ji bo nûvekirina slidera wêneyan
    function updateSlider(index) {
        if (index < 0 || index >= images.length) return; // Ji sînoran dernekeve
        images.forEach((img, i) => img.classList.toggle('active', i === index));
        thumbnails.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
        currentIndex = index;
    }

    // Bişkokên Next/Prev tenê nîşan bide ger zêdetirî wêneyek hebe
    const showNavButtons = imageUrls.length > 1;
    prevBtn.style.display = showNavButtons ? 'flex' : 'none';
    nextBtn.style.display = showNavButtons ? 'flex' : 'none';
    thumbnailContainer.style.display = showNavButtons ? 'flex' : 'none';


    // Event ji bo bişkokên Next/Prev
    prevBtn.onclick = () => updateSlider((currentIndex - 1 + images.length) % images.length);
    nextBtn.onclick = () => updateSlider((currentIndex + 1) % images.length);


    // Detayên din saz bike
    productNameTitle.textContent = nameInCurrentLang;
    productDescription.innerHTML = formatDescription(descriptionText); // HTML formatkirî bikar bîne

    // Bihayê saz bike (bi discount an bêyî wê)
    if (product.originalPrice && product.originalPrice > product.price) {
        productPriceContainer.innerHTML = `<span style="color: var(--accent-color);">${product.price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${product.originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        productPriceContainer.innerHTML = `<span>${product.price.toLocaleString()} د.ع</span>`;
    }

    // Bişkoka Add to Cart saz bike
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    addToCartButton.onclick = () => {
        addToCart(product.id);
        if(window.closeCurrentPopup) window.closeCurrentPopup(); // Sheetê bigire piştî zêdekirinê
    };

    // Productên pêwendîdar render bike
    renderRelatedProducts(product);

    // Sheetê veke (bi rêya core)
     if (window.openPopup) window.openPopup('productDetailSheet');
     // URL nûve bike bêyî reload
     const productUrl = `${window.location.pathname}?product=${product.id}${window.location.hash}`;
     history.replaceState(history.state, '', productUrl);
}

/**
 * Productên pêwendîdar li binê detayên productê render dike.
 * @param {object} currentProduct - Objekta producta niha.
 */
async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = ''; // Paqij bike
    section.style.display = 'none'; // Veşêre bi default

    // Pêdivî bi categoryId an subcategoryId heye ji bo dîtina pêwendîdaran
    if (!currentProduct.subcategoryId && !currentProduct.categoryId) {
        return;
    }

    let q;
    // Pêşî hewl bide li gorî subSubcategory bibîne
    if (currentProduct.subSubcategoryId) {
        q = query(
            productsCollection,
            where('subSubcategoryId', '==', currentProduct.subSubcategoryId),
            where('__name__', '!=', currentProduct.id), // Xwe derxe
            limit(8) // Hejmarek maqûl
        );
    }
    // Paşê hewl bide li gorî subcategory
    else if (currentProduct.subcategoryId) {
        q = query(
            productsCollection,
            where('subcategoryId', '==', currentProduct.subcategoryId),
            where('__name__', '!=', currentProduct.id),
            limit(8)
        );
    }
    // Di dawiyê de li gorî categoryId
    else {
        q = query(
            productsCollection,
            where('categoryId', '==', currentProduct.categoryId),
            where('__name__', '!=', currentProduct.id),
            limit(8)
        );
    }

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Tiştek tune ye ku were nîşandan
        }

        // Kartên productên pêwendîdar çêbike û lê zêde bike
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Fonksiyona heyî bikar bîne
            container.appendChild(card);
        });

        section.style.display = 'block'; // Beşê nîşan bide

    } catch (error) {
        console.error("Error fetching related products:", error);
    }
}

/**
 * Fonksiyon ji bo parvekirina productekê bi Web Share API yan jî kopîkirina lînkê.
 * @param {object} product - Objekta productê.
 */
async function shareProduct(product) {
    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || t('product_no_name');
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`; // URL bêyî hash

    const shareData = {
        title: nameInCurrentLang,
        text: `${t('share_text')}: ${nameInCurrentLang}`, // Wergera 'Check out this product'
        url: productUrl,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            console.log('Product shared successfully');
        } else {
            // Fallback ji bo kopîkirina lînkê ger Web Share API tune be
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(productUrl);
                showNotification(t('link_copied'), 'success'); // Wergera 'Link copied!'
            } else {
                // Fallbacka dawî (ji bo browserên kevn)
                const textArea = document.createElement('textarea');
                textArea.value = productUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showNotification(t('link_copied'), 'success');
            }
        }
    } catch (err) {
        // Bikarhêner dibe ku parvekirin betal kiribe
        if (err.name !== 'AbortError') {
            console.error('Share error:', err);
            showNotification(t('share_error'), 'error'); // Wergera 'Share failed'
        }
    }
}

// === Cart Management ===

/**
 * Cartê di localStorage de tomar dike û hejmarê nûve dike.
 */
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
}

/**
 * Hejmara tiştan di îkona cartê de nûve dike.
 */
function updateCartCount() {
    const totalItems = state.cart.reduce((total, item) => total + item.quantity, 0);
    // Hemû elementên ku hejmarê nîşan didin nûve bike
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalItems;
        // Ger hejmar sifir be, dibe ku were veşartin (li gorî CSS)
        el.style.display = totalItems > 0 ? 'flex' : 'none';
    });
}

/**
 * Productekê li cartê zêde dike.
 * @param {string} productId - ID ya productê.
 */
export function addToCart(productId) {
    // Hewl bide productê ji state.products bibîne
     let product = state.products?.find(p => p.id === productId);
     let existingItem = state.cart.find(item => item.id === productId);

     if (existingItem) {
          existingItem.quantity++;
          saveCart();
          showNotification(t('product_added_to_cart')); // Yan 'quantity_updated'
     } else if (product) {
          // Ger product di state de hebe, daneyên wê bikar bîne
          const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || '');
          state.cart.push({
               id: product.id,
               name: product.name, // Objecta navan tomar bike
               price: product.price,
               image: mainImage,
               quantity: 1
          });
          saveCart();
          showNotification(t('product_added_to_cart'));
     } else {
          // Ger product di state de tune be, hewl bide ji Firestore bistîne
          console.warn(`Product ${productId} not in local state. Fetching before adding to cart.`);
          getDoc(doc(db, "products", productId)).then(docSnap => {
               if (docSnap.exists()) {
                    const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
                    const mainImage = (fetchedProduct.imageUrls && fetchedProduct.imageUrls.length > 0) ? fetchedProduct.imageUrls[0] : (fetchedProduct.image || '');
                    // Dibe ku di vê navberê de hatibe zêdekirin, ji nû ve kontrol bike
                    existingItem = state.cart.find(item => item.id === productId);
                    if (existingItem) {
                         existingItem.quantity++;
                    } else {
                         state.cart.push({
                              id: fetchedProduct.id,
                              name: fetchedProduct.name, // Objecta navan tomar bike
                              price: fetchedProduct.price,
                              image: mainImage,
                              quantity: 1
                         });
                    }
                    saveCart();
                    showNotification(t('product_added_to_cart'));
               } else {
                    showNotification(t('product_not_found_error'), 'error');
               }
          }).catch(error => {
               console.error("Error fetching product to add to cart:", error);
               showNotification(t('error_generic'), 'error');
          });
     }
}

/**
 * Hejmara productekê di cartê de diguherîne.
 * @param {string} productId - ID ya productê.
 * @param {number} change - Guhertina hejmarê (+1 an -1).
 */
function updateQuantity(productId, change) {
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId); // Ger hejmar bibe sifir, jê bibe
        } else {
            saveCart();
            renderCart(); // UIya cartê nûve bike
        }
    }
}

/**
 * Productekê ji cartê radike.
 * @param {string} productId - ID ya productê.
 */
function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // UIya cartê nûve bike
}

/**
 * UIya cartê di bottom sheet de render dike.
 */
export function renderCart() {
    if (!cartItemsContainer) return; // Ger element tune be, derkeve

    cartItemsContainer.innerHTML = ''; // Paqij bike
    if (state.cart.length === 0) {
        if (emptyCartMessage) emptyCartMessage.style.display = 'block';
        if (cartTotal) cartTotal.style.display = 'none';
        if (cartActions) cartActions.style.display = 'none';
        updateCartCount(); // Piştrast be ku hejmar sifir e
        return;
    }

    // Ger tişt hebin, peyama vala veşêre û total/actions nîşan bide
    if (emptyCartMessage) emptyCartMessage.style.display = 'none';
    if (cartTotal) cartTotal.style.display = 'block';
    if (cartActions) cartActions.style.display = 'block';
    renderCartActionButtons(); // Bişkokên şandinê render bike

    let total = 0;
    state.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';

        // Navê li gorî zimanê niha bistîne
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('product_no_name'));

        cartItem.innerHTML = `
            <img src="${item.image || 'https://placehold.co/60x60/e2e8f0/2d3748?text=N/A'}" alt="${itemNameInCurrentLang}" class="cart-item-image" onerror="this.src='https://placehold.co/60x60/e2e8f0/2d3748?text=Err'">
            <div class="cart-item-details">
                <div class="cart-item-title">${itemNameInCurrentLang}</div>
                <div class="cart-item-price">${item.price.toLocaleString()} د.ع.</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn increase-btn" data-id="${item.id}" aria-label="${t('increase_quantity')}">+</button>
                    <span class="quantity-text">${item.quantity}</span>
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" aria-label="${t('decrease_quantity')}">-</button>
                </div>
            </div>
            <div class="cart-item-subtotal">
                 <div>${t('subtotal')}</div> <span>${itemTotal.toLocaleString()} د.ع.</span>
                <button class="cart-item-remove" data-id="${item.id}" aria-label="${t('remove_item')}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    // Bihayê giştî nûve bike
    if (totalAmount) totalAmount.textContent = total.toLocaleString();

    // Event listeneran ji bo bişkokên +/-/remove saz bike
    cartItemsContainer.querySelectorAll('.increase-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, 1));
    cartItemsContainer.querySelectorAll('.decrease-btn').forEach(btn => btn.onclick = (e) => updateQuantity(e.currentTarget.dataset.id, -1));
    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.id));
}

/**
 * Peyama orderê ji bo şandinê (WhatsApp, Viber, etc.) diafirîne.
 * @returns {string} Peyama formatkirî.
 */
function generateOrderMessage() {
    if (state.cart.length === 0) return "";

    let message = t('order_greeting') + "\n\n"; // Wergera "Hello! I need these items:"

    // Zêdekirina her tiştekî bi detaylan
    state.cart.forEach(item => {
        const itemNameInCurrentLang = (item.name && item.name[state.currentLanguage]) || (item.name && item.name.ku_sorani) || (typeof item.name === 'string' ? item.name : t('product_no_name'));
        const itemDetails = t('order_item_details', { price: item.price.toLocaleString(), quantity: item.quantity }); // Wergera "Price: {price} IQD | Quantity: {quantity}"
        message += `- ${itemNameInCurrentLang} | ${itemDetails}\n`;
    });

    // Zêdekirina bihayê giştî
    message += `\n${t('order_total')}: ${totalAmount.textContent} د.ع.\n`; // Wergera "Total Price"

    // Zêdekirina zanyariyên bikarhêner ger hebin
    if (state.userProfile?.name && state.userProfile?.address && state.userProfile?.phone) {
        message += `\n${t('order_user_info')}\n`; // Wergera "--- Customer Info ---"
        message += `${t('order_user_name')}: ${state.userProfile.name}\n`; // Wergera "Name"
        message += `${t('order_user_address')}: ${state.userProfile.address}\n`; // Wergera "Address"
        message += `${t('order_user_phone')}: ${state.userProfile.phone}\n`; // Wergera "Phone Number"
    } else {
        // Daxwazkirina zanyariyan ger tune bin
        message += `\n${t('order_prompt_info')}\n`; // Wergera "Please send your name, address, and phone number for delivery."
    }
    return message;
}

/**
 * Bişkokên şandina orderê (WhatsApp, Viber, etc.) render dike.
 */
async function renderCartActionButtons() {
    const container = document.getElementById('cartActions');
    if (!container) return;
    container.innerHTML = '...'; // Loading

    try {
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        // Li gorî rêza 'createdAt' yan jî fielda 'order' ger hebe
        const q = query(methodsCollection, orderBy("createdAt")); // Yan orderBy("order") ger hebe
        const snapshot = await getDocs(q);

        container.innerHTML = ''; // Paqij bike berî lê zêdekirinê
        if (snapshot.empty) {
            container.innerHTML = `<p>${t('no_send_methods')}</p>`; // Wergera 'No sending methods defined.'
            return;
        }

        snapshot.forEach(doc => {
            const method = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            // Klasa giştî û dibe ku klasa taybet li gorî type
            btn.className = `whatsapp-btn contact-method-btn contact-method-${method.type}`;
            btn.style.backgroundColor = method.color || 'var(--primary-color)'; // Rengê default

            const name = method['name_' + state.currentLanguage] || method.name_ku_sorani; // Navê bişkokê
            btn.innerHTML = `<i class="${method.icon || 'fas fa-paper-plane'}"></i> <span>${name}</span>`; // Îkona default

            btn.onclick = () => {
                const message = generateOrderMessage();
                if (!message) return;

                let link = '';
                const encodedMessage = encodeURIComponent(message);
                const value = method.value; // Hejmar, username, an URL

                // Lînkan li gorî cûreyê çêbike
                switch (method.type) {
                    case 'whatsapp':
                        link = `https://wa.me/${value}?text=${encodedMessage}`;
                        break;
                    case 'viber':
                        // Piştrast be ku hejmar bi + dest pê dike ji bo viber
                        const viberNumber = value.startsWith('+') ? value : `+${value}`;
                        link = `viber://chat?number=${encodeURIComponent(viberNumber)}&text=${encodedMessage}`;
                        // Yan jî ji bo desktop: viber://pa?chatURI=PublicAccountName&text=EncodedText
                        break;
                    case 'telegram':
                        // Ji bo telegram, @ ji username rake ger hebe
                        const telegramUsername = value.startsWith('@') ? value.substring(1) : value;
                        link = `https://t.me/${telegramUsername}?text=${encodedMessage}`;
                        break;
                    case 'phone':
                        link = `tel:${value}`; // Tenê hejmarê bikar bîne
                        break;
                    case 'url':
                        link = value; // URL wekî xwe bikar bîne
                        break;
                    default:
                        console.warn("Unknown contact method type:", method.type);
                        return; // Ger cûre ne diyar be, tiştek neke
                }

                if (link) {
                    window.open(link, '_blank'); // Di tabek nû de veke
                }
            };

            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error rendering cart action buttons:", error);
        container.innerHTML = `<p>${t('error_loading_send_methods')}</p>`; // Werger
    }
}


// === Favorites Management ===

/**
 * Favoritean di localStorage de tomar dike.
 */
function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

/**
 * Kontrol dike ka productek favorite e.
 * @param {string} productId - ID ya productê.
 * @returns {boolean} Rast e ger favorite be.
 */
export function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/**
 * Rewşa favorite ya productekê diguherîne.
 * @param {string} productId - ID ya productê.
 */
export function toggleFavorite(productId) {
    const isCurrentlyFavorite = isFavorite(productId);

    if (isCurrentlyFavorite) {
        state.favorites = state.favorites.filter(id => id !== productId);
        showNotification(t('product_removed_from_favorites'), 'error');
    } else {
        state.favorites.push(productId);
        showNotification(t('product_added_to_favorites'), 'success');
    }
    saveFavorites(); // Guhertinê tomar bike

    // UIya hemû kartên vê productê nûve bike (li seranserê sepanê)
    document.querySelectorAll(`.product-card[data-product-id="${productId}"]`).forEach(card => {
        const favButton = card.querySelector('.favorite-btn');
        const heartIcon = card.querySelector('.fa-heart');
        if (favButton && heartIcon) {
            const isNowFavorite = !isCurrentlyFavorite;
            favButton.classList.toggle('favorited', isNowFavorite);
            heartIcon.classList.toggle('fas', isNowFavorite); // Solid heart
            heartIcon.classList.toggle('far', !isNowFavorite); // Outline heart
            // Aria label nûve bike
            favButton.setAttribute('aria-label', isNowFavorite ? t('remove_from_favorites') : t('add_to_favorites'));
        }
    });

    // Ger rûpela favorites vekirî be, wê nûve bike
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage();
    }
}

/**
 * Rûpela favorites di bottom sheet de render dike.
 */
export async function renderFavoritesPage() {
    if (!favoritesContainer) return;

    favoritesContainer.innerHTML = ''; // Paqij bike
    renderSkeletonLoader(favoritesContainer, 4); // Skeleton nîşan bide

    if (state.favorites.length === 0) {
        if (emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'block';
        favoritesContainer.style.display = 'none'; // Grid veşêre
        return;
    }

    if (emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'none';
    favoritesContainer.style.display = 'grid'; // Grid nîşan bide

    try {
        // Hewl bide ku detayên productên favorite ji Firestore bistîne
        // Promise.all bikar bîne ji bo barkirina paralel
        const fetchPromises = state.favorites.map(id => getDoc(doc(db, "products", id)));
        const productSnaps = await Promise.all(fetchPromises);

        favoritesContainer.innerHTML = ''; // Skeleton rake

        // Tenê productên ku hatine dîtin (dibe ku hatibin jêbirin) filter bike
        const favoritedProducts = productSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));

        if (favoritedProducts.length === 0 && state.favorites.length > 0) {
             // Ger favorite IDs hebin lê product tune bin (dibe ku jêbirin)
             if (emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
             // Dibe ku hûn bixwazin favorite IDs yên nederbasdar ji state paqij bikin
             state.favorites = favoritedProducts.map(p => p.id);
             saveFavorites();
        } else if (favoritedProducts.length > 0) {
            // Kartan ji bo her productek favorite render bike
            favoritedProducts.forEach(product => {
                const productCard = createProductCardElement(product);
                favoritesContainer.appendChild(productCard);
            });
            setupScrollAnimations(); // Anîmasyonan saz bike
        } else {
             // Ger favoritedProducts jî vala be (rewşa destpêkê ya vala)
             if (emptyFavoritesMessage) emptyFavoritesMessage.style.display = 'block';
             favoritesContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Error fetching favorites:", error);
        favoritesContainer.innerHTML = `<p style="text-align:center;">${t('error_generic')}</p>`;
    }
}


// === Profile Management ===

/**
 * Daneyên profîlê ji localStorage bar dike û di formê de nîşan dide.
 */
export function loadProfileData() {
    if (!profileForm) return;
    document.getElementById('profileName').value = state.userProfile?.name || '';
    document.getElementById('profileAddress').value = state.userProfile?.address || '';
    document.getElementById('profilePhone').value = state.userProfile?.phone || '';
     // Bişkoka GPS reset bike
     const getLocationBtn = document.getElementById('getLocationBtn');
     if (getLocationBtn) {
          getLocationBtn.disabled = false;
          const btnSpan = getLocationBtn.querySelector('span');
          // Textê orîjînal ji data attribute bistîne ger hebe, yan jî default bikar bîne
          if (btnSpan) btnSpan.textContent = getLocationBtn.dataset.originalText || t('get_location_gps');
     }
}

/**
 * Daneyên profîlê ji formê tomar dike di localStorage de.
 */
export function saveProfileData() {
    state.userProfile = {
        name: document.getElementById('profileName')?.value || '',
        address: document.getElementById('profileAddress')?.value || '',
        phone: document.getElementById('profilePhone')?.value || '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
    showNotification(t('profile_saved'), 'success');
}


// === Language & Settings ===

/**
 * Zimanê sepanê diguherîne û UI nûve dike.
 * @param {string} lang - Koda zimanê (mînak: 'ku_sorani').
 */
export function setLanguage(lang) {
    if (!translations[lang]) {
        console.warn(`Language "${lang}" not found, defaulting to Sorani.`);
        lang = 'ku_sorani'; // Default bo Sorani
    }
    state.currentLanguage = lang;
    localStorage.setItem('language', lang); // Tomar bike ji bo barkirina pêşerojê

    // Direction û lang attribute ya HTML biguherîne
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku'; // Assuming 'ku' for both Sorani/Badini
    document.documentElement.dir = 'rtl'; // Hemû zimanên me RTL ne

    // Hemû elementên bi data-translate-key nûve bike
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key); // Fonksiyona t() bikar bîne
        // Ger input an textarea be, placeholder biguherîne
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        }
        // Ger elementek din be, textContent biguherîne
        else {
            element.textContent = translation;
        }
    });

    // Bişkokên ziman nûve bike da ku yê çalak nîşan bide
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // UIyên din ên ku girêdayî ziman in ji nû ve render bike
    renderMainCategories(); // Kategoriyên sereke
    renderCategoriesSheet(); // Kategorî di sheet de
    if (subcategoriesContainer?.style.display === 'flex') {
         renderSubcategories(state.currentCategory); // Subkategoriyan ger xuya bin
    }
    if (subSubcategoriesContainer?.style.display === 'flex') {
         renderSubSubcategories(state.currentCategory, state.currentSubcategory); // SubSub ger xuya bin
    }
    if (document.getElementById('cartSheet')?.classList.contains('show')) {
        renderCart(); // Cartê ger vekirî be
    }
    if (document.getElementById('favoritesSheet')?.classList.contains('show')) {
        renderFavoritesPage(); // Favorites ger vekirî be
    }
    if (document.getElementById('notificationsSheet')?.classList.contains('show')) {
        renderUserNotifications(); // Notifications ger vekirî be
    }
    if (document.getElementById('termsSheet')?.classList.contains('show')) {
        renderPolicies(); // Şert û mercan ger vekirî be
    }
    // Productan ji nû ve render bike ji bo nav û detayên wergerandî
     // Tenê render bike ger em ne li ser rûpela sereke ya bê filter bin
     const isHomeView = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
     if (!isHomeView && state.products && state.products.length > 0) {
          renderProducts();
     } else if (isHomeView) {
          // Ger li rûpela sereke bin, dibe ku hewce be home content ji nû ve were render kirin
           if(window.renderHomePageContent) window.renderHomePageContent(); // Ji core bang bike
     }
     // Navê rûpelê di headerê de nûve bike ger subpage be
     if (document.querySelector('.subpage-header-content')?.style.display === 'flex') {
          const pageId = document.querySelector('.page-active')?.id;
          if (pageId === 'settingsPage') {
               document.getElementById('headerTitle').textContent = t('settings_title');
          }
          // Ji bo subcategoryDetailPage, sernav dibe ku hewce be ji nû ve were wergirtin
     }
}

/**
 * Cache paqij dike û sepanê ji nû ve bar dike.
 */
export async function forceUpdate() {
    if (confirm(t('update_confirm'))) { // Wergera 'Are you sure...'
        try {
            // Service Worker(an) unregister bike
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            // Hemû cache(an) jê bibe
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success'); // Wergera 'App updated...'

            // Piştî demekê rûpelê ji nû ve bar bike
            setTimeout(() => {
                window.location.reload(true); // `true` ji bo force reload ji serverê
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}


// === Notifications & Policies ===

/**
 * Şert û mercan ji Firestore bar dike û di sheet de nîşan dide.
 */
export async function renderPolicies() {
    if (!termsContentContainer) return;
    termsContentContainer.innerHTML = `<p>${t('loading_policies')}</p>`; // Werger
    try {
        const docRef = doc(db, "settings", "policies");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().content) {
            const policies = docSnap.data().content;
            // Naverokê li gorî zimanê niha bistîne, fallback bo Sorani
            const content = policies[state.currentLanguage] || policies.ku_sorani || '';
            // Rêzên nû biguherîne bo <br> û nîşan bide
            termsContentContainer.innerHTML = content ? content.replace(/\n/g, '<br>') : `<p>${t('no_policies_found')}</p>`; // Werger
        } else {
            termsContentContainer.innerHTML = `<p>${t('no_policies_found')}</p>`; // Werger
        }
    } catch (error) {
        console.error("Error fetching policies:", error);
        termsContentContainer.innerHTML = `<p>${t('error_generic')}</p>`; // Werger
    }
}

/**
 * Kontrol dike ka notificationên nû hene û badge nîşan dide.
 */
export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    // onSnapshot bikar bîne ji bo guhdarîkirina real-time
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            // Ger notificationek nûtir hebe ji ya dawî ku hatiye dîtin
            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                if (notificationBadge) notificationBadge.style.display = 'block'; // Badge nîşan bide
            } else {
                if (notificationBadge) notificationBadge.style.display = 'none'; // Badge veşêre
            }
        } else {
             if (notificationBadge) notificationBadge.style.display = 'none'; // Badge veşêre ger tiştek tune be
        }
    }, (error) => {
         console.error("Error checking new announcements:", error);
         // Dibe ku hûn bixwazin badge veşêrin ger xeletî hebe
         if (notificationBadge) notificationBadge.style.display = 'none';
    });
}

/**
 * Lîsteya notificationan ji bo bikarhêner render dike.
 */
export async function renderUserNotifications() {
    if (!notificationsListContainer) return;
    notificationsListContainer.innerHTML = '...'; // Loading

    try {
        const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(30)); // Hejmarek maqûl bistîne
        const snapshot = await getDocs(q);

        notificationsListContainer.innerHTML = ''; // Paqij bike
        if (snapshot.empty) {
            notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`; // Werger
            return;
        }

        let latestTimestamp = 0;
        snapshot.forEach(doc => {
            const announcement = doc.data();
            // Timestampa herî nû bibîne ji bo tomarkirinê
            if (announcement.createdAt > latestTimestamp) {
                latestTimestamp = announcement.createdAt;
            }

            const date = new Date(announcement.createdAt);
            // Formateke hêsan ji bo dîrokê
            const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            // Sernav û naverokê li gorî zimanê niha bistîne
            const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
            const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <div class="notification-header">
                    <span class="notification-title">${title}</span>
                    <span class="notification-date">${formattedDate}</span>
                </div>
                <p class="notification-content">${content.replace(/\n/g, '<br>')}</p> `;
            notificationsListContainer.appendChild(item);
        });

        // Timestampa herî nû tomar bike wekî ya dawî ku hatiye dîtin
        localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
        // Badge veşêre piştî dîtinê
        if (notificationBadge) notificationBadge.style.display = 'none';

    } catch (error) {
        console.error("Error rendering user notifications:", error);
        notificationsListContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    }
}


// === Other UI Features ===

/**
 * Lînkên pêwendiyê (social media) di settings de render dike.
 */
export function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    if (!contactLinksContainer) return;

    const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt")); // Yan 'order' ger hebe

    // onSnapshot bikar bîne ji bo nûvekirinên real-time
    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = ''; // Paqij bike

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = `<p style="padding: 15px; text-align: center;">${t('no_contact_links')}</p>`; // Werger
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + state.currentLanguage] || link.name_ku_sorani; // Navê li gorî ziman

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank'; // Di tabek nû de veke
            linkElement.rel = 'noopener noreferrer'; // Ji bo ewlehiyê
            linkElement.className = 'settings-item'; // Heman stîl wekî yên din

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon || 'fas fa-link'}" style="margin-left: 10px;"></i> <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i> `;

            contactLinksContainer.appendChild(linkElement);
        });
    }, (error) => {
         console.error("Error fetching contact links:", error);
         contactLinksContainer.innerHTML = `<p>${t('error_generic')}</p>`;
    });
}

/**
 * Peyama bi xêr hatinê tenê carekê nîşan dide.
 */
export function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
         // Fonksiyona openPopup ji core bang bike
         if (window.openPopup) window.openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true'); // Tomar bike ku carekê hatiye dîtin
    }
}

/**
 * Fonksiyona GPS ji bo wergirtina navnîşanê saz dike.
 */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');

    if (!getLocationBtn || !profileAddressInput) return;

    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = t('get_location_gps'); // Textê orîjînal bistîne
    getLocationBtn.dataset.originalText = originalBtnText; // Tomar bike ji bo resetkirinê
    if(btnSpan) btnSpan.textContent = originalBtnText;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification(t('gps_not_supported'), 'error'); // Werger
            return;
        }

        if(btnSpan) btnSpan.textContent = t('gps_loading'); // Werger '...Loading'
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
             async (position) => { // Success
                 const { latitude, longitude } = position.coords;
                 try {
                      // Nominatim API bikar bîne ji bo reverse geocoding
                      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${state.currentLanguage.split('_')[0]},en`); // Zimanê sereke + English wek fallback
                      const data = await response.json();

                      if (data && data.display_name) {
                           profileAddressInput.value = data.display_name;
                           showNotification(t('address_retrieved'), 'success'); // Werger
                      } else {
                           showNotification(t('address_not_found'), 'error'); // Werger
                      }
                 } catch (error) {
                      console.error('Reverse Geocoding Error:', error);
                      showNotification(t('error_getting_address'), 'error'); // Werger
                 } finally {
                      if(btnSpan) btnSpan.textContent = originalBtnText;
                      getLocationBtn.disabled = false;
                 }
            },
            (error) => { // Error
                 let messageKey = 'gps_error_unknown';
                 switch (error.code) {
                      case 1: messageKey = 'gps_permission_denied'; break;
                      case 2: messageKey = 'gps_position_unavailable'; break;
                      case 3: messageKey = 'gps_timeout'; break;
                 }
                 showNotification(t(messageKey), 'error'); // Werger
                 if(btnSpan) btnSpan.textContent = originalBtnText;
                 getLocationBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Vebijarkên GPS
        );
    });
}
/**
 * Fonksiyon ji bo nûvekirina UI piştî guhertina rewşa authentication.
 * @param {boolean} isAdmin - Nîşan dide ka bikarhêner admin e.
 */
export function updateUIAfterAuthChange(isAdmin) {
     // Kartên productan nûve bike da ku bişkokên admin nîşan bide/veşêre
     document.querySelectorAll('.product-card').forEach(card => {
          const actions = card.querySelector('.product-actions');
          if (actions) {
               actions.style.display = isAdmin ? 'flex' : 'none';
          }
     });

     // Dibe ku hûn bixwazin beşên din ên UI jî nûve bikin
     console.log("UI updated for auth change. isAdmin:", isAdmin);
}

// === Export functions needed by core.js or admin.js ===
// Export fonksiyonên ku ji hêla app-core.js an admin.js ve têne bang kirin
// (Ger rasterast neyên import kirin, em dikarin wan li ser window an jî globalAdminTools zêde bikin)

// Zêdekirina fonksiyonan li globalAdminTools ji bo admin.js
Object.assign(window.globalAdminTools || {}, {
    // Fonksiyonên ku admin.js rasterast bikar tîne
     createProductCardElement, // Dibe ku admin hewce bike ji bo pêşdîtinê
     renderCart, // Dibe ku admin bixwaze cartê bibîne?
     renderFavoritesPage, // Dibe ku admin bixwaze favorites bibîne?
     populateCategoryDropdown, // Ji bo forma productê
     populateSubcategoriesDropdown: AdminLogic.populateSubcategoriesDropdown, // Fonksiyona admin bikar bîne
     populateSubSubcategoriesDropdown: AdminLogic.populateSubSubcategoriesDropdown, // Fonksiyona admin bikar bîne
     createProductImageInputs: AdminLogic.createProductImageInputs, // Fonksiyona admin bikar bîne
     // ... fonksiyonên din ên ku admin rasterast hewce dike ...

     // Fonksiyonên ku core bang dike lê dibe ku admin jî hewce bike
     showNotification, // Jixwe di core de heye, lê ji bo admin jî baş e
     // t, // Jixwe di core de heye
     setLanguage,
     forceUpdate,
     renderMainCategories, // Ji bo nûvekirinê piştî guhertinên admin
     renderSubcategories, // Ji bo nûvekirinê piştî guhertinên admin
     renderProducts, // Ji bo nûvekirinê piştî guhertinên admin
     searchProductsInFirestore, // Ji bo triggerkirina lêgerînê/barkirinê
     loadInitialData, // Dibe ku hewce be ji bo resetkirinê
     // ... û hwd ...
});