// home.js
// Logika UI تایبەت بە پەڕەی سەرەکی (Home Page) - نوێکراوە بۆ بارکردنی هاوتەریب و چاککردنی export

import {
    state, t, debounce,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories,
    db, doc, getDoc
} from './app-core.js';

// هاوردەکردنی فانکشنە هاوبەشەکان لە ui-render.js
import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI
} from './ui-render.js';

// --- UI Rendering Functions for Home Page ---

// Renders product cards in the main grid
function renderProductsGridUI(newProductsOnly = false) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    if (Array.isArray(newProductsOnly)) { // Append new products for infinite scroll
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item);
            element.classList.add('product-card-reveal');
            container.appendChild(element);
        });
    } else { // Clear and render all products
        container.innerHTML = '';
        if (!state.products || state.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = createProductCardElementUI(item);
                element.classList.add('product-card-reveal');
                container.appendChild(element);
            });
        }
    }
    setupScrollAnimations();
}
// Make globally accessible if needed by other modules indirectly (less ideal)
// window.renderProductsGridUI = renderProductsGridUI; // Consider removing if not strictly necessary

// Renders main category buttons
export function renderMainCategoriesUI() { // Exported for ui-core.js
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
             await navigateToFilterCore({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             });
             await updateProductViewUI(true); // Call the main update function
         };

        container.appendChild(btn);
    });
}

// Renders subcategories based on fetched data
export async function renderSubcategoriesUI(subcategoriesData) { // Exported for ui-core.js
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');

    subcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.innerHTML = '';
    subSubcategoriesContainer.style.display = 'none';

    if (!subcategoriesData || subcategoriesData.length === 0 || state.currentCategory === 'all') {
         subcategoriesContainer.style.display = 'none';
         return;
    }

    subcategoriesContainer.style.display = 'flex';

    // Add "All" button
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all';
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
         <div class="subcategory-image">${allIconSvg}</div>
         <span>${t('all_categories_label')}</span>
     `;
    allBtn.onclick = async () => {
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true);
    };
    subcategoriesContainer.appendChild(allBtn);

    // Add specific subcategory buttons
    subcategoriesData.forEach(subcat => {
         const subcatBtn = document.createElement('button');
         subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
         subcatBtn.dataset.id = subcat.id;
         const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subcat.imageUrl || placeholderImg;

         subcatBtn.innerHTML = `
              <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
              <span>${subcatName}</span>
          `;
         subcatBtn.onclick = async () => {
             showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
         };
         subcategoriesContainer.appendChild(subcatBtn);
    });

     // Render sub-subcategories if needed
     if (state.currentSubcategory !== 'all') {
         await renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory);
     }
}

// Renders sub-subcategories
async function renderSubSubcategoriesUI(mainCatId, subCatId) {
    const container = document.getElementById('subSubcategoriesContainer');
    container.innerHTML = '';

    if (!mainCatId || mainCatId === 'all' || !subCatId || subCatId === 'all') {
        container.style.display = 'none';
        return;
    }

    const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId);

    if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Add "All" button
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all';
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
         <div class="subcategory-image">${allIconSvg}</div>
         <span>${t('all_categories_label')}</span>
     `;
    allBtn.onclick = async () => {
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true);
    };
    container.appendChild(allBtn);

    // Add specific sub-subcategory buttons
    subSubcategoriesData.forEach(subSubcat => {
         const btn = document.createElement('button');
         btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;
         btn.dataset.id = subSubcat.id;
         const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
         const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
         const imageUrl = subSubcat.imageUrl || placeholderImg;
         btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

         btn.onclick = async () => {
              showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory);
          };
         container.appendChild(btn);
    });
}


// Handles applying the current filter state to the UI (fetching & rendering home/products)
// This is the main function controlling what is displayed on the main page.
// ** نوێکراو: تەنها یەکجار لێرەدا export کراوە **
export async function updateProductViewUI(isNewSearch = false) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');

    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (isNewSearch && !shouldShowHome) {
        homeSectionsContainer.style.display = 'none';
        productsContainer.style.display = 'none';
        renderSkeletonLoader(skeletonLoader);
        skeletonLoader.style.display = 'grid';
        scrollTrigger.style.display = 'none';
    } else if (isNewSearch && shouldShowHome) {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
        homeSectionsContainer.style.display = 'block';
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
    }

    const result = await fetchProducts(state.currentSearch, isNewSearch);

    if (result === null && !isNewSearch) return;

    skeletonLoader.style.display = 'none';

    if (result.isHome) {
        productsContainer.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';
        if (isNewSearch || homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI();
        }
    } else {
        homeSectionsContainer.style.display = 'none';
        productsContainer.style.display = 'grid';
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
            renderProductsGridUI(isNewSearch ? null : result.products);
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block';
    }

    renderMainCategoriesUI();
    const subcats = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(subcats);

    if (isNewSearch) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


