// home.js - Contains logic specifically for rendering the home page sections

import {
    db, state, t,
    productsCollection, categoriesCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection // Make sure collections are exported from app-setup
} from './app-setup.js';

import {
    getDocs, query, collection, doc, getDoc, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import necessary functions from app-logic.js if they are general utilities
// We assume createProductCardElement is still globally accessible or exported from app-logic/app-setup
// If createProductCardElement is NOT globally accessible, you'll need to import it here.
// For now, assuming it's accessible via window.createProductCardElement or similar,
// or ideally imported from app-setup if moved there.
// Let's assume createProductCardElement is exported from app-logic for clarity
// NOTE: You'll need to add an export for createProductCardElement in app-logic.js
// Alternatively, move createProductCardElement to app-setup.js and export/import from there.
// For this example, let's assume it's globally available for simplicity, but importing is better practice.
// If it's NOT global, add: import { createProductCardElement } from './app-logic.js';

// Helper function (if needed specifically for home page rendering)
function renderSkeletonLoaderForHome(container, count = 4) {
    container.innerHTML = ''; // Clear previous skeletons
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card'; // Use existing skeleton style
        skeletonCard.innerHTML = `
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-price shimmer"></div>
            <div class="skeleton-button shimmer"></div>
        `;
        container.appendChild(skeletonCard);
    }
    container.style.display = 'grid'; // Ensure grid display
}


// Function to create promo card element (now takes sliderState)
// This function needs access to `state.currentLanguage` and `MapsToFilter`
// `MapsToFilter` needs to be passed or imported if used here.
// For simplicity, let's assume `createProductCardElement` handles its own clicks or we pass necessary handlers.
// Replicating createPromoCardElement here for self-containment, requires `MapsToFilter` potentially.
// It's often better to keep createProductCardElement in app-logic and import it.
// Assuming createPromoCardElement is defined elsewhere (app-logic.js or app-setup.js) and imported or globally available.

// --- Functions moved from app-logic.js ---

