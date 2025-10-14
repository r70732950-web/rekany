// app_events.js

// بەشی یەکەم: هاوردەکردنی گۆڕاو و فەنکشنە سەرەتاییەکان لە app_config.js
import {
    productsCollection, announcementsCollection, promoCardsCollection, dbRef, authRef, messagingRef,
    categories, currentLanguage, currentSearch, products, isAdmin, editingProductId, t,
    debounce, showNotification, saveCart, setLanguage, closeAllPopupsUI,
    populateCategoryDropdown, sheetOverlay, deferredPrompt, PROFILE_KEY, userProfile,
    mainPage, settingsPage, homeBtn, settingsBtn, cartBtn, categoriesBtn, profileBtn,
    settingsFavoritesBtn, settingsAdminLoginBtn, addProductBtn, settingsLogoutBtn,
    loginForm, productForm, productCategorySelect, productSubcategorySelect, formTitle,
    imageInputsContainer, searchInput, clearSearchBtn, subcategorySelectContainer,
    subSubcategorySelectContainer, contactToggle, adminSocialMediaManagement,
    socialMediaToggle, profileForm, addSocialMediaForm, socialLinksListContainer,
    notificationBtn, notificationBadge, notificationsSheet, notificationsListContainer,
    adminAnnouncementManagement, announcementForm, termsAndPoliciesBtn, termsSheet,
    termsContentContainer, adminPoliciesManagement, policiesForm,
    addCategoryForm, addSubcategoryForm, addSubSubcategoryForm, editCategoryForm,
    addContactMethodForm,
    handleInitialPageLoad, showPage, updateActiveNav
} from './app_config.js';

// بەشی دووەم: هاوردەکردنی فەنکشنە لۆجیکییەکان لە app_product_logic.js
import {
    deleteProduct, addToCart, renderCartActionButtons, deleteContactMethod,
    deleteSocialMediaLink, renderPolicies, showWelcomeMessage, setupGpsButton,
    setupScrollObserver, openEditCategoryModal, handleDeleteCategory,
    populateSubcategoriesDropdown, populateSubSubcategoriesDropdown,
    renderCart, populateParentCategorySelect, renderContactMethodsAdmin, loadPoliciesForAdmin,
    renderPromoCardsAdminList, renderCategoryManagementUI, editProduct,
    createProductImageInputs, updateAdminUI, searchProductsInFirestore,
    renderMainCategories, renderSubcategories, forceUpdate, requestNotificationPermission
} from './app_product_logic.js';

import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDocs, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, collection, where, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { onMessage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";


export function checkNewAnnouncements() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const latestAnnouncement = snapshot.docs[0].data();
            const lastSeenTimestamp = localStorage.getItem('lastSeenAnnouncementTimestamp') || 0;

            if (latestAnnouncement.createdAt > lastSeenTimestamp) {
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    });
}

