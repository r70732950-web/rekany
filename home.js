// home.js
import {
    state, t, debounce,
    fetchHomeLayout, 
    fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, 
    db, doc, getDoc 
} from './app-core.js';

import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI
} from './app-ui.js';

function resetScrollPosition(containerElement) {
    if (containerElement) {
        containerElement.scrollTo({
            left: 0,
            behavior: 'smooth' 
        });
    }
}


function renderProductsGridUI(newProductsOnly = false) {
    const container = document.getElementById('productsContainer'); 
    if (!container) return;

    if (Array.isArray(newProductsOnly)) { 
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item); 
            element.classList.add('product-card-reveal'); 
            container.appendChild(element);
        });
    } else {
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

window.renderProductsGridUI = renderProductsGridUI;

export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    const homeBtn = document.createElement('button');
    homeBtn.className = 'main-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> <span>${t('nav_home')}</span>`;

    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }

    homeBtn.onclick = async () => {
         resetScrollPosition(container); 
         await navigateToFilterCore({
             category: 'all',
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true);
    };
    container.appendChild(homeBtn);


    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id;

        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        const categoryName = (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);
        const categoryIcon = cat.icon;

        btn.innerHTML = `<i class="${categoryIcon}"></i> <span>${categoryName}</span>`;

        btn.onclick = async () => {
             resetScrollPosition(container); 
             await navigateToFilterCore({
                 category: cat.id,
                 subcategory: 'all',
                 subSubcategory: 'all',
                 search: ''
             });
             await updateProductViewUI(true, true);
        };

        container.appendChild(btn);
    });
}

export async function renderSubcategoriesUI(subcategoriesData) { 
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

    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; 
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
         resetScrollPosition(subcategoriesContainer); 
         await navigateToFilterCore({
             category: state.currentCategory, 
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    subcategoriesContainer.appendChild(allBtn);

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
            resetScrollPosition(subcategoriesContainer); 
            showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });

     if (state.currentSubcategory !== 'all') {
         await renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory);
     }
}

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

    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; 
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
         resetScrollPosition(container); 
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    container.appendChild(allBtn);

    subSubcategoriesData.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;
        btn.dataset.id = subSubcat.id; 
        const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subSubcat.imageUrl || placeholderImg;
        btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

        btn.onclick = async () => {
             resetScrollPosition(container); 
             showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory);
        };
        container.appendChild(btn);
    });
}


