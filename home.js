// home.js
// Logika UI تایبەت بە پەڕەی سەرەki (Home Page)

import {
    state, t, debounce,
    fetchHomeLayout, // <-- Pêwîst e ji bo renderHomePageContentUI
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, 
    db, doc, getDoc // Pêwîst e ji bo createSingleCategoryRowElement
} from './app-core.js';

// *** Gۆڕانکاری گرنگ ***
// Em êdî fonksyonên çêkirina beşan ji vir import NAKIN,
// lê em wan ji 'app-ui.js' import dikin!
// *** گۆڕانکاری گرنگ ***
// ئێمە ئیتر فەنکشنەکانی دروستکردنی بەشەکان لێرە هاوردە ناکەین،
// بەڵکو لە 'app-ui.js' ەوە هاوردەیان دەکەین!
import {
    renderSkeletonLoader, 
    createProductCardElementUI, // <-- Pêwîst e ji bo renderProductsGridUI
    setupScrollAnimations, 
    showSubcategoryDetailPageUI, // <-- Pêwîst e ji bo klîka renderSubcategoriesUI
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em hemî fonksyonên çêkirina beşan ji 'app-ui.js' import dikin
    // ئێمە هەموو فەنکشنەکانی دروستکردنی بەشەکان لە 'app-ui.js' هاوردە دەکەین
    createPromoSliderElement,
    createBrandsSectionElement,
    createNewestProductsSectionElement,
    createSingleShortcutRowElement,
    createSingleCategoryRowElement,
    createAllProductsSectionElement
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
} from './app-ui.js';

// --- Helper Functions ---

/**
 * Resets the horizontal scroll position of a container element.
 * @param {HTMLElement} containerElement The container to scroll.
 */
function resetScrollPosition(containerElement) {
    if (containerElement) {
        containerElement.scrollTo({
            left: 0,
            behavior: 'smooth' 
        });
    }
}

// --- UI Rendering Functions for Home Page ---

// Renders product cards in the main grid (replaces original renderProductsUI)
function renderProductsGridUI(newProductsOnly = false) {
    const container = document.getElementById('productsContainer'); 
    if (!container) return;

    // If only rendering new products (infinite scroll), append them
    if (Array.isArray(newProductsOnly)) { 
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item); // Use imported function
            element.classList.add('product-card-reveal'); 
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
                element.classList.add('product-card-reveal'); 
                container.appendChild(element);
            });
        }
    }
    setupScrollAnimations(); // Use imported function
}
// Make globally accessible if infinite scroll in app-ui.js needs it
window.renderProductsGridUI = renderProductsGridUI;

export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    // 1. Bişkoja "Serekî" (Home) bi destî lê zêde bike
    const homeBtn = document.createElement('button');
    homeBtn.className = 'main-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> <span>${t('nav_home')}</span>`;

    // Bişkoja "Serekî" çalak bike heke kategoriya heyî 'all' be
    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }

    // Logica onclick ji bo "Serekî"
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


    // 2. Hemî kategoriyên din ji stateyê lê zêde bike
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

// Renders subcategories based on fetched data (Second horizontal scroll)
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

    // Add "All" button for the current category's subcategories
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; 
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    
    // === GORANKARÎYA DAWÎ YA KU ME QEBÛL KIR ===
    // === دوا گۆڕانکاری کە ڕێککەوتین لەسەری ===
    allBtn.onclick = async () => {
         resetScrollPosition(subcategoriesContainer); 
         // Bişkoja "Hemî" ya jêr-kategorî naha dê her gav vegere rûpela serekî ya malê (Home).
         // دوگمەی "هەموو"ی جۆری لاوەکی ئێستا هەمیشە دەگەڕێتەوە بۆ پەڕەی سەرەki (Home).
         await navigateToFilterCore({
             category: 'all', // <-- Ev ji 'state.currentCategory' hate guhertin
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    // === DAWÎYA GORANKARIYÊ ===

    subcategoriesContainer.appendChild(allBtn);

    // Add buttons for each actual subcategory
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
            // Directly open the subcategory detail page
            showSubcategoryDetailPageUI(state.currentCategory, subcat.id); // <-- This function is now imported from app-ui.js
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

    // Add "All" button for the current subcategory's sub-subcategories
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
         // Filter by the parent subcategory ON THE MAIN PAGE
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    container.appendChild(allBtn);

    // Add buttons for each sub-subcategory
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
             // Open the PARENT subcategory detail page
             showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory); // <-- This function is now imported from app-ui.js
        };
        container.appendChild(btn);
    });
}


