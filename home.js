// home.js
// Logika UI تایبەت بە پەڕەی سەرەki (Home Page)

import {
    state, t, debounce,
    // === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
    // Em êdî hewce ne ku 'fetchHomeLayout' li vir import bikin,
    // ji ber ku 'fetchProducts' naha dîzaynê ji me re tîne.
    // Em tenê hewceyê fonksîyonên anîna daneyên beşan in.
    // ئیتر پێویست ناکات 'fetchHomeLayout' لێرە هاوردە بکەین،
    // چونکە 'fetchProducts' ئێستا دیزاینەکەمان بۆ دەهێنێت.
    // ئێمە تەنها پێویستمان بە فەنکشنەکانی هێنانی داتای بەشەکانە.
    fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    // === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===
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

    // === START: KODA NÛ / کۆدی نوێ ===
    // Heke dîzaynek xwerû ya kategoriyê çalak be, jêr-kategoriyan nîşan nede
    // ئەگەر دیزاینێکی تایبەتی جۆرەکان چالاک بوو، جۆرە لاوەکییەکان پیشان مەدە
    if (state.currentCategoryLayout) {
        subcategoriesContainer.style.display = 'none';
        return;
    }
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===

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

    // === START: KODA NÛ / کۆدی نوێ ===
    // Heke dîzaynek xwerû ya kategoriyê çalak be, jêr-kategoriyan nîşan nede
    // ئەگەر دیزاینێکی تایبەتی جۆرەکان چالاک بوو، جۆرە لاوەکییەکان پیشان مەدە
    if (state.currentCategoryLayout) {
        container.style.display = 'none';
        return;
    }
    // === END: KODA NÛ / کۆتایی کۆدی نوێ ===


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


// === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
// Fonksîyona sereke ya ku biryarê dide çi nîşan bide
// فەنکشنی سەرەki کە بڕیار دەدات چی پیشان بدات
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); // Main product grid container
    const skeletonLoader = document.getElementById('skeletonLoader'); // Main skeleton loader

    // 1. Daneyan ji 'core' bîne. 'Core' naha biryarê dide ka çi nîşan bide.
    // 1. داتا لە 'core' بهێنە. 'Core' ئێستا بڕیار دەدات چی پیشان بدات.
    const result = await fetchProducts(state.currentSearch, isNewSearch);
    if (result === null && !isNewSearch) return; // Barkirina zêde jixwe dest pê kiriye (بارکردنی زیاتر پێشتر دەستی پێکردووە)

    // 2. Biryar bide ka çi nîşan bidî li ser bingeha encamê.
    // 2. بڕیار بدە چی پیشان بدەیت بە پشتبەستن بە ئەنجام.
    const showDynamicLayout = result.isHome || result.isCustomLayout;
    const showProductGrid = !showDynamicLayout;

    // 3. Barkirina Skeletons/Loaders ji bo *lêgerînek nû*
    // 3. بارکردنی Skeletons/Loaders بۆ *گەڕانێکی نوێ*
    if (isNewSearch) {
        if (showDynamicLayout) {
            // Em dîzaynek xwerû nîşan didin. Grid/skeleton veşêre. Konteynara dîzaynê bi loader-a xwe nîşan bide.
            // ئێمە دیزاینێکی تایبەت پیشان دەدەین. Grid/skeleton بشارەوە. کۆنتەینەری دیزاینەکە بە لۆدەری خۆیەوە پیشان بدە.
            productsContainer.style.display = 'none';
            skeletonLoader.style.display = 'none';
            homeSectionsContainer.style.display = 'block';
            homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی دیزاینە</p></div>`;
            scrollTrigger.style.display = 'none';
        } else {
            // Em grid-ek standard a kaڵayan nîşan didin. Konteynara dîzaynê veşêre. Skeleton nîşan bide.
            // ئێمە gridـێکی ستانداردی کاڵاکان پیشان دەدەین. کۆنتەینەری دیزاینەکە بشارەوە. Skeleton پیشان بدە.
            homeSectionsContainer.style.display = 'none';
            productsContainer.style.display = 'none';
            renderSkeletonLoader(skeletonLoader); // Skeleton-ê sereke nîşan bide (Skeletonـی سەرەki پیشان بدە)
            skeletonLoader.style.display = 'grid';
            scrollTrigger.style.display = 'none';
        }
    }
    
    // 4. Naveroka rastîn nîşan bide
    // 4. ناوەڕۆکی ڕاستەقینە پیشان بدە
    skeletonLoader.style.display = 'none'; // Skeleton loader veşêre piştî barkirinê (Skeleton loader بشارەوە دوای بارکردن)

    if (showDynamicLayout) {
        // Em li ser Rûpela Malê (Home) an Kategoriyek Xwerû (Custom Category) ne.
        // ئێمە لەسەر لاپەڕەی سەرەki (Home) یان جۆرێکی تایبەت (Custom Category)ـین.
        // Fonksîyona nîşandanê ya nû bi daneyên dîzaynê re bang bike.
        // بانگی فەنکشنی پیشاندانی نوێ بکە لەگەڵ داتای دیزاینەکە.
        await renderDynamicLayoutUI(result.layout); // Ev ê cîhê loader-ê di homeSectionsContainer-ê de bigire (ئەمە شوێنی لۆدەرەکە لە homeSectionsContainer دەگرێتەوە)
        
        // Piştrast bike ku grid veşartî ye (incase it wasn't a new search)
        // دڵنیابە کە grid شاراوەیە (لە حاڵەتێکدا گەڕانێکی نوێ نەبوو)
        productsContainer.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';
        
    } else {
        // Em li ser grid-ek standard a kaڵayan in (jêr-kategorî, lêgerîn, an kategoriyek bê dîzayn)
        // ئێمە لەسەر gridـێکی ستانداردی کاڵاکانین (جۆری لاوەکی، گەڕان، یان جۆرێکی بێ دیزاین)
        homeSectionsContainer.style.display = 'none';
        productsContainer.style.display = 'grid';

        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
             // Eger lêgerînek nû nebe lê zêde bike, eger nû be cîhê wê bigire
             // زیاد بکە ئەگەر گەڕانێکی نوێ نەبوو، بیگۆڕە ئەگەر نوێ بوو
             renderProductsGridUI(isNewSearch ? null : result.products); // Renderer-a grid-ê bikar bîne (Rendererـی grid بەکاربهێنە)
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block'; // Trigger-a skrolê nîşan bide/veşêre (Triggerـی سکڕۆڵ پیشان بدە/بشارەوە)
    }

    // 5. Bişkokên kategoriyan û skrolê nû bike
    // 5. دوگمەکانی جۆرەکان و سکڕۆڵ نوێ بکەوە
    renderMainCategoriesUI(); // Bişkokên kategoriyên sereke nîşan bide (دوگمەکانی جۆرە سەرەkiـیەکان پیشان بدە)
    const subcats = await fetchSubcategories(state.currentCategory);
    await renderSubcategoriesUI(subcats); // Bişkokên jêr-kategoriyan (û dibe ku jêr-jêr-kategoriyan) nîşan bide (دوگمەکانی جۆرە لاوەکییەکان پیشان بدە)

    // Logika Skrolkirinê
    // لۆجیکی سکڕۆڵکردن
    if (isNewSearch && shouldScrollToTop) {
        // 'behavior: "smooth"' hat guhertin bo 'behavior: "auto"'
        // 'behavior: "smooth"' گۆڕدرا بۆ 'behavior: "auto"'
        const activePage = document.getElementById('mainPage');
        if (activePage) {
            activePage.scrollTo({ top: 0, behavior: 'auto' }); // <-- *** گۆڕانکاری لێرە کرا ***
        } else {
            console.warn('Could not find #mainPage to scroll.');
            window.scrollTo({ top: 0, behavior: 'auto' }); // <-- *** گۆڕانکاری لێرە کرا ***
        }
    }
}
// === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===


// === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
// Navê fonksîyonê hate guhertin (Navê fûnksiyonê hate guhertin)
// ناوی فەنکشنەکە گۆڕدرا
// *** ÇARESERÎ: Peyva 'export' lê zêde bike ***
// *** چارەسەر: وشەی 'export' زیاد بکە ***
export async function renderDynamicLayoutUI(layout) {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    // Loader-ê nîşan bide eger vala be (Loader پیشان بدە ئەگەر بەتاڵ بوو)
    if (homeSectionsContainer.innerHTML.trim() === '' || homeSectionsContainer.querySelector('#loader')) {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }
    
    // Daneyên dîzaynê (layout data) naha wekî argumanek tê (داتای دیزاین ئێستا وەک ئارگیومێnt دێت)
    // const layout = await fetchHomeLayout(); // <-- Ev rêz hate rakirin (ئەم دێڕە سڕایەوە)

    homeSectionsContainer.innerHTML = ''; // Loader/naveroka berê paqij bike (لۆدەر/ناوەڕۆکی پێشوو پاک بکەوە)

    if (!layout || layout.length === 0) {
        console.warn("Dynamic page layout is empty.");
        // Vegere ser nîşandana "hemî kaڵayan" ji bo vê kategoriyê
        // بگەڕێوە بۆ پیشاندانی "هەموو کاڵاکان" بۆ ئەم جۆرە
         const allProductsSection = await createAllProductsSectionElement();
         if(allProductsSection) homeSectionsContainer.appendChild(allProductsSection);
        return;
    }

    // Intervalên slayderê yên heyî paqij bike
    // ئینتەرڤاڵەکانی سلایدەری ئێستا پاک بکەوە
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    for (const section of layout) {
        let sectionElement = null;
        try {
             switch (section.type) {
                 case 'promo_slider':
                     if (section.groupId) {
                         sectionElement = await createPromoSliderElement(section.groupId, section.id);
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
                     if (section.mainCategoryId) { // *** GAUHERTIN: 'categoryId' bû 'mainCategoryId' ***
                         sectionElement = await createSingleCategoryRowElement(section); // Pass full section data
                     } else console.warn("Category row missing mainCategoryId:", section);
                     break;
                  case 'all_products':
                       sectionElement = await createAllProductsSectionElement();
                      break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
        } catch(error) {
             console.error(`Error rendering home section type ${section.type}:`, error);
              // Cihgirek nîşan bide ku çewtiyek ji bo vê beşê nîşan dide
             // شوێنگرەوەیەک پیشان بدە کە هەڵەیەک بۆ ئەم بەشە نیشان دەدات
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
    setupScrollAnimations(); // Ji bo kartên nû yên di nav beşan de anîmasyonên skrolê ji nû ve bicîh bîne (بۆ کارتە نوێیەکانی ناو بەشەکان ئەنیمەیشنی سکڕۆڵ دووبارە جێبەجێ بکە)
}
// === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===


// --- UI Element Creation Functions for Home Page ---
// (Ev fonksîyon wek xwe dimînin)
// (ئەم فەنکشنانە وەک خۆیان دەمێننەوە)

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
    // === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
    // Em naha 'mainCategoryId' li şûna 'categoryId' bikar tînin da ku bi admin.js re lihevhatî be
    // ئێمە ئێستا 'mainCategoryId' لەبری 'categoryId' بەکاردەهێنین بۆ ئەوەی لەگەڵ admin.js بگونجێت
    const { mainCategoryId, subcategoryId, subSubcategoryId } = sectionData;
    // Em 'sectionData' ya nû ji bo anîna kaڵayan bikar tînin
    // ئێمە 'sectionData' نوێیەکە بۆ هێنانی کاڵاکان بەکاردەهێنین
    const products = await fetchCategoryRowProducts({ categoryId: mainCategoryId, subcategoryId, subSubcategoryId });
    // === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===
    
    if (!products || products.length === 0) return null;

    let title = ''; // Em êdî 'name' (navê admin) bikar naynin

    // Em HER DEM hewl didin ku navê rastîn ê kategoriyê ji Firestore bistînin
    // ئێمە هەمیشە هەوڵ دەدەین ناوی ڕاستەقینەی جۆرەکە لە فایەرستۆر بهێنین
    try {
        let targetDocRef;
        if (subSubcategoryId) {
            targetDocRef = doc(db, `categories/${mainCategoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        } else if (subcategoryId) {
            targetDocRef = doc(db, `categories/${mainCategoryId}/subcategories/${subcategoryId}`);
        } else {
             // *** ÇAKKIRIN: Pêdivî ye ku em ID-ya kategoriyê diyar bikin ***
             // *** چاککراو: پێویستە IDی جۆرەکە دیاری بکەین ***
            targetDocRef = doc(db, 'categories', mainCategoryId); 
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
         // === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
         if(subcategoryId) { // Includes subSubcategoryId case, go to detail page
              showSubcategoryDetailPageUI(mainCategoryId, subcategoryId); // Use imported function
         } else { // Only main category, filter main page
              await navigateToFilterCore({ category: mainCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
              await updateProductViewUI(true, true); // Trigger full refresh /* GUHERTIN */
         }
         // === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===
    };
    return container;
}
// *** DAWÎYA GORANKARIYÊ ***

async function createAllProductsSectionElement() {
    // === START: KODA GAUHERTÎ / کۆدی گۆڕاو ===
    // Dema ku di nav dîzaynek xwerû de ye, ev êdî kaڵayan na-fetch dike,
    // lê tenê sînyalê dide UI ku dest bi nîşandana grid-a kaڵayên normal bike.
    // Dema ku 'all_products' di dîzayna kategoriyekê de tê bikar anîn,
    // 'updateProductViewUI' dê piştrast bike ku ev beş li şûna grid-ê tê nîşandan,
    // û paşê 'updateProductViewUI' dê dîsa were gazî kirin bêyî 'isCustomLayout' da ku kaڵayan barke.
    
    // Ev logica hanê tevlihev e. Em ê wê hêsan bikin:
    // Ev beş dê tenê kaڵayên kategoriyA HEYÎ nîşan bide.
    
    // 1. Kategoriya heyî bistîne
    // 1. جۆری ئێستا وەربگرە
    const categoryId = state.currentCategory;
    if (!categoryId || categoryId === 'all') {
         // Heke em li ser rûpela malê ne, kaڵayên destpêkê nîşan bide (wek berê)
         // ئەگər لەسەر لاپەڕەی ماڵەوەین، کاڵا سەرەتاییەکان پیشان بدە (وەک جاران)
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
         
    } else {
        // Heke em di nav kategoriyek xwerû de ne, kaڵayên VÊ KATEGORIYÊ nîşan bide
        // ئەگەر لەناو جۆرێکی تایبەتدابووین، کاڵاکانی ئەم جۆرە پیشان بدە
        const products = await fetchCategoryRowProducts({ categoryId: categoryId }); // 10 kaڵayên pêşîn ên kategoriyê bîne (10 کاڵای یەکەمی جۆرەکە بهێنە)
        if (!products || products.length === 0) return null;

        const container = document.createElement('div');
        container.className = 'dynamic-section';
        container.style.marginTop = '20px';
        
        // Sernavê kategoriyê bistîne
        // ناونیشانی جۆرەکە وەربگرە
        const category = state.categories.find(c => c.id === categoryId);
        const title = category ? (category['name_' + state.currentLanguage] || category.name_ku_sorani) : t('all_products_section_title');

        container.innerHTML = `
            <div class="section-title-header">
                <h3 class="section-title-main">${title}</h3>
                <a class="see-all-link" data-category-id="${categoryId}">${t('see_all')}</a>
            </div>
            <div class="products-container"></div>
        `;
        const productsGrid = container.querySelector('.products-container');
        products.forEach(product => {
            const card = createProductCardElementUI(product);
            productsGrid.appendChild(card);
        });
        
        // Bişkoja "See All" naha dê dîzayna xwerû rake û grid-a normal nîşan bide
        // دوگمەی "بینینی هەمووی" ئێستا دیزاینە تایبەتەکە لادەبات و gridـی ئاسایی پیشان دەدات
        container.querySelector('.see-all-link').onclick = async () => {
             state.currentCategoryLayout = null; // Dîzayna xwerû betal bike (دیزاینە تایبەتەکە هەڵبوەشێنەوە)
             // Em êdî navigateToFilterCore bikar naynin, ji ber ku em jixwe di kategoriya rast de ne
             // ئێمە ئیتر navigateToFilterCore بەکارناهێنین، چونکە پێشتر لە جۆری ڕاستداین
             await updateProductViewUI(true, true); // Tenê UIyê nû bike (تەنها UI نوێ بکەوە)
        };
        
        return container;
    }
    // === END: KODA GAUHERTÎ / کۆتایی کۆدی گۆڕاو ===
}