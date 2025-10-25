// scroll-logic.js
// Ev pel ji bo mentiqê têkildarî scrollkirinê veqetandî ye

import { state, searchProductsInFirestore } from './app-setup.js'; // Import state and the main search function

let scrollObserver = null;
let animationObserver = null;

// Function to save current scroll position in history state
export function saveScrollPosition() {
    const currentState = history.state;
    // Tenê pozîsyona scrollê ji bo rewşa parzûna rûpela serekî tomar bike
    if (document.getElementById('mainPage')?.classList.contains('page-active') && currentState && !currentState.type) {
        try {
            history.replaceState({ ...currentState, scroll: window.scrollY }, '');
        } catch (e) {
            // Ger 'currentState' ne klonkirî be (wekî hin tiştên DOM), vê xeletiyê bigire
            console.warn("Could not clone history state:", e);
            // Biceribîne ku bêyî klonkirina tam tomar bike (dibe ku ne ew qas pêbawer be)
            const simpleState = {
                category: currentState.category,
                subcategory: currentState.subcategory,
                subSubcategory: currentState.subSubcategory,
                search: currentState.search,
                scroll: window.scrollY
            };
            history.replaceState(simpleState, '');
        }
    }
}


// Function to restore scroll position based on history state
export function restoreScrollPosition(scrollPosition) {
    if (typeof scrollPosition === 'number') {
        // Dema ku ji popstate vedigere piçek derengiyê bikar bîne
        setTimeout(() => window.scrollTo(0, scrollPosition), 50);
    }
}

// Function to scroll to the top of the page
export function scrollToTop(behavior = 'auto') { // 'auto' or 'smooth'
    window.scrollTo({ top: 0, behavior: behavior });
}

// Function to set up the Intersection Observer for infinite scrolling
function setupScrollObserverInternal() {
    const trigger = document.getElementById('scroll-loader-trigger');
    if (!trigger) return;

    // Disconnect previous observer if exists
    if (scrollObserver) {
        scrollObserver.disconnect();
    }

    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            // Tenê bêtir bar bike ger niha bar nake û hemî berhem nehatine barkirin
            if (!state.isLoadingMoreProducts && !state.allProductsLoaded) {
                 // Call the main search function passed from app-logic.js
                 // to fetch the next page. The 'false' indicates it's not a new search.
                searchProductsInFirestore(state.currentSearch, false);
            }
        }
    }, {
        root: null, // relative to document viewport
        threshold: 0.1 // trigger when 10% of the element is visible
    });

    scrollObserver.observe(trigger);
}

// Function to set up Intersection Observer for scroll animations
function setupScrollAnimationsInternal() {
     // Disconnect previous observer if exists
    if (animationObserver) {
        animationObserver.disconnect();
    }

    animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                animationObserver.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Observe newly added elements after rendering
    document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
        animationObserver.observe(card);
    });
}

// Main initialization function for scroll features
export function initializeScrollFeatures() {
    setupScrollObserverInternal();
    // Call animation setup initially, it will re-observe elements after each render
    setupScrollAnimationsInternal();
}

// Export a function to re-run animations setup after rendering new products
export function observeProductCardAnimations() {
    if (!animationObserver) {
        // Initialize if it hasn't been set up yet (e.g., first load)
        setupScrollAnimationsInternal();
    } else {
        // Observe only the new cards that haven't been animated
        document.querySelectorAll('.product-card-reveal:not(.visible)').forEach(card => {
            animationObserver.observe(card);
        });
    }
}
