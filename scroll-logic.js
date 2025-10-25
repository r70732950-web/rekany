// scroll-logic.js
// Ev pel ji bo mentiqê têkildarî scrollkirinê ye (guhertoya çareserkirî)

import { state } from './app-logic.js'; // Tenê state import bike

/**
 * Fonksiyonek ji bo danîna IntersectionObserver ku dema bikarhêner digihîje dawiya lîsteyê,
 * callback-a pêşkêşkirî bang dike.
 * @param {HTMLElement} triggerElement - Elementa HTML ku wekî trigger kar dike.
 * @param {function} loadMoreCallback - Fonksiyona ku dema pêdivî bi barkirina zêdetir hebe tê bang kirin.
 */
function setupScrollObserver(triggerElement, loadMoreCallback) { // Callback wek parameter hat zêdekirin
    if (!triggerElement) {
        console.warn("Elementa trigger ji bo scroll observer nehat dîtin.");
        return;
    }
    if (typeof loadMoreCallback !== 'function') {
         console.error("loadMoreCallback ne fonksiyonek e!");
         return;
    }

    const observerOptions = {
        root: null,
        threshold: 0.1
    };

    const observerCallback = (entries) => {
        // Piştrast be ku em hîn jî çavdêriyê dikin
        if (!entries[0].target.closest('body')) {
             console.log("Scroll trigger êdî ne di DOMê de ye, observer tê sekinandin.");
             observer.unobserve(entries[0].target);
             return;
        }

        if (entries[0].isIntersecting) {
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                console.log("Triggera scrollê hat dîtin, callbacka barkirina zêdetir tê bang kirin...");
                loadMoreCallback(); // Banga callbacka ku ji app-logic hatiye
            } else if (state.isLoadingMoreProducts) {
                console.log("Triggera scrollê hat dîtin, lê barkirin jixwe di pêvajoyê de ye.");
            } else if (state.allProductsLoaded) {
                console.log("Triggera scrollê hat dîtin, lê hemû berhem hatine barkirin.");
                 triggerElement.style.display = 'none'; // Veşartina triggerê dema hemû tişt hatin
                 observer.unobserve(triggerElement); // Rawestandina çavdêriyê dema hemû tişt hatin
            }
        }
        // Beşa 'else' ya berê hat rakirin ji ber ku dibe sedema veşartina triggerê zû
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    observer.observe(triggerElement);
    console.log("Scroll observer ji bo barkirina bêdawî hat saz kirin.");
}

// setupScrollAnimations wekî berê dimîne
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    };

    // Observerek nû çêbike her carê ku ev fonksiyon tê bang kirin
    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const cardsToAnimate = document.querySelectorAll('.product-card-reveal:not(.visible)');
    cardsToAnimate.forEach(card => {
        observer.observe(card);
    });

    if(cardsToAnimate.length > 0) {
        // Ji bo debugê: console.log(`Scroll animation observer ji bo ${cardsToAnimate.length} kartan hat saz kirin.`);
    }
}


export { setupScrollObserver, setupScrollAnimations };