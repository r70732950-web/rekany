// home.js
// Logika UI تایبەت بە دروستکردنی دیزاینەکان (Layouts) و لیستی بەرهەمەکان (Product Grids)
// Ev fayl êdî biryar nade ka çi nîşan bide, ew tenê tiştan "ava dike" (dروست دەکات)
// ئەم فایلە ئیتر بڕیar نادات چی پیشان بدرێت، تەنها شتەکان "دروست دەکات"

import {
    // Import state û fonksiyonên bingehîn (هاوردەکردنی ستەیت و فەنکشنە بنەڕەتییەکان)
    state, t, debounce,
    fetchHomeLayout, fetchPromoGroupCards, fetchBrandGroupBrands, fetchNewestProducts,
    fetchShortcutRowCards, fetchCategoryRowProducts, fetchInitialProductsForHome,
    fetchSubcategories, navigateToFilterCore,
    fetchSubSubcategories, 
    db, doc, getDoc,
    // Em 'updateProductViewUI' ji 'app-ui' import dikin da ku 'mainCategories' kar bike
    // ئێمە 'updateProductViewUI' لە 'app-ui' هاوردە دەکەین بۆ ئەوەی 'mainCategories' کار بکات
} from './app-core.js';

// === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
// Em fonksîyonên ku em hewce ne ji 'app-ui' import dikin
// ئێمە ئەو فەنکشنانە هاوردە دەکەین کە لە 'app-ui' پێویستمان پێیانە
import {
    createProductCardElementUI, setupScrollAnimations, showSubcategoryDetailPageUI,
    renderSkeletonLoader,
    updateProductViewUI // Ev ji bo bişkokên kategoriyê girîng e (ئەمە بۆ دوگمەکانی پۆلێن گرنگە)
} from './app-ui.js';
// === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===


// --- Fonksîyona Alîkar (فەنکشنی یاریدەدەر) ---

/**
 * Cihê skrola horizontal a konteynirê sifir dike.
 * شوێنی سکڕۆڵی ئاسۆیی کۆنتەینەرەکە سفر دەکاتەوە.
 * @param {HTMLElement} containerElement Konteynira ku were skrol kirin (کۆنتەینەرێک کە سکڕۆڵ بکرێت).
 */
function resetScrollPosition(containerElement) {
    if (containerElement) {
        containerElement.scrollTo({
            left: 0,
            behavior: 'smooth' 
        });
    }
}

// --- Avakerên UI yên ku têne Export kirin (بۆ app-ui.js) ---
// --- دروستکەرەکانی UI کە هەناردە دەکرێن (بۆ app-ui.js) ---

/**
 * Dîzaynek rûpelê (Mal an Kategorî) li ser bingeha rêzek beşan ava dike.
 * Ev fonksîyon tenê carekê ji bo her dîzaynê tê bang kirin (ji hêla updateProductViewUI).
 * * دیزاینێکی لاپەڕە (ماڵەوە یان پۆلێن) لەسەر بنەمای زنجیرەیەک بەش دروست دەکات.
 * ئەم فەنکشنە تەنها یەک جار بۆ هەر دیزاینێک بانگ دەکرێت (لەلایەن updateProductViewUI).
 * * @param {Array|null} layoutSections - Rêza beşên dîzaynê (زنجیرەی بەشەکانی دیزاین).
 * @param {HTMLElement} container - Konteynira ku tê dagirtin (کۆنتەینەرێک کە پڕ دەکرێتەوە).
 * @param {string} layoutId - IDya cacheyê ('home' an IDya kategoriyê) (IDی کاش 'home' یان IDی پۆلێن).
 */
