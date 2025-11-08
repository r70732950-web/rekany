// home.js
// Logika UI تایبەت بە پەڕەی سەرەki (Home Page)

import {
    state, t, debounce,
    // === START: KODA NÛ / کۆدی نوێ ===
    // fetchCategoryLayout êdî rasterast li vir nayê bikar anîn,
    // ew di hundurê fetchProducts de tê bikar anîn.
    // fetchCategoryLayout ئیتر ڕاستەوخۆ لێرە بەکارناهێنرێت،
    // لەناو fetchProducts لە app-core.js بەکاردێت.
    fetchHomeLayout, 
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===
    fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, // *** زیادکرا: هاوردەکردنی فانکشنی دروست ***
    db, doc, getDoc // Firestore functions needed locally
} from './app-core.js';

// *** هاوردەکردنی فانکشنە هاوبەشەکان لە app-ui.js ***
import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI
} from './app-ui.js';

// *** 💡 فانکشنی یاریدەدەری نوێ لێرە زیادکرا 💡 ***
// --- Helper Functions ---

/**
 * Resets the horizontal scroll position of a container element.
 * @param {HTMLElement} containerElement The container to scroll.
 */
function resetScrollPosition(containerElement) {
    if (containerElement) {
        containerElement.scrollTo({
            left: 0,
            behavior: 'smooth' // 'smooth' scrolls it back nicely
        });
    }
}
// *** 💡 کۆتایی بەشی زیادکراو 💡 ***

// === START: KODA NÛ / کۆدی نوێ (Helper ji bo Fading) ===
// === دەستپێک: کۆدی نوێ (یاریدەدەر بۆ فەیدکردن) ===
/**
 * Alîkarek ji bo veguheztina nerm (fade) di navbera elementan de.
 * یاریدەدەرێک بۆ گواستنەوەی نەرم (fade) لەنێوان توخمەکاندا.
 * @param {HTMLElement} elementToShow - Elementa ku divê were nîşan dan.
 * @param {HTMLElement[]} elementsToHide - Rêzek ji elementên ku divê werin veşartin.
 * @param {boolean} instant - Heke rast be (true), veguheztin tavilê çêdibe (ئەگەر ڕاست بێت (true)، گواستنەوەکە دەستبەجێ ڕوودەدات).
 */
