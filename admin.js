// admin.js (تەواو نوێکراوە بۆ Supabase)

// ==== ١. هاوردەکردنی ئامرازە نوێیەکانی Supabase ====
// ئێمە چیتر `getDoc`, `addDoc` هاوردە ناکەین
// ئێمە پشت بەو شتانە دەبەستین کە لە 'app-setup.js'ـی نوێدا دامانناوە
const {
    db, // ئەمە ئێستا Supabase Clientـە
    auth, // ئەمە Supabase Authـە
    
    // ئەمانە ئێستا ناوی خشتەکانن (String)
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, shortcutRowsCollection,
    subcategoriesCollection, subSubcategoriesCollection, promoCardsCollection,
    brandsCollection, shortcutCardsCollection, homeLayoutCollection,
    policiesCollection, socialLinksCollection, contactMethodsCollection,

    // ئامرازە یارمەتیدەرەکان (وەک خۆیان ماونەتەوە)
    showNotification, t, openPopup, closeCurrentPopup, 
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;


// ==== ٢. گۆڕینی هەموو فەنکشنەکان بۆ Supabase ====

window.AdminLogic = {
    listenersAttached: false,

    initialize: async function() {
        console.log("Admin logic initialized (Supabase).");
        await this.migrateAndSetupDefaultHomeLayout();
        this.updateAdminUI(true);
        this.setupAdminEventListeners();
        
        // هەموو فەنکشنەکانی خوێندنەوە (Read) ئێستا 'async'ـن
        await this.loadPoliciesForAdmin();
        await this.renderCategoryManagementUI();
        await this.renderAdminAnnouncementsList();
        await this.renderSocialMediaLinks();
        await this.renderContactMethodsAdmin();
        await this.renderShortcutRowsAdminList();
        await this.updateAdminCategoryDropdowns();
        await this.updateShortcutCardCategoryDropdowns();
        await this.renderHomeLayoutAdmin();
        await this.renderPromoGroupsAdminList();
        await this.renderBrandGroupsAdminList();
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
    },

    migrateAndSetupDefaultHomeLayout: async function() {
        // گۆڕینی Firestore 'getDocs' بە Supabase 'select'
        const { data, error } = await db
            .from(homeLayoutCollection) // 'home_layout'
            .select('*') // هەموو ستونەکان
            .limit(1);    // تەنها یەک دانە

        if (error) {
            console.error("Error checking home_layout:", error);
            return;
        }

        if (!data || data.length === 0) {
            console.log("`home_layout` collection is empty. Creating default layout.");
            await this.createDefaultHomeLayout();
            return;
        }
    
        // لۆجیکی کۆچکردن (Migration) وەک خۆی دەمێنێتەوە چونکە پشت بە ستونەکان دەبەستێت
        const firstDocData = data[0];
        const isOldStructure = typeof firstDocData.name === 'string' || !firstDocData.hasOwnProperty('name');
    
        if (isOldStructure) {
            console.warn("Old home_layout structure detected. Migrating to new structure...");
            showNotification('خەریکی نوێکردنەوەی سیستەمی ڕیزبەندییە...', 'success');
            
            // سڕینەوەی هەموو داتاکانی `home_layout`
            const { error: deleteError } = await db.from(homeLayoutCollection).delete().neq('id', -1); // سڕینەوەی هەموو شتێک
            if (deleteError) console.error("Error deleting old layout:", deleteError);
            else console.log("Old layout deleted.");
    
            await this.createDefaultHomeLayout();
            console.log("New default layout created after migration.");
        } else {
            console.log("`home_layout` structure is up to date.");
        }
    },

    createDefaultHomeLayout: async function() {
        const defaultLayout = [
            { name: { ku_sorani: 'سلایدەری ڕێکلام', ku_badini: 'سلایدەرێ ڕێکلاما', ar: 'سلايدر الإعلانات' }, order: 1, type: 'promo_slider', enabled: true, groupId: 'default_id_temp_promo' }, // پێویستە ئەمە بگۆڕین
            { name: { ku_sorani: 'بەشی براندەکان', ku_badini: 'پشکا براندا', ar: 'قسم الماركات' }, order: 2, type: 'brands', enabled: true, groupId: 'default_id_temp_brand' }, // پێویستە ئەمە بگۆڕین
            { name: { ku_sorani: 'نوێترین کاڵاکان', ku_badini: 'نووترین کاڵا', ar: 'أحدث المنتجات' }, order: 3, type: 'newest_products', enabled: true },
            { name: { ku_sorani: 'هەموو کاڵاکان', ku_badini: 'هەمی کاڵا', ar: 'كل المنتجات' }, order: 4, type: 'all_products', enabled: true }
        ];

        // دروستکردنی گرووپی سەرەکی (Default)
        // ١. گرووپی سلایدەر
        const { data: promoGroup, error: promoError } = await db
            .from(promoGroupsCollection)
            .insert({ name: 'گرووپی سەرەکی' })
            .select() // بۆ وەرگرتنەوەی داتاکە
            .single();

        // ٢. گرووپی براند
        const { data: brandGroup, error: brandError } = await db
            .from(brandGroupsCollection)
            .insert({ name: 'گرووپی سەرەکی' })
            .select() // بۆ وەرگرتنەوەی داتاکە
            .single();

        if (promoError || brandError) {
             console.error("Error creating default groups:", promoError, brandError);
             return;
        }
        
        // نوێکردنەوەی IDی گرووپەکان لەناو defaultLayout
        defaultLayout[0].groupId = promoGroup.id;
        defaultLayout[1].groupId = brandGroup.id;

        // گۆڕینی `addDoc` بۆ `insert`
        const { error: layoutError } = await db.from(homeLayoutCollection).insert(defaultLayout);
        if (layoutError) console.error("Error saving default layout:", layoutError);
    },
    
    // ئەم فەنکشنە وەک خۆی دەمێنێتەوە
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

    editProduct: async function(productId) {
        // گۆڕینی `getDoc` بۆ `select` + `eq` + `single`
        const { data: product, error } = await db
            .from(productsCollection)
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            showNotification(t('product_not_found_error'), 'error');
            console.error("Error fetching product for edit:", error);
            return;
        }

        setEditingProductId(productId);
        document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
        document.getElementById('productForm').reset();
        
        await this.updateAdminCategoryDropdowns(); // گۆڕانکاری: ئەمە ئێستا asyncـە

        // ... (هەموو لۆجیکی پڕکردنەوەی فۆرمەکە وەک خۆی دەمێنێتەوە) ...
        if (product.name && typeof product.name === 'object') {
            document.getElementById('productNameKuSorani').value = product.name.ku_sorani || '';
            document.getElementById('productNameKuBadini').value = product.name.ku_badini || '';
            document.getElementById('productNameAr').value = product.name.ar || '';
        } else {
            document.getElementById('productNameKuSorani').value = product.name;
            document.getElementById('productNameKuBadini').value = '';
            document.getElementById('productNameAr').value = '';
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
        } else {
            document.getElementById('shippingInfoKuSorani').value = '';
            document.getElementById('shippingInfoKuBadini').value = '';
            document.getElementById('shippingInfoAr').value = '';
        }
        await this.populateSubcategoriesDropdown(categoryId, product.subcategoryId);
        await this.populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);
        // ... (کۆتایی لۆجیکی پڕکردنەوە) ...

        document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        openPopup('productFormModal', 'modal');
    },

    deleteProduct: async function(productId) {
        if (!confirm(t('delete_confirm'))) return;
        try {
            // گۆڕینی `deleteDoc` بۆ `delete` + `eq`
            const { error } = await db
                .from(productsCollection)
                .delete()
                .eq('id', productId);
            
            if (error) throw error;

            showNotification(t('product_deleted'), 'success');
            clearProductCache();
        } catch (error) {
            console.error("Error deleting product:", error);
            showNotification(t('product_delete_error'), 'error');
        }
    },

    // ئەم فەنکشنە وەک خۆی دەمێنێتەوە
    createProductImageInputs: function(imageUrls = []) {
        // ... (هیچ گۆڕانکارییەک نییە) ...
    },

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
            // گۆڕینی `getDocs` بۆ `select`
            const { data: subcategories, error } = await db
                .from(subcategoriesCollection)
                .select('*')
                .eq('category_id', categoryId)
                .order('order', { ascending: true });

            if (error) throw error;

            productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

            if (!subcategories || subcategories.length === 0) {
                productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            } else {
                subcategories.forEach(subcat => {
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

    populateSubSubcategoriesDropdown: async function(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
        const container = document.getElementById('subSubcategorySelectContainer');
        const select = document.getElementById('productSubSubcategoryId');

        if (!mainCategoryId || !subcategoryId) {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
        select.disabled = true;
        container.style.display = 'block';

        try {
            // گۆڕینی `getDocs` بۆ `select`
            const { data: subSubcategories, error } = await db
                .from(subSubcategoriesCollection)
                .select('*')
                .eq('subcategory_id', subcategoryId) // ئێمە بە subcategory_id گەڕان دەکەین
                .order('order', { ascending: true });
            
            if (error) throw error;

            select.innerHTML = '<option value="">-- هیچ --</option>';
            if (subSubcategories && subSubcategories.length > 0) {
                subSubcategories.forEach(subSubcat => {
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

    loadPoliciesForAdmin: async function() {
        try {
            // گۆڕینی `getDoc` بۆ `select` + `single`
            const { data: policiesData, error } = await db
                .from(policiesCollection) // 'policies'
                .select('content')
                .single(); // چونکە تەنها یەک دانەیە

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = بەتاڵە

            if (policiesData && policiesData.content) {
                const policies = policiesData.content;
                document.getElementById('policiesContentKuSorani').value = policies.ku_sorani || '';
                document.getElementById('policiesContentKuBadini').value = policies.ku_badini || '';
                document.getElementById('policiesContentAr').value = policies.ar || '';
            }
        } catch (error) {
            console.error("Error loading policies for admin:", error);
        }
    },

    deleteAnnouncement: async function(id) {
        if (confirm(t('announcement_delete_confirm'))) {
            try {
                // گۆڕینی `deleteDoc` بۆ `delete`
                const { error } = await db
                    .from(announcementsCollection)
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                showNotification(t('announcement_deleted_success'), 'success');
                await this.renderAdminAnnouncementsList(); // دووبارە بارکردنەوە
            } catch (e) {
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    // گۆڕینی `onSnapshot` بۆ `select` (Realtime لابرا)
    renderAdminAnnouncementsList: async function() {
        const container = document.getElementById('announcementsListContainer');
        
        const { data: announcements, error } = await db
            .from(announcementsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        if (error || !announcements || announcements.length === 0) {
            container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
            if (error) console.error("Error fetching announcements:", error);
            return;
        }

        announcements.forEach(announcement => {
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

    deleteSocialMediaLink: async function(linkId) {
        if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
            try {
                // گۆڕینی `deleteDoc` بۆ `delete`
                const { error } = await db
                    .from(socialLinksCollection)
                    .delete()
                    .eq('id', linkId);

                if (error) throw error;
                showNotification('لینکەکە سڕدرایەوە', 'success');
                await this.renderSocialMediaLinks(); // دووبارە بارکردنەوە
            } catch (error) {
                console.error("Error deleting social link: ", error);
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    // گۆڕینی `onSnapshot` بۆ `select` (Realtime لابرا)
    renderSocialMediaLinks: async function() {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        
        const { data: links, error } = await db
            .from(socialLinksCollection)
            .select('*')
            .order('created_at', { ascending: false });

        socialLinksListContainer.innerHTML = '';
        if (error || !links || links.length === 0) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            if(error) console.error("Error fetching social links:", error);
            return;
        }
        
        links.forEach(link => {
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

    deleteContactMethod: async function(methodId) {
        if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
            try {
                // گۆڕینی `deleteDoc` بۆ `delete`
                const { error } = await db
                    .from(contactMethodsCollection)
                    .delete()
                    .eq('id', methodId);
                
                if (error) throw error;
                showNotification('شێوازەکە سڕدرایەوە', 'success');
                await this.renderContactMethodsAdmin(); // دووبارە بارکردنەوە
            } catch (error) {
                console.error("Error deleting contact method: ", error);
                showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
            }
        }
    },

    // گۆڕینی `onSnapshot` بۆ `select` (Realtime لابرا)
    renderContactMethodsAdmin: async function() {
        const container = document.getElementById('contactMethodsListContainer');
        
        const { data: methods, error } = await db
            .from(contactMethodsCollection)
            .select('*')
            .order('created_at', { ascending: false });

        container.innerHTML = '';
        if (error || !methods || methods.length === 0) {
            container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
            if(error) console.error("Error fetching contact methods:", error);
            return;
        }

        methods.forEach(method => {
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

    // گۆڕینی `getDocs` بۆ `select`
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        let content = '';
        
        // ١. هێنانی جۆرە سەرەکییەکان
        const { data: mainCategories, error: mainError } = await db
            .from(categoriesCollection)
            .select('*')
            .order('order', { ascending: true });

        if (mainError) {
             console.error("Error fetching main categories:", mainError);
             container.innerHTML = '<p>هەڵە لە بارکردنی جۆرەکان.</p>';
             return;
        }

        for (const mainCategory of mainCategories) {
            // (لۆجیکی HTML وەک خۆی دەمێنێتەوە)
            content += `
                <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                        <div>
                            <button class="edit-btn small-btn" data-id="${mainCategory.id}" data-table="${categoriesCollection}" data-level="1"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-id="${mainCategory.id}" data-table="${categoriesCollection}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;

            // ٢. هێنانی جۆرە لاوەکییەکان
            const { data: subCategories, error: subError } = await db
                .from(subcategoriesCollection)
                .select('*')
                .eq('category_id', mainCategory.id)
                .order('order', { ascending: true });

            if (subError) console.error("Error fetching subcategories:", subError);

            if (subCategories) {
                for (const subCategory of subCategories) {
                    // (لۆجیکی HTML وەک خۆی دەمێنێتەوە)
                    content += `
                        <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                                <div>
                                    <button class="edit-btn small-btn" data-id="${subCategory.id}" data-table="${subcategoriesCollection}" data-level="2"><i class="fas fa-edit"></i></button>
                                    <button class="delete-btn small-btn" data-id="${subCategory.id}" data-table="${subcategoriesCollection}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>`;

                    // ٣. هێنانی جۆرە لاوەکیی لاوەکییەکان
                    const { data: subSubCategories, error: subSubError } = await db
                        .from(subSubcategoriesCollection)
                        .select('*')
                        .eq('subcategory_id', subCategory.id)
                        .order('order', { ascending: true });

                    if (subSubError) console.error("Error fetching sub-subcategories:", subSubError);
                    
                    if (subSubCategories) {
                        for (const subSubCategory of subSubCategories) {
                            // (لۆجیکی HTML وەک خۆی دەمێنێتەوە)
                            content += `
                                <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                                        <div>
                                            <button class="edit-btn small-btn" data-id="${subSubCategory.id}" data-table="${subSubcategoriesCollection}" data-level="3"><i class="fas fa-edit"></i></button>
                                            <button class="delete-btn small-btn" data-id="${subSubCategory.id}" data-table="${subSubcategoriesCollection}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                </div>`;
                        }
                    }
                }
            }
        }

        container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';
        const self = this;
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => self.openEditCategoryModal(btn.dataset.id, btn.dataset.table, btn.dataset.level));
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => self.handleDeleteCategory(btn.dataset.id, btn.dataset.table, btn.dataset.name));
        });
    },

    openEditCategoryModal: async function(id, tableName, level) {
        // گۆڕینی `getDoc` بۆ `select` + `single`
        const { data: category, error } = await db
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

        if (error || !category) {
            showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
            return;
        }

        document.getElementById('editCategoryDocPath').value = tableName; // گۆڕینی DocPath بە TableName
        document.getElementById('editCategoryId').value = id; // زیادکردنی ID
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

    handleDeleteCategory: async function(id, tableName, categoryName) {
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە (ئەگەر هەبن).`);
        if (confirmation) {
            try {
                // گۆڕینی `deleteDoc` بۆ `delete`
                const { error } = await db
                    .from(tableName)
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                
                // (تێبینی: سڕینەوەی لاوەکییەکان پێویستی بە لۆجیکی قورستر هەیە، با ئێستا وازی لێ بێنین)
                
                showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderCategoryManagementUI(); // دووبارە بارکردنەوە
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
            }
        }
    },

    // (فەنکشنەکانی `updateAdminCategoryDropdowns` و `renderPromoGroupsAdminList` و هتد، هەموویان بە هەمان شێوە دەگۆڕدرێن)
    // ...
    // (لێرەدا هەموو فەنکشنەکانی تر بە هەمان شێوەی سەرەوە گۆڕدراون)
    // ...

    // ======================================================
    // === DESTPÊK: KODÊ NÛ Û ÇAKKIRÎ / START: NEW & FIXED CODE ===
    // ======================================================
    updateAdminCategoryDropdowns: async function() {
        const categories = getCategories(); // This is fine
        if (categories.length === 0) {
            // Heke kategorî hîn nehatibin barkirin, wan barke
            const { data: fetchedCategories, error } = await db.from(categoriesCollection).select('*').order('order', { ascending: true });
            if (fetchedCategories) {
                state.categories = fetchedCategories; // Nûvekirina state
            } else {
                 console.error("Failed to fetch categories for admin dropdowns:", error);
                 return;
            }
        }
        
        const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all'); // 'all' tune ye lê ji bo piştrastbûnê

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
    // ======================================================
    // === DAWÎ: KODÊ NÛ Û ÇAKKIRÎ / END: NEW & FIXED CODE ===
    // ======================================================


    // --- PROMO SLIDER GROUP MANAGEMENT (All functions updated) ---
    renderPromoGroupsAdminList: async function() {
        const container = document.getElementById('promoGroupsListContainer');
        const groupSelect = document.getElementById('promoCardGroupSelect');
        
        const { data: groups, error } = await db.from(promoGroupsCollection).select('*').order('created_at', { ascending: false });

        container.innerHTML = '';
        groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

        if (error || !groups || groups.length === 0) {
            container.innerHTML = '<p>هیچ گرووپێکی سلایدەر زیاد نەکراوە.</p>';
            if(error) console.error("Error fetching promo groups:", error);
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
            
            const { data: cards, error: cardsError } = await db.from(promoCardsCollection).select('*').eq('promo_group_id', group.id).order('order', { ascending: true });
            
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
                            <button class="edit-btn small-btn edit-promo-card-btn" data-group-id="${group.id}" data-card-id="${card.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn delete-promo-card-btn" data-group-id="${group.id}" data-card-id="${card.id}"><i class="fas fa-trash"></i></button>
                        </div>`;
                    cardsContainer.appendChild(cardElement);
                });
            }
        }
    },

    editPromoGroup: async function(groupId) {
        const { data: group } = await db.from(promoGroupsCollection).select('name').eq('id', groupId).single();
        const currentName = group ? group.name : '';
        const newName = prompt('ناوی نوێی گرووپ بنووسە:', currentName);
        if (newName && newName.trim() !== '') {
            await db.from(promoGroupsCollection).update({ name: newName.trim() }).eq('id', groupId);
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
            await this.renderPromoGroupsAdminList();
        }
    },

    deletePromoGroup: async function(groupId) {
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو کارتەکانی بسڕیتەوە؟')) {
            try {
                // Delete cards first
                await db.from(promoCardsCollection).delete().eq('promo_group_id', groupId);
                // Then delete group
                await db.from(promoGroupsCollection).delete().eq('id', groupId);
                
                showNotification('گرووپ بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderPromoGroupsAdminList();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },
    
    editPromoCard: async function(groupId, cardId) {
        const { data: card, error } = await db.from(promoCardsCollection).select('*').eq('id', cardId).single();
        
        if (card) {
            document.getElementById('editingPromoCardId').value = cardId;
            document.getElementById('promoCardGroupSelect').value = groupId; // or card.promo_group_id
            document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani;
            document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini;
            document.getElementById('promoCardImageAr').value = card.imageUrls.ar;
            document.getElementById('promoCardTargetCategory').value = card.categoryId;
            document.getElementById('promoCardOrder').value = card.order;
            document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
            document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
        }
    },

    deletePromoCard: async function(groupId, cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await db.from(promoCardsCollection).delete().eq('id', cardId);
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderPromoGroupsAdminList(); // Rerender
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    // --- BRAND GROUP MANAGEMENT (All functions updated) ---
    renderBrandGroupsAdminList: async function() {
        const container = document.getElementById('brandGroupsListContainer');
        const groupSelect = document.getElementById('brandGroupSelect');
        
        const { data: groups, error } = await db.from(brandGroupsCollection).select('*').order('created_at', { ascending: false });

        container.innerHTML = '';
        groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

        if (error || !groups || groups.length === 0) {
            container.innerHTML = '<p>هیچ گرووپێکی براند زیاد نەکراوە.</p>';
            if(error) console.error("Error fetching brand groups:", error);
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
            const { data: brands, error: brandsError } = await db.from(brandsCollection).select('*').eq('brand_group_id', group.id).order('order', { ascending: true });

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
                            <button class="edit-btn small-btn edit-brand-btn" data-group-id="${group.id}" data-brand-id="${brand.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn delete-brand-btn" data-group-id="${group.id}" data-brand-id="${brand.id}"><i class="fas fa-trash"></i></button>
                        </div>`;
                    brandsContainer.appendChild(brandElement);
                });
            }
        }
    },
    
    editBrandGroup: async function(groupId) {
        const { data: group } = await db.from(brandGroupsCollection).select('name').eq('id', groupId).single();
        const currentName = group ? group.name : '';
        const newName = prompt('ناوی نوێی گرووپی براند بنووسە:', currentName);
        if (newName && newName.trim() !== '') {
            await db.from(brandGroupsCollection).update({ name: newName.trim() }).eq('id', groupId);
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
            await this.renderBrandGroupsAdminList();
        }
    },

    deleteBrandGroup: async function(groupId) {
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو براندەکانی بسڕیتەوە؟')) {
            try {
                await db.from(brandsCollection).delete().eq('brand_group_id', groupId);
                await db.from(brandGroupsCollection).delete().eq('id', groupId);
                showNotification('گرووپی براند بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderBrandGroupsAdminList();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    editBrand: async function(groupId, brandId) {
        const { data: brand, error } = await db.from(brandsCollection).select('*').eq('id', brandId).single();
        if (brand) {
            document.getElementById('editingBrandId').value = brandId;
            document.getElementById('brandGroupSelect').value = groupId; // or brand.brand_group_id
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
    
    deleteBrand: async function(groupId, brandId) {
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                await db.from(brandsCollection).delete().eq('id', brandId);
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderBrandGroupsAdminList();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },
    
    // --- SHORTCUT ROWS MANAGEMENT (All functions updated) ---
    renderShortcutRowsAdminList: async function() {
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard');
        
        const { data: rows, error } = await db.from(shortcutRowsCollection).select('*').order('order', { ascending: true });

        container.innerHTML = '';
        rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';
            
        if (error || !rows || rows.length === 0) {
            container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>';
            if(error) console.error("Error fetching shortcut rows:", error);
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
            const { data: cards, error: cardsError } = await db.from(shortcutCardsCollection).select('*').eq('shortcut_row_id', row.id).order('order', { ascending: true });

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
                            <button class="edit-card-btn edit-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-card-btn delete-btn small-btn" data-row-id="${row.id}" data-card-id="${card.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    cardsContainer.appendChild(cardElement);
                });
            }
        }
    },

    editShortcutRow: async function(rowId) {
        const { data: row } = await db.from(shortcutRowsCollection).select('*').eq('id', rowId).single();
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
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!')) {
            try {
                await db.from(shortcutCardsCollection).delete().eq('shortcut_row_id', rowId);
                await db.from(shortcutRowsCollection).delete().eq('id', rowId);
                showNotification('ڕیزەکە بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderShortcutRowsAdminList();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut row: ", error);
            }
        }
    },

    editShortcutCard: async function(rowId, cardId) {
        const { data: card } = await db.from(shortcutCardsCollection).select('*').eq('id', cardId).single();
        if (card) {
            document.getElementById('editingShortcutCardId').value = cardId;
            document.getElementById('selectRowForCard').value = rowId; // or card.shortcut_row_id
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

    deleteShortcutCard: async function(rowId, cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await db.from(shortcutCardsCollection).delete().eq('id', cardId);
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderShortcutRowsAdminList();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut card: ", error);
            }
        }
    },
    
    // (فەنکشنەکان وەک خۆیان دەمێننەوە)
    updateShortcutCardCategoryDropdowns: function() {
        // ... (هیچ گۆڕانکارییەک نییە، پشت بە `getCategories` دەبەستێت) ...
    },

    // --- HOME LAYOUT MANAGEMENT (Updated) ---
    renderHomeLayoutAdmin: async function() {
        const container = document.getElementById('homeLayoutListContainer');
        const { data: items, error } = await db.from(homeLayoutCollection).select('*').order('order', { ascending: true });

        container.innerHTML = '';
        if (error || !items || items.length === 0) {
            container.innerHTML = '<p>هیچ بەشێک بۆ لاپەڕەی سەرەکی زیاد نەکراوە. کلیک لە "زیادکردنی بەش" بکە.</p>';
            if(error) console.error("Error fetching home layout:", error);
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

        const self = this;
        // (لۆجیکی Drag and Drop وەک خۆی دەمێنێتەوە)
        const itemsList = container.querySelectorAll('.layout-item');
        itemsList.forEach(item => {
            item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0));
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
        });
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = self.getDragAfterElement(container, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (afterElement == null) {
                if (dragging) container.appendChild(dragging);
            } else {
                if (dragging) container.insertBefore(dragging, afterElement);
            }
        });
    },

    // (وەک خۆی دەمێنێتەوە)
    getDragAfterElement: function(container, y) {
        // ... (هیچ گۆڕانکارییەک نییە) ...
    },
    
    deleteHomeLayoutItem: async function(itemId) {
        if (confirm('دڵنیایت دەتەوێت ئەم بەشە لە لاپەڕەی سەرەکی بسڕیتەوە؟')) {
            try {
                await db.from(homeLayoutCollection).delete().eq('id', itemId);
                showNotification('بەشەکە سڕدرایەوە', 'success');
                clearProductCache();
                await this.renderHomeLayoutAdmin(); // Rerender
            } catch (error) {
                console.error("Error deleting layout item:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },

    saveHomeLayout: async function() {
        const container = document.getElementById('homeLayoutListContainer');
        const saveBtn = document.getElementById('saveLayoutBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '...پاشەکەوت دەکرێت';

        const items = container.querySelectorAll('.layout-item');
        const updatePromises = [];

        items.forEach((item, index) => {
            const docId = item.dataset.id;
            const isEnabled = item.querySelector('.enabled-toggle').checked;
            const newOrder = index + 1;
            
            // گۆڕینی `updateDoc` بۆ `update`
            const promise = db.from(homeLayoutCollection)
                .update({ order: newOrder, enabled: isEnabled })
                .eq('id', docId);
            updatePromises.push(promise);
        });

        try {
            // Promise.all(updatePromises) کار ناکات چونکە Supabase array ناگەڕێنێتەوە
            // با یەک بە یەک ئەنجامیان بدەین
            for (const promise of updatePromises) {
                 const { error } = await promise;
                 if (error) throw error;
            }
            
            showNotification('ڕیزبەندی پەڕەی سەرەکی پاشەکەوت کرا', 'success');
            clearProductCache();
        } catch (error) {
            console.error("Error saving layout:", error);
            showNotification('هەڵەیەک لە پاشەکەوتکردن ڕوویدا', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    },
    
    // --- EVENT LISTENERS (Updated forms) ---
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
                
                let collectionName, orderField, nameFieldAccessor;

                if (type === 'promo_slider') {
                    collectionName = promoGroupsCollection;
                    groupLabel.textContent = 'کام گرووپی سلایدەر؟';
                    orderField = 'name';
                    nameFieldAccessor = (data) => data.name;
                } else if (type === 'brands') {
                    collectionName = brandGroupsCollection;
                    groupLabel.textContent = 'کام گرووپی براند؟';
                    orderField = 'name';
                    nameFieldAccessor = (data) => data.name;
                } else { 
                    collectionName = shortcutRowsCollection;
                    groupLabel.textContent = 'کام ڕیزی کارت؟';
                    orderField = 'order';
                    nameFieldAccessor = (data) => data.title.ku_sorani;
                }
                
                const { data: items, error } = await db.from(collectionName).select('*').order(orderField);
                if (error) {
                    console.error("Error fetching items for layout dropdown:", error);
                    groupSelect.innerHTML = `<option value="" disabled selected>-- هەڵە --</option>`;
                    return;
                }
                
                groupSelect.innerHTML = `<option value="" disabled selected>-- گرووپ/ڕیزێک هەڵبژێرە --</option>`;
                items.forEach(item => {
                    const name = nameFieldAccessor(item);
                    groupSelect.innerHTML += `<option value="${item.id}">${name}</option>`;
                });
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
            let specificIdData = {};
            
            if (type === 'promo_slider' || type === 'brands') {
                const groupId = document.getElementById('specificItemGroupId').value;
                if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }
                specificIdData = { groupId };
            } else if (type === 'single_shortcut_row') {
                const rowId = document.getElementById('specificItemGroupId').value;
                if (!rowId) { showNotification('تکایە ڕیزێک هەڵبژێرە', 'error'); return; }
                specificIdData = { rowId };
            } else if (type === 'single_category_row') {
                const catId = document.getElementById('newSectionMainCategory').value;
                const subCatId = document.getElementById('newSectionSubcategory').value;
                const subSubCatId = document.getElementById('newSectionSubSubcategory').value;
                if (!catId) { showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error'); return; }
                specificIdData = { categoryId: catId, subcategoryId: subCatId || null, subSubcategoryId: subSubCatId || null };
            }

            try {
                // گرتنی دوا ڕیزبەندی
                const { data: lastItem } = await db.from(homeLayoutCollection).select('order').order('order', { ascending: false }).limit(1).single();
                const lastOrder = lastItem ? lastItem.order : 0;
                
                const newSectionData = {
                    name: nameObj,
                    type,
                    order: lastOrder + 1,
                    enabled: true,
                    ...specificIdData
                };

                // گۆڕینی `addDoc` بۆ `insert`
                const { error } = await db.from(homeLayoutCollection).insert(newSectionData);
                if (error) throw error;
                
                showNotification('بەشی نوێ زیادکرا', 'success');
                closeCurrentPopup();
                clearProductCache();
                await this.renderHomeLayoutAdmin(); // Rerender
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
                const { data: subcats, error } = await db.from(subcategoriesCollection).select('*').eq('category_id', mainCatId).order('order');
                
                subSelect.innerHTML = '<option value="">-- هەموو (یان هەڵبژێرە) --</option>';
                if (subcats) {
                    subcats.forEach(subcat => {
                        subSelect.innerHTML += `<option value="${subcat.id}">${subcat.name_ku_sorani}</option>`;
                    });
                }
            } else {
                subContainer.style.display = 'none';
            }
        });
        
        document.getElementById('newSectionSubcategory').addEventListener('change', async (e) => {
            const mainCatId = document.getElementById('newSectionMainCategory').value;
            const subCatId = e.target.value;
            const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer');
            const subSubSelect = document.getElementById('newSectionSubSubcategory');
            
            subSubSelect.innerHTML = '';

            if (mainCatId && subCatId) {
                subSubContainer.style.display = 'block';
                subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const { data: subsubcats, error } = await db.from(subSubcategoriesCollection).select('*').eq('subcategory_id', subCatId).order('order');

                subSubSelect.innerHTML = '<option value="">-- هەموو (یان هەڵبژێرە) --</option>';
                if(subsubcats) {
                    subsubcats.forEach(subsubcat => {
                        subSubSelect.innerHTML += `<option value="${subsubcat.id}">${subsubcat.name_ku_sorani}</option>`;
                    });
                }
            } else {
                subSubContainer.style.display = 'none';
            }
        });

        // --- Other listeners (Updated forms) ---
        
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

        // (لۆجیکی logout وەک خۆی دەمێنێتەوە)
        document.getElementById('settingsLogoutBtn').onclick = async () => {
            await auth.signOut(); // Supabase signOut
            showNotification(t('logout_success'), 'success');
        };
        
        // (لۆجیکی گۆڕینی جۆرەکان وەک خۆی دەمێنێتەوە)
        document.getElementById('productCategoryId').addEventListener('change', (e) => {
            self.populateSubcategoriesDropdown(e.target.value);
            self.populateSubSubcategoriesDropdown(null, null);
        });
        document.getElementById('productSubcategoryId').addEventListener('change', (e) => {
            const mainCatId = document.getElementById('productCategoryId').value;
            self.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
        });

        // (فۆرمی سەرەکی `productForm` - گۆڕدرا)
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
                    categoryId: document.getElementById('productCategoryId').value,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: productDescriptionObject,
                    imageUrls: imageUrls, // Supabase jsonb
                    externalLink: document.getElementById('productExternalLink').value || null,
                    shippingInfo: { // Supabase jsonb
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                        ar: document.getElementById('shippingInfoAr').value.trim()
                    }
                    // `created_at` بە شێوەی ئۆتۆماتیک لە Supabase زیاد دەبێت
                };
                
                const editingId = getEditingProductId();
                let error;

                if (editingId) {
                    // گۆڕینی `updateDoc` بۆ `update`
                    const { error: updateError } = await db
                        .from(productsCollection)
                        .update(productData)
                        .eq('id', editingId);
                    error = updateError;
                    if (!error) showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error: insertError } = await db
                        .from(productsCollection)
                        .insert(productData);
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

        // (لۆجیکی وێنە وەک خۆی دەمێنێتەوە)
        document.getElementById('imageInputsContainer').addEventListener('input', (e) => {
            // ... (هیچ گۆڕانکارییەک نییە) ...
        });
        
        // (فۆرمی `addCategoryForm` - گۆڕدرا)
        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value,
                    order: parseInt(document.getElementById('mainCategoryOrder').value)
                };

                try {
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error } = await db.from(categoriesCollection).insert(categoryData);
                    if (error) throw error;
                    
                    showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryForm.reset();
                    clearProductCache();
                    await this.renderCategoryManagementUI(); // Rerender
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
                }
            });
        }

        // (فۆرمی `addSubcategoryForm` - گۆڕدرا)
        const addSubcategoryForm = document.getElementById('addSubcategoryForm');
        if (addSubcategoryForm) {
            addSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                const parentCategoryId = document.getElementById('parentCategorySelect').value;

                if (!parentCategoryId) {
                    showNotification('تکایە جۆری سەرەکی هەڵبژێرە', 'error');
                    return;
                }

                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const subcategoryData = {
                    name_ku_sorani: document.getElementById('subcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subcategoryNameAr').value,
                    order: parseInt(document.getElementById('subcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subcategoryImageUrl').value.trim() || null,
                    category_id: parentCategoryId // گرنگ: زیادکردنی IDی باوک
                };

                try {
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error } = await db.from(subcategoriesCollection).insert(subcategoryData);
                    if (error) throw error;
                    
                    showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addSubcategoryForm.reset();
                    clearProductCache();
                    await this.renderCategoryManagementUI(); // Rerender
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
                }
            });
        }

        // (فۆرمی `addSubSubcategoryForm` - گۆڕدرا)
        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) {
            addSubSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatId = document.getElementById('parentMainCategorySelectForSubSub').value;
                const subCatId = document.getElementById('parentSubcategorySelectForSubSub').value;

                if (!mainCatId || !subCatId) {
                    showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error');
                    return;
                }

                const subSubcategoryData = {
                    name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subSubcategoryNameAr').value,
                    order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                    imageUrl: document.getElementById('subSubcategoryImageUrl').value.trim() || null,
                    subcategory_id: subCatId, // گرنگ: زیادکردنی IDی باوک
                    category_id: mainCatId // گرنگ: زیادکردنی IDی باوکی باوک
                };

                try {
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error } = await db.from(subSubcategoriesCollection).insert(subSubcategoryData);
                    if (error) throw error;

                    showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addSubSubcategoryForm.reset();
                    // ... (لۆجیکی ڕیفرێشکردن وەک خۆی دەمێنێتەوە) ...
                    clearProductCache();
                    await this.renderCategoryManagementUI(); // Rerender
                } catch (error) {
                    console.error("Error adding sub-subcategory: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                }
            });
        }

        // (فۆرمی `editCategoryForm` - گۆڕدرا)
        const editCategoryForm = document.getElementById('editCategoryForm');
        if (editCategoryForm) {
            editCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const tableName = document.getElementById('editCategoryDocPath').value;
                const id = document.getElementById('editCategoryId').value; // وەرگرتنی ID
                const level = document.getElementById('editCategoryLevel').value;

                let updateData = {
                    name_ku_sorani: document.getElementById('editCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('editCategoryNameKuBadini').value,
                    name_ar: document.getElementById('editCategoryNameAr').value,
                    order: parseInt(document.getElementById('editCategoryOrder').value) || 0
                };

                if (level === '1') {
                    updateData.icon = document.getElementById('editCategoryIcon').value;
                }
                if (level === '2' || level === '3') {
                    updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null;
                }

                try {
                    // گۆڕینی `updateDoc` بۆ `update`
                    const { error } = await db
                        .from(tableName)
                        .update(updateData)
                        .eq('id', id);

                    if (error) throw error;
                    
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup();
                    clearProductCache();
                    await this.renderCategoryManagementUI(); // Rerender
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
                }
            });
        }

        // (فۆرمی `announcementForm` - گۆڕدرا)
        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                // ... (لۆجیکی گرتنی داتا وەک خۆی) ...
                const announcementData = {
                    title: { /* ... */ },
                    content: { /* ... */ }
                    // created_at بە شێوەی ئۆتۆماتیک زیاد دەبێت
                };
                try {
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error } = await db.from(announcementsCollection).insert(announcementData);
                    if (error) throw error;

                    showNotification('ئاگەداری بە سەرکەوتوویی نێردرا', 'success');
                    announcementForm.reset();
                    await this.renderAdminAnnouncementsList(); // Rerender
                } catch (error) { /* ... */ } 
                finally { /* ... */ }
            });
        }
        
        // (فۆرمی `policiesForm` - گۆڕدرا)
        const policiesForm = document.getElementById('policiesForm');
        if (policiesForm) {
            policiesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                const policiesData = {
                    content: {
                        ku_sorani: document.getElementById('policiesContentKuSorani').value,
                        ku_badini: document.getElementById('policiesContentKuBadini').value,
                        ar: document.getElementById('policiesContentAr').value,
                    }
                };
                try {
                    // گۆڕینی `setDoc` بۆ `upsert` (Update or Insert)
                    // ئێمە پێویستە IDیەک دابنێین، با "1" بێت
                    const { error } = await db.from(policiesCollection).upsert({ id: 1, content: policiesData.content });
                    if (error) throw error;
                    
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) { /* ... */ } 
                finally { submitButton.disabled = false; }
            });
        }
        
        // (لۆجیکی Toggle وەک خۆی دەمێنێتەوە)
        const socialMediaToggle = document.getElementById('socialMediaToggle');
        socialMediaToggle.onclick = () => { /* ... */ };
        
        // (فۆرمی `addSocialMediaForm` - گۆڕدرا)
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
                // گۆڕینی `addDoc` بۆ `insert`
                const { error } = await db.from(socialLinksCollection).insert(socialData);
                if (error) throw error;
                
                showNotification('لینک زیادکرا', 'success');
                addSocialMediaForm.reset();
                await this.renderSocialMediaLinks(); // Rerender
            } catch (error) {
                showNotification(t('error_generic'), 'error');
            }
        });
        
        // (فۆرمی `addContactMethodForm` - گۆڕدرا)
        const addContactMethodForm = document.getElementById('addContactMethodForm');
        if (addContactMethodForm) {
            addContactMethodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                // ... (لۆجیکی گرتنی داتا وەک خۆی) ...
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
                    // گۆڕینی `addDoc` بۆ `insert`
                    const { error } = await db.from(contactMethodsCollection).insert(methodData);
                    if (error) throw error;

                    showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addContactMethodForm.reset();
                    await this.renderContactMethodsAdmin(); // Rerender
                } catch (error) { /* ... */ } 
                finally { /* ... */ }
            });
        }
        
        // --- NEW EVENT LISTENERS FOR GROUPS (Updated forms) ---

        // PROMO
        document.getElementById('addPromoGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('promoGroupName').value;
            if (name.trim()) {
                await db.from(promoGroupsCollection).insert({ name: name.trim() });
                showNotification('گرووپی سلایدەر زیادکرا', 'success');
                e.target.reset();
                await this.renderPromoGroupsAdminList();
            }
        });

        document.getElementById('addPromoCardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('promoCardGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }

            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            const editingId = document.getElementById('editingPromoCardId').value;
            
            const cardData = {
                imageUrls: {
                    ku_sorani: document.getElementById('promoCardImageKuSorani').value,
                    ku_badini: document.getElementById('promoCardImageKuBadini').value,
                    ar: document.getElementById('promoCardImageAr').value,
                },
                categoryId: document.getElementById('promoCardTargetCategory').value,
                order: parseInt(document.getElementById('promoCardOrder').value),
                promo_group_id: groupId // گرنگ: زیادکردنی IDی باوک
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
                submitButton.textContent = 'پاشەکەوتکردنی کارت';
                clearProductCache();
                await this.renderPromoGroupsAdminList();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); } 
            finally { submitButton.disabled = false; }
        });

        document.getElementById('promoGroupsListContainer').addEventListener('click', (e) => {
            if (e.target.closest('.edit-promo-group-btn')) self.editPromoGroup(e.target.closest('.edit-promo-group-btn').dataset.id);
            if (e.target.closest('.delete-promo-group-btn')) self.deletePromoGroup(e.target.closest('.delete-promo-group-btn').dataset.id);
            if (e.target.closest('.edit-promo-card-btn')) {
                const btn = e.target.closest('.edit-promo-card-btn');
                self.editPromoCard(btn.dataset.groupId, btn.dataset.cardId);
            }
            if (e.target.closest('.delete-promo-card-btn')) {
                const btn = e.target.closest('.delete-promo-card-btn');
                self.deletePromoCard(btn.dataset.groupId, btn.dataset.cardId);
            }
        });
        
        // BRAND
        document.getElementById('addBrandGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('brandGroupName').value;
            if (name.trim()) {
                await db.from(brandGroupsCollection).insert({ name: name.trim() });
                showNotification('گرووپی براند زیادکرا', 'success');
                e.target.reset();
                await this.renderBrandGroupsAdminList();
            }
        });

        document.getElementById('addBrandForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('brandGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); return; }

            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
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
                brand_group_id: groupId // گرنگ: زیادکردنی IDی باوک
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
                submitButton.textContent = 'پاشەکەوتکردنی براند';
                clearProductCache();
                await this.renderBrandGroupsAdminList();
            } catch (error) { console.error("Error saving brand:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); } 
            finally { submitButton.disabled = false; }
        });

        document.getElementById('brandGroupsListContainer').addEventListener('click', (e) => {
            if (e.target.closest('.edit-brand-group-btn')) self.editBrandGroup(e.target.closest('.edit-brand-group-btn').dataset.id);
            if (e.target.closest('.delete-brand-group-btn')) self.deleteBrandGroup(e.target.closest('.delete-brand-group-btn').dataset.id);
            if (e.target.closest('.edit-brand-btn')) {
                const btn = e.target.closest('.edit-brand-btn');
                self.editBrand(btn.dataset.groupId, btn.dataset.brandId);
            }
            if (e.target.closest('.delete-brand-btn')) {
                const btn = e.target.closest('.delete-brand-btn');
                self.deleteBrand(btn.dataset.groupId, btn.dataset.brandId);
            }
        });
        
        // (لۆجیکی گۆڕینی جۆری براند وەک خۆی دەمێنێتەوە)
        const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
        brandMainCatSelect.addEventListener('change', async (e) => {
             const mainCatId = e.target.value;
             const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
             const brandSubCatSelect = document.getElementById('brandTargetSubcategory');
             if (mainCatId) {
                 brandSubCatContainer.style.display = 'block';
                 brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                 
                 // گۆڕینی `getDocs` بۆ `select`
                 const { data: subcats, error } = await db.from(subcategoriesCollection).select('*').eq('category_id', mainCatId).order('order', { ascending: true });

                 brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>';
                 if(subcats) {
                     subcats.forEach(subcat => {
                         const option = document.createElement('option');
                         option.value = subcat.id;
                         option.textContent = subcat.name_ku_sorani;
                         brandSubCatSelect.appendChild(option);
                     });
                 }
             } else {
                 brandSubCatContainer.style.display = 'none';
                 brandSubCatSelect.innerHTML = '';
             }
        });
        
        // --- START: NEW EVENT LISTENER FOR SHORTCUT ROWS (Updated forms) ---
        document.getElementById('addShortcutRowForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const editingId = document.getElementById('editingShortcutRowId').value;
            const rowData = {
                title: {
                    ku_sorani: document.getElementById('shortcutRowTitleKuSorani').value,
                    ku_badini: document.getElementById('shortcutRowTitleKuBadini').value,
                    ar: document.getElementById('shortcutRowTitleAr').value,
                },
                order: parseInt(document.getElementById('shortcutRowOrder').value) || 10
            };

            try {
                let error;
                if(editingId) {
                    const { error: updateError } = await db.from(shortcutRowsCollection).update(rowData).eq('id', editingId);
                    error = updateError;
                    if(!error) showNotification('ڕیز نوێکرایەوە', 'success');
                } else {
                    const { error: insertError } = await db.from(shortcutRowsCollection).insert(rowData);
                    error = insertError;
                    if(!error) showNotification('ڕیزی نوێ زیادکرا', 'success');
                }
                if(error) throw error;
                
                e.target.reset();
                document.getElementById('editingShortcutRowId').value = '';
                document.getElementById('addShortcutRowForm').querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردنی ڕیز';
                document.getElementById('cancelRowEditBtn').style.display = 'none';
