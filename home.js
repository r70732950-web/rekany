// home.js
// Logika UI تایبەت بە پەڕەی سەرەki (Home Page)

import {
    state, t, debounce,
    fetchHomeLayout, fetchProducts, fetchSubcategories, navigateToFilterCore,
    fetchSubSubcategories, fetchCategoryLayout // <-- Koda nû
} from './app-core.js';

import {
    renderSkeletonLoader, createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI,
    // === START: KODA NÛ / کۆدی نوێ ===
    // Em fonksyonên çêkirina beşan ji 'app-ui.js' import dikin
    // ئێمە فەنکشنەکانی دروستکردنی بەشەکان لە 'app-ui.js' هاوردە دەکەین
    createPromoSliderElement, createBrandsSectionElement, createNewestProductsSectionElement,
    createSingleShortcutRowElement, createSingleCategoryRowElement, createAllProductsSectionElement
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

// Renders product cards in the main grid
export function renderProductsGridUI(newProductsOnly = false) {
    const container = document.getElementById('productsContainer'); 
    if (!container) return;

    if (Array.isArray(newProductsOnly)) { 
        newProductsOnly.forEach(item => {
            let element = createProductCardElementUI(item); 
            element.classList.add('product-card-reveal'); 
            container.appendChild(element);
        });
    } else {
        container.innerHTML = '';
        if (!state.products || state.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
        } else {
            state.products.forEach(item => {
                let element = createProductCardElementUI(item); 
                element.classList.add('product-card-reveal'); 
                container.appendChild(element);
            });
        }
    }
    setupScrollAnimations(); 
}

// Renders main category buttons (Top horizontal scroll)
export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

    // 1. زیادکردنی دوگمەی "سەرەki" (Home) بە شێوەی دەستی
    const homeBtn = document.createElement('button');
    homeBtn.className = 'main-category-btn';
    homeBtn.dataset.category = 'all'; 
    homeBtn.innerHTML = `<i class="fas fa-home"></i> <span>${t('nav_home')}</span>`;

    if (state.currentCategory === 'all') {
        homeBtn.classList.add('active');
    }

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
             resetScrollPosition(container); 
             await navigateToFilterCore({
                 category: cat.id,
                 subcategory: 'all', // <-- Ev girîng e (ئەمە گرنگە)
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
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); // Get sub-sub container

    subcategoriesContainer.innerHTML = ''; // Clear previous
    subSubcategoriesContainer.innerHTML = ''; // Clear sub-sub
    subSubcategoriesContainer.style.display = 'none'; // Hide sub-sub initially

    // Heke 'all' (Serekî) hatibe hilbijartin, ti jêr-kategorî nîşan nede
    // ئەگەر 'all' (سەرەki) هەڵبژێردرابێت، هیچ جۆرێکی لاوەکی nishan مەدە
    if (!subcategoriesData || subcategoriesData.length === 0 || state.currentCategory === 'all') {
         subcategoriesContainer.style.display = 'none'; // Hide if no subcategories or 'All' is selected
         return;
    }

    subcategoriesContainer.style.display = 'flex'; // Show if there are subcategories

    // Zêdekirina bişkoka "Hemî" (All)
    // زیادکردنی دوگمەی "هەموو" (All)
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all'; // Add dataset id
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    
    // === GORANKARIYA LI GOR DAWAKARIYA TE / گۆڕانکاری بەپێی داواکاریی تۆ ===
    // Dema ku li ser "Hemî" (All) bitikîne, ew tenê 'subcategory' dike 'all'
    // کاتێک کلیک لە "هەموو" (All) دەکات، تەنها 'subcategory' دەکات بە 'all'
    allBtn.onclick = async () => {
         resetScrollPosition(subcategoriesContainer); 
         await navigateToFilterCore({
             category: state.currentCategory, // Kategoriya serekî diparêze (جۆری سەرەki دەپارێزێت)
             subcategory: 'all', // Vê yekê wek 'hemî' destnîşan dike (ئەمە وەک 'هەموو' دادەنێت)
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
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
        
        // Dema ku li ser jêr-kategoriyek taybetî bitikîne
        // کاتێک کلیک لە جۆرێکی لاوەکی دیاریکراو دەکات
        subcatBtn.onclick = async () => {
            resetScrollPosition(subcategoriesContainer); 
            // Ew diçe lîsteya standard a kaڵayan
            // دەچێت بۆ لیستی ستانداردی کاڵاکان
            showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });

     // Heke jêr-kategoriyek taybetî hatibe hilbijartin, jêr-jêr-kategoriyan nîşan bide
     // ئەگەر جۆرێکی لاوەکی دیاریکراو هەڵبژێردرابوو، جۆرە لاوەکییەکانی-لاوەکی پیشان بدە
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

    const subSubcategoriesData = await fetchSubSubcategories(mainCatId, subCatId); 

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
         resetScrollPosition(container); 
         // Vegere ser lîsteya kaڵayên jêr-kategoriya dêûbav
         // بگەڕێوە سەر لیستی کاڵاکانی جۆری لاوەکی باوان
         showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory);
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

        btn.onclick = async () => {
             resetScrollPosition(container); 
             // Her weha vegere ser rûpela dêûbav
             // هەروا بگەڕێوە سەر پەڕەی باوان
             showSubcategoryDetailPageUI(state.currentCategory, state.currentSubcategory);
        };
        container.appendChild(btn);
    });
}


