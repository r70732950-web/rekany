// home.js
// Logika UI تایبەت بە پەڕەی سەرەکی (Home Page) - Optimized Loading

import {
    state, t, debounce,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, // *** زیادکرا: هاوردەکردنی فانکشنی دروست ***
    db, doc, getDoc // Firestore functions needed locally
} from './app-core.js';

// *** هاوردەکردنی فانکشنە هاوبەشەکان لە ui-render.js (Assume ui-render.js exists) ***
import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI
} from './ui-render.js'; // Use ui-render.js

// --- UI Rendering Functions for Home Page ---

// Renders product cards in the main grid (replaces original renderProductsUI)
function renderProductsGridUI(newProductsOnly = false) {
    const container = document.getElementById('productsContainer'); // Assuming productsContainer is the main grid ID in index.html
    if (!container) return;

    // If only rendering new products (infinite scroll), append them
    if (Array.isArray(newProductsOnly)) { // Check if it's an array of new products
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item); // Use imported function
            element.classList.add('product-card-reveal'); // Add animation class
            container.appendChild(element);
        });
    } else {
        // Otherwise, clear and render all products from state
        container.innerHTML = '';
        if (!state.products || state.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = createProductCardElementUI(item); // Use imported function
                element.classList.add('product-card-reveal'); // Add animation class
                container.appendChild(element);
            });
        }
    }
    setupScrollAnimations(); // Use imported function
}
// Make globally accessible if infinite scroll in ui-core.js needs it
// Consider refactoring infinite scroll trigger if possible
window.renderProductsGridUI = renderProductsGridUI;

// Renders main category buttons (Top horizontal scroll)
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
             // Navigate first using core logic
             await navigateToFilterCore({
                 category: cat.id,
                 subcategory: 'all', // Reset subcategory when main category changes
                 subSubcategory: 'all', // Reset sub-subcategory
                 search: '' // Clear search
             });
             // Then trigger UI update
             await updateProductViewUI(true); // true indicates a new filter/search
        };

        container.appendChild(btn);
    });
}


// Renders subcategories based on fetched data (Second horizontal scroll)
export async function renderSubcategoriesUI(subcategoriesData) { // Needs to be async if fetching inside
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); // Get sub-sub container

    subcategoriesContainer.innerHTML = ''; // Clear previous
    subSubcategoriesContainer.innerHTML = ''; // Clear sub-sub
    subSubcategoriesContainer.style.display = 'none'; // Hide sub-sub initially

    if (!subcategoriesData || subcategoriesData.length === 0 || state.currentCategory === 'all') {
         subcategoriesContainer.style.display = 'none'; // Hide if no subcategories or 'All' is selected
         return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show if there are subcategories

    // Add "All" button for the current category's subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; // Add dataset id
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
         // When "All" subcategory is clicked, just filter products for the main category
         await navigateToFilterCore({
             category: state.currentCategory, // Keep main category
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true);
    };
    subcategoriesContainer.appendChild(allBtn);

    // Add buttons for each actual subcategory
    subcategoriesData.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;
        subcatBtn.dataset.id = subcat.id; // Add dataset id
        const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subcat.imageUrl || placeholderImg;

        subcatBtn.innerHTML = `
             <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
             <span>${subcatName}</span>
        `;
        // *** چاککراو: کردنەوەی پەڕەی نوێ ***
        subcatBtn.onclick = async () => {
            // Directly open the subcategory detail page
            showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });

     // Render sub-subcategories if a specific subcategory is selected
     if (state.currentSubcategory !== 'all') {
         await renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory);
     }
}

// Renders sub-subcategories (Third horizontal scroll, only shown when a subcategory is active)
async function renderSubSubcategoriesUI(mainCatId, subCatId) {
    const container = document.getElementById('subSubcategoriesContainer');
    container.innerHTML = ''; // Clear previous

    if (!mainCatId || mainCatId === 'all' || !subCatId || subCatId === 'all') {
        container.style.display = 'none';
        return;
    }

    // *** چاککراو: فانکشنی دروست بەکارهێنرا ***
    const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); // Fetch sub-sub using the correct function

    if (!subSubcategoriesData || subSubcategoriesData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Add "All" button for the current subcategory's sub-subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; // Add dataset id
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
         // Filter by the parent subcategory ON THE MAIN PAGE
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true);
    };
    container.appendChild(allBtn);

    // Add buttons for each sub-subcategory
    subSubcategoriesData.forEach(subSubcat => {
        const btn = document.createElement('button');
        btn.className = `subcategory-btn ${state.currentSubSubcategory === subSubcat.id ? 'active' : ''}`;
        btn.dataset.id = subSubcat.id; // Add dataset id
        const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subSubcat.imageUrl || placeholderImg;
        btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

        // *** چاککراو: کردنەوەی پەڕەی نوێی جۆری لاوەکی باوک ***
        btn.onclick = async () => {
             // Open the PARENT subcategory detail page
             showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory);
             // Note: This will initially show all products for the subcategory.
             // The user would need to click the sub-subcategory again on the detail page
             // to filter further, unless showSubcategoryDetailPageUI is modified
             // to accept and pre-filter by subSubcategoryId.
        };
        container.appendChild(btn);
    });
}