export async function renderPageContentUI(layoutSections, container, layoutId) {
    if (!container) return;

    let layoutToRender = layoutSections; 

    // Loaderê nîşan bide (لۆدەر پیشان بدە)
    container.innerHTML = `<div id="loader" style="text-align: center; padding: 40px; color: var(--dark-gray); display: block;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">${t('loading_sections')}</p></div>`;

    if (!layoutToRender) {
        // Heke ti dîzayn nehatibe dayîn (ji bo rûpela malê), dîzayna malê ya default bîne
        // ئەگەر هیچ دیزاینێک نەدرابوو (بۆ لاپەڕەی ماڵەوە)، دیزاینی بنەڕەتی ماڵەوە بهێنە
        layoutToRender = await fetchHomeLayout(); 
    }

    container.innerHTML = ''; // Loader/naveroka berê paqij bike (لۆدەر/ناوەڕۆکی پێشوو پاک بکەوە)

    if (!layoutToRender || layoutToRender.length === 0) {
        console.warn("Page layout is empty or failed to load for:", layoutId);
        container.innerHTML = `<p style="text-align:center; padding: 20px;">هیچ بەشێک بۆ پیشاندان نەدۆزرایەوە.</p>`;
         // Wekî paşverû, cacheyê nîşan bike da ku dîsa hewl nede
         // وەک یەدەگ، کاشەکە نیشان بدە با دووبارە هەوڵ نەداتەوە
         if (layoutId === 'home') container.dataset.cached = 'true';
         else container.dataset.cachedLayoutId = layoutId;
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
                         sectionElement = await createPromoSliderElement(section.groupId, section.id || section.groupId); 
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
                          sectionElement = await createSingleShortcutRowElement(section.rowId, section.name); 
                         } else console.warn("Shortcut row missing rowId:", section);
                     break;
                 case 'single_category_row':
                     if (section.categoryId) {
                         sectionElement = await createSingleCategoryRowElement(section); 
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
    
    // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
    // Nîşana cacheyê saz bike da ku dîsa neyê çêkirin
    // نیشانەی کاشەکە دابنێ بۆ ئەوەی دووبارە دروست نەکرێتەوە
    if (layoutId === 'home') {
        container.dataset.cached = 'true';
    } else {
        container.dataset.cachedLayoutId = layoutId;
    }
    // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===
    
    setupScrollAnimations(); 
}


/**
 * Berheman li grida berheman zêde dike an wê ji nû ve ava dike.
 * بەرهەمەکان بۆ لیستی بەرهەمەکان زیاد دەکات یان دووبارە دروستی دەکاتەوە.
 * * @param {Array} newProducts - Rêza berhemên nû (زنجیرەی بەرهەمە نوێیەکان).
 * @param {boolean} isNewSearch - Gelo divê grid were paqij kirin (ئایا پێویستە لیستەکە پاک بکرێتەوە).
 */
export function renderProductsGridUI(newProducts, isNewSearch) {
    const container = document.getElementById('productsContainer'); // Grida berheman a rastîn (لیستی بەرهەمە ڕاستەقینەکە)
    if (!container) return;

    if (isNewSearch) {
        container.innerHTML = '';
        
        // Skeletê nîşan bide dema ku grid vala ye
        // ئێسکەپەیکەر پیشان بدە کاتێک لیستەکە بەتاڵە
        if (newProducts.length === 0) {
            const skeletonContainer = document.getElementById('skeletonLoader'); // Konteynira skeletê (کۆنتەینەری ئێسکەپەیکەر)
            if (skeletonContainer) {
                renderSkeletonLoader(skeletonContainer, 8); // Ev ê were nîşandan (ئەمە پیشان دەدرێت)
                skeletonContainer.style.display = 'grid';
            }
        }
    }

    // Piştî barkirina yekem, skeletê veşêre
    // دوای یەکەم بارکردن، ئێسکەپەیکەرەکە بشارەوە
    if (newProducts.length > 0) {
        const skeletonContainer = document.getElementById('skeletonLoader');
        if (skeletonContainer) skeletonContainer.style.display = 'none';
    }

    if (newProducts.length === 0 && isNewSearch) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; grid-column: 1 / -1;">هیچ کاڵایەک نەدۆزرایەوە.</p>';
    } else {
        newProducts.forEach(item => {
            let element = createProductCardElementUI(item); 
            element.classList.add('product-card-reveal'); 
            container.appendChild(element);
        });
    }
    setupScrollAnimations(); 
}
// Make globally accessible if needed (ji bo paşverûtiyê / بۆ گونجانی پێشوو)
window.renderProductsGridUI = renderProductsGridUI;