async function renderPromoCardsSectionForHome(groupId, layoutId) {
    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Reuse existing style
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID for interval management

    try {
        const cardsQuery = query(collection(db, "promo_groups", groupId, "cards"), orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (cards.length > 0) {
            const sliderState = { currentIndex: 0, intervalId: null };
            const cardData = { cards }; // Data structure expected by createPromoCardElement

            // Assume createPromoCardElement exists globally or is imported
            // If importing: import { createPromoCardElement } from './app-logic.js';
             const promoCardElement = createPromoCardElementForHome(cardData, sliderState, layoutId); // Use local version
            if(!promoCardElement) return null; // Handle case where element creation fails

            promoGrid.appendChild(promoCardElement);
            return promoGrid; // Return the created element
        }
    } catch (error) {
        console.error(`Error rendering promo slider for group ${groupId}:`, error);
    }
    return null; // Return null if error or no cards
}


// A modified version specific for home.js, requires navigateToFilter to be passed or imported
// Or relies on global state update if navigateToFilter handles that.
// Let's assume navigateToFilter is imported: import { navigateToFilter } from './app-logic.js';
// If it's not exported from app-logic, this needs adjustment.
function createPromoCardElementForHome(cardData, sliderState, layoutId) {
    // This function needs access to `state.currentLanguage`, `state.categories`
    // It also needs `MapsToFilter` if clicks navigate directly.
    // For simplicity, assuming these are accessible via the imported `state` and potentially imported `MapsToFilter`.

    const cardElement = document.createElement('div');
    cardElement.className = 'product-card promo-card-grid-item'; // Applying styles
    const currentCard = cardData.cards[sliderState.currentIndex];
    const imageUrl = currentCard.imageUrls[state.currentLanguage] || currentCard.imageUrls.ku_sorani;

    cardElement.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" class="product-image" loading="lazy" alt="Promotion">
        </div>
        ${cardData.cards.length > 1 ? `
        <button class="promo-slider-btn prev"><i class="fas fa-chevron-left"></i></button>
        <button class="promo-slider-btn next"><i class="fas fa-chevron-right"></i></button>
        ` : ''}
    `;

     // --- Click handler for navigation ---
     cardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { // Ignore clicks on buttons
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
             // Assuming navigateToFilter is imported or globally available
             // If not, this part needs adjustment.
            if (categoryExists && typeof navigateToFilter === 'function') {
                await navigateToFilter({
                    category: targetCategoryId,
                    subcategory: 'all',
                    subSubcategory: 'all',
                    search: ''
                });
                // Optional: Scroll to categories after navigation
                document.getElementById('mainCategoriesContainer')?.scrollIntoView({ behavior: 'smooth' });
            } else if (!categoryExists) {
                console.warn(`Promo card links to non-existent category: ${targetCategoryId}`);
            } else {
                 console.warn("navigateToFilter function not available in home.js");
            }
        }
    });


    // --- Slider Button Logic ---
    if (cardData.cards.length > 1) {
        const imgElement = cardElement.querySelector('.product-image');

        const updateImage = () => {
            const newImageUrl = cardData.cards[sliderState.currentIndex].imageUrls[state.currentLanguage] || cardData.cards[sliderState.currentIndex].imageUrls.ku_sorani;
            if(imgElement) imgElement.src = newImageUrl;
        };

        cardElement.querySelector('.promo-slider-btn.prev').addEventListener('click', (e) => {
            e.stopPropagation();
             // Clear interval when manually navigating
            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                 clearInterval(state.sliderIntervals[layoutId]);
                 state.sliderIntervals[layoutId] = null; // Prevent auto-restart issues
            }
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cardData.cards.length) % cardData.cards.length;
            updateImage();
        });

        cardElement.querySelector('.promo-slider-btn.next').addEventListener('click', (e) => {
            e.stopPropagation();
             // Clear interval when manually navigating
            if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                 clearInterval(state.sliderIntervals[layoutId]);
                 state.sliderIntervals[layoutId] = null; // Prevent auto-restart issues
            }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            updateImage();
        });

         // --- Auto Rotation Logic ---
         const rotate = () => {
            // Check if the element still exists and the interval is still registered
            if (!document.getElementById(`promoSliderLayout_${layoutId}`) || !state.sliderIntervals || !state.sliderIntervals[layoutId]) {
                if (sliderState.intervalId) {
                    clearInterval(sliderState.intervalId);
                    if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
                        delete state.sliderIntervals[layoutId]; // Clean up state if interval stopped unexpectedly
                    }
                }
                return; // Stop rotation if element is gone or interval deregistered
            }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cardData.cards.length;
            updateImage();
        };

        // Clear previous interval just in case
        if (state.sliderIntervals && state.sliderIntervals[layoutId]) {
            clearInterval(state.sliderIntervals[layoutId]);
        }

        sliderState.intervalId = setInterval(rotate, 5000); // Start rotation
         // Store interval ID in global state using unique layoutId
        if (!state.sliderIntervals) state.sliderIntervals = {};
        state.sliderIntervals[layoutId] = sliderState.intervalId;
    }

    return cardElement;
}


async function renderBrandsSection(groupId) {
    // Needs access to `state.currentLanguage`, `MapsToFilter`, `showSubcategoryDetailPage`
    // Assuming these are accessible via import or global scope.
    // If importing: import { navigateToFilter, showSubcategoryDetailPage } from './app-logic.js';

    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section';
    const brandsContainer = document.createElement('div');
    brandsContainer.id = `brandsContainer_${groupId}`;
    brandsContainer.className = 'brands-container';
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(collection(db, "brand_groups", groupId, "brands"), orderBy("order", "asc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = brand.name[state.currentLanguage] || brand.name.ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl || placeholderImg}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.src='${placeholderImg}';">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                 // Assuming navigateToFilter and showSubcategoryDetailPage are available
                if (brand.subcategoryId && brand.categoryId && typeof showSubcategoryDetailPage === 'function') {
                    showSubcategoryDetailPage(brand.categoryId, brand.subcategoryId);
                } else if(brand.categoryId && typeof navigateToFilter === 'function') {
                    await navigateToFilter({
                        category: brand.categoryId,
                        subcategory: 'all',
                        subSubcategory: 'all',
                        search: ''
                    });
                 } else {
                     console.warn("Navigation functions (navigateToFilter or showSubcategoryDetailPage) not available in home.js");
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

async function renderNewestProductsSection() {
    // Needs access to `t` and `createProductCardElement`.
    // Assuming `createProductCardElement` is available (imported or global).
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';
    const title = document.createElement('h3');
    title.className = 'section-title-main';
    title.textContent = t('newest_products');
    header.appendChild(title);
    // Note: 'See All' link might require navigation logic, omitted for simplicity here
    container.appendChild(header);

    try {
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
            return null; // Don't render if there are no new products
        } else {
            productsScroller.className = 'horizontal-products-container';
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                 // Assuming createProductCardElement is available
                if (typeof createProductCardElement === 'function') {
                    const card = createProductCardElement(product);
                    productsScroller.appendChild(card);
                 } else {
                      console.error("createProductCardElement is not defined in home.js scope");
                 }
            });
        }
        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderSingleShortcutRow(rowId, sectionNameObj) {
    // Needs access to `state.currentLanguage`, `t`, `MapsToFilter`.
    // Assuming `MapsToFilter` is available.
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'shortcut-cards-section';

    try {
        const rowDoc = await getDoc(doc(db, "shortcut_rows", rowId));
        if (!rowDoc.exists()) return null;

        const rowData = { id: rowDoc.id, ...rowDoc.data() };
         // Use name from layout data first, fallback to row title
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

        if (cardsSnapshot.empty) {
            return null; // Don't render empty rows
        }

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = cardData.name[state.currentLanguage] || cardData.name.ku_sorani;
            const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl || placeholderImg}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.src='${placeholderImg}';">
                <div class="shortcut-card-name">${cardName}</div>
            `;

            item.onclick = async () => {
                // Assuming navigateToFilter is available
                if (typeof navigateToFilter === 'function') {
                    await navigateToFilter({
                        category: cardData.categoryId || 'all',
                        subcategory: cardData.subcategoryId || 'all',
                        subSubcategory: cardData.subSubcategoryId || 'all',
                        search: ''
                    });
                 } else {
                     console.warn("navigateToFilter function not available in home.js");
                 }
            };
            cardsContainer.appendChild(item);
        });

        return sectionContainer;
    } catch (error) {
        console.error("Error rendering single shortcut row:", error);
        return null;
    }
}