export async function renderUserNotifications() {
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    notificationsListContainer.innerHTML = '';
    if (snapshot.empty) {
        notificationsListContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-bell-slash"></i><p>${t('no_notifications_found')}</p></div>`;
        return;
    }

    let latestTimestamp = 0;
    snapshot.forEach(doc => {
        const announcement = doc.data();
        if (announcement.createdAt > latestTimestamp) {
            latestTimestamp = announcement.createdAt;
        }

        const date = new Date(announcement.createdAt);
        const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        const title = (announcement.title && announcement.title[currentLanguage]) || (announcement.title && announcement.title.ku_sorani) || '';
        const content = (announcement.content && announcement.content[currentLanguage]) || (announcement.content && announcement.content.ku_sorani) || '';

        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${title}</span>
                <span class="notification-date">${formattedDate}</span>
            </div>
            <p class="notification-content">${content}</p>
        `;
        notificationsListContainer.appendChild(item);
    });

    localStorage.setItem('lastSeenAnnouncementTimestamp', latestTimestamp);
    notificationBadge.style.display = 'none';
}

export async function deleteAnnouncement(id) {
    if (confirm(t('announcement_delete_confirm'))) {
        try {
            await deleteDoc(doc(dbRef, "announcements", id));
            showNotification(t('announcement_deleted_success'), 'success');
        } catch (e) {
            showNotification(t('error_generic'), 'error');
        }
    }
}

export function renderAdminAnnouncementsList() {
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
            item.querySelector('.delete-btn').addEventListener('click', () => deleteAnnouncement(announcement.id));
            container.appendChild(item);
        });
    });
}

export function renderSocialMediaLinks() {
    const socialLinksCollection = collection(dbRef, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        socialLinksListContainer.innerHTML = '';
        if (snapshot.empty) {
            socialLinksListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">هیچ لینکێک زیاد نەکراوە.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const link = { id: doc.id, ...doc.data() };
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

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

            item.querySelector('.delete-btn').onclick = () => deleteSocialMediaLink(link.id);
            socialLinksListContainer.appendChild(item);
        });
    });
}

export function renderContactLinks() {
    const contactLinksContainer = document.getElementById('dynamicContactLinksContainer');
    const socialLinksCollection = collection(dbRef, 'settings', 'contactInfo', 'socialLinks');
    const q = query(socialLinksCollection, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        contactLinksContainer.innerHTML = '';

        if (snapshot.empty) {
            contactLinksContainer.innerHTML = '<p style="padding: 15px; text-align: center;">هیچ لینکی پەیوەندی نییە.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const link = doc.data();
            const name = link['name_' + currentLanguage] || link.name_ku_sorani;

            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.target = '_blank';
            linkElement.className = 'settings-item';

            linkElement.innerHTML = `
                <div>
                    <i class="${link.icon}" style="margin-left: 10px;"></i>
                    <span>${name}</span>
                </div>
                <i class="fas fa-external-link-alt"></i>
            `;

            contactLinksContainer.appendChild(linkElement);
        });
    });
}


export function setupEventListeners() {
    homeBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'mainPage' }, '', window.location.pathname);
        showPage('mainPage');
    };

    settingsBtn.onclick = () => {
        history.pushState({ type: 'page', id: 'settingsPage' }, '', '#settingsPage');
        showPage('settingsPage');
    };

    profileBtn.onclick = () => {
        openPopup('profileSheet');
        updateActiveNav('profileBtn');
    };

    cartBtn.onclick = () => {
        openPopup('cartSheet');
        updateActiveNav('cartBtn');
    };

    categoriesBtn.onclick = () => {
        openPopup('categoriesSheet');
        updateActiveNav('categoriesBtn');
    };

    settingsFavoritesBtn.onclick = () => {
        openPopup('favoritesSheet');
    };

    settingsAdminLoginBtn.onclick = () => {
        openPopup('loginModal', 'modal');
    };

    addProductBtn.onclick = () => {
        editingProductId = null;
        productForm.reset();
        createProductImageInputs();
        subcategorySelectContainer.style.display = 'none';
        subSubcategorySelectContainer.style.display = 'none';
        formTitle.textContent = 'زیادکردنی کاڵای نوێ';
        productForm.querySelector('button[type="submit"]').textContent = 'پاشەکەوتکردن';
        openPopup('productFormModal', 'modal');
    };
    settingsLogoutBtn.onclick = async () => {
        await signOut(authRef);
    };

    sheetOverlay.onclick = () => closeCurrentPopup();
    document.querySelectorAll('.close').forEach(btn => btn.onclick = closeCurrentPopup);
    window.onclick = (e) => { if (e.target.classList.contains('modal')) closeCurrentPopup(); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(authRef, document.getElementById('email').value, document.getElementById('password').value);
        } catch (error) {
            showNotification(t('login_error'), 'error');
        }
    };

    productCategorySelect.addEventListener('change', (e) => {
        populateSubcategoriesDropdown(e.target.value);
        populateSubSubcategoriesDropdown(null, null);
    });

    productSubcategorySelect.addEventListener('change', (e) => {
        const mainCatId = document.getElementById('productCategoryId').value;
        populateSubSubcategoriesDropdown(mainCatId, e.target.value);
    });

    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '...چاوەڕێ بە';
        const imageUrls = Array.from(document.querySelectorAll('.productImageUrl')).map(input => input.value.trim()).filter(url => url !== '');
        if (imageUrls.length === 0) {
            showNotification('پێویستە بەلایەنی کەمەوە لینکی یەک وێنە دابنێیت', 'error');
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
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
            if (editingProductId) {
                const { createdAt, ...updateData } = productData;
                await updateDoc(doc(dbRef, "products", editingProductId), updateData);
                showNotification('کاڵا نوێکرایەوە', 'success');
            } else {
                await addDoc(productsCollection, productData);
                showNotification('کاڵا زیادکرا', 'success');
            }
            closeCurrentPopup();
            searchProductsInFirestore(currentSearch, true); 
        } catch (error) {
            showNotification(t('error_generic'), 'error');
            console.error("Error saving product:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingProductId ? 'نوێکردنەوە' : 'پاشەکەوتکردن';
            editingProductId = null;
        }
    };

    imageInputsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('productImageUrl')) {
            const previewImg = e.target.nextElementSibling;
            const url = e.target.value;
            if (url) { previewImg.src = url; }
            else {
                const index = Array.from(e.target.parentElement.parentElement.children).indexOf(e.target.parentElement);
                previewImg.src = `https://placehold.co/40x40/e2e8f0/2d3748?text=${index + 1}`;
            }
        }
    });
    
    const debouncedSearch = debounce((term) => {
        searchProductsInFirestore(term, true);
    }, 500);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value;
        currentSearch = searchTerm;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        debouncedSearch(searchTerm);
    };

    clearSearchBtn.onclick = () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        searchProductsInFirestore('', true);
    };


    contactToggle.onclick = () => {
        const container = document.getElementById('dynamicContactLinksContainer');
        const chevron = contactToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    socialMediaToggle.onclick = () => {
        const container = adminSocialMediaManagement.querySelector('.contact-links-container');
        const chevron = socialMediaToggle.querySelector('.contact-chevron');
        container.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    profileForm.onsubmit = (e) => {
        e.preventDefault();
        userProfile = {
            name: document.getElementById('profileName').value,
            address: document.getElementById('profileAddress').value,
            phone: document.getElementById('profilePhone').value,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        showNotification(t('profile_saved'), 'success');
        closeCurrentPopup();
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            setLanguage(btn.dataset.lang);
        };
    });

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                installBtn.style.display = 'none';
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
            }
        });
    }

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
                await addDoc(collection(dbRef, "categories"), categoryData);
                showNotification('جۆری سەرەکی بە سەرکەوتوویی زیادکرا', 'success');
                addCategoryForm.reset();
            } catch (error) {
                console.error("Error adding main category: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی جۆری سەرەکی';
            }
        });
    }

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
                order: parseInt(document.getElementById('subcategoryOrder').value) || 0
            };

            try {
                const subcategoriesCollectionRef = collection(dbRef, "categories", parentCategoryId, "subcategories");
                await addDoc(subcategoriesCollectionRef, subcategoryData);
                showNotification('جۆری لاوەکی بە سەرکەوتوویی زیادکرا', 'success');
                addSubcategoryForm.reset();
            } catch (error) {
                console.error("Error adding subcategory: ", error);
                showNotification(t('error_generic'), 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی جۆری لاوەکی';
            }
        });
    }
    
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
                createdAt: Date.now()
            };

            try {
                const subSubcategoriesRef = collection(dbRef, "categories", mainCatId, "subcategories", subCatId, "subSubcategories");
                await addDoc(subSubcategoriesRef, subSubcategoryData);
                showNotification('جۆری نوێ بە سەرکەوتوویی زیادکرا', 'success');
                addSubSubcategoryForm.reset();
                mainCatSelect.value = '';
                subCatSelect.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
            } catch (error) {
                console.error("Error adding sub-subcategory: ", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            }
        });
    }
    
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
            
            try {
                await updateDoc(doc(dbRef, docPath), updateData);
                showNotification('گۆڕانکارییەکان پاشەکەوت کران', 'success');
                closeCurrentPopup();
            } catch (error) {
                console.error("Error updating category: ", error);
                showNotification('هەڵەیەک ڕوویدا', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'پاشەکەوتکردنی گۆڕانکاری';
            }
        });
    }

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
                const methodsCollection = collection(dbRef, 'settings', 'contactInfo', 'contactMethods');
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

    notificationBtn.addEventListener('click', () => {
        openPopup('notificationsSheet');
    });

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

    if (termsAndPoliciesBtn) {
        termsAndPoliciesBtn.addEventListener('click', () => {
            openPopup('termsSheet');
        });
    }

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
                const docRef = doc(dbRef, "settings", "policies");
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
                    await setDoc(doc(dbRef, "promo_cards", editingId), cardData);
                    showNotification('کارتەکە نوێکرایەوە', 'success');
                } else {
                    await addDoc(collection(dbRef, "promo_cards"), cardData);
                    showNotification('کارتی نوێ زیادکرا', 'success');
                }
                addPromoCardForm.reset();
                document.getElementById('editingPromoCardId').value = '';
                submitButton.textContent = 'پاشەکەوتکردن';
            } catch (error) {
                showNotification('هەڵەیەک ڕوویدا', 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }
    
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    if(forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }

    onMessage(messagingRef, (payload) => {
        console.log('Foreground message received: ', payload);
        const title = payload.notification.title;
        const body = payload.notification.body;
        showNotification(`${title}: ${body}`, 'success');
    });
}

