// home.js
// Logika UI تایبەت بە پەڕەی سەرەki (Home Page)

import {
    state, t, debounce,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchProducts,
    fetchSubSubcategories, // *** زیادکرا: هاوردەکردنی فانکشنی دروست ***
    // === START: BEŞÊN NÛ / بەشە نوێیەکان ===
    fetchCategoryLayout, fetchInitialProductsForCategory,
    // === END: BEŞÊN NÛ / کۆتایی بەشە نوێیەکان ===
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
// *** دەستپێک: گۆڕانکاری لێرە کرا ***
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
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); // Main product grid container
    const skeletonLoader = document.getElementById('skeletonLoader'); // Main skeleton loader

    /* GUHERTIN: Destpêk */
    // Em kontrol dikin ka gelo naveroka rûpela serekî jixwe hatiye barkirin,
    // da ku em wê ji nû ve bar nekin heke ne pêwîst be.
    // Em kontrol dikin ka ew vala ye an tenê loader têde ye.
    // === START: BEŞÊ NÛ / بەشی نوێ ===
    // Me şertê guhert: Divê em her gav loaderê nîşan bidin eger ew lêgerînek nû be,
    // ji ber ku dibe ku em ji rûpelek layoutê ya xwerû vegerin.
    // (مەرجمان گۆڕی: پێویستە هەمیشە لۆدەر پیشان بدەین ئەگەر گەڕانێکی نوێ بێت،
    // چونکە لەوانەیە لە لاپەڕەیەکی دیزاینی تایبەتەوە بگەڕێینەوە)
    const homeContentLoaded = homeSectionsContainer.innerHTML.trim() !== '' && !homeSectionsContainer.querySelector('#loader') && !isNewSearch;
    /* GUHERTIN: Dawî */
    // === END: BEŞÊ NÛ / کۆتایی بەشی نوێ ===


    // Show skeleton loader for new searches/filters that ARE NOT the home view
    const shouldShowHome = !state.currentSearch && state.currentCategory === 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    
    // === START: BEŞÊ NÛ / بەشی نوێ ===
    // Em ê `homeSectionsContainer` ji bo layoutên xwerû yên kategoriyan jî bikar bînin
    // (ئێمە `homeSectionsContainer` بۆ دیزاینە تایبەتەکانی جۆرەکانیش بەکاردەهێنین)
    if (isNewSearch && !shouldShowHome) {
        homeSectionsContainer.style.display = 'none'; // Veşêre heta ku em bizanibin ka ew layout e an na (بیشارەوە تا دەزانین دیزاینە یان نا)
        productsContainer.style.display = 'none'; // Hide product grid
        renderSkeletonLoader(skeletonLoader); // Use imported function
        skeletonLoader.style.display = 'grid'; // Show skeleton
        scrollTrigger.style.display = 'none'; // Hide scroll trigger during initial load
    } else if (isNewSearch && shouldShowHome) {
    // === END: BEŞÊ NÛ / کۆتایی بەشی نوێ ===
        /* GUHERTIN: Destpêk */
        // Berê, her gav loader dihat nîşandan dema ku vedigeriya mal.
        // Niha, em tenê loader-ê nîşan didin heke naveroka serekî *hîn nehatiye barkirin*.
        if (!homeContentLoaded) {
            // (Orjînal) Loader-ê nîşan bide ji ber ku naverok tune
            homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
            homeSectionsContainer.style.display = 'block';
            productsContainer.style.display = 'none';
            skeletonLoader.style.display = 'none';
            scrollTrigger.style.display = 'none';
        } else {
            // Naverok jixwe heye! Tenê konteyneran biguherîne.
            homeSectionsContainer.style.display = 'block'; // Naveroka heyî nîşan bide
            productsContainer.style.display = 'none'; // Tora berheman veşêre
            skeletonLoader.style.display = 'none';
            scrollTrigger.style.display = 'none';
        }
        /* GUHERTIN: Dawî */
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
        
        /* GUHERTIN: Destpêk */
        // Me `isNewSearch` ji vê mercê rakir.
        // Em naxwazin `renderHomePageContentUI` ji nû ve bixebitînin heke naverok jixwe hebe,
        // tenê heke ew bi rastî vala be (cara yekem) an hîn jî loader têde be.
        // === START: BEŞÊ NÛ / بەشی نوێ ===
        // Em `isNewSearch` lê zêde dikin ji ber ku dibe ku em ji rûpelek kategoriyê vegerin
        // (ئێمە `isNewSearch` زیاد دەکەین چونکە لەوانەیە لە پەڕەیەکی جۆرەوە بگەڕێینەوە)
        if (isNewSearch || homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
            await renderHomePageContentUI(); // Render home content (defined below)
        }
        // === END: BEŞÊ NÛ / کۆتایی بەشی نوێ ===
        /* GUHERTIN: Dawî */
    
    // === START: BEŞÊ NÛ / بەشی نوێ ===
    } else if (result.isCategoryLayout) {
        // Layouta xwerû ya kategoriyê hate dîtin! (دیزاینی تایبەتی جۆرەکە دۆزرایەوە!)
        productsContainer.style.display = 'none'; // Tora kaڵayên standard veşêre (تۆڕی کاڵا ستانداردەکان بشارەوە)
        scrollTrigger.style.display = 'none'; // Scroll trigger veşêre (سکڕۆڵەکە بشارەوە)
        homeSectionsContainer.style.display = 'block'; // Konteynira layoutê nîşan bide (کۆنتەینەری دیزاینەکە پیشان بدە)
        
        // Em fonksiyona xwe ya nû ya renderkirinê bang dikin (فەنکشنە نوێیەکەی پیشاندان بانگ دەکەین)
        await renderCategoryLayoutContentUI(result.layout, result.categoryId); 
    // === END: BEŞÊ NÛ / کۆتایی بەشی نوێ ===

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


// === START: BEŞÊN NÛ / بەشە نوێیەکان ===
// Em 'renderHomePageContentUI' ji nû ve saz dikin (Refactor) da ku motorek hevbeş bikar bîne
// (ئێمە `renderHomePageContentUI` دووبارە ڕێکدەخەینەوە (Refactor) بۆ بەکارهێنانی بزوێنەرێکی هاوبەش)

/**
 * Motora bingehîn ji bo renderkirina rêzika layoutê (home an category)
 * (بزوێنەری سەرەki بۆ پیشاندانی ڕیزبەندی دیزاین (سەرەki یان جۆر))
 * @param {HTMLElement} container - Konteynira ku tê de were render kirin (کۆنتەینەرێک بۆ پیشاندان تێیدا)
 * @param {Array} layout - Rêzika layoutê (ڕیزبەندی دیزاینەکە)
 * @param {string|null} categoryId - IDya kategoriyê (eger ji bo kategoriyekê be) (ئایدی جۆرەکە (ئەگەر بۆ جۆرێک بێت))
 */
async function renderLayoutContent(container, layout, categoryId = null) {
    if (!container) return;

    // Loaderê nîşan bide (لۆدەر پیشان بدە)
    if (container.innerHTML.trim() === '' || container.querySelector('#loader')) {
        container.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    // Li benda çareserbûna layoutê bise (چاوەڕێی وەرگرتنی دیزاینەکە بکە)
    const resolvedLayout = await layout;
    container.innerHTML = ''; // Loader/naveroka berê paqij bike (لۆدەر/ناوەڕۆکی پێشوو پاک بکەوە)

    if (!resolvedLayout || resolvedLayout.length === 0) {
        console.warn("Layout is empty or failed to load. Rendering fallback.");
        // Fallback: Tenê beşa "Hemû Kaڵa" render bike (پاشگەزبوونەوە: تەنها بەشی "هەموو کاڵاکان" پیشان بدە)
        const allProductsSection = categoryId 
            ? await createAllProductsForCategorySectionElement(categoryId) 
            : await createAllProductsSectionElement();
        if (allProductsSection) container.appendChild(allProductsSection);
        return;
    }

    // Navberên (intervals) slayderên kevn paqij bike (ئینتەرڤاڵەکانی سلایدەری کۆن پاک بکەوە)
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of resolvedLayout) {
        let sectionElement = null;
        try {
            // Em fonksiyona xwe ya hevbeş a nû bang dikin (فەنکشنە هاوبەشە نوێیەکەمان بانگ دەکەین)
            sectionElement = await createLayoutSectionElement(section, categoryId);
        } catch(error) {
             console.error(`Error rendering layout section type ${section.type}:`, error);
             sectionElement = document.createElement('div');
             sectionElement.style.padding = '20px';
             sectionElement.style.textAlign = 'center';
             sectionElement.style.color = 'red';
             sectionElement.textContent = `هەڵە لە بارکردنی بەشی: ${section.type}`;
        }

        if (sectionElement) {
            container.appendChild(sectionElement);
        }
    }
    setupScrollAnimations(); // Animasyonên scrollê ji nû ve bicîh bîne (ئەنیمەیشنەکانی سکڕۆڵ دووبارە جێبەجێ بکە)
}

/**
 * Rûpela serekî (Home) render dike (پەڕەی سەرەki پیشان دەدات)
 */
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    // Em layouta home tînin û didin motora giştî (دیزاینی پەڕەی سەرەki دەهێنین و دەیدەین بە بزوێنەرە گشتییەکە)
    await renderLayoutContent(homeSectionsContainer, fetchHomeLayout(), null);
}

