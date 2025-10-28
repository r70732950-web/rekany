// home.js
// Logika UI تایبەت بە پەڕەی سەرەکی (home page)

import {
    // واردکردنی ئەو ئێلێمێنتانەی DOM کە پێویستن
    productsContainer, skeletonLoader, loader,
    subSubcategoriesContainer, // کۆنتەینەری sub-subcategory لە پەڕەی سەرەکی
} from './app-setup.js';

import {
    // واردکردنی state و فانکشنە سەرەکییەکانی لۆجیک
    state, t, debounce, formatDescription,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts, fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchProducts, fetchSubcategories, fetchSubSubcategories,
    navigateToFilterCore,
    db, doc, getDoc, collection, query, orderBy, where, limit, // فانکشنەکانی Firestore کە لێرە پێویستن
} from './app-core.js';

// واردکردنی فانکشنە هاوبەشەکانی UI لە app-ui.js
// (واز لەمە دێنین تا app-ui.js نوێ دەکرێتەوە و exportـی تێدا دەکرێت)
// import { createProductCardElementUI, renderSkeletonLoader, showSubcategoryDetailPageUI } from './app-ui.js';
// ** کاتی **: وادادەنێین ئەم فانکشنانە لە global scopeـدا بەردەستن یان دواتر import دەکرێن
const createProductCardElementUI = window.createProductCardElementUI;
const renderSkeletonLoader = window.renderSkeletonLoader;
const showSubcategoryDetailPageUI = window.showSubcategoryDetailPageUI;


// --- فانکشنەکانی دروستکردنی ئێلێمێنتەکانی UI بۆ پەڕەی سەرەکی ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // بەکارهێنانی grid بۆ دانانی یەک ئێلێمێنت
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // IDـی ناوازە

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // ستایلەکان بۆ کۆنتەینەر

    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image-container';
    const imgElement = document.createElement('img');
    imgElement.className = 'product-image';
    imgElement.loading = 'lazy';
    imgElement.alt = 'Promotion';
    imageContainer.appendChild(imgElement);
    promoCardElement.appendChild(imageContainer);

    const updateImage = (index) => {
        const currentCard = cardData.cards[index];
        // دڵنیابوون لەوەی وێنە بۆ زمانی هەڵبژێردراو یان سۆرانی هەیە
        const imageUrl = currentCard.imageUrls
            ? (currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani)
            : 'https://placehold.co/600x280/e2e8f0/2d3748?text=No+Image';
        imgElement.src = imageUrl;
    };
    updateImage(sliderState.currentIndex); // وێنەی سەرەتا

    // زیادکردنی دوگمەکان تەنها ئەگەر زیاتر لە کارتێک هەبێت
    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // ڕێسێتکردنی کاتژمێر لە کاتی گۆڕینی دەستی
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // ڕێسێتکردنی کاتژمێر لە کاتی گۆڕینی دەستی
        };
        promoCardElement.appendChild(nextBtn);

        // لۆجیکی خولانەوەی ئۆتۆماتیکی
        const rotate = () => {
             // پشکنینی ئەوەی کە ئێلێمێنتەکە هێشتا ماوە و intervalـەکە هێشتا تۆمارکراوە
             if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); // سڕینەوەی ئەم intervalـە تایبەتە
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId]; // لابردنی لە stateـی گشتی
                 return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]); // سڕینەوەی پێشوو ئەگەر هەبێت
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[layoutId] = sliderState.intervalId; // پاشەکەوتکردنی گشتی
        };
        const resetInterval = () => {
             if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            startInterval();
        };

        startInterval(); // دەستپێکردن لە کاتی ڕێندەرکردن
    }

    // کلیک لەسەر کارتەکە دەچێتە بەشێکی تر
    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // پشتگوێخستنی کلیک لەسەر دوگمەکان
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                // ڕۆیشتن بۆ بەشەکە لە ڕێگەی فانکشنی سەرەکی کە state و history نوێ دەکاتەوە
                await navigateToFilterCore({ category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                // با popstate listener یان updateProductViewUI خۆی ڕێندەری UI بکات
                await updateProductViewUI(true); // بە دەستی UI نوێ بکەرەوە
            }
        }
    });

    promoGrid.appendChild(promoCardElement);
    return promoGrid;
}

