// === homePage.js ===
// Ev fayl hemî fonksîyonên pêwendîdar bi nîşandana beşên lapera serekî vedigire

// Import Firestore functions if needed directly, or rely on passed handlers
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Module-level variables to hold dependencies passed from app-logic.js
let db, state, t, cardHandlers, navigateToFilter, renderSkeletonLoader;
let productsCollection, promoCardsCollection, brandsCollection, shortcutRowsCollection, homeLayoutCollection;
let createProductCardElement, createPromoCardElement; // Expect card creation functions to be passed

// Function to initialize dependencies
export function initializeHomePage(dependencies) {
    db = dependencies.db;
    state = dependencies.state;
    t = dependencies.t;
    cardHandlers = dependencies.cardHandlers;
    navigateToFilter = dependencies.navigateToFilter;
    renderSkeletonLoader = dependencies.renderSkeletonLoader;
    productsCollection = dependencies.productsCollection;
    promoCardsCollection = dependencies.promoCardsCollection;
    brandsCollection = dependencies.brandsCollection;
    shortcutRowsCollection = dependencies.shortcutRowsCollection;
    homeLayoutCollection = collection(db, 'home_layout'); // Define homeLayoutCollection here
    createProductCardElement = dependencies.createProductCardElement;
    createPromoCardElement = dependencies.createPromoCardElement; // Make sure this is passed if used
    console.log("HomePage module initialized with dependencies.");
}

// --- Promo Card Rotation Logic ---
function displayPromoCard(index) {
    const promoCardContainer = document.getElementById('promo-card-home-container'); // Find container dynamically
    if (!promoCardContainer || !state.allPromoCards || state.allPromoCards.length === 0) {
        console.warn("Cannot display promo card, container or cards missing.");
        return;
    }

    // Ensure index is within bounds
    if (index < 0) index = state.allPromoCards.length - 1;
    if (index >= state.allPromoCards.length) index = 0;
    state.currentPromoCardIndex = index; // Update the current index

    const cardData = state.allPromoCards[index];
    // Use the passed createPromoCardElement function
    const newCardElement = createPromoCardElement(cardData, state.currentLanguage, changePromoCard, startPromoRotation); // Pass necessary handlers if needed
    newCardElement.classList.add('product-card-reveal'); // For potential fade-in effect

    // Replace the content of the container
    promoCardContainer.innerHTML = ''; // Clear previous card
    promoCardContainer.appendChild(newCardElement);

    // Trigger animation if desired
    setTimeout(() => {
        newCardElement.classList.add('visible');
    }, 10);
}

function rotatePromoCard() {
    if (!state.allPromoCards || state.allPromoCards.length <= 1) return; // No need to rotate if only one or zero cards
    const nextIndex = (state.currentPromoCardIndex + 1) % state.allPromoCards.length;
    displayPromoCard(nextIndex);
}

function changePromoCard(direction) {
    if (!state.allPromoCards || state.allPromoCards.length <= 1) return;
    const newIndex = state.currentPromoCardIndex + direction;
    displayPromoCard(newIndex); // displayPromoCard handles wrapping around
    startPromoRotation(); // Reset the interval timer after manual change
}

export function startPromoRotation() {
    // Clear any existing interval
    stopPromoRotation();
    // Start new interval only if there's more than one card
    if (state.allPromoCards && state.allPromoCards.length > 1) {
        // Ensure interval is not already running (double check)
        if (!state.promoRotationInterval) {
            console.log("Starting promo rotation interval.");
             state.promoRotationInterval = setInterval(rotatePromoCard, 5000); // Rotate every 5 seconds
        }
    }
}

export function stopPromoRotation() {
    if (state.promoRotationInterval) {
        console.log("Stopping promo rotation interval.");
        clearInterval(state.promoRotationInterval);
        state.promoRotationInterval = null; // Reset interval ID
    }
}


// --- Section Rendering Functions ---

