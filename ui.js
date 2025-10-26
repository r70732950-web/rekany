// ui.js
// ئەم مۆدیولە فەنکشنەکانی تایبەت بە UI وەک پۆپئەپ، ئاگاداری، و گۆڕینی لاپەڕە بەڕێوەدەبات.

import { 
    sheetOverlay, 
    loginModal, 
    welcomeModal, 
    profileSheet,
    profileName,
    profileAddress,
    profilePhone,
    state, 
    translations 
} from './app-setup.js';
import { t } from './utils.js';

/**
 * ئاگادارییەک (notification) لەسەر شاشە پیشان دەدات
 * @param {string} message - ئەو پەیامەی پیشان دەدرێت
 * @param {string} [type='success'] - جۆری ئاگاداری ('success' یان 'error')
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // دوای ماوەیەکی کەم، کلاس 'show' زیاد دەکەین بۆ دەرکەوتنی ئەنیمەیشن
    setTimeout(() => notification.classList.add('show'), 10);
    // دوای 3 چرکە، ئاگادارییەکە لادەبەین
    setTimeout(() => {
        notification.classList.remove('show');
        // دوای تەواوبوونی ئەنیمەیشنی ونبوون، لە DOM لای دەبەین
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

/**
 * دوگمەی چالاک لە لیستی ناڤیگەیشنی خوارەوە نوێ دەکاتەوە
 * @param {string} activeBtnId - ئایدی ئەو دوگمەیەی کە دەبێت چالاک بێت
 */
export function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * شێوازی پیشاندانی هێدەر (Header) دەگۆڕێت لە نێوان لاپەڕەی سەرەکی و لاپەڕەکانی تر
 * @param {string} pageId - ئایدی ئەو لاپەڕەیەی کە چالاکە
 * @param {string} [title=''] - ناونیشانی لاپەڕە (بۆ لاپەڕە لاوەکییەکان)
 */
export function updateHeaderView(pageId, title = '') {
    const mainHeader = document.querySelector('.main-header-content');
    const subpageHeader = document.querySelector('.subpage-header-content');
    const headerTitle = document.getElementById('headerTitle');

    if (pageId === 'mainPage') {
        mainHeader.style.display = 'flex';
        subpageHeader.style.display = 'none';
    } else {
        mainHeader.style.display = 'none';
        subpageHeader.style.display = 'flex';
        headerTitle.textContent = title;
    }
}

/**
 * لاپەڕەیەکی دیاریکراو پیشان دەدات و ئەوانی تر دەشارێتەوە
 * @param {string} pageId - ئایدی ئەو لاپەڕەیەی کە دەبێت پیشان بدرێت
 * @param {string} [pageTitle=''] - ناونیشانی لاپەڕە (ئەگەر لاپەڕەی لاوەکی بێت)
 */
export function showPage(pageId, pageTitle = '') {
    // هەموو لاپەڕەکان دەشارینەوە یان پیشانیان دەدەین
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // ئەگەر لاپەڕەی سەرەکی نەبوو، سکڕۆڵ دەکەین بۆ سەرەوە
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }

    // هێدەر نوێ دەکەینەوە بەپێی لاپەڕە
    if (pageId === 'settingsPage') {
        updateHeaderView('settingsPage', t('settings_title'));
    } else if (pageId === 'subcategoryDetailPage') {
        updateHeaderView('subcategoryDetailPage', pageTitle);
    } else {
        updateHeaderView('mainPage');
    }

    // دوگمەی چالاکی ناڤیگەیشن دیاری دەکەین
    const activeBtnId = pageId === 'mainPage' ? 'homeBtn' : (pageId === 'settingsPage' ? 'settingsBtn' : null);
    if (activeBtnId) {
       updateActiveNav(activeBtnId);
    }
}

/**
 * هەموو پۆپئەپە کراوەکان (modal و bottom-sheet) دادەخات
 */
export function closeAllPopupsUI() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('show'));
    sheetOverlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
}

