// BEŞA NÛ: scroll-logic.js
// Ev pel hemû mentiqê (logic) پەیوەست بە scroll-kirinê vedihewîne.

// Elementa ku barkirina bêtir (infinite scroll) dest pê dike
let infiniteScrollTriggerElement;

/**
 * Pozîsyona scroll-a paceyê ya heyî di state-a history-yê de tomar dike.
 * Tenê heke li ser rûpela serekî be û ne di popupekê de be tomar dike.
 * (Ji bo 'openPopup' tê bikaranîn)
 */
export function saveCurrentScrollPositionForPopup() {
    const currentState = history.state;
    // Tenê pozîsyona scroll-ê ji bo state-a filter-a rûpela serekî tomar bike
    if (document.getElementById('mainPage').classList.contains('page-active') && currentState && !currentState.type) {
        history.replaceState({ ...currentState, scroll: window.scrollY }, '');
    }
}

/**
 * Pozîsyona scroll-a paceyê ya heyî di state-a history-yê de tomar dike.
 * Ev yek bê şert û merc e û ji bo guhertinên filter-ê tê bikaranîn.
 * (Ji bo 'navigateToFilter' tê bikaranîn)
 */
export function replaceCurrentScrollInHistory() {
     const currentState = history.state || {};
     history.replaceState({ ...currentState, scroll: window.scrollY }, '');
}


/**
 * IntersectionObserver-ê saz dike da ku kartên hilberan (product cards)
 * dema ku têne dîtin bi anîmasyonê nîşan bide.
 */
export function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    // Piştî ku renderProducts() bang dike, dibe ku ev hewce bike ku ji nû ve were bang kirin
    // an jî li ser elementên nû were sepandin.
    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}

/**
 * Çavdêrê (observer) scroll-a bêsînor (infinite scroll) saz dike.
 * @param {string} triggerElementId - ID-a elementa ku barkirinê dest pê dike.
 * @param {Function} callback - Fonksiyona ku dema element hate dîtin tê bang kirin.
 */
export function initializeInfiniteScroll(triggerElementId, callback) {
    infiniteScrollTriggerElement = document.getElementById(triggerElementId);
    if (!infiniteScrollTriggerElement) {
        console.warn(`Elementa destpêker a scroll-a bêsînor nehate dîtin: #${triggerElementId}`);
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            callback();
        }
    }, {
        root: null, // Li gorî viewport-a belgeyê
        threshold: 0.1 // Dema 10% ji elementê xuya bû dest pê bike
    });

    observer.observe(infiniteScrollTriggerElement);
}

/**
 * Elementa destpêker a scroll-a bêsînor li gorî rewşa barkirinê nîşan dide an vedişêre.
 * @param {boolean} allProductsLoaded - Gelo hemû hilber hatine barkirin an na.
 */
export function updateInfiniteScrollTrigger(allProductsLoaded) {
    if (infiniteScrollTriggerElement) {
        infiniteScrollTriggerElement.style.display = allProductsLoaded ? 'none' : 'block';
    }
}

/**
 * Paceyê (window) dişîne jor (scroll to top) heke ne rûpela serekî be.
 * @param {string} pageId - ID-a rûpela ku tê nîşandan.
 */
export function resetScrollOnPageChange(pageId) {
    if (pageId !== 'mainPage') {
        window.scrollTo(0, 0);
    }
}

/**
 * Elementek taybet a sheet-ê (mîna hûrguliyên hilberê) dişîne jor.
 * @param {HTMLElement} sheetContentElement - Konteynara naveroka sheet-ê.
 */
export function resetSheetScroll(sheetContentElement) {
    if (sheetContentElement) {
        sheetContentElement.scrollTop = 0;
    }
}

/**
 * Pozîsyona scroll-a paceyê vedigerîne, bi gelemperî ji state-a history-yê.
 * @param {number} scrollValue - Nirxa pozîsyona Y-scroll-ê ya ji bo vegerandinê.
 */
export function restoreScrollPosition(scrollValue) {
    if (typeof scrollValue === 'number') {
        setTimeout(() => window.scrollTo(0, scrollValue), 50);
    }
}
