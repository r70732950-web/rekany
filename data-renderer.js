// MODULE: data-renderer.js
// Handles fetching data from Firestore and rendering it into the main UI areas.

import { db, state, productsCollection, categoriesCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, PRODUCTS_PER_PAGE } from './app-setup.js';
import { collection, doc, getDoc, getDocs, query, orderBy, limit, where, startAfter } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { t, renderSkeletonLoader, createProductCardElement, createPromoCardElement, setupScrollAnimations, showProductDetailsWithData, showPage } from './ui-manager.js';
import { navigateToFilter, updateHeaderView } from './app-core.js'; // Assuming navigation logic is in app-core

/**
 * Renders the current list of products (state.products) into the main products container.
 */
export function renderProducts() {
    const productsContainer = document.getElementById('productsContainer'); // Get container fresh
    if (!productsContainer) return;

    productsContainer.innerHTML = ''; // Clear previous products
    if (!state.products || state.products.length === 0) {
        // Optionally display a "no products found" message if needed, handled by search function for now
        return;
    }

    state.products.forEach(item => {
        let element = createProductCardElement(item); // Create card using UI function
        element.classList.add('product-card-reveal'); // Add animation class
        productsContainer.appendChild(element);
    });

    setupScrollAnimations(); // Set up animations for newly added cards
}

/**
 * Fetches products from Firestore based on current filters (category, search) and pagination.
 * Handles both initial search/filter and loading more products.
 * @param {string} [searchTerm=''] - The search term entered by the user.
 * @param {boolean} [isNewSearch=false] - Flag indicating if this is a fresh search/filter or loading more.
 */
export async function searchProductsInFirestore(searchTerm = state.currentSearch, isNewSearch = false) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const loader = document.getElementById('loader');
    const scrollTrigger = document.getElementById('scroll-loader-trigger');

    // Determine if the home page sections should be shown instead of the product list
    const shouldShowHomeSections = !searchTerm && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';

    if (shouldShowHomeSections) {
        productsContainer.style.display = 'none';
        skeletonLoader.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';

        // Render home page content if it's empty or needs refresh
        if (homeSectionsContainer.innerHTML.trim() === '' || isNewSearch) { // Render if empty or explicitly new search landed on home
            await renderHomePageContent();
        }
        return; // Stop further execution as we are showing the home page sections
    } else {
        // Hide home sections and stop their sliders if switching to product list view
        homeSectionsContainer.style.display = 'none';
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals
    }

    // --- Product Fetching Logic ---
    if (state.isLoadingMoreProducts && !isNewSearch) return; // Prevent concurrent loading

    if (isNewSearch) {
        state.allProductsLoaded = false;
        state.lastVisibleProductDoc = null;
        state.products = [];
        renderSkeletonLoader(skeletonLoader); // Show skeleton loader for new search/filter
        productsContainer.style.display = 'none'; // Hide product container during skeleton load
        scrollTrigger.style.display = 'none'; // Hide scroll trigger initially
    }

    // If all products are already loaded and we are not starting a new search, do nothing
    if (state.allProductsLoaded && !isNewSearch) return;

    state.isLoadingMoreProducts = true;
    loader.style.display = 'block'; // Show loading indicator at the bottom

    try {
        let productsQuery = collection(db, "products");

        // Apply category filters
        if (state.currentCategory && state.currentCategory !== 'all') {
            productsQuery = query(productsQuery, where("categoryId", "==", state.currentCategory));
        }
        if (state.currentSubcategory && state.currentSubcategory !== 'all') {
            productsQuery = query(productsQuery, where("subcategoryId", "==", state.currentSubcategory));
        }
         if (state.currentSubSubcategory && state.currentSubSubcategory !== 'all') {
             productsQuery = query(productsQuery, where("subSubcategoryId", "==", state.currentSubSubcategory));
         }

        // Apply search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Firestore requires the first orderBy to match the inequality field
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default sort order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Apply pagination (start after the last fetched document)
        if (state.lastVisibleProductDoc && !isNewSearch) {
            productsQuery = query(productsQuery, startAfter(state.lastVisibleProductDoc));
        }

        // Limit the number of results per page
        productsQuery = query(productsQuery, limit(PRODUCTS_PER_PAGE));

        const productSnapshot = await getDocs(productsQuery);
        const newProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (isNewSearch) {
            state.products = newProducts; // Replace existing products
        } else {
            state.products = [...state.products, ...newProducts]; // Append new products
        }

        // Check if all products have been loaded
        if (productSnapshot.docs.length < PRODUCTS_PER_PAGE) {
            state.allProductsLoaded = true;
            scrollTrigger.style.display = 'none'; // Hide trigger if no more products
        } else {
            state.allProductsLoaded = false;
            scrollTrigger.style.display = 'block'; // Show trigger to load more
            state.lastVisibleProductDoc = productSnapshot.docs[productSnapshot.docs.length - 1]; // Update last visible doc
        }

        // Render the fetched products
        renderProducts();

        // Display message if no products found for a new search
        if (state.products.length === 0 && isNewSearch) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('no_products_found')}</p>`; // Assuming key exists
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">${t('error_generic')}</p>`;
    } finally {
        state.isLoadingMoreProducts = false;
        loader.style.display = 'none'; // Hide bottom loader
        skeletonLoader.style.display = 'none'; // Hide skeleton loader
        productsContainer.style.display = 'grid'; // Ensure product container is visible
    }
}