/**
 * پۆپئەپێکی دیاریکراو (modal یان sheet) دەکاتەوە
 * @param {string} id - ئایدی پۆپئەپ
 * @param {string} [type='sheet'] - جۆری پۆپئەپ ('sheet' یان 'modal')
 * @param {Object} [callbacks={}] - ئۆبجێکتی کۆڵباک، بۆ نموونە: { onOpen: () => renderCart() }
 */
export function openPopup(id, type = 'sheet', callbacks = {}) {
    const element = document.getElementById(id);
    if (!element) return;

    // پێش کردنەوەی پۆپئەپی نوێ، هەموو ئەوانی تر دادەخەین
    closeAllPopupsUI();

    if (type === 'sheet') {
        sheetOverlay.classList.add('show');
        element.classList.add('show');
    } else {
        element.style.display = 'block';
    }
    
    document.body.classList.add('overlay-active');
    
    // ستەیتێکی نوێ بۆ مێژووی وێبگەڕ (history) زیاد دەکەین تا بتوانین بە دوگمەی 'گەڕانەوە' دایبخەین
    history.pushState({ type: type, id: id }, '', `#${id}`);

    // کۆڵباکی onOpen جێبەجێ دەکەین (بۆ نموونە، بۆ ڕێندەرکردنی ناوەڕۆکی سەبەتە)
    if (callbacks.onOpen) {
        callbacks.onOpen();
    }

    // کۆدی تایبەت بۆ پۆپئەپی پڕۆفایل
    if (id === 'profileSheet') {
        profileName.value = state.userProfile.name || '';
        profileAddress.value = state.userProfile.address || '';
        profilePhone.value = state.userProfile.phone || '';
    }
}

/**
 * پۆپئەپی چالاک دادەخات (بە گەڕانەوە لە مێژووی وێبگەڕ)
 */
export function closeCurrentPopup() {
    // ئەگەر ستەیتی مێژووی وێبگەڕ پۆپئەپ بوو، ئەوا دەگەڕێینەوە دواوە
    if (history.state && (history.state.type === 'sheet' || history.state.type === 'modal')) {
        history.back();
    } else {
        // ئەگەر نا، بە شێوەی دەستی دای دەخەین (بۆ حاڵەتی نائاسایی)
        closeAllPopupsUI();
    }
}

/**
 * زمانی ئەپەکە دەگۆڕێت و UI نوێ دەکاتەوە
 * @param {string} lang - کورتکراوەی زمان (بۆ نموونە: 'ku_sorani')
 * @param {Object} renderCallbacks - فەنکشنەکانی ڕێندەرکردن کە پێویستە بانگ بکرێنەوە
 */
export function setLanguage(lang, renderCallbacks) {
    state.currentLanguage = lang;
    localStorage.setItem('language', lang);

    // ئاراستە و زمانی سەرەکی پەڕەکە دادەنێین
    document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'ku';
    document.documentElement.dir = 'rtl';

    // هەموو ئەو توخمانەی کە 'data-translate-key' یان هەیە، وەرگێڕانیان بۆ دەکەین
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            // بۆ توخمەکانی تر وەک <p>, <span>, <button>
            element.textContent = translation;
        }
    });

    // دوگمەی زمانی چالاک نوێ دەکەینەوە
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // بانگکردنی کۆڵباکەکان بۆ ڕێندەرکردنەوەی بەشە داینامیکەکان
    if (renderCallbacks.onRenderHome) {
        renderCallbacks.onRenderHome(); // بۆ ڕێندەرکردنەوەی لاپەڕەی سەرەکی
    }
    if (renderCallbacks.onRenderCategories) {
        renderCallbacks.onRenderCategories(); // بۆ ڕێندەرکردنەوەی لیستی جۆرەکان
    }
    if (renderCallbacks.onRenderCategoriesSheet) {
        renderCallbacks.onRenderCategoriesSheet(); // بۆ ڕێندەرکردنەوەی شیتی جۆرەکان
    }
    
    // ئەگەر پۆپئەپەکان کراوە بن، ناوەڕۆکیان نوێ دەکەینەوە
    if (document.getElementById('cartSheet').classList.contains('show') && renderCallbacks.onRenderCart) {
        renderCallbacks.onRenderCart();
    }
    if (document.getElementById('favoritesSheet').classList.contains('show') && renderCallbacks.onRenderFavorites) {
        renderCallbacks.onRenderFavorites();
    }
}