// Handles applying the current filter state to the UI (fetching & rendering home/products)
// This function now orchestrates rendering between home sections and product grid
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); 
    const skeletonLoader = document.getElementById('skeletonLoader'); 

    const homeContentLoaded = homeSectionsContainer.innerHTML.trim() !== '' && !homeSectionsContainer.querySelector('#loader');

    // Show skeleton loader for new searches/filters that ARE NOT the home view
    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    
    if (isNewSearch && !shouldShowHome) {
        homeSectionsContainer.style.display = 'none'; 
        productsContainer.style.display = 'none'; 
        renderSkeletonLoader(skeletonLoader); 
        skeletonLoader.style.display = 'grid'; 
        scrollTrigger.style.display = 'none'; 
    } else if (isNewSearch && shouldShowHome) {
        if (!homeContentLoaded) {
            homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
            homeSectionsContainer.style.display = 'block';
            productsContainer.style.display = 'none';
            skeletonLoader.style.display = 'none';
            scrollTrigger.style.display = 'none';
        } else {
            homeSectionsContainer.style.display = 'block'; 
            productsContainer.style.display = 'none'; 
            skeletonLoader.style.display = 'none';
            scrollTrigger.style.display = 'none';
        }
    }


    // Fetch products based on current state (state updated by navigateToFilterCore)
    const result = await fetchProducts(state.currentSearch, isNewSearch);

    if (result === null && !isNewSearch) return; // Loading is already in progress or all loaded for infinite scroll

    skeletonLoader.style.display = 'none'; 

    if (result.isHome) {
        productsContainer.style.display = 'none'; 
        scrollTrigger.style.display = 'none'; 
        homeSectionsContainer.style.display = 'block'; 
        
        if (homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI(); // Render home content (defined below)
        }
    } else {
        homeSectionsContainer.style.display = 'none'; 
        productsContainer.style.display = 'grid'; 
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             renderProductsGridUI(isNewSearch ? null : result.products); 
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block'; 
    }

    // Update category button states AFTER fetching and rendering
    renderMainCategoriesUI(); 
    const subcats = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(subcats); 

    if (isNewSearch && shouldScrollToTop) {
        const activePage = document.getElementById('mainPage');
        if (activePage) {
            activePage.scrollTo({ top: 0, behavior: 'auto' }); 
        } else {
            console.warn('Could not find #mainPage to scroll.');
            window.scrollTo({ top: 0, behavior: 'auto' }); 
        }
    }
}


// Function to render home page sections (UI Part)
// Ev fonksyon naha fonksyonên çêkirina beşan ji 'app-ui.js' bikar tîne
// ئەم فەنکشنە ئێستا فەنکشنەکانی دروستکردنی بەشەکان لە 'app-ui.js' بەکاردەهێنێت
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    if (homeSectionsContainer.innerHTML.trim() === '') {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    const layout = await fetchHomeLayout(); // Fetch layout from core

    homeSectionsContainer.innerHTML = ''; // Clear loader/previous content

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        // Render a fallback (e.g., just the 'all products' section)
         const allProductsSection = await createAllProductsSectionElement(); // <-- Ji app-ui.js tê import kirin
         if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Clean up any existing intervals before rendering new ones
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of layout) {
        let sectionElement = null;
        try {
             switch (section.type) {
                 case 'promo_slider':
                     if (section.groupId) {
                         sectionElement = await createPromoSliderElement(section.groupId, section.id); // <-- Ji app-ui.js tê import kirin
                     } else console.warn("Promo slider missing groupId:", section);
                     break;
                 case 'brands':
                     if (section.groupId) {
                          sectionElement = await createBrandsSectionElement(section.groupId); // <-- Ji app-ui.js tê import kirin
                     } else console.warn("Brands section missing groupId:", section);
                     break;
                 case 'newest_products':
                     sectionElement = await createNewestProductsSectionElement(); // <-- Ji app-ui.js tê import kirin
                     break;
                 case 'single_shortcut_row':
                     if (section.rowId) {
                          sectionElement = await createSingleShortcutRowElement(section.rowId, section.name); // <-- Ji app-ui.js tê import kirin
                         } else console.warn("Shortcut row missing rowId:", section);
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                         sectionElement = await createSingleCategoryRowElement(section); // <-- Ji app-ui.js tê import kirin
                     } else console.warn("Category row missing categoryId:", section);
                     break;
                  case 'all_products':
                       sectionElement = await createAllProductsSectionElement(); // <-- Ji app-ui.js tê import kirin
                      break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
        } catch(error) {
             console.error(`Error rendering home section type ${section.type}:`, error);
              // Optionally add a placeholder indicating an error for this section
             sectionElement = document.createElement('div');
             sectionElement.style.padding = '20px';
             sectionElement.style.textAlign = 'center';
             sectionElement.style.color = 'red';
             sectionElement.textContent = `هەڵە لە بارکردنی بەشی: ${section.type}`;
        }

        if (sectionElement) {
            homeSectionsContainer.appendChild(sectionElement);
        }
    }
    setupScrollAnimations(); // Re-apply scroll animations for newly rendered cards within sections
}