// فایلی admin.js (تەواو و نوێکراوەی کۆتایی)

const { 
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, limit, where,
    showNotification, t, openPopup, closeCurrentPopup, searchProductsInFirestore,
    productsCollection, categoriesCollection, announcementsCollection, promoCardsCollection, brandsCollection,
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;

const shortcutRowsCollection = collection(db, "shortcut_rows");

window.AdminLogic = {
    listenersAttached: false,

    initialize: function() {
        console.log("Admin logic initialized.");
        this.setupDefaultHomeLayout();
        this.updateAdminUI(true);
        this.setupAdminEventListeners();
        this.loadPoliciesForAdmin();
        this.renderCategoryManagementUI();
        this.renderAdminAnnouncementsList();
        this.renderSocialMediaLinks();
        this.renderPromoCardsAdminList();
        this.renderBrandsAdminList();
        this.renderContactMethodsAdmin();
        this.renderShortcutRowsAdminList();
        this.updateAdminCategoryDropdowns();
        this.updateShortcutCardCategoryDropdowns();
        this.renderHomeLayoutAdmin();
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
    },

    setupDefaultHomeLayout: async function() {
        const layoutCollectionRef = collection(db, 'home_layout');
        const q = query(layoutCollectionRef, limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("`home_layout` collection not found. Creating default layout...");
            showNotification('دروستکردنی ڕیزبەندی بنەڕەتی بۆ یەکەمجار...', 'success');

            const defaultLayout = [
                { name: 'کارتی ڕیکلام (سلایدەر)', order: 1, type: 'promo_slider', enabled: true },
                { name: 'بەشی براندەکان', order: 2, type: 'brands', enabled: true },
                { name: 'نوێترین کاڵاکان', order: 3, type: 'newest_products', enabled: true },
                { name: 'ڕیزی کارتی کورتکراوە', order: 4, type: 'shortcut_rows', enabled: true },
                { name: 'ڕیزی جۆرەکان', order: 5, type: 'category_rows', enabled: true },
                { name: 'هەموو کاڵاکان', order: 6, type: 'all_products', enabled: true }
            ];

            try {
                const addPromises = defaultLayout.map(item => addDoc(layoutCollectionRef, item));
                await Promise.all(addPromises);
                console.log("Default home layout created successfully in Firestore.");
            } catch (error) {
                console.error("Error creating default home layout:", error);
            }
        } else {
            console.log("`home_layout` collection already exists.");
        }
    },
    
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
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            showNotification(t('product_not_found_error'), 'error');
            return;
        }
        const product = { id: productSnap.id, ...productSnap.data() };

        setEditingProductId(productId);
        document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
        document.getElementById('productForm').reset();

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

        document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        openPopup('productFormModal', 'modal');
    },

    deleteProduct: async function(productId) {
        if (!confirm(t('delete_confirm'))) return;
        try {
            await deleteDoc(doc(db, "products", productId));
            showNotification(t('product_deleted'), 'success');
            clearProductCache();
            searchProductsInFirestore(document.getElementById('searchInput').value, true);
        } catch (error) {
            showNotification(t('product_delete_error'), 'error');
        }
    },

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
            const subcategoriesQuery = collection(db, "categories", categoryId, "subcategories");
            const q = query(subcategoriesQuery, orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);

            productSubcategorySelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';

            if (querySnapshot.empty) {
                productSubcategorySelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            } else {
                querySnapshot.docs.forEach(doc => {
                    const subcat = { id: doc.id, ...doc.data() };
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
            const ref = collection(db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
            const q = query(ref, orderBy("order", "asc"));
            const snapshot = await getDocs(q);

            select.innerHTML = '<option value="">-- هیچ --</option>';
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const subSubcat = { id: doc.id, ...doc.data() };
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
            const docRef = doc(db, "settings", "policies");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().content) {
                const policies = docSnap.data().content;
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
                await deleteDoc(doc(db, "announcements", id));
                showNotification(t('announcement_deleted_success'), 'success');
            } catch (e) {
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    renderAdminAnnouncementsList: function() {
        const container = document.getElementById('announcementsListContainer');
        const q = query(announcementsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align:center; color: var(--dark-gray);">${t('no_announcements_sent')}</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const announcement = { id: doc.id, ...doc.data() };
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
        });
    },

    deleteSocialMediaLink: async function(linkId) {
        if (confirm('دڵنیایت دەتەوێت ئەم لینکە بسڕیتەوە؟')) {
            try {
                const linkRef = doc(db, 'settings', 'contactInfo', 'socialLinks', linkId);
                await deleteDoc(linkRef);
                showNotification('لینکەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting social link: ", error);
                showNotification(t('error_generic'), 'error');
            }
        }
    },

    renderSocialMediaLinks: function() {
        const socialLinksListContainer = document.getElementById('socialLinksListContainer');
        const socialLinksCollection = collection(db, 'settings', 'contactInfo', 'socialLinks');
        const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            socialLinksListContainer.innerHTML = '';
            if (snapshot.empty) {
                socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const link = { id: doc.id, ...doc.data() };
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
        });
    },

    deleteContactMethod: async function(methodId) {
        if (confirm('دڵنیایت دەتەوێت ئەم شێوازە بسڕیتەوە؟')) {
            try {
                const methodRef = doc(db, 'settings', 'contactInfo', 'contactMethods', methodId);
                await deleteDoc(methodRef);
                showNotification('شێوازەکە سڕدرایەوە', 'success');
            } catch (error) {
                console.error("Error deleting contact method: ", error);
                showNotification('هەڵەیەک لە сڕینەوە ڕوویدا', 'error');
            }
        }
    },

    renderContactMethodsAdmin: function() {
        const container = document.getElementById('contactMethodsListContainer');
        const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
        const q = query(methodsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ شێوازێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const method = { id: doc.id, ...doc.data() };
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
        });
    },
    
    renderPromoCardsAdminList: function() {
        const container = document.getElementById('promoCardsListContainer');
        const q = query(promoCardsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ کاردێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const card = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item';
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex;">
                        <img src="${card.imageUrls.ku_sorani}" style="width: 40px; height: 40px; object-fit: cover; margin-left: 10px; border-radius: 4px;">
                        <div class="notification-title">کارتی ڕیزبەندی: ${card.order}</div>
                    </div>
                    <div>
                        <button class="edit-btn small-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.edit-btn').onclick = () => this.editPromoCard(card);
                item.querySelector('.delete-btn').onclick = () => this.deletePromoCard(card.id);
                container.appendChild(item);
            });
        });
    },

    editPromoCard: function(card) {
        document.getElementById('editingPromoCardId').value = card.id;
        document.getElementById('promoCardImageKuSorani').value = card.imageUrls.ku_sorani;
        document.getElementById('promoCardImageKuBadini').value = card.imageUrls.ku_badini;
        document.getElementById('promoCardImageAr').value = card.imageUrls.ar;
        document.getElementById('promoCardTargetCategory').value = card.categoryId;
        document.getElementById('promoCardOrder').value = card.order;
        document.getElementById('addPromoCardForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        document.getElementById('addPromoCardForm').scrollIntoView({ behavior: 'smooth' });
    },

    deletePromoCard: async function(cardId) {
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "promo_cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },
    
    renderBrandsAdminList: function() {
        const container = document.getElementById('brandsListContainer');
        const q = query(brandsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ براندێک زیاد نەکراوە.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const brand = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'admin-notification-item';
                item.innerHTML = `
                    <div class="admin-notification-details" style="align-items: center; display: flex;">
                        <img src="${brand.imageUrl}" style="width: 40px; height: 40px; object-fit: contain; margin-left: 10px; border-radius: 50%; background: #fff;">
                        <div class="notification-title">${brand.name.ku_sorani} (ڕیز: ${brand.order})</div>
                    </div>
                    <div>
                        <button class="edit-btn small-btn"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.edit-btn').onclick = () => this.editBrand(brand);
                item.querySelector('.delete-btn').onclick = () => this.deleteBrand(brand.id);
                container.appendChild(item);
            });
        });
    },

    editBrand: function(brand) {
        document.getElementById('editingBrandId').value = brand.id;
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
    },

    deleteBrand: async function(brandId) {
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "brands", brandId));
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting brand: ", error);
            }
        }
    },
    
    renderCategoryManagementUI: async function() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;
        container.innerHTML = '<p>...خەریکی بارکردنی جۆرەکانە</p>';

        let content = '';
        const mainCategoriesQuery = query(collection(db, "categories"), orderBy("order", "asc"));
        const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);

        for (const mainDoc of mainCategoriesSnapshot.docs) {
            const mainCategory = { id: mainDoc.id, ...mainDoc.data() };
            const mainPath = `categories/${mainCategory.id}`;
            content += `
                <div class="category-manage-item" style="background: #f0f2f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong><i class="${mainCategory.icon}"></i> ${mainCategory.name_ku_sorani} (ڕیزبەندی: ${mainCategory.order || 0})</strong>
                        <div>
                            <button class="edit-btn small-btn" data-path="${mainPath}" data-level="1"><i class="fas fa-edit"></i></button>
                            <button class="delete-btn small-btn" data-path="${mainPath}" data-name="${mainCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;

            const subCategoriesQuery = query(collection(db, mainPath, "subcategories"), orderBy("order", "asc"));
            const subCategoriesSnapshot = await getDocs(subCategoriesQuery);
            for (const subDoc of subCategoriesSnapshot.docs) {
                const subCategory = { id: subDoc.id, ...subDoc.data() };
                const subPath = `${mainPath}/subcategories/${subCategory.id}`;
                content += `
                    <div class="category-manage-item" style="margin-right: 20px; padding: 8px; border-right: 2px solid #ccc; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>- ${subCategory.name_ku_sorani} (ڕیزبەندی: ${subCategory.order || 0})</span>
                            <div>
                                <button class="edit-btn small-btn" data-path="${subPath}" data-level="2"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn small-btn" data-path="${subPath}" data-name="${subCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>`;

                const subSubCategoriesQuery = query(collection(db, subPath, "subSubcategories"), orderBy("order", "asc"));
                const subSubCategoriesSnapshot = await getDocs(subSubCategoriesQuery);
                for (const subSubDoc of subSubCategoriesSnapshot.docs) {
                    const subSubCategory = { id: subSubDoc.id, ...subSubDoc.data() };
                    const subSubPath = `${subPath}/subSubcategories/${subSubCategory.id}`;
                    content += `
                        <div class="category-manage-item" style="margin-right: 40px; padding: 8px; border-right: 2px solid #e2e8f0; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>-- ${subSubCategory.name_ku_sorani} (ڕیزبەندی: ${subSubCategory.order || 0})</span>
                                <div>
                                    <button class="edit-btn small-btn" data-path="${subSubPath}" data-level="3"><i class="fas fa-edit"></i></button>
                                    <button class="delete-btn small-btn" data-path="${subSubPath}" data-name="${subSubCategory.name_ku_sorani}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>`;
                }
            }
        }

        container.innerHTML = content || '<p>هیچ جۆرێک زیاد نەکراوە.</p>';
        const self = this;
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => self.openEditCategoryModal(btn.dataset.path, btn.dataset.level));
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => self.handleDeleteCategory(btn.dataset.path, btn.dataset.name));
        });
    },

    openEditCategoryModal: async function(docPath, level) {
        const docRef = doc(db, docPath);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showNotification('جۆرەکە نەدۆزرایەوە!', 'error');
            return;
        }
        const category = docSnap.data();

        document.getElementById('editCategoryDocPath').value = docPath;
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

    handleDeleteCategory: async function(docPath, categoryName) {
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
        if (confirmation) {
            try {
                await deleteDoc(doc(db, docPath));
                showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
            }
        }
    },

    updateAdminCategoryDropdowns: function() {
        const categories = getCategories();
        if (categories.length <= 1) return;
        const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');

        const dropdowns = [
            { id: 'parentCategorySelect', defaultText: '-- جۆرێک هەڵبژێرە --' },
            { id: 'parentMainCategorySelectForSubSub', defaultText: '-- جۆرێک هەڵبژێرە --' },
            { id: 'promoCardTargetCategory', defaultText: '-- جۆرێک هەڵبژێرە --' },
            { id: 'brandTargetMainCategory', defaultText: '-- هەموو جۆرەکان --' }
        ];

        dropdowns.forEach(d => {
            const select = document.getElementById(d.id);
            if (select) {
                const firstOptionHTML = `<option value="">${d.defaultText}</option>`;
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

    renderShortcutRowsAdminList: function() {
        const container = document.getElementById('shortcutRowsListContainer');
        const rowSelect = document.getElementById('selectRowForCard');
        const q = query(shortcutRowsCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            rowSelect.innerHTML = '<option value="" disabled selected>-- سەرەتا ڕیزێک هەڵبژێرە --</option>';
            
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ ڕیزێک زیاد نەکراوە.</p>';
                return;
            }

            snapshot.forEach(rowDoc => {
                const row = { id: rowDoc.id, ...rowDoc.data() };
                
                const option = document.createElement('option');
                option.value = row.id;
                option.textContent = row.title.ku_sorani;
                rowSelect.appendChild(option);

                const rowElement = document.createElement('div');
                rowElement.style.border = '1px solid #ddd';
                rowElement.style.borderRadius = '6px';
                rowElement.style.marginBottom = '10px';
                
                rowElement.innerHTML = `
                    <div style="background: #f0f2f5; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <strong>${row.title.ku_sorani} (ڕیز: ${row.order})</strong>
                        <div>
                            <button class="edit-row-btn edit-btn small-btn" data-id="${row.id}"><i class="fas fa-edit"></i></button>
                            <button class="delete-row-btn delete-btn small-btn" data-id="${row.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="cards-list-container" style="padding: 10px;">...خەریکی بارکردنی کارتەکانە</div>
                `;
                container.appendChild(rowElement);

                const cardsContainer = rowElement.querySelector('.cards-list-container');
                const cardsQuery = query(collection(db, "shortcut_rows", row.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = '';
                    if(cardsSnapshot.empty) {
                        cardsContainer.innerHTML = '<p style="font-size: 12px; color: gray;">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>';
                    } else {
                        cardsSnapshot.forEach(cardDoc => {
                            const card = { id: cardDoc.id, ...cardDoc.data() };
                            const cardElement = document.createElement('div');
                            cardElement.style.display = 'flex';
                            cardElement.style.justifyContent = 'space-between';
                            cardElement.style.padding = '5px 0';
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
                });
            });
        });
    },

    deleteShortcutRow: async function(rowId) {
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!')) {
            try {
                const cardsRef = collection(db, "shortcut_rows", rowId, "cards");
                const cardsSnapshot = await getDocs(cardsRef);
                const deletePromises = [];
                cardsSnapshot.forEach(doc => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                await Promise.all(deletePromises);

                await deleteDoc(doc(db, "shortcut_rows", rowId));
                showNotification('ڕیزەکە بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut row: ", error);
            }
        }
    },

    deleteShortcutCard: async function(rowId, cardId) {
         if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
                console.error("Error deleting shortcut card: ", error);
            }
        }
    },
    
    updateShortcutCardCategoryDropdowns: function() {
        const categories = getCategories();
        if (categories.length <= 1) return;
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

    renderHomeLayoutAdmin: function() {
        const container = document.getElementById('homeLayoutListContainer');
        const layoutCollection = collection(db, 'home_layout');
        const q = query(layoutCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>چاوەڕێ بە بۆ دروستکردنی ڕیزبەندی...</p>';
                return;
            }

            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const itemElement = document.createElement('div');
                itemElement.className = 'layout-item';
                itemElement.dataset.id = item.id;
                itemElement.draggable = true;

                itemElement.innerHTML = `
                    <div class="layout-item-info">
                        <i class="fas fa-grip-vertical drag-handle"></i>
                        <span>${item.name || item.type}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" class="enabled-toggle" ${item.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                `;
                container.appendChild(itemElement);
            });

            const items = container.querySelectorAll('.layout-item');
            items.forEach(item => {
                item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0));
                item.addEventListener('dragend', () => item.classList.remove('dragging'));
            });

            container.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = this.getDragAfterElement(container, e.clientY);
                const dragging = document.querySelector('.dragging');
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            });
        });
    },

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
            
            const docRef = doc(db, 'home_layout', docId);
            updatePromises.push(updateDoc(docRef, { order: newOrder, enabled: isEnabled }));
        });

        try {
            await Promise.all(updatePromises);
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

    setupAdminEventListeners: function() {
        if (this.listenersAttached) return;
        const self = this;
        
        document.getElementById('saveLayoutBtn')?.addEventListener('click', () => self.saveHomeLayout());

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
            await signOut(auth);
            showNotification(t('logout_success'), 'success');
        };

        document.getElementById('productCategoryId').addEventListener('change', (e) => {
            self.populateSubcategoriesDropdown(e.target.value);
            self.populateSubSubcategoriesDropdown(null, null);
        });

        document.getElementById('productSubcategoryId').addEventListener('change', (e) => {
            const mainCatId = document.getElementById('productCategoryId').value;
            self.populateSubSubcategoriesDropdown(mainCatId, e.target.value);
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
                    categoryId: document.getElementById('productCategoryId').value,
                    subcategoryId: document.getElementById('productSubcategoryId').value || null,
                    subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                    description: productDescriptionObject,
                    imageUrls: imageUrls,
                    createdAt: Date.now(),
                    externalLink: document.getElementById('productExternalLink').value || null,
                    shippingInfo: {
                        ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                        ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                        ar: document.getElementById('shippingInfoAr').value.trim()
                    }
                };
                const editingId = getEditingProductId();
                if (editingId) {
                    const { createdAt, ...updateData } = productData;
                    await updateDoc(doc(db, "products", editingId), updateData);
                    showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    await addDoc(productsCollection, productData);
                    showNotification('کاڵا زیادکرا', 'success');
                }
                clearProductCache();
                closeCurrentPopup();
                searchProductsInFirestore(document.getElementById('searchInput').value, true);
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
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const categoryData = {
                    name_ku_sorani: document.getElementById('mainCategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('mainCategoryNameKuBadini').value,
                    name_ar: document.getElementById('mainCategoryNameAr').value,
                    icon: document.getElementById('mainCategoryIcon').value,
                    order: parseInt(document.getElementById('mainCategoryOrder').value)
                };

                try {
                    await addDoc(categoriesCollection, categoryData);
                    showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryForm.reset();
                    clearProductCache();
                } catch (error) {
                    console.error("Error adding main category: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
                }
            });
        }

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
                    imageUrl: document.getElementById('subcategoryImageUrl').value.trim() || null
                };

                try {
                    const subcategoriesCollectionRef = collection(db, "categories", parentCategoryId, "subcategories");
                    await addDoc(subcategoriesCollectionRef, subcategoryData);
                    showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                    addSubcategoryForm.reset();
                    clearProductCache();
                } catch (error) {
                    console.error("Error adding subcategory: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
                }
            });
        }

        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) {
            addSubSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
                const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
                const mainCatId = mainCatSelect.value;
                const subCatId = subCatSelect.value;

                if (!mainCatId || !subCatId) {
                    showNotification('تکایە هەردوو جۆرەکە هەڵبژێرە', 'error');
                    return;
                }

                const subSubcategoryData = {
                    name_ku_sorani: document.getElementById('subSubcategoryNameKuSorani').value,
                    name_ku_badini: document.getElementById('subSubcategoryNameKuBadini').value,
                    name_ar: document.getElementById('subSubcategoryNameAr').value,
                    order: parseInt(document.getElementById('subSubcategoryOrder').value) || 0,
                    createdAt: Date.now(),
                    imageUrl: document.getElementById('subSubcategoryImageUrl').value.trim() || null
                };

                try {
                    const subSubcategoriesRef = collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
                    await addDoc(subSubcategoriesRef, subSubcategoryData);
                    showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addSubSubcategoryForm.reset();
                    mainCatSelect.value = '';
                    subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                    clearProductCache();
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
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...پاشەکەوت دەکرێت';

                const docPath = document.getElementById('editCategoryDocPath').value;
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
                    await updateDoc(doc(db, docPath), updateData);
                    showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                    closeCurrentPopup();
                    clearProductCache();
                } catch (error) {
                    console.error("Error updating category: ", error);
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
                }
            });
        }

        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = '...ناردن';

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
                    createdAt: Date.now()
                };

                try {
                    await addDoc(announcementsCollection, announcementData);
                    showNotification('ئاگەداری بە سەرکەوتوویی نێردرا', 'success');
                    announcementForm.reset();
                } catch (error) {
                    console.error("Error sending announcement: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = t('send_announcement_button');
                }
            });
        }
        
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
                    const docRef = doc(db, "settings", "policies");
                    await setDoc(docRef, policiesData, { merge: true });
                    showNotification(t('policies_saved_success'), 'success');
                } catch (error) {
                    console.error("Error saving policies:", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
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
                createdAt: Date.now()
            };
            try {
                const socialLinksRef = collection(db, 'settings', 'contactInfo', 'socialLinks');
                await addDoc(socialLinksRef, socialData);
                showNotification('لینک زیادکرا', 'success');
                addSocialMediaForm.reset();
            } catch (error) {
                showNotification(t('error_generic'), 'error');
            }
        });
        
        const addContactMethodForm = document.getElementById('addContactMethodForm');
        if (addContactMethodForm) {
            addContactMethodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;

                const methodData = {
                    type: document.getElementById('contactMethodType').value,
                    value: document.getElementById('contactMethodValue').value,
                    name_ku_sorani: document.getElementById('contactMethodNameKuSorani').value,
                    name_ku_badini: document.getElementById('contactMethodNameKuBadini').value,
                    name_ar: document.getElementById('contactMethodNameAr').value,
                    icon: document.getElementById('contactMethodIcon').value,
                    color: document.getElementById('contactMethodColor').value,
                    createdAt: Date.now()
                };

                try {
                    const methodsCollection = collection(db, 'settings', 'contactInfo', 'contactMethods');
                    await addDoc(methodsCollection, methodData);
                    showNotification('شێوازی نوێ بە سەرکەوتوویی زیادکرا', 'success');
                    addContactMethodForm.reset();
                } catch (error) {
                    console.error("Error adding contact method: ", error);
                    showNotification(t('error_generic'), 'error');
                } finally {
                    submitButton.disabled = false;
                }
            });
        }
        
        const addPromoCardForm = document.getElementById('addPromoCardForm');
        if(addPromoCardForm) {
            addPromoCardForm.addEventListener('submit', async (e) => {
                e.preventDefault();
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
                    createdAt: Date.now()
                };

                try {
                    if (editingId) {
                        await setDoc(doc(db, "promo_cards", editingId), cardData);
                        showNotification('کارتەکە نوێکرایەوە', 'success');
                    } else {
                        await addDoc(promoCardsCollection, cardData);
                        showNotification('کارتی نوێ زیادکرا', 'success');
                    }
                    addPromoCardForm.reset();
                    document.getElementById('editingPromoCardId').value = '';
                    submitButton.textContent = 'پاشەکەوتکردن';
                    clearProductCache();
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        const addBrandForm = document.getElementById('addBrandForm');
        if (addBrandForm) {
            addBrandForm.addEventListener('submit', async (e) => {
                e.preventDefault();
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
                    createdAt: Date.now()
                };

                try {
                    if (editingId) {
                        const { createdAt, ...updateData } = brandData;
                        await setDoc(doc(db, "brands", editingId), updateData, { merge: true });
                        showNotification('براند نوێکرایەوە', 'success');
                    } else {
                        await addDoc(brandsCollection, brandData);
                        showNotification('براندی نوێ زیادکرا', 'success');
                    }
                    addBrandForm.reset();
                    document.getElementById('editingBrandId').value = '';
                    document.getElementById('brandSubcategoryContainer').style.display = 'none';
                    submitButton.textContent = 'پاشەکەوتکردن';
                    clearProductCache();
                } catch (error) {
                    showNotification('هەڵەیەک ڕوویدا', 'error');
                    console.error("Error saving brand:", error);
                } finally {
                    submitButton.disabled = false;
                }
            });
            
            const brandMainCatSelect = document.getElementById('brandTargetMainCategory');
            brandMainCatSelect.addEventListener('change', async (e) => {
                const mainCatId = e.target.value;
                const brandSubCatContainer = document.getElementById('brandSubcategoryContainer');
                const brandSubCatSelect = document.getElementById('brandTargetSubcategory');
                if (mainCatId) {
                    brandSubCatContainer.style.display = 'block';
                    brandSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                    const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                    const snapshot = await getDocs(subCatQuery);
                    brandSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکییەکان --</option>';
                    snapshot.forEach(doc => {
                        const subcat = { id: doc.id, ...doc.data() };
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
        }
        
        const addShortcutRowForm = document.getElementById('addShortcutRowForm');
        addShortcutRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editingId = document.getElementById('editingShortcutRowId').value;
            const rowData = {
                title: {
                    ku_sorani: document.getElementById('shortcutRowTitleKuSorani').value,
                    ku_badini: document.getElementById('shortcutRowTitleKuBadini').value,
                    ar: document.getElementById('shortcutRowTitleAr').value,
                },
                order: parseInt(document.getElementById('shortcutRowOrder').value) || 0,
            };

            try {
                if (editingId) {
                    await setDoc(doc(db, "shortcut_rows", editingId), rowData, { merge: true });
                    showNotification('ڕیز نوێکرایەوە', 'success');
                } else {
                    rowData.createdAt = Date.now();
                    await addDoc(shortcutRowsCollection, rowData);
                    showNotification('ڕیزی نوێ زیادکرا', 'success');
                }
                addShortcutRowForm.reset();
                document.getElementById('editingShortcutRowId').value = '';
                document.getElementById('cancelRowEditBtn').style.display = 'none';
                clearProductCache();
            } catch (error) { console.error("Error saving row:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
        });

        const addCardToRowForm = document.getElementById('addCardToRowForm');
        addCardToRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rowId = document.getElementById('selectRowForCard').value;
            if (!rowId) {
                showNotification('تکایە ڕیزێک هەڵبژێرە', 'error');
                return;
            }
            const editingId = document.getElementById('editingShortcutCardId').value;
            const cardData = {
                name: {
                    ku_sorani: document.getElementById('shortcutCardNameKuSorani').value,
                    ku_badini: document.getElementById('shortcutCardNameKuBadini').value,
                    ar: document.getElementById('shortcutCardNameAr').value,
                },
                imageUrl: document.getElementById('shortcutCardImageUrl').value,
                categoryId: document.getElementById('shortcutCardMainCategory').value || null,
                subcategoryId: document.getElementById('shortcutCardSubcategory').value || null,
                subSubcategoryId: document.getElementById('shortcutCardSubSubcategory').value || null,
                order: parseInt(document.getElementById('shortcutCardOrder').value) || 0,
            };

            try {
                if (editingId) {
                    await setDoc(doc(db, "shortcut_rows", rowId, "cards", editingId), cardData, { merge: true });
                    showNotification('کارت نوێکرایەوە', 'success');
                } else {
                    cardData.createdAt = Date.now();
                    await addDoc(collection(db, "shortcut_rows", rowId, "cards"), cardData);
                    showNotification('کارتی نوێ زیادکرا بۆ ڕیزەکە', 'success');
                }
                addCardToRowForm.reset();
                document.getElementById('editingShortcutCardId').value = '';
                document.getElementById('selectRowForCard').disabled = false;
                document.getElementById('cancelCardEditBtn').style.display = 'none';
                addCardToRowForm.querySelector('button[type="submit"]').textContent = 'زیادکردنی کارت';
                clearProductCache();
            } catch (error) { console.error("Error saving card:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
        });
        
        document.getElementById('shortcutRowsListContainer').addEventListener('click', async (e) => {
            const editRowBtn = e.target.closest('.edit-row-btn');
            const deleteRowBtn = e.target.closest('.delete-row-btn');
            const editCardBtn = e.target.closest('.edit-card-btn');
            const deleteCardBtn = e.target.closest('.delete-card-btn');

            if (editRowBtn) {
                const rowId = editRowBtn.dataset.id;
                const rowSnap = await getDoc(doc(db, "shortcut_rows", rowId));
                if(rowSnap.exists()) {
                    const row = rowSnap.data();
                    document.getElementById('editingShortcutRowId').value = rowId;
                    document.getElementById('shortcutRowTitleKuSorani').value = row.title.ku_sorani;
                    document.getElementById('shortcutRowTitleKuBadini').value = row.title.ku_badini;
                    document.getElementById('shortcutRowTitleAr').value = row.title.ar;
                    document.getElementById('shortcutRowOrder').value = row.order;
                    document.getElementById('cancelRowEditBtn').style.display = 'block';
                    addShortcutRowForm.scrollIntoView({ behavior: 'smooth' });
                }
            }
            if (deleteRowBtn) {
                this.deleteShortcutRow(deleteRowBtn.dataset.id);
            }
            if (editCardBtn) {
                const rowId = editCardBtn.dataset.rowId;
                const cardId = editCardBtn.dataset.cardId;
                const cardSnap = await getDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
                if(cardSnap.exists()) {
                    const card = cardSnap.data();
                    document.getElementById('selectRowForCard').value = rowId;
                    document.getElementById('selectRowForCard').disabled = true; 
                    document.getElementById('editingShortcutCardId').value = cardId;
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
                    document.getElementById('cancelCardEditBtn').style.display = 'block';
                    addCardToRowForm.scrollIntoView({ behavior: 'smooth' });
                }
            }
            if (deleteCardBtn) {
                this.deleteShortcutCard(deleteCardBtn.dataset.rowId, deleteCardBtn.dataset.cardId);
            }
        });

        document.getElementById('cancelRowEditBtn').addEventListener('click', () => {
            addShortcutRowForm.reset();
            document.getElementById('editingShortcutRowId').value = '';
            document.getElementById('cancelRowEditBtn').style.display = 'none';
        });

        document.getElementById('cancelCardEditBtn').addEventListener('click', () => {
            addCardToRowForm.reset();
            document.getElementById('editingShortcutCardId').value = '';
            document.getElementById('selectRowForCard').disabled = false;
            document.getElementById('cancelCardEditBtn').style.display = 'none';
            document.getElementById('addCardToRowForm').querySelector('button[type="submit"]').textContent = 'زیادکردنی کارت';
        });

        const shortcutMainCatSelect = document.getElementById('shortcutCardMainCategory');
        shortcutMainCatSelect.addEventListener('change', async (e) => {
            const mainCatId = e.target.value;
            const subContainer = document.getElementById('shortcutCardSubContainer');
            const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
            const subSelect = document.getElementById('shortcutCardSubcategory');
            
            subSubContainer.style.display = 'none';
            subSelect.innerHTML = '';
            
            if (mainCatId) {
                subContainer.style.display = 'block';
                subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const subCatQuery = query(collection(db, "categories", mainCatId, "subcategories"), orderBy("order", "asc"));
                const snapshot = await getDocs(subCatQuery);
                subSelect.innerHTML = '<option value="">-- هەموو جۆرە لاوەکییەکان --</option>';
                snapshot.forEach(doc => {
                    const subcat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subcat.id;
                    option.textContent = subcat.name_ku_sorani;
                    subSelect.appendChild(option);
                });
            } else {
                subContainer.style.display = 'none';
            }
        });

        const shortcutSubCatSelect = document.getElementById('shortcutCardSubcategory');
        shortcutSubCatSelect.addEventListener('change', async(e) => {
            const mainCatId = document.getElementById('shortcutCardMainCategory').value;
            const subCatId = e.target.value;
            const subSubContainer = document.getElementById('shortcutCardSubSubContainer');
            const subSubSelect = document.getElementById('shortcutCardSubSubcategory');

            subSubSelect.innerHTML = '';

            if(mainCatId && subCatId) {
                subSubContainer.style.display = 'block';
                subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const subSubQuery = query(collection(db, "categories", mainCatId, "subcategories", subCatId, "subSubcategories"), orderBy("order", "asc"));
                const snapshot = await getDocs(subSubQuery);
                subSubSelect.innerHTML = '<option value="">-- هەموو جۆرەکان --</option>';
                snapshot.forEach(doc => {
                    const subSubCat = { id: doc.id, ...doc.data() };
                    const option = document.createElement('option');
                    option.value = subSubCat.id;
                    option.textContent = subSubCat.name_ku_sorani;
                    subSubSelect.appendChild(option);
                });

            } else {
                subSubContainer.style.display = 'none';
            }
        });

        this.listenersAttached = true;
    }
};