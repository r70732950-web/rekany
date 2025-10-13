import { db, auth } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import * as state from './state.js';
import * as ui from './ui-components.js';
import * as service from './firestore-service.js';

const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const imageInputsContainer = document.getElementById('imageInputsContainer');

export function updateAdminUI(isAdmin) {
    document.querySelectorAll('.product-actions').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    const adminCategoryManagement = document.getElementById('adminCategoryManagement');
    const adminContactMethodsManagement = document.getElementById('adminContactMethodsManagement');
    const adminPoliciesManagement = document.getElementById('adminPoliciesManagement');
    const adminSocialMediaManagement = document.getElementById('adminSocialMediaManagement');
    const adminAnnouncementManagement = document.getElementById('adminAnnouncementManagement');
    const adminPromoCardsManagement = document.getElementById('adminPromoCardsManagement');

    if (adminPoliciesManagement) adminPoliciesManagement.style.display = isAdmin ? 'block' : 'none';
    if (adminSocialMediaManagement) adminSocialMediaManagement.style.display = isAdmin ? 'block' : 'none';
    if (adminAnnouncementManagement) {
        adminAnnouncementManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) renderAdminAnnouncementsList();
    }
    
    if (adminPromoCardsManagement) {
        adminPromoCardsManagement.style.display = isAdmin ? 'block' : 'none';
        if (isAdmin) {
            renderPromoCardsAdminList();
            const select = document.getElementById('promoCardTargetCategory');
            select.innerHTML = '<option value="">-- جۆرێک هەڵبژێرە --</option>';
            const categoriesWithoutAll = state.categories.filter(cat => cat.id !== 'all');
            categoriesWithoutAll.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                select.appendChild(option);
            });
        }
    }

    if (isAdmin) {
        document.getElementById('settingsLogoutBtn').style.display = 'flex';
        document.getElementById('settingsAdminLoginBtn').style.display = 'none';
        document.getElementById('addProductBtn').style.display = 'flex';
        if (adminCategoryManagement) {
            adminCategoryManagement.style.display = 'block';
            renderCategoryManagementUI();
        }
        if (adminContactMethodsManagement) {
            adminContactMethodsManagement.style.display = 'block';
            renderContactMethodsAdmin();
        }
    } else {
        document.getElementById('settingsLogoutBtn').style.display = 'none';
        document.getElementById('settingsAdminLoginBtn').style.display = 'flex';
        document.getElementById('addProductBtn').style.display = 'none';
        if (adminCategoryManagement) adminCategoryManagement.style.display = 'none';
        if (adminContactMethodsManagement) adminContactMethodsManagement.style.display = 'none';
    }
}

export async function editProduct(productId) {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        ui.showNotification(state.t('product_not_found_error'), 'error');
        return;
    }
    const product = { id: productSnap.id, ...productSnap.data() };

    state.setEditingProductId(productId);
    formTitle.textContent = 'دەستکاری کردنی کاڵا';
    productForm.reset();

    // ... (rest of the editProduct logic from the original file)
    
    ui.openPopup('productFormModal', 'modal');
}


export async function deleteProduct(productId) {
    if (!confirm(state.t('delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "products", productId));
        ui.showNotification(state.t('product_deleted'), 'success');
        service.searchProductsInFirestore(state.currentSearch, true);
    } catch (error) {
        ui.showNotification(state.t('product_delete_error'), 'error');
    }
}

export function renderPromoCardsAdminList() {
    //... this function remains mostly the same, just call `ui.showNotification`
}

export function editPromoCard(card) {
    //... this function remains the same
}

export async function deletePromoCard(cardId) {
    //... this function remains the same, just call `ui.showNotification`
}

//... and all other admin-related functions like renderCategoryManagementUI, handleDeleteCategory, etc.