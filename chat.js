// chat.js
import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, usersCollection, 
    serverTimestamp,
    ref, uploadBytes, getDownloadURL 
} from './app-setup.js';

import { 
    state, t, saveCart, authReady
} from './app-core.js';

import { 
    showNotification, openPopup, closeCurrentPopup
} from './app-ui.js';

import { 
    collection, addDoc, query, where, orderBy, onSnapshot, 
    doc, setDoc, updateDoc, getDoc, limit, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let activeChatUserId = null; 

let mediaRecorder = null;
let audioChunks = [];
let isRecordingCancelled = false; 
let recordingTimerInterval = null; 
let recordingStartTime = null; 

export function initChatSystem() {
    setupChatUI();
    setupChatListeners();
    checkUnreadMessages();
}

function setupChatUI() {
    // 1. Add "Direct Order" button to Cart
    const cartActions = document.getElementById('cartActions');
    if (cartActions) {
        const existingBtn = cartActions.querySelector('.direct-order-btn');
        if(existingBtn) existingBtn.remove();

        const directOrderBtn = document.createElement('button');
        directOrderBtn.className = 'whatsapp-btn direct-order-btn'; 
        directOrderBtn.style.backgroundColor = 'var(--primary-color)';
        directOrderBtn.style.marginTop = '10px';
        directOrderBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('submit_order_direct')}</span>`;
        directOrderBtn.onclick = handleDirectOrder;
        
        if (cartActions.firstChild) {
            cartActions.insertBefore(directOrderBtn, cartActions.firstChild);
        } else {
            cartActions.appendChild(directOrderBtn);
        }
    }

    // 2. Setup Chat Page Structure
    const chatPage = document.getElementById('chatPage');
    if (chatPage && !chatPage.querySelector('.chat-container')) {
        chatPage.innerHTML = `
            <div class="chat-container">
                <div class="chat-header" id="chatPageHeader">
                    <div style="display:flex; align-items:center; gap:10px; flex: 1;">
                        <button id="chatBackBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--primary-color); padding: 5px;">
                            <i class="fas fa-arrow-right"></i>
                        </button>

                        <div class="conversation-avatar" id="chatHeaderAvatar"><i class="fas fa-user"></i></div>
                        <div style="flex: 1; overflow: hidden;">
                            <div class="conversation-name" id="chatHeaderName">User</div>
                            <div class="conversation-time" id="chatHeaderStatus"><span class="chat-status-dot online"></span> ${t('online')}</div>
                        </div>
                    </div>
                    
                    <button id="trackOrderBtn" class="track-order-btn" style="display:none;">
                        <i class="fas fa-shipping-fast"></i> <span>${t('my_order_btn')}</span>
                    </button>
                </div>

                <div class="chat-messages" id="chatMessagesArea"></div>
                <div class="typing-indicator" id="typingIndicator">${t('typing')}</div>
                
                <div class="chat-input-area" id="chatInputArea">
                    <button class="chat-action-btn" id="chatImageBtn"><i class="fas fa-image"></i></button>
                    <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
                    
                    <button class="chat-action-btn" id="chatTrashBtn"><i class="fas fa-trash"></i></button>
                    
                    <input type="text" class="chat-input" id="chatTextInput" placeholder="${t('type_message')}">
                    
                    <div id="chatTimer">00:00</div>
                    
                    <button class="chat-action-btn chat-record-btn" id="chatVoiceBtn"><i class="fas fa-microphone"></i></button>
                    <button class="chat-action-btn chat-send-btn" id="chatSendBtn" style="display:none;"><i class="fas fa-paper-plane"></i></button>
                </div>

                <div id="chatLoginRequired" class="chat-login-required" style="display:none;">
                    <i class="fas fa-lock"></i>
                    <h3>پێویستە بچیتە ژوورەوە</h3>
                    <p>بۆ بەکارهێنانی چات و ناردنی داواکاری، تکایە سەرەتا بچۆ ژوورەوە.</p>
                    <button class="chat-login-btn" onclick="window.globalAdminTools.openPopup('profileSheet')">چوونەژوورەوە / خۆتۆمارکردن</button>
                </div>
            </div>
        `;
    }

    // 3. Tracking Modal (New)
    if (!document.getElementById('trackingModal')) {
        const modal = document.createElement('div');
        modal.id = 'trackingModal';
        modal.className = 'bottom-sheet';
        modal.innerHTML = `
            <div class="sheet-header">
                <span class="sheet-handle"></span>
                <h2 class="sheet-title"><i class="fas fa-shipping-fast"></i> ${t('track_order_title')}</h2>
                <span class="close" aria-label="Close">&times;</span>
            </div>
            <div class="sheet-content tracking-modal">
                <div id="trackingContent">
                    <p style="text-align:center; color:#777;">...بارکردن</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        // Re-attach close listeners
        modal.querySelector('.close').onclick = window.globalAdminTools.closeCurrentPopup;
    }
    
    // 4. Admin List Setup
    const adminChatListPage = document.getElementById('adminChatListPage');
    if (adminChatListPage && !adminChatListPage.querySelector('.conversation-list-container')) {
        adminChatListPage.innerHTML = `
            <div class="conversation-list-container" style="padding-top: 80px;">
                <div class="conversation-list" id="adminConversationList">
                    <p style="text-align: center; padding: 20px; color: var(--dark-gray);">...بارکردنی گفتوگۆکان</p>
                </div>
            </div>
        `;
    }
}

