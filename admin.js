// admin.js
const {
    db, auth, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, collection, query, orderBy, onSnapshot, getDocs, signOut, where, limit, runTransaction, 
    storage, ref, uploadBytes, getDownloadURL, 
    showNotification, t, openPopup, closeCurrentPopup, 
    productsCollection, categoriesCollection, announcementsCollection,
    promoGroupsCollection, brandGroupsCollection, 
    shortcutRowsCollection, 
    categoryLayoutsCollection, 
    setEditingProductId, getEditingProductId, getCategories, getCurrentLanguage,
    clearProductCache
} = window.globalAdminTools;

window.AdminLogic = {
    listenersAttached: false,
    
    // [ 💡 گۆڕانکاری ] - سیستەمی کۆنی وێنەکان گۆڕدرا
    baseImageUrls: ["", "", "", ""], // تەنها بۆ ٤ وێنە سەرەکییەکە
    variationData: [], // [{ id: 'temp_123', name: {..}, price: 0, imageUrls: ["","","",""] }]
    loadedVariationIds: [], // بۆ زانینی ئەوانەی لە فایەربەیس سڕاونەتەوە

    currentLayoutEditorContext: { type: 'home', id: null }, 
    currentCategoryLayoutId: null, 

    initialize: function() {
        console.log("Admin logic initialized.");
        this.migrateAndSetupDefaultHomeLayout();
        this.updateAdminUI(true);
        // [ 💡 گۆڕانکاری ] - بانگکردنی فەنکشنی دروستکردنی وێنەی بنەڕەتی
        this.createBaseProductImageInputs();
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
        
        this.updateCategoryLayoutDropdowns(); 
        this.setupCategoryLayoutListeners(); 
    },

    deinitialize: function() {
        console.log("Admin logic de-initialized.");
        this.updateAdminUI(false);
    },

    migrateAndSetupDefaultHomeLayout: async function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const layoutCollectionRef = collection(db, 'home_layout');
        const snapshot = await getDocs(query(layoutCollectionRef, limit(1)));
    
        if (snapshot.empty) {
            console.log("`home_layout` collection is empty. Creating default layout.");
            await this.createDefaultHomeLayout(layoutCollectionRef);
            return;
        }
    
        const firstDocData = snapshot.docs[0].data();
        const isOldStructure = typeof firstDocData.name === 'string' || !firstDocData.hasOwnProperty('name');
    
        if (isOldStructure) {
            console.warn("Old home_layout structure detected. Migrating to new structure...");
            showNotification('خەریکی نوێکردنەوەی سیستەمی ڕیزبەندییە...', 'success');
            
            const allDocsSnapshot = await getDocs(layoutCollectionRef);
            const deletePromises = allDocsSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            console.log("Old layout deleted.");
    
            await this.createDefaultHomeLayout(layoutCollectionRef);
            console.log("New default layout created after migration.");
        } else {
            console.log("`home_layout` structure is up to date.");
        }
    },

    createDefaultHomeLayout: async function(collectionRef) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const defaultLayout = [
            { name: { ku_sorani: 'سلایدەری ڕێکلام', ku_badini: 'سلایدەرێ ڕێکلاما', ar: 'سلايدر الإعلانات' }, order: 1, type: 'promo_slider', enabled: true, groupId: 'default' },
            { name: { ku_sorani: 'بەشی براندەکان', ku_badini: 'پشکا براندا', ar: 'قسم الماركات' }, order: 2, type: 'brands', enabled: true, groupId: 'default' },
            { name: { ku_sorani: 'نوێترین کاڵاکان', ku_badini: 'نووترین کاڵا', ar: 'أحدث المنتجات' }, order: 3, type: 'newest_products', enabled: true },
            { name: { ku_sorani: 'هەموو کاڵاکان', ku_badini: 'هەمی کاڵا', ar: 'كل المنتجات' }, order: 4, type: 'all_products', enabled: true }
        ];
        const addPromises = defaultLayout.map(item => addDoc(collectionRef, item));
        
        await setDoc(doc(promoGroupsCollection, 'default'), { name: 'گرووپی سەرەki', createdAt: Date.now() });
        await setDoc(doc(brandGroupsCollection, 'default'), { name: 'گرووپی سەرەki', createdAt: Date.now() });

        await Promise.all(addPromises);
    },
    
    updateAdminUI: function(isAdmin) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

        const adminSections = [
            'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
            'adminPromoCardsManagement', 'adminBrandsManagement', 'adminCategoryManagement',
            'adminContactMethodsManagement', 'adminShortcutRowsManagement',
            'adminHomeLayoutManagement',
            'adminCategoryLayoutManagement',
            'adminChatsManagement'
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

    // [ 💡 گۆڕانکاری ] - نوێکرایەوە بۆ سیستەمی نوێ
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
        
        // پاککردنەوەی دۆخی پێشوو
        document.getElementById('variationsContainer').innerHTML = '';
        this.variationData = [];
        this.loadedVariationIds = [];
        
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
        
        // وێنە بنەڕەتییەکان
        const imageUrls = product.imageUrls || (product.image ? [product.image] : []);
        this.baseImageUrls = ["", "", "", ""].map((_, i) => imageUrls[i] || "");
        this.createBaseProductImageInputs(); 
        
        document.getElementById('productExternalLink').value = product.externalLink || '';

        if (product.shippingInfo) {
            document.getElementById('shippingInfoKuSorani').value = product.shippingInfo.ku_sorani || '';
            document.getElementById('shippingInfoKuBadini').value = product.shippingInfo.ku_badini || '';
            document.getElementById('shippingInfoAr').value = product.shippingInfo.ar || '';
        }

        await this.populateSubcategoriesDropdown(categoryId, product.subcategoryId);
        await this.populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

        // [ 💡 نوێ ] - هێنانی جۆرە جیاوازەکان (Variations)
        const variations = await this.fetchVariationsForProduct(productId);
        variations.forEach(variation => {
            this.addVariationFormBox(variation); // زیادکردنی فۆڕمی بچووک بۆ هەر جۆرێک
        });
        
        // پاشەکەوتکردنی لیستی جۆرەکان بۆ بەراوردکاری لە کاتی سڕینەوە
        this.loadedVariationIds = variations.map(v => v.id);

        document.getElementById('productForm').querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
        openPopup('productFormModal', 'modal');
    },

    deleteProduct: async function(productId) {
        // ... (هەمان کۆدی پێشوو، بەڵام پێویستە variationsـەکانیش بسڕێتەوە)
        if (!confirm(t('delete_confirm'))) return;
        try {
            // [ 💡 نوێ ] - سڕینەوەی جۆرەکان (Variations) پێش سڕینەوەی کاڵا سەرەکییەکە
            const variations = await this.fetchVariationsForProduct(productId);
            const deletePromises = variations.map(v => {
                return deleteDoc(doc(db, "products", productId, "variations", v.id));
            });
            await Promise.all(deletePromises);
            
            // سڕینەوەی کاڵا سەرەکییەکە
            await deleteDoc(doc(db, "products", productId));
            
            showNotification(t('product_deleted'), 'success');
            clearProductCache();
        } catch (error) {
            console.error("Error deleting product and variations:", error);
            showNotification(t('product_delete_error'), 'error');
        }
    },

    // [ 💡 گۆڕانکاری ] - ناو گۆڕدرا بۆ زیاتر ڕوونی
    createBaseProductImageInputs: function() {
        const container = document.getElementById('imageUploadContainer');
        if (!container) return;
        container.innerHTML = ''; 

        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'image-upload-slot';
            slot.dataset.index = i;

            const imageUrl = this.baseImageUrls[i];
            const hasImage = !!imageUrl;

            slot.innerHTML = `
                <img src="${hasImage ? imageUrl : ''}" class="image-upload-preview" style="display: ${hasImage ? 'block' : 'none'};">
                <label for="base-file-upload-${i}" class="image-upload-label" style="display: ${hasImage ? 'none' : 'flex'};">
                    <i class="fas fa-upload"></i>
                    <span>وێنەی بنەڕەتی ${i + 1}</span>
                </label>
                <input type="file" id="base-file-upload-${i}" class="image-upload-input base-image-upload-input" accept="image/*">
                <i class="fas fa-spinner fa-spin image-upload-spinner"></i>
                <button type="button" class="image-upload-remove-btn base-image-remove-btn" style="display: ${hasImage ? 'flex' : 'none'};">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(slot);
        }
    },
    
    // [ 💡 گۆڕانکاری ] - ناو گۆڕدرا
    handleBaseFileSelect: async function(input, slot) {
        const file = input.files[0];
        if (!file) return;

        const index = slot.dataset.index;
        const spinner = slot.querySelector('.image-upload-spinner');
        const label = slot.querySelector('.image-upload-label');
        const preview = slot.querySelector('.image-upload-preview');
        const removeBtn = slot.querySelector('.image-upload-remove-btn');

        spinner.style.display = 'block';
        label.style.display = 'none';
        
        try {
            const fileName = `products/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            this.baseImageUrls[index] = downloadURL; // [ 💡 گۆڕانکاری ]

            preview.src = downloadURL;
            preview.style.display = 'block';
            removeBtn.style.display = 'flex';

        } catch (error) {
            console.error("Error uploading image:", error);
            showNotification('هەڵەیەک لە کاتی بلندکردنی وێنەکە ڕوویدا!', 'error');
            label.style.display = 'flex'; 
        } finally {
            spinner.style.display = 'none'; 
        }
    },

    // [ 💡 گۆڕانکاری ] - ناو گۆڕدرا
    handleBaseImageRemove: function(slot) {
        const index = slot.dataset.index;
        this.baseImageUrls[index] = ""; // [ 💡 گۆڕانکاری ]

        slot.querySelector('.image-upload-preview').src = '';
        slot.querySelector('.image-upload-preview').style.display = 'none';
        slot.querySelector('.image-upload-label').style.display = 'flex';
        slot.querySelector('.image-upload-remove-btn').style.display = 'none';
        
        slot.querySelector('.image-upload-input').value = null; 
    },
    
    // [ 💡 نوێ ] - فەنکشنی زیادکردنی فۆڕمی بچووک
    addVariationFormBox: function(existingVariation = null) {
        const container = document.getElementById('variationsContainer');
        const tempId = `temp_${Date.now()}`;
        
        let variation;
        
        if (existingVariation) {
            // ئەگەر جۆرێکی کۆن بێت، داتاکانی بەکاردەهێنین
            variation = { ...existingVariation };
            // دڵنیابوونەوە کە هەموو خانەکان هەن
            variation.name = variation.name || { ku_sorani: '', ku_badini: '', ar: '' };
            variation.price = variation.price || '';
            variation.imageUrls = variation.imageUrls || ["", "", "", ""];
        } else {
            // ئەگەر جۆرێکی نوێ بێت
            variation = {
                id: tempId,
                name: { ku_sorani: '', ku_badini: '', ar: '' },
                price: '',
                imageUrls: ["", "", "", ""]
            };
        }

        // زیادکردنی بۆ ستەیتی ناوخۆیی
        this.variationData.push(variation);
        
        // دروستکردنی HTMLـی فۆڕمە بچووکەکە
        const formBox = document.createElement('div');
        formBox.className = 'variation-form-box';
        formBox.dataset.variationId = variation.id; // گرنگە بۆ ناسینەوە
        formBox.innerHTML = this.renderVariationFormBox(variation.id, variation);
        
        container.appendChild(formBox);
    },

    // [ 💡 نوێ ] - فەنکشنی دروستکردنی HTMLـی فۆڕمی بچووک
    renderVariationFormBox: function(variationId, data = {}) {
        const name = data.name || { ku_sorani: '', ku_badini: '', ar: '' };
        const price = data.price || '';
        const imageUrls = data.imageUrls || ["", "", "", ""];
        
        // دروستکردنی ٤ خانەی وێنە
        let imageSlotsHTML = '';
        for (let i = 0; i < 4; i++) {
            const imageUrl = imageUrls[i];
            const hasImage = !!imageUrl;
            
            // [ 💡 چارەسەری هەڵە 💡 ] - 'classclass' چاککرا بۆ 'class'
            imageSlotsHTML += `
                <div class="image-upload-slot" data-index="${i}">
                    <img src="${hasImage ? imageUrl : ''}" class="image-upload-preview" style="display: ${hasImage ? 'block' : 'none'};">
                    <label for="var-${variationId}-file-${i}" class="image-upload-label" style="display: ${hasImage ? 'none' : 'flex'};">
                        <i class="fas fa-upload"></i>
                        <span>وێنەی ${i + 1}</span>
                    </label>
                    <input type="file" id="var-${variationId}-file-${i}" class="image-upload-input variation-image-upload-input" accept="image/*">
                    <i class="fas fa-spinner fa-spin image-upload-spinner"></i>
                    <button type="button" class="image-upload-remove-btn variation-image-remove-btn" style="display: ${hasImage ? 'flex' : 'none'};">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="variation-header">
                <h4>جۆری نوێ (Variation)</h4>
                <button type="button" class="delete-variation-btn delete-btn small-btn"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label>ناوی جۆر (سۆرانی):</label>
                <input type="text" class="variation-name-ku_sorani" value="${name.ku_sorani}" placeholder="بۆ نموونە: ڕەنگی ڕەش">
            </div>
            <div class="form-group">
                <label>ناوی جۆر (بادینی):</label>
                <input type="text" class="variation-name-ku_badini" value="${name.ku_badini}" placeholder="بۆ نموونە: ڕەنگێ رەش">
            </div>
            <div class="form-group">
                <label>ناوی جۆر (عربی):</label>
                <input type="text" class="variation-name-ar" value="${name.ar}" placeholder="مثال: اللون الأسود">
            </div>
            <div class="form-group">
                <label>نرخی ئەم جۆرە (د.ع.):</label>
                <input type="number" class="variation-price" value="${price}" placeholder="نرخی تایبەت بەم جۆرە (ئەگەر جیاوازە)">
            </div>
            <div class="form-group">
                <label>وێنەکانی ئەم جۆرە (٤ وێنە):</label>
                <div class="image-upload-container">
                    ${imageSlotsHTML}
                </div>
            </div>
        `;
    },

    // [ 💡 نوێ ] - سڕینەوەی فۆڕمی بچووک
    deleteVariationFormBox: function(event) {
        const formBox = event.target.closest('.variation-form-box');
        if (!formBox) return;
        
        const variationId = formBox.dataset.variationId;
        
        if (confirm(`دڵنیایت دەتەوێت ئەم جۆرە (Variation) بسڕیتەوە؟`)) {
            // سڕینەوە لە ستەیتی ناوخۆیی
            this.variationData = this.variationData.filter(v => v.id !== variationId);
            // سڕینەوە لە DOM
            formBox.remove();
        }
    },

    // [ 💡 نوێ ] - بارکردنی وێنە بۆ جۆرەکان
    handleVariationFileSelect: async function(event) {
        const input = event.target;
        const file = input.files[0];
        if (!file) return;

        const slot = input.closest('.image-upload-slot');
        const formBox = input.closest('.variation-form-box');
        const variationId = formBox.dataset.variationId;
        const index = slot.dataset.index;

        const spinner = slot.querySelector('.image-upload-spinner');
        const label = slot.querySelector('.image-upload-label');
        const preview = slot.querySelector('.image-upload-preview');
        const removeBtn = slot.querySelector('.variation-image-remove-btn');

        spinner.style.display = 'block';
        label.style.display = 'none';

        try {
            const fileName = `products/${Date.now()}-variation-${file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // دۆزینەوەی جۆرەکە لە ستەیتی ناوخۆیی و نوێکردنەوەی وێنەکەی
            const variation = this.variationData.find(v => v.id === variationId);
            if (variation) {
                variation.imageUrls[index] = downloadURL;
            }

            preview.src = downloadURL;
            preview.style.display = 'block';
            removeBtn.style.display = 'flex';

        } catch (error) {
            console.error("Error uploading variation image:", error);
            showNotification('هەڵەیەک لە کاتی بلندکردنی وێنەکە ڕوویدا!', 'error');
            label.style.display = 'flex';
        } finally {
            spinner.style.display = 'none';
        }
    },

    // [ 💡 نوێ ] - سڕینەوەی وێنەی جۆرەکان
    handleVariationImageRemove: function(event) {
        const removeBtn = event.target.closest('.variation-image-remove-btn');
        const slot = removeBtn.closest('.image-upload-slot');
        const formBox = removeBtn.closest('.variation-form-box');
        const variationId = formBox.dataset.variationId;
        const index = slot.dataset.index;

        // سڕینەوە لە ستەیتی ناوخۆیی
        const variation = this.variationData.find(v => v.id === variationId);
        if (variation) {
            variation.imageUrls[index] = "";
        }

        // نوێکردنەوەی DOM
        slot.querySelector('.image-upload-preview').src = '';
        slot.querySelector('.image-upload-preview').style.display = 'none';
        slot.querySelector('.image-upload-label').style.display = 'flex';
        slot.querySelector('.image-upload-remove-btn').style.display = 'none';
        slot.querySelector('.image-upload-input').value = null;
    },

    // [ 💡 نوێ ] - هێنانی جۆرەکان لە فایەربەیس
    fetchVariationsForProduct: async function(productId) {
        try {
            const variationsQuery = collection(db, "products", productId, "variations");
            const snapshot = await getDocs(variationsQuery);
            if (snapshot.empty) {
                return [];
            }
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching variations:", error);
            return [];
        }
    },
    
    // ... (کۆدی خوارەوە وەک خۆی دەمێنێتەوە) ...
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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

    renderCategoryManagementUI: async function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const confirmation = confirm(`دڵنیایت دەتەوێت جۆری "${categoryName}" بسڕیتەوە؟\nئاگاداربە: ئەم کارە هەموو جۆرە لاوەکییەکانیشی دەسڕێتەوە.`);
        if (confirmation) {
            try {
                // لێرەدا پێویستە لۆژیکی سڕینەوەی هەموو sub-collectionـەکان زیاد بکرێت
                // ...
                await deleteDoc(doc(db, docPath));
                showNotification('جۆرەکە بە سەرکەوتوویی سڕدرایەوە', 'success');
                clearProductCache();
                this.updateAdminCategoryDropdowns();
                this.updateShortcutCardCategoryDropdowns();
                this.updateCategoryLayoutDropdowns();
            } catch (error) {
                console.error("Error deleting category: ", error);
                showNotification('هەڵەیەک ڕوویدا لە کاتی sڕینەوە', 'error');
            }
        }
    },
    
    updateAdminCategoryDropdowns: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const categories = getCategories();
        if (categories.length === 0) return; 
        
        const categoriesWithoutAll = categories.filter(cat => cat.id && cat.id !== 'all'); 
        if (categoriesWithoutAll.length === 0) return; 

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

    renderPromoGroupsAdminList: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const container = document.getElementById('promoGroupsListContainer');
        const groupSelect = document.getElementById('promoCardGroupSelect');
        const q = query(promoGroupsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ گرووپێکی سلایدەر زیاد نەکراوە.</p>';
                return;
            }

            snapshot.forEach(groupDoc => {
                const group = { id: groupDoc.id, ...groupDoc.data() };
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                groupSelect.appendChild(option.cloneNode(true)); 

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
                const cardsQuery = query(collection(db, "promo_groups", group.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = '';
                    if (cardsSnapshot.empty) {
                        cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کاردێک بۆ ئەم گرووپە زیاد نەکراوە.</p>';
                    } else {
                        cardsSnapshot.forEach(cardDoc => {
                            const card = { id: cardDoc.id, ...cardDoc.data() };
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
                });
            });
        });
    },

    editPromoGroup: async function(groupId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const groupRef = doc(promoGroupsCollection, groupId);
        const groupSnap = await getDoc(groupRef);
        const currentName = groupSnap.data().name;
        const newName = prompt('ناوی نوێی گرووپ بنووسە:', currentName);
        if (newName && newName.trim() !== '') {
            await updateDoc(groupRef, { name: newName.trim() });
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
        }
    },

    deletePromoGroup: async function(groupId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو کارتەکانی بسڕیتەوە؟')) {
            try {
                const cardsRef = collection(db, "promo_groups", groupId, "cards");
                const cardsSnapshot = await getDocs(cardsRef);
                const deletePromises = cardsSnapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
                await deleteDoc(doc(promoGroupsCollection, groupId));
                showNotification('گرووپ بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },
    
    editPromoCard: async function(groupId, cardId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const cardSnap = await getDoc(doc(db, "promo_groups", groupId, "cards", cardId));
        if (cardSnap.exists()) {
            const card = cardSnap.data();
            document.getElementById('editingPromoCardId').value = cardId;
            document.getElementById('promoCardGroupSelect').value = groupId;
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم کارتە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "promo_groups", groupId, "cards", cardId));
                showNotification('کارتەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    renderBrandGroupsAdminList: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const container = document.getElementById('brandGroupsListContainer');
        const groupSelect = document.getElementById('brandGroupSelect');
        const q = query(brandGroupsCollection, orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            groupSelect.innerHTML = '<option value="" disabled selected>-- گرووپێک هەڵبژێرە --</option>';

            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ گرووپێکی براند زیاد نەکراوە.</p>';
                return;
            }

            snapshot.forEach(groupDoc => {
                const group = { id: groupDoc.id, ...groupDoc.data() };
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                groupSelect.appendChild(option.cloneNode(true)); 

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
                const brandsQuery = query(collection(db, "brand_groups", group.id, "brands"), orderBy("order", "asc"));
                onSnapshot(brandsQuery, (brandsSnapshot) => {
                    brandsContainer.innerHTML = '';
                    if (brandsSnapshot.empty) {
                        brandsContainer.innerHTML = '<p class="empty-list-text">هیچ براندێک بۆ ئەم گرووپە زیاد نەکراوە.</p>';
                    } else {
                        brandsSnapshot.forEach(brandDoc => {
                            const brand = { id: brandDoc.id, ...brandDoc.data() };
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
                });
            });
        });
    },
    
    editBrandGroup: async function(groupId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const groupRef = doc(brandGroupsCollection, groupId);
        const groupSnap = await getDoc(groupRef);
        const currentName = groupSnap.data().name;
        const newName = prompt('ناوی نوێی گرووپی براند بنووسە:', currentName);
        if (newName && newName.trim() !== '') {
            await updateDoc(groupRef, { name: newName.trim() });
            showNotification('ناوی گرووپ نوێکرایەوە', 'success');
            clearProductCache();
        }
    },

    deleteBrandGroup: async function(groupId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم گرووپە و هەموو براندەکانی بسڕیتەوە؟')) {
            try {
                const brandsRef = collection(db, "brand_groups", groupId, "brands");
                const brandsSnapshot = await getDocs(brandsRef);
                const deletePromises = brandsSnapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
                await deleteDoc(doc(brandGroupsCollection, groupId));
                showNotification('گرووپی براند بە تەواوی سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },

    editBrand: async function(groupId, brandId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const brandSnap = await getDoc(doc(db, "brand_groups", groupId, "brands", brandId));
        if (brandSnap.exists()) {
            const brand = brandSnap.data();
            document.getElementById('editingBrandId').value = brandId;
            document.getElementById('brandGroupSelect').value = groupId;
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم براندە بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, "brand_groups", groupId, "brands", brandId));
                showNotification('براندەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); }
        }
    },
    
    renderShortcutRowsAdminList: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
                rowSelect.appendChild(option.cloneNode(true));

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
                const cardsQuery = query(collection(db, "shortcut_rows", row.id, "cards"), orderBy("order", "asc"));
                onSnapshot(cardsQuery, (cardsSnapshot) => {
                    cardsContainer.innerHTML = '';
                    if(cardsSnapshot.empty) {
                        cardsContainer.innerHTML = '<p class="empty-list-text">هیچ کارتێک بۆ ئەم ڕیزە زیاد نەکراوە.</p>';
                    } else {
                        cardsSnapshot.forEach(cardDoc => {
                            const card = { id: cardDoc.id, ...cardDoc.data() };
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
                });
            });
        });
    },

    editShortcutRow: async function(rowId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const rowSnap = await getDoc(doc(db, "shortcut_rows", rowId));
        if (rowSnap.exists()) {
            const row = rowSnap.data();
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم ڕیزە بسڕیتەوە؟ هەموو کارتەکانی ناویشی دەسڕێنەوە!')) {
            try {
                const cardsRef = collection(db, "shortcut_rows", rowId, "cards");
                const cardsSnapshot = await getDocs(cardsRef);
                const deletePromises = cardsSnapshot.docs.map(d => deleteDoc(d.ref));
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

    editShortcutCard: async function(rowId, cardId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const cardSnap = await getDoc(doc(db, "shortcut_rows", rowId, "cards", cardId));
        if (cardSnap.exists()) {
            const card = cardSnap.data();
            document.getElementById('editingShortcutCardId').value = cardId;
            document.getElementById('selectRowForCard').value = rowId;
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const categories = getCategories();
        if (categories.length === 0) return; 
        const categoriesWithoutAll = categories.filter(cat => cat.id && cat.id !== 'all');
        if (categoriesWithoutAll.length === 0) return;
        
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
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const container = document.getElementById('homeLayoutListContainer');
        const layoutCollection = collection(db, 'home_layout');
        const q = query(layoutCollection, orderBy("order", "asc"));

        onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p>هیچ بەشێک بۆ لاپەڕەی سەرەki زیاد نەکراوە. کلیک لە "زیادکردنی بەش" بکە.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const itemElement = document.createElement('div');
                itemElement.className = 'layout-item';
                itemElement.dataset.id = item.id;
                itemElement.dataset.sectionData = JSON.stringify(item); 
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
                    if (dragging) container.appendChild(dragging);
                } else {
                    if (dragging) container.insertBefore(dragging, afterElement);
                }
            });
        });
    },

    getDragAfterElement: function(container, y) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
    
    deleteHomeLayoutItem: async function(itemId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (confirm('دڵنیایت دەتەوێت ئەم بەشە لە لاپەڕەی سەرەki بسڕیتەوە؟')) {
            try {
                await deleteDoc(doc(db, 'home_layout', itemId));
                showNotification('بەشەکە سڕدرایەوە', 'success');
                clearProductCache();
            } catch (error) {
                console.error("Error deleting layout item:", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        }
    },

    saveHomeLayout: async function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
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
    
    updateCategoryLayoutDropdowns: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const select = document.getElementById('categoryLayoutSelect');
        if (!select) return;
        
        const categories = getCategories();
        const categoriesWithoutAll = categories.filter(cat => cat.id && cat.id !== 'all');
        
        select.innerHTML = `<option value="" disabled selected data-translate-key="admin_category_layout_select">${t('admin_category_layout_select')}</option>`;
        categoriesWithoutAll.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
            select.appendChild(option);
        });
    },

    loadCategoryLayoutEditor: async function(categoryId) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (!categoryId) return;
        
        this.currentCategoryLayoutId = categoryId; 
        const editorContainer = document.getElementById('categoryLayoutEditorContainer');
        const toggle = document.getElementById('categoryLayoutEnableToggle');
        const listContainer = document.getElementById('categoryLayoutListContainer');
        
        editorContainer.style.display = 'block';
        listContainer.innerHTML = '<p>... بارکردن</p>';

        try {
            const layoutDocRef = doc(db, 'category_layouts', categoryId);
            const docSnap = await getDoc(layoutDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                toggle.checked = data.enabled || false;
                this.renderCategoryLayoutSections(data.sections || []);
            } else {
                toggle.checked = false;
                this.renderCategoryLayoutSections([]);
            }
        } catch (error) {
            console.error("Error loading category layout:", error);
            showNotification('هەڵە لە بارکردنی دیزاینی جۆر', 'error');
            listContainer.innerHTML = '<p style="color: red;">هەڵە لە بارکردن.</p>';
        }
    },

    renderCategoryLayoutSections: function(sectionsArray) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const container = document.getElementById('categoryLayoutListContainer');
        container.innerHTML = '';
        
        sectionsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

        if (sectionsArray.length === 0) {
            container.innerHTML = '<p>هیچ بەشێک زیاد نەکراوە.</p>';
            return;
        }

        sectionsArray.forEach((item, index) => {
            if (!item.id) item.id = `section_${Date.now()}_${index}`;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'layout-item';
            itemElement.dataset.id = item.id; 
            itemElement.dataset.sectionData = JSON.stringify(item); 
            itemElement.draggable = true;

            const itemName = (item.name && typeof item.name === 'object') ? (item.name[getCurrentLanguage()] || item.name.ku_sorani) : item.name;

            itemElement.innerHTML = `
                <div class="layout-item-info">
                    <i class="fas fa-grip-vertical drag-handle"></i>
                    <span>${itemName}</span>
                </div>
                <div class="layout-item-actions">
                    <button class="delete-layout-item-btn delete-btn small-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(itemElement);
        });
    },

    saveCategoryLayout: async function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const categoryId = this.currentCategoryLayoutId;
        if (!categoryId) {
            showNotification('هیچ جۆرێک هەڵنەbژێردراوە', 'error');
            return;
        }
        
        const saveBtn = document.getElementById('saveCategoryLayoutBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '...پاشەکەوت دەکرێت';
        
        const isEnabled = document.getElementById('categoryLayoutEnableToggle').checked;
        const container = document.getElementById('categoryLayoutListContainer');
        const items = container.querySelectorAll('.layout-item');
        
        const sectionsArray = [];
        items.forEach((item, index) => {
            const sectionData = JSON.parse(item.dataset.sectionData);
            sectionData.order = index + 1; 
            sectionsArray.push(sectionData);
        });

        try {
            const layoutDocRef = doc(db, 'category_layouts', categoryId);
            await setDoc(layoutDocRef, {
                enabled: isEnabled,
                sections: sectionsArray
            });
            showNotification('دیزاینی جۆر پاشەکەوت کرا', 'success');
            clearProductCache(); 
        } catch (error) {
            console.error("Error saving category layout:", error);
            showNotification('هەڵەیەک لە پاشەکەوتکردن ڕوویدا', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    },

    deleteCategoryLayoutItem: function(event) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const deleteBtn = event.target.closest('.delete-layout-item-btn');
        if (deleteBtn) {
            if (confirm('دڵنیایت دەتەوێت ئەم بەشە بسڕیتەوە؟ (پاشەکەوتکردن پێویستە)')) {
                deleteBtn.closest('.layout-item').remove();
            }
        }
    },

    openAddSectionModal: function(contextType) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        if (contextType === 'category' && !this.currentCategoryLayoutId) {
            showNotification('تکایە سەرەتا جۆرێک هەڵبژێرە', 'error');
            return;
        }
        
        this.currentLayoutEditorContext = {
            type: contextType,
            id: contextType === 'category' ? this.currentCategoryLayoutId : null
        };
        
        document.getElementById('addHomeSectionForm').reset();
        document.getElementById('specificItemGroupSelectContainer').style.display = 'none';
        document.getElementById('specificCategorySelectContainer').style.display = 'none';
        
        const modalTitle = document.querySelector('#addHomeSectionModal .modal-content h2');
        if (contextType === 'category') {
            modalTitle.textContent = t('admin_category_layout_add_section');
        } else {
            modalTitle.textContent = 'زیادکردنی بەشی نوێ بۆ پەڕەی سەرەki';
        }
        
        openPopup('addHomeSectionModal', 'modal');
    },

    handleSaveSection: async function(event) {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        event.preventDefault();
        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        const type = document.getElementById('newSectionType').value;
        const nameInput = document.getElementById('newSectionName').value;
        
        let nameObj = { ku_sorani: nameInput, ku_badini: nameInput, ar: nameInput };
        let specificIdData = {};
        
        if (type === 'promo_slider' || type === 'brands') {
            const groupId = document.getElementById('specificItemGroupId').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵبژێرە', 'error'); submitButton.disabled = false; return; }
            specificIdData = { groupId };
        } else if (type === 'single_shortcut_row') {
            const rowId = document.getElementById('specificItemGroupId').value;
            if (!rowId) { showNotification('تکایە ڕیزێک هەڵbژێرە', 'error'); submitButton.disabled = false; return; }
            specificIdData = { rowId };
        } else if (type === 'single_category_row') {
            const catId = document.getElementById('newSectionMainCategory').value;
            const subCatId = document.getElementById('newSectionSubcategory').value;
            const subSubCatId = document.getElementById('newSectionSubSubcategory').value;
            if (!catId) { showNotification('تکایە جۆری سەرەki هەڵbژێرە', 'error'); submitButton.disabled = false; return; }
            specificIdData = { categoryId: catId, subcategoryId: subCatId || null, subSubcategoryId: subSubCatId || null };
        }
        
        const newSectionData = {
            id: `section_${Date.now()}`, 
            name: nameObj,
            type,
            enabled: true, 
            ...specificIdData
        };

        try {
            const context = this.currentLayoutEditorContext;
            
            if (context.type === 'home') {
                const layoutCollectionRef = collection(db, 'home_layout');
                const q = query(layoutCollectionRef, orderBy('order', 'desc'), limit(1));
                const lastDocSnap = await getDocs(q);
                const lastOrder = lastDocSnap.empty ? 0 : lastDocSnap.docs[0].data().order;
                newSectionData.order = lastOrder + 1;
                
                await addDoc(layoutCollectionRef, newSectionData);
                
            } else if (context.type === 'category') {
                const categoryId = context.id;
                const layoutDocRef = doc(db, 'category_layouts', categoryId);
                
                await runTransaction(db, async (transaction) => {
                    const docSnap = await transaction.get(layoutDocRef);
                    let sections = [];
                    if (docSnap.exists()) {
                        sections = docSnap.data().sections || [];
                    }
                    newSectionData.order = sections.length + 1;
                    sections.push(newSectionData);
                    
                    transaction.set(layoutDocRef, { sections: sections }, { merge: true });
                });
                
                this.renderCategoryLayoutSections((await getDoc(layoutDocRef)).data().sections);
            }
            
            showNotification('بەشی نوێ زیادکرا', 'success');
            closeCurrentPopup();
            clearProductCache();
            
        } catch (error) {
            console.error("Error adding new section:", error);
            showNotification('هەڵەیەک ڕوویدا', 'error');
        } finally {
            submitButton.disabled = false;
        }
    },
    
    // [ 💡 گۆڕانکاری ] - لیسنەرەکان نوێکرانەوە بۆ سیستەمی نوێی وێنە
    setupAdminEventListeners: function() {
        if (this.listenersAttached) return;
        const self = this;
        
        // ... (هەموو لیسنەرەکانی تر لێرە دەبن وەک خۆیان) ...
        document.getElementById('saveLayoutBtn')?.addEventListener('click', () => self.saveHomeLayout());
        document.getElementById('addHomeSectionBtn')?.addEventListener('click', () => { self.openAddSectionModal('home'); });
        document.getElementById('homeLayoutListContainer').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-layout-item-btn');
            if(deleteBtn) { const itemId = deleteBtn.closest('.layout-item').dataset.id; self.deleteHomeLayoutItem(itemId); }
        });
        document.getElementById('newSectionType').addEventListener('change', async (e) => {
            const type = e.target.value;
            const groupContainer = document.getElementById('specificItemGroupSelectContainer');
            const categoryContainer = document.getElementById('specificCategorySelectContainer');
            const groupSelect = document.getElementById('specificItemGroupId');
            const mainCatSelect = document.getElementById('newSectionMainCategory');
            const groupLabel = document.getElementById('specificItemGroupLabel');
            groupSelect.required = false; mainCatSelect.required = false;
            groupContainer.style.display = 'none'; categoryContainer.style.display = 'none';
            if (type === 'promo_slider' || type === 'brands' || type === 'single_shortcut_row') {
                groupContainer.style.display = 'block'; groupSelect.required = true; groupSelect.innerHTML = '<option value="">...بارکردن</option>';
                let collectionRef, orderField, nameFieldAccessor;
                if (type === 'promo_slider') { collectionRef = promoGroupsCollection; groupLabel.textContent = 'کام گرووپی سلایدەر؟'; orderField = 'name'; nameFieldAccessor = (data) => data.name; }
                else if (type === 'brands') { collectionRef = brandGroupsCollection; groupLabel.textContent = 'کام گرووپی براند؟'; orderField = 'name'; nameFieldAccessor = (data) => data.name; }
                else { collectionRef = shortcutRowsCollection; groupLabel.textContent = 'کام ڕیزی کارت؟'; orderField = 'order'; nameFieldAccessor = (data) => data.title.ku_sorani; }
                const snapshot = await getDocs(query(collectionRef, orderBy(orderField)));
                groupSelect.innerHTML = `<option value="" disabled selected>-- گرووپ/ڕیزێک هەڵbژێرە --</option>`;
                snapshot.forEach(doc => { const data = doc.data(); const name = nameFieldAccessor(data); groupSelect.innerHTML += `<option value="${doc.id}">${name}</option>`; });
            } else if (type === 'single_category_row') {
                categoryContainer.style.display = 'block'; mainCatSelect.required = true; mainCatSelect.innerHTML = '<option value="">-- جۆری سەرەکی هەڵbژێرە (پێویستە) --</option>';
                getCategories().filter(c => c.id !== 'all').forEach(cat => { mainCatSelect.innerHTML += `<option value="${cat.id}">${cat.name_ku_sorani}</option>`; });
            }
        });
        document.getElementById('addHomeSectionForm').addEventListener('submit', (e) => self.handleSaveSection(e));
        document.getElementById('newSectionMainCategory').addEventListener('change', async (e) => {
            const mainCatId = e.target.value; const subContainer = document.getElementById('newSectionSubcategoryContainer'); const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer'); const subSelect = document.getElementById('newSectionSubcategory');
            subSubContainer.style.display = 'none'; subSelect.innerHTML = '';
            if (mainCatId) {
                subContainer.style.display = 'block'; subSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const q = query(collection(db, `categories/${mainCatId}/subcategories`), orderBy('order')); const snapshot = await getDocs(q);
                subSelect.innerHTML = '<option value="">-- هەموو (یان هەڵbژێرە) --</option>';
                snapshot.forEach(doc => { subSelect.innerHTML += `<option value="${doc.id}">${doc.data().name_ku_sorani}</option>`; });
            } else { subContainer.style.display = 'none'; }
        });
        document.getElementById('newSectionSubcategory').addEventListener('change', async (e) => {
            const mainCatId = document.getElementById('newSectionMainCategory').value; const subCatId = e.target.value; const subSubContainer = document.getElementById('newSectionSubSubcategoryContainer'); const subSubSelect = document.getElementById('newSectionSubSubcategory');
            subSubSelect.innerHTML = '';
            if (mainCatId && subCatId) {
                subSubContainer.style.display = 'block'; subSubSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const q = query(collection(db, `categories/${mainCatId}/subcategories/${subCatId}/subSubcategories`), orderBy('order')); const snapshot = await getDocs(q);
                subSubSelect.innerHTML = '<option value="">-- هەموو (یان هەڵbژێرە) --</option>';
                snapshot.forEach(doc => { subSubSelect.innerHTML += `<option value="${doc.id}">${doc.data().name_ku_sorani}</option>`; });
            } else { subSubContainer.style.display = 'none'; }
        });
        
        // [ 💡 نوێ ] - لیسنەری دوگمەی زیادکردنی جۆر
        document.getElementById('addVariationBtn').onclick = () => {
            self.addVariationFormBox();
        };

        // [ 💡 نوێ ] - لیسنەری گشتی بۆ فۆڕمە بچووکەکان
        document.getElementById('variationsContainer').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-variation-btn');
            if (deleteBtn) {
                self.deleteVariationFormBox(e);
            }
            const removeBtn = e.target.closest('.variation-image-remove-btn');
            if (removeBtn) {
                self.handleVariationImageRemove(e);
            }
        });
        document.getElementById('variationsContainer').addEventListener('change', (e) => {
            if (e.target.classList.contains('variation-image-upload-input')) {
                self.handleVariationFileSelect(e);
            }
        });


        document.getElementById('addProductBtn').onclick = () => {
            setEditingProductId(null);
            document.getElementById('productForm').reset();
            // [ 💡 گۆڕانکاری ] - پاککردنەوەی هەردوو جۆری وێنە
            self.baseImageUrls = ["", "", "", ""];
            self.createBaseProductImageInputs();
            self.variationData = [];
            self.loadedVariationIds = [];
            document.getElementById('variationsContainer').innerHTML = '';
            
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

        // [ 💡 گۆڕانکاری ] - لیسنەرەکان بۆ وێنەی بنەڕەتی
        document.getElementById('imageUploadContainer').addEventListener('change', (e) => {
            if (e.target.classList.contains('base-image-upload-input')) {
                const slot = e.target.closest('.image-upload-slot');
                self.handleBaseFileSelect(e.target, slot);
            }
        });

        document.getElementById('imageUploadContainer').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.base-image-remove-btn');
            if (removeBtn) {
                const slot = removeBtn.closest('.image-upload-slot');
                self.handleBaseImageRemove(slot);
            }
        });

        // [ 💡 گۆڕانکاری ] - فۆڕمی پاشەکەوتکردنی کاڵا بە تەواوی نوێکرایەوە
        document.getElementById('productForm').onsubmit = async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...چاوەڕێ بە';

            const editingId = getEditingProductId();

            // ——— قۆناغی یەکەم: کۆکردنەوە و پاشەکەوتکردنی کاڵای بنەڕەتی ———
            const baseImageUrls = self.baseImageUrls.filter(url => url !== ""); 
            if (baseImageUrls.length === 0) {
                showNotification('پێویستە بەلایەنی کەمەوە یەک وێنەی بنەڕەتی بلند بکەیت', 'error');
                submitButton.disabled = false;
                submitButton.textContent = editingId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                return;
            }

            const productNameKuSorani = document.getElementById('productNameKuSorani').value;
            const productData = {
                name: {
                    ku_sorani: productNameKuSorani,
                    ku_badini: document.getElementById('productNameKuBadini').value,
                    ar: document.getElementById('productNameAr').value
                },
                searchableName: productNameKuSorani.toLowerCase(),
                price: parseInt(document.getElementById('productPrice').value),
                originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
                categoryId: document.getElementById('productCategoryId').value,
                subcategoryId: document.getElementById('productSubcategoryId').value || null,
                subSubcategoryId: document.getElementById('productSubSubcategoryId').value || null,
                description: {
                    ku_sorani: document.getElementById('productDescriptionKuSorani').value,
                    ku_badini: document.getElementById('productDescriptionKuBadini').value,
                    ar: document.getElementById('productDescriptionAr').value
                },
                imageUrls: baseImageUrls, // وێنە بنەڕەتییەکان
                createdAt: Date.now(),
                externalLink: document.getElementById('productExternalLink').value || null,
                shippingInfo: {
                    ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                    ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                    ar: document.getElementById('shippingInfoAr').value.trim()
                }
            };
            
            let productId = editingId;
            try {
                if (editingId) {
                    const { createdAt, ...updateData } = productData;
                    await updateDoc(doc(db, "products", editingId), updateData);
                } else {
                    const docRef = await addDoc(productsCollection, productData);
                    productId = docRef.id; // وەرگرتنی ئایدی کاڵا نوێیەکە
                }
            } catch (baseError) {
                showNotification(t('error_generic'), 'error');
                console.error("Error saving base product:", baseError);
                submitButton.disabled = false;
                submitButton.textContent = editingId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                return;
            }

            // ——— قۆناغی دووەم: پاشەکەوتکردنی جۆرە جیاوازەکان (Variations) ———
            try {
                // نوێکردنەوەی داتای ناو ستەیت لە فۆڕمە بچووکەکان
                const variationBoxes = document.querySelectorAll('#variationsContainer .variation-form-box');
                const currentVariationIds = [];

                variationBoxes.forEach(box => {
                    const variationId = box.dataset.variationId;
                    currentVariationIds.push(variationId);
                    
                    const variation = self.variationData.find(v => v.id === variationId);
                    if (variation) {
                        variation.name.ku_sorani = box.querySelector('.variation-name-ku_sorani').value;
                        variation.name.ku_badini = box.querySelector('.variation-name-ku_badini').value;
                        variation.name.ar = box.querySelector('.variation-name-ar').value;
                        variation.price = parseInt(box.querySelector('.variation-price').value) || productData.price; // ئەگەر نرخ نەبوو، نرخی بنەڕەتی وەردەگرێت
                        // وێنەکان پێشتر لە ستەیت نوێکراونەتەوە
                    }
                });

                // دۆزینەوەی ئەو جۆرانەی کە سڕاونەتەوە
                const variationsToDelete = self.loadedVariationIds.filter(id => !currentVariationIds.includes(id));

                const promises = [];

                // پاشەکەوتکردن یان نوێکردنەوەی جۆرەکان
                self.variationData.forEach(variation => {
                    const variationDocData = {
                        name: variation.name,
                        price: variation.price,
                        imageUrls: variation.imageUrls.filter(url => url !== "")
                    };
                    
                    if (variationDocData.imageUrls.length === 0) return; // ئەگەر هیچ وێنەیەکی نەبوو پاشەکەوتی ناکەین

                    if (variation.id.startsWith('temp_')) {
                        // جۆری نوێ
                        promises.push(addDoc(collection(db, "products", productId, "variations"), variationDocData));
                    } else {
                        // جۆری کۆن (نوێکردنەوە)
                        promises.push(setDoc(doc(db, "products", productId, "variations", variation.id), variationDocData));
                    }
                });

                // سڕینەوەی جۆرە لابراوەکان
                variationsToDelete.forEach(id => {
                    promises.push(deleteDoc(doc(db, "products", productId, "variations", id)));
                });

                await Promise.all(promises);

                showNotification(editingId ? 'کاڵا و جۆرەکانی نوێکرانەوە' : 'کاڵا و جۆرەکانی زیادکران', 'success');
                clearProductCache();
                closeCurrentPopup();

            } catch (variationError) {
                showNotification('کاڵا سەرەکییەکە پاشەکەوتکرا، بەڵام هەڵەیەک لە پاشەکەوتکردنی جۆرەکان ڕوویدا', 'error');
                console.error("Error saving variations:", variationError);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = editingId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                setEditingProductId(null);
            }
        };
        
        // ... (هەموو لیسنەرەکانی تری خوارەوە وەک خۆیان دەمێننەوە)
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
                    showNotification('جۆری سەرەki بە سەرکەوتوویی زیادکرا', 'success');
                    addCategoryForm.reset();
                    clearProductCache();
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
                const submitButton = e.target.querySelector('button[type="submit"]');
                const parentCategoryId = document.getElementById('parentCategorySelect').value;
                if (!parentCategoryId) {
                    showNotification('تکایە جۆری سەرەکی هەڵbژێرە', 'error');
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
        document.getElementById('parentMainCategorySelectForSubSub').addEventListener('change', async (e) => {
            const mainCatId = e.target.value;
            const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
            if (!mainCatId) { subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵbژاردنی جۆری سەرەki بە --</option>'; return; }
            subCatSelect.innerHTML = '<option value="" disabled selected>...چاوەڕێ بە</option>';
            subCatSelect.disabled = true;
            try {
                const subcategoriesQuery = collection(db, "categories", mainCatId, "subcategories");
                const q = query(subcategoriesQuery, orderBy("order", "asc"));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) { subCatSelect.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>'; }
                else {
                    subCatSelect.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵbژێرە --</option>';
                    querySnapshot.docs.forEach(doc => { const subcat = { id: doc.id, ...doc.data() }; subCatSelect.innerHTML += `<option value="${subcat.id}">${subcat.name_ku_sorani}</option>`; });
                }
            } catch(error) { console.error("Error populating subcategories in SubSub form:", error); subCatSelect.innerHTML = '<option value="" disabled selected>هەڵەیەک ڕوویدا</option>'; }
            finally { subCatSelect.disabled = false; }
        });
        const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
        if (addSubSubcategoryForm) {
            addSubSubcategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const mainCatSelect = document.getElementById('parentMainCategorySelectForSubSub');
                const subCatSelect = document.getElementById('parentSubcategorySelectForSubSub');
                const mainCatId = mainCatSelect.value;
                const subCatId = subCatSelect.value;
                if (!mainCatId || !subCatId) { showNotification('تکایە هەردوو جۆرەکە هەڵbژێرە', 'error'); return; }
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
                    subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵbژاردنی جۆری سەرەki بە --</option>';
                    clearProductCache();
                } catch (error) { console.error("Error adding sub-subcategory: ", error); showNotification('هەڵەیەک ڕوویدا', 'error'); }
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
                if (level === '1') { updateData.icon = document.getElementById('editCategoryIcon').value; }
                if (level === '2' || level === '3') { updateData.imageUrl = document.getElementById('editCategoryImageUrl').value.trim() || null; }
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
                    createdAt: Date.now(),
                    imageUrl: document.getElementById('announcementImageUrl').value.trim() || null
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
        document.getElementById('addPromoGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('promoGroupName').value;
            if (name.trim()) {
                await addDoc(promoGroupsCollection, { name: name.trim(), createdAt: Date.now() });
                showNotification('گرووپی سلایدەر زیادکرا', 'success');
                e.target.reset();
            }
        });
        document.getElementById('addPromoCardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('promoCardGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵbژێرە', 'error'); return; }
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
            };
            try {
                const cardsCollectionRef = collection(db, "promo_groups", groupId, "cards");
                if (editingId) {
                    await setDoc(doc(cardsCollectionRef, editingId), cardData, { merge: true });
                    showNotification('کارتەکە نوێکرایەوە', 'success');
                } else {
                    cardData.createdAt = Date.now();
                    await addDoc(cardsCollectionRef, cardData);
                    showNotification('کارتی نوێ زیادکرا', 'success');
                }
                e.target.reset();
                document.getElementById('editingPromoCardId').value = '';
                submitButton.textContent = 'پاشەکەوتکردنی کارت';
                clearProductCache();
            } catch (error) { showNotification('هەڵەیەک ڕوویدا', 'error'); } 
            finally { submitButton.disabled = false; }
        });
        document.getElementById('promoGroupsListContainer').addEventListener('click', (e) => {
            if (e.target.closest('.edit-promo-group-btn')) self.editPromoGroup(e.target.closest('.edit-promo-group-btn').dataset.id);
            if (e.target.closest('.delete-promo-group-btn')) self.deletePromoGroup(e.target.closest('.delete-promo-group-btn').dataset.id);
            if (e.target.closest('.edit-promo-card-btn')) { const btn = e.target.closest('.edit-promo-card-btn'); self.editPromoCard(btn.dataset.groupId, btn.dataset.cardId); }
            if (e.target.closest('.delete-promo-card-btn')) { const btn = e.target.closest('.delete-promo-card-btn'); self.deletePromoCard(btn.dataset.groupId, btn.dataset.cardId); }
        });
        document.getElementById('addBrandGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('brandGroupName').value;
            if (name.trim()) {
                await addDoc(brandGroupsCollection, { name: name.trim(), createdAt: Date.now() });
                showNotification('گرووپی براند زیادکرا', 'success');
                e.target.reset();
            }
        });
        document.getElementById('addBrandForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('brandGroupSelect').value;
            if (!groupId) { showNotification('تکایە گرووپێک هەڵbژێرە', 'error'); return; }
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            const editingId = document.getElementById('editingBrandId').value;
            const brandData = {
                name: { ku_sorani: document.getElementById('brandNameKuSorani').value, ku_badini: document.getElementById('brandNameKuBadini').value, ar: document.getElementById('brandNameAr').value, },
                imageUrl: document.getElementById('brandImageUrl').value,
                categoryId: document.getElementById('brandTargetMainCategory').value || null,
                subcategoryId: document.getElementById('brandTargetSubcategory').value || null,
                order: parseInt(document.getElementById('brandOrder').value) || 0,
            };
            try {
                const brandsCollectionRef = collection(db, "brand_groups", groupId, "brands");
                if (editingId) {
                    await setDoc(doc(brandsCollectionRef, editingId), brandData, { merge: true });
                    showNotification('براند نوێکرایەوە', 'success');
                } else {
                    brandData.createdAt = Date.now();
                    await addDoc(brandsCollectionRef, brandData);
                    showNotification('براندی نوێ زیادکرا', 'success');
                }
                e.target.reset();
                document.getElementById('editingBrandId').value = '';
                document.getElementById('brandSubcategoryContainer').style.display = 'none';
                submitButton.textContent = 'پاشەکەوتکردنی براند';
                clearProductCache();
            } catch (error) { console.error("Error saving brand:", error); showNotification('هەڵەیەک ڕوویدا', 'error'); } 
            finally { submitButton.disabled = false; }
        });
        document.getElementById('brandGroupsListContainer').addEventListener('click', (e) => {
            if (e.target.closest('.edit-brand-group-btn')) self.editBrandGroup(e.target.closest('.edit-brand-group-btn').dataset.id);
            if (e.target.closest('.delete-brand-group-btn')) self.deleteBrandGroup(e.target.closest('.delete-brand-group-btn').dataset.id);
            if (e.target.closest('.edit-brand-btn')) { const btn = e.target.closest('.edit-brand-btn'); self.editBrand(btn.dataset.groupId, btn.dataset.brandId); }
            if (e.target.closest('.delete-brand-btn')) { const btn = e.target.closest('.delete-brand-btn'); self.deleteBrand(btn.dataset.groupId, btn.dataset.brandId); }
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
                snapshot.forEach(doc => { const subcat = { id: doc.id, ...doc.data() }; const option = document.createElement('option'); option.value = subcat.id; option.textContent = subcat.name_ku_sorani; brandSubCatSelect.appendChild(option); });
            } else {
                brandSubCatContainer.style.display = 'none';
                brandSubCatSelect.innerHTML = '';
            }
        });
        document.getElementById('shortcutCardMainCategory').addEventListener('change', async (e) => {
            const mainCatId = e.target.value; const subCatContainer = document.getElementById('shortcutCardSubContainer'); const subSubCatContainer = document.getElementById('shortcutCardSubSubContainer'); const subCatSelect = document.getElementById('shortcutCardSubcategory');
            subSubCatContainer.style.display = 'none'; subCatSelect.innerHTML = ''; 
            if (mainCatId) {
                subCatContainer.style.display = 'block'; subCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const q = query(collection(db, `categories/${mainCatId}/subcategories`), orderBy('order')); const snapshot = await getDocs(q);
                subCatSelect.innerHTML = '<option value="">-- هەموو لاوەکی (یان هەڵbژێرە) --</option>';
                snapshot.forEach(doc => { subCatSelect.innerHTML += `<option value="${doc.id}">${doc.data().name_ku_sorani}</option>`; });
            } else { subCatContainer.style.display = 'none'; }
        });
        document.getElementById('shortcutCardSubcategory').addEventListener('change', async (e) => {
            const mainCatId = document.getElementById('shortcutCardMainCategory').value; const subCatId = e.target.value; const subSubCatContainer = document.getElementById('shortcutCardSubSubContainer'); const subSubCatSelect = document.getElementById('shortcutCardSubSubcategory');
            subSubCatSelect.innerHTML = '';
            if (mainCatId && subCatId) {
                subSubCatContainer.style.display = 'block'; subSubCatSelect.innerHTML = '<option value="">...چاوەڕێ بە</option>';
                const q = query(collection(db, `categories/${mainCatId}/subcategories/${subCatId}/subSubcategories`), orderBy('order')); const snapshot = await getDocs(q);
                subSubCatSelect.innerHTML = '<option value="">-- هەموو لاوەکی لاوەکی (یان هەڵbژێرە) --</option>';
                snapshot.forEach(doc => { subSubCatSelect.innerHTML += `<option value="${doc.id}">${doc.data().name_ku_sorani}</option>`; });
            } else { subSubCatContainer.style.display = 'none'; }
        });
        document.getElementById('shortcutRowsListContainer').addEventListener('click', (e) => {
            const editRowBtn = e.target.closest('.edit-row-btn'); if (editRowBtn) { self.editShortcutRow(editRowBtn.dataset.id); }
            const deleteRowBtn = e.target.closest('.delete-row-btn'); if (deleteRowBtn) { self.deleteShortcutRow(deleteRowBtn.dataset.id); }
            const editCardBtn = e.target.closest('.edit-card-btn'); if (editCardBtn) { self.editShortcutCard(editCardBtn.dataset.rowId, editCardBtn.dataset.cardId); }
            const deleteCardBtn = e.target.closest('.delete-card-btn'); if (deleteCardBtn) { self.deleteShortcutCard(deleteCardBtn.dataset.rowId, deleteCardBtn.dataset.cardId); }
        });

        this.setupCategoryLayoutListeners();

        this.listenersAttached = true;
    },
    
    setupCategoryLayoutListeners: function() {
        // ... (هەمان کۆدی پێشوو، هیچ گۆڕانکارییەک نییە)
        const self = this;
        const categoryLayoutSelect = document.getElementById('categoryLayoutSelect');
        if (categoryLayoutSelect) { categoryLayoutSelect.addEventListener('change', (e) => { self.loadCategoryLayoutEditor(e.target.value); }); }
        const addCategorySectionBtn = document.getElementById('addCategorySectionBtn');
        if (addCategorySectionBtn) { addCategorySectionBtn.addEventListener('click', () => { self.openAddSectionModal('category'); }); }
        const saveCategoryLayoutBtn = document.getElementById('saveCategoryLayoutBtn');
        if (saveCategoryLayoutBtn) { saveCategoryLayoutBtn.addEventListener('click', () => { self.saveCategoryLayout(); }); }
        const categoryLayoutListContainer = document.getElementById('categoryLayoutListContainer');
        if (categoryLayoutListContainer) {
            categoryLayoutListContainer.addEventListener('click', (e) => { self.deleteCategoryLayoutItem(e); });
            categoryLayoutListContainer.addEventListener('dragstart', (e) => { if(e.target.classList.contains('layout-item')) { setTimeout(() => e.target.classList.add('dragging'), 0); } });
            categoryLayoutListContainer.addEventListener('dragend', (e) => { if(e.target.classList.contains('layout-item')) { e.target.classList.remove('dragging'); } });
            categoryLayoutListContainer.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = self.getDragAfterElement(categoryLayoutListContainer, e.clientY);
                const dragging = categoryLayoutListContainer.querySelector('.dragging');
                if (afterElement == null) { if (dragging) categoryLayoutListContainer.appendChild(dragging); }
                else { if (dragging) categoryLayoutListContainer.insertBefore(dragging, afterElement); }
            });
        }
    }
};