async function renderSingleCategoryRow(sectionData) {
    // Needs `t`, `state.currentLanguage`, `createProductCardElement`, `MapsToFilter`, `showSubcategoryDetailPage`.
    // Assuming these are available.
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData;
    let queryField, queryValue;
    let title = name[state.currentLanguage] || name.ku_sorani;
    let targetDocRef;

    if (subSubcategoryId) {
        queryField = 'subSubcategoryId'; queryValue = subSubcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
    } else if (subcategoryId) {
        queryField = 'subcategoryId'; queryValue = subcategoryId;
        targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
    } else if (categoryId) {
        queryField = 'categoryId'; queryValue = categoryId;
        targetDocRef = doc(db, `categories/${categoryId}`);
    } else { return null; }

    try {
        const targetSnap = await getDoc(targetDocRef);
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

        const seeAllLink = document.createElement('a');
        seeAllLink.className = 'see-all-link';
        seeAllLink.textContent = t('see_all');
        seeAllLink.onclick = async () => {
            // Assuming navigation functions are available
            if(subcategoryId && typeof showSubcategoryDetailPage === 'function') {
                showSubcategoryDetailPage(categoryId, subcategoryId);
            } else if (categoryId && typeof navigateToFilter === 'function') {
                await navigateToFilter({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
            } else {
                 console.warn("Navigation functions not available in home.js for see all link");
            }
        };
        header.appendChild(seeAllLink);
        container.appendChild(header);

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        container.appendChild(productsScroller);

        const q = query(
            productsCollection,
            where(queryField, '==', queryValue),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
             // Assuming createProductCardElement is available
            if (typeof createProductCardElement === 'function') {
                const card = createProductCardElement(product);
                productsScroller.appendChild(card);
            } else {
                 console.error("createProductCardElement is not defined in home.js scope");
            }
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row:`, error);
        return null;
    }
}

async function renderAllProductsSection() {
    // Needs `t` and `createProductCardElement`.
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
    productsGrid.className = 'products-container'; // Use existing grid style
    container.appendChild(productsGrid);

    try {
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
             // Assuming createProductCardElement is available
            if (typeof createProductCardElement === 'function') {
                const card = createProductCardElement(product);
                productsGrid.appendChild(card);
            } else {
                 console.error("createProductCardElement is not defined in home.js scope");
            }
        });
        return container;
    } catch (error) {
        console.error("Error fetching all products for home page:", error);
        return null;
    }
}

// --- Main Exported Function ---

export async function renderHomePageContent() {
    // Needs access to `state` object for `isRenderingHomePage` and `sliderIntervals`.
    if (state.isRenderingHomePage) return;
    state.isRenderingHomePage = true;

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');

    try {
        renderSkeletonLoaderForHome(homeSectionsContainer, 4); // Use local or imported skeleton
        homeSectionsContainer.innerHTML = ''; // Clear previous content

        // Clean up any existing intervals before rendering new ones
        clearHomePageIntervals(); // Use the exported cleanup function

        const layoutQuery = query(collection(db, 'home_layout'), where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is not configured or all sections are disabled.");
             homeSectionsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">پەڕەی سەرەکی هێشتا ڕێکنەخراوە.</p>';
        } else {
            for (const doc of layoutSnapshot.docs) {
                const section = doc.data();
                let sectionElement = null;

                switch (section.type) {
                    case 'promo_slider':
                        if (section.groupId) {
                            sectionElement = await renderPromoCardsSectionForHome(section.groupId, doc.id); // Pass layout ID
                        } else { console.warn("Promo slider section is missing groupId."); }
                        break;
                    case 'brands':
                        if (section.groupId) {
                            sectionElement = await renderBrandsSection(section.groupId);
                        } else { console.warn("Brands section is missing groupId."); }
                        break;
                    case 'newest_products':
                        sectionElement = await renderNewestProductsSection();
                        break;
                    case 'single_shortcut_row':
                        if (section.rowId) {
                            sectionElement = await renderSingleShortcutRow(section.rowId, section.name);
                        } else { console.warn("Single shortcut row section is missing rowId."); }
                        break;
                    case 'single_category_row':
                        if (section.categoryId) {
                            sectionElement = await renderSingleCategoryRow(section);
                        } else { console.warn("Single category row section is missing categoryId."); }
                        break;
                    case 'all_products':
                        sectionElement = await renderAllProductsSection();
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
        state.isRenderingHomePage = false; // Reset flag
    }
}

// Exported function to clear intervals, called from app-logic when navigating away
export function clearHomePageIntervals() {
     // Needs access to `state.sliderIntervals`
    Object.keys(state.sliderIntervals || {}).forEach(layoutId => {
        if (state.sliderIntervals[layoutId]) {
            clearInterval(state.sliderIntervals[layoutId]);
        }
    });
    state.sliderIntervals = {}; // Reset the intervals object
    console.log("Cleared home page intervals.");
}

// --- Potentially needed imports (Add these at the top of home.js) ---
// Make sure these are exported from app-setup.js or app-logic.js as needed
/*
import {
    db, state, t, productsCollection, categoriesCollection, promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection
} from './app-setup.js';

import {
    getDocs, query, collection, doc, getDoc, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import functions potentially needed from app-logic.js
// Ensure these are EXPORTED from app-logic.js
import { navigateToFilter, showSubcategoryDetailPage, createProductCardElement } from './app-logic.js';
*/
