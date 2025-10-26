// home.js
// Berpirs e ji bo çêkirina naveroka rûpela sereke (home page) bi awayekî dînamîk

import {
    db,
    state,
    promoGroupsCollection,
    brandGroupsCollection,
    // === START: ÇAKKIRIN / FIX ===
    // shortcutRowsCollection hate rakirin ji importê
    // === END: ÇAKKIRIN / FIX ===
    productsCollection
} from './app-setup.js';
import { getDocs, collection, query, orderBy, where, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { t } from './utils.js';
import { createProductCardElement } from './product.js'; // Ji bo nîşandana kałayan

// === START: ÇAKKIRIN / FIX ===
// Em shortcutRowsCollection li vir pênase dikin
const shortcutRowsCollection = collection(db, "shortcut_rows");
// === END: ÇAKKIRIN / FIX ===

/**
 * Fonksiyona sereke ji bo çêkirina hemî beşan di rûpela sereke de
 */
export async function renderHomePageContent() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        console.error("Konteynera rûpela sereke (homePageSectionsContainer) nehate dîtin!");
        return;
    }

    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    try {
        homeSectionsContainer.innerHTML = `
            <div class="products-container" id="skeletonLoaderHome">
                <div class="skeleton-card"><div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div></div>
                <div class="skeleton-card"><div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div></div>
            </div>`;
        homeSectionsContainer.style.display = 'block';

        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        homeSectionsContainer.innerHTML = '';

        if (layoutSnapshot.empty) {
            console.warn("Rêkxistina rûpela sereke nehatiye destnîşankirin.");
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id);
                        }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId, section.name);
                        }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection(section.name);
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection(section.name);
                        break;
                    default:
                        console.warn(`Cureyê beşê nenas: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا.</p>`;
    } finally {
        state.isRenderingHomePage = false;
    }
}

/**
 * Agahdariyan (Announcements) ji bo bikarhêneran di 'Notifications Sheet' de nîşan dide
 */