// === START: KODA NÛ / کۆدی نوێ ===
// Fonksiyonek nû ya giştî ji bo nîşandana her dîzaynekê
// فەنکشنێکی نوێی گشتی بۆ پیشاندانی هەر دیزاینێک
async function renderLayoutUI(layout, container) {
    if (!container) return;
    
    // Paqij bike berî nîşandanê
    // پاکی بکەوە پێش پیشاندان
    container.innerHTML = ''; 
    
    // Navberên (intervals) kevn paqij bike
    // ئینتەرڤاڵە کۆنەکان پاک بکەوە
    Object.values(state.sliderIntervals || {}).forEach(clearInterval);
    state.sliderIntervals = {};

    let hasDynamicAllProducts = false; // Ji bo şopandina beşa 'all_products'

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
                          sectionElement = await createSingleShortcutRowElement(section.rowId, section.name); // Navê obj derbas bike
                         } else console.warn("Shortcut row missing rowId:", section);
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                         sectionElement = await createSingleCategoryRowElement(section); // Daneyên tevahî yên beşê derbas bike
                     } else console.warn("Category row missing categoryId:", section);
                     break;
                  case 'all_products':
                       sectionElement = await createAllProductsSectionElement();
                       hasDynamicAllProducts = true; // Nîşan bike ku ev beş heye
                      break;
                 default:
                     console.warn(`Unknown home layout section type: ${section.type}`);
             }
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
    setupScrollAnimations(); // Animasyonên skrolê ji nû ve saz bike
    return hasDynamicAllProducts; // Vegerîne ka beşa 'all_products' tê de ye yan na
}