async function createBrandsSectionElement(groupId) {
    const brands = await fetchBrandGroupBrands(groupId);
    if (!brands || brands.length === 0) return null;

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    brands.forEach(brand => {
        const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
        const item = document.createElement('div');
        item.className = 'brand-item';
        item.innerHTML = `
            <div class="brand-image-wrapper">
                <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
            </div>
            <span>${brandName}</span>
        `;
        item.onclick = async () => {
             if (brand.subcategoryId && brand.categoryId) {
                 // ڕۆیشتن بۆ پەڕەی وردەکاری subcategory (فانکشن لە app-ui.js واردکراوە)
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId);
             } else if(brand.categoryId) {
                 // ڕۆیشتن بۆ پیشاندانی categoryـی سەرەکی
                 await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 await updateProductViewUI(true);
             }
        };
        brandsContainer.appendChild(item);
    });
    return sectionContainer;
}

async function createNewestProductsSectionElement() {
    const products = await fetchNewestProducts();
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('newest_products')}</h3>
            </div>
        <div class="horizontal-products-container"></div>
    `;
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // فانکشن لە app-ui.js
        productsScroller.appendChild(card);
    });
    return container;
}

async function createSingleShortcutRowElement(rowId, sectionNameObj) {
    const rowDocRef = doc(db, "shortcut_rows", rowId);
    const rowDocSnap = await getDoc(rowDocRef);
    if (!rowDocSnap.exists()) return null;

    const rowData = rowDocSnap.data();
    const cards = await fetchShortcutRowCards(rowId);
    if (!cards || cards.length === 0) return null;

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';
    const rowTitle = sectionNameObj[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
    sectionContainer.innerHTML = `<h3 class="shortcut-row-title">${rowTitle}</h3><div class="shortcut-cards-container"></div>`;
    const cardsContainer = sectionContainer.querySelector('.shortcut-cards-container');

    cards.forEach(cardData => {
        const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
        const item = document.createElement('div');
        item.className = 'shortcut-card';
        item.innerHTML = `
             <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
             <div class="shortcut-card-name">${cardName}</div>
        `;
        item.onclick = async () => {
             await navigateToFilterCore({ // بەکارهێنانی navigationـی سەرەکی
                 category: cardData.categoryId || 'all',
                 subcategory: cardData.subcategoryId || 'all',
                 subSubcategory: cardData.subSubcategoryId || 'all',
                 search: ''
             });
             await updateProductViewUI(true); // نوێکردنەوەی UI
        };
        cardsContainer.appendChild(item);
    });
    return sectionContainer;
}

async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = name[state.currentLanguage] || name.ku_sorani;

    // هەوڵدان بۆ وەرگرتنی ناونیشانێکی وردتر لە داتای category
    try {
        let targetDocRef;
        if (subSubcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        else if (subcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        else targetDocRef = doc(db, `categories/${categoryId}`);
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
             const targetData = targetSnap.data();
             title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
        }
    } catch(e) { console.warn("Could not fetch specific title for category row", e); }


    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${title}</h3>
            <a class="see-all-link">${t('see_all')}</a>
        </div>
        <div class="horizontal-products-container"></div>
    `;
    const productsScroller = container.querySelector('.horizontal-products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // فانکشن لە app-ui.js
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
         if(subcategoryId) { // حاڵەتی subSubcategoryId ـیش دەگرێتەوە
             // ڕۆیشتن بۆ پەڕەی وردەکاری subcategory (فانکشن لە app-ui.js واردکراوە)
             showSubcategoryDetailPageUI(categoryId, subcategoryId);
         } else {
              // ڕۆیشتن بۆ پیشاندانی categoryـی سەرەکی
             await navigateToFilterCore({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             await updateProductViewUI(true);
         }
    };
    return container;
}

async function createAllProductsSectionElement() {
    const products = await fetchInitialProductsForHome();
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
             </div>
        <div class="products-container"></div>
    `;
    const productsGrid = container.querySelector('.products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // فانکشن لە app-ui.js
        productsGrid.appendChild(card);
    });
    return container;
}

// فانکشنی ڕێندەرکردنی بەشەکانی پەڕەی سەرەکی (بەشی UI)
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    // پیشاندانی لۆدەر لەناو کۆنتەینەرەکە
    homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;

    const layout = await fetchHomeLayout(); // وەرگرتنی layout لە core

    homeSectionsContainer.innerHTML = ''; // سڕینەوەی لۆدەر

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        // بەشێکی جێگرەوە ڕێندەر بکە (بۆ نموونە، تەنها بەشی 'هەموو کاڵاکان')
         const allProductsSection = await createAllProductsSectionElement();
         if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // پاککردنەوەی intervalـەکانی پێشوو پێش ڕێندەرکردنی نوێ
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of layout) {
        let sectionElement = null;
        try {
             switch (section.type) {
                 case 'promo_slider':
                     if (section.groupId) {
                         sectionElement = await createPromoSliderElement(section.groupId, section.id);
                     } else console.warn("Promo slider missing groupId:", section);
                     break;
                 case 'brands':
                      if (section.groupId) {
                           sectionElement = await createBrandsSectionElement(section.groupId);
                     } else console.warn("Brands section missing groupId:", section);
                     break;
                 case 'newest_products':
                     sectionElement = await createNewestProductsSectionElement();
                     break;
                 case 'single_shortcut_row':
                       if (section.rowId) {
                            sectionElement = await createSingleShortcutRowElement(section.rowId, section.name);
                         } else console.warn("Shortcut row missing rowId:", section);
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                          sectionElement = await createSingleCategoryRowElement(section);
                     } else console.warn("Category row missing categoryId:", section);
                     break;
                  case 'all_products':
                       sectionElement = await createAllProductsSectionElement();
                     break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
        } catch(error) {
            console.error(`Error rendering home section type ${section.type}:`, error);
             // بەشێکی نیشاندەری هەڵە زیاد بکە
            sectionElement = document.createElement('div');
            sectionElement.style.padding = '20px';
            sectionElement.style.textAlign = 'center';
            sectionElement.style.color = 'red';
            sectionElement.textContent = `هەڵە لە بارکردنی بەشی: ${section.type}`;
        }

        if (sectionElement) {
            homeSectionsContainer.appendChild(sectionElement);
        }
    }
}

// ڕێندەرکردنی دوگمەکانی categoryـی سەرەکی (ڕیزی سەرەوە)
export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = cat.id === 'all'
            ? t('all_categories_label')
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             // سەرەتا ڕۆیشتن بۆ بەشەکە بە بەکارهێنانی لۆجیکی سەرەکی
             await navigateToFilterCore({
                 category: cat.id,
                 subcategory: 'all', // ڕێسێتکردنی subcategory کاتێک categoryـی سەرەکی دەگۆڕدرێت
                 subSubcategory: 'all', // ڕێسێتکردنی sub-subcategory
                 search: '' // سڕینەوەی گەڕان
             });
             // پاشان نوێکردنەوەی UI
             await updateProductViewUI(true); // true واتە فیلتەر/گەڕانێکی نوێیە
        };

        container.appendChild(btn);
    });
}

// ڕێندەرکردنی subcategoryـەکان لەسەر بنەمای داتای وەرگیراو
export function renderSubcategoriesUI(subcategoriesData) {
     const subcategoriesContainer = document.getElementById('subcategoriesContainer');
     subcategoriesContainer.innerHTML = ''; // سڕینەوەی پێشوو

     if (!subcategoriesData || subcategoriesData.length === 0) {
          subcategoriesContainer.style.display = 'none'; // شاردنەوە ئەگەر هیچ subcategoryـیەک نەبێت
          subSubcategoriesContainer.style.display = 'none'; // شاردنەوەی کۆنتەینەری sub-sub ـیش
          return;
     }

     subcategoriesContainer.style.display = 'flex'; // پیشاندانی ئەگەر subcategory هەبن

     // زیادکردنی دوگمەی "هەموو" بۆ subcategoryـەکانی categoryـی ئێستا
     const allBtn = document.createElement('button');
     allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
     const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
     allBtn.innerHTML = `
         <div class="subcategory-image">${allIconSvg}</div>
         <span>${t('all_categories_label')}</span>
     `;
     allBtn.onclick = async () => {
         // کاتێک کلیک لەسەر subcategory "هەموو" دەکرێت، تەنها فیلتەر بۆ categoryـی سەرەکی بکە
         await navigateToFilterCore({
             subcategory: 'all', // دانانی subcategory بە 'all'
             subSubcategory: 'all', // ڕێسێتکردنی sub-subcategory
             search: '' // سڕینەوەی گەڕان
         });
         await updateProductViewUI(true);
     };
     subcategoriesContainer.appendChild(allBtn);

     // زیادکردنی دوگمەکان بۆ هەر subcategoryـیەکی ڕاستەقینە
     subcategoriesData.forEach(subcat => {
         const subcatBtn = document.createElement('button');
         subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
         const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subcat.imageUrl || placeholderImg;

         subcatBtn.innerHTML = `
              <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
              <span>${subcatName}</span>
         `;
         subcatBtn.onclick = async () => {
             // ڕۆیشتن بۆ پیشاندانی ئەم subcategoryـیە
             await navigateToFilterCore({
                 subcategory: subcat.id, // دانانی subcategoryـی ئێستا
                 subSubcategory: 'all', // ڕێسێتکردنی sub-subcategory
                 search: '' // سڕینەوەی گەڕان
             });
             await updateProductViewUI(true);
         };
         subcategoriesContainer.appendChild(subcatBtn);
     });

     // ڕێندەرکردنی sub-subcategoryـەکان ئەگەر پێویست بوو
     if (state.currentSubcategory !== 'all') {
         renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory);
     } else {
         subSubcategoriesContainer.style.display = 'none'; // شاردنەوە ئەگەر subcategory 'all' هەڵبژێردرابێت
     }
}

// ڕێندەرکردنی sub-subcategoryـەکان لەسەر بنەمای category سەرەکی و لاوەکی هەڵبژێردراو
async function renderSubSubcategoriesUI(mainCatId, subCatId) {
     // دڵنیابوون لەوەی subSubcategoriesContainer پێناسەکراوە (پێویستە لە app-setup.js ـەوە import بکرێت)
     if (!subSubcategoriesContainer) {
         console.error("subSubcategoriesContainer is not defined or imported.");
         return;
     }

     if (!mainCatId || mainCatId === 'all' || !subCatId || subCatId === 'all') {
         subSubcategoriesContainer.style.display = 'none';
         return;
     }

     subSubcategoriesContainer.innerHTML = ''; // سڕینەوەی پێشوو

     const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId);

     if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
         subSubcategoriesContainer.style.display = 'none'; // شاردنەوە ئەگەر هیچ نەبێت
         return;
     }

     subSubcategoriesContainer.style.display = 'flex'; // پیشاندانی کۆنتەینەر

     // زیادکردنی دوگمەی "هەموو" بۆ sub-subcategoryـەکانی subcategoryـی ئێستا
     const allBtn = document.createElement('button');
     allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
     const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
     allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
     allBtn.onclick = async () => {
         await navigateToFilterCore({
             subSubcategory: 'all', // دانانی sub-subcategory بە 'all'
             search: '' // سڕینەوەی گەڕان
         });
         await updateProductViewUI(true);
     };
     subSubcategoriesContainer.appendChild(allBtn);

     // زیادکردنی دوگمەکان بۆ هەر sub-subcategoryـیەکی ڕاستەقینە
     subSubcategoriesData.forEach(subSubcat => {
         const btn = document.createElement('button');
         btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;
         const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subSubcat.imageUrl || placeholderImg;

         btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;
         btn.onclick = async () => {
             await navigateToFilterCore({
                 subSubcategory: subSubcat.id, // دانانی sub-subcategoryـی ئێستا
                 search: '' // سڕینەوەی گەڕان
             });
             await updateProductViewUI(true);
         };
         subSubcategoriesContainer.appendChild(btn);
     });
}

// نوێکردنەوەی پیشاندانی بەرهەمەکان لەسەر بنەمای stateـی فیلتەری ئێستا (ڕاکێشانی داتا و ڕێندەرکردن)
export async function updateProductViewUI(isNewSearch = false) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    // پیشاندانی سکێلێتۆن لۆدەر بۆ گەڕان/فیلتەرە نوێیەکان
    if (isNewSearch) {
        homeSectionsContainer.style.display = 'none'; // شاردنەوەی بەشەکانی ماڵەوە
        productsContainer.style.display = 'none';
        renderSkeletonLoader(skeletonLoader); // بەکارهێنانی فانکشن لە app-ui.js
        skeletonLoader.style.display = 'grid';
        scrollTrigger.style.display = 'none'; // شاردنەوەی تریگەری سکڕۆڵ لە کاتی بارکردنی سەرەتایی
    }

    // ڕاکێشانی بەرهەمەکان لەسەر بنەمای stateـی ئێستا (state لەلایەن navigateToFilterCore نوێکراوەتەوە)
    const result = await fetchProducts(state.currentSearch, isNewSearch);

    if (result === null) return; // بارکردن هێشتا بەردەوامە یان هەمووی بارکراوە

    skeletonLoader.style.display = 'none'; // شاردنەوەی سکێلێتۆن لۆدەر

    if (result.isHome) {
        productsContainer.style.display = 'none'; // شاردنەوەی گریدی بەرهەمەکان
        scrollTrigger.style.display = 'none'; // شاردنەوەی تریگەری سکڕۆڵ
        homeSectionsContainer.style.display = 'block'; // پیشاندانی کۆنتەینەری بەشەکانی ماڵەوە
        // ڕێندەرکردنی ناوەڕۆکی ماڵەوە تەنها ئەگەر گەڕانێکی نوێ بوو یان کۆنتەینەر بەتاڵ بوو
        if (isNewSearch || homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI(); // ڕێندەرکردنی ناوەڕۆکی ماڵەوە
        }
    } else {
        homeSectionsContainer.style.display = 'none'; // شاردنەوەی بەشەکانی ماڵەوە
        productsContainer.style.display = 'grid'; // پیشاندانی گریدی بەرهەمەکان
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             // ڕێندەرکردنی بەرهەمەکان (بەکارهێنانی فانکشنی ناوخۆیی ئەم فایلە)
             renderProductsGridUI(isNewSearch ? null : result.products);
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block'; // پیشاندان/شاردنەوەی تریگەری سکڕۆڵ
    }

    // نوێکردنەوەی دۆخی دوگمەکانی category دوای ڕاکێشان و ڕێندەرکردن
    renderMainCategoriesUI();
    const subcats = await fetchSubcategories(state.currentCategory);
    renderSubcategoriesUI(subcats); // ڕێندەرکردنی دوگمەکانی subcategory

     // لۆجیکی سکڕۆڵ
    if (isNewSearch) {
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ڕێندەرکردنی کارتی بەرهەمەکان لەناو کۆنتەینەری گریدی سەرەکی
function renderProductsGridUI(newProductsOnly = false) {
    // تێبینی: productsContainer لە app-setup.js واردکراوە
    if (!productsContainer) return;

    if (newProductsOnly && Array.isArray(newProductsOnly)) { // زیادکردنی بەرهەمە نوێیەکان
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item); // فانکشن لە app-ui.js
            element.classList.add('product-card-reveal'); // زیادکردنی کڵاسی ئەنیمەیشن
            productsContainer.appendChild(element);
        });
    } else { // سڕینەوە و ڕێندەرکردنی هەموو بەرهەمەکانی ناو state
        productsContainer.innerHTML = '';
        if (!state.products || state.products.length === 0) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = createProductCardElementUI(item); // فانکشن لە app-ui.js
                element.classList.add('product-card-reveal'); // زیادکردنی کڵاسی ئەنیمەیشن
                productsContainer.appendChild(element);
            });
        }
    }

    // دووبارە دانانی ئەنیمەیشنەکان بۆ کارتە نوێ زیادکراوەکان
    if (window.setupScrollAnimations) { // پشکنینی ئەوەی کە فانکشنەکە لە global scopeـدا هەیە
        window.setupScrollAnimations();
    }
}