export async function renderUserNotifications() {
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return;

    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
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

        const title = (announcement.title && announcement.title[state.currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[state.currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

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
    const badge = document.getElementById('notificationBadge');
    if(badge) badge.style.display = 'none';
}


// --- Fonksiyonên Alîkar ji bo Avakirina Beşan ---

/**
 * Beşek ji bo سلایدەری ڕێکلامan çêdike
 * @param {string} groupId - ID ya koma (group) سلایدەرan
 * @param {string} layoutId - ID ya yekta ya vê beşê di layoutê de (ji bo birêvebirina interval)
 */
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // ID ya yekta

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };

            // Bikaranîna fonksiyonek ji product.js (an fonksiyonek alîkar a taybet li vir)
            // Lê ji bo hêsanî, em koda çêkirina HTML li vir dubare dikin
            const currentCard = cards[sliderState.currentIndex];
            const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;
            const promoCardElement = document.createElement('div');
            promoCardElement.className = 'product-card promo-card-grid-item';
            // Zêdekirina data-action ji bo klîkê
            promoCardElement.dataset.action = 'navigate-category';
            promoCardElement.dataset.categoryId = currentCard.categoryId || '';

            promoCardElement.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
                </div>
                ${cards.length > 1 ? `
                <button class="promo-slider-btn prev" data-action="promo-prev"><i class="fas fa-chevron-left"></i></button>
                <button class="promo-slider-btn next" data-action="promo-next"><i class="fas fa-chevron-right"></i></button>
                ` : ''}
            `;
            promoGrid.appendChild(promoCardElement);

            // Birêvebirina Interval (wekî berê)
             if (cards.length > 1) {
                const rotate = () => {
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return;
                    }
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if (imgElement) imgElement.src = newImageUrl;
                    // Nûvekirina data-categoryId jî heke guherîbe
                    promoCardElement.dataset.categoryId = cards[sliderState.currentIndex].categoryId || '';
                };

                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }
                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;

                // Event listener ji bo bişkokan (bi rêya event delegation di app-logic.js de nayê kirin)
                promoCardElement.addEventListener('click', (e) => {
                    if (e.target.closest('[data-action="promo-prev"]')) {
                        e.stopPropagation();
                        clearInterval(sliderState.intervalId); // Rawestandina otomatîk
                        sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
                        const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                        promoCardElement.querySelector('.product-image').src = newImageUrl;
                        promoCardElement.dataset.categoryId = cards[sliderState.currentIndex].categoryId || '';
                    } else if (e.target.closest('[data-action="promo-next"]')) {
                        e.stopPropagation();
                        clearInterval(sliderState.intervalId); // Rawestandina otomatîk
                        sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                        const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                        promoCardElement.querySelector('.product-image').src = newImageUrl;
                        promoCardElement.dataset.categoryId = cards[sliderState.currentIndex].categoryId || '';
                    }
                });
            }
            return promoGrid;
        }
    } catch (error) {
        console.error(`Error rendering promo slider (Group ID: ${groupId}):`, error);
    }
    return null;
}

/**
 * Beşek ji bo براندan çêdike
 * @param {string} groupId - ID ya koma brandan
 * @param {Object} sectionNameObj - Objekta navê beşê (ji bo wergerandinê)
 */
async function renderBrandsSection(groupId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';

    const title = sectionNameObj[state.currentLanguage] || sectionNameObj.ku_sorani;
    const header = document.createElement('div');
    header.className = 'section-title-header';
    header.innerHTML = `<h3 class="section-title-main">${title}</h3>`;
    sectionContainer.appendChild(header);

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

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.dataset.action = 'navigate-brand';
            item.dataset.categoryId = brand.categoryId || '';
            item.dataset.subcategoryId = brand.subcategoryId || '';

            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>
            `;
            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

/**
 * Beşek ji bo 'نوێترین کاڵا' çêdike
 * @param {Object} sectionNameObj - Objekta navê beşê (ji bo wergerandinê)
 */
async function renderNewestProductsSection(sectionNameObj) {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const title = sectionNameObj[state.currentLanguage] || sectionNameObj.ku_sorani || t('newest_products');

    const header = document.createElement('div');
    header.className = 'section-title-header';
    header.innerHTML = `<h3 class="section-title-main">${title}</h3>`;
    container.appendChild(header);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });

        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

/**
 * Beşek ji bo 'ڕیزی کارتی کورتکراوە' (Shortcut Row) çêdike
 * @param {string} rowId - ID ya rêza (row) ku were nîşandan
 * @param {Object} sectionNameObj - Objekta navê beşê (ji bo wergerandinê)
 */
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage])
                         || (rowData.title && rowData.title[state.currentLanguage])
                         || (sectionNameObj && sectionNameObj.ku_sorani)
                         || (rowData.title && rowData.title.ku_sorani);

        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) return null;

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.dataset.action = 'navigate-filter';
            item.dataset.categoryId = cardData.categoryId || 'all';
            item.dataset.subcategoryId = cardData.subcategoryId || 'all';
            item.dataset.subSubcategoryId = cardData.subSubcategoryId || 'all';

            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

/**
 * Beşek ji bo 'ڕیزی کاڵای جۆرێکی دیاریکراو' çêdike
 * @param {Object} sectionData - Daneyên beşê ji 'home_layout' (tevî IDyên kategoriyan)
 */
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRefPath;

    if (subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`;
    } else if (subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}`;
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRefPath = `categories/${categoryId}`;
    } else {
        return null;
    }

    try {
        const targetSnap = await getDoc(doc(db, targetDocRefPath));
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';

        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.style.cursor = 'pointer';

        if(subcategoryId) {
            seeAllLink.dataset.action = 'navigate-subcategory-detail';
            seeAllLink.dataset.mainCatId = categoryId;
            seeAllLink.dataset.subCatId = subcategoryId;
        } else {
            seeAllLink.dataset.action = 'navigate-category';
            seeAllLink.dataset.categoryId = categoryId;
        }

        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product);
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

/**
 * Beşek ji bo 'هەموو کاڵاکان' çêdike (bi tenê çendek ji wan nîşan dide)
 * @param {Object} sectionNameObj - Objekta navê beşê (ji bo wergerandinê)
 */
async function renderAllProductsSection(sectionNameObj) {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';
    const title = sectionNameObj[state.currentLanguage] || sectionNameObj.ku_sorani || t('all_products_section_title');

    const header = document.createElement('div');
    header.className = 'section-title-header';
    header.innerHTML = `<h3 class="section-title-main">${title}</h3>`;
    // TODO: Zêdekirina lînka 'Binêre Hemî' ku ber bi fîltera 'Hemî' ve diçe
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

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