// Handles applying the current filter state to the UI (fetching & rendering home/products)
// This function now orchestrates rendering between home sections and product grid
export async function updateProductViewUI(isNewSearch = false) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); // Main product grid container
    const skeletonLoader = document.getElementById('skeletonLoader'); // Main skeleton loader
    console.log('[updateProductViewUI] Called. isNewSearch:', isNewSearch, 'Current State:', { ...state }); // Debug log

    // Show skeleton loader for new searches/filters that ARE NOT the home view
    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    console.log('[updateProductViewUI] shouldShowHome:', shouldShowHome); // Debug log

    if (isNewSearch && !shouldShowHome) {
        console.log('[updateProductViewUI] Showing skeleton for product grid.'); // Debug log
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        productsContainer.style.display = 'none'; // Hide product grid
        renderSkeletonLoader(skeletonLoader); // Use imported function
        skeletonLoader.style.display = 'grid'; // Show skeleton
        scrollTrigger.style.display = 'none'; // Hide scroll trigger during initial load
    } else if (isNewSearch && shouldShowHome) {
        console.log('[updateProductViewUI] Showing loader for home sections.'); // Debug log
        // For home view, show a loader *inside* the home container
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
        homeSectionsContainer.style.display = 'block';
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
    }


    // Fetch products based on current state (state updated by navigateToFilterCore)
    // fetchProducts now returns { isHome: true } if it should show home sections
    const result = await fetchProducts(state.currentSearch, isNewSearch);
    console.log('[updateProductViewUI] fetchProducts result:', result); // Debug log

    if (result === null && !isNewSearch) return; // Loading is already in progress or all loaded for infinite scroll

    skeletonLoader.style.display = 'none'; // Hide main skeleton loader

    if (result.isHome) {
        console.log('[updateProductViewUI] Rendering home page content.'); // Debug log
        productsContainer.style.display = 'none'; // Hide product grid
        scrollTrigger.style.display = 'none'; // Hide scroll trigger
        homeSectionsContainer.style.display = 'block'; // Show home sections container
        // Render home content ONLY if new search OR container is empty/has loader
        if (isNewSearch || homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI(); // Render home content (defined below)
        } else {
             console.log('[updateProductViewUI] Skipping home content re-render as it seems loaded.'); // Debug log
        }
    } else {
        console.log('[updateProductViewUI] Rendering product grid.'); // Debug log
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        productsContainer.style.display = 'grid'; // Show product grid
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             // Append if not a new search, replace if it is
             renderProductsGridUI(isNewSearch ? null : result.products); // Use the grid renderer
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block'; // Show/hide scroll trigger
    }

    // Update category button states AFTER fetching and rendering
    renderMainCategoriesUI(); // Render main category buttons
    const subcats = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(subcats); // Render subcategory buttons and potentially sub-sub

    // Scroll logic
    if (isNewSearch) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


