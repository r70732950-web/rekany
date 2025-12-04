// products.js
import { 
    state, 
    t, 
    fetchProductById, 
    fetchRelatedProducts, 
    formatDescription, 
    isFavorite, 
    toggleFavoriteCore, 
    saveCurrentScrollPositionCore 
} from './app-core.js';

import { handleAddToCartUI } from './cart.js';
import { showNotification, showPage } from './app-ui.js'; 

// --- Helper: دەرهێنانی ئایدی یوتوب ---
function parseYouTubeId(url) {
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.searchParams.has('v')) {
                return urlObj.searchParams.get('v');
            }
            if (urlObj.pathname.startsWith('/shorts/')) {
                return urlObj.pathname.split('/')[2];
            }
            if (urlObj.pathname.startsWith('/embed/')) {
                return urlObj.pathname.split('/')[2];
            }
        } 
        else if (urlObj.hostname.includes('youtu.be')) {
            return urlObj.pathname.slice(1);
        }
    } catch (e) {
        return null;
    }
    return null;
}

// --- دروستکردنی کارتی کاڵا ---
export function createProductCardElementUI(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    
    // === NEW: Add class if out of stock ===
    if (product.isOutOfStock) {
        productCard.classList.add('out-of-stock');
    }
    // ======================================

    productCard.dataset.productId = product.id;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    const nameInCurrentLang = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';
    const mainImage = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : (product.image || 'https://placehold.co/300x300/e2e8f0/2d3748?text=No+Image');

    // نرخ و داشکان
    let priceHTML = `<div class="product-price-container"><div class="product-price">${product.price.toLocaleString()} د.ع.</div></div>`;
    let discountBadgeHTML = '';
    if (product.originalPrice && product.originalPrice > product.price) {
        priceHTML = `<div class="product-price-container"><span class="product-price">${product.price.toLocaleString()} د.ع.</span><del class="original-price">${product.originalPrice.toLocaleString()} د.ع.</del></div>`;
        const discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        discountBadgeHTML = `<div class="discount-badge">-%${discountPercentage}</div>`;
    }

    // زانیاری گەیاندن
    let extraInfoHTML = '';
    const shippingText = product.shippingInfo && product.shippingInfo[state.currentLanguage] && product.shippingInfo[state.currentLanguage].trim();
    if (shippingText) {
        extraInfoHTML = `
            <div class="product-extra-info">
                <div class="info-badge shipping-badge">
                    <i class="fas fa-truck"></i>${shippingText}
                </div>
            </div>
        `;
    }

    // دڵخوازەکان
    const isProdFavorite = isFavorite(product.id); 
    const heartIconClass = isProdFavorite ? 'fas' : 'far';
    const favoriteBtnClass = isProdFavorite ? 'favorite-btn favorited' : 'favorite-btn';

    // === NEW: Out Of Stock UI Logic ===
    let outOfStockHTML = '';
    let addToCartDisabled = '';
    
    if (product.isOutOfStock) {
        outOfStockHTML = `<div class="out-of-stock-badge">نەماوە 🚫</div>`;
        addToCartDisabled = 'disabled';
    }
    // =================================

    productCard.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" alt="${nameInCurrentLang}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/e2e8f0/2d3748?text=وێنە+نییە';">
            ${discountBadgeHTML}
            ${outOfStockHTML} <button class="${favoriteBtnClass}" aria-label="Add to favorites">
                <i class="${heartIconClass} fa-heart"></i>
            </button>
             <button class="share-btn-card" aria-label="Share product">
                 <i class="fas fa-share-alt"></i>
            </button>
        </div>
        <div class="product-info">
            <div class="product-name">${nameInCurrentLang}</div>
            ${priceHTML}
            <button class="add-to-cart-btn-card" ${addToCartDisabled}> <i class="fas fa-cart-plus"></i>
                <span>${t('add_to_cart')}</span>
            </button>
            ${extraInfoHTML}
        </div>
        <div class="product-actions" style="display: ${isAdmin ? 'flex' : 'none'};">
            <button class="edit-btn" aria-label="Edit product"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" aria-label="Delete product"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Event Listeners
    setupProductCardListeners(productCard, product, nameInCurrentLang, isAdmin);

    return productCard;
}