/**
 * Layouta xwerû ya kategoriyê render dike (دیزاینی تایبەتی جۆرەکە پیشان دەدات)
 * @param {Array} layout - Rêzika layoutê (ڕیزبەندی دیزاینەکە)
 * @param {string} categoryId - IDya kategoriyê (ئایدی جۆرەکە)
 */
async function renderCategoryLayoutContentUI(layout, categoryId) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    // Em layouta ku jixwe hatiye wergirtin didin motora giştî (ئێمە ئەو دیزاینەی کە وەرگیراوە دەیدەین بە بزوێنەرە گشتییەکە)
    await renderLayoutContent(homeSectionsContainer, layout, categoryId);
}

/**
 * Motora Hevbeş: Elementek beşa layoutê diafirîne (بزوێنەری هاوبەش: توخمێکی بەشی دیزاین دروست دەکات)
 * @param {object} section - Objekta beşa ji layoutê (ئۆبجێکتی بەشێک لە دیزاینەکە)
 * @param {string|null} categoryId - IDya kategoriya dêûbav (eger hebe) (ئایدی جۆری باوان (ئەگەر هەبێت))
 */
async function createLayoutSectionElement(section, categoryId = null) {
    switch (section.type) {
        case 'promo_slider':
            if (section.groupId) {
                return await createPromoSliderElement(section.groupId, section.id);
            } else console.warn("Promo slider missing groupId:", section);
            break;
        case 'brands':
            if (section.groupId) {
                 return await createBrandsSectionElement(section.groupId);
            } else console.warn("Brands section missing groupId:", section);
            break;
        case 'newest_products':
            return await createNewestProductsSectionElement();
        case 'single_shortcut_row':
            if (section.rowId) {
                 return await createSingleShortcutRowElement(section.rowId, section.name); // Pass name obj
                } else console.warn("Shortcut row missing rowId:", section);
            break;
        case 'single_category_row':
            if (section.categoryId) {
                return await createSingleCategoryRowElement(section); // Pass full section data
            } else console.warn("Category row missing categoryId:", section);
            break;
         case 'all_products':
              return await createAllProductsSectionElement();
        
        // --- Cûreyên Nû yên Taybet ji bo Kategoriyan (جۆرە نوێیە تایبەتەکان بۆ جۆرەکان) ---
        case 'subcategories':
            if (categoryId) {
                return await createSubcategoriesSectionElement(categoryId);
            } else console.warn("`subcategories` section type requires a categoryId, but was used on home.");
            break;
        case 'all_products_for_category':
            if (categoryId) {
                return await createAllProductsForCategorySectionElement(categoryId);
            } else console.warn("`all_products_for_category` section type requires a categoryId, but was used on home.");
            break;

        default:
            console.warn(`Unknown layout section type: ${section.type}`);
    }
    return null; // Ji bo cûreyên nenas null vegerîne (بۆ جۆرە نەناسراوەکان null بگەڕێنەوە)
}
// === END: BEŞÊN NÛ / کۆتایی بەشە نوێیەکان ===


