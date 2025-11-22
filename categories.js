// categories.js
import { 
    state, 
    t, 
    fetchCategories, 
    fetchSubcategories, 
    navigateToFilterCore 
} from './app-core.js';

import { updateProductViewUI } from './home.js';
import { showSubcategoryDetailPageUI, showPage } from './app-ui.js'; 

// ڕەندەرکردنی پەڕەی دابەشبووی جۆرەکان (Split View)
export async function renderSplitCategoriesPageUI() {
    const sidebar = document.getElementById('splitSidebar');
    if (!sidebar) return;
    
    // ئەگەر جۆرەکان هێشتا بار نەکرابن، باریان دەکەین
    if (state.categories.length === 0) {
        await fetchCategories();
    }

    // [چاکسازی]: ئەگەر لیستەکە پێشتر دروستکرابێت، دووبارە دروستی مەکەرەوە
    // ئەمە وادەکات کاتێک دەگەڕێیتەوە، شوێنی Scroll تێک نەچێت
    if (sidebar.children.length === 0) {
        const categoriesToShow = state.categories.filter(c => c.id !== 'all');

        categoriesToShow.forEach((cat, index) => {
            const name = (cat.name && cat.name[state.currentLanguage]) || cat.name_ku_sorani;
            
            const item = document.createElement('div');
            item.className = 'sidebar-item';
            item.dataset.id = cat.id;
            item.innerHTML = `
                <i class="${cat.icon}"></i>
                <span>${name}</span>
            `;
            
            item.onclick = () => {
                handleCategoryClick(cat.id, sidebar);
            };

            sidebar.appendChild(item);
        });
    }

    // دیاریکردنی جۆری چالاک (Active)
    // سەرەتا سەیری مێمۆری دەکات (state)، ئەگەر نەبوو یەکەم دانە دیاری دەکات
    let activeCatId = state.currentSplitCategory || (state.categories.find(c => c.id !== 'all')?.id);
    if (activeCatId) {
        handleCategoryClick(activeCatId, sidebar, false); 
    }
}

// فەنکشنی مامەڵەکردن لەگەڵ کلیک لەسەر جۆرەکان
async function handleCategoryClick(categoryId, sidebar, forceRefresh = true) {
    // پاشەکەوتکردنی جۆری هەڵبژێردراو بۆ ئەوەی بیرمان نەچێت
    state.currentSplitCategory = categoryId;

    // لابردنی کلاسى active لە هەموویان
    sidebar.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    
    // دۆزینەوەی توخمەکە و دیاریکردنی وەک active
    const activeItem = sidebar.querySelector(`.sidebar-item[data-id="${categoryId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // [چاکسازی]: خستنە بەرچاو (Scroll Into View) بە نەرمی
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // دۆزینەوەی داتای جۆرەکە و نیشاندانی ناوەڕۆک
    const category = state.categories.find(c => c.id === categoryId);
    if (category) {
        renderSplitSubcategoriesContent(category);
    }
}

// ڕەندەرکردنی ناوەڕۆکی لای چەپ (جۆرە لاوەکییەکان)
async function renderSplitSubcategoriesContent(category) {
    const contentDiv = document.getElementById('splitContent');
    if (!contentDiv) return;

    const catName = (category.name && category.name[state.currentLanguage]) || category.name_ku_sorani;
    
    contentDiv.innerHTML = `
        <div class="split-content-header">
            <span>${catName}</span>
            <button class="see-all-link" id="splitViewSeeAllBtn" style="border:none; background:none; font-size:12px; font-weight:bold; color:var(--primary-color);">${t('see_all')}</button>
        </div>
        <div id="splitLoader" style="text-align: center; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i></div>
    `;

    // [چاکسازی]: دوگمەی "هەمووی بینە" ئێستا دەچێتە پەڕەی سەرەکی
    document.getElementById('splitViewSeeAllBtn').onclick = async () => {
        await navigateToFilterCore({ category: category.id, subcategory: 'all', subSubcategory: 'all', search: '' });
        // فەرمان دەکەین کە پەڕەی سەرەکی بکرێتەوە
        showPage('mainPage'); 
        await updateProductViewUI(true, true);
    };

    // هێنانی جۆرە لاوەکییەکان
    const subcats = await fetchSubcategories(category.id);
    
    // لابردنی لۆدەر
    const loader = document.getElementById('splitLoader');
    if(loader) loader.remove();

    if (subcats.length === 0) {
        contentDiv.innerHTML += `<p style="text-align:center; color:#999; margin-top:20px;">هیچ جۆرێکی لاوەکی نییە.</p>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'split-subcategories-grid';

    subcats.forEach(sub => {
        const subName = (sub.name && sub.name[state.currentLanguage]) || sub.name_ku_sorani;
        const imgUrl = sub.imageUrl || "https://placehold.co/100"; 

        const card = document.createElement('div');
        card.className = 'split-sub-card';
        card.innerHTML = `
            <img src="${imgUrl}" class="split-sub-image" loading="lazy" onerror="this.src='https://placehold.co/100'">
            <span class="split-sub-name">${subName}</span>
        `;

        // [چاکسازی]: دڵنیابوونەوە لەوەی کلیک کردن دەچێتە پەڕەی وردەکاری
        // لەوێ جۆرە لاوەکییەکان (Sub-subcategories) دەردەکەون
        card.onclick = () => {
            showSubcategoryDetailPageUI(category.id, sub.id);
        };

        grid.appendChild(card);
    });

    contentDiv.appendChild(grid);
}
