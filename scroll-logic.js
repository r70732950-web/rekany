// scroll-logic.js
// Ev pel ji bo mentiqê têkildarî scrollkirinê ye (infinite scroll û animasyon)

// Pêdivî ye ku state û searchProductsInFirestore ji app-logic werin import kirin
// Ji ber ku app-logic.js wek module hatiye danîn, divê ew van tiştan export bike
import { state, searchProductsInFirestore } from './app-logic.js';

/**
 * Fonksiyonek ji bo danîna IntersectionObserver ku dema bikarhêner digihîje dawiya lîsteyê,
 * bixweber berhemên zêdetir bar dike (infinite scroll).
 * @param {HTMLElement} triggerElement - Elementa HTML ku wekî trigger kar dike (mînak, divek li dawiya lîsteyê).
 */
function setupScrollObserver(triggerElement) {
    if (!triggerElement) {
        console.warn("Elementa trigger ji bo scroll observer nehat dîtin.");
        return;
    }

    const observerOptions = {
        root: null, // Li gorî viewport
        threshold: 0.1 // Dema 10% ji elementê xuya bibe
    };

    const observerCallback = (entries) => {
        if (entries[0].isIntersecting) {
            // Tenê heke barkirin ne di pêvajoyê de be û hemû berhem nehatibin barkirin
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                console.log("Triggera scrollê hat dîtin, berhemên zêdetir tên barkirin...");
                // Banga fonksiyona lêgerînê dike ji bo anîna rûpela din
                searchProductsInFirestore(state.currentSearch || '', false); // false nîşan dide ku ev ne lêgerîneke nû ye
            } else if (state.isLoadingMoreProducts) {
                console.log("Triggera scrollê hat dîtin, lê barkirin jixwe di pêvajoyê de ye.");
            } else if (state.allProductsLoaded) {
                console.log("Triggera scrollê hat dîtin, lê hemû berhem hatine barkirin.");
                 // Dibe ku li vir trigger were veşartin an observer were rawestandin
                 triggerElement.style.display = 'none'; // Veşartina triggerê
            }
        } else {
             // Ger trigger ji dîmenê derkeve û hemû berhem hatibin barkirin, piştrast bike ku veşartî ye
             if (state.allProductsLoaded) {
                 triggerElement.style.display = 'none';
             }
        }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    observer.observe(triggerElement);
    console.log("Scroll observer ji bo barkirina bêdawî hat saz kirin.");
}

/**
 * Fonksiyonek ji bo danîna IntersectionObserver ku animasyonên fade-in li ser kartên berheman
 * dema ku ew dikevin nav dîmenê, pêk tîne.
 */
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1 // Dema 10% ji kartê xuya bibe
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Piştî animasyonê, êdî neşopîne
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Li kartên ku hewceyê animasyonê ne û hêj xuya nebûne digere
    // Divê ev piştî renderkirina kartan were bang kirin
    const cardsToAnimate = document.querySelectorAll('.product-card-reveal:not(.visible)');
    cardsToAnimate.forEach(card => {
        observer.observe(card);
    });

    if(cardsToAnimate.length > 0) {
        console.log(`Scroll animation observer ji bo ${cardsToAnimate.length} kartan hat saz kirin.`);
    }
}

// Fonksiyonên ku divê ji derve werin bikaranîn export bike
export { setupScrollObserver, setupScrollAnimations };