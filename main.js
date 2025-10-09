// main.js
import { initializeAppLogic } from './app.js';
import { setupAllEventListeners, handleInitialPageLoad, showWelcomeMessage, setupGpsButton } from './ui.js';

// This function will run when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize all the Firebase and data logic from app.js
    initializeAppLogic();

    // 2. Set up all the button clicks and UI interactions from ui.js
    setupAllEventListeners();

    // 3. Handle initial page state like URL hashes
    handleInitialPageLoad();

    // 4. Show welcome message on first visit
    showWelcomeMessage();

    // 5. Setup GPS button functionality
    setupGpsButton();
});