async function renderPromoCardsSectionForHome() {
    // Fetch promo cards only if not already fetched or if empty
    if (!state.allPromoCards || state.allPromoCards.length === 0) {
        try {
            const promoQuery = query(promoCardsCollection, orderBy("order", "asc"));
            const promoSnapshot = await getDocs(promoQuery);
            state.allPromoCards = promoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPromoCard: true }));
            console.log("Fetched promo cards:", state.allPromoCards.length);
        } catch (error) {
             console.error("Error fetching promo cards:", error);
             state.allPromoCards = []; // Ensure it's an empty array on error
             return null; // Don't render section if fetch fails
        }
    }

    if (state.allPromoCards.length > 0) {
        // Reset index if it's out of bounds
        if (state.currentPromoCardIndex >= state.allPromoCards.length || state.currentPromoCardIndex < 0) {
             state.currentPromoCardIndex = 0;
        }

        // Create the element for the current promo card
        // Make sure createPromoCardElement exists and is passed correctly
        if (typeof createPromoCardElement !== 'function') {
            console.error("createPromoCardElement is not available in homePage.js");
            return null;
        }
        const promoCardElement = createPromoCardElement(state.allPromoCards[state.currentPromoCardIndex], state.currentLanguage, changePromoCard, startPromoRotation); // Pass language and handlers

        // Create a container grid for the promo card (so it takes full width)
        const promoGrid = document.createElement('div');
        promoGrid.className = 'products-container'; // Use products-container to manage grid layout
        promoGrid.style.marginBottom = '16px'; // Add some space below
        promoGrid.id = 'promo-card-home-container'; // Add ID for easier replacement
        promoGrid.appendChild(promoCardElement);

        startPromoRotation(); // Start or restart the automatic rotation
        return promoGrid;
    }
    // Return null if there are no promo cards to display
    return null;
}

async function renderBrandsSection() {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'brands-section'; // Add main class for styling
    const brandsContainer = document.createElement('div');
    brandsContainer.className = 'brands-container'; // Class for horizontal scrolling
    sectionContainer.appendChild(brandsContainer);

    try {
        const q = query(brandsCollection, orderBy("order", "asc"), limit(30)); // Fetch brands ordered
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null; // Don't render the section if no brands exist
        }

        snapshot.forEach(doc => {
            const brand = { id: doc.id, ...doc.data() };
            const brandName = (brand.name && brand.name[state.currentLanguage]) || (brand.name && brand.name.ku_sorani);
            const placeholderImg = 'https://placehold.co/65x65/e2e8f0/2d3748?text=Brand';

            const item = document.createElement('div');
            item.className = 'brand-item';
            item.innerHTML = `
                <div class="brand-image-wrapper">
                    <img src="${brand.imageUrl || placeholderImg}" alt="${brandName}" loading="lazy" class="brand-image" onerror="this.src='${placeholderImg}'; this.onerror=null;">
                </div>
                <span>${brandName}</span>
            `;

            item.onclick = async () => {
                await navigateToFilter({
                    category: brand.categoryId || 'all',
                    subcategory: brand.subcategoryId || 'all',
                    subSubcategory: 'all',
                    search: ''
                });
            };
            brandsContainer.appendChild(item);
        });

        return sectionContainer; // Return the fully populated section
    } catch (error) {
        console.error("Error fetching brands:", error);
        return null; // Return null on error
    }
}

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
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const productsScroller = document.createElement('div');
        productsScroller.className = 'horizontal-products-container';
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Check admin status

        // Make sure createProductCardElement exists
        if (typeof createProductCardElement !== 'function') {
            console.error("createProductCardElement is not available in homePage.js for newest products.");
            return null;
        }


        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // Use the passed createProductCardElement function
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsScroller.appendChild(card);
        });

        container.appendChild(productsScroller);
        return container;

    } catch (error) {
        console.error("Error fetching newest products:", error);
        return null;
    }
}