/**
 * Pêşeka kategoriyên sereke (li jor) render dike.
 * مینیوی پۆلێنە سەرەکییەکان (لەسەرەوە) ڕێندەر دەکات.
 */
export function renderMainCategoriesUI() {
    const container = document.getElementById('mainCategoriesContainer');
    if (!container) return;
    container.innerHTML = '';

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
         await updateProductViewUI(true, true); // Ev fonksîyon naha di 'app-ui' de ye (ئەم فەنکشنە ئێستا لە 'app-ui'ـدایە)
    };
    container.appendChild(homeBtn);

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
             await updateProductViewUI(true, true); // Ev fonksîyon naha di 'app-ui' de ye (ئەم فەنکشنە ئێستا لە 'app-ui'ـدایە)
        };
        container.appendChild(btn);
    });
}


/**
 * Pêşeka jêr-kategoriyan (li binê pêşeka sereke) render dike.
 * Ev tenê dema ku 'productGridPageContainer' çalak e tê nîşandan.
 * * مینیوی پۆلێنە لاوەکییەکان (لژێر مینیوی سەرەکی) ڕێندەر دەکات.
 * ئەمە تەنها کاتێک 'productGridPageContainer' چالاکە پیشان دەدرێت.
 * * @param {Array} subcategoriesData - Daneyên jêr-kategoriyan (داتای پۆلێنە لاوەکییەکان).
 */
export async function renderSubcategoriesUI(subcategoriesData) { 
    const subcategoriesContainer = document.getElementById('subcategoriesContainer');
    const subSubcategoriesContainer = document.getElementById('subSubcategoriesContainer'); 
    
    // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
    // Em her gav herduyan paqij dikin (ئێمە هەمیشە هەردووکیان پاک دەکەینەوە)
    subcategoriesContainer.innerHTML = ''; 
    subSubcategoriesContainer.innerHTML = ''; 
    subSubcategoriesContainer.style.display = 'none'; 
    // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===

    if (!subcategoriesData || subcategoriesData.length === 0 || state.currentCategory === 'all') {
         subcategoriesContainer.style.display = 'none'; 
         return;
    }

    subcategoriesContainer.style.display = 'flex'; 

    // Bişkoja "Hemî" (دوگمەی "هەموو")
    const allBtn = document.createElement('button');
    allBtn.className = `subcategory-btn ${state.currentSubcategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.id = 'all';
    const allIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" style="padding: 12px; color: var(--text-light);"><path d="M10 3H4C3.44772 3 3 3.44772 3 4V10C3 10.5523 3.44772 11 4 11H10C10.5523 11 11 10.5523 11 10V4C11 3.44772 10.5523 3 10 3Z M20 3H14C13.4477 3 13 3.44772 13 4V10C13 10.5523 13.4477 11 14 11H20C20.5523 11 21 10.5523 21 10V4C21 3.44772 20.5523 3 20 3Z M10 13H4C3.44772 13 3 13.4477 3 14V20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V14C11 13.4477 10.5523 13 10 13Z M20 13H14C13.4477 13 13 13.4477 13 14V20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V14C21 13.4477 20.5523 13 20 13Z"></path></svg>`;
    allBtn.innerHTML = `
        <div class="subcategory-image">${allIconSvg}</div>
        <span>${t('all_categories_label')}</span>
    `;
    allBtn.onclick = async () => {
         resetScrollPosition(subcategoriesContainer); 
         await navigateToFilterCore({
             category: state.currentCategory, 
             subcategory: 'all',
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    subcategoriesContainer.appendChild(allBtn);

    // Bişkokên jêr-kategoriyên rastîn (دوگمەکانی پۆلێنە لاوەکییە ڕاستەقینەکان)
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
            showSubcategoryDetailPageUI(state.currentCategory, subcat.id);
        };
        subcategoriesContainer.appendChild(subcatBtn);
    });

     // Jêr-jêr-kategoriyan render bike eger yek hatibe hilbijartin
     // پۆلێنە لاوەکییە لاوەکییەکان ڕێندەر بکە ئەگەر یەکێک هەڵبژێردرابوو
     if (state.currentSubcategory !== 'all') {
         // === START: GۆڕANkARI LI VIR / گۆڕانکاری لێرە ===
         // Em vê fonksîyonê ji bo vê konteynirê bang dikin
         // ئێمە ئەم فەنکشنە بۆ ئەم کۆنتەینەرە بانگ دەکەین
         await renderSubSubcategoriesUI(state.currentCategory, state.currentSubcategory);
         // === END: GۆڕANkARI LI VIR / کۆتایی گۆڕانکاری ===
     }
}