export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const categoryLayoutContainer = document.getElementById('categoryLayoutContainer'); 
    const productsContainer = document.getElementById('productsContainer'); 
    const skeletonLoader = document.getElementById('skeletonLoader');
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer');

    const isTargetHome = state.currentCategory === 'all' && !state.currentSearch;
    const isTargetCategoryLayout = state.currentCategory !== 'all' && 
                                   !state.currentSearch && 
                                   state.currentSubcategory === 'all' && 
                                   state.currentSubSubcategory === 'all';
    const isTargetProductGrid = !isTargetHome && !isTargetCategoryLayout;

    const isHomeLoaded = isTargetHome &&
                         homeSectionsContainer.dataset.layoutType === 'home' &&
                         homeSectionsContainer.innerHTML.trim() !== '';

    const targetCategoryLayoutId = `layout-cache-${state.currentCategory}`;
    const isCategoryLayoutLoaded = isTargetCategoryLayout &&
                                   document.getElementById(targetCategoryLayoutId); 
    
    if (isNewSearch) {
        scrollTrigger.style.display = 'none'; 
        const isReturningWithContent = isHomeLoaded || isCategoryLayoutLoaded;

        if (isReturningWithContent) {
            homeSectionsContainer.style.display = isHomeLoaded ? 'block' : 'none';
            categoryLayoutContainer.style.display = isCategoryLayoutLoaded ? 'block' : 'none';
            
            if (isCategoryLayoutLoaded) {
                Array.from(categoryLayoutContainer.children).forEach(child => {
                    child.style.display = (child.id === targetCategoryLayoutId) ? 'block' : 'none';
                });
            }
            
            productsContainer.style.display = 'none';
            skeletonLoader.style.display = 'none';
            
            if (isHomeLoaded) {
                subcategoriesContainer.style.display = 'none'; 
                subSubcategoriesContainer.style.display = 'none';
            } else {
                const subcats = await fetchSubcategories(state.currentCategory);
                await renderSubcategoriesUI(subcats);
            }

        } else {
            homeSectionsContainer.style.display = 'none';
            categoryLayoutContainer.style.display = 'none'; 
            productsContainer.style.display = 'none';
            subcategoriesContainer.style.display = 'none';
            subSubcategoriesContainer.style.display = 'none';
            renderSkeletonLoader(skeletonLoader); 
            skeletonLoader.style.display = 'grid';
        }
    }

    let result;
    if (isNewSearch && (isHomeLoaded || isCategoryLayoutLoaded)) {
        result = null; 
    } else if (!isNewSearch && isTargetProductGrid) {
         loader.style.display = 'block'; 
         result = await fetchProducts(state.currentSearch, false); 
         loader.style.display = 'none';
         if(result && result.products.length > 0) {
            renderProductsGridUI(result.products); 
         }
         scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
         
         renderMainCategoriesUI();
         return; 
    } else {
        result = await fetchProducts(state.currentSearch, true); 
    }

    skeletonLoader.style.display = 'none'; 

    if (result) {
        if (result.isHome) {
            productsContainer.style.display = 'none'; 
            scrollTrigger.style.display = 'none'; 
            
            if (result.layout) {
                homeSectionsContainer.style.display = 'none'; 
                categoryLayoutContainer.style.display = 'block'; 
                
                const subcats = await fetchSubcategories(state.currentCategory);
                await renderSubcategoriesUI(subcats);
                
                Array.from(categoryLayoutContainer.children).forEach(child => {
                    child.style.display = 'none';
                });

                let targetLayoutDiv = document.createElement('div');
                targetLayoutDiv.id = targetCategoryLayoutId;
                categoryLayoutContainer.appendChild(targetLayoutDiv);
                
                await renderPageContentUI(result.layout, targetLayoutDiv);
                
                targetLayoutDiv.style.display = 'block';
                
            } else {
                homeSectionsContainer.style.display = 'block'; 
                categoryLayoutContainer.style.display = 'none'; 
                
                subcategoriesContainer.style.display = 'none';
                subSubcategoriesContainer.style.display = 'none';
            
                if (!isHomeLoaded) { 
                    await renderPageContentUI(null, homeSectionsContainer, 'home'); 
                }
            }
        } else {
            homeSectionsContainer.style.display = 'none'; 
            categoryLayoutContainer.style.display = 'none'; 
            productsContainer.style.display = 'grid'; 
            
            const subcats = await fetchSubcategories(state.currentCategory);
            await renderSubcategoriesUI(subcats);
            
            if (result.error) {
                productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
            } else {
                renderProductsGridUI(null); 
            }
            scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; 
        }
    }

    renderMainCategoriesUI(); 
    
    if (isNewSearch && shouldScrollToTop) {
        const activePage = document.getElementById('mainPage');
        if (activePage) {
            activePage.scrollTo({ top: 0, behavior: 'auto' });
        }
    }
}


