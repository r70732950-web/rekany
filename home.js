// home.js
// Berpirs e ji bo çêkirina naveroka rûpela sereke (home page) bi awayekî dînamîk

import {
    db,
    state,
    promoGroupsCollection,
    brandGroupsCollection,
    shortcutRowsCollection,
    productsCollection
} from './app-setup.js';
// === START: ÇAKKIRIN / FIX ===
// Em êdî van ji app-setup import nakin
/*
import {
    homePageSectionsContainer,
    notificationsListContainer
} from './app-setup.js';
*/
// === END: ÇAKKIRIN / FIX ===
import { getDocs, collection, query, orderBy, where, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { t } from './utils.js';
import { createProductCardElement } from './product.js'; // Ji bo nîşandana kałayan

/**
 * Fonksiyona sereke ji bo çêkirina hemî beşan di rûpela sereke de
 */
export async function renderHomePageContent() {
    // === START: ÇAKKIRIN / FIX ===
    // Em konteynerê li vir dibînin
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        console.error("Konteynera rûpela sereke (homePageSectionsContainer) nehate dîtin!");
        return;
    }
    // === END: ÇAKKIRIN / FIX ===

    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    try {
        // Pêşî skeleton loader nîşan bide
        homeSectionsContainer.innerHTML = `
            <div class="products-container" id="skeletonLoaderHome">
                <div class="skeleton-card"><div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div></div>
                <div class="skeleton-card"><div class="skeleton-image shimmer"></div><div class="skeleton-text shimmer"></div></div>
            </div>`;
        homeSectionsContainer.style.display = 'block';

        // Paqijkirina intervalên sliderên berê (eger hebin)
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};

        // Anîna rêkxistina (layout) rûpela sereke ji Firestore
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        homeSectionsContainer.innerHTML = ''; // Paqijkirina skeleton loader

        if (layoutSnapshot.empty) {
            console.warn("Rêkxistina rûpela sereke nehatiye destnîşankirin.");
        } else {
            // Çêkirina her beşekê li gorî rêza wê
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
    // === START: ÇAKKIRIN / FIX ===
    const notificationsListContainer = document.getElementById('notificationsListContainer');
    if (!notificationsListContainer) return;
    // === END: ÇAKKIRIN / FIX ===
    
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

    // Wexta dîtina agahdariya herî dawî tomar bike da ku nîşana sor (badge) were veşartin
    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    // Nîşana sor rasterast veşêre (ji ber ku bikarhêner niha wan dibîne)
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

            const promoCardElement = createPromoCardElement(cardData, sliderState, 'navigate-category');
            promoGrid.appendChild(promoCardElement);

            if (cards.length > 1) {
                // Funksiyona ji bo zivirandina sliderê
                const rotate = () => {
                    // Kontrol bike ka ev beş hîn li ser rûpelê ye
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
                };

                // Intervala berê (eger hebe) paqij bike
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Intervalek nû saz bike û di state de tomar bike
                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid;
        }
    } catch (error) {
        console.error(`Error rendering promo slider (Group ID: ${groupId}):`, error);
    }
    return null; // Heke tiştek neyê dîtin, null vegerîne
}

/**
 * Beşek ji bo براندan çêdike
 * @param {string} groupId - ID ya koma brandan
 * @param {Object} sectionNameObj - Objekta navê beşê (ji bo wergerandinê)
 */
async function renderBrandsSection(groupId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    
    // Sernavê beşê
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

        if (snapshot.empty) return null; // Heke vala be, beşê nîşan nede

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            // Zêdekirina data-action ji bo klîkê
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
    
    // Sernavê beşê
    const header = document.createElement('div');
    header.className = 'section-title-header';
    header.innerHTML = `<h3 class="section-title-main">${title}</h3>`;
    // TODO: Zêdekirina bişkokek 'Binêre Hemî' ku ber bi fîlterek 'Nûtirîn' ve diçe
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

        if (snapshot.empty) return null; // Heke tiştek nû nebe, nîşan nede

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
        // Navê ji layoutê bikar bîne, heke nebe, navê rêzê bixwe bikar bîne
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) 
                         || (rowData.title && rowData.title[state.currentLanguage]) 
                         || (sectionNameObj && sectionNameObj.ku_sorani) 
                         || (rowData.title && rowData.title.ku_sorani);

        // Sernavê rêzê
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

        if (cardsSnapshot.empty) return null; // Rêza vala nîşan nede

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            // Zêdekirina data-action ji bo klîkê
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

    // Diyarkirina kîjan kategorî ye armanc
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
        return null; // Kategorî nehatiye diyarkirin
    }

    try {
        // H চেষ্টা bike ku navê kategoriyê ji Firestore bistînî
        const targetSnap = await getDoc(doc(db, targetDocRefPath));
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // Navê ji Firestore bikar bîne eger hebe, wekî din navê ji layoutê
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

        // Lînka 'Binêre Hemî'
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.style.cursor = 'pointer'; // Ji bo nîşandana ku klîk lê dibe
        
        // Zêdekirina data-action ji bo klîkê
        if(subcategoryId) {
            // Heke jêr-kategorî hebe, ber bi rûpela hûrguliyan ve biçe
            seeAllLink.dataset.action = 'navigate-subcategory-detail';
            seeAllLink.dataset.mainCatId = categoryId;
            seeAllLink.dataset.subCatId = subcategoryId;
        } else {
             // Heke tenê kategoriya sereke be, li ser rûpela malê fîlter bike
            seeAllLink.dataset.action = 'navigate-category';
            seeAllLink.dataset.categoryId = categoryId;
        }
        
        header.appendChild(seeAllLink);
        container.appendChild(header);

        // Anîna kałayan ji bo vê kategoriyê
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
        if (snapshot.empty) return null; // Heke vala be, nîşan nede

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
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        // Tenê 10 kałayên herî dawî nîşan bide
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

