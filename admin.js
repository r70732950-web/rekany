// admin.js (Guhertoya Supabase)
// Ev fayl bi tevahî ji bo Supabase hatiye nûve kirin

// Amûrên gerdûnî yên ku ji 'app-setup.js' (guhertoya Supabase) hatine
const {
    db, auth, 
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    subcategoriesCollection, subSubcategoriesCollection, promoCardsCollection,
    brandsCollection, shortcutCardsCollection, homeLayoutCollection,
    policiesCollection, socialLinksCollection, contactMethodsCollection,
    
    showNotification, t, openPopup, closeCurrentPopup, 
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;


window.AdminLogic = {
    listenersAttached: false,

    initialize: function() {
        console.log("Admin logic (Supabase) initialized.");
        this.migrateAndSetupDefaultHomeLayout(); // Ev fonksiyon dê databasea Supabase kontrol bike
        this.updateAdminUI(true);
        this.setupAdminEventListeners();
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderContactMethodsAdmin();
        this.renderShortcutRowsAdminList();
        this.updateAdminCategoryDropdowns();
        this.updateShortcutCardCategoryDropdowns();
        this.renderHomeLayoutAdmin();
        
        this.renderPromoGroupsAdminList();
        this.renderBrandGroupsAdminList();
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
    },

    // Fonksiyona ji bo mîgrasyonê ji bo Supabase hatiye nûve kirin
    migrateAndSetupDefaultHomeLayout: async function() {
        // Kontrol bike ka 'home_layout' tiştek tê de heye
        const { data, error, count } = await db.from(homeLayoutCollection).select('*', { count: 'exact', head: true });

        if (error) {
            console.error("Error checking home layout:", error);
            return;
        }

        if (count === 0) {
            console.log("`home_layout` collection is empty. Creating default layout.");
            await this.createDefaultHomeLayout();
        } else {
            console.log("`home_layout` structure is up to date.");
            // Têbînî: Ji ber ku ev databaseek nû ye, em hewce nakin ku strukturên kevn ên Firestore mîgrasyon bikin
        }
    },

    // Fonksiyona ji bo çêkirina layouta default li Supabase
    createDefaultHomeLayout: async function() {
        const defaultLayout = [
            { name: { ku_sorani: 'سلایدەری ڕێکلام', ku_badini: 'سلایدەرێ ڕێکلاما', ar: 'سلايدر الإعلانات' }, order: 1, type: 'promo_slider', enabled: true, group_id: 'default' },
            { name: { ku_sorani: 'بەشی براندەکان', ku_badini: 'پشکا براندا', ar: 'قسم الماركات' }, order: 2, type: 'brands', enabled: true, group_id: 'default' },
            { name: { ku_sorani: 'نوێترین کاڵاکان', ku_badini: 'نووترین کاڵا', ar: 'أحدث المنتجات' }, order: 3, type: 'newest_products', enabled: true },
            { name: { ku_sorani: 'هەموو کاڵاکان', ku_badini: 'هەمی کاڵا', ar: 'كل المنتجات' }, order: 4, type: 'all_products', enabled: true }
        ];

        // Dema ku 'default' group_id bikar tînin, divê em pêşî wan koman çêbikin
        try {
            // Em 'upsert' bikar tînin da ku heke ew jixwe hebin, çewtî çênebe
            await db.from(promoGroupsCollection).upsert({ id: 'default', name: 'گرووپی سەرەki' }, { onConflict: 'id' });
            await db.from(brandGroupsCollection).upsert({ id: 'default', name: 'گرووپی سەرەki' }, { onConflict: 'id' });

            const { error } = await db.from(homeLayoutCollection).insert(defaultLayout);
            if (error) throw error;
            console.log("New default layout created in Supabase.");
        } catch (error) {
            console.error("Error creating default layout:", error);
        }
    },
    
    // Ev fonksiyon wek xwe dimîne
    updateAdminUI: function(isAdmin) {
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        const adminSections = [
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
            'adminContactMethodsManagement', 'adminShortcutRowsManagement',
            'adminHomeLayoutManagement'
        ];
        adminSections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = isAdmin ? 'block' : 'none';
        });
        
        const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
        const settingsAdminLoginBtn = document.getElementById('settingsAdminLoginBtn');
        const addProductBtn = document.getElementById('addProductBtn');

        if (isAdmin) {
            settingsLogoutBtn.style.display = 'flex';
            settingsAdminLoginBtn.style.display = 'none';
            addProductBtn.style.display = 'flex';
        } else {
            settingsLogoutBtn.style.display = 'none';
            settingsAdminLoginBtn.style.display = 'flex';
            addProductBtn.style.display = 'none';
        }
    },

    // Guhertî bo Supabase
    editProduct: async function(productId) {
        const { data: product, error } = await db
            .from(productsCollection)
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            showNotification(t('product_not_found_error'), 'error');
            return;
        }

        setEditingProductId(productId);
        document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
        document.getElementById('productForm').reset();
        
        this.updateAdminCategoryDropdowns(); 

        if (product.name && typeof product.name === 'object') {
            document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
            document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
            document.getElementById('productNameAr').value = product.name.ar || '';
        } else {
            document.getElementById('productNameKuSorani').value = product.name;
        }

        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOriginalPrice').value = product.originalPrice || '';

        const categoryId = product.categoryId || product.category;
        document.getElementById('productCategoryId').value = categoryId;

        if (product.description) {
            document.getElementById('productDescriptionKuSorani').value = product.description.ku_sorani || '';
            document.getElementById('productDescriptionKuBadini').value = product.description.ku_badini || '';
            document.getElementById('productDescriptionAr').value = product.description.ar || '';
        }

        const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
        this.createProductImageInputs(imageUrls);
        document.getElementById('productExternalLink').value = product.externalLink || '';

        if (product.shippingInfo) {
            document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
            document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
            document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
        }

        // Dropdownên pêşkeftî bar bike
        await this.populateSubcategoriesDropdown(categoryId, product.subcategoryId);
        await this.populateSubSubcategoriesDropdown(product.subcategoryId, product.subSubcategoryId);

        document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        openPopup('productFormModal', 'modal');
    },

    // Guhertî bo Supabase
    deleteProduct: async function(productId) {
        if (!confirm(t('delete_confirm'))) return;
        try {
            const { error } = await db.from(productsCollection).delete().eq('id', productId);
            if (error) throw error;
            showNotification(t('product_deleted'), 'success');
            clearProductCache();
        } catch (error) {
            showNotification(t('product_delete_error'), 'error');
        }
    },

    // Wek xwe dimîne
    createProductImageInputs: function(imageUrls = []) {
        const imageInputsContainer = document.getElementById('imageInputsContainer');
        imageInputsContainer.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const url = imageUrls[i] || '';
            const isRequired = i === 0 ? 'required' : '';
            const placeholder = i === 0 ? 'لینکی وێنەی یەکەم (سەرەکی)' : `لینکی وێنەی ${['دووەم', 'سێیەم', 'چوارەم'][i-1]}`;
            const previewSrc = url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`;
            const inputGroup = document.createElement('div');
            inputGroup.className = 'image-input-group';
            inputGroup.innerHTML = `<input type="text" class="productImageUrl" placeholder="${placeholder}" value="${url}" ${isRequired}><img src="${previewSrc}" class="image-preview-small" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">`;
            imageInputsContainer.appendChild(inputGroup);
        }
    },

    // Guhertî bo Supabase (li ser bingeha category_id)
    populateSubcategoriesDropdown: async function(categoryId, selectedSubcategoryId = null) {
        const subcategorySelectContainer = document.getElementById('subcategorySelectContainer');
        const productSubcategorySelect = document.getElementById('productSubcategoryId');

        if (!categoryId) {
            subcategorySelectContainer.style.display = 'none';
            document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            return;
        }

        productSubcategorySelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        productSubcategorySelect.disabled = true;
        subcategorySelectContainer.style.display = 'block';

        try {
            const { data, error } = await db
                .from(subcategoriesCollection)
                .select('id, name_ku_sorani')
                .eq('category_id', categoryId)
                .order('order', { ascending: true });
                
            if (error) throw error;

            productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

            if (!data || data.length === 0) {
                productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            } else {
                data.forEach(subcat => {
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani || subcat.id;
                    if (subcat.id === selectedSubcategoryId) {
                        option.selected = true;
                    }
                    productSubcategorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error fetching subcategories for form:", error);
            productSubcategorySelect.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>';
        } finally {
            productSubcategorySelect.disabled = false;
        }
    },

    // Guhertî bo Supabase (li ser bingeha subcategory_id)
    populateSubSubcategoriesDropdown: async function(subcategoryId, selectedSubSubcategoryId = null) {
        const container = document.getElementById('subSubcategorySelectContainer');
        const select = document.getElementById('productSubSubcategoryId');

        if (!subcategoryId) {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        select.disabled = true;
        container.style.display = 'block';

        try {
            const { data, error } = await db
                .from(subSubcategoriesCollection)
                .select('id, name_ku_sorani')
                .eq('subcategory_id', subcategoryId)
                .order('order', { ascending: true });
            
            if (error) throw error;

            select.innerHTML = '<option value="">-- هیچ --</option>';
            if (data && data.length > 0) {
                data.forEach(subSubcat => {
                    const option = document.createElement('option');
                    option.value = subSubcat.id;
                    option.textContent = subSubcat.name_ku_sorani;
                    if (subSubcat.id === selectedSubSubcategoryId) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error fetching sub-subcategories for form:", error);
            select.innerHTML = '<option value="" disabled>هەڵەیەک ڕوویدا</option>';
        } finally {
            select.disabled = false;
        }
    },

    // Guhertî bo Supabase
    loadPoliciesForAdmin: async function() {
        try {
            // Texmîn dikin ku tenê rêzek ji bo polîtîkayan heye, mînak. bi id 'current'
            const { data, error } = await db
                .from(policiesCollection)
                .select('content')
                .eq('id', 'current') // Em texmîn dikin ku ID 'current' e
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = rêz nehat dîtin

            if (data && data.content) {
                const policies = data.content;
                document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || '';
                document.getElementById('policiesContentKuBadini').value = policies.ku_badini || '';
                document.getElementById('policiesContentAr').value = policies.ar || '';
            }
        } catch (error) {
            console.error("Error loading policies for admin:", error);
        }
    },

    // Guhertî bo Supabase
    deleteAnnouncement: async function(id) {
        if (confirm(t('announcement_delete_confirm'))) {
            try {
                const { error } = await db.from(announcementsCollection).delete().eq('id', id);
                if (error) throw error;
                showNotification(t('announcement_deleted_success'), 'success');
            } catch (e) {
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    // Guhertî bo Supabase (Realtime-ê bikar nayne, lê dikare were guhertin)
    // Ji bo sadebûnê, em ê Realtime bikar neynin û tenê listê nûve bikin
    renderAdminAnnouncementsList: async function() {
        const container = document.getElementById('announcementsListContainer');
        
        const { data, error } = await db
            .from(announcementsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        if (error || !data || data.length === 0) {
            container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
            return;
        }
        
        data.forEach(announcement => {
            const title = (announcement.title && announcement.title.ku_sorani) || 'بێ ناونیشان';
            const item = document.createElement('div');
            item.className = 'admin-notification-item';
            item.innerHTML = `
                <div class="admin-notification-details">
                    <div class="notification-title">${title}</div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').addEventListener('click', () => this.deleteAnnouncement(announcement.id));
            container.appendChild(item);
        });
    },

    // Guhertî bo Supabase
    deleteSocialMediaLink: async function(linkId) {
        if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(socialLinksCollection).delete().eq('id', linkId);
                if (error) throw error;
                showNotification('لینکەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting social link: ", error);
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    // Guhertî bo Supabase
    renderSocialMediaLinks: async function() {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        
        const { data, error } = await db
            .from(socialLinksCollection)
            .select('*')
            .order('created_at', { ascending: false });

        socialLinksListContainer.innerHTML = '';
        if (error || !data || data.length === 0) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            return;
        }
        
        data.forEach(link => {
            const name = link['name_' + getCurrentLanguage()] || link.name_ku_sorani;
            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${link.icon}"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${link.url}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').onclick = () => this.deleteSocialMediaLink(link.id);
            socialLinksListContainer.appendChild(item);
        });
    },

    // Guhertî bo Supabase
    deleteContactMethod: async function(methodId) {
        if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(contactMethodsCollection).delete().eq('id', methodId);
                if (error) throw error;
                showNotification('شێوازەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting contact method: ", error);
                showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
            }
        }
    },

    // Guhertî bo Supabase
    renderContactMethodsAdmin: async function() {
        const container = document.getElementById('contactMethodsListContainer');
        
        const { data, error } = await db
            .from(contactMethodsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        if (error || !data || data.length === 0) {
            container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
            return;
        }
        
        data.forEach(method => {
            const name = method['name_' + getCurrentLanguage()] || method.name_ku_sorani;
            const item = document.createElement('div');
            item.className = 'social-link-item';
            item.innerHTML = `
                <div class="item-info">
                    <i class="${method.icon}" style="color: ${method.color};"></i>
                    <div class="item-details">
                        <span class="item-name">${name}</span>
                        <span class="item-value">${method.value}</span>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            item.querySelector('.delete-btn').onclick = () => this.deleteContactMethod(method.id);
            container.appendChild(item);
        });
    },

    // Guhertî bo Supabase (pir tevlihev, ji ber ku êdî 'path' tune)
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        let content = '';
        
        // 1. Hemî kategoriyan bistîne
        const { data: mainCategories, error: mainErr } = await db.from(categoriesCollection).select('*').order('order', { ascending: true });
        if (mainErr) { container.innerHTML = '<p>هەڵە لە هێنانی جۆرەکان.</p>'; return; }

        // 2. Hemî jêr-kategoriyan bistîne
        const { data: subCategories, error: subErr } = await db.from(subcategoriesCollection).select('*').order('order', { ascending: true });
        
        // 3. Hemî jêr-jêr-kategoriyan bistîne
        const { data: subSubCategories, error: subSubErr } = await db.from(subSubcategoriesCollection).select('*').order('order', { ascending: true });

        for (const mainCategory of mainCategories) {
            content += `
                <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                        <div>
                            <button class="edit-btn small-btn" data-id="${mainCategory.id}" data-level="1"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-id="${mainCategory.id}" data-level="1" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;

            const filteredSubCategories = subCategories.filter(s => s.category_id === mainCategory.id);
            for (const subCategory of filteredSubCategories) {
                content += `
                    <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn" data-id="${subCategory.id}" data-level="2"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-id="${subCategory.id}" data-level="2" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;

                const filteredSubSubCategories = subSubCategories.filter(s => s.subcategory_id === subCategory.id);
                for (const subSubCategory of filteredSubSubCategories) {
                    content += `
                        <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                                <div>
                                    <button class="edit-btn small-btn" data-id="${subSubCategory.id}" data-level="3"><i class="fas fa-edit"></i></button>
                                    <button class="delete-btn small-btn" data-id="${subSubCategory.id}" data-level="3" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>`;
                }
            }
        }

        container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';
        const self = this;
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => self.openEditCategoryModal(btn.dataset.id, btn.dataset.level));
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => self.handleDeleteCategory(btn.dataset.id, btn.dataset.level, btn.dataset.name));
        });
    },

    // Guhertî bo Supabase (li ser bingeha ID, ne 'path')
    openEditCategoryModal: async function(id, level) {
        let tableName;
        if (level === '1') tableName = categoriesCollection;
        else if (level === '2') tableName = subcategoriesCollection;
        else tableName = subSubcategoriesCollection;

        const { data: category, error } = await db.from(tableName).select('*').eq('id', id).single();

        if (error || !category) {
            showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
            return;
        }

        document.getElementById('editCategoryDocPath').value = id; // Em ê IDyê li vir tomar bikin
        document.getElementById('editCategoryLevel').value = level;

        document.getElementById('editCategoryNameKuSorani').value = category.name_ku_sorani || '';
        document.getElementById('editCategoryNameKuBadini').value = category.name_ku_badini || '';
        document.getElementById('editCategoryNameAr').value = category.name_ar || '';
        document.getElementById('editCategoryOrder').value = category.order || 0;

        const iconField = document.getElementById('editIconField');
        const imageUrlField = document.getElementById('editImageUrlField');

        if (level === '1') {
            iconField.style.display = 'block';
            imageUrlField.style.display = 'none';
            document.getElementById('editCategoryIcon').value = category.icon || '';
        } else {
            iconField.style.display = 'none';
            imageUrlField.style.display = 'block';
            document.getElementById('editCategoryImageUrl').value = category.imageUrl || '';
        }

        openPopup('editCategoryModal', 'modal');
    },

    // Guhertî bo Supabase (pir tevlihev, ji ber ku divê em bi awayekî kaskadî (cascade) jê bibin)
    handleDeleteCategory: async function(id, level, categoryName) {
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: هەموو جۆرە لاوەکییەکانیشی دەسڕدرێنەوە.`);
        if (confirmation) {
            try {
                if (level === '1') {
                    // Pêdivî ye ku em RPC (Remote Procedure Call) li Supabase çêbikin ji bo jêbirina kaskadî
                    // Ji ber ku ew pir tevlihev e, em ê tenê hewl bidin ku jê bibin (û em texmîn dikin ku 'on delete cascade' heye)
                    const { error } = await db.from(categoriesCollection).delete().eq('id', id);
                    if (error) throw error;
                } else if (level === '2') {
                    const { error } = await db.from(subcategoriesCollection).delete().eq('id', id);
                    if (error) throw error;
                } else { // level === '3'
                    const { error } = await db.from(subSubcategoriesCollection).delete().eq('id', id);
                    if (error) throw error;
                }
                
                showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
                clearProductCache();
                this.renderCategoryManagementUI(); // Lîsteyê nûve bike
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا. Dibe ku ev jêr-kategorî hebin.', 'error');
            }
        }
    },

    // Wek xwe dimîne, ji ber ku ew li ser statea 'getCategories()' kar dike
    updateAdminCategoryDropdowns: function() {
        const categories = getCategories();
        if (categories.length === 0) return; // Guhertin: ji <= 1 bû 0
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

        const dropdowns = [
            { id: 'productCategoryId', defaultText: '-- جۆرێ سەرەکی هەڵبژێرە --', required: true },
            { id: 'parentCategorySelect', defaultText: '-- جۆرێک هەڵبژێرە --', required: true },
            { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆرێک هەڵبژێرە --', required: true },
            { id: 'promoCardTargetCategory', defaultText: '-- جۆرێک هەڵبژێرە --', required: true },
            { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --', required: false }
        ];

        dropdowns.forEach(d => {
            const select = document.getElementById(d.id);
            if (select) {
                const requiredAttrs = d.required ? 'disabled selected' : '';
                const firstOptionHTML = `<option value="" ${requiredAttrs}>${d.defaultText}</option>`;
                select.innerHTML = firstOptionHTML;
                
                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                    select.appendChild(option);
                });
            }
        });
    },

    // --- PROMO SLIDER (SUPABASE) ---
    renderPromoGroupsAdminList: async function() {
        const container = document.getElementById('promoGroupsListContainer');
        const groupSelect = document.getElementById('promoCardGroupSelect');
        
        const { data: groups, error } = await db
            .from(promoGroupsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

        if (error || !groups || groups.length === 0) {
            container.innerHTML = '<p>هیچ گرووپێکی سلایدەر زیاد نەکراوە.</p>';
            return;
        }

        for (const group of groups) {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);

            const groupElement = document.createElement('div');
            groupElement.className = 'admin-list-group';
            groupElement.innerHTML = `
                <div class="admin-list-group-header">
                    <strong><i class="fas fa-images"></i> ${group.name}</strong>
                    <div>
                        <button class="edit-btn small-btn edit-promo-group-btn" data-id="${group.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn delete-promo-group-btn" data-id="${group.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="cards-list-container" style="padding: 10px;">...</div>
            `;
            container.appendChild(groupElement);

            const cardsContainer = groupElement.querySelector('.cards-list-container');
            const { data: cards, error: cardsError } = await db
                .from(promoCardsCollection)
                .select('*')
                .eq('group_id', group.id)
                .order('order', { ascending: true });

            cardsContainer.innerHTML = '';
            if (cardsError || !cards || cards.length === 0) {
                cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کاردێک بۆ ئەم گرووپە زیاد نەکراوە.</p>';
            } else {
                cards.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'admin-list-item';
                    cardElement.innerHTML = `
                        <span>- کارت (ڕیز: ${card.order})</span>
                        <div>
                            <button class="edit-btn small-btn edit-promo-card-btn" data-card-id="${card.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn delete-promo-card-btn" data-card-id="${card.id}"><i class="fas fa-trash"></i></button>
                        </div>`;
                    cardsContainer.appendChild(cardElement);
                });
            }
        }
    },

    editPromoGroup: async function(groupId) {
        const { data: group } = await db.from(promoGroupsCollection).select('name').eq('id', groupId).single();
        const newName = prompt('ناوی نوێی گرووپ بنووسە:', group.name);
        if (newName && newName.trim() !== '') {
            await db.from(promoGroupsCollection).update({ name: newName.trim() }).eq('id', groupId);
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
        }
    },

    deletePromoGroup: async function(groupId) {
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو کارتەکانی بسڕیتەوە؟ (Cascade)')) {
            try {
                // Texmîn dikin ku 'on delete cascade' li ser databaseê hatiye danîn
                const { error } = await db.from(promoGroupsCollection).delete().eq('id', groupId);
                if (error) throw error;
                showNotification('گرووپ بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا. Kontrol bike 'on delete cascade'.', 'error'); }
        }
    },
    
    editPromoCard: async function(cardId) {
        const { data: card, error } = await db.from(promoCardsCollection).select('*').eq('id', cardId).single();
        if (card) {
            document.getElementById('editingPromoCardId').value = cardId;
            document.getElementById('promoCardGroupSelect').value = card.group_id;
            document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani;
            document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini;
            document.getElementById('promoCardImageAr').value = card.imageUrls.ar;
            document.getElementById('promoCardTargetCategory').value = card.categoryId;
            document.getElementById('promoCardOrder').value = card.order;
            document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
            document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
        }
    },

    deletePromoCard: async function(cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(promoCardsCollection).delete().eq('id', cardId);
                if (error) throw error;
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    // --- BRAND GROUP (SUPABASE) ---
    renderBrandGroupsAdminList: async function() {
        const container = document.getElementById('brandGroupsListContainer');
        const groupSelect = document.getElementById('brandGroupSelect');
        
        const { data: groups, error } = await db
            .from(brandGroupsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

        if (error || !groups || groups.length === 0) {
            container.innerHTML = '<p>هیچ گرووپێکی براند زیاد نەکراوە.</p>';
            return;
        }

        for (const group of groups) {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);

            const groupElement = document.createElement('div');
            groupElement.className = 'admin-list-group';
            groupElement.innerHTML = `
                <div class="admin-list-group-header">
                    <strong><i class="fas fa-tags"></i> ${group.name}</strong>
                    <div>
                        <button class="edit-btn small-btn edit-brand-group-btn" data-id="${group.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn delete-brand-group-btn" data-id="${group.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="brands-list-container" style="padding: 10px;">...</div>
            `;
            container.appendChild(groupElement);

            const brandsContainer = groupElement.querySelector('.brands-list-container');
            const { data: brands, error: brandsError } = await db
                .from(brandsCollection)
                .select('*')
                .eq('group_id', group.id)
                .order('order', { ascending: true });

            brandsContainer.innerHTML = '';
            if (brandsError || !brands || brands.length === 0) {
                brandsContainer.innerHTML = '<p class="empty-list-text">هیچ براندێک بۆ ئەم گرووپە زیاد نەکراوە.</p>';
            } else {
                brands.forEach(brand => {
                    const brandElement = document.createElement('div');
                    brandElement.className = 'admin-list-item';
                    brandElement.innerHTML = `
                        <span>- ${brand.name.ku_sorani} (ڕیز: ${brand.order})</span>
                        <div>
                            <button class="edit-btn small-btn edit-brand-btn" data-brand-id="${brand.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn delete-brand-btn" data-brand-id="${brand.id}"><i class="fas fa-trash"></i></button>
                        </div>`;
                    brandsContainer.appendChild(brandElement);
                });
            }
        }
    },
    
    editBrandGroup: async function(groupId) {
        const { data: group } = await db.from(brandGroupsCollection).select('name').eq('id', groupId).single();
        const newName = prompt('ناوی نوێی گرووپی براند بنووسە:', group.name);
        if (newName && newName.trim() !== '') {
            await db.from(brandGroupsCollection).update({ name: newName.trim() }).eq('id', groupId);
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
        }
    },

    deleteBrandGroup: async function(groupId) {
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو براندەکانی بسڕیتەوە؟ (Cascade)')) {
            try {
                // Texmîn dikin ku 'on delete cascade' hatiye danîn
                const { error } = await db.from(brandGroupsCollection).delete().eq('id', groupId);
                if (error) throw error;
                showNotification('گرووپی براند بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    editBrand: async function(brandId) {
        const { data: brand, error } = await db.from(brandsCollection).select('*').eq('id', brandId).single();
        if (brand) {
            document.getElementById('editingBrandId').value = brandId;
            document.getElementById('brandGroupSelect').value = brand.group_id;
            document.getElementById('brandNameKuSorani').value = brand.name.ku_sorani || '';
            document.getElementById('brandNameKuBadini').value = brand.name.ku_badini || '';
            document.getElementById('brandNameAr').value = brand.name.ar || '';
            document.getElementById('brandImageUrl').value = brand.imageUrl || '';
            document.getElementById('brandOrder').value = brand.order || 10;
            const mainCatSelect = document.getElementById('brandTargetMainCategory');
            mainCatSelect.value = brand.categoryId || '';
            mainCatSelect.dispatchEvent(new Event('change'));
            setTimeout(() => {
                document.getElementById('brandTargetSubcategory').value = brand.subcategoryId || '';
            }, 500);
            document.getElementById('addBrandForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
            document.getElementById('addBrandForm').scrollIntoView({ behavior: 'smooth' });
        }
    },
    
    deleteBrand: async function(brandId) {
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(brandsCollection).delete().eq('id', brandId);
                if (error) throw error;
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },
    
    // --- SHORTCUT ROWS (SUPABASE) ---
    renderShortcutRowsAdminList: async function() {
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard');
        
        const { data: rows, error } = await db
            .from(shortcutRowsCollection)
            .select('*')
            .order('order', { ascending: true });

        container.innerHTML = '';
        rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';
        
        if (error || !rows || rows.length === 0) {
            container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>';
            return;
        }

        for (const row of rows) {
            const option = document.createElement('option');
            option.value = row.id;
            option.textContent = row.title.ku_sorani;
            rowSelect.appendChild(option);

            const rowElement = document.createElement('div');
            rowElement.className = 'admin-list-group';
            
            rowElement.innerHTML = `
                <div class="admin-list-group-header">
                    <strong><i class="fas fa-layer-group"></i> ${row.title.ku_sorani} (ڕیز: ${row.order})</strong>
                    <div>
                        <button class="edit-row-btn edit-btn small-btn" data-id="${row.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-row-btn delete-btn small-btn" data-id="${row.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="cards-list-container" style="padding: 10px;">...خەریکی بارکردنی کارتەکانە</div>
            `;
            container.appendChild(rowElement);

            const cardsContainer = rowElement.querySelector('.cards-list-container');
            const { data: cards, error: cardsError } = await db
                .from(shortcutCardsCollection)
                .select('*')
                .eq('row_id', row.id)
                .order('order', { ascending: true });
                
            cardsContainer.innerHTML = '';
            if(cardsError || !cards || cards.length === 0) {
                cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>';
            } else {
                cards.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'admin-list-item';
                    cardElement.innerHTML = `
                        <span>- ${card.name.ku_sorani} (ڕیز: ${card.order})</span>
                        <div>
                            <button class="edit-card-btn edit-btn small-btn" data-card-id="${card.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-card-btn delete-btn small-btn" data-card-id="${card.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    cardsContainer.appendChild(cardElement);
                });
            }
        }
    },

    editShortcutRow: async function(rowId) {
        const { data: row, error } = await db.from(shortcutRowsCollection).select('*').eq('id', rowId).single();
        if (row) {
            document.getElementById('editingShortcutRowId').value = rowId;
            document.getElementById('shortcutRowTitleKuSorani').value = row.title.ku_sorani || '';
            document.getElementById('shortcutRowTitleKuBadini').value = row.title.ku_badini || '';
            document.getElementById('shortcutRowTitleAr').value = row.title.ar || '';
            document.getElementById('shortcutRowOrder').value = row.order || 10;

            document.getElementById('addShortcutRowForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی ڕیز';
            document.getElementById('cancelRowEditBtn').style.display = 'inline-block';
            document.getElementById('addShortcutRowForm').scrollIntoView({ behavior: 'smooth' });
        }
    },

    deleteShortcutRow: async function(rowId) {
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ (Cascade)')) {
            try {
                // Texmîn dikin ku 'on delete cascade' hatiye danîn
                const { error } = await db.from(shortcutRowsCollection).delete().eq('id', rowId);
                if (error) throw error;
                showNotification('ڕیزەکە بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                console.error("Error deleting shortcut row: ", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },

    editShortcutCard: async function(cardId) {
        const { data: card, error } = await db.from(shortcutCardsCollection).select('*').eq('id', cardId).single();
        if (card) {
            document.getElementById('editingShortcutCardId').value = cardId;
            document.getElementById('selectRowForCard').value = card.row_id;
            document.getElementById('shortcutCardNameKuSorani').value = card.name.ku_sorani || '';
            document.getElementById('shortcutCardNameKuBadini').value = card.name.ku_badini || '';
            document.getElementById('shortcutCardNameAr').value = card.name.ar || '';
            document.getElementById('shortcutCardImageUrl').value = card.imageUrl || '';
            document.getElementById('shortcutCardOrder').value = card.order || 10;
            
            const mainCatSelect = document.getElementById('shortcutCardMainCategory');
            mainCatSelect.value = card.categoryId || '';
            mainCatSelect.dispatchEvent(new Event('change')); 

            setTimeout(() => {
                const subCatSelect = document.getElementById('shortcutCardSubcategory');
                subCatSelect.value = card.subcategoryId || '';
                subCatSelect.dispatchEvent(new Event('change'));
                setTimeout(() => {
                    document.getElementById('shortcutCardSubSubcategory').value = card.subSubcategoryId || '';
                }, 500);
            }, 500);

            document.getElementById('addCardToRowForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوەی کارت';
            document.getElementById('cancelCardEditBtn').style.display = 'inline-block';
            document.getElementById('addCardToRowForm').scrollIntoView({ behavior: 'smooth' });
        }
    },

    deleteShortcutCard: async function(cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(shortcutCardsCollection).delete().eq('id', cardId);
                if (error) throw error;
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut card: ", error);
            }
        }
    },
    
    // Wek xwe dimîne
    updateShortcutCardCategoryDropdowns: function() {
        const categories = getCategories();
        if (categories.length === 0) return;
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
        const mainSelect = document.getElementById('shortcutCardMainCategory');
        
        mainSelect.innerHTML = '<option value="">-- هەموو کاڵاکان --</option>';
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name_ku_sorani;
            mainSelect.appendChild(option);
        });
    },

    // Guhertî bo Supabase
    renderHomeLayoutAdmin: async function() {
        const container = document.getElementById('homeLayoutListContainer');
        const { data: items, error } = await db
            .from(homeLayoutCollection)
            .select('*')
            .order('order', { ascending: true });

        container.innerHTML = '';
        if (error || !items || items.length === 0) {
            container.innerHTML = '<p>هیچ بەشێک بۆ لاپەڕەی سەرەکی زیاد نەکراوە. کلیک لە "زیادکردنی بەش" بکە.</p>';
            return;
        }

        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'layout-item';
            itemElement.dataset.id = item.id;
            itemElement.draggable = true;

            const itemName = (item.name && typeof item.name === 'object') ? (item.name[getCurrentLanguage()] || item.name.ku_sorani) : item.name;

            itemElement.innerHTML = `
                <div class="layout-item-info">
                    <i class="fas fa-grip-vertical drag-handle"></i>
                    <span>${itemName}</span>
                </div>
                <div class="layout-item-actions">
                    <label class="switch">
                        <input type="checkbox" class="enabled-toggle" ${item.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="delete-layout-item-btn delete-btn small-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(itemElement);
        });

        // Mantiqê Drag/Drop wek xwe dimîne
        const droppableItems = container.querySelectorAll('.layout-item');
        droppableItems.forEach(item => {
            item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0));
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
        });

        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (afterElement == null) {
                if (dragging) container.appendChild(dragging);
            } else {
                if (dragging) container.insertBefore(dragging, afterElement);
            }
        });
    },

    // Wek xwe dimîne
    getDragAfterElement: function(container, y) {
        const draggableElements = [...container.querySelectorAll('.layout-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },
    
    // Guhertî bo Supabase
    deleteHomeLayoutItem: async function(itemId) {
        if (confirm('دڵنیایت دەتەوێت ئەم بەشە لە لاپەڕەی سەرەki بسڕیتەوە؟')) {
            try {
                const { error } = await db.from(homeLayoutCollection).delete().eq('id', itemId);
                if (error) throw error;
                showNotification('بەشەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                console.error("Error deleting layout item:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },

    // Guhertî bo Supabase
    saveHomeLayout: async function() {
        const container = document.getElementById('homeLayoutListContainer');
        const saveBtn = document.getElementById('saveLayoutBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '...پاشەکەوت دەکرێت';

        const items = container.querySelectorAll('.layout-item');
        const updates = [];

        items.forEach((item, index) => {
            updates.push({
                id: item.dataset.id, // IDya rêzê
                order: index + 1,
                enabled: item.querySelector('.enabled-toggle').checked
            });
        });

        try {
            // 'upsert' bikar bîne ji bo nûvekirina hemî rêzan di yek carekê de
            const { error } = await db.from(homeLayoutCollection).upsert(updates);
            if (error) throw error;
            
            showNotification('ڕیزبەندی پەڕەی سەرەki پاشەکەوت کرا', 'success');
            clearProductCache();
        } catch (error) {
            console.error("Error saving layout:", error);
            showNotification('هەڵەیەک لە پاشەکەوتکردن ڕوویدا', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    },
    
    // Hemî event listenerên ku bi Supabase re hatine nûve kirin
    setupAdminEventListeners: function() {
        if (this.listenersAttached) return;
        const self = this;
        
        document.getElementById('saveLayoutBtn')?.addEventListener('click', () => self.saveHomeLayout());
        
        document.getElementById('addHomeSectionBtn')?.addEventListener('click', () => {
            document.getElementById('addHomeSectionForm').reset();
            document.getElementById('specificItemGroupSelectContainer').style.display = 'none';
            document.getElementById('specificCategorySelectContainer').style.display = 'none';
            openPopup('addHomeSectionModal', 'modal');
        });

        document.getElementById('homeLayoutListContainer').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-layout-item-btn');
            if(deleteBtn) {
                const itemId = deleteBtn.closest('.layout-item').dataset.id;
                self.deleteHomeLayoutItem(itemId);
            }
        });

        document.getElementById('newSectionType').addEventListener('change', async (e) => {
            const type = e.target.value;
            const groupContainer = document.getElementById('specificItemGroupSelectContainer');
            const categoryContainer = document.getElementById('specificCategorySelectContainer');
            const groupSelect = document.getElementById('specificItemGroupId');
            const mainCatSelect = document.getElementById('newSectionMainCategory');
            const groupLabel = document.getElementById('specificItemGroupLabel');

            groupSelect.required = false;
            mainCatSelect.required = false;
            groupContainer.style.display = 'none';
            categoryContainer.style.display = 'none';

            if (type === 'promo_slider' || type === 'brands' || type === 'single_shortcut_row') {
                groupContainer.style.display = 'block';
                groupSelect.required = true;
                groupSelect.innerHTML = '<option value="">...بارکردن</option>';
                
                let collectionName, orderField, nameField;

                if (type === 'promo_slider') {
                    collectionName = promoGroupsCollection;
                    groupLabel.textContent = 'کام گرووپی سلایدەر؟';
                    orderField = 'name';
                    nameField = 'name';
                } else if (type === 'brands') {
                    collectionName = brandGroupsCollection;
                    groupLabel.textContent = 'کام گرووپی براند؟';
                    orderField = 'name';
                    nameField = 'name';
                } else { 
                    collectionName = shortcutRowsCollection;
                    groupLabel.textContent = 'کام ڕیزی کارت؟';
                    orderField = 'order';
                    nameField = 'title'; // title stûnek JSON e
                }
                
                const { data, error } = await db.from(collectionName).select(`id, ${nameField}`).order(orderField);
                groupSelect.innerHTML = `<option value="" disabled selected>-- گرووپ/ڕیزێک هەڵبژێرە --</option>`;
                if(data) {
                    data.forEach(item => {
                        // Heke nav JSON be, wê bi rêkûpêk bigire
                        const name = (typeof item[nameField] === 'object' && item[nameField] !== null) ? item[nameField].ku_sorani : item[nameField];
                        groupSelect.innerHTML += `<option value="${item.id}">${name}</option>`;
                    });
                }
            } else if (type === 'single_category_row') {
                categoryContainer.style.display = 'block';
                mainCatSelect.required = true;
                mainCatSelect.innerHTML = '<option value="">-- جۆری سەرەکی هەڵبژێرە (پێویستە) --</option>';
                getCategories().filter(c => c.id !== 'all').forEach(cat => {
                    mainCatSelect.innerHTML += `<option value="${cat.id}">${cat.name_ku_sorani}</option>`;
                });
            }
        });
        
        document.getElementById('addHomeSectionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('newSectionType').value;
            const nameInput = document.getElementById('newSectionName').value;
            
            let nameObj = { ku_sorani: nameInput, ku_badini: nameInput, ar: nameInput };
            let newSectionData = {
                name: nameObj,
                type,
                enabled: true,
            };
            
            if (type === 'promo_slider' || type === 'brands') {
                newSectionData.group_id = document.getElementById('specificItemGroupId').value;
                if (!newSectionData.group_id) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }
            } else if (type === 'single_shortcut_row') {
                newSectionData.rowId = document.getElementById('specificItemGroupId').value; // Dibe ku ev 'row_id' be
                if (!newSectionData.rowId) { showNotification('تکایە ڕیزێک هەڵبژێرە', 'error'); return; }
            } else if (type === 'single_category_row') {
                newSectionData.categoryId = document.getElementById('newSectionMainCategory').value;
                newSectionData.subcategoryId = document.getElementById('newSectionSubcategory').value || null;
                newSectionData.subSubcategoryId = document.getElementById('newSectionSubSubcategory').value || null;
                if (!newSectionData.categoryId) { showNotification('تکایە جۆری سەرەki هەڵبژێرە', 'error'); return; }
            }

            try {
                // Rêza herî dawî bistîne
                const { data: lastItem, error: orderError } = await db.from(homeLayoutCollection).select('order').order('order', { ascending: false }).limit(1);
                const lastOrder = (lastItem && lastItem.length > 0) ? lastItem[0].order : 0;
                newSectionData.order = lastOrder + 1;
                
                const { error } = await db.from(homeLayoutCollection).insert(newSectionData);
                if (error) throw error;

                showNotification('بەشی نوێ زیادکرا', 'success');
                closeCurrentPopup();
                clearProductCache();
            } catch (error) {
                console.error("Error adding new home section:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        });

        document.getElementById('newSectionMainCategory').addEventListener('change', async (e) => {
            const mainCatId = e.target.value;
            const subContainer = document.getElementById('newSectionSubcategoryContainer');
            const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer');
            const subSelect = document.getElementById('newSectionSubcategory');
            
            subSubContainer.style.display = 'none';
            subSelect.innerHTML = '';
            
            if (mainCatId) {
                subContainer.style.display = 'block';
                subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const { data, error } = await db.from(subcategoriesCollection).select('id, name_ku_sorani').eq('category_id', mainCatId).order('order');
                subSelect.innerHTML = '<option value="">-- هەموو (یان هەڵبژێرە) --</option>';
                if(data) data.forEach(item => {
                    subSelect.innerHTML += `<option value="${item.id}">${item.name_ku_sorani}</option>`;
                });
            } else {
                subContainer.style.display = 'none';
            }
        });
        
        document.getElementById('newSectionSubcategory').addEventListener('change', async (e) => {
            const subCatId = e.target.value;
            const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer');
            const subSubSelect = document.getElementById('newSectionSubSubcategory');
            
            subSubSelect.innerHTML = '';

            if (subCatId) {
                subSubContainer.style.display = 'block';
                subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const { data, error } = await db.from(subSubcategoriesCollection).select('id, name_ku_sorani').eq('subcategory_id', subCatId).order('order');
                subSubSelect.innerHTML = '<option value="">-- هەموو (یان هەڵبژێرە) --</option>';
                if(data) data.forEach(item => {
                    subSubSelect.innerHTML += `<option value="${item.id}">${item.name_ku_sorani}</option>`;
                });
            } else {
                subSubContainer.style.display = 'none';
            }
        });
        
        document.getElementById('addProductBtn').onclick = () => {
            setEditingProductId(null);
            document.getElementById('productForm').reset();
            self.createProductImageInputs();
            document.getElementById('subcategorySelectContainer').style.display = 'none';
            document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
            document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
            openPopup('productFormModal', 'modal');
        };

        document.getElementById('settingsLogoutBtn').onclick = async () => {
            await auth.signOut();
            showNotification(t('logout_success'), 'success');
        };
        
        document.getElementById('productCategoryId').addEventListener('change', (e) => {
            self.populateSubcategoriesDropdown(e.target.value);
            self.populateSubSubcategoriesDropdown(null, null);
        });

        document.getElementById('productSubcategoryId').addEventListener('change', (e) => {
            self.populateSubSubcategoriesDropdown(e.target.value);
        });

        document.getElementById('productForm').onsubmit = async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...چاوەڕێ بە';
            const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
            if (imageUrls.length === 0) {
                showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
                submitButton.disabled = false;
                submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                return;
            }

            const productDescriptionObject = {
                ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                ku_badini: document.getElementById('productDescriptionKuBadini').value,
                ar: document.getElementById('productDescriptionAr').value
            };

            const productNameKuSorani = document.getElementById('productNameKuSorani').value;
            const productNameObject = {
                ku_sorani: productNameKuSorani,
                ku_badini: document.getElementById('productNameKuBadini').value,
                ar: document.getElementById('productNameAr').value
            };

            try {
                const productData = {
                    name: productNameObject,
                    searchableName: productNameKuSorani.toLowerCase(),
                    price: parseInt(document.getElementById('productPrice').value),
                    originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
                    categoryId: document.getElementById('productCategoryId').value || null,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: productDescriptionObject,
                    imageUrls: imageUrls,
                    // 'created_at' dê ji hêla databaseê ve bixweber were danîn
                    externalLink: document.getElementById('productExternalLink').value || null,
                    shippingInfo: {
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                        ar: document.getElementById('shippingInfoAr').value.trim()
                    }
                };
                const editingId = getEditingProductId();
                
                let error;
                if (editingId) {
                    const { error: updateError } = await db.from(productsCollection).update(productData).eq('id', editingId);
                    error = updateError;
                    if (!error) showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    const { error: insertError } = await db.from(productsCollection).insert(productData);
                    error = insertError;
                    if (!error) showNotification('کاڵا زیادکرا', 'success');
                }
                
                if (error) throw error;
                
                clearProductCache();
                closeCurrentPopup();
            } catch (error) {
                showNotification(t('error_generic'), 'error');
                console.error("Error saving product:", error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = getEditingProductId() ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                setEditingProductId(null);
            }
        };

        document.getElementById('imageInputsContainer').addEventListener('input', (e) => {
            if (e.target.classList.contains('productImageUrl')) {
                const previewImg = e.target.nextElementSibling;
                const url = e.target.value;
                if (url) { previewImg.src = url; } else {
                    const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                    previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
                }
            }
        });
        
        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;

                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value,
                    order: parseInt(document.getElementById('mainCategoryOrder').value)
                };

                try {
                    const { error } = await db.from(categoriesCollection).insert(categoryData);
                    if (error) throw error;
                    showNotification('جۆری سەرەki بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryForm.reset();
                    clearProductCache();
                    self.renderCategoryManagementUI(); // Lîsteyê nûve bike
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەki';
                }
            });
        }

        const addSubcategoryForm = document.getElementById('addSubcategoryForm');
        if (addSubcategoryForm) {
            addSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const parentCategoryId = document.getElementById('parentCategorySelect').value;
                if (!parentCategoryId) {
                    showNotification('تکایە جۆری سەرەki هەڵبژێرە', 'error');
                    return;
                }
                
                const subcategoryData = {
                    name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subcategoryNameAr').value,
                    order: parseInt(document.getElementById('subcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subcategoryImageUrl').value.trim() || null,
                    category_id: parentCategoryId // ForeignKey
                };

                try {
                    const { error } = await db.from(subcategoriesCollection).insert(subcategoryData);
                    if (error) throw error;
                    showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addSubcategoryForm.reset();
                    clearProductCache();
                    self.renderCategoryManagementUI();
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic'), 'error');
                }
            });
        }

        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) {
            addSubSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const subCatId = document.getElementById('parentSubcategorySelectForSubSub').value;
                if (!subCatId) {
                    showNotification('تکایە جۆری لاوەکی هەڵبژێرە', 'error');
                    return;
                }

                const subSubcategoryData = {
                    name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subSubcategoryNameAr').value,
                    order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subSubcategoryImageUrl').value.trim() || null,
                    subcategory_id: subCatId // ForeignKey
                };

                try {
                    const { error } = await db.from(subSubcategoriesCollection).insert(subSubcategoryData);
                    if (error) throw error;
                    showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addSubSubcategoryForm.reset();
                    clearProductCache();
                    self.renderCategoryManagementUI();
                } catch (error) {
                    console.error("Error adding sub-subcategory: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                }
            });
        }

        const editCategoryForm = document.getElementById('editCategoryForm');
        if (editCategoryForm) {
            editCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('editCategoryDocPath').value;
                const level = document.getElementById('editCategoryLevel').value;

                let updateData = {
                    name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                    name_ar: document.getElementById('editCategoryNameAr').value,
                    order: parseInt(document.getElementById('editCategoryOrder').value) || 0
                };
                
                let tableName;
                if (level === '1') {
                    tableName = categoriesCollection;
                    updateData.icon = document.getElementById('editCategoryIcon').value;
                } else {
                    updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null;
                    tableName = (level === '2') ? subcategoriesCollection : subSubcategoriesCollection;
                }

                try {
                    const { error } = await db.from(tableName).update(updateData).eq('id', id);
                    if (error) throw error;
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup();
                    clearProductCache();
                    self.renderCategoryManagementUI();
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                }
            });
        }

        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const announcementData = {
                    title: {
                        ku_sorani: document.getElementById('announcementTitleKuSorani').value,
                        ku_badini: document.getElementById('announcementTitleKuBadini').value,
                        ar: document.getElementById('announcementTitleAr').value,
                    },
                    content: {
                        ku_sorani: document.getElementById('announcementContentKuSorani').value,
                        ku_badini: document.getElementById('announcementContentKuBadini').value,
                        ar: document.getElementById('announcementContentAr').value,
                    },
                    // created_at dê bixweber were danîn
                };

                try {
                    const { error } = await db.from(announcementsCollection).insert(announcementData);
                    if (error) throw error;
                    showNotification('ئاگەداری بە سەرکەوتوویی نێردرا', 'success');
                    announcementForm.reset();
                    self.renderAdminAnnouncementsList();
                } catch (error) {
                    console.error("Error sending announcement: ", error);
                    showNotification(t('error_generic'), 'error');
                }
            });
        }
        
        const policiesForm = document.getElementById('policiesForm');
        if (policiesForm) {
            policiesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const policiesData = {
                    content: {
                        ku_sorani: document.getElementById('policiesContentKuSorani').value,
                        ku_badini: document.getElementById('policiesContentKuBadini').value,
                        ar: document.getElementById('policiesContentAr').value,
                    },
                    id: 'current' // Her gav heman rêzê nûve bike
                };

                try {
                    // 'upsert' bikar bîne ji bo nûvekirin an çêkirina rêza polîtîkayê
                    const { error } = await db.from(policiesCollection).upsert(policiesData, { onConflict: 'id' });
                    if (error) throw error;
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) {
                    console.error("Error saving policies:", error);
                    showNotification(t('error_generic'), 'error');
                }
            });
        }
        
        const socialMediaToggle = document.getElementById('socialMediaToggle');
        socialMediaToggle.onclick = () => {
            const container = document.getElementById('adminSocialMediaManagement').querySelector('.contact-links-container');
            const chevron = socialMediaToggle.querySelector('.contact-chevron');
            container.classList.toggle('open');
            chevron.classList.toggle('open');
        };
        
        const addSocialMediaForm = document.getElementById('addSocialMediaForm');
        addSocialMediaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const socialData = {
                name_ku_sorani: document.getElementById('socialNameKuSorani').value,
                name_ku_badini: document.getElementById('socialNameKuBadini').value,
                name_ar: document.getElementById('socialNameAr').value,
                url: document.getElementById('socialUrl').value,
                icon: document.getElementById('socialIcon').value,
            };
            try {
                const { error } = await db.from(socialLinksCollection).insert(socialData);
                if (error) throw error;
                showNotification('لینک زیادکرا', 'success');
                addSocialMediaForm.reset();
                self.renderSocialMediaLinks();
            } catch (error) {
                showNotification(t('error_generic'), 'error');
            }
        });
        
        const addContactMethodForm = document.getElementById('addContactMethodForm');
        if (addContactMethodForm) {
            addContactMethodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const methodData = {
                    type: document.getElementById('contactMethodType').value,
                    value: document.getElementById('contactMethodValue').value,
                    name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                    name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                    name_ar: document.getElementById('contactMethodNameAr').value,
                    icon: document.getElementById('contactMethodIcon').value,
                    color: document.getElementById('contactMethodColor').value,
                };

                try {
                    const { error } = await db.from(contactMethodsCollection).insert(methodData);
                    if (error) throw error;
                    showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addContactMethodForm.reset();
                    self.renderContactMethodsAdmin();
                } catch (error) {
                    console.error("Error adding contact method: ", error);
                    showNotification(t('error_generic'), 'error');
                }
            });
        }
        
        // --- PROMO (SUPABASE) ---
        document.getElementById('addPromoGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('promoGroupName').value;
            if (name.trim()) {
                const { error } = await db.from(promoGroupsCollection).insert({ name: name.trim() });
                if (!error) {
                    showNotification('گرووپی سلایدەر زیادکرا', 'success');
                    e.target.reset();
                    self.renderPromoGroupsAdminList();
                }
            }
        });

        document.getElementById('addPromoCardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('promoCardGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }

            const editingId = document.getElementById('editingPromoCardId').value;
            const cardData = {
                imageUrls: {
                    ku_sorani: document.getElementById('promoCardImageKuSorani').value,
                    ku_badini: document.getElementById('promoCardImageKuBadini').value,
                    ar: document.getElementById('promoCardImageAr').value,
                },
                categoryId: document.getElementById('promoCardTargetCategory').value,
                order: parseInt(document.getElementById('promoCardOrder').value),
                group_id: groupId // ForeignKey
            };

            try {
                let error;
                if (editingId) {
                    const { error: updateError } = await db.from(promoCardsCollection).update(cardData).eq('id', editingId);
                    error = updateError;
                    if (!error) showNotification('کارتەکە نوێکرایەوە', 'success');
                } else {
                    const { error: insertError } = await db.from(promoCardsCollection).insert(cardData);
                    error = insertError;
                    if (!error) showNotification('کارتی نوێ زیادکرا', 'success');
                }
                if (error) throw error;
                e.target.reset();
                document.getElementById('editingPromoCardId').value = '';
                document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردنی کارت';
                clearProductCache();
                self.renderPromoGroupsAdminList();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); } 
        });

        document.getElementById('promoGroupsListContainer').addEventListener('click', (e) => {
            const editGroupBtn = e.target.closest('.edit-promo-group-btn');
            if (editGroupBtn) self.editPromoGroup(editGroupBtn.dataset.id);

            const deleteGroupBtn = e.target.closest('.delete-promo-group-btn');
            if (deleteGroupBtn) self.deletePromoGroup(deleteGroupBtn.dataset.id);

            const editCardBtn = e.target.closest('.edit-promo-card-btn');
            if (editCardBtn) self.editPromoCard(editCardBtn.dataset.cardId);

            const deleteCardBtn = e.target.closest('.delete-promo-card-btn');
            if (deleteCardBtn) self.deletePromoCard(deleteCardBtn.dataset.cardId);
        });
        
        // --- BRAND (SUPABASE) ---
        document.getElementById('addBrandGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('brandGroupName').value;
            if (name.trim()) {
                const { error } = await db.from(brandGroupsCollection).insert({ name: name.trim() });
                if (!error) {
                    showNotification('گرووپی براند زیادکرا', 'success');
                    e.target.reset();
                    self.renderBrandGroupsAdminList();
                }
            }
        });

        document.getElementById('addBrandForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('brandGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }

            const editingId = document.getElementById('editingBrandId').value;
            const brandData = {
                name: {
                    ku_sorani: document.getElementById('brandNameKuSorani').value,
                    ku_badini: document.getElementById('brandNameKuBadini').value,
                    ar: document.getElementById('brandNameAr').value,
                },
                imageUrl: document.getElementById('brandImageUrl').value,
                categoryId: document.getElementById('brandTargetMainCategory').value || null,
                subcategoryId: document.getElementById('brandTargetSubcategory').value || null,
                order: parseInt(document.getElementById('brandOrder').value) || 0,
                group_id: groupId // ForeignKey
            };

            try {
                let error;
                if (editingId) {
                    const { error: updateError } = await db.from(brandsCollection).update(brandData).eq('id', editingId);
                    error = updateError;
                    if (!error) showNotification('براند نوێکرایەوە', 'success');
                } else {
                    const { error: insertError } = await db.from(brandsCollection).insert(brandData);
                    error = insertError;
                    if (!error) showNotification('براندی نوێ زیادکرا', 'success');
                }
                if (error) throw error;
                e.target.reset();
                document.getElementById('editingBrandId').value = '';
                document.getElementById('brandSubcategoryContainer').style.display = 'none';
                document.getElementById('addBrandForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردنی براند';
                clearProductCache();
                self.renderBrandGroupsAdminList();
            } catch (error) { console.error("Error saving brand:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); } 
        });

        document.getElementById('brandGroupsListContainer').addEventListener('click', (e) => {
            if (e.target.closest('.edit-brand-group-btn')) self.editBrandGroup(e.target.closest('.edit-brand-group-btn').dataset.id);
            if (e.target.closest('.delete-brand-group-btn')) self.deleteBrandGroup(e.target.closest('.delete-brand-group-btn').dataset.id);
            if (e.target.closest('.edit-brand-btn')) self.editBrand(e.target.closest('.edit-brand-btn').dataset.brandId);
            if (e.target.closest('.delete-brand-btn')) self.deleteBrand(e.target.closest('.delete-brand-btn').dataset.brandId);
        });
        
        const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
        brandMainCatSelect.addEventListener('change', async (e) => {
            const mainCatId = e.target.value;
            const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
            const brandSubCatSelect = document.getElementById('brandTargetSubcategory');
            if (mainCatId) {
                brandSubCatContainer.style.display = 'block';
                brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const { data, error } = await db.from(subcategoriesCollection).select('id, name_ku_sorani').eq('category_id', mainCatId).order('order');
                brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>';
                if(data) data.forEach(subcat => {
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani;
                    brandSubCatSelect.appendChild(option);
                });
            } else {
                brandSubCatContainer.style.display = 'none';
                brandSubCatSelect.innerHTML = '';
            }
        });
        
        // --- SHORTCUT (SUPABASE) ---
        document.getElementById('shortcutRowsListContainer').addEventListener('click', (e) => {
            const editRowBtn = e.target.closest('.edit-row-btn');
            if (editRowBtn) self.editShortcutRow(editRowBtn.dataset.id);
        
            const deleteRowBtn = e.target.closest('.delete-row-btn');
            if (deleteRowBtn) self.deleteShortcutRow(deleteRowBtn.dataset.id);
        
            const editCardBtn = e.target.closest('.edit-card-btn');
            if (editCardBtn) self.editShortcutCard(editCardBtn.dataset.cardId);
        
            const deleteCardBtn = e.target.closest('.delete-card-btn');
            if (deleteCardBtn) self.deleteShortcutCard(deleteCardBtn.dataset.cardId);
        });

        // Wek xwe dimîne
        this.listenersAttached = true;
    }
};