function setupChatListeners() {
    // ... Existing listeners ...
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) chatBtn.onclick = () => openChatPage();

    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) adminChatsBtn.onclick = () => openAdminChatList();

    const trackBtn = document.getElementById('trackOrderBtn');
    if (trackBtn) trackBtn.onclick = openTrackingModal;

    document.addEventListener('click', (e) => {
        const backBtn = e.target.closest('#chatBackBtn');
        if (backBtn) {
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';
            const appHeader = document.querySelector('.app-header');
            if (appHeader) appHeader.style.display = 'flex';
            document.documentElement.classList.remove('chat-active');
            history.back();
        }
    });

    setTimeout(() => {
        const textInput = document.getElementById('chatTextInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const voiceBtn = document.getElementById('chatVoiceBtn');
        const imageBtn = document.getElementById('chatImageBtn');
        const imageInput = document.getElementById('chatImageInput');
        const trashBtn = document.getElementById('chatTrashBtn');

        if (textInput) {
            textInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val.length > 0) {
                    if(sendBtn) sendBtn.style.display = 'flex';
                    if(voiceBtn) voiceBtn.style.display = 'none';
                } else {
                    if(sendBtn) sendBtn.style.display = 'none';
                    if(voiceBtn) voiceBtn.style.display = 'flex';
                }
            });
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage('text');
            });
        }

        if (sendBtn) sendBtn.onclick = () => sendMessage('text');
        if (voiceBtn) voiceBtn.onclick = handleVoiceRecording; 
        if (trashBtn) trashBtn.onclick = cancelRecording;

        if (imageBtn && imageInput) {
            imageBtn.onclick = () => imageInput.click();
            imageInput.onchange = (e) => {
                if (e.target.files.length > 0) sendMessage('image', e.target.files[0]);
            };
        }
    }, 1000);
}

export async function openChatPage(targetUserId = null, targetUserName = null) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    if (isAdmin && !targetUserId) {
        openAdminChatList();
        return;
    }
    
    const appHeader = document.querySelector('.app-header');
    if (appHeader) appHeader.style.display = 'none';
    document.documentElement.classList.add('chat-active');

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    if (window.location.hash !== '#chat' && !targetUserId && !isAdmin) { 
        history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
    }
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'chatPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    const msgArea = document.getElementById('chatMessagesArea');
    if (msgArea) {
        msgArea.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%; color:var(--dark-gray);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        msgArea.style.display = 'flex';
    }

    await authReady; 

    if (!state.currentUser && !isAdmin) {
        const loginReq = document.getElementById('chatLoginRequired');
        const inputArea = document.getElementById('chatInputArea');
        if(loginReq) loginReq.style.display = 'flex';
        if(inputArea) inputArea.style.display = 'none';
        if(msgArea) msgArea.style.display = 'none';
        return;
    }

    const loginReq = document.getElementById('chatLoginRequired');
    const inputArea = document.getElementById('chatInputArea');
    if(loginReq) loginReq.style.display = 'none';
    if(inputArea) inputArea.style.display = 'flex';
    
    if(msgArea) {
        msgArea.innerHTML = ''; 
        msgArea.classList.add('hidden'); 
    }

    // Toggle Track Order Button
    const trackBtn = document.getElementById('trackOrderBtn');
    if (trackBtn) {
        trackBtn.style.display = isAdmin ? 'none' : 'flex';
    }

    if (isAdmin) {
        activeChatUserId = targetUserId;
        const headerName = document.getElementById('chatHeaderName');
        const backBtn = document.getElementById('chatBackBtn');
        if(backBtn) backBtn.style.display = 'flex'; 

        if(headerName) {
            headerName.textContent = targetUserName || "بەکارهێنەر";
            if (!targetUserName) {
                getDoc(doc(db, "chats", targetUserId)).then(docSnap => {
                    if(docSnap.exists()) {
                        headerName.textContent = docSnap.data().userInfo?.displayName || "بەکارهێنەر";
                    }
                });
            }
        }
    } else {
        activeChatUserId = state.currentUser.uid; 
        const headerName = document.getElementById('chatHeaderName');
        if(headerName) headerName.textContent = t('admin_badge');
        const backBtn = document.getElementById('chatBackBtn');
        if(backBtn) backBtn.style.display = 'flex'; 
    }

    subscribeToMessages(activeChatUserId);
}