// --- UI Element Creation Functions for Home Page ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; // Use grid for single item layout
    promoGrid.style.marginBottom = '24px';
    promoGrid.id = `promoSliderLayout_${layoutId}`; // Unique ID

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
                // نەخێر، تەنها پەڕەی سەرەki فلتەر بکە (وەک جاران)
                await navigateToFilterCore({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all', // Dibe ku ev 'all' be
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
                await updateProductViewUI(true, true);
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
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
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
    const products = await fetchInitialProductsForHome();
    if (!products || products.length === 0) return null;

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


// === START: BEŞÊN NÛ / بەشە نوێیەکان ===
/**
 * Beşek ji bo nîşandana jêr-kategoriyên kategoriyekê di layouta xwerû de çêdike
 * (بەشێک دروست دەکات بۆ پیشاندانی جۆرە لاوەکییەکانی جۆرێک لە دیزاینی تایبەتدا)
 * @param {string} categoryId IDya kategoriya dêûbav (ئایدی جۆری باوان)
 */
async function createSubcategoriesSectionElement(categoryId) {
    if (!categoryId) return null;
    
    const subcategoriesData = await fetchSubcategories(categoryId);
    if (!subcategoriesData || subcategoriesData.length === 0) return null;
    
    // Em heman stîlên ji beşa jorîn bikar tînin (هەمان ستایلەکانی بەشی سەرەوە بەکاردەهێنین)
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'section'; 
    sectionContainer.style.padding = '16px 0 0 0'; // Hinek padding (هەندێک پادینگ)
    sectionContainer.style.boxShadow = 'none';
    sectionContainer.style.border = 'none';
    sectionContainer.style.background = 'transparent';

    const subcategoriesContainer = document.createElement('div');
    subcategoriesContainer.className = 'subcategories-container';
    
    // "Hemû" lê zêde neke, tenê jêr-kategoriyên rastîn nîşan bide
    // ("هەموو" زیاد مەکە، تەنها جۆرە لاوەکییە ڕاستەقینەکان پیشان بدە)
    subcategoriesData.forEach(subcat => {
        const subcatBtn = document.createElement('button');
        subcatBtn.className = 'subcategory-btn';
        subcatBtn.dataset.id = subcat.id;
        const subcatName = subcat['name_' + state.currentLanguage] || subcat.name_ku_sorani;
        const placeholderImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imageUrl = subcat.imageUrl || placeholderImg;

        subcatBtn.innerHTML = `
             <img src="${imageUrl}" alt="${subcatName}" class="subcategory-image" onerror="this.src='${placeholderImg}';">
             <span>${subcatName}</span>
        `;
        // Klika li ser vê, rûpela hûrguliyan vedike (کلیک لەسەر ئەمە، لاپەڕەی وردەکارییەکان دەکاتەوە)
        subcatBtn.onclick = async () => {
            showSubcategoryDetailPageUI(categoryId, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });
    
    sectionContainer.appendChild(subcategoriesContainer);
    return sectionContainer;
}

/**
 * Beşek ji bo nîşandana "Hemû Kaڵa" ji bo kategoriyekê di layouta xwerû de çêdike
 * (بەشێک دروست دەکات بۆ پیشاندانی "هەموو کاڵاکان" بۆ جۆرێک لە دیزاینی تایبەتدا)
 * @param {string} categoryId IDya kategoriya dêûbav (ئایدی جۆری باوان)
 */
async function createAllProductsForCategorySectionElement(categoryId) {
    const products = await fetchInitialProductsForCategory(categoryId); // Fonksiyona nû bang bike (فەنکشنە نوێیەکە بانگ بکە)
    if (!products || products.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'dynamic-section';
    container.style.marginTop = '20px';
    container.innerHTML = `
        <div class="section-title-header">
            <h3 class="section-title-main">${t('all_products_section_title')}</h3>
            </div>
        <div class="products-container"></div>
    `;
    const productsGrid = container.querySelector('.products-container');
    products.forEach(product => {
        const card = createProductCardElementUI(product); // Fonksiyona hevbeş bikar bîne (فەنکشنە هاوبەشەکە بەکاربهێنە)
        productsGrid.appendChild(card);
    });
    return container;
}
// === END: BEŞÊN NÛ / کۆتایی بەشە نوێیەکان ===