function setupProductCardListeners(card, product, name, isAdmin) {
    // دوگمەی شەیرکردن
    card.querySelector('.share-btn-card').addEventListener('click', async (event) => {
        event.stopPropagation();
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        if (navigator.share) {
            await navigator.share({ title: name, text: `${t('share_text')}: ${name}`, url: productUrl });
        } else {
            navigator.clipboard.writeText(productUrl);
            showNotification('لينكى کاڵا کۆپى کرا!', 'success');
        }
    });

    // دوگمەی دڵخواز
    card.querySelector('.favorite-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        handleToggleFavoriteUI(product.id);
    });

    // دوگمەی سەبەتە
    const cartBtn = card.querySelector('.add-to-cart-btn-card');
    if (!product.isOutOfStock) { // Only add listener if stock exists
        cartBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            handleAddToCartUI(product.id, event.currentTarget); 
        });
    }

    // کردنەوەی وردەکاری
    card.addEventListener('click', (event) => {
        if (!event.target.closest('button')) {
            saveCurrentScrollPositionCore(); 
            showProductDetailsUI(product);
        }
    });

    // دوگمەکانی ئەدمین
    if (isAdmin) {
        card.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); window.AdminLogic?.editProduct(product.id); });
        card.querySelector('.delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); window.AdminLogic?.deleteProduct(product.id); });
    }
}

