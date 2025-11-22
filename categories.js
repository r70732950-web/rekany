// categories.js
import { 
    state, 
    t, 
    fetchCategories, 
    fetchSubcategories, 
    navigateToFilterCore 
} from './app-core.js';

import { updateProductViewUI } from './home.js';
import { showSubcategoryDetailPageUI } from './app-ui.js'; 

// ڕەندەرکردنی پەڕەی دابەشبووی جۆرەکان (Split View)
export async function renderSplitCategoriesPageUI() {
    const sidebar = document.getElementById('splitSidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';
    
    // ئەگەر جۆرەکان هێشتا بار نەکرابن
    if (state.categories.length === 0) {
        await fetchCategories();
    }

    // لابردنی 'all' لە لیستەکە ئەگەر هەبێت
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
            // لابردنی کلاسى active لە هەموویان
            sidebar.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
            // زیادکردنی active بۆ ئەوەی کلیک کراوە
            item.classList.add('active');
            // پیشاندانی ناوەڕۆک
            renderSplitSubcategoriesContent(cat);
        };

        sidebar.appendChild(item);

        // یەکەم دانە با بە دیفۆڵت دیاری بکرێت
        if (index === 0) {
            item.classList.add('active');
            renderSplitSubcategoriesContent(cat);
        }
    });
}

// ڕەندەرکردنی ناوەڕۆکی لای چەپ (جۆرە لاوەکییەکان)
async function renderSplitSubcategoriesContent(category) {
    const contentDiv = document.getElementById('splitContent');
    if (!contentDiv) return;

    const catName = (category.name && category.name[state.currentLanguage]) || category.name_ku_sorani;
    
    contentDiv.innerHTML = `
        <div class="split-content-header">
            <span>${catName}</span>
            <button class="see-all-link" id="splitViewSeeAllBtn" style="border:none; background:none; font-size:12px;">${t('see_all')}</button>
        </div>
        <div style="text-align: center; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i></div>
    `;

    // فەنکشنی بینینی هەموو کاڵاکانی ئەو جۆرە
    document.getElementById('splitViewSeeAllBtn').onclick = async () => {
        await navigateToFilterCore({ category: category.id, subcategory: 'all', subSubcategory: 'all', search: '' });
        await updateProductViewUI(true, true);
    };

    // هێنانی جۆرە لاوەکییەکان
    const subcats = await fetchSubcategories(category.id);
    
    // لابردنی لۆدەر
    const loader = contentDiv.querySelector('.fa-spinner')?.parentNode;
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

        card.onclick = () => {
            showSubcategoryDetailPageUI(category.id, sub.id);
        };

        grid.appendChild(card);
    });

    contentDiv.appendChild(grid);
}
