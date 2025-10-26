// home.js
// ئەم مۆدیولە بەرپرسە لە دروستکردنی بەشە دینامیکییەکانی لاپەڕەی سەرەکی (Homepage).

import {
    db,
    state,
    productsCollection,
    promoGroupsCollection,
    brandGroupsCollection,
    shortcutRowsCollection,
    homePageSectionsContainer
} from './app-setup.js';
import { t } from './utils.js';
// پشت بە product.js دەبەستین بۆ دروستکردنی کارتی کاڵاکان
import { createProductCardElement, renderSkeletonLoader } from './product.js';
import { getDocs, getDoc, doc, collection, query, orderBy, where, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * توخمێکی HTMLی کارتی ڕێکلام (Promo Card) دروست دەکات
 * ئەمە جیاوازە لە کارتی کاڵای ئاسایی
 * @param {Object} cardData - ئۆبجێکتی داتای گرووپی کارتەکان (کە لە چەند کارتێک پێکدێت)
 * @param {Object} sliderState - ئۆبجێکتی دۆخی سلایدەر (بۆ زانینی وێنەی ئێستا)
 * @returns {HTMLElement} - توخمی HTMLی کارتی ڕێکلام
 */
function createPromoCardElement(cardData, sliderState) {
    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item';
    
    // دۆزینەوەی کارتی ئێستا لەناو گرووپەکە
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    // دانانی 'data action' بۆ ئەوەی 'app-logic.js' بتوانێت کاری پێبکات
    cardElement.dataset.action = 'navigate-category';
    cardElement.dataset.categoryId = currentCard.categoryId;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

    // لکاندنی Event Listenerی ناوخۆیی بۆ دوگمەکانی گۆڕینی سلایدەر
    if (cardData.cards.length > 1) {
        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation(); // ڕێگری لەوەی کلیکەکە بچێتە سەر کارتە سەرەکییەکە
            // چوونی بۆ وێنەی پێشوو
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            const newCard = cardData.cards[sliderState.currentIndex];
            const newImageUrl = newCard.imageUrls[state.currentLanguage] || newCard.imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;
            
            // نوێکردنەوەی 'data-category-id'ی کارتە سەرەکییەکە
            cardElement.dataset.categoryId = newCard.categoryId;
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
            // چوونی بۆ وێنەی دواتر
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            const newCard = cardData.cards[sliderState.currentIndex];
            const newImageUrl = newCard.imageUrls[state.currentLanguage] || newCard.imageUrls.ku_sorani;
            const imgElement = cardElement.querySelector('.product-image');
            if(imgElement) imgElement.src = newImageUrl;

            // نوێکردنەوەی 'data-category-id'ی کارتە سەرەکییەکە
            cardElement.dataset.categoryId = newCard.categoryId;
        });
    }

    return cardElement;
}