/**
 * Renders the main category filter buttons.
 */
export function renderMainCategories() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear existing buttons

    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'main-category-btn';
        btn.dataset.category = cat.id; // Store category ID

        // Add 'active' class if this is the currently selected category
        if (state.currentCategory === cat.id) {
            btn.classList.add('active');
        }

        // Get category name in current language or fallback
        const categoryName = cat.id === 'all'
            ? t('all_categories_label') // Use translation for "All"
            : (cat['name_' + state.currentLanguage] || cat.name_ku_sorani);

        btn.innerHTML = `<i class="${cat.icon || 'fas fa-tag'}"></i> <span>${categoryName}</span>`; // Use default icon if none provided

        // Set click handler to navigate/filter
        btn.onclick = async () => {
            await navigateToFilter({ // navigateToFilter function from app-core
                category: cat.id,
                subcategory: 'all', // Reset subcategory when main category changes
                subSubcategory: 'all', // Reset sub-subcategory
                search: '' // Clear search when changing category
            });
        };

        container.appendChild(btn);
    });
}

/**
 * Renders the subcategory filter buttons based on the selected main category.
 * @param {string} categoryId - The ID of the currently selected main category.
 */
export async function renderSubcategories(categoryId) {
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    if (!subcategoriesContainer) return;
    subcategoriesContainer.innerHTML = ''; // Clear previous buttons
    subcategoriesContainer.style.display = 'none'; // Hide by default

    // Don't render subcategories if 'All' main categories is selected
    if (!categoryId || categoryId === 'all') {
        return;
    }

    try {
        const subcategoriesQueryRef = collection(db, "categories", categoryId, "subcategories");
        const q = query(subcategoriesQueryRef, orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedSubcategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Only show the subcategory bar if there are subcategories
        if (fetchedSubcategories.length === 0) return;

        subcategoriesContainer.style.display = 'flex'; // Show the container

        // Create "All" button for subcategories
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `
            <div class="subcategory-image">${allIconSvg}</div>
            <span>${t('all_categories_label')}</span>`;
        allBtn.onclick = async () => {
            // Navigate to filter with 'all' subcategory
            await navigateToFilter({
                subcategory: 'all',
                subSubcategory: 'all' // Reset sub-sub as well
            });
        };
        subcategoriesContainer.appendChild(allBtn);

        // Create buttons for each subcategory
        fetchedSubcategories.forEach(subcat => {
            const subcatBtn = document.createElement('button');
            subcatBtn.className = `subcategory-btn ${state.currentSubcategory === subcat.id ? 'active' : ''}`;

            const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subcat.imageUrl || placeholderImg;

            subcatBtn.innerHTML = `
                <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <span>${subcatName}</span>`;

            // On click, navigate to the subcategory detail page
            subcatBtn.onclick = () => {
                showSubcategoryDetailPage(categoryId, subcat.id); // Call function to show detail page
            };
            subcategoriesContainer.appendChild(subcatBtn);
        });

    } catch (error) {
        console.error("Error fetching subcategories: ", error);
        // Optionally display an error message in the subcategory container
    }
}


/**
 * Fetches product data and displays the product details sheet.
 * @param {string} productId - The ID of the product to show.
 */
export async function showProductDetails(productId) {
    // Try finding the product in the already loaded state first
    const productFromState = state.products.find(p => p.id === productId);

    if (productFromState) {
        showProductDetailsWithData(productFromState); // Use UI function to display
        return;
    }

    // If not found in state, fetch from Firestore
    console.log("Product not found in local state. Fetching from Firestore...");
    try {
        const productRef = doc(db, "products", productId);
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const fetchedProduct = { id: docSnap.id, ...docSnap.data() };
            showProductDetailsWithData(fetchedProduct); // Use UI function to display
        } else {
            console.error(`Product with ID ${productId} not found in Firestore.`);
            showNotification(t('product_not_found_error'), 'error'); // Use UI function for notification
        }
    } catch (error) {
        console.error("Error fetching product details:", error);
        showNotification(t('error_generic'), 'error');
    }
}