export async function renderPageContentUI(layoutSections, targetContainerElement) {
    if (!targetContainerElement) {
        console.error("Render target container is missing!");
        return;
    }
    
    let layoutToRender = layoutSections; 
    let layoutType = 'category'; 

    targetContainerElement.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;

    if (!layoutToRender) {
        layoutToRender = await fetchHomeLayout(); 
        layoutType = 'home'; 
    }

    targetContainerElement.innerHTML = ''; 
    targetContainerElement.dataset.layoutType = layoutType;
    
    if (!layoutToRender || layoutToRender.length === 0) {
        console.warn("Page layout is empty or failed to load.");
         // Pass current category context
         const allProductsSection = await createAllProductsSectionElement(state.currentCategory);
         if(allProductsSection) targetContainerElement.appendChild(allProductsSection);
        return;
    }

    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    // [ 💡 چاککرا ] - وەرگرتنی جۆری ئێستا بۆ ئەوەی بزانین تێکەڵ بکەین یان نا
    const currentCategoryId = state.currentCategory; 

    for (const section of layoutToRender) {
        let sectionElement = null;
        try {
             switch (section.type) {
                 case 'promo_slider':
                     if (section.groupId) {
                         const uniqueLayoutId = `${layoutType}_${section.id || section.groupId}`;
                         sectionElement = await createPromoSliderElement(section.groupId, uniqueLayoutId); 
                     } else console.warn("Promo slider missing groupId:", section);
                     break;
                 case 'brands':
                     if (section.groupId) {
                          sectionElement = await createBrandsSectionElement(section.groupId);
                     } else console.warn("Brands section missing groupId:", section);
                     break;
                 case 'newest_products':
                     // [ 💡 چاککرا ] - ناردنی currentCategoryId
                     sectionElement = await createNewestProductsSectionElement(currentCategoryId);
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
                       // [ 💡 چاککرا ] - ناردنی currentCategoryId
                       sectionElement = await createAllProductsSectionElement(currentCategoryId);
                      break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
        } catch(error) {
             console.error(`Error rendering home section type ${section.type}:`, error);
             sectionElement = document.createElement('div');
             sectionElement.style.padding = '20px';
             sectionElement.style.textAlign = 'center';
             sectionElement.style.color = 'red';
             sectionElement.textContent = `هەڵە لە بارکردنی بەشی: ${section.type}`;
        }

        if (sectionElement) {
            targetContainerElement.appendChild(sectionElement);
        }
    }
    setupScrollAnimations(); 
}

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; 
    promoGrid.style.marginBottom = '24px';
    const uniqueSliderId = `promoSlider_${layoutId}_${Math.random().toString(36).substring(2, 9)}`;
    promoGrid.id = uniqueSliderId; 

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
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); 
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); 
        };
        promoCardElement.appendChild(nextBtn);

        const rotate = () => {
             if (!document.getElementById(uniqueSliderId) || !state.sliderIntervals || !state.sliderIntervals[uniqueSliderId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); 
                 if (state.sliderIntervals && state.sliderIntervals[uniqueSliderId]) delete state.sliderIntervals[uniqueSliderId]; 
                return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]); 
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[uniqueSliderId] = sliderState.intervalId; 
        };
        const resetInterval = () => {
             if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]);
            startInterval();
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
                 await updateProductViewUI(true, true); 
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
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId); 
             } else if(brand.categoryId) {
                  await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                  await updateProductViewUI(true, true); 
             }
        };
        brandsContainer.appendChild(item);
    });
    return sectionContainer;
}

// [ 💡 چاککرا ] - ئێستا categoryId وەردەگرێت
async function createNewestProductsSectionElement(categoryId = null) {
    const products = await fetchNewestProducts(20, categoryId); // 20 items limit
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
        const card = createProductCardElementUI(product); 
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
     const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;
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
            
            if (cardData.subcategoryId && cardData.categoryId) {
                
                showSubcategoryDetailPageUI(cardData.categoryId, cardData.subcategoryId);
            
            } else {
                
                await navigateToFilterCore({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all', 
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
                await updateProductViewUI(true, true);
            }
         };
         
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData; 
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = ''; 

    try {
        let targetDocRef;
        if (subSubcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        } else if (subcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        } else {
            targetDocRef = doc(db, 'categories', categoryId); 
        }
        
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان'; 
        } else {
            title = 'کاڵاکان'; 
        }
    } catch (e) {
        console.warn("Could not fetch specific title for category row", e);
        title = 'کاڵاکان'; 
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
              await updateProductViewUI(true, true); 
         }
    };
    return container;
}

// [ 💡 چاککرا ] - ئێستا categoryId وەردەگرێت
async function createAllProductsSectionElement(categoryId = null) {
    const products = await fetchInitialProductsForHome(30, categoryId); // 30 items limit
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; 
    
    // گۆڕینی ناونیشان بەپێی جۆر (ئەگەر لەناو جۆرێک بووین، دەنووسین "هەموو کاڵاکان" بەبێ "سەرەکی")
    const titleKey = (categoryId && categoryId !== 'all') ? 'all_products' : 'all_products_section_title';
    
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t(titleKey)}</h3>
             </div>
        <div class="products-container all-products-grid"></div>
    `;
    const productsGrid = container.querySelector('.products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); 
        productsGrid.appendChild(card);
    });
    return container;
}