function fadeContent(elementToShow, elementsToHide = [], instant = false) {
    // 1. Hemî elementên din veşêre
    // 1. هەموو توخمەکانی تر بشارەوە
    elementsToHide.forEach(el => {
        if (el && el !== elementToShow) { // Piştrast bike ku em ya nû na veşêrin (دڵنیابە دانە نوێیەکە ناشارینەوە)
            el.classList.add('content-hidden');
            el.classList.remove('content-visible');
        }
    });

    // === KODA NÛ YA GUHERTÎ / کۆدی نوێی گۆڕاو ===
    if (instant) {
        // "Vegera Bilez": Tavilê nîşan bide
        // "گەڕانەوەی خێرا": دەستبەجێ نیشانی بدە
        if (elementToShow) {
            elementToShow.classList.add('content-visible');
            elementToShow.classList.remove('content-hidden');
        }
    } else {
        // "Barkirina Nû": Li benda fade-out bisekine
        // "بارکردنی نوێ": چاوەڕێی فەید-ئاوت بکە
        setTimeout(() => {
            if (elementToShow) {
                elementToShow.classList.add('content-visible');
                elementToShow.classList.remove('content-hidden');
            }
        }, 260); // Hinekî zêdetir ji 250ms (کەمێک زیاتر لە 250ms)
    }
    // === DAWÎYA KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


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
// *** START: Gۆڕانکاری lێرە kra ***
// *** دەستپێک: Gۆڕانکاری lێرە kra ***
export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    // 1. Bişkoja "Serekî" (Home) bi destî lê zêde bike
    // 1. زیادکردنی دوگمەی "سەرەki" (Home) بە شێوەی دەستی
    const homeBtn = document.createElement('button');
    homeBtn.className = 'main-category-btn';
    homeBtn.dataset.category = 'all'; // Ew hîn jî nirxa 'all' ji bo logica filterê bikar tîne (هێشتا نرخی 'all' بەکاردەهێنێت بۆ لۆجیکی فلتەر)
    homeBtn.innerHTML = `<i class="fas fa-home"></i> <span>${t('nav_home')}</span>`;

    // Bişkoja "Serekî" çalak bike heke kategoriya heyî 'all' be
    // دوگمەی "سەرەki" چالاک بکە ئەگەر جۆری ئێستا 'all' بێت
    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }

    // Logica onclick ji bo "Serekî"
    // لۆجیکی onclick بۆ "سەرەki"
    homeBtn.onclick = async () => {
         resetScrollPosition(container); // *** 💡 لێرە زیادکرا 💡 ***
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
    // 2. زیادکردنی هەموو جۆرەکانی تر لە state
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
             resetScrollPosition(container); // *** 💡 لێرە زیادکرا 💡 ***
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
// *** END: Gۆڕانکاری lێرە kra ***
// *** کۆتایی: Gۆڕانکاری lێرە kra ***


// Renders subcategories based on fetched data (Second horizontal scroll)
export async function renderSubcategoriesUI(subcategoriesData) { // Needs to be async if fetching inside
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); // Get sub-sub container

    subcategoriesContainer.innerHTML = ''; // Clear previous
    subSubcategoriesContainer.innerHTML = ''; // Clear sub-sub
    subSubcategoriesContainer.style.display = 'none'; // Hide sub-sub initially

    // Ev logica hanê rast e: heke kategoriya 'all' (Serekî) were hilbijartin, ti jêr-kategorî nîşan nede
    // ئەم لۆجیکە دروستە: ئەگەر 'all' (سەرەki) هەڵبژێردرابێت، هیچ جۆرێکی لاوەکی نیشان مەدە
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
         resetScrollPosition(subcategoriesContainer); // *** 💡 lێرە zêdekirin 💡 ***
         // When "All" subcategory is clicked, just filter products for the main category
         await navigateToFilterCore({
             category: state.currentCategory, // Keep main category
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); // /* GUHERTIN */
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
            resetScrollPosition(subcategoriesContainer); // *** 💡 lێرە zêdekirin 💡 ***
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
         resetScrollPosition(container); // *** 💡 lێرە zêdekirin 💡 ***
         // Filter by the parent subcategory ON THE MAIN PAGE
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); // /* GUHERTIN */
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
             resetScrollPosition(container); // *** 💡 lێرە zêdekirin 💡 ***
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
// /* GUHERTIN */ Parameterek nû lê zêde kir: shouldScrollToTop
// === START: KODA NÛ / کۆدی نوێ (Bi tevahî hate nûve kirin) ===
// === دەستپێک: کۆدی نوێ (بە تەواوی نوێکرایەوە) ===
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); // Main product grid container
    const skeletonLoader = document.getElementById('skeletonLoader'); // Main skeleton loader

    // Lîsteya hemî konteynirên ku têne guhertin
    // لیستی هەموو کۆنتەینەرەکان کە دەگۆڕدرێن
    const allToggleableContainers = [homeSectionsContainer, productsContainer, skeletonLoader];
    
    // === START: KODA ÇAKKIRÎ / کۆدی چاککراو (Logica Vegera Bilez) ===
    // 1. Em kontrol dikin ka em diçin kuderê (Check where we are going)
    const isTargetingHome = state.currentCategory === 'all' && !state.currentSearch;
    const isTargetingCategoryLayout = state.currentCategory !== 'all' && state.currentSubcategory === 'all' && !state.currentSearch;

    // 2. Em kontrol dikin ka ew naverok jixwe di DOMê de heye (Check if that content is already in the DOM)
    const isHomeLayoutRendered = isTargetingHome &&
                                homeSectionsContainer.dataset.layoutType === 'home' &&
                                homeSectionsContainer.innerHTML.trim() !== '';

    const isCategoryLayoutRendered = isTargetingCategoryLayout &&
                                    homeSectionsContainer.dataset.layoutType === 'category' &&
                                    homeSectionsContainer.dataset.layoutId === state.currentCategory &&
                                    homeSectionsContainer.innerHTML.trim() !== '';
    
    // Ev rewşa "vegera bilez" e (This is the "fast return" scenario)
    const isReturningToCachedLayout = isHomeLayoutRendered || isCategoryLayoutRendered;
    // === END: KODA ÇAKKIRÎ / کۆتایی کۆدی چاککراو ===
    
    
    if (isNewSearch) {
        // Ger ew lêgerînek nû be (an guhertina kategoriyê)
        
        // *** KODA NÛ YA GUHERTÎ / کۆدی نوێی گۆڕاو ***
        if (isReturningToCachedLayout) {
            // "Vegera Bilez": Naverok jixwe heye. Rasterast fade bike.
            // "گەڕانەوەی خێرا": ناوەڕۆک پێشتر هەیە. ڕاستەوخۆ فەید بکە.
            fadeContent(homeSectionsContainer, allToggleableContainers, true); // <-- true = BÊ DERENGÎ (بێ دواکەوتن)
        } else {
            // "Barkirina Nû": Pêdivî bi skeleton heye. Bi derengî fade bike.
            // "بارکردنی نوێ": پێویست بە سکێڵتۆن هەیە. بە دواکەوتن فەید بکە.
            renderSkeletonLoader(skeletonLoader); // Naverokê amade bike
            fadeContent(skeletonLoader, allToggleableContainers, false); // <-- false = BI DERENGÎ (بە دواکەوتن)
        }
        // *** DAWÎYA KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ***
        
        scrollTrigger.style.display = 'none';
    }


    // Fetch products based on current state (state updated by navigateToFilterCore)
    // fetchProducts now returns { isHome: true, layout: [...] } if it should show category sections
    const result = await fetchProducts(state.currentSearch, isNewSearch);

    if (result === null && !isNewSearch) return null; // Loading is already in progress or all loaded for infinite scroll

    // Em êdî `skeletonLoader.style.display = 'none'` bikar naynin
    // ئیتر `skeletonLoader.style.display = 'none'` بەکارناهێنین

    // === START: KODA GUHERTÎ / کۆدی گۆڕاو ===
    // Logica nû ji bo birêvebirina dîzaynên cihêreng
    // لۆجیکی نوێ بۆ مامەڵەکردن لەگەڵ دیزاینە جیاوازەکان
    if (result.isHome) {
        // Ev tê vê wateyê ku em an li rûpela malê ne AN li rûpelek kategoriyê ya bi dîzaynek taybetî ne
        // ئەمە مانای وایە ئێمە یان لە پەڕەی سەرەkiin یان لە پەڕەی جۆرێکین کە دیزاینی تایبەتی هەیە
        scrollTrigger.style.display = 'none'; // Skrola bêdawî veşêre

        if (result.layout) {
            // DÎZAYNA KATEGORIYÊ YA TAYBET: Dîzayna ku ji `fetchProducts` hatî rasterast render bike
            // دیزاینی تایبەتی جۆر: ڕاستەوخۆ ئەو دیزاینە پیشان بدە کە لە `fetchProducts`ـەوە هاتووە
            
            // === START: KODA ÇAKKIRÎ / کۆدی چاککراو (Çareserkirina kêşeya barkirinê) ===
            // Tenê render bike eger ew jixwe nehatibe barkirin
            // تەنها ئەوکات ڕێندەر بکە ئەگەر پێشتر بارنەکرابێت
            if (!isCategoryLayoutRendered) { // <-- GUHERTÎ / گۆڕدرا
                await renderPageContentUI(result.layout, 'category', state.currentCategory); // Cure û ID bişîne
            }
            // === END: KODA ÇAKKIRÎ / کۆتایی کۆدی چاککراو ===
            
        } else {
            // DÎZAYNA RÛPELA MALÊ: Tenê dîzayna malê render bike eger ew jixwe nehatibe barkirin
            // دیزاینی پەڕەی سەرەki: تەنها دیزاینی ماڵەوە پیشان بدە ئەگەر پێشتر بارنەکرابێت
            if (!isHomeLayoutRendered) { // <-- GUHERTÎ / گۆڕدرا
                await renderPageContentUI(null, 'home', null); // Cure bişîne, ID tune
            }
        }
        
        // === KODA NÛ YA GUHERTÎ / کۆدی نوێی گۆڕاو ===
        // Naha, bo homeSections fade bike.
        // Heke me jixwe fade-a bilez kiribe (isReturningToCachedLayout), em dîsa fade nakin.
        // (Now, fade to homeSections.)
        // (If we already did a fast fade (isReturningToCachedLayout), we don't fade again.)
        if (!isReturningToCachedLayout) {
            fadeContent(homeSectionsContainer, allToggleableContainers, false); // Fade ji skeleton bo naverokê (Fade from skeleton to content)
        }
        // === DAWÎYA KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
        
    } else {
        // Ev tê vê wateyê ku em grid-a kaڵayên normal nîşan didin
        // ئەمە مانای وایە ئێمە گریدی ئاسایی کاڵاکان پیشان دەدەین
        
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             // Append if not a new search, replace if it is
             renderProductsGridUI(isNewSearch ? null : result.products); // Use the grid renderer
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block'; // Show/hide scroll trigger
        
        // Fade bike bo productsContainer
        // فەید بکە بۆ productsContainer
        // (Ev ê an ji skeleton an jî ji dîzayna bilez-fadekirî were)
        // (ئەمە یان لە سکێڵتۆنەوە دێت یان لە دیزاینە خێرا فەیدکراوەکەوە)
        fadeContent(productsContainer, allToggleableContainers, false); // Her gav bi nermî fade bike (هەمیشە بە نەرمی فەید بکە)
    }
    // === END: KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===

    // Update category button states AFTER fetching and rendering
    renderMainCategoriesUI(); // Render main category buttons
    
    // === START: KODA ÇAKKIRÎ / کۆدی چاککراو (Bug 1) ===
    // Em êdî kontrola `!result.isHome` nakin. Em her gav hewl didin jêr-kategoriyan nîşan bidin.
    // Fonksiyona `renderSubcategoriesUI` bixwe dizane kengê xwe veşêre (mînak, dema ku state.currentCategory == 'all').
    // ئیتر پشکنینی `!result.isHome` ناکەین. هەمیشە هەوڵ دەدەین جۆرە لاوەکییەکان پیشان بدەین.
    // فەنکشنی `renderSubcategoriesUI` خۆی دەزانێت کەی خۆی بشارێتەوە (بۆ نموونە، کاتێک state.currentCategory == 'all').
    const subcats = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(subcats); // Render subcategory buttons and potentially sub-sub
    // === END: KODA ÇAKKIRÎ / کۆتایی کۆدی چاککراو (Bug 1) ===


    // *** 💡 DESTPÊKA ÇAKKIRINÊ (SCROLL FIX - AUTO) 💡 ***
    // Logica Scrollkirinê
    // /* GUHERTIN */ Tenê heke `shouldScrollToTop` rast be (true) سکڕۆڵ بکە.
    if (isNewSearch && shouldScrollToTop) {
        // 'behavior: "smooth"' hat guhertin bo 'behavior: "auto"'
        // 'behavior: "smooth"' گۆڕدرا بۆ 'behavior: "auto"'
        const activePage = document.getElementById('mainPage');
        if (activePage) {
            activePage.scrollTo({ top: 0, behavior: 'auto' }); // <-- *** گۆڕانکاری لێرە کرا ***
        } else {
            // Wekî paşverû heke 'mainPage' neyê dîtin
            console.warn('Could not find #mainPage to scroll.');
            window.scrollTo({ top: 0, behavior: 'auto' }); // <-- *** گۆڕانکاری لێرە کرا ***
        }
    }
    // *** 💡 DAWÎYA ÇAKKIRINÊ (SCROLL FIX - AUTO) 💡 ***
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// === START: KODA GUHERTÎ / کۆدی گۆڕاو ===
// Navê fonksiyonê ji 'renderHomePageContentUI' bû 'renderPageContentUI'
// ناوی فەنکشنەکە لە 'renderHomePageContentUI' گۆڕدرا بۆ 'renderPageContentUI'
/**
 * Renders a dynamic page layout (Home or Category) based on a layout array.
 * @param {Array|null} layoutSections - The array of layout sections. If null, fetches the default home layout.
 * @param {string} layoutType - 'home' an 'category'.
 * @param {string|null} layoutId - The ID of the category if layoutType is 'category'.
 */