onAuthStateChanged(authRef, async (user) => {
    const adminUID = "xNjDmjYkTxOjEKURGP879wvgpcG3";
    let currentIsAdmin = false;

    if (user && user.uid === adminUID) {
        currentIsAdmin = true;
        sessionStorage.setItem('isAdmin', 'true');
        loadPoliciesForAdmin();

        if (document.getElementById('loginModal').style.display === 'block') {
            closeCurrentPopup();
        }
    } else {
        currentIsAdmin = false;
        sessionStorage.removeItem('isAdmin');
        if (user) {
            await signOut(authRef);
        }
    }
    
    // This is a workaround since direct mutation of `isAdmin` isn't ideal across modules.
    // The `updateAdminUI` function will handle UI changes based on this outcome.
    updateAdminUI(currentIsAdmin); 
    searchProductsInFirestore(currentSearch, true);
});


export function init() {
    enableIndexedDbPersistence(dbRef)
        .then(() => {
            console.log("Firestore offline persistence enabled successfully.");
            initializeAppLogic();
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore Persistence failed: Multiple tabs open.');
            } else if (err.code == 'unimplemented') {
                console.warn('Firestore Persistence failed: Browser not supported.');
            }
            console.error("Error enabling persistence, running online mode only:", err);
            initializeAppLogic();
        });
}