// Function to render home page sections (UI Part)
export async function renderHomePageContentUI() {
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    if (!homeSectionsContainer) return;

    if (homeSectionsContainer.innerHTML.trim() === '') {
        homeSectionsContainer.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">...خەریکی بارکردنی بەشەکانە</p></div>`;
    }

    const layout = await fetchHomeLayout(); // Dîzayna Rûpela Malê bîne

    if (!layout || layout.length === 0) {
        console.warn("Home page layout is empty or failed to load.");
        homeSectionsContainer.innerHTML = ''; // Loaderê rake
        return false; // Tiştek nehat nîşandan
    }
    
    // Dîzayna Rûpela Malê bi fonksiyona giştî nîşan bide
    // دیزاینی پەڕەی سەرەki بە فەنکشنە گشتییەکە پیشان بدە
    const hasAllProducts = await renderLayoutUI(layout, homeSectionsContainer);
    return hasAllProducts; // Vegerîne ka beşa 'all_products' tê de ye
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// Handles applying the current filter state to the UI (fetching & rendering home/products)
export async function updateProductViewUI(isNewSearch = false, shouldScrollToTop = true) {
    const scrollTrigger = document.getElementById('scroll-loader-trigger');
    const homeSectionsContainer = document.getElementById('homePageSectionsContainer');
    const productsContainer = document.getElementById('productsContainer'); // Main product grid container
    const skeletonLoader = document.getElementById('skeletonLoader'); // Main skeleton loader

    // --- MANTIQA NÛ YA KONTROLKIRINÊ / لۆجیکی نوێی کۆنترۆلکردن ---

    // 1. Kontrol bike ka ew Rûpela Malê ya Rastîn (True Home) e
    // 1. پشکنین بکە بزانە ئایا پەڕەی سەرەkiی ڕاستەقینەیە
    const isTrueHome = !state.currentSearch && state.currentCategory === 'all';
    
    // 2. Kontrol bike ka ew Rûpela "Hemî" (All) ya Kategoriyekê ye
    // 2. پشکنین بکە بزانە ئایا پەڕەی "هەموو" (All)ی جۆرێکە
    const isCategoryAllPage = !state.currentSearch && state.currentCategory !== 'all' && state.currentSubcategory === 'all' && state.currentSubSubcategory === 'all';
    
    // 3. Wekî din, ew Lîsteyek Kaڵaya Standard e (lêgerîn, jêr-kategorî, hwd.)
    // 3. ئەگەرنا، ئەوا لیستی کاڵای ستانداردە (گەڕان، جۆری لاوەکی، هتد.)
    const isProductList = !isTrueHome && !isCategoryAllPage;

    let customLayout = null; // Ji bo hilanîna dîzayna xwerû
    let showProductsSeparately = false; // Flag ji bo nîşandana kaڵayan LI BIN dîzaynê

    // --- Destpêka Barkirinê / دەستپێکی بارکردن ---
    
    if (isNewSearch) {
        // Heke lêgerînek nû be, her tiştî veşêre û skeleton nîşan bide
        // ئەگەر گەڕانێکی نوێ بێت، هەموو شتێک بشارەوە و سکێلێتۆن پیشان بدە
        homeSectionsContainer.style.display = 'none';
        productsContainer.style.display = 'none';
        renderSkeletonLoader(skeletonLoader);
        skeletonLoader.style.display = 'grid';
        scrollTrigger.style.display = 'none';
    }

    // --- Anîna Daneyan / هێنانی داتا ---

    if (isTrueHome) {
        // Em li Rûpela Malê ne, dîzayna Rûpela Malê nîşan bide
        // ئێمە لە پەڕەی سەرەkiین، دیزاینی پەڕەی سەرەki پیشان بدە
        const hasAllProducts = await renderHomePageContentUI();
        showProductsSeparately = !hasAllProducts; // Heke 'all_products' di dîzaynê de nebe, wan li jêr nîşan bide
    } 
    else if (isCategoryAllPage) {
        // Em li Rûpela "Hemî" ya Kategoriyekê ne, hewl bide dîzaynek xwerû bîne
        // ئێمە لە پەڕەی "هەموو"ی جۆرێکین، هەوڵ بدە دیزاینێکی تایبەت بهێنە
        customLayout = await fetchCategoryLayout(state.currentCategory);

        if (customLayout) {
            // Dîzaynek xwerû hate dîtin! Wê nîşan bide.
            // دیزاینێکی تایبەت دۆزراوەتەوە! پیشانی بدە.
            const hasAllProducts = await renderLayoutUI(customLayout, homeSectionsContainer);
            showProductsSeparately = !hasAllProducts;
        } else {
            // Dîzaynek xwerû tune, divê em tenê lîsteya kaڵayan nîşan bidin
            // دیزاینێکی تایبەت نییە، دەبێت تەنها لیستی کاڵاکان پیشان بدەین
            showProductsSeparately = true;
        }
    } 
    else {
        // Ev Lîsteyek Kaڵaya Standard e (lêgerîn an jêr-kategorî)
        // ئەمە لیستی کاڵای ستانداردە (گەڕان یان جۆری لاوەکی)
        showProductsSeparately = true;
    }

    // --- Nîşandana Lîsteya Kaڵayan (Heke Pêwîst be) / پیشاندانی لیستی کاڵاکان (ئەگەر پێویست بوو) ---

    if (showProductsSeparately) {
        // Pêwîst e em lîsteya kaڵayan nîşan bidin (an ji ber ku dîzaynek xwerû tune,
        // an ji ber ku beşa 'all_products' di dîzaynê de nebû)
        // پێویستە لیستی کاڵاکان پیشان بدەین (یان چونکە دیزاینێکی تایبەت نییە،
        // یان چونکە بەشی 'all_products' لە دیزاینەکەدا نەبوو)
        
        // Heke ew lêgerînek nû be, dibe ku 'homeSectionsContainer' hîn jî xuya be (mînak, li Rûpela Malê)
        // Em wê vedişêrin da ku tenê lîsteya kaڵayan nîşan bidin, HEYA KU 'isCategoryAllPage' be
        // ئەگەر گەڕانێکی نوێ بێت، لەوانەیە 'homeSectionsContainer' هێشتا دیار بێت (بۆ نموونە، لە پەڕەی سەرەki)
        // دەیشارینەوە بۆ ئەوەی تەنها لیستی کاڵاکان پیشان بدەین، مەگەر 'isCategoryAllPage' بێت
        if (isProductList) {
             homeSectionsContainer.style.display = 'none'; // Bi tevahî veşêre (تەواو بیشارەوە)
        } else if (isCategoryAllPage && customLayout) {
             // Dîzayn hate nîşandan, lê 'all_products' têde nebû
             // Kaڵayan li binê dîzaynê nîşan bide
             // دیزاینەکە پیشان درا، بەڵام 'all_products'ی تێدا نەبوو
             // کاڵاکان لە ژێر دیزاینەکە پیشان بدە
             homeSectionsContainer.style.display = 'block'; 
        } else {
             // Dîzayn tune bû (customLayout = null)
             // دیزاین نەبوو (customLayout = null)
             homeSectionsContainer.style.display = 'none';
        }
        
        productsContainer.style.display = 'grid'; // Lîsteya kaڵayan nîşan bide

        // Kaڵayan ji bo fîltera heyî bîne (tevî lêgerînê)
        // کاڵاکان بۆ فلتەری ئێستا بهێنە (گەڕانیش لەخۆ دەگرێت)
        const result = await fetchProducts(state.currentSearch, isNewSearch);
        
        if (result.error) {
            productsContainer.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هەڵەیەک ڕوویدا.</p>';
        } else {
            // Heke ew di nav beşa 'all_products' ya dînamîk de be, wê dagire
            // ئەگەر لەناو بەشی 'all_products'ی داینامیکدا بێت، پڕی بکەوە
            const dynamicAllProductsContainer = document.getElementById('dynamicAllProductsContainer');
            if (dynamicAllProductsContainer && isNewSearch) {
                 const grid = dynamicAllProductsContainer.querySelector('.products-container');
                 grid.innerHTML = '';
                 state.products.forEach(item => {
                     let element = createProductCardElementUI(item);
                     grid.appendChild(element);
                 });
                 setupScrollAnimations();
                 // Konteynira sereke ya kaڵayan veşêre ji ber ku ew di nav dîzaynê de hatine nîşandan
                 // کۆنتەینەری سەرەki کاڵاکان بشارەوە چونکە لەناو دیزاینەکە پیشان دراون
                 productsContainer.style.display = 'none'; 
            } else {
                 // Wekî din, wan di konteynira sereke ya kaڵayan de nîşan bide
                 // ئەگەرنا، لەناو کۆنتەینەری سەرەki کاڵاکان پیشانیان بدە
                renderProductsGridUI(isNewSearch ? null : result.products); 
            }
        }
        scrollTrigger.style.display = result.allLoaded ? 'none' : 'block';
        
    } else {
        // Dîzaynek xwerû hate nîşandan Û beşa 'all_products' tê de bû
        // Tenê konteynira kaڵayan a sereke veşêre
        // دیزاینێکی تایبەت پیشان درا و بەشی 'all_products'ی تێدا بوو
        // تەنها کۆنتەینەری سەرەki کاڵاکان بشارەوە
        productsContainer.style.display = 'none';
        scrollTrigger.style.display = 'none';
        homeSectionsContainer.style.display = 'block';
    }

    // Piştî her tiştî skeletonê veşêre
    // دوای هەموو شتێک سکێلێتۆنەکە بشارەوە
    skeletonLoader.style.display = 'none';

    // --- Dawî / کۆتایی ---

    // Bişkokên kategoriyan nû bike
    // دوگمەکانی جۆرەکان نوێ بکەوە
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
// Ji bo 'app-ui.js' berdest bike
// بۆ 'app-ui.js' بەردەستی دەکەین
window.updateProductViewUI = updateProductViewUI;