// === START: KODA NÛ / کۆدی نوێ ===
// Ev fonksîyon naha li vir e (ئەم فەنکشنە ئێستا لێرەیە)
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

    // Bişkoja "Hemî" (دوگمەی "هەموو")
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
         await navigateToFilterCore({
             category: state.currentCategory,
             subcategory: state.currentSubcategory,
             subSubcategory: 'all',
             search: ''
         });
         await updateProductViewUI(true, true); 
    };
    container.appendChild(allBtn);

    // Bişkokên jêr-jêr-kategoriyan (دوگمەکانی پۆلێنە لاوەکییە لاوەکییەکان)
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
             // Fîlter bike li ser rûpela serekî (فلتەر بکە لەسەر لاپەڕەی سەرەکی)
             await navigateToFilterCore({
                 category: state.currentCategory,
                 subcategory: state.currentSubcategory,
                 subSubcategory: subSubcat.id,
                 search: ''
             });
             await updateProductViewUI(true, true);
        };
        subcategoriesContainer.appendChild(btn);
    });
}
// === END: KODA NÛ / کۆتایی کۆدی نوێ ===


// --- Avakerên Beşên Dîzaynê (Navxweyî) ---
// --- دروستکەرەکانی بەشەکانی دیزاین (ناوخۆیی) ---