/**
 * Fetches and renders related products based on the current product's category.
 * @param {object} currentProduct - The product currently being viewed.
 */
export async function renderRelatedProducts(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    if (!section || !container) return;

    container.innerHTML = ''; // Clear previous related products
    section.style.display = 'none'; // Hide section initially

    // Determine the most specific category to query by
    let queryField, queryValue;
    if (currentProduct.subSubcategoryId) {
        queryField = 'subSubcategoryId';
        queryValue = currentProduct.subSubcategoryId;
    } else if (currentProduct.subcategoryId) {
        queryField = 'subcategoryId';
        queryValue = currentProduct.subcategoryId;
    } else if (currentProduct.categoryId) {
        queryField = 'categoryId';
        queryValue = currentProduct.categoryId;
    } else {
        return; // Cannot find related products without any category info
    }

    try {
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            where('__name__', '!=', currentProduct.id), // Exclude the current product itself
            limit(8) // Limit the number of related products
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No related products found.");
            return; // Don't show the section if no related products
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function to create card
            container.appendChild(card);
        });

        section.style.display = 'block'; // Show the related products section

    } catch (error) {
        console.error("Error fetching related products:", error);
        // Optionally hide the section or show an error message
    }
}

/**
 * Renders the dynamic sections of the home page based on Firestore configuration.
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
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton while loading layout
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up any existing slider intervals before rendering new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object

        // Fetch enabled layout sections ordered by 'order'
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('home_layout_not_configured')}</p>`; // Assuming key exists
        } else {
            // Iterate through layout sections and render corresponding content
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID for interval management
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
                        sectionElement = await renderAllProductsSection(); // Renders a preview grid
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement); // Add the rendered section to the page
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_rendering_home')}</p>`; // Assuming key exists
    } finally {
        state.isRenderingHomePage = false;
        // Skeleton loader is cleared automatically when content is added or error message is set.
    }
}

/**
 * Fetches and renders a specific promo card slider section for the home page.
 * Manages the automatic slide rotation interval.
 * @param {string} groupId - The ID of the promo group to render.
 * @param {string} layoutId - The unique ID of this layout item (for interval management).
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGridContainer = document.createElement('div');
    promoGridContainer.className = 'products-container'; // Reuse grid styles for layout consistency
    promoGridContainer.style.marginBottom = '24px'; // Add spacing below slider
    promoGridContainer.id = `promoSliderLayout_${layoutId}`; // Unique ID for interval management

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null }; // Local state for this slider instance
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the initial card element
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Pass local state
            promoGridContainer.appendChild(promoCardElement);

            // Set up automatic rotation if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered
                    if (!document.getElementById(promoGridContainer.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear the local interval reference
                            // Remove from global state if it's there (safety check)
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element removed or interval cleared globally
                    }
                    // Advance index and update image
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if (imgElement) imgElement.src = newImageUrl;
                };

                // Clear any previous interval associated with this layoutId in the global state
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID both locally and globally
                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize global state if needed
                state.sliderIntervals[layoutId] = sliderState.intervalId; // Store globally by layoutId
            }

            return promoGridContainer; // Return the container with the slider
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if error or no cards
}

/**
 * Fetches and renders a horizontal scrolling section of brand logos.
 * @param {string} groupId - The ID of the brand group to render.
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section'; // Apply specific styling
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container'; // Horizontal scroll container
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30)); // Limit number shown
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'brand-item'; // Styling for individual brand
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl}" alt="${brandName}" loading="lazy" class="brand-image">
                </div>
                <span>${brandName}</span>`;

            // Add click handler to navigate to the linked category/subcategory
            item.onclick = async () => {
                if (brand.subcategoryId && brand.categoryId) {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId); // Go to detail page
                } else if (brand.categoryId) {
                    await navigateToFilter({ // Filter on main page
                        category: brand.categoryId,
                        subcategory: 'all', subSubcategory: 'all', search: ''
                    });
                }
                // If no category linked, clicking does nothing
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer; // Return the fully constructed section
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

/**
 * Fetches and renders a horizontal scrolling section of the newest products.
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderNewestProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section'; // General section styling
    const header = document.createElement('div');
    header.className = 'section-title-header'; // Header with title and optional "See All"
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products'); // Use translation for title
    header.appendChild(title);
    // Optionally add a "See All" link for newest products if needed
    container.appendChild(header);

    try {
        // Query for products created within the last N days (e.g., 15 days)
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown on home page
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if no new products

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container'; // Horizontal scroll
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Create card using UI function
            productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container; // Return the section

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}


/**
 * Fetches and renders a single horizontal row of shortcut cards.
 * @param {string} rowId - The ID of the shortcut row document.
 * @param {object} sectionNameObj - The multilingual name object for the section title from layout data.
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section'; // Apply specific styling

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null; // Row not found

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use name from layout if available, otherwise fallback to row title
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage]) || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        // Add section title
        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        // Container for the cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container'; // Horizontal scroll
        sectionContainer.appendChild(cardsContainer);

        // Fetch cards within this row
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) return null; // Don't render empty rows

        // Create and append each card
        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div'); // Using div instead of button for better structure
            item.className = 'shortcut-card'; // Styling for shortcut card
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>`;

            // Add click handler to navigate to the linked category/subcategory/subsubcategory
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

        return sectionContainer; // Return the complete section
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}

/**
 * Fetches and renders a single horizontal row of products from a specific category/subcategory/subsubcategory.
 * @param {object} sectionData - Data from the home_layout document for this section.
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = (name && name[state.currentLanguage]) || (name && name.ku_sorani) || t('category_products'); // Default title
    let targetDocRef; // To fetch the actual category name

    // Determine the most specific category level to filter by and fetch name from
    if (subSubcategoryId && subcategoryId && categoryId) {
        queryField = 'subSubcategoryId';
        queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId && categoryId) {
        queryField = 'subcategoryId';
        queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId';
        queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else {
        console.warn("Single category row section is missing necessary category IDs.");
        return null; // Cannot render without at least categoryId
    }

    try {
        // Attempt to fetch the actual name of the category/sub/subsub
        if (targetDocRef) {
            const targetSnap = await getDoc(targetDocRef);
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title; // Update title if found
            }
        }

        // Create section container and header
        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Use potentially updated title
        header.appendChild(titleEl);

        // Add "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID
            if (subcategoryId && categoryId) {
                // If subcategory or subsubcategory is specified, go to the subcategory detail page
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else if (categoryId) {
                // If only main category is specified, filter on the main page
                await navigateToFilter({
                    category: categoryId, subcategory: 'all', subSubcategory: 'all', search: ''
                });
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        // Create horizontal scroller for products
        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Fetch products matching the category filter
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Filter by the determined field/value
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown on home page
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render if no products found

        // Create and append product cards
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            productsScroller.appendChild(card);
        });
        return container; // Return the complete section

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

/**
 * Renders a grid section showing a preview of "All Products".
 * @returns {Promise<HTMLElement|null>} The rendered section element or null if error/empty.
 */
export async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add spacing

    // Add section header
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title'); // Use translation
    header.appendChild(title);
    // Optionally add a "See All" link that just resets filters
    // const seeAllLink = document.createElement('a'); ... seeAllLink.onclick = () => navigateToFilter({ category: 'all', ... }); header.appendChild(seeAllLink);
    container.appendChild(header);

    // Create grid container for products
    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Use existing grid style
    container.appendChild(productsGrid);

    try {
        // Fetch a limited number of recent products for the preview
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(8)); // Limit preview size
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products exist

        // Create and append product cards
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use UI function
            productsGrid.appendChild(card);
        });
        return container; // Return the complete section
    } catch (error) {
        console.error("Error fetching 'all products' preview for home page:", error);
        return null;
    }
}

/**
 * Shows the dedicated page for a subcategory, rendering its sub-subcategories and products.
 * @param {string} mainCatId - The ID of the parent main category.
 * @param {string} subCatId - The ID of the subcategory to display.
 * @param {boolean} [fromHistory=false] - Indicates if navigation is due to browser back/forward.
 */
export async function showSubcategoryDetailPage(mainCatId, subCatId, fromHistory = false) {
    let subCatName = 'Details'; // Default title
    try {
        // Fetch the subcategory name for the header title
        const subCatRef = doc(db, "categories", mainCatId, "subcategories", subCatId);
        const subCatSnap = await getDoc(subCatRef);
        if (subCatSnap.exists()) {
            const subCat = subCatSnap.data();
            subCatName = subCat['name_' + state.currentLanguage] || subCat.name_ku_sorani || 'Details';
        }
    } catch (e) {
        console.error("Could not fetch subcategory name:", e);
    }

    // Push state to history if not navigating from back/forward
    if (!fromHistory) {
        history.pushState({ type: 'page', id: 'subcategoryDetailPage', title: subCatName, mainCatId: mainCatId, subCatId: subCatId }, '', `#subcategory_${mainCatId}_${subCatId}`);
    }

    // Show the detail page UI
    showPage('subcategoryDetailPage', subCatName); // Use UI function

    // Get references to page elements
    const detailPageLoader = document.getElementById('detailPageLoader');
    const detailProductsContainer = document.getElementById('productsContainerOnDetailPage');
    const detailSubSubContainer = document.getElementById('subSubCategoryContainerOnDetailPage');
    const subpageSearchInput = document.getElementById('subpageSearchInput');
    const subpageClearSearchBtn = document.getElementById('subpageClearSearchBtn');

    // Show loader and clear previous content
    if (detailPageLoader) detailPageLoader.style.display = 'block';
    if (detailProductsContainer) detailProductsContainer.innerHTML = '';
    if (detailSubSubContainer) detailSubSubContainer.innerHTML = '';

    // Reset search bar on this page
    if (subpageSearchInput) subpageSearchInput.value = '';
    if (subpageClearSearchBtn) subpageClearSearchBtn.style.display = 'none';

    // Render the content (sub-subcategories and initial products)
    await renderSubSubcategoriesOnDetailPage(mainCatId, subCatId); // Render filter buttons first
    await renderProductsOnDetailPage(subCatId, 'all', ''); // Render products for 'all' sub-sub initially

    // Hide loader after content is rendered
    if (detailPageLoader) detailPageLoader.style.display = 'none';
}