// ... (openAdminChatList, subscribeToMessages remain the same) ...
function openAdminChatList() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
    const appHeader = document.querySelector('.app-header');
    if (appHeader) appHeader.style.display = 'flex';
    document.documentElement.classList.remove('chat-active');

    history.pushState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', '#admin-chats');
    
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'adminChatListPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });
    
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) headerTitle.textContent = t('conversations_title');

    subscribeToAllConversations();
}

function subscribeToMessages(chatUserId) {
    if (messagesUnsubscribe) messagesUnsubscribe();
    const messagesRef = collection(db, "chats", chatUserId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const msgArea = document.getElementById('chatMessagesArea');
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if(!msgArea) return;
        msgArea.innerHTML = ''; 
        if (snapshot.empty) {
            msgArea.innerHTML = `<div class="empty-chat-state"><i class="fas fa-comments"></i><p>${t('no_messages')}</p></div>`;
            msgArea.classList.remove('hidden'); 
            return;
        }
        snapshot.docs.forEach(doc => {
            try {
                const msg = { id: doc.id, ...doc.data() };
                renderSingleMessage(msg, msgArea, chatUserId);
            } catch (err) { console.error("Error rendering msg:", err); }
        });
        msgArea.scrollTop = msgArea.scrollHeight;
        setTimeout(() => { msgArea.classList.remove('hidden'); }, 50);
        markMessagesAsRead(snapshot.docs, chatUserId);
    });
}

