// ===================================================================
//          فایلا تایبەت ب بەشێ ئەدمینی
// ئەڤ فایلە بتنێ دێ هێتە بارکرن دەمێ ئەدمین لۆگین بوو
// ===================================================================
import { collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("✅ Admin module loaded successfully.");

// --- فەنکشنێن تایبەت ب ئەدمینی ---

async function editProduct(productId) {
    const productRef = doc(window.db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        window.showNotification(window.t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    window.editingProductId = productId; // Use global variable
    document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
    const productForm = document.getElementById('productForm');
    productForm.reset();

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
    createProductImageInputs(imageUrls);
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

    await populateSubcategoriesDropdown(categoryId, product.subcategoryId);
    await populateSubSubcategoriesDropdown(categoryId, product.subcategoryId, product.subSubcategoryId);

    productForm.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';
    window.openPopup('productFormModal', 'modal');
}

async function deleteProduct(productId) {
    if (!confirm(window.t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(window.db, "products", productId));
        window.showNotification(window.t('product_deleted'), 'success');
        window.searchProductsInFirestore(window.currentSearch, true);
    } catch (error) {
        window.showNotification(window.t('product_delete_error'), 'error');
    }
}

function createProductImageInputs(imageUrls = []) {
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
}

function populateCategoryDropdown() {
    const productCategorySelect = document.getElementById('productCategoryId');
    productCategorySelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    const categoriesWithoutAll = window.categories.filter(cat => cat.id !== 'all');
    categoriesWithoutAll.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat['name_' + window.currentLanguage] || cat.name;
        productCategorySelect.appendChild(option);
    });
}

async function populateSubcategoriesDropdown(categoryId, selectedSubcategoryId = null) {
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
        const subcategoriesQuery = collection(window.db, "categories", categoryId, "subcategories");
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
}

async function populateSubSubcategoriesDropdown(mainCategoryId, subcategoryId, selectedSubSubcategoryId = null) {
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
        const ref = collection(window.db, "categories", mainCategoryId, "subcategories", subcategoryId, "subSubcategories");
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
}

// --- Event Listeners for Admin Forms ---
function setupAdminEventListeners() {
    const productForm = document.getElementById('productForm');
    const addProductBtn = document.getElementById('addProductBtn');
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const socialMediaToggle = document.getElementById('socialMediaToggle');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const addSubcategoryForm = document.getElementById('addSubcategoryForm');
    const addSubSubcategoryForm = document.getElementById('addSubSubcategoryForm');
    const editCategoryForm = document.getElementById('editCategoryForm');
    const addContactMethodForm = document.getElementById('addContactMethodForm');
    const announcementForm = document.getElementById('announcementForm');
    const policiesForm = document.getElementById('policiesForm');
    const productCategorySelect = document.getElementById('productCategoryId');
    const productSubcategorySelect = document.getElementById('productSubcategoryId');

    if (addProductBtn) {
        addProductBtn.onclick = () => {
            window.editingProductId = null;
            productForm.reset();
            createProductImageInputs();
            document.getElementById('subcategorySelectContainer').style.display = 'none';
            document.getElementById('subSubcategorySelectContainer').style.display = 'none';
            document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
            productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
            window.openPopup('productFormModal', 'modal');
        };
    }

    if(settingsLogoutBtn) {
        settingsLogoutBtn.onclick = async () => {
            await window.auth.signOut();
        };
    }

    if (productForm) {
        productForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '...چاوەڕێ بە';
            const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
            if (imageUrls.length === 0) {
                window.showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
                submitButton.disabled = false;
                submitButton.textContent = window.editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
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
                if (window.editingProductId) {
                    const { createdAt, ...updateData } = productData;
                    await updateDoc(doc(window.db, "products", window.editingProductId), updateData);
                    window.showNotification('کاڵا نوێکرایەوە', 'success');
                } else {
                    await addDoc(collection(window.db, "products"), productData);
                    window.showNotification('کاڵا زیادکرا', 'success');
                }
                window.closeCurrentPopup();
                window.searchProductsInFirestore(window.currentSearch, true); 
            } catch (error) {
                window.showNotification(window.t('error_generic'), 'error');
                console.error("Error saving product:", error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = window.editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
                window.editingProductId = null;
            }
        };
    }
    
    //... (Add other admin event listeners here, similar to the one above)
}

// فەنکشنی سەرەکی بۆ دەستپێکرنا بەشێ ئەدمینی
window.initAdmin = function() {
    console.log("Initializing Admin UI and functionalities...");
    setupAdminEventListeners();
    // Share functions with app.js by attaching them to the window object
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    // Load admin-specific data or render UI components
    loadPoliciesForAdmin();
    renderCategoryManagementUI();
    renderContactMethodsAdmin();
    renderSocialMediaLinks();
    renderAdminAnnouncementsList();
};