/**
 * بەکارهێنەر ناچار دەکات بە نوێکردنەوەی ئەپەکە لەڕێگەی سڕینەوەی کاش و سێرڤس وۆرکەر
 */
export async function forceUpdate() {
    if (confirm(t('update_confirm'))) {
        try {
            // سڕینەوەی سێرڤس وۆرکەرەکان
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('Service Workers unregistered.');
            }

            // سڕینەوەی کاشی وێبگەڕ
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(key => window.caches.delete(key)));
                console.log('All caches cleared.');
            }

            showNotification(t('update_success'), 'success');

            // دوای 1.5 چرکە، پەڕەکە ڕیلۆد دەکەینەوە
            setTimeout(() => {
                window.location.reload(true);
            }, 1500);

        } catch (error) {
            console.error('Error during force update:', error);
            showNotification(t('error_generic'), 'error');
        }
    }
}

/**
 * پەیامی بەخێرهاتن تەنها یەک جار (یەکەم جار) پیشان دەدات
 */
export function showWelcomeMessage() {
    if (!localStorage.getItem('hasVisited')) {
        // 'welcomeModal'-ەکە دەکەینەوە
        openPopup('welcomeModal', 'modal');
        localStorage.setItem('hasVisited', 'true');
    }
}

/**
 * فەنکشنی وەرگرتنی شوێنی جوگرافی (GPS) بۆ پڕۆفایل ئامادە دەکات
 */
export function setupGpsButton() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const profileAddressInput = document.getElementById('profileAddress');
    
    if (!getLocationBtn || !profileAddressInput) return;
    
    const btnSpan = getLocationBtn.querySelector('span');
    const originalBtnText = btnSpan.textContent;

    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            showNotification('وێبگەڕەکەت پشتگیری GPS ناکات', 'error');
            return;
        }

        btnSpan.textContent = '...چاوەڕوان بە';
        getLocationBtn.disabled = true;

        // داواکردنی شوێنی جوگرافی
        navigator.geolocation.getCurrentPosition(
            async (position) => { // Success Callback
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // بەکارهێنانی Nominatim API بۆ گۆڕینی کۆردینات بۆ ناونیشان
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ku,en`);
                    const data = await response.json();

                    if (data && data.display_name) {
                        profileAddressInput.value = data.display_name;
                        showNotification('ناونیشان وەرگیرا', 'success');
                    } else {
                        showNotification('نەتوانرا ناونیشان بدۆزرێتەوە', 'error');
                    }
                } catch (error) {
                    console.error('Reverse Geocoding Error:', error);
                    showNotification('هەڵەیەک لە وەرگرتنی ناونیشان ڕوویدا', 'error');
                } finally {
                    btnSpan.textContent = originalBtnText;
                    getLocationBtn.disabled = false;
                }
            },
            (error) => { // Error Callback
                let message = '';
                switch (error.code) {
                    case 1: message = 'ڕێگەت نەدا GPS بەکاربهێنرێت'; break;
                    case 2: message = 'شوێنەکەت نەدۆزرایەوە'; break;
                    case 3: message = 'کاتی داواکارییەکە تەواو بوو'; break;
                    default: message = 'هەڵەیەکی نادیار ڕوویدا'; break;
                }
                showNotification(message, 'error');
                btnSpan.textContent = originalBtnText;
                getLocationBtn.disabled = false;
            }
        );
    });
}