async function createPromoSliderElement(groupId, layoutId) {
    const cards = await fetchPromoGroupCards(groupId);
    if (!cards || cards.length === 0) return null;

    const promoGrid = document.createElement('div');
    promoGrid.className = 'products-container'; 
    promoGrid.style.marginBottom = '24px';
    const uniqueSliderId = `promoSlider_${layoutId}_${Math.random().toString(36).substring(2, 9)}`;
    promoGrid.id = uniqueSliderId; 

    const sliderState = { currentIndex: 0, intervalId: null };
    const cardData = { cards };

    const promoCardElement = document.createElement('div');
    promoCardElement.className = 'product-card promo-card-grid-item'; 

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
    updateImage(sliderState.currentIndex); 

    if (cards.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'promo-slider-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex - 1 + cards.length) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); 
        };
        promoCardElement.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'promo-slider-btn next';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
            resetInterval(); 
        };
        promoCardElement.appendChild(nextBtn);

        const rotate = () => {
             if (!document.getElementById(uniqueSliderId) || !state.sliderIntervals || !state.sliderIntervals[uniqueSliderId]) {
                 if (sliderState.intervalId) clearInterval(sliderState.intervalId); 
                 if (state.sliderIntervals && state.sliderIntervals[uniqueSliderId]) delete state.sliderIntervals[uniqueSliderId]; 
                return;
             }
            sliderState.currentIndex = (sliderState.currentIndex + 1) % cards.length;
            updateImage(sliderState.currentIndex);
        };

        const startInterval = () => {
            if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]); 
            sliderState.intervalId = setInterval(rotate, 5000);
            state.sliderIntervals[uniqueSliderId] = sliderState.intervalId; 
        };
        const resetInterval = () => {
             if (state.sliderIntervals[uniqueSliderId]) clearInterval(state.sliderIntervals[uniqueSliderId]);
            startInterval();
        };
        startInterval(); 
    }

    promoCardElement.addEventListener('click', async (e) => {
        if (!e.target.closest('button')) { 
            const currentCard = cardData.cards[sliderState.currentIndex];
            const targetCategoryId = currentCard.categoryId;
            const categoryExists = state.categories.some(cat => cat.id === targetCategoryId);
            if (categoryExists) {
                 await navigateToFilterCore({ category: targetCategoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                 await updateProductViewUI(true, true); 
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
                 showSubcategoryDetailPageUI(brand.categoryId, brand.subcategoryId); 
             } else if(brand.categoryId) {
                  await navigateToFilterCore({ category: brand.categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
                  await updateProductViewUI(true, true); 
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
        const card = createProductCardElementUI(product); 
        productsScroller.appendChild(card);
    });
    return container;
}

async function createSingleShortcutRowElement(rowId, sectionNameObj) { 
     const rowDocRef = doc(db, "shortcut_rows", rowId);
     const rowDocSnap = await getDoc(rowDocRef);
     if (!rowDocSnap.exists()) return null;

     const rowData = rowDocSnap.data();
     const cards = await fetchShortcutRowCards(rowId);
     if (!cards || cards.length === 0) return null;

     const sectionContainer = document.createElement('div');
     sectionContainer.className = 'shortcut-cards-section';
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
         item.onclick = async () => {
            if (cardData.subcategoryId && cardData.categoryId) {
                showSubcategoryDetailPageUI(cardData.categoryId, cardData.subcategoryId);
            } else {
                await navigateToFilterCore({
                    category: cardData.categoryId || 'all',
                    subcategory: cardData.subcategoryId || 'all', 
                    subSubcategory: cardData.subSubcategoryId || 'all',
                    search: ''
                });
                await updateProductViewUI(true, true);
            }
         };
         cardsContainer.appendChild(item);
     });
     return sectionContainer;
}

async function createSingleCategoryRowElement(sectionData) {
    const { categoryId, subcategoryId, subSubcategoryId } = sectionData; 
    const products = await fetchCategoryRowProducts(sectionData);
    if (!products || products.length === 0) return null;

    let title = ''; 
    try {
        let targetDocRef;
        if (subSubcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}/subSubcategories/${subSubcategoryId}`);
        } else if (subcategoryId) {
            targetDocRef = doc(db, `categories/${categoryId}/subcategories/${subcategoryId}`);
        } else {
            targetDocRef = doc(db, 'categories', categoryId); 
        }
        
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            title = targetData['name_' + state.currentLanguage] || targetData.name_ku_sorani || 'کاڵاکان'; 
        } else {
            title = 'کاڵاکان'; 
        }
    } catch (e) {
        console.warn("Could not fetch specific title for category row", e);
        title = 'کاڵاکان'; 
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
        const card = createProductCardElementUI(product); 
        productsScroller.appendChild(card);
    });

    container.querySelector('.see-all-link').onclick = async () => {
         if(subcategoryId) { 
              showSubcategoryDetailPageUI(categoryId, subcategoryId); 
         } else { 
              await navigateToFilterCore({ category: categoryId, subcategory: 'all', subSubcategory: 'all', search: '' });
              await updateProductViewUI(true, true); 
         }
    };
    return container;
}

async function createAllProductsSectionElement() {
    const products = await fetchInitialProductsForHome();
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
        const card = createProductCardElementUI(product); 
        productsGrid.appendChild(card);
    });
    return container;
}