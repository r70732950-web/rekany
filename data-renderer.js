// data-renderer.js (نیشاندەرێ داتای)
// بەرپرسیارەتی: ئینان (fetch) و نیشاندانا داتایان ژ Firestore (products, categories, home layout sections).
// لێگەریان (searchProductsInFirestore), بارکرنا پتر یا کاڵایان (infinite scroll).

import {
    db, // Firestore instance
    productsCollection, // Firestore collection references
    categoriesCollection,
    promoGroupsCollection,
    brandGroupsCollection,
    shortcutRowsCollection, // ZÊDEKIRÎ
    state, // Global state object
    PRODUCTS_PER_PAGE // Constant for pagination
} from './app-setup.js';

import { // Firestore functions needed
    collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { // UI functions needed from ui-manager.js
    renderProductsUI,
    renderSkeletonLoader,
    createProductCardElement,
    createPromoCardElement, // Ji bo beşa promo slider
    updatePromoCardImage, // Ji bo beşa promo slider
    t, // Ji bo wergêranê
    renderMainCategories, // Ji bo nûkirina UI piştî fetch category
    updateCategoryDependentUI // Ji bo nûkirina dropdown û UI piştî fetch category
} from './ui-manager.js';

// --- Global State for Data Renderer ---
// We use `state` from app-setup.js directly for consistency

// --- Product Fetching and Rendering ---

/**
 * Fetches products from Firestore based on current filters, search term, and pagination state.
 * Renders the products or home page content using functions from ui-manager.js.
 * @param {string} [searchTerm=''] - The current search term.
 * @param {boolean} [isNewSearch=false] - Whether this is a fresh search or loading more.
 */
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const loader = document.getElementById('loader'); // Infinite scroll loader
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Determine if we should show the dynamic home page or the product list/grid
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        // --- Show Home Page Sections ---
        if (productsContainer) productsContainer.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (scrollTrigger) scrollTrigger.style.display = 'none';
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        // Render home content only if it's not already rendered or if it's a new "search" (navigating back home)
        if (isNewSearch || !homeSectionsContainer || homeSectionsContainer.innerHTML.trim() === '') {
             await renderHomePageContent(); // Fetch and render home layout
        } else {
            // Home content already exists, ensure slider intervals are restarted if necessary
            // (Restart logic moved to renderHomePageContent itself for better encapsulation)
        }
        return; // Stop further execution as we are showing the home page

    } else {
        // --- Show Product List/Grid ---
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';

        // Stop all promo rotations when navigating away from the full home view
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
    }

    // --- Product Fetching Logic ---
    const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;

    // Use cache if available for a new search
    if (isNewSearch && state.productCache && state.productCache[cacheKey]) {
        state.products = state.productCache[cacheKey].products;
        state.lastVisibleProductDoc = state.productCache[cacheKey].lastVisible;
        state.allProductsLoaded = state.productCache[cacheKey].allLoaded;

        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (productsContainer) productsContainer.style.display = 'grid';

        renderProductsUI(state.products); // Render from cache using UI function
        if(scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block';
        return;
    }

    // Prevent concurrent loading
    if (state.isLoadingMoreProducts) return;

    // Reset state for a new search
    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(); // Show loading state using UI function
    }

    // Stop if all products are already loaded for the current filter/search
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (loader) loader.style.display = 'block'; // Show infinite scroll loader

    try {
        let productsQuery = query(productsCollection); // Start with base collection

        // --- Apply Filters ---
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        // Subcategory and SubSubcategory filters are handled implicitly IF user navigated via those
        // If filtering directly, you might need:
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
             productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
         if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
             productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
         }

        // --- Apply Search Term ---
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // Apply range filtering for basic prefix search on 'searchableName'
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Firestore requires the first orderBy to match the inequality field
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"));
             // Then add secondary ordering
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        } else {
            // Default ordering when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }


        // --- Apply Pagination ---
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // --- Apply Limit ---
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        // --- Execute Query ---
        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Update State ---
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            // Filter out duplicates just in case (though pagination should prevent this)
            const currentIds = new Set(state.products.map(p => p.id));
            const trulyNewProducts = newProducts.filter(p => !currentIds.has(p.id));
            state.products = [...state.products, ...trulyNewProducts];
        }

        // --- Update Pagination State ---
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            if(scrollTrigger) scrollTrigger.style.display = 'none';
        } else {
            state.allProductsLoaded = false;
            if(scrollTrigger) scrollTrigger.style.display = 'block';
        }
        state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Update last visible doc

        // --- Cache Result for New Search ---
        if (isNewSearch) {
            if (!state.productCache) state.productCache = {}; // Initialize if needed
            state.productCache[cacheKey] = {
                products: [...state.products], // Store a copy
                lastVisible: state.lastVisibleProductDoc,
                allLoaded: state.allProductsLoaded
            };
        }

        // --- Render Results ---
        renderProductsUI(state.products); // Use UI function to render

        if (state.products.length === 0 && isNewSearch && productsContainer) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {default: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        if (productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_fetching_products', {default: 'هەڵەیەک لە هێنانی کاڵاکان ڕوویدا.'})}</p>`;
    } finally {
        state.isLoadingMoreProducts = false;
        if (loader) loader.style.display = 'none'; // Hide infinite scroll loader
        // Skeleton loader hiding and product container display are handled by renderProductsUI
    }
}


