// home.js: Functions specific to rendering the home page content

import { db, collection, query, orderBy, getDocs, doc, getDoc, where, limit } from './app-setup.js';
import { state, t, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection, productsCollection } from './app-setup.js';
// Import necessary functions from app-logic
import { createProductCardElement, createPromoCardElement, navigateToFilter, showSubcategoryDetailPage } from './app-logic.js';

// Function to render a single shortcut row section
async function renderSingleShortcutRow(rowId, sectionNameObj) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
        // Use section name from layout if available, otherwise fallback to row name
        const rowTitle = (sectionNameObj && (sectionNameObj[state.currentLanguage] || sectionNameObj.ku_sorani))
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

        if (cardsSnapshot.empty) {
            return null; // Don't render empty rows
        }

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl}" alt="${cardName}" class="shortcut-card-image" loading="lazy">
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

// Function to render a section displaying products from a single category/subcategory
async function renderSingleCategoryRow(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRef;

    // Determine the query field and value based on the most specific ID provided
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
        return null; // No category specified, cannot render
    }

    try {
        // Fetch the name of the category/subcategory/subsubcategory for the title if available
        if (targetDocRef) {
             const targetSnap = await getDoc(targetDocRef);
             if (targetSnap.exists()) {
                 const targetData = targetSnap.data();
                 // Use the fetched name if available, otherwise fallback to the name from layout data
                 title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || title;
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

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Navigate based on the most specific category ID
            if(subcategoryId) {
                // If subcategory or subsubcategory is selected, go to the subcategory detail page
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else {
                 // If only main category is selected, filter on the main page
                 await navigateToFilter({
                     category: categoryId,
                     subcategory: 'all',
                     subSubcategory: 'all',
                     search: ''
                 });
                 // Scroll to categories after navigation
                 document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue), // Use the determined field and value
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null; // Don't render if no products found

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const card = createProductCardElement(product); // Use from app-logic
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

// Function to render the brands section
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
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId); // Use from app-logic
                } else if(brand.categoryId) {
                    await navigateToFilter({ // Use from app-logic
                        category: brand.categoryId,
                        subcategory: 'all',
                        subSubcategory: 'all',
                        search: ''
                    });
                     // Scroll to categories after navigation
                     document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // If no category linked, clicking does nothing for now
            };

            brandsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error fetching brands for group:", error);
        return null;
    }
}

// Function to render the newest products section
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
        // Fetch products created within the last 15 days (adjust as needed)
        const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const q = query(
            productsCollection,
            where('createdAt', '>=', fifteenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        const productsScroller = document.createElement('div');
        if (snapshot.empty) {
            return null; // Do not render if there are no new products
        } else {
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const card = createProductCardElement(product); // Use from app-logic
                productsScroller.appendChild(card);
            });
        }
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

// Function to render the section showing all products (paginated on main page)
async function renderAllProductsSection() {
    // This function now just creates the section title.
    // The actual products will be rendered by searchProductsInFirestore in app-logic.js
    // when no filters/search terms are active.
    const container = document.createElement('div');
    container.className = 'dynamic-section all-products-title-section'; // Added class for identification
    container.style.marginTop = '20px'; // Add some space before this section title

    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('all_products_section_title');
    header.appendChild(title);
    container.appendChild(header);

    // No products are fetched or added here anymore.
    // productsContainer will be used by app-logic.js for this.
    return container;
}


// Function to render the promo cards slider/section
async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID for interval management

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards };

            // Create the initial card element using the function from app-logic
            const promoCardElement = createPromoCardElement(cardData, sliderState); // Use from app-logic
            promoGrid.appendChild(promoCardElement);

            // Setup automatic rotation if more than one card
            if (cards.length > 1) {
                const rotate = () => {
                    // Check if the element still exists and the interval is still registered
                    if (!document.getElementById(promoGrid.id) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                        if (sliderState.intervalId) {
                            clearInterval(sliderState.intervalId);
                            // Remove from global state if it exists there
                            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                                delete state.sliderIntervals[layoutId];
                            }
                        }
                        return; // Stop rotation if element is gone or interval unregistered
                    }
                    sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
                    const newImageUrl = cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cards[sliderState.currentIndex].imageUrls.ku_sorani;
                    const imgElement = promoCardElement.querySelector('.product-image');
                    if(imgElement) imgElement.src = newImageUrl; // Update the image source
                };

                // Clear previous interval for this specific layoutId if it exists
                if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                    clearInterval(state.sliderIntervals[layoutId]);
                }

                sliderState.intervalId = setInterval(rotate, 5000); // Rotate every 5 seconds
                // Store interval ID in the global state object using layoutId as key
                if (!state.sliderIntervals) state.sliderIntervals = {}; // Initialize if doesn't exist
                state.sliderIntervals[layoutId] = sliderState.intervalId;
            }
            return promoGrid; // Return the created section element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if no cards or error
}

// Main function to render the entire home page content based on layout
export async function renderHomePageContent() {
    // Prevent multiple renders at the same time
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
         console.error("Home sections container not found!");
         state.isRenderingHomePage = false;
         return;
    }


    try {
        // Show skeleton loader while fetching layout
        // renderSkeletonLoader(homeSectionsContainer, 4); // You might need to import this or manage loader differently
        homeSectionsContainer.innerHTML = '<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>'; // Simple loader


        // --- Interval Cleanup ---
        Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
            if (state.sliderIntervals[layoutId]) {
                clearInterval(state.sliderIntervals[layoutId]);
            }
        });
        state.sliderIntervals = {}; // Reset intervals object
        // --- End Interval Cleanup ---

        homeSectionsContainer.innerHTML = ''; // Clear loader/previous content

        // Fetch the home page layout configuration
        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
            // Render default sections or a message if layout is empty
            const defaultPromo = await renderPromoCardsSectionForHome('default', 'layout_default_promo');
            if (defaultPromo) homeSectionsContainer.appendChild(defaultPromo);
            const defaultBrands = await renderBrandsSection('default');
            if (defaultBrands) homeSectionsContainer.appendChild(defaultBrands);
            const newest = await renderNewestProductsSection();
            if (newest) homeSectionsContainer.appendChild(newest);
            const allProductsTitle = await renderAllProductsSection(); // Just the title
             if (allProductsTitle) homeSectionsContainer.appendChild(allProductsTitle);
        } else {
            // Render sections based on the fetched layout
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID
                        } else { console.warn("Promo slider section is missing groupId in layout config."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section is missing groupId in layout config."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                         if (section.rowId) {
                             sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                         } else { console.warn("Single shortcut row section is missing rowId in layout config."); }
                         break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section is missing categoryId in layout config."); }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection(); // Just the title section
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
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.</p>`;
    } finally {
        state.isRenderingHomePage = false;
    }
}