// Function to render home page sections (UI Part) - OPTIMIZED WITH Promise.all
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    // Show loader inside the container if it's empty
    if (homeSectionsContainer.innerHTML.trim() === '') {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    const layout = await fetchHomeLayout(); // Fetch layout from core
    homeSectionsContainer.innerHTML = ''; // Clear loader/previous content

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        const allProductsSection = await createAllProductsSectionElement(); // Fallback
        if (allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Clean up any existing intervals before rendering new ones
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    // Create promises for each section's element creation
    const sectionPromises = layout.map(section => {
        let promise = Promise.resolve(null); // Default to null if type is unknown or missing data
        try {
            switch (section.type) {
                case 'promo_slider':
                    if (section.groupId) promise = createPromoSliderElement(section.groupId, section.id);
                    else console.warn("Promo slider missing groupId:", section);
                    break;
                case 'brands':
                    if (section.groupId) promise = createBrandsSectionElement(section.groupId);
                    else console.warn("Brands section missing groupId:", section);
                    break;
                case 'newest_products':
                    promise = createNewestProductsSectionElement();
                    break;
                case 'single_shortcut_row':
                    if (section.rowId) promise = createSingleShortcutRowElement(section.rowId, section.name);
                    else console.warn("Shortcut row missing rowId:", section);
                    break;
                case 'single_category_row':
                    if (section.categoryId) promise = createSingleCategoryRowElement(section);
                    else console.warn("Category row missing categoryId:", section);
                    break;
                case 'all_products':
                     promise = createAllProductsSectionElement();
                    break;
                default:
                    console.warn(`Unknown home layout section type: ${section.type}`);
            }
        } catch(error) {
             console.error(`Error creating promise for section type ${section.type}:`, error);
             // Create an error placeholder element promise
             promise = Promise.resolve(createErrorPlaceholderElement(section.type));
        }
        // Attach the original order to the promise result
        return promise.then(element => ({ element, order: section.order }));
    });

    // Wait for all section elements to be created (or fail)
    const sectionResults = await Promise.all(sectionPromises);

    // Sort results based on original order (just in case Promise.all doesn't preserve it)
    sectionResults.sort((a, b) => a.order - b.order);

    // Append elements in the correct order
    sectionResults.forEach(result => {
        if (result.element) {
            homeSectionsContainer.appendChild(result.element);
        }
    });

    setupScrollAnimations(); // Re-apply scroll animations
}

// Helper function to create an error placeholder
function createErrorPlaceholderElement(sectionType) {
    const errorElement = document.createElement('div');
    errorElement.style.padding = '20px';
    errorElement.style.textAlign = 'center';
    errorElement.style.color = 'red';
    errorElement.textContent = `هەڵە لە بارکردنی بەشی: ${sectionType}`;
    return errorElement;
}


// --- UI Element Creation Functions for Home Page (Remain mostly the same, just ensure they are async) ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; // Styles for container

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
    updateImage(sliderState.currentIndex); // Initial image

    // Add buttons only if multiple cards
    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); // Reset timer on manual navigation
        };
        promoCardElement.appendChild(nextBtn);

        // Auto-rotation logic
        const rotate = () => {
             // Check if the element still exists and the interval is still tracked
             if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); // Clear this specific interval
                 if (state.sliderIntervals && state.sliderIntervals[layoutId]) delete state.sliderIntervals[layoutId]; // Remove from global state
                 return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]); // Clear previous if any
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[layoutId] = sliderState.intervalId; // Store globally
        };
        const resetInterval = () => {
             if (state.sliderIntervals[layoutId]) clearInterval(state.sliderIntervals[layoutId]);
            startInterval();
        };

        startInterval(); // Start on render
    }

    // Click on the card navigates
    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ignore clicks on buttons
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                await navigateToFilterCore({ category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                await updateProductViewUI(true); // Trigger full refresh
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
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId); // Use imported function
             } else if(brand.categoryId) {
                  await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                  await updateProductViewUI(true); // Trigger full refresh
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
        const card = createProductCardElementUI(product); // Use imported function
        productsScroller.appendChild(card);
    });
    return container;
}

async function createSingleShortcutRowElement(rowId, sectionNameObj) { // Receive name object
     const rowDocRef = doc(db, "shortcut_rows", rowId);
     const rowDocSnap = await getDoc(rowDocRef);
     if (!rowDocSnap.exists()) return null;

     const rowData = rowDocSnap.data();
     const cards = await fetchShortcutRowCards(rowId);
     if (!cards || cards.length === 0) return null;

     const sectionContainer = document.createElement('div');
     sectionContainer.className = 'shortcut-cards-section';
     // Use sectionNameObj from layout first, fallback to rowData title
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
              await navigateToFilterCore({ // Use core navigation
                 category: cardData.categoryId || 'all',
                 subcategory: cardData.subcategoryId || 'all',
                 subSubcategory: cardData.subSubcategoryId || 'all',
                 search: ''
              });
              await updateProductViewUI(true); // Trigger UI update
         };
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData; // name is from layout
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani); // Use layout name first

    // Try to get a more specific title from category data if layout name wasn't specific enough
    if (!title) {
        try {
            let targetDocRef;
            if (subSubcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
            else if (subcategoryId) targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
            else targetDocRef = doc(db, `categories/${categoryId}`);
            const targetSnap = await getDoc(targetDocRef);
            if (targetSnap.exists()) {
                 const targetData = targetSnap.data();
                 title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان'; // Fallback title
            } else {
                 title = 'کاڵاکان'; // Fallback if ref doesn't exist
            }
        } catch(e) {
            console.warn("Could not fetch specific title for category row", e);
            title = 'کاڵاکان'; // Fallback on error
        }
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
        const card = createProductCardElementUI(product); // Use imported function
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
        if(subcategoryId) { // Includes subSubcategoryId case, go to detail page
             showSubcategoryDetailPageUI(categoryId, subcategoryId); // Use imported function
        } else { // Only main category, filter main page
             await navigateToFilterCore({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             await updateProductViewUI(true); // Trigger full refresh
        }
    };
    return container;
}

async function createAllProductsSectionElement() {
    const products = await fetchInitialProductsForHome(); // Fetch only a few initially
    // If you want NO products here initially, just return the container structure
    // if (!products || products.length === 0) return null; // Optionally hide if no initial products

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add some space before this section
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
            </div>
        <div class="products-container" id="homeAllProductsGrid"></div> <!-- Give it a unique ID -->
    `;
    const productsGrid = container.querySelector('#homeAllProductsGrid');
     if (products && products.length > 0) {
        products.forEach(product => {
            const card = createProductCardElementUI(product); // Use imported function
            productsGrid.appendChild(card);
        });
     } else {
         productsGrid.innerHTML = '<p style="text-align:center; padding: 20px;">هیچ کاڵایەک نەدۆزرایەوە.</p>'; // Or a loader
     }
    return container;
}