async function renderSingleCategoryRow(categoryId, sectionNameObj) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category || category.id === 'all') {
         console.warn(`Attempted to render single category row for invalid/all category ID: ${categoryId}`);
         return null;
    }

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'section-title-header';

    const title = document.createElement('h3');
    title.className = 'section-title-main';
    const categoryName = (sectionNameObj && sectionNameObj[state.currentLanguage])
                       || (category['name_' + state.currentLanguage])
                       || category.name_ku_sorani;
    title.innerHTML = `<i class="${category.icon || 'fas fa-tag'}"></i> ${categoryName}`;
    header.appendChild(title);

    const seeAllLink = document.createElement('a');
    seeAllLink.className = 'see-all-link';
    seeAllLink.textContent = t('see_all');
    seeAllLink.onclick = async () => {
        await navigateToFilter({
            category: category.id,
            subcategory: 'all',
            subSubcategory: 'all',
            search: ''
        });
    };
    header.appendChild(seeAllLink);
    container.appendChild(header);

    const productsScroller = document.createElement('div');
    productsScroller.className = 'horizontal-products-container';
    container.appendChild(productsScroller);

    try {
        const q = query(
            productsCollection,
            where('categoryId', '==', categoryId),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
             console.log(`No products found for single category row: ${categoryName}`);
             return null;
        }

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

        // Make sure createProductCardElement exists
        if (typeof createProductCardElement !== 'function') {
            console.error("createProductCardElement is not available in homePage.js for category row.");
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // Use the passed createProductCardElement function
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsScroller.appendChild(card);
        });
        return container;

    } catch (error) {
        console.error(`Error fetching products for single category row ${categoryId}:`, error);
        return null;
    }
}

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
        const rowTitle = (sectionNameObj && sectionNameObj[state.currentLanguage])
                       || (rowData.title && rowData.title[state.currentLanguage])
                       || (rowData.title && rowData.title.ku_sorani);

        if(rowTitle) {
            const titleElement = document.createElement('h3');
            titleElement.className = 'shortcut-row-title';
            titleElement.textContent = rowTitle;
            sectionContainer.appendChild(titleElement);
        }

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'shortcut-cards-container';
        sectionContainer.appendChild(cardsContainer);

        const cardsCollectionRef = collection(db, "shortcut_rows", rowData.id, "cards");
        const cardsQuery = query(cardsCollectionRef, orderBy("order", "asc"));
        const cardsSnapshot = await getDocs(cardsQuery);

        if (cardsSnapshot.empty) {
            console.log(`Shortcut row "${rowTitle || rowId}" has no cards.`);
            return null; // Hide empty rows
        }
        const placeholderImg = 'https://placehold.co/100x100/e2e8f0/2d3748?text=Card';

        cardsSnapshot.forEach(cardDoc => {
            const cardData = cardDoc.data();
            const cardName = (cardData.name && cardData.name[state.currentLanguage])
                           || (cardData.name && cardData.name.ku_sorani);

            const item = document.createElement('div');
            item.className = 'shortcut-card';
            item.innerHTML = `
                <img src="${cardData.imageUrl || placeholderImg}" alt="${cardName}" class="shortcut-card-image" loading="lazy" onerror="this.src='${placeholderImg}'; this.onerror=null;">
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

async function renderAllProductsSection() {
    // This section on the home page might just be a title linking elsewhere,
    // or show a very limited number of products. Let's show a few.
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
    productsGrid.className = 'products-container'; // Use standard grid
    container.appendChild(productsGrid);

    try {
        // Fetch only a few recent products for the preview
        const q = query(productsCollection, orderBy('createdAt', 'desc'), limit(6)); // Limit to 6 for home page view
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
             console.log("No products found for 'All Products' home section preview.");
             return null; // Don't render if no products
        }

        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

        // Make sure createProductCardElement exists
        if (typeof createProductCardElement !== 'function') {
            console.error("createProductCardElement is not available in homePage.js for all products section.");
            return null;
        }

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            // Use the passed createProductCardElement function
            const card = createProductCardElement(product, cardHandlers, state.currentLanguage, isAdmin);
            productsGrid.appendChild(card);
        });

        // Optional: Add a "See All" link that navigates to the 'all' filter
        const seeAllLink = document.createElement('a');
        seeAllLink.textContent = t('see_all');
        seeAllLink.className = 'see-all-link'; // Use existing style
        seeAllLink.style.display = 'block'; // Make it block level
        seeAllLink.style.textAlign = 'center';
        seeAllLink.style.marginTop = '15px';
        seeAllLink.onclick = async () => {
            await navigateToFilter({ category: 'all', subcategory: 'all', subSubcategory: 'all', search: '' });
        };
        container.appendChild(seeAllLink);


        return container;

    } catch (error) {
        console.error("Error fetching initial products for 'All Products' home section:", error);
        return null;
    }
}


// --- Main Function to Render Home Page ---
export async function renderHomePageContent() {
    // Check if dependencies are initialized
    if (!db || !state || !t || !cardHandlers || !navigateToFilter || !renderSkeletonLoader || !createProductCardElement || !createPromoCardElement) {
        console.error("HomePage module not properly initialized with dependencies.");
        const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
        if (homeSectionsContainer) {
            homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px; color: red;">Error: Home Page module not initialized.</p>`;
        }
        return;
    }

    if (state.isRenderingHomePage) {
        console.log("Already rendering home page, skipping.");
        return;
    }
    state.isRenderingHomePage = true;
    console.log("Rendering home page content...");

    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) {
         console.error("homePageSectionsContainer not found!");
         state.isRenderingHomePage = false;
         return;
    }


    try {
        renderSkeletonLoader(homeSectionsContainer, 4); // Show skeleton in the target container

        const layoutQuery = query(homeLayoutCollection, where('enabled', '==', true), orderBy('order', 'asc'));
        const layoutSnapshot = await getDocs(layoutQuery);

        homeSectionsContainer.innerHTML = ''; // Clear skeleton loader

        if (layoutSnapshot.empty) {
            console.warn("Home page layout is empty or all sections are disabled. Rendering default 'all products'.");
            const allProductsSection = await renderAllProductsSection();
            if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        } else {
            console.log(`Rendering ${layoutSnapshot.docs.length} home sections.`);
            const renderPromises = layoutSnapshot.docs.map(doc => {
                 const section = doc.data();
                 // Ensure name is an object, create fallback if it's a string (for safety)
                 const sectionNameObj = (typeof section.name === 'object' && section.name !== null)
                                      ? section.name
                                      : { ku_sorani: section.name || section.type, ku_badini: section.name || section.type, ar: section.name || section.type };


                 switch (section.type) {
                     case 'promo_slider':    return renderPromoCardsSectionForHome();
                     case 'brands':          return renderBrandsSection();
                     case 'newest_products': return renderNewestProductsSection();
                     case 'single_shortcut_row': return section.rowId ? renderSingleShortcutRow(section.rowId, sectionNameObj) : Promise.resolve(null);
                     case 'single_category_row': return section.categoryId ? renderSingleCategoryRow(section.categoryId, sectionNameObj) : Promise.resolve(null);
                     case 'all_products':    return renderAllProductsSection(); // Renders a preview
                     default:
                         console.warn(`Unknown home layout section type: ${section.type}`);
                         return Promise.resolve(null);
                 }
            });

            const renderedSections = await Promise.all(renderPromises);

            renderedSections.forEach(sectionElement => {
                if (sectionElement) {
                    homeSectionsContainer.appendChild(sectionElement);
                }
            });
             console.log("Finished appending home sections.");
        }
    } catch (error) {
        console.error("Error rendering home page content:", error);
        homeSectionsContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t('error_loading_home', {defaultValue: 'هەڵەیەک ڕوویدا لە کاتی بارکردنی پەڕەی سەرەکی.'})}</p>`;
    } finally {
        state.isRenderingHomePage = false;
        console.log("Home page rendering finished.");
    }
}