// --- پەڕەی وردەکاری (Details Page) ---
export async function showProductDetailsUI(productData, fromHistory = false) {
    const product = productData || await fetchProductById(state.currentProductId); 
    if (!product) { showNotification(t('product_not_found_error'), 'error'); return; }

    state.currentProductId = product.id; 
    const productName = (product.name && product.name[state.currentLanguage]) || (product.name && product.name.ku_sorani) || 'کاڵای بێ ناو';

    // History Management
    if (!fromHistory) {
        saveCurrentScrollPositionCore();
        const newUrl = `?product=${product.id}`;
        history.pushState({ type: 'page', id: 'productDetailPage', title: productName, productId: product.id }, '', newUrl);
    } else {
        if (!history.state || history.state.id !== 'productDetailPage') {
            const newUrl = `?product=${product.id}`;
            history.replaceState({ type: 'page', id: 'productDetailPage', title: productName, productId: product.id }, '', newUrl);
        }
    }
    
    showPage('productDetailPage', productName);

    const baseProduct = {
        name: productName,
        description: (product.description && product.description[state.currentLanguage]) || (product.description && product.description['ku_sorani']) || '',
        basePrice: product.price,
        originalPrice: product.originalPrice || null,
        baseImages: (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls : (product.image ? [product.image] : []),
        videoLink: product.externalLink || null
    };
    
    document.getElementById('detailProductDescription').innerHTML = formatDescription(baseProduct.description); 
    
    // Variations Logic
    setupVariationsUI(product, baseProduct);

    // [NEW] Market Code Display
    const priceContainer = document.getElementById('detailProductPrice');
    // لابردنی کۆدی کۆن ئەگەر هەبێت
    const oldBadge = priceContainer.querySelector('.market-code-badge');
    if(oldBadge) oldBadge.remove();

    if (product.marketCode) {
        const marketBadge = document.createElement('div');
        marketBadge.className = 'market-code-badge';
        marketBadge.style.marginTop = '12px';
        marketBadge.style.marginBottom = '5px';
        marketBadge.style.textAlign = 'center';
        marketBadge.innerHTML = `
            <span style="background-color: #f8f9fa; padding: 6px 12px; border-radius: 8px; font-size: 13px; color: var(--text-light); border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fas fa-store-alt" style="color: var(--primary-color);"></i> 
                مارکێت: <b style="color: var(--text-color);">${product.marketCode}</b>
            </span>
        `;
        priceContainer.appendChild(marketBadge);
    }

    // Render Specifications
    renderSpecificationsUI(product);

    renderRelatedProductsUI(product);
}

function renderSpecificationsUI(product) {
    // لابردنی خشتەی کۆن ئەگەر هەبێت
    const existingTable = document.querySelector('.product-specs-table');
    if (existingTable) existingTable.remove();

    if (!product.specifications || product.specifications.length === 0) return;

    const descriptionEl = document.getElementById('detailProductDescription');
    const table = document.createElement('table');
    table.className = 'product-specs-table';
    
    let rowsHTML = '';
    product.specifications.forEach(spec => {
        const label = (spec.label && spec.label[state.currentLanguage]) || spec.label.ku_sorani || '';
        const value = (spec.value && spec.value[state.currentLanguage]) || spec.value.ku_sorani || '';
        
        if (label && value) {
            rowsHTML += `
                <tr>
                    <td class="spec-label-cell">${label}</td>
                    <td class="spec-value-cell">${value}</td>
                </tr>
            `;
        }
    });

    if (rowsHTML) {
        table.innerHTML = rowsHTML;
        descriptionEl.parentNode.insertBefore(table, descriptionEl);
    }
}

function setupVariationsUI(product, baseProduct) {
    const variationSelectorContainer = document.getElementById('variationSelectorContainer');
    const lvl1Container = document.getElementById('variationLvl1Container');
    const lvl1Buttons = document.getElementById('variationLvl1Buttons');
    const lvl2Container = document.getElementById('variationLvl2Container');
    const lvl2Buttons = document.getElementById('variationLvl2Buttons');
    const addToCartButton = document.getElementById('detailAddToCartBtn');
    
    lvl1Buttons.innerHTML = '';
    lvl2Buttons.innerHTML = '';
    lvl1Container.style.display = 'none';
    lvl2Container.style.display = 'none';
    variationSelectorContainer.style.display = 'none';

    // === NEW: Reset Button State ===
    addToCartButton.disabled = false;
    addToCartButton.style.backgroundColor = "var(--accent-color)";
    addToCartButton.style.color = "white";
    addToCartButton.innerHTML = `<i class="fas fa-cart-plus"></i> ${t('add_to_cart')}`;
    // ===============================

    let selectedLvl1Id = null;
    let selectedLvl2Id = null;

    // Initial Render
    renderSliderImages(baseProduct.baseImages, baseProduct.videoLink, baseProduct.name);
    renderProductPrice(baseProduct.basePrice, baseProduct.originalPrice);

    // === NEW: Check Out Of Stock for Details Page ===
    if (product.isOutOfStock) {
        addToCartButton.disabled = true;
        addToCartButton.innerHTML = `<i class="fas fa-ban"></i> لە کۆگا نەماوە`;
        addToCartButton.style.backgroundColor = "#cbd5e0";
        addToCartButton.style.color = "#4a5568";
        // We still render variations so user can see them, but action is blocked
    }
    // ================================================

    const variations = product.variations || [];
    if (variations.length > 0) {
        variationSelectorContainer.style.display = 'flex';
        lvl1Container.style.display = 'block';

        variations.forEach(lvl1Var => {
            const btn = document.createElement('button');
            btn.className = 'variation-btn';
            btn.dataset.lvl1Id = lvl1Var.id;
            btn.textContent = (lvl1Var.name && lvl1Var.name[state.currentLanguage]) || lvl1Var.name.ku_sorani;
            
            btn.onclick = () => {
                lvl1Buttons.querySelectorAll('.variation-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                selectedLvl1Id = lvl1Var.id;
                selectedLvl2Id = null; 

                const newImages = (lvl1Var.imageUrls && lvl1Var.imageUrls.length > 0) ? lvl1Var.imageUrls : baseProduct.baseImages;
                renderSliderImages(newImages, baseProduct.videoLink, baseProduct.name);

                // Handle Level 2 (Size)
                lvl2Buttons.innerHTML = '';
                const options = lvl1Var.options || [];
                
                if (options.length > 0) {
                    options.forEach(lvl2Opt => {
                        const optBtn = document.createElement('button');
                        optBtn.className = 'variation-btn';
                        optBtn.dataset.lvl2Id = lvl2Opt.id;
                        optBtn.textContent = lvl2Opt.name;
                        
                        optBtn.onclick = () => {
                            lvl2Buttons.querySelectorAll('.variation-btn').forEach(b => b.classList.remove('active'));
                            optBtn.classList.add('active');
                            selectedLvl2Id = lvl2Opt.id;
                            renderProductPrice(lvl2Opt.price, null); 
                        };
                        lvl2Buttons.appendChild(optBtn);
                    });
                    lvl2Container.style.display = 'block';
                } else {
                    lvl2Container.style.display = 'none';
                    renderProductPrice(baseProduct.basePrice, baseProduct.originalPrice);
                }
            };
            lvl1Buttons.appendChild(btn);
        });
    }

    // Add to Cart Logic with Variations (Only if stock available)
    if (!product.isOutOfStock) {
        addToCartButton.onclick = () => {
            let selectedVariationInfo = null;
            if (variations.length > 0) {
                if (!selectedLvl1Id) { showNotification('تکایە سەرەتا جۆرێک (ڕەنگ) هەڵبژێرە', 'error'); return; }
                const lvl1Var = variations.find(v => v.id === selectedLvl1Id);
                
                selectedVariationInfo = {
                    lvl1Id: lvl1Var.id,
                    lvl1Name: (lvl1Var.name && lvl1Var.name[state.currentLanguage]) || lvl1Var.name.ku_sorani,
                    price: baseProduct.basePrice 
                };

                const lvl2Options = lvl1Var.options || [];
                if (lvl2Options.length > 0) {
                    if (!selectedLvl2Id) { showNotification('تکایە قەبارەیەک هەڵبژێرە', 'error'); return; }
                    const lvl2Opt = lvl2Options.find(o => o.id === selectedLvl2Id);
                    
                    selectedVariationInfo.lvl2Id = lvl2Opt.id;
                    selectedVariationInfo.lvl2Name = lvl2Opt.name;
                    selectedVariationInfo.price = lvl2Opt.price; 
                }
            }
            handleAddToCartUI(product.id, addToCartButton, selectedVariationInfo); 
        };
    }
}

// --- Helpers ---

function renderProductPrice(price, originalPrice = null) {
    const priceContainer = document.getElementById('detailProductPrice');
    // پاراستنی کۆدی مارکێت ئەگەر پێشتر زیاد کرابێت (چونکە ئەم فەنکشنە هەموو جارێک دەیکوژێنێتەوە)
    const marketBadge = priceContainer.querySelector('.market-code-badge');
    const marketCodeHTML = marketBadge ? marketBadge.outerHTML : '';

    if (originalPrice && originalPrice > price) {
        priceContainer.innerHTML = `<span style="color: var(--accent-color);">${price.toLocaleString()} د.ع</span> <del style="color: var(--dark-gray); font-size: 16px; margin-right: 10px;">${originalPrice.toLocaleString()} د.ع</del>`;
    } else {
        priceContainer.innerHTML = `<span>${price.toLocaleString()} د.ع</span>`;
    }
    
    if(marketCodeHTML) {
        priceContainer.innerHTML += marketCodeHTML;
    }
}

function renderSliderImages(imageUrls, videoLink, productName) {
    const imageContainer = document.getElementById('detailImageContainer');
    const indicatorsContainer = document.getElementById('detailImageIndicators');
    
    imageContainer.innerHTML = ''; 
    indicatorsContainer.innerHTML = ''; 

    let sliderElements = []; 
    let indicatorElements = []; 
    
    if (imageUrls.length > 0) {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url; 
            img.alt = productName; 
            img.className = index === 0 ? 'active' : ''; 
            imageContainer.appendChild(img);
            sliderElements.push(img); 
            
            const line = document.createElement('div');
            line.className = `indicator-line ${index === 0 ? 'active' : ''}`;
            line.onclick = () => updateSlider(index);
            indicatorsContainer.appendChild(line);
            indicatorElements.push(line);
        });
    }
    
    // زیادکردنەوەی لۆجیکی ڤیدیۆ
    const videoId = parseYouTubeId(videoLink); 
    if (videoId) {
        const videoWrapper = document.createElement('div');
        videoWrapper.id = 'videoPlayerWrapper'; 
        videoWrapper.style.cssText = "position: relative; width: 100%; background-color: #000; display: none; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; max-height: 350px;";
        
        const videoIndex = sliderElements.length; 
        imageContainer.appendChild(videoWrapper);
        sliderElements.push(videoWrapper); 

        const line = document.createElement('div');
        line.className = `indicator-line`;
        line.innerHTML = '<i class="fas fa-play" style="font-size:8px; color:white;"></i>'; 
        line.style.display = 'flex';
        line.style.alignItems = 'center';
        line.style.justifyContent = 'center';
        line.dataset.index = videoIndex;
        line.onclick = () => updateSlider(videoIndex);
        indicatorsContainer.appendChild(line);
        indicatorElements.push(line);
    }

    // Navigation Buttons Logic
    let currentIndex = 0;
    const prevBtn = document.getElementById('detailPrevBtn');
    const nextBtn = document.getElementById('detailNextBtn');

    function updateSlider(index) {
        // Stop previous video if playing
        const oldElement = sliderElements[currentIndex];
        if (oldElement && oldElement.id === 'videoPlayerWrapper') {
            oldElement.innerHTML = ''; 
        }

        sliderElements.forEach(el => el.classList.remove('active'));
        indicatorElements.forEach(el => el.classList.remove('active'));
        
        const activeElement = sliderElements[index];
        // If new slide is video, embed it
        if (activeElement.id === 'videoPlayerWrapper') { 
            const videoSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=0&controls=1`;
            activeElement.innerHTML = `<iframe src="${videoSrc}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; aspect-ratio: 16 / 9; max-height: 350px;"></iframe>`;
        }

        activeElement.classList.add('active');
        indicatorElements[index].classList.add('active');
        currentIndex = index; 
    }

    if(sliderElements.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        prevBtn.onclick = () => updateSlider((currentIndex - 1 + sliderElements.length) % sliderElements.length);
        nextBtn.onclick = () => updateSlider((currentIndex + 1) % sliderElements.length);
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }
}

async function renderRelatedProductsUI(currentProduct) {
    const section = document.getElementById('relatedProductsSection');
    const container = document.getElementById('relatedProductsContainer');
    container.innerHTML = '';
    section.style.display = 'none'; 

    const relatedProducts = await fetchRelatedProducts(currentProduct); 

    if (relatedProducts && relatedProducts.length > 0) {
        relatedProducts.forEach(product => {
            const card = createProductCardElementUI(product); 
            container.appendChild(card);
        });
        section.style.display = 'block'; 
    }
}

export function handleToggleFavoriteUI(productId) {
    const result = toggleFavoriteCore(productId); 
    showNotification(result.message, result.favorited ? 'success' : 'error');

    document.querySelectorAll(`[data-product-id="${productId}"] .favorite-btn`).forEach(btn => {
        btn.classList.toggle('favorited', result.favorited);
        const icon = btn.querySelector('.fa-heart');
        if (icon) {
            icon.classList.toggle('fas', result.favorited);
            icon.classList.toggle('far', !result.favorited);
        }
    });
}

export function setupScrollAnimations() { 
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card-reveal').forEach(card => {
        observer.observe(card);
    });
}
