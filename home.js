// home.js
// Logika UI تایبەت بە پەڕەی سەرەکی (Home Page) - نوێکراوە بۆ بارکردنی هاوتەریب

import {
    state, t, debounce,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, // *** زیادکرا: هاوردەکردنی فانکشنی دروست ***
    db, doc, getDoc // Firestore functions needed locally
} from './app-core.js';

// *** هاوردەکردنی فانکشنە هاوبەشەکان لە ui-render.js ***
// ** تێبینی: وا دادەنێین ui-render.js بوونی هەیە و ئەم فانکشنانەی تێدایە **
import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI
} from './ui-render.js'; // ** دڵنیابە ناوی فایلەکە ڕاستە **

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
// Make globally accessible if infinite scroll in app-ui.js needs it
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

    // Show skeleton loader for new searches/filters that ARE NOT the home view
    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    if (isNewSearch && !shouldShowHome) {
        homeSectionsContainer.style.display = 'none'; // Hide home sections
        productsContainer.style.display = 'none'; // Hide product grid
        renderSkeletonLoader(skeletonLoader); // Use imported function
        skeletonLoader.style.display = 'grid'; // Show skeleton
        scrollTrigger.style.display = 'none'; // Hide scroll trigger during initial load
    } else if (isNewSearch && shouldShowHome) {
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

    if (result === null && !isNewSearch) return; // Loading is already in progress or all loaded for infinite scroll

    skeletonLoader.style.display = 'none'; // Hide main skeleton loader

    if (result.isHome) {
        productsContainer.style.display = 'none'; // Hide product grid
        scrollTrigger.style.display = 'none'; // Hide scroll trigger
        homeSectionsContainer.style.display = 'block'; // Show home sections container
        // Render home content ONLY if new search OR container is empty/has loader
        if (isNewSearch || homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI(); // Render home content (defined below)
        }
    } else {
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


// Function to render home page sections (UI Part) - ** نوێکراوە **
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    // Show loader inside the container if it's empty
    if (homeSectionsContainer.innerHTML.trim() === '') {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    const layout = await fetchHomeLayout(); // 1. Fetch layout first

    homeSectionsContainer.innerHTML = ''; // Clear loader/previous content

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        // Render fallback if needed (e.g., all products)
        const allProductsSection = await createAllProductsSectionElement([]); // Pass empty array initially
        if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Clean up any existing intervals before rendering new ones
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    // 2. Create an array of fetch promises based on the layout
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
                return Promise.resolve(null); // Return null for unknown types
        }
    });

    try {
        // 3. Wait for all data to be fetched in parallel
        const allDataResults = await Promise.all(dataFetchPromises);

        // 4. Iterate through the layout *again* and build elements using the fetched data
        layout.forEach((section, index) => {
            const fetchedData = allDataResults[index]; // Get data corresponding to this section
            let sectionElement = null;

            // Handle cases where data fetching failed or returned null/empty
            if (fetchedData === null || (Array.isArray(fetchedData) && fetchedData.length === 0)) {
                console.warn(`No data found or error fetching for section type: ${section.type} (ID: ${section.groupId || section.rowId || section.categoryId || 'N/A'})`);
                // Optionally skip rendering or render a placeholder
                return; // Skip rendering this section
            }

            try {
                switch (section.type) {
                    case 'promo_slider':
                        sectionElement = createPromoSliderElement(fetchedData, section.id); // Pass fetched cards and layout ID
                        break;
                    case 'brands':
                        sectionElement = createBrandsSectionElement(fetchedData); // Pass fetched brands
                        break;
                    case 'newest_products':
                        sectionElement = createNewestProductsSectionElement(fetchedData); // Pass fetched products
                        break;
                    case 'single_shortcut_row':
                        sectionElement = createSingleShortcutRowElement(fetchedData, section); // Pass fetched cards and section info
                        break;
                    case 'single_category_row':
                        sectionElement = createSingleCategoryRowElement(fetchedData, section); // Pass fetched products and section info
                        break;
                    case 'all_products':
                         sectionElement = createAllProductsSectionElement(fetchedData); // Pass fetched products
                        break;
                    // No default needed as unknown types are handled above
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

    setupScrollAnimations(); // Re-apply scroll animations
}

// --- UI Element Creation Functions for Home Page (Modified to accept data) ---

// ** نوێکراو: داتا وەردەگرێت **
function createPromoSliderElement(cards, layoutId) {
    // Data (cards) is already fetched and passed in
    // No need for: const cards = await fetchPromoGroupCards(groupId);

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards }; // Use passed-in cards

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

// ** نوێکراو: داتا وەردەگرێت **
function createBrandsSectionElement(brands) {
    // Data (brands) is already fetched and passed in
    // No need for: const brands = await fetchBrandGroupBrands(groupId);

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

// ** نوێکراو: داتا وەردەگرێت **
function createNewestProductsSectionElement(products) {
    // Data (products) is already fetched and passed in
    // No need for: const products = await fetchNewestProducts();

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

// ** نوێکراو: داتا وەردەگرێت **
// Use a separate function to fetch the row title if needed, maybe not necessary now
async function createSingleShortcutRowElement(cards, sectionData) {
    // Data (cards) is already fetched and passed in
    // No need for: const cards = await fetchShortcutRowCards(rowId);
    const rowId = sectionData.rowId;

    // Fetch row data just for the title (consider caching this if needed frequently)
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

// ** نوێکراو: داتا وەردەگرێت **
async function createSingleCategoryRowElement(products, sectionData) {
    // Data (products) is already fetched and passed in
    // No need for: const products = await fetchCategoryRowProducts(sectionData);
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData; // name is from layout

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

// ** نوێکراو: داتا وەردەگرێت **
function createAllProductsSectionElement(products) {
    // Data (products) is already fetched and passed in
    // No need for: const products = await fetchInitialProductsForHome();
    if (!products || products.length === 0) return null; // Check if data is valid

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add some space before this section
    container.innerHTML = `
         <div class="section-title-header">
             <h3 class="section-title-main">${t('all_products_section_title')}</h3>
             </div>
         <div class="products-container"></div>
     `;
    const productsGrid = container.querySelector('.products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // Use imported function
        productsGrid.appendChild(card);
    });
    return container;
}

// Ensure the main update function is exported or called appropriately
export { updateProductViewUI };