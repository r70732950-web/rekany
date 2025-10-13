// admin.js

import { db } from './firebase.js';
import { showNotification } from './ui.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let editingProductId = null;

export function updateAdminUI(isAdmin, callbacks) {
    const adminElements = [
        'addProductBtn', 'adminCategoryManagement', 'adminContactMethodsManagement', 
        'adminPoliciesManagement', 'adminSocialMediaManagement', 'adminAnnouncementManagement',
        'adminPromoCardsManagement', 'settingsLogoutBtn'
    ];
    
    adminElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isAdmin ? (id === 'addProductBtn' ? 'flex' : 'block') : 'none';
    });

    const userElements = ['settingsAdminLoginBtn'];
    userElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isAdmin ? 'none' : 'flex';
    });
    
    if (isAdmin && callbacks && callbacks.loadAdminData) {
        callbacks.loadAdminData();
    }
}

function createProductImageInputs(imageUrls = []) {
    const container = document.getElementById('imageInputsContainer');
    container.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const url = imageUrls[i] || '';
        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';
        inputGroup.innerHTML = `
            <input type="text" class="productImageUrl" placeholder="لینکی وێنەی ${i + 1}" value="${url}" ${i === 0 ? 'required' : ''}>
            <img src="${url || `https://placehold.co/40x40/e2e8f0/2d3748?text=${i + 1}`}" class="image-preview-small" onerror="this.src='https://placehold.co/40x40/e2e8f0/2d3748?text=Err'">
        `;
        container.appendChild(inputGroup);
    }
}

export function openAddProductForm(categories) {
    editingProductId = null;
    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('formTitle').textContent = 'زیادکردنی کاڵای نوێ';
    form.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
    createProductImageInputs();
    
    const catSelect = document.getElementById('productCategoryId');
    catSelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    categories.filter(c => c.id !== 'all').forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name_ku_sorani;
        catSelect.appendChild(option);
    });
    
    document.getElementById('subcategorySelectContainer').style.display = 'none';
    document.getElementById('subSubcategorySelectContainer').style.display = 'none';

    document.getElementById('productFormModal').style.display = 'block';
    document.body.classList.add('overlay-active');
}

export async function openEditProductForm(productId, categories) {
    const docSnap = await getDoc(doc(db, "products", productId));
    if (!docSnap.exists()) {
        showNotification('کاڵاکە نەدۆزرایەوە!', 'error');
        return;
    }
    const product = { id: docSnap.id, ...docSnap.data() };
    editingProductId = productId;

    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('formTitle').textContent = 'دەستکاری کردنی کاڵا';
    form.querySelector('button[type="submit"]').textContent = 'نوێکردنەوە';

    document.getElementById('productNameKuSorani').value = product.name?.ku_sorani || '';
    document.getElementById('productNameKuBadini').value = product.name?.ku_badini || '';
    document.getElementById('productNameAr').value = product.name?.ar || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';
    document.getElementById('productDescriptionKuSorani').value = product.description?.ku_sorani || '';
    document.getElementById('productDescriptionKuBadini').value = product.description?.ku_badini || '';
    document.getElementById('productDescriptionAr').value = product.description?.ar || '';
    document.getElementById('productExternalLink').value = product.externalLink || '';
    document.getElementById('shippingInfoKuSorani').value = product.shippingInfo?.ku_sorani || '';
    document.getElementById('shippingInfoKuBadini').value = product.shippingInfo?.ku_badini || '';
    document.getElementById('shippingInfoAr').value = product.shippingInfo?.ar || '';

    createProductImageInputs(product.imageUrls);
    
    const catSelect = document.getElementById('productCategoryId');
    catSelect.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
    categories.filter(c => c.id !== 'all').forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name_ku_sorani;
        if (cat.id === product.categoryId) option.selected = true;
        catSelect.appendChild(option);
    });

    const event = new Event('change');
    catSelect.dispatchEvent(event);

    setTimeout(async () => {
        if (product.subcategoryId) {
            const subCatSelect = document.getElementById('productSubcategoryId');
            subCatSelect.value = product.subcategoryId;
            const subEvent = new Event('change');
            subCatSelect.dispatchEvent(subEvent);

            setTimeout(() => {
                if (product.subSubcategoryId) {
                     document.getElementById('productSubSubcategoryId').value = product.subSubcategoryId;
                }
            }, 500);
        }
    }, 500);

    document.getElementById('productFormModal').style.display = 'block';
    document.body.classList.add('overlay-active');
}

export async function deleteProduct(productId, t) {
    if (!confirm(t('delete_confirm'))) return false;
    try {
        await deleteDoc(doc(db, "products", productId));
        showNotification(t('product_deleted'), 'success');
        return true;
    } catch (error) {
        showNotification(t('product_delete_error'), 'error');
        console.error("Error deleting product:", error);
        return false;
    }
}

export function initializeAdminPanel(categories, refreshProducts, t) {
    const productForm = document.getElementById('productForm');
    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url);

        const productData = {
            name: {
                ku_sorani: document.getElementById('productNameKuSorani').value,
                ku_badini: document.getElementById('productNameKuBadini').value,
                ar: document.getElementById('productNameAr').value,
            },
            searchableName: document.getElementById('productNameKuSorani').value.toLowerCase(),
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
            imageUrls: imageUrls,
            externalLink: document.getElementById('productExternalLink').value || null,
            shippingInfo: {
                ku_sorani: document.getElementById('shippingInfoKuSorani').value.trim(),
                ku_badini: document.getElementById('shippingInfoKuBadini').value.trim(),
                ar: document.getElementById('shippingInfoAr').value.trim()
            },
        };

        try {
            if (editingProductId) {
                await updateDoc(doc(db, "products", editingProductId), productData);
                showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                productData.createdAt = Date.now();
                await addDoc(collection(db, "products"), productData);
                showNotification('کاڵا زیادکرا', 'success');
            }
            document.getElementById('productFormModal').style.display = 'none';
            document.body.classList.remove('overlay-active');
            refreshProducts();
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            console.error("Error saving product:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
        }
    };
    
    // ... لێرەدا کۆدی بەڕێوەبردنی بەشەکانی تری ئەدمین دادەنرێت
}