export async function renderPageContentUI(layoutSections, layoutType = 'home', layoutId = null) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    let layoutToRender = layoutSections; // Dîzayna ku ji derve hatî (دیزاینی دەرەki)
    
    // === START: KODA ÇAKKIRÎ / کۆدی چاککراو (Bug 2 Fix) ===
    // TÊBÎNÎ: Ev `layoutType` ji `updateProductViewUI` tê
    // تێبینی: ئەم `layoutType`ـە لە `updateProductViewUI`ـەوە دێت
    if (!layoutToRender) {
        layoutToRender = await fetchHomeLayout(); 
        layoutType = 'home'; // Piştrast bike ku ev 'home' e (دڵنیا بکەوە کە ئەمە 'home'ـە)
        layoutId = null; // Rûpela malê ID tune (پەڕەی سەرەki ئایدی نییە)
    }
    // === END: KODA ÇAKKIRÎ / کۆتایی کۆدی چاککراو ===


    homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;

    homeSectionsContainer.innerHTML = ''; // Loader/naveroka berê paqij bike
    
    // === START: KODA ÇAKKIRÎ / کۆدی چاککراو (Bug 2 Fix) ===
    // Em cureyê dîzaynê û IDyê tomar dikin
    // ئێمە جۆری دیزاین و ئایدی پاشەکەوت دەکەین
    homeSectionsContainer.dataset.layoutType = layoutType;
    if (layoutId) {
        homeSectionsContainer.dataset.layoutId = layoutId;
    } else {
        homeSectionsContainer.removeAttribute('data-layout-id');
    }
    // === END: KODA ÇAKKIRÎ / کۆتایی کۆدی چاککراو ===
    
    if (!layoutToRender || layoutToRender.length === 0) {
        console.warn("Page layout is empty or failed to load.");
        // Dîmenek paşverû render bike (mînak, tenê beşa 'hemî kaڵا')
        // دیمەنێکی یەدەگ پیشان بدە (بۆ نموونە، تەنها بەشی 'هەموو کاڵاکان')
         const allProductsSection = await createAllProductsSectionElement();
         if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Navberên (intervals) slayderê yên heyî paqij bike berî renderkirina yên nû
    // ئینتەرڤاڵەکانی سلایدەری ئێستا پاک بکەوە پێش پیشاندانی ئەوانی نوێ
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of layoutToRender) {
        let sectionElement = null;
        try {
             switch (section.type) {
                 case 'promo_slider':
                     if (section.groupId) {
                         sectionElement = await createPromoSliderElement(section.groupId, section.id || section.groupId); // IDyek bêhempa bikar bîne
                     } else console.warn("Promo slider missing groupId:", section);
                     break;
                 case 'brands':
                     if (section.groupId) {
                          sectionElement = await createBrandsSectionElement(section.groupId);
                     } else console.warn("Brands section missing groupId:", section);
                     break;
                 case 'newest_products':
                     sectionElement = await createNewestProductsSectionElement();
                     break;
                 case 'single_shortcut_row':
                     if (section.rowId) {
                          sectionElement = await createSingleShortcutRowElement(section.rowId, section.name); // Pass name obj
                         } else console.warn("Shortcut row missing rowId:", section);
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                         sectionElement = await createSingleCategoryRowElement(section); // Pass full section data
                     } else console.warn("Category row missing categoryId:", section);
                     break;
                  case 'all_products':
                       sectionElement = await createAllProductsSectionElement();
                      break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
        } catch(error) {
             console.error(`Error rendering home section type ${section.type}:`, error);
              // Bi awayekî vebijarkî, cîgirek ku çewtiyê nîşan dide zêde bike
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
    setupScrollAnimations(); // Animasyonên skrolê ji nû ve bicîh bike
}
// === END: KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===

// --- UI Element Creation Functions for Home Page ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    // === KODA GUHERTÎ / کۆدی گۆڕاو ===
    // Em IDyek bêhempa çêdikin ku pêşî li pevçûnan bigire
    // ئێمە IDـیەکی بێهاوتا دروست دەکەین بۆ ڕێگری لە پێکدادان
    const uniqueSliderId = `promoSlider_${layoutId}_${Math.random().toString(36).substring(2, 9)}`;
    promoGrid.id = uniqueSliderId; // Unique ID
    // === KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===

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
             // === KODA GUHERTÎ / کۆدی گۆڕاو ===
             // Kontrol bike ka elementa rastîn hîn jî heye
             // پشکنین بکە بزانە توخمە ڕاستەقینەکە هێشتا ماوە
             if (!document.getElementById(uniqueSliderId) || !state.sliderIntervals || !state.sliderIntervals[uniqueSliderId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); // Clear this specific interval
                 if (state.sliderIntervals && state.sliderIntervals[uniqueSliderId]) delete state.sliderIntervals[uniqueSliderId]; // Remove from global state
                return;
             }
             // === KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            // === KODA GUHERTÎ / کۆدی گۆڕاو ===
            if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]); // Clear previous if any
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[uniqueSliderId] = sliderState.intervalId; // Store globally
            // === KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
        };
        const resetInterval = () => {
             // === KODA GUHERTÎ / کۆدی گۆڕاو ===
             if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]);
             // === KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
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
                 await updateProductViewUI(true, true); // Trigger full refresh /* GUHERTIN */
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
                  await updateProductViewUI(true, true); // Trigger full refresh /* GUHERTIN */
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
         
         // *** DESTPÊKA ÇAKKIRINÊ (Shortcut Card Fix) ***
         // Ev çareseriya ku te behs kir ji bo ku ew biçe rûpela hûrguliyan
         // ئەمە ئەو چارەسەرەیە کە تۆ باست کرد بۆ ئەوەی بچێتە پەڕەی وردەکاری
         item.onclick = async () => {
            
            // Pêşî kontrol bike ka ew ji bo rûpelek Subcategory ya taybet e
            // سەرەتا پشکنین بکە بزانە ئایا بۆ پەڕەیەکی جۆری لاوەکی تایبەتە
            if (cardData.subcategoryId && cardData.categoryId) {
                
                // Erê, rûpela hûrguliyên Subcategory veke
                // بەڵێ، پەڕەی وردەکاریی جۆری لاوەکی بکەوە
                showSubcategoryDetailPageUI(cardData.categoryId, cardData.subcategoryId);
            
            } else {
                
                // Na, tenê rûpela serekî fîlter bike (wek berê)
                // نەخێر، تەنها پەڕەی سەرەki فلتەر بکە (وەک jaran)
                await navigateToFilterCore({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all', // Dibe ku ev 'all' be
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
                await updateProductViewUI(true, true);
MSTUbZ
            }
         };
         // *** DAWÎYA ÇAKKIRINÊ ***
         
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

// *** DESTPÊKA GORANKARIYÊ ***
async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId, name } = sectionData; // 'name' ئیتر بەکارناهێت
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = ''; // Em êdî 'name' (navê admin) bikar naynin

    // Em HER DEM hewl didin ku navê rastîn ê kategoriyê ji Firestore bistînin
    // ئێمە هەمیشە هەوڵ دەدەین ناوی ڕاستەقینەی جۆرەکە لە فایەرستۆر بهێنین
    try {
        let targetDocRef;
        if (subSubcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubSubcategoryId}`);
        } else if (subcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        } else {
             // *** ÇAKKIRIN: Pêdivî ye ku em ID-ya kategoriyê diyar bikin ***
             // *** چاککراو: پێویستە IDی جۆرەکە دیاری بکەین ***
            targetDocRef = doc(db, 'categories', categoryId); 
        }
        
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان'; // Sernavê paşverû
        } else {
            title = 'کاڵاکان'; // Paşverû heke ref tune be
        }
    } catch (e) {
        console.warn("Could not fetch specific title for category row", e);
        title = 'کاڵاکان'; // Paşverû li ser çewtiyê
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
              await updateProductViewUI(true, true); // Trigger full refresh /* GUHERTIN */
         }
    };
    return container;
}
// *** DAWÎYA GORANKARIYÊ ***

async function createAllProductsSectionElement() {
    // === START: KODA GUHERTÎ / کۆدی گۆڕاو ===
    // Em tenê 10 kaڵa bar dikin, ne hemî
    // ئێمە تەنها 10 کاڵا بار دەکەین، نەک هەمووی
    const products = await fetchInitialProductsForHome(10); // 10 kaڵa bar bike
    // === END: KODA GUHERTÎ / کۆتایی کۆدی گۆڕاو ===
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px'; // Add some space before this section
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
             <!-- Em dikarin bişkokek "Binêre Hemî" li vir zêde bikin heke em bixwazin -->
             <!-- دەتوانین دوگمەیەکی "بینینی هەموو" لێرە زیاد بکەین ئەگەر بمانەوێت -->
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