// Renders home page sections using parallel fetching
export async function renderHomePageContentUI() { // Exported for ui-core.js
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    if (homeSectionsContainer.innerHTML.trim() === '') {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    const layout = await fetchHomeLayout();
    homeSectionsContainer.innerHTML = '';

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        const allProductsSection = await createAllProductsSectionElement([]);
        if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    const dataFetchPromises = layout.map(section => {
        switch (section.type) {
            case 'promo_slider':
                return section.groupId ? fetchPromoGroupCards(section.groupId) : Promise.resolve(null);
            case 'brands':
                return section.groupId ? fetchBrandGroupBrands(section.groupId) : Promise.resolve(null);
            case 'newest_products':
                return fetchNewestProducts();
            case 'single_shortcut_row':
                return section.rowId ? fetchShortcutRowCards(section.rowId) : Promise.resolve(null);
            case 'single_category_row':
                return section.categoryId ? fetchCategoryRowProducts(section) : Promise.resolve(null);
            case 'all_products':
                return fetchInitialProductsForHome();
            default:
                console.warn(`Unknown home layout section type: ${section.type}`);
                return Promise.resolve(null);
        }
    });

    try {
        const allDataResults = await Promise.all(dataFetchPromises);

        layout.forEach((section, index) => {
            const fetchedData = allDataResults[index];
            let sectionElement = null;

            if (fetchedData === null || (Array.isArray(fetchedData) && fetchedData.length === 0)) {
                console.warn(`No data for section type: ${section.type}`);
                return;
            }

            try {
                switch (section.type) {
                    case 'promo_slider':
                        sectionElement = createPromoSliderElement(fetchedData, section.id);
                        break;
                    case 'brands':
                        sectionElement = createBrandsSectionElement(fetchedData);
                        break;
                    case 'newest_products':
                        sectionElement = createNewestProductsSectionElement(fetchedData);
                        break;
                    case 'single_shortcut_row':
                        sectionElement = createSingleShortcutRowElement(fetchedData, section);
                        break;
                    case 'single_category_row':
                        sectionElement = createSingleCategoryRowElement(fetchedData, section);
                        break;
                    case 'all_products':
                         sectionElement = createAllProductsSectionElement(fetchedData);
                        break;
                }
            } catch(error) {
                 console.error(`Error creating UI element for section type ${section.type}:`, error);
                 sectionElement = document.createElement('div');
                 sectionElement.style.padding = '20px'; sectionElement.style.textAlign = 'center'; sectionElement.style.color = 'red';
                 sectionElement.textContent = `هەڵە لە دروستکردنی بەشی: ${section.type}`;
            }

            if (sectionElement) {
                homeSectionsContainer.appendChild(sectionElement);
            }
        });

    } catch (error) {
        console.error("Error fetching data for home layout sections:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align:center; padding: 20px; color: red;">هەڵەیەک لە بارکردنی بەشەکانی پەڕەی سەرەکی ڕوویدا.</p>`;
    }

    setupScrollAnimations();
}

// --- UI Element Creation Functions for Home Page (Modified to accept data) ---

function createPromoSliderElement(cards, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container';
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`;

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item';

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
        const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;
        imgElement.src = imageUrl;
    };
    updateImage(sliderState.currentIndex);

    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';

        const resetInterval = () => {
             if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            startInterval();
        };

        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval();
        };
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval();
        };

        promoCardElement.appendChild(prevBtn);
        promoCardElement.appendChild(nextBtn);

        const rotate = () => {
             if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId);
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId];
                return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[layoutId] = sliderState.intervalId;
        };

        startInterval();
    }

    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) {
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 await navigateToFilterCore({ category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 await updateProductViewUI(true);
            }
        }
    });

    promoGrid.appendChild(promoCardElement);
    return promoGrid;
}

function createBrandsSectionElement(brands) {
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
                   showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId);
              } else if(brand.categoryId) {
                    await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                    await updateProductViewUI(true);
              }
        };
        brandsContainer.appendChild(item);
    });
    return sectionContainer;
}

function createNewestProductsSectionElement(products) {
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
        const card = createProductCardElementUI(product);
        productsScroller.appendChild(card);
    });
    return container;
}

async function createSingleShortcutRowElement(cards, sectionData) {
    const rowId = sectionData.rowId;
    let rowTitle = (sectionData.name && sectionData.name[state.currentLanguage]) || (sectionData.name && sectionData.name.ku_sorani);
    if (!rowTitle) {
        try {
            const rowDocRef = doc(db, "shortcut_rows", rowId);
            const rowDocSnap = await getDoc(rowDocRef);
            if (rowDocSnap.exists()) {
                const rowData = rowDocSnap.data();
                rowTitle = rowData.title[state.currentLanguage] || rowData.title.ku_sorani || 'Cards';
            } else { rowTitle = 'Cards'; }
        } catch { rowTitle = 'Cards'; }
    }

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';
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
              await navigateToFilterCore({
                  category: cardData.categoryId || 'all',
                  subcategory: cardData.subcategoryId || 'all',
                  subSubcategory: cardData.subSubcategoryId || 'all',
                  search: ''
              });
              await updateProductViewUI(true);
         };
         cardsContainer.appendChild(item);
    });
    return sectionContainer;
}

async function createSingleCategoryRowElement(products, sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani);

    if (!title) {
         try {
             let targetDocRef;
             if (subSubcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
             else if (subcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
             else targetDocRef = doc(db, `categories/${categoryId}`);
             const targetSnap = await getDoc(targetDocRef);
             if (targetSnap.exists()) {
                  const targetData = targetSnap.data();
                  title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان';
             } else { title = 'کاڵاکان'; }
         } catch(e) { title = 'کاڵاکان'; }
    }

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
        const card = createProductCardElementUI(product);
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
         if(subcategoryId) {
              showSubcategoryDetailPageUI(categoryId, subcategoryId);
         } else {
              await navigateToFilterCore({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
              await updateProductViewUI(true);
         }
    };
    return container;
}

function createAllProductsSectionElement(products) {
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
        const card = createProductCardElementUI(product);
        productsGrid.appendChild(card);
    });
    return container;
}

// ** لابردنی exportی دووەم لە کۆتایی فایلەکە **
// export { updateProductViewUI }; // <-- ئەم دێڕە لابرا چونکە پێشتر export کراوە