/**
 * Renders the sub-subcategory filter buttons on the subcategory detail page.
 * @param {string} mainCatId - Parent main category ID.
 * @param {string} subCatId - Parent subcategory ID.
 */
export async function renderSubSubcategoriesOnDetailPage(mainCatId, subCatId) {
    const container = document.getElementById('subSubCategoryContainerOnDetailPage');
    if (!container) return;
    container.innerHTML = ''; // Clear previous
    container.style.display = 'none'; // Hide by default

    try {
        const ref = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
        const q = query(ref, orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        // Only show if sub-subcategories exist
        if (snapshot.empty) return;

        container.style.display = 'flex'; // Show container

        // Create "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `subcategory-btn active`; // 'All' is active initially
        const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
        allBtn.innerHTML = `<div class="subcategory-image">${allIconSvg}</div><span>${t('all_categories_label')}</span>`;
        allBtn.dataset.id = 'all'; // Mark as 'all' button
        allBtn.onclick = () => {
            // Deactivate other buttons, activate this one
            container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            // Re-render products for 'all' sub-subcategories, preserving search term
            const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
            renderProductsOnDetailPage(subCatId, 'all', currentSearch);
        };
        container.appendChild(allBtn);

        // Create buttons for each sub-subcategory
        snapshot.forEach(doc => {
            const subSubcat = { id: doc.id, ...doc.data() };
            const btn = document.createElement('button');
            btn.className = `subcategory-btn`;
            btn.dataset.id = subSubcat.id; // Store ID

            const subSubcatName = subSubcat['name_' + state.currentLanguage] || subSubcat.name_ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            const imageUrl = subSubcat.imageUrl || placeholderImg;
            btn.innerHTML = `<img src="${imageUrl}" alt="${subSubcatName}" class="subcategory-image" loading="lazy" onerror="this.src='${placeholderImg}';"><span>${subSubcatName}</span>`;

            btn.onclick = () => {
                // Deactivate other buttons, activate this one
                container.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Re-render products for this specific sub-subcategory, preserving search term
                const currentSearch = document.getElementById('subpageSearchInput')?.value || '';
                renderProductsOnDetailPage(subCatId, subSubcat.id, currentSearch);
            };
            container.appendChild(btn);
        });

    } catch (error) {
        console.error("Error fetching sub-subcategories for detail page:", error);
        container.style.display = 'none'; // Hide if error
    }
}

/**
 * Renders products specifically for the subcategory detail page based on selected sub-subcategory and search term.
 * @param {string} subCatId - The parent subcategory ID.
 * @param {string} [subSubCatId='all'] - The selected sub-subcategory ID ('all' for no filter).
 * @param {string} [searchTerm=''] - The current search term.
 */
export async function renderProductsOnDetailPage(subCatId, subSubCatId = 'all', searchTerm = '') {
    const productsContainer = document.getElementById('productsContainerOnDetailPage');
    const loader = document.getElementById('detailPageLoader');
    if (!productsContainer || !loader) return;

    loader.style.display = 'block'; // Show loader
    productsContainer.innerHTML = ''; // Clear previous products

    try {
        let productsQuery;
        // Base query: filter by parent subcategory
        productsQuery = query(productsCollection, where("subcategoryId", "==", subCatId));

        // Add sub-subcategory filter if not 'all'
        if (subSubCatId !== 'all') {
            productsQuery = query(productsQuery, where("subSubcategoryId", "==", subSubCatId));
        }

        // Add search term filter
        const finalSearchTerm = searchTerm.trim().toLowerCase();
        if (finalSearchTerm) {
            productsQuery = query(productsQuery,
                where('searchableName', '>=', finalSearchTerm),
                where('searchableName', '<=', finalSearchTerm + '\uf8ff')
            );
            // Firestore requires the first orderBy to match the inequality field
            productsQuery = query(productsQuery, orderBy("searchableName", "asc"), orderBy("createdAt", "desc"));
        } else {
            // Default sort order when not searching
            productsQuery = query(productsQuery, orderBy("createdAt", "desc"));
        }

        // Execute query
        const productSnapshot = await getDocs(productsQuery);

        if (productSnapshot.empty) {
            productsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('no_products_found')}</p>`;
        } else {
            productSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Use UI function
                productsContainer.appendChild(card);
            });
            setupScrollAnimations(); // Apply animations
        }
    } catch (error) {
        console.error(`Error fetching products for detail page (subCatId: ${subCatId}, subSubCatId: ${subSubCatId}, searchTerm: "${searchTerm}"):`, error);
        productsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">${t('error_generic')}</p>`;
    } finally {
        loader.style.display = 'none'; // Hide loader
    }
}

// Add other data rendering functions here...