// === [CRITICAL UPDATE] Render Order Message with Bubble, Shipping Rule & Admin Controls ===
function renderSingleMessage(msg, container, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const isMe = msg.senderId === (isAdmin ? 'admin' : (state.currentUser ? state.currentUser.uid : ''));
    const alignClass = isMe ? 'message-sent' : 'message-received';
    
    const div = document.createElement('div');
    div.className = `message-bubble ${alignClass}`;
    
    // Allow Order Bubbles to take full width of container if needed
    if (msg.type === 'order') {
        div.style.maxWidth = '90%'; 
        div.style.padding = '0';
        div.style.background = 'transparent';
        div.style.boxShadow = 'none';
    }

    let contentHtml = '';
    
    if (msg.type === 'text') {
        contentHtml = `<p>${msg.content}</p>`;
    } else if (msg.type === 'image') {
        contentHtml = `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open('${msg.fileUrl}', '_blank')">`;
    } else if (msg.type === 'audio') {
        contentHtml = `
            <div class="audio-player">
                <button class="audio-control-btn" onclick="playAudio(this, '${msg.fileUrl}')"><i class="fas fa-play"></i></button>
                <div class="audio-progress"><div class="audio-progress-bar"></div></div>
            </div>`;
    } else if (msg.type === 'order') {
        const order = msg.orderDetails;
        if(order && order.items) {
            // --- Shipping Logic Visualization (Rule: 3+ from same market = Free) ---
            const marketGroups = {};
            order.items.forEach(item => {
                const mCode = item.marketCode || 'default';
                if (!marketGroups[mCode]) marketGroups[mCode] = { items: [], total: 0 };
                marketGroups[mCode].items.push(item);
                marketGroups[mCode].total += (item.price * item.quantity);
            });

            let itemsHtml = '';
            let grandTotal = 0;

            for (const [mCode, group] of Object.entries(marketGroups)) {
                const isFreeShipping = group.items.reduce((sum, i) => sum + i.quantity, 0) >= 3;
                let shippingCost = isFreeShipping ? 0 : group.items.reduce((sum, i) => sum + (i.shippingCost || 0), 0);
                
                const groupTotal = group.total + shippingCost;
                grandTotal += groupTotal;

                group.items.forEach(item => {
                    const itemName = item.name && item.name[state.currentLanguage] ? item.name[state.currentLanguage] : (item.name.ku_sorani || item.name);
                    itemsHtml += `
                    <div class="order-bubble-item">
                        <img src="${item.image}" loading="lazy">
                        <div class="order-bubble-info">
                            <div class="order-item-title">${itemName}</div>
                            <div class="order-item-meta">${item.quantity} x ${item.price.toLocaleString()} د.ع</div>
                        </div>
                    </div>`;
                });

                if (isFreeShipping && mCode !== 'default') {
                    itemsHtml += `<div style="padding: 4px 10px; background: #e6fffa; color: #2c7a7b; font-size: 11px; font-weight: bold; border-bottom: 1px dashed #e2e8f0;">
                        <i class="fas fa-check-circle"></i> ${t('free_shipping_badge')} (${mCode})
                    </div>`;
                }
            }

            // Status Badge Logic
            const status = order.status || 'pending';
            const statusKey = `status_${status}`;
            const statusClass = `status-${status}`;

            // Admin Control Logic
            let adminControls = '';
            if (isAdmin) {
                adminControls = `
                <div class="admin-order-controls">
                    <label style="font-size:11px; font-weight:bold; color:#555;">${t('change_status')}</label>
                    <select class="admin-status-select" onchange="window.updateOrderStatus('${msg.id}', '${order.orderDocId}', this.value)">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="accepted" ${status === 'accepted' ? 'selected' : ''}>Accepted</option>
                        <option value="shipping" ${status === 'shipping' ? 'selected' : ''}>Shipping</option>
                        <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </div>`;
            }

            contentHtml = `
                <div class="order-bubble">
                    <div class="order-bubble-header">
                        <i class="fas fa-receipt"></i> <span>${t('order_notification_title')} #${order.orderDocId ? order.orderDocId.slice(-4) : '...'}</span>
                    </div>
                    <div class="order-bubble-content">
                        ${itemsHtml}
                        
                        <div class="order-summary">
                            <div class="order-total-row">
                                <span>${t('order_total')}</span>
                                <span>${grandTotal.toLocaleString()} د.ع</span>
                            </div>
                            <div class="order-status-badge ${statusClass}">
                                ${t(statusKey)}
                            </div>
                            
                            <div style="margin-top:10px; border-top:1px solid #ddd; padding-top:8px; font-size:11px; color:#555;">
                                <i class="fas fa-map-marker-alt"></i> ${order.userAddress}<br>
                                <i class="fas fa-phone"></i> ${order.userPhone}
                            </div>

                            ${adminControls}
                        </div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `<p>Error: Invalid Order Data</p>`;
        }
    }

    const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Only show time for non-order messages (Order bubble has its own style)
    const timeDisplay = msg.type === 'order' ? '' : `
        <div class="message-time">
            ${timeStr} ${isMe ? `<i class="fas ${msg.isRead ? 'fa-check-double seen' : 'fa-check'} message-status-icon"></i>` : ''}
        </div>`;

    div.innerHTML = contentHtml + timeDisplay;
    container.appendChild(div);
}

// === [NEW] Admin Function to Update Status ===
window.updateOrderStatus = async function(messageId, orderDocId, newStatus) {
    if (!messageId || !orderDocId) return;
    
    try {
        // 1. Update the actual Order Document
        await updateDoc(doc(db, "orders", orderDocId), { status: newStatus });
        
        // 2. Update the Chat Message (to reflect in UI instantly for both)
        // We need to find the specific message doc. 
        // Since we are in the loop, we might not have the chatUserId easily accessible in global scope if multiple admins. 
        // But activeChatUserId is global in this file.
        if (activeChatUserId) {
            const msgRef = doc(db, "chats", activeChatUserId, "messages", messageId);
            // We need to update the nested orderDetails object.
            // Firestore requires dot notation for nested updates to avoid overwriting.
            await updateDoc(msgRef, {
                "orderDetails.status": newStatus
            });
            showNotification("دۆخی داواکاری نوێکرایەوە", "success");
        }
    } catch (error) {
        console.error("Error updating status:", error);
        showNotification("هەڵە لە نوێکردنەوەی دۆخ", "error");
    }
};

// === [NEW] User Tracking Modal Logic ===
export async function openTrackingModal() {
    window.globalAdminTools.openPopup('trackingModal', 'sheet');
    const container = document.getElementById('trackingContent');
    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';

    if (!state.currentUser) {
        container.innerHTML = '<p style="text-align:center;">تکایە بچۆ ژوورەوە.</p>';
        return;
    }

    // Fetch the MOST RECENT order for this user
    const q = query(ordersCollection, where("userId", "==", state.currentUser.uid), orderBy("createdAt", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">هیچ داواکارییەکی چالاک نییە.</p>';
        return;
    }

    const orderData = snapshot.docs[0].data();
    const status = orderData.status || 'pending';
    
    // Timeline Data
    const steps = [
        { id: 'pending', label: t('status_pending'), icon: 'fa-clock' },
        { id: 'accepted', label: t('status_accepted'), icon: 'fa-check-circle' },
        { id: 'shipping', label: t('status_shipping'), icon: 'fa-truck' },
        { id: 'delivered', label: t('status_delivered'), icon: 'fa-box-open' }
    ];

    let currentStepIndex = steps.findIndex(s => s.id === status);
    if (currentStepIndex === -1) currentStepIndex = 0; // Default

    let timelineHtml = '<div class="timeline">';
    
    steps.forEach((step, index) => {
        const isActive = index <= currentStepIndex;
        const isCurrent = index === currentStepIndex;
        
        timelineHtml += `
            <div class="timeline-item ${isActive ? 'active' : ''}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-title">
                        <i class="fas ${step.icon}"></i> ${step.label}
                    </div>
                    ${isCurrent ? `<div class="timeline-date">${new Date(orderData.createdAt).toLocaleDateString()}</div>` : ''}
                </div>
            </div>
        `;
    });
    timelineHtml += '</div>';

    container.innerHTML = timelineHtml;
}

// === [UPDATED] Send Order with Correct Shipping Logic ===
async function processOrderSubmission() {
    let totalItemPrice = 0;
    let totalShipping = 0;
    const marketGroups = {};

    // 1. Group & Calculate Item Totals
    state.cart.forEach(item => {
        totalItemPrice += (item.price * item.quantity);
        const mCode = item.marketCode || 'default';
        if (!marketGroups[mCode]) marketGroups[mCode] = { items: [] };
        marketGroups[mCode].items.push(item);
    });

    // 2. Apply "3+ Items Free Shipping" Rule
    for (const [mCode, group] of Object.entries(marketGroups)) {
        const itemCount = group.items.reduce((sum, item) => sum + item.quantity, 0);
        
        if (itemCount >= 3) {
            // Free Shipping!
            totalShipping += 0;
        } else {
            // Pay shipping for each item
            totalShipping += group.items.reduce((sum, i) => sum + (i.shippingCost || 0), 0);
        }
    }

    const total = totalItemPrice + totalShipping;
    
    // Create Doc
    const newOrderRef = doc(ordersCollection); // Generate ID first
    const orderData = {
        orderDocId: newOrderRef.id, // Store ID inside for reference
        userId: state.currentUser.uid,
        userName: state.userProfile.name || state.currentUser.displayName, 
        userPhone: state.userProfile.phone || '', 
        userAddress: state.userProfile.address || '', 
        items: state.cart,
        total: total,
        status: 'pending', 
        createdAt: Date.now() 
    };

    try {
        await setDoc(newOrderRef, orderData); // Use setDoc with generated ID
        await sendMessage('order', null, orderData);

        state.cart = [];
        saveCart();
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        openChatPage();
        showNotification(t('order_submitted'), 'success');

    } catch (error) {
        console.error("Order Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

// === [EXISTING HELPERS] (sendMessage, startTimer, resetRecordingUI, handleVoiceRecording, etc.) ===
// ... These functions remain mostly unchanged, just ensure sendMessage supports 'order' type correctly ...

async function sendMessage(type, file = null, orderData = null) {
    if (!state.currentUser && sessionStorage.getItem('isAdmin') !== 'true') return;

    const textInput = document.getElementById('chatTextInput');
    let content = '';
    if (textInput) content = textInput.value.trim();
    if (type === 'text' && !content) return;

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const senderId = isAdmin ? 'admin' : state.currentUser.uid;
    const docId = isAdmin ? activeChatUserId : state.currentUser.uid;

    const messageData = {
        senderId: senderId,
        receiverId: isAdmin ? activeChatUserId : 'admin',
        type: type,
        content: type === 'text' ? content : '',
        timestamp: serverTimestamp(),
        isRead: false
    };

    try {
        if (type === 'text' && textInput) textInput.value = '';
        if (file) {
            const storageRef = ref(storage, `chats/${docId}/${Date.now()}_${file.name || 'audio.webm'}`);
            const snapshot = await uploadBytes(storageRef, file);
            messageData.fileUrl = await getDownloadURL(snapshot.ref);
        }
        if (type === 'order') {
            messageData.orderDetails = orderData;
        }

        const messagesRef = collection(db, "chats", docId, "messages");
        const msgDoc = await addDoc(messagesRef, messageData);

        const chatDocRef = doc(db, "chats", docId);
        const lastMsgText = type === 'text' ? content : (type === 'order' ? '📦 New Order' : (type === 'image' ? '📷 Image' : '🎤 Audio'));
        
        await setDoc(chatDocRef, {
            lastMessage: lastMsgText,
            lastMessageTime: serverTimestamp(),
            isReadByAdmin: isAdmin, 
            isReadByUser: !isAdmin,
            userInfo: (!isAdmin && state.currentUser) ? {
                displayName: state.currentUser.displayName,
                email: state.currentUser.email,
                uid: state.currentUser.uid
            } : undefined
        }, { merge: true });

        // If it's an order message, update the order doc with the message ID for cross-reference (optional but good)
        if (type === 'order' && orderData.orderDocId) {
             // We could store the message ID in the order doc if needed later
        }

    } catch (error) { console.error("Send Error:", error); }
}

async function handleDirectOrder() {
    if (!state.currentUser) {
        showNotification('تکایە سەرەتا بچۆ ژوورەوە', 'error');
        window.globalAdminTools.openPopup('profileSheet');
        return;
    }
    if (state.cart.length === 0) { showNotification(t('cart_empty'), 'error'); return; }
    if (!state.userProfile.phone || !state.userProfile.address) {
        showNotification('تکایە زانیارییەکانت پڕبکەرەوە', 'error');
        window.globalAdminTools.openPopup('profileSheet');
        return;
    }

    window.globalAdminTools.openPopup('orderConfirmationModal', 'modal');
    
    // Fix: Re-attach listeners to clone to prevent duplicate firing
    const confirmBtn = document.getElementById('confirmOrderBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = async () => {
        window.globalAdminTools.closeCurrentPopup();
        setTimeout(processOrderSubmission, 150);
    };
    
    const cancelBtn = document.getElementById('cancelOrderBtn');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.onclick = window.globalAdminTools.closeCurrentPopup;
}

// ... (Rest of the standard functions: startTimer, handleVoiceRecording, subscribeToAllConversations, markMessagesAsRead, checkUnreadMessages, playAudio) ...
// (These are standard and included in previous versions, just make sure they are present in the final file)

function startTimer() { /* ... implementation from previous turn ... */ 
    const timerEl = document.getElementById('chatTimer');
    if (!timerEl) return;
    recordingStartTime = Date.now();
    timerEl.textContent = '00:00';
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function resetRecordingUI() {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = null; recordingStartTime = null; audioChunks = []; isRecordingCancelled = false; mediaRecorder = null; 
    const inputArea = document.getElementById('chatInputArea');
    if (inputArea) inputArea.classList.remove('is-recording');
    const voiceBtn = document.getElementById('chatVoiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('chat-send-btn'); 
        voiceBtn.querySelector('i').className = 'fas fa-microphone';
    }
}

function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        isRecordingCancelled = true; mediaRecorder.stop(); 
    }
}

async function handleVoiceRecording() {
    const btn = document.getElementById('chatVoiceBtn');
    const inputArea = document.getElementById('chatInputArea');
    
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            isRecordingCancelled = false; 
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                if (!isRecordingCancelled) {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size > 1000) await sendMessage('audio', audioBlob);
                }
                resetRecordingUI();
            };
            mediaRecorder.start();
            if (inputArea) inputArea.classList.add('is-recording'); 
            btn.classList.add('chat-send-btn'); 
            btn.querySelector('i').className = 'fas fa-paper-plane';
            startTimer(); 
        } catch (err) {
            console.error(err); showNotification('Mic Error', 'error'); resetRecordingUI(); 
        }
    } else if (mediaRecorder.state === 'recording') {
        isRecordingCancelled = false; mediaRecorder.stop(); 
    }
}

function subscribeToAllConversations() {
    if (conversationsUnsubscribe) conversationsUnsubscribe();
    const q = query(chatsCollection, orderBy("lastMessageTime", "desc"));
    const container = document.getElementById('adminConversationList');
    conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
        if(!container) return;
        container.innerHTML = '';
        if (snapshot.empty) { container.innerHTML = `<p class="text-center p-4" style="color:var(--dark-gray);">${t('no_messages')}</p>`; return; }
        let unreadTotal = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const isUnread = !data.isReadByAdmin;
            if(isUnread) unreadTotal++;
            const date = data.lastMessageTime ? new Date(data.lastMessageTime.toDate()) : new Date();
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const displayName = data.userInfo?.displayName || 'بەکارهێنەر';
            const div = document.createElement('div');
            div.className = `conversation-item ${isUnread ? 'unread' : ''}`;
            div.innerHTML = `
                <div class="conversation-avatar"><i class="fas fa-user"></i></div>
                <div class="conversation-info">
                    <div class="conversation-name">${displayName}<span class="conversation-time">${timeStr}</span></div>
                    <div class="conversation-last-msg">${isUnread ? `<span class="unread-count">نوێ</span>` : ''}${data.lastMessage}</div>
                </div>`;
            div.onclick = () => openChatPage(doc.id, displayName);
            container.appendChild(div);
        });
        const badge = document.getElementById('adminUnreadBadge');
        if(badge) { badge.textContent = unreadTotal; badge.style.display = unreadTotal > 0 ? 'inline-block' : 'none'; }
    });
}

async function markMessagesAsRead(msgDocs, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const batch = writeBatch(db);
    let hasUpdates = false;
    msgDocs.forEach(docSnap => {
        const msg = docSnap.data();
        const amIReceiver = (isAdmin && msg.receiverId === 'admin') || (!isAdmin && msg.receiverId === state.currentUser?.uid);
        if (amIReceiver && !msg.isRead) {
            batch.update(docSnap.ref, { isRead: true });
            hasUpdates = true;
        }
    });
    if (hasUpdates) {
        const chatDocRef = doc(db, "chats", chatUserId);
        batch.update(chatDocRef, isAdmin ? { isReadByAdmin: true } : { isReadByUser: true });
        await batch.commit();
    }
}

function checkUnreadMessages() {
    if (sessionStorage.getItem('isAdmin') === 'true') return; 
    auth.onAuthStateChanged(user => {
        if (user) {
            onSnapshot(doc(db, "chats", user.uid), (docSnap) => {
                const badge = document.getElementById('chatBadge');
                if (badge) {
                    if (docSnap.exists() && !docSnap.data().isReadByUser) badge.classList.add('has-unread');
                    else badge.classList.remove('has-unread');
                }
            });
        }
    });
}

window.playAudio = function(btn, url) {
    const audio = new Audio(url);
    const player = btn.closest('.audio-player');
    const progressBar = player.querySelector('.audio-progress-bar');
    const icon = btn.querySelector('i');
    if (window.currentAudio && window.currentAudio !== audio) window.currentAudio.pause();
    window.currentAudio = audio;
    icon.className = 'fas fa-pause';
    audio.play();
    audio.ontimeupdate = () => { progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`; };
    audio.onended = () => { icon.className = 'fas fa-play'; progressBar.style.width = '0%'; };
};