/**
 * بەشی سلایدەری ڕێکلامەکان (Promo Slider) بۆ لاپەڕەی سەرەکی دروست دەکات
 * @param {string} groupId - ئایدی گرووپی سلایدەر لە فایەربەیس
 * @param {string} layoutId - ئایدی بێهاوتای ئەم بەشە لە ڕیزبەندی (بۆ بەڕێوەبردنی 'interval')
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    // دانانی ئایدی بێهاوتا بۆ کۆنترۆڵکردنی 'interval'
    promoGrid.id = `promoSliderLayout_${layoutId}`;

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // دروستکردنی دۆخی سەرەتایی بۆ ئەم سلایدەرە
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // کۆکردنەوەی کارتەکان لە یەک ئۆبجێکت

            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            // دانانی 'interval' بۆ گۆڕینی خۆکاری سلایدەر ئەگەر زیاتر لە کارتێک هەبێت
            if (cards.length > 1) {
                const rotate = () => {
                    // پشکنین ئەگەر توخمەکە هێشتا لە DOM بێت و 'interval'ەکە نەسڕابێتەوە
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return;
                    }
                    
                    // گۆڕینی وێنە
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newCard = cards[sliderState.currentIndex];
                    const newImageUrl = newCard.imageUrls[state.currentLanguage] || newCard.imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl;
                    
                    // نوێکردنەوەی 'data-category-id'
                    promoCardElement.dataset.categoryId = newCard.categoryId;
                };

                // سڕینەوەی 'interval'ی پێشوو (ئەگەر هەبێت)
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // دانانی 'interval'ی نوێ
                sliderState.intervalId = setInterval(rotate, 5000);
                
                // پاشەکەوتکردنی ئایدی 'interval' لە 'state'ی گشتی
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid;
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // گەڕانەوەی null ئەگەر هیچ کارتێک نەبوو
}

/**
 * بەشی براندەکان (Brands Section) دروست دەکات
 * @param {string} groupId - ئایدی گرووپی براند لە فایەربەیس
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // ئایدی بێهاوتا
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // ئەگەر بەتاڵ بوو، پیشانی مەدە

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            
            // دانانی 'data action' بۆ کلیک کردن
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
 * بەشی نوێترین کاڵاکان (Newest Products Section) دروست دەکات
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    
    // دروستکردنی سەردێڕ
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    try {
        // هێنانی کاڵاکانی 15 ڕۆژی ڕابردوو
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null; // ئەگەر هیچ کاڵایەکی نوێ نەبوو، پیشانی مەدە
        }

        // دروستکردنی سکڕۆڵی ئاسۆیی بۆ کاڵاکان
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // بەکارهێنانی فەنکشنی هاوبەش
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
 * بەشی ڕیزی کارتی کورتکراوە (Shortcut Row Section) دروست دەکات
 * @param {string} rowId - ئایدی ڕیزی کارتەکان لە فایەربەیس
 * @param {Object} sectionNameObj - ئۆبجێکتی ناوی بەشەکە (بۆ وەرگێڕان)
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
export async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // بەکارهێنانی ناوی دیاریکراو لە 'layout' ئەگەر هەبێت، ئەگەر نا ناوی ڕیزەکە
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || (rowData.title && rowData.title[state.currentLanguage]) || (rowData.title && rowData.title.ku_sorani) || 'ڕیزی کارتەکان';

        // دروستکردنی سەردێڕ
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        // دروستکردنی سکڕۆڵی ئاسۆیی بۆ کارتەکان
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        // هێنانی کارتەکانی ناو ئەم ڕیزە
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) return null; // ئەگەر بەتاڵ بوو، پیشانی مەدە

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            
            // دانانی 'data action' بۆ کلیک کردن
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
 * بەشی ڕیزی کاڵای جۆرێکی دیاریکراو (Single Category Row Section) دروست دەکات
 * @param {Object} sectionData - زانیاری بەشەکە (کە ئایدی جۆرەکانی تێدایە)
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
export async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani) || 'کاڵاکان';
    let targetDocRef;

    // دیاریکردنی وردترین جۆر بۆ هێنانی کاڵاکان
    if (subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else {
        return null; // ئەگەر هیچ جۆرێک دیاری نەکرابوو
    }

    try {
        // هەوڵدان بۆ هێنانی ناوی فەرمی جۆرەکە لە فایەربەیس
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             // بەکارهێنانی ناوی فەرمی ئەگەر هەبوو، ئەگەر نا، ناوی ناو 'layout'
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        
        // دروستکردنی سەردێڕ و لینکی "بینینی هەمووی"
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        
        // دانانی 'data action' بۆ کلیک کردن
        // ئەگەر جۆری لاوەکی هەبوو، دەچێتە لاپەڕەی وردەکاریی جۆر
        if (subcategoryId) {
            seeAllLink.dataset.action = 'navigate-subcategory-detail';
            seeAllLink.dataset.mainCatId = categoryId;
            seeAllLink.dataset.subCatId = subcategoryId;
        } else { // ئەگەر نا، لە لاپەڕەی سەرەکی فلتەر دەکات
            seeAllLink.dataset.action = 'navigate-filter';
            seeAllLink.dataset.categoryId = categoryId;
            seeAllLink.dataset.subcategoryId = 'all';
            seeAllLink.dataset.subSubcategoryId = 'all';
        }
        header.appendChild(seeAllLink);
        container.appendChild(header);

        // دروستکردنی سکڕۆڵی ئاسۆیی بۆ کاڵاکان
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // هێنانی 10 کاڵا لەو جۆرە دیاریکراوە
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // ئەگەر بەتاڵ بوو، پیشانی مەدە

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // بەکارهێنانی فەنکشنی هاوبەش
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

/**
 * بەشی هەموو کاڵاکان (All Products Section) دروست دەکات (تەنها چەند دانەیەک)
 * @returns {HTMLElement|null} - توخمی HTMLی بەشەکە یان null
 */
async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    // دروستکردنی سەردێڕ
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    // دروستکردنی 'grid'ی کاڵاکان
    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container';
    container.appendChild(productsGrid);

    try {
        // هێنانی 10 کاڵا (وەک پێشبینینێک)
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // ئەگەر هیچ کاڵایەک نەبوو

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // بەکارهێنانی فەنکشنی هاوبەش
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}


/**
 * فەنکشنی سەرەکی بۆ دروستکردنی لاپەڕەی سەرەکی
 * پشت بە ڕیزبەندی 'home_layout' لە فایەربەیس دەبەستێت
 */
export async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // ڕێگری لە دووبارە بانگکردنەوە
    state.isRenderingHomePage = true;

    // سڕینەوەی هەموو 'interval'ەکانی سلایدەری پێشوو
    Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
        if (state.sliderIntervals[layoutId]) {
            clearInterval(state.sliderIntervals[layoutId]);
        }
    });
    state.sliderIntervals = {}; // بەتاڵکردنەوەی ئۆبجێکتی 'interval'ەکان

    try {
        // پیشاندانی سکێلێتۆن لۆدەر
        renderSkeletonLoader(homePageSectionsContainer, 4);

        // هێنانی ڕیزبەندی لاپەڕەی سەرەکی لە فایەربەیس
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        homePageSectionsContainer.innerHTML = ''; // بەتاڵکردنەوەی سکێلێتۆن

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured.");
        } else {
            // دروستکردنی هەر بەشێک بەپێی ڕیزبەندی
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
                            sectionElement = await renderBrandsSection(section.groupId);
                        }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
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
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homePageSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homePageSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
    }
}