// --- Home Page Content Rendering ---

/**
 * Fetches the home page layout from Firestore and renders the sections.
 */
export async function renderHomePageContent() {
    if (state.isRenderingHomePage) return; // Prevent concurrent rendering
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        state.isRenderingHomePage = false;
        return;
    }

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show loading state
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up any existing intervals before rendering new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals

        // Fetch enabled layout sections ordered by 'order'
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('home_layout_not_configured', {default: 'لاپەڕەی سەرەکی ڕێکنەخراوە.'})}</p>`;
        } else {
            // Process each section in the layout order
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                // Render section based on its type
                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID
                        } else { console.warn("Promo slider section missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section missing groupId."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                         if (section.rowId) {
                             sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                         } else { console.warn("Single shortcut row section missing rowId."); }
                         break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section missing categoryId."); }
                        break;
                    case 'all_products':
                        // This section type might just trigger the normal product rendering
                        // Or render a limited preview like before. Let's keep the preview.
                        sectionElement = await renderAllProductsSectionPreview();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        if (homeSectionsContainer) homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_rendering_home', {default: 'هەڵەیەک لە بارکردنی لاپەڕەی سەرەکی ڕوویدا.'})}</p>`;
    } finally {
        state.isRenderingHomePage = false;
         // Hide main skeleton loader after rendering is complete (or failed)
         if (skeletonLoader) skeletonLoader.style.display = 'none';
    }
}

/**
 * Renders a specific promo card slider section for the home page.
 * Manages slider intervals using state.sliderIntervals.
 * @param {string} groupId - The ID of the promo group to render.
 * @param {string} layoutId - The unique ID of this layout section instance.
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null on error/empty.
 */
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Reuse styling
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID for interval management

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // Use an object associated with this specific slider instance
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the initial card element
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass local state
            promoGrid.appendChild(promoCardElement);

            // Set up automatic rotation ONLY if there's more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and if the interval is still registered
                    const elementExists = document.getElementById(promoGrid.id);
                    const intervalRegistered = state.sliderIntervals && state.sliderIntervals[layoutId] === sliderState.intervalId;

                    if (!elementExists || !intervalRegistered) {
                        // Element removed or interval replaced, clean up this specific interval
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            // Ensure it's also removed from the global state if it matches
                            if (intervalRegistered) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop the rotation for this instance
                    }
                    // Update index and UI
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    updatePromoCardImage(promoCardElement, cardData, sliderState); // Use UI function to update image
                };

                // Clear any previous interval for THIS specific layout ID before starting a new one
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID in both local state and global registry
                sliderState.intervalId = setInterval(rotate, 5000);
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize registry if needed
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid; // Return the container element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId} (layout ${layoutId}):`, error);
    }
    return null; // Return null if empty or error
}


/**
 * Renders a horizontal scrolling section of brand logos.
 * @param {string} groupId - The ID of the brand group to render.
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null.
 */
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty sections

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item';
            // Add data attributes for navigation action
            item.dataset.action = "navigate-brand";
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
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return null;
    }
}

/**
 * Renders a horizontal scrolling section of newest products (added within last 15 days).
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null.
 */
async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    container.appendChild(header);

    try {
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit the number shown horizontally
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if no new products

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const isFav = state.favorites.includes(product.id);
            const card = createProductCardElement(product, isAdmin, isFav); // Use UI function
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
 * Renders a single horizontal row of shortcut cards based on a row ID.
 * @param {string} rowId - The ID of the shortcut row in Firestore.
 * @param {object} sectionNameObj - The multilingual name object from the layout config.
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null.
 */
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use layout name as primary, fallback to row title from DB
        const rowTitle = sectionNameObj[state.currentLanguage]
                         || rowData.title[state.currentLanguage]
                         || rowData.title.ku_sorani;


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

        if (cardsSnapshot.empty) return null; // Don't render empty rows

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            // Add data attributes for navigation action
            item.dataset.action = "navigate-shortcut";
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
        console.error(`Error rendering single shortcut row (ID: ${rowId}):`, error);
        return null;
    }
}

/**
 * Renders a horizontal row of products belonging to a specific category/subcategory/subsubcategory.
 * @param {object} sectionData - Data from home_layout ({categoryId, subcategoryId?, subSubcategoryId?, name}).
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null.
 */
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRefPath;

    // Determine the query field, value, and path based on the most specific ID
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
        return null; // No category specified
    }

    try {
        // Fetch the specific category/subcategory name for a more accurate title
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

        // Add "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        // Add data attributes for navigation action
        seeAllLink.dataset.action = "navigate-see-all";
        seeAllLink.dataset.categoryId = categoryId || '';
        seeAllLink.dataset.subcategoryId = subcategoryId || '';
        seeAllLink.dataset.subSubcategoryId = subSubcategoryId || ''; // Pass all IDs
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Query for products matching the specific category level
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit for horizontal view
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty rows

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const isFav = state.favorites.includes(product.id);
            const card = createProductCardElement(product, isAdmin, isFav); // Use UI function
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error rendering single category row (Cat: ${categoryId}, Sub: ${subcategoryId}, SubSub: ${subSubcategoryId}):`, error);
        return null;
    }
}

/**
 * Renders a preview section titled "All Products" showing a few recent products.
 * @returns {Promise<HTMLElement|null>} - The rendered section element or null.
 */
async function renderAllProductsSectionPreview() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Use grid style
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10)); // Limit for preview
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const isFav = state.favorites.includes(product.id);
            const card = createProductCardElement(product, isAdmin, isFav); // Use UI function
            productsGrid.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error("Error fetching preview for all products section:", error);
        return null;
    }
}

// --- Category Fetching ---

/**
 * Fetches main categories from Firestore and updates the global state.
 * Triggers UI updates for category-dependent elements.
 */
export async function fetchAndUpdateCategories() {
     try {
         const categoriesQuery = query(categoriesCollection, orderBy("order", "asc"));
         const snapshot = await getDocs(categoriesQuery);
         const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         state.categories = [{ id: 'all', icon: 'fas fa-th', name_ku_sorani: t('all_categories_label'), name_ku_badini: t('all_categories_label'), name_ar: t('all_categories_label') }, ...fetchedCategories]; // Add 'All' category with localized names

         updateCategoryDependentUI(); // Update dropdowns, main category buttons etc.

         return state.categories; // Return the fetched categories
     } catch (error) {
         console.error("Error fetching categories:", error);
         // Handle error appropriately, maybe show a message to the user
         return []; // Return empty array on error
     }
}


/**
 * Fetches and renders sub-subcategories for the subcategory detail page.
 * @param {string} mainCatId - The ID of the parent main category.
 * @param {string} subCatId - The ID of the parent subcategory.
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous content

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.style.display = 'none'; // Hide if no sub-subcategories
            return;
        }

        container.style.display = 'flex'; // Show the container

        // --- Add "All" Button ---
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // Start with 'All' active
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.action = 'filter-subsubcategory'; // Action for event listener
        allBtn.dataset.subSubcategoryId = 'all'; // Value for the action
        container.appendChild(allBtn);

        // --- Add Specific Sub-subcategory Buttons ---
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.action = 'filter-subsubcategory'; // Action for event listener
            btn.dataset.subSubcategoryId = subSubcat.id; // Value for the action

            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide on error
    }
}

/**
 * Fetches and renders products specifically for the subcategory detail page.
 * @param {string} subCatId - The ID of the parent subcategory.
 * @param {string} [subSubCatId='all'] - The ID of the selected sub-subcategory ('all' for no filter).
 * @param {string} [searchTerm=''] - The search term entered by the user.
 */
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    if (!productsContainer || !loader) return;

    loader.style.display = 'block';
    productsContainer.innerHTML = ''; // Clear previous products
    renderSkeletonLoader(productsContainer, 4); // Show skeleton loader

    try {
        let productsQuery = query(productsCollection);

        // --- Apply Category Filters ---
        if (subSubCatId === 'all') {
             // Filter only by the parent subcategory if 'All' is selected
             productsQuery = query(productsQuery, where("subcategoryId", "==", subCatId));
        } else {
             // Filter by the specific sub-subcategory
             productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
             // We still might want to ensure it belongs to the correct parent subcategory for data integrity,
             // though filtering by subSubcategoryId should be sufficient if data is consistent.
             // productsQuery = query(productsQuery, where("subcategoryId", "==", subCatId));
        }

        // --- Apply Search Term ---
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
             // Adjust ordering for search
             productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
             // Default ordering
             productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // --- Execute Query ---
        // No pagination needed for this specific view currently, load all matching
        const productSnapshot = await getDocs(productsQuery);

        // --- Render Results ---
        productsContainer.innerHTML = ''; // Clear skeleton loader
        if (productSnapshot.empty) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {default: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        } else {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const isFav = state.favorites.includes(product.id);
                const card = createProductCardElement(product, isAdmin, isFav); // Use UI function
                productsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (SubCat: ${subCatId}, SubSub: ${subSubCatId}, Search: "${searchTerm}"):`, error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_fetching_products', {default: 'هەڵەیەک ڕوویدا.'})}</p>`;
    } finally {
        loader.style.display = 'none'; // Hide loading indicator
    }
}