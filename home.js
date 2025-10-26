// home.js: Fonksiyonên taybet bi çêkirina rûpela sereke

// Import Firestore functions directly from Firebase SDK
import {
    collection, query, orderBy, getDocs, getDoc, doc, limit, where
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import necessary variables and shared functions
import {
    db, // Firestore instance
    state, // Global state (for language, slider intervals)
    promoGroupsCollection, // Collection references
    brandGroupsCollection,
    shortcutRowsCollection,
    productsCollection,
    homeLayoutCollection // Added home layout collection import
} from './app-setup.js';

import {
    createProductCardElement, // Card creation function
    createPromoCardElement,   // Promo Card creation function
    t,                        // Translation function
    navigateToFilter,         // Navigation function
    renderSkeletonLoader      // Skeleton loader utility
} from './app-logic.js';

// Function to render a single promo slider section
// Accepts groupId (which promo group to show) and layoutId (unique ID for this section instance)
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container promo-slider-container'; // Use a specific class
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID using layoutId

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            // Local state for this specific slider instance
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Create the initial card element
            const promoCardElement = createPromoCardElement(cardData, sliderState);
            promoGrid.appendChild(promoCardElement);

            // Setup automatic rotation only if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered for this layoutId
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId); // Clear this specific interval
                            // Ensure it's removed from global state if somehow still there
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element removed or interval cleared globally
                    }
                    // Proceed with rotation
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl; // Update image source
                };

                // Clear any previous interval associated with this specific layoutId
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                // Start new interval and store its ID in the global state using layoutId
                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                if (!state.sliderIntervals) state.sliderIntervals = {};
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid; // Return the created section element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId} (layout ${layoutId}):`, error);
    }
    return null; // Return null if error or no cards
}

// Function to render a brands section based on groupId
async function renderBrandsSection(groupId) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`; // Unique ID per group
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Don't render empty brand sections

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
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
                // Navigate based on linked category/subcategory
                if (brand.subcategoryId && brand.categoryId) {
                     // Assuming showSubcategoryDetailPage is exported or globally available
                    if (typeof showSubcategoryDetailPage === 'function') {
                         showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                    } else { // Fallback to navigateToFilter if detail page function unavailable
                        await navigateToFilter({
                            category: brand.categoryId,
                            subcategory: brand.subcategoryId,
                            subSubcategory: 'all',
                            search: ''
                         });
                    }
                } else if(brand.categoryId) {
                    await navigateToFilter({
                        category: brand.categoryId,
                        subcategory: 'all',
                        subSubcategory: 'all',
                        search: ''
                    });
                }
                // If no category linked, clicking does nothing for now
            };
            brandsContainer.appendChild(item);
        });
        return sectionContainer; // Return the created section
    } catch (error) {
        console.error(`Error fetching brands for group ${groupId}:`, error);
        return null;
    }
}

// Function to render the "Newest Products" section
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
        // Fetch products added in the last 15 days (adjust timeframe as needed)
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown horizontally
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null; // Do not render if there are no new products

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use shared function
            productsScroller.appendChild(card);
        });
        container.appendChild(productsScroller);
        return container; // Return the created section

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

// Function to render a section showing products from a specific category row
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani; // Default title from layout
    let targetDocRefPath; // Path to fetch the accurate category name

    // Determine the query field, value, and doc path based on the most specific ID
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
        console.warn("Single category row section is missing categoryId in layout config.");
        return null; // No category specified, cannot render
    }

    try {
        // Fetch the accurate name of the category/subcategory/subsubcategory
        if (targetDocRefPath) {
            const targetSnap = await getDoc(doc(db, targetDocRefPath));
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title; // Use fetched name if available
            }
        }

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        const header = document.createElement('div');
        header.className = 'section-title-header';
        const titleEl = document.createElement('h3');
        titleEl.className = 'section-title-main';
        titleEl.textContent = title; // Use the potentially updated title
        header.appendChild(titleEl);

        // Add "See All" link
        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
             // Navigate based on the most specific category ID available
             if(subcategoryId && categoryId) {
                  // If subcategory or subsubcategory is selected, go to the subcategory detail page
                  if (typeof showSubcategoryDetailPage === 'function') {
                      showSubcategoryDetailPage(categoryId, subcategoryId);
                  } else {
                      await navigateToFilter({ category: categoryId, subcategory: subcategoryId, subSubcategory: subSubcategoryId || 'all', search: '' });
                  }
             } else if (categoryId) {
                  // If only main category is selected, filter on the main page
                  await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
             }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        // Query for products in this category/subcategory/subsubcategory
        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Use the determined field and value
            orderBy('createdAt', 'desc'),
            limit(10) // Limit number shown horizontally
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use shared function
            productsScroller.appendChild(card);
        });
        return container; // Return the created section

    } catch (error) {
        console.error(`Error fetching products for single category row (${queryValue}):`, error);
        return null;
    }
}

// Function to render a section showing a specific shortcut row
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) {
            console.warn(`Shortcut row with ID ${rowId} not found.`);
            return null;
        }

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use name from layout config first, fallback to row's own title
        const rowTitle = sectionNameObj?.[state.currentLanguage] || rowData.title[state.currentLanguage] || rowData.title.ku_sorani;

        const titleElement = document.createElement('h3');
        titleElement.className = 'shortcut-row-title';
        titleElement.textContent = rowTitle;
        sectionContainer.appendChild(titleElement);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        // Fetch cards within this row
        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) return null; // Don't render empty rows

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('button'); // Use button for better accessibility
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                // Navigate to the linked category/subcategory/subsubcategory
                await navigateToFilter({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all',
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer; // Return the created section
    } catch (error) {
        console.error(`Error rendering single shortcut row ${rowId}:`, error);
        return null;
    }
}


// Function to render the final "All Products" section on the home page (shows initial few)
// Note: This is different from the main product grid used for filtering/searching
async function renderAllProductsSection() {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add space before this final section

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    const productsGrid = document.createElement('div');
    productsGrid.className = 'products-container'; // Use the main grid style
    container.appendChild(productsGrid);

    try {
        // Fetch only a small number of recent products for the preview on home
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(6)); // Limit to e.g., 6
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products exist

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use shared function
            productsGrid.appendChild(card);
        });
        return container; // Return the created section
    } catch (error) {
        console.error("Error fetching 'all products' preview for home page:", error);
        return null;
    }
}


// Main function to render the dynamic home page content based on Firestore layout
export async function renderHomePageContent() {
    // Prevent multiple concurrent renders
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const homeSkeletonLoader = document.getElementById('homeSkeletonLoader');

    if (!homeSectionsContainer || !homeSkeletonLoader) {
        console.error("Home page containers not found!");
        state.isRenderingHomePage = false;
        return;
    }

    try {
        renderSkeletonLoader(homeSkeletonLoader, 4); // Show skeleton loader in its specific container
        homeSectionsContainer.innerHTML = ''; // Clear previous dynamic content

        // --- Interval Cleanup ---
        // Clear any existing slider intervals before creating new ones
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset the intervals object
        // --- End Interval Cleanup ---

        // Fetch the enabled layout configuration, ordered correctly
        const layoutQuery = query(homeLayoutCollection, where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            homeSectionsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">لاپەڕەی سەرەکی ڕێکنەخراوە.</p>'; // User-friendly message
        } else {
            // Iterate through the layout config and render sections
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID
                        } else { console.warn("Promo slider section missing groupId:", doc.id); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section missing groupId:", doc.id); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                         if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name); // Pass layout name obj
                         } else { console.warn("Single shortcut row section missing rowId:", doc.id); }
                        break;
                    case 'single_category_row':
                         if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section); // Pass full section data
                         } else { console.warn("Single category row section missing categoryId:", doc.id); }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection();
                        break;
                    default:
                        console.warn(`Unknown home layout section type: ${section.type}`);
                }

                // Append the rendered section if it was created successfully
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            }
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_generic')}</p>`;
    } finally {
        homeSkeletonLoader.style.display = 'none'; // Hide skeleton loader
        state.isRenderingHomePage = false; // Reset flag
    }
}

