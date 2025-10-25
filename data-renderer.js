// data-renderer.js - Responsible for fetching and rendering Firestore data (products, categories, layout sections), search, infinite scroll.
import {
    db, state, productsCollection, categoriesCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, // Firestore collections
    PRODUCTS_PER_PAGE, // Constants
    productsContainer, skeletonLoader, loader, // DOM Elements for product list
} from './app-setup.js';

import {
    collection, query, orderBy, limit, getDocs, getDoc, doc, where, startAfter
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { // Import UI functions needed for rendering
    t, createProductCardElement, createPromoCardElement, renderSkeletonLoader, setupScrollAnimations
} from './ui-manager.js';

// --- Product Fetching and Rendering ---

/**
 * Renders the current list of products in the main container.
 * Requires actions object to be passed for card interactions.
 * @param {object} actions - Object containing action functions needed by createProductCardElement.
 */
export function renderProducts(actions) {
    if (!productsContainer) return;
    productsContainer.innerHTML = ''; // Clear previous products

    if (!state.products || state.products.length === 0) {
        // If it's not the initial load (skeleton is hidden), show a message
        if (skeletonLoader && skeletonLoader.style.display === 'none') {
             productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {default: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        }
        return;
    }

    state.products.forEach(item => {
        // Pass the actions object to the card creation function
        const element = createProductCardElement(item, actions);
        if (element) {
            element.classList.add('product-card-reveal'); // Add class for animation
            productsContainer.appendChild(element);
        } else {
            console.warn("Failed to create product card element for:", item);
        }
    });

    setupScrollAnimations(); // Re-apply scroll animations for newly added cards
}

/**
 * Fetches products from Firestore based on current filters, search term, and pagination state.
 * @param {string} [searchTerm=''] - The search term entered by the user.
 * @param {boolean} [isNewSearch=false] - Flag indicating if this is a fresh search or loading more.
 * @param {object} actions - Object containing action functions for product cards.
 * @param {Function} renderHomePageContentFn - Function to render home page content if applicable.
 */
export async function searchProductsInFirestore(searchTerm = '', isNewSearch = false, actions, renderHomePageContentFn) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Determine if we should show the home page sections or the product list
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        if (productsContainer) productsContainer.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        if (scrollTrigger) scrollTrigger.style.display = 'none';
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'block';

        // Render home page content if it's not already rendered or if it's a new 'search' (navigation to home)
        if (homeSectionsContainer && (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch)) {
            await renderHomePageContentFn(); // Call the function passed from app-logic
        }
        return; // Stop further execution for home page view
    } else {
        // Hide home sections and potentially stop sliders (handled in ui-manager now)
        if (homeSectionsContainer) homeSectionsContainer.style.display = 'none';
    }

    // Cache logic (optional, can be complex to manage updates)
    // const cacheKey = `${state.currentCategory}-${state.currentSubcategory}-${state.currentSubSubcategory}-${searchTerm.trim().toLowerCase()}`;
    // if (isNewSearch && state.productCache && state.productCache[cacheKey]) { ... }

    if (state.isLoadingMoreProducts && !isNewSearch) return; // Prevent concurrent loads

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = []; // Clear current products
        renderSkeletonLoader(); // Show loading state
    }

    // Don't fetch more if all are loaded unless it's a new search
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    if (loader) loader.style.display = isNewSearch ? 'none' : 'block'; // Show bottom loader only when loading more
    if (scrollTrigger) scrollTrigger.style.display = 'none'; // Hide trigger while loading

    try {
        let productsQuery = collection(db, "products");
        let queryConstraints = [];

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            queryConstraints.push(where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            queryConstraints.push(where("subcategoryId", "==", state.currentSubcategory));
        }
        if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
            queryConstraints.push(where("subSubcategoryId", "==", state.currentSubSubcategory));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            // Firestore range query for prefix search (requires searchableName field)
            queryConstraints.push(where('searchableName', '>=', finalSearchTerm));
            queryConstraints.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
        }

        // Apply ordering - IMPORTANT: First orderBy must match the inequality field if searching
        if (finalSearchTerm) {
             queryConstraints.push(orderBy("searchableName", "asc")); // Match inequality
             queryConstraints.push(orderBy("createdAt", "desc")); // Secondary sort
        } else {
             queryConstraints.push(orderBy("createdAt", "desc")); // Default sort
        }

        // Apply pagination (startAfter)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            queryConstraints.push(startAfter(state.lastVisibleProductDoc));
        }

        // Apply limit
        queryConstraints.push(limit(PRODUCTS_PER_PAGE));

        // Construct the final query
        const finalQuery = query(productsQuery, ...queryConstraints);

        const productSnapshot = await getDocs(finalQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Append or replace products in state
        if (isNewSearch) {
            state.products = newProducts;
        } else {
            state.products = [...state.products, ...newProducts];
        }

        // Update pagination state
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
        } else {
            state.allProductsLoaded = false;
            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1];
        }

        // Update UI
        renderProducts(actions); // Render the fetched products using the UI function

        if (state.products.length === 0 && isNewSearch) {
             if (productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found', {default: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        }

    } catch (error) {
        console.error("Error fetching products:", error);
         if (productsContainer) productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_fetching_products', {default: 'هەڵەیەک لە هێنانی کاڵاکان ڕوویدا.'})}</p>`;
        state.allProductsLoaded = true; // Stop trying to load more on error
    } finally {
        state.isLoadingMoreProducts = false;
        if (loader) loader.style.display = 'none';
        if (skeletonLoader) skeletonLoader.style.display = 'none'; // Ensure skeleton is hidden
        if (productsContainer) productsContainer.style.display = 'grid'; // Ensure product grid is visible
        if (scrollTrigger) scrollTrigger.style.display = state.allProductsLoaded ? 'none' : 'block'; // Show/hide trigger
    }
}

/**
 * Fetches and renders products specifically for the subcategory detail page.
 * @param {string} subCatId - The ID of the parent subcategory.
 * @param {string} [subSubCatId='all'] - The specific sub-subcategory ID or 'all'.
 * @param {string} [searchTerm=''] - Optional search term.
 * @param {object} actions - Actions object for product cards.
 */
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '', actions) {
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailLoader = document.getElementById('detailPageLoader');
    if (!detailProductsContainer || !detailLoader) return;

    detailLoader.style.display = 'block';
    detailProductsContainer.innerHTML = ''; // Clear previous

    try {
        let productConstraints = [];

        // Filter by subcategory or sub-subcategory
        if (subSubCatId === 'all') {
            productConstraints.push(where("subcategoryId", "==", subCatId));
        } else {
            productConstraints.push(where("subSubcategoryId", "==", subSubCatId));
        }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productConstraints.push(where('searchableName', '>=', finalSearchTerm));
            productConstraints.push(where('searchableName', '<=', finalSearchTerm + '\uf8ff'));
            // Order by searchableName first when searching
            productConstraints.push(orderBy("searchableName", "asc"));
            productConstraints.push(orderBy("createdAt", "desc")); // Secondary sort
        } else {
            // Default sort when not searching
            productConstraints.push(orderBy("createdAt", "desc"));
        }

        const finalQuery = query(collection(db, "products"), ...productConstraints);
        const productSnapshot = await getDocs(finalQuery);

        if (productSnapshot.empty) {
            detailProductsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('no_products_found', {default: 'هیچ کاڵایەک نەدۆزرایەوە.'})}</p>`;
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product, actions); // Use UI function
                if (card) detailProductsContainer.appendChild(card);
            });
             setupScrollAnimations(); // Apply animations for detail page results
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        detailProductsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_fetching_products', {default: 'هەڵەیەک لە هێنانی کاڵاکان ڕوویدا.'})}</p>`;
    } finally {
        detailLoader.style.display = 'none';
    }
}


// --- Home Page Section Rendering ---

/**
 * Renders a specific section for the home page based on layout configuration.
 * @param {object} section - The layout configuration for this section.
 * @param {string} layoutId - The unique ID of this layout item (for slider intervals).
 * @param {object} actions - Object containing necessary actions for elements (e.g., navigateToFilter, product card actions).
 * @returns {Promise<HTMLElement|null>} A promise resolving to the section's HTML element or null.
 */
async function renderHomePageSection(section, layoutId, actions) {
    let sectionElement = null;

    try {
        switch (section.type) {
            case 'promo_slider':
                if (section.groupId) {
                    sectionElement = await renderPromoCardsSectionForHome(section.groupId, layoutId, actions.navigateToFilter);
                } else { console.warn("Promo slider section missing groupId."); }
                break;
            case 'brands':
                if (section.groupId) {
                    sectionElement = await renderBrandsSection(section.groupId, actions.navigateToFilter, actions.showSubcategoryDetailPage);
                } else { console.warn("Brands section missing groupId."); }
                break;
            case 'newest_products':
                sectionElement = await renderNewestProductsSection(actions);
                break;
            case 'single_shortcut_row':
                if (section.rowId) {
                    sectionElement = await renderSingleShortcutRow(section.rowId, section.name, actions.navigateToFilter);
                } else { console.warn("Single shortcut row section missing rowId."); }
                break;
            case 'single_category_row':
                if (section.categoryId) {
                    sectionElement = await renderSingleCategoryRow(section, actions);
                } else { console.warn("Single category row section missing categoryId."); }
                break;
            case 'all_products':
                // The 'all_products' section is typically just the main product grid,
                // handled by searchProductsInFirestore, so we might not render a separate element here.
                // Or, if intended as a specific preview on home, implement renderAllProductsSectionPreview.
                // For now, let's assume it signifies the end of specific sections.
                console.log("Skipping 'all_products' section rendering, handled by main grid.");
                break;
            default:
                console.warn(`Unknown home layout section type: ${section.type}`);
        }
    } catch (error) {
         console.error(`Error rendering section type ${section.type} (layoutId: ${layoutId}):`, error);
         // Optionally return a placeholder error element
         // sectionElement = document.createElement('div');
         // sectionElement.textContent = `Error loading ${section.type} section.`;
         // sectionElement.style.color = 'red';
         // sectionElement.style.padding = '10px';
    }

    return sectionElement;
}


/**
 * Fetches layout config and renders all enabled home page sections.
 * Needs actions object passed down.
 * @param {object} actions - Actions needed for rendering sections and their contents.
 */
export async function renderHomePageContent(actions) {
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
        state.isRenderingHomePage = false;
        return;
    }

    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show loading state
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // --- Slider Interval Cleanup ---
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {};
        // --- End Cleanup ---

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = `<p style="text-align:center; padding:20px;">${t('home_layout_not_configured', {default: 'لاپەڕەی سەرەکی ڕێکنەخراوە.'})}</p>`;
        } else {
            // Use Promise.all to fetch/render sections concurrently (if possible)
            const sectionPromises = layoutSnapshot.docs.map(doc => renderHomePageSection({ id: doc.id, ...doc.data() }, doc.id, actions));
            const renderedSections = await Promise.all(sectionPromises);

            // Append rendered sections in the correct order
            renderedSections.forEach(sectionElement => {
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            });
             setupScrollAnimations(); // Apply animations after sections are added
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_loading_home', {default: 'هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.'})}</p>`;
    } finally {
        state.isRenderingHomePage = false;
         // Hide skeleton loader if it was the target container
         if (homeSectionsContainer === skeletonLoader) {
             skeletonLoader.style.display = 'none';
         }
    }
}

/**
 * Renders the promo card slider section.
 * @param {string} groupId - ID of the promo group.
 * @param {string} layoutId - Unique ID for this instance in the layout (for interval management).
 * @param {Function} navigateToFilter - Function for navigation.
 * @returns {Promise<HTMLElement|null>} The section element or null.
 */
async function renderPromoCardsSectionForHome(groupId, layoutId, navigateToFilter) {
    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };

            // createPromoCardElement now returns the container (.promo-slider-container)
            const promoSectionElement = createPromoCardElement(cardData, sliderState, navigateToFilter);

            if (!promoSectionElement) return null; // Guard if element creation failed

             // Unique ID for the container div returned by createPromoCardElement
            promoSectionElement.id = `promoSliderLayout_${layoutId}`;

            // --- Auto Rotation Interval ---
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered
                    if (!document.getElementById(promoSectionElement.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            // Clean up global state if needed (though it should be cleaned elsewhere too)
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return;
                    }
                    // Find the next button within this specific slider instance and click it
                    const nextButton = promoSectionElement.querySelector('.promo-slider-btn.next');
                    if (nextButton) {
                        nextButton.click(); // Simulate click to use existing update logic
                    } else {
                        // Fallback logic if button isn't found (shouldn't happen)
                        sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                         // Manually update image (less ideal as it duplicates logic)
                         const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                         const imgElement = promoSectionElement.querySelector('.product-image');
                         if(imgElement) imgElement.src = newImageUrl;
                    }
                };

                // Clear previous interval for this specific layoutId if it exists
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000); // 5 seconds rotation
                // Store interval ID in the global state object using layoutId as key
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
             // --- End Auto Rotation Interval ---

            return promoSectionElement; // Return the container div
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId} (layoutId: ${layoutId}):`, error);
    }
    return null; // Return null on error or if no cards
}


/**
 * Renders the brands section.
 * @param {string} groupId - ID of the brand group.
 * @param {Function} navigateToFilter - Function for navigation.
 * @param {Function} showSubcategoryDetailPage - Function to show detail page.
 * @returns {Promise<HTMLElement|null>} The section element or null.
 */
async function renderBrandsSection(groupId, navigateToFilter, showSubcategoryDetailPage) {
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
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl || 'https://placehold.co/65x65/e2e8f0/2d3748?text=Brand'}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.src='https://placehold.co/65x65/e2e8f0/2d3748?text=Err'">
                </div>
                <span>${brandName}</span>
            `;
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if (brand.categoryId) {
                    await navigateToFilter({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                }
            };
            brandsContainer.appendChild(item);
        });
        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

/**
 * Renders the newest products section (horizontal scroll).
 * @param {object} actions - Actions for product cards.
 * @returns {Promise<HTMLElement|null>} The section element or null.
 */
async function renderNewestProductsSection(actions) {
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
            limit(10) // Limit for horizontal scroll
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if no new products

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product, actions); // Use UI function
             if (card) productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container;
    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

/**
 * Renders a single shortcut row section (horizontal scroll).
 * @param {string} rowId - ID of the shortcut row.
 * @param {object} sectionNameObj - The name object from layout config.
 * @param {Function} navigateToFilter - Function for navigation.
 * @returns {Promise<HTMLElement|null>} The section element or null.
 */
async function renderSingleShortcutRow(rowId, sectionNameObj, navigateToFilter) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use layout name if available, fallback to row title
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

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
            item.innerHTML = `
                <img src="${cardData.imageUrl || 'https://placehold.co/100x100/e2e8f0/2d3748?text=Card'}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.src='https://placehold.co/100x100/e2e8f0/2d3748?text=Err'">
                <div class="shortcut-card-name">${cardName}</div>
            `;
            item.onclick = async () => {
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainer.appendChild(item);
        });
        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

/**
 * Renders a section with products from a single category (horizontal scroll).
 * @param {object} sectionData - Layout data including category IDs and name.
 * @param {object} actions - Actions for product cards and navigation.
 * @returns {Promise<HTMLElement|null>} The section element or null.
 */
async function renderSingleCategoryRow(sectionData, actions) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani) || t('category'); // Fallback title
    let targetDocRefPath;

    // Determine query and title source based on specificity
    if (subSubcategoryId && subcategoryId && categoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`;
    } else if (subcategoryId && categoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRefPath = `categories/${categoryId}/subcategories/${subcategoryId}`;
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRefPath = `categories/${categoryId}`;
    } else {
        return null; // Cannot render without at least a categoryId
    }

    try {
        // Fetch the specific category/sub/subsub name for a more accurate title
        const targetSnap = await getDoc(doc(db, targetDocRefPath));
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title; // Use fetched name if available
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Use potentially updated title
        header.appendChild(titleEl);

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => { // Navigate based on the most specific category
            if (subcategoryId && categoryId) {
                actions.showSubcategoryDetailPage(categoryId, subcategoryId);
            } else if (categoryId) {
                await actions.navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Fetch products for this category/sub/subsub
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit for horizontal scroll
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render empty rows

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product, actions); // Use UI function
             if (card) productsScroller.appendChild(card);
        });
        return container;
    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

// --- Infinite Scroll ---

/**
 * Sets up the Intersection Observer for infinite scrolling.
 * Requires `searchProductsInFirestore` to be passed or accessible.
 * @param {Function} loadMoreFn - The function to call when the trigger is intersected (likely searchProductsInFirestore).
 */
export function setupScrollObserver(loadMoreFn) {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Load more if trigger is intersecting, not already loading, and not all loaded
        if (entries[0].isIntersecting && !state.isLoadingMoreProducts && !state.allProductsLoaded) {
             loadMoreFn(state.currentSearch, false); // Call the passed function to load next page
        }
    }, {
        root: null, // Use viewport
        threshold: 0.1 // Trigger early
    });

    observer.observe(trigger);
}