export function initializeAppLogic() {
    const categoriesQuery = query(collection(dbRef, "categories"), orderBy("order", "asc"));
    onSnapshot(categoriesQuery, (snapshot) => {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories.splice(0, categories.length, { id: 'all', name_ku_sorani: t('all_categories_label'), icon: 'fas fa-th' }, ...fetchedCategories);
        
        populateCategoryDropdown();
        renderMainCategories();
        
        if (sessionStorage.getItem('isAdmin') === 'true') {
            populateParentCategorySelect();
            renderCategoryManagementUI();
            
            const mainCatSelectForSubSub = document.getElementById('parentMainCategorySelectForSubSub');
            const subCatSelectForSubSub = document.getElementById('parentSubcategorySelectForSubSub');
            
            if (mainCatSelectForSubSub && subCatSelectForSubSub) {
                mainCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆرێک هەڵبژێرە --</option>';
                const categoriesWithoutAll = categories.filter(cat => cat.id !== 'all');
                categoriesWithoutAll.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name_ku_sorani || cat.name_ku_badini;
                    mainCatSelectForSubSub.appendChild(option);
                });

                if (!mainCatSelectForSubSub.listenerAttached) {
                    mainCatSelectForSubSub.addEventListener('change', async () => {
                        const mainCategoryId = mainCatSelectForSubSub.value;
                        if (!mainCategoryId) {
                             subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- چاوەڕێی هەڵبژاردنی جۆری سەرەکی بە --</option>';
                             return;
                        };
                        
                        subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>...خەریکی بارکردنە</option>';
                        subCatSelectForSubSub.disabled = true;

                        const subcategoriesQuery = collection(dbRef, "categories", mainCategoryId, "subcategories");
                        const q = query(subcategoriesQuery, orderBy("order", "asc"));
                        const querySnapshot = await getDocs(q);
                        
                        subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>-- جۆری لاوەکی هەڵبژێرە --</option>';
                        if (!querySnapshot.empty) {
                            querySnapshot.forEach(doc => {
                                const subcat = { id: doc.id, ...doc.data() };
                                const option = document.createElement('option');
                                option.value = subcat.id;
                                option.textContent = subcat.name_ku_sorani || subcat.name_ku_badini || 'بێ ناو';
                                subCatSelectForSubSub.appendChild(option);
                            });
                        } else {
                            subCatSelectForSubSub.innerHTML = '<option value="" disabled selected>هیچ جۆرێکی لاوەکی نییە</option>';
                        }
                        subCatSelectForSubSub.disabled = false;
                    });
                    mainCatSelectForSubSub.listenerAttached = true;
                }
            }
        }

        setLanguage(currentLanguage);
    });

    searchProductsInFirestore('', true);

    const contactInfoRef = doc(dbRef, "settings", "contactInfo");
    onSnapshot(contactInfoRef, (docSnap) => {
        if (docSnap.exists()) {
            // contactInfo = docSnap.data(); // This needs to be a mutable export
            // updateContactLinksUI();
        } else {
            console.log("No contact info document found!");
        }
    });

    setupEventListeners();
    setupScrollObserver();
    setLanguage(currentLanguage);
    renderSocialMediaLinks();
    renderContactLinks();
    checkNewAnnouncements();
    showWelcomeMessage();
    setupGpsButton();
    handleInitialPageLoad();
}


document.addEventListener('DOMContentLoaded', init);

window.addEventListener('popstate', (event) => {
    closeAllPopupsUI();
    const state = event.state;
    if (state) {
        if (state.type === 'page') {
            showPage(state.id);
        } else if (state.type === 'sheet' || state.type === 'modal') {
            openPopup(state.id, state.type);
        }
    } else {
        showPage('mainPage');
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
});

if ('serviceWorker' in navigator) {
    const updateNotification = document.getElementById('update-notification');
    const updateNowBtn = document.getElementById('update-now-btn');

    navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('Service Worker registered successfully.');

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found!', newWorker);

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    updateNotification.classList.add('show');
                }
            });
        });

        updateNowBtn.addEventListener('click', () => {
            registration.waiting.postMessage({ action: 'skipWaiting' });
        });

    }).catch(err => {
        console.log('Service Worker registration failed: ', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload();
    });
}