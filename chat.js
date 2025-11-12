// chat.js
import { 
    db, auth, storage, 
    chatsCollection, ordersCollection, usersCollection, 
    serverTimestamp 
} from './app-setup.js';

import { 
    state, t, saveCart, generateOrderMessageCore 
} from './app-core.js';

import { 
    showNotification, openPopup, closeCurrentPopup, renderSkeletonLoader 
} from './app-ui.js';

import { 
    collection, addDoc, query, where, orderBy, onSnapshot, 
    doc, setDoc, updateDoc, getDoc, limit, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Variables to handle listeners
let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let activeChatUserId = null; // For Admin: keeping track of which user we are chatting with
let mediaRecorder = null;
let audioChunks = [];

export function initChatSystem() {
    setupChatUI();
    setupChatListeners();
    checkUnreadMessages();
}

function setupChatUI() {
    // 1. Add "Direct Order" button to Cart Sheet
    const cartActions = document.getElementById('cartActions');
    if (cartActions) {
        const directOrderBtn = document.createElement('button');
        directOrderBtn.className = 'whatsapp-btn';
        directOrderBtn.style.backgroundColor = 'var(--primary-color)';
        directOrderBtn.style.marginTop = '10px';
        directOrderBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('submit_order_direct')}</span>`;
        directOrderBtn.onclick = handleDirectOrder;
        cartActions.insertBefore(directOrderBtn, cartActions.firstChild);
    }

    // 2. Setup Chat Page HTML Structure (Injecting dynamically if empty)
    const chatPage = document.getElementById('chatPage');
    if (chatPage && chatPage.innerHTML.trim() === '') {
        chatPage.innerHTML = `
            <div class="chat-container">
                <div class="chat-header" id="chatPageHeader">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="conversation-avatar" id="chatHeaderAvatar"><i class="fas fa-user"></i></div>
                        <div>
                            <div class="conversation-name" id="chatHeaderName">Admin</div>
                            <div class="conversation-time" id="chatHeaderStatus"><span class="chat-status-dot online"></span> ${t('online')}</div>
                        </div>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessagesArea">
                    <!-- Messages go here -->
                </div>
                <div class="typing-indicator" id="typingIndicator">${t('typing')}</div>
                
                <div class="chat-input-area" id="chatInputArea">
                    <button class="chat-action-btn" id="chatImageBtn"><i class="fas fa-image"></i></button>
                    <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
                    
                    <input type="text" class="chat-input" id="chatTextInput" placeholder="${t('type_message')}">
                    
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

    // 3. Setup Admin Chat List Page
    const adminChatListPage = document.getElementById('adminChatListPage');
    if (adminChatListPage && adminChatListPage.innerHTML.trim() === '') {
        adminChatListPage.innerHTML = `
            <div class="settings-page" style="padding-top: 60px;">
                <h3 class="section-title"><i class="fas fa-inbox"></i> ${t('conversations_title')}</h3>
                <div class="conversation-list" id="adminConversationList">
                    <div class="text-center p-4">...Loading</div>
                </div>
            </div>
        `;
    }
}

function setupChatListeners() {
    // Nav Button
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.onclick = () => {
            openChatPage();
        };
    }

    // Admin Chat List Button (in Settings)
    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) {
        adminChatsBtn.onclick = () => {
            openAdminChatList();
        };
    }

    // Input handling
    const textInput = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const voiceBtn = document.getElementById('chatVoiceBtn');
    const imageBtn = document.getElementById('chatImageBtn');
    const imageInput = document.getElementById('chatImageInput');

    if (textInput) {
        textInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.length > 0) {
                sendBtn.style.display = 'flex';
                voiceBtn.style.display = 'none';
            } else {
                sendBtn.style.display = 'none';
                voiceBtn.style.display = 'flex';
            }
        });

        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage('text');
        });
    }

    if (sendBtn) sendBtn.onclick = () => sendMessage('text');
    
    if (voiceBtn) {
        voiceBtn.onclick = handleVoiceRecording;
    }

    if (imageBtn && imageInput) {
        imageBtn.onclick = () => imageInput.click();
        imageInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                sendMessage('image', e.target.files[0]);
            }
        };
    }
}

// --- NAVIGATION Logic ---

function openChatPage(targetUserId = null) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    if (isAdmin && !targetUserId) {
        // Admin clicked "Messages" on nav -> Go to conversation list
        openAdminChatList();
        return;
    }

    // If User is not logged in
    if (!state.currentUser && !isAdmin) {
        history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
        showPage('chatPage');
        document.getElementById('chatLoginRequired').style.display = 'flex';
        document.getElementById('chatInputArea').style.display = 'none';
        document.getElementById('chatMessagesArea').style.display = 'none';
        return;
    }

    // Show Chat UI
    history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
    showPage('chatPage');
    
    document.getElementById('chatLoginRequired').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'flex';
    const msgArea = document.getElementById('chatMessagesArea');
    msgArea.style.display = 'flex';
    msgArea.innerHTML = ''; // Clear previous

    // Setup context
    if (isAdmin) {
        activeChatUserId = targetUserId;
        document.getElementById('chatHeaderName').textContent = "User"; // We can fetch name later
        // Hide Admin navigation if inside a chat
        updateActiveNav('chatBtn'); // Highlight nav
    } else {
        activeChatUserId = state.currentUser.uid;
        document.getElementById('chatHeaderName').textContent = t('admin_badge');
    }

    subscribeToMessages(activeChatUserId);
}

function openAdminChatList() {
    history.pushState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', '#admin-chats');
    showPage('adminChatListPage');
    subscribeToAllConversations();
}

// --- MESSAGING LOGIC ---

function subscribeToMessages(chatUserId) {
    if (messagesUnsubscribe) messagesUnsubscribe();

    const messagesRef = collection(db, "chats", chatUserId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const msgArea = document.getElementById('chatMessagesArea');
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        // Clear messages only on first load to avoid flickering, logic handled by appending
        msgArea.innerHTML = ''; 
        
        if (snapshot.empty) {
            msgArea.innerHTML = `<div class="empty-chat-state"><i class="fas fa-comments"></i><p>${t('no_messages')}</p></div>`;
            return;
        }

        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            renderSingleMessage(msg, msgArea, chatUserId);
        });

        // Scroll to bottom
        msgArea.scrollTop = msgArea.scrollHeight;

        // Mark as read if I am the receiver
        markMessagesAsRead(snapshot.docs, chatUserId);
    });
}

function renderSingleMessage(msg, container, chatUserId) {
    const isMe = msg.senderId === (sessionStorage.getItem('isAdmin') === 'true' ? 'admin' : state.currentUser.uid);
    const alignClass = isMe ? 'message-sent' : 'message-received';
    
    const div = document.createElement('div');
    div.className = `message-bubble ${alignClass}`;

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
            </div>
        `;
    } else if (msg.type === 'order') {
        const order = msg.orderDetails;
        contentHtml = `
            <div class="order-bubble">
                <div class="order-bubble-header"><i class="fas fa-receipt"></i> ${t('order_notification_title')}</div>
                <div class="order-bubble-content">
                    ${order.items.map(i => `
                        <div class="order-bubble-item">
                            <span>${i.name} (x${i.quantity})</span>
                            <span>${(i.price * i.quantity).toLocaleString()}</span>
                        </div>
                    `).join('')}
                    <div class="order-bubble-total">${t('total_price')} ${order.total.toLocaleString()} د.ع</div>
                </div>
            </div>
        `;
    }

    // Time Formatting
    const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Status Icon
    let statusIcon = '';
    if (isMe) {
        const statusClass = msg.isRead ? 'seen' : '';
        const iconClass = msg.isRead ? 'fa-check-double' : 'fa-check';
        statusIcon = `<i class="fas ${iconClass} message-status-icon ${statusClass}"></i>`;
    }

    div.innerHTML = `
        ${contentHtml}
        <div class="message-time">
            ${timeStr} ${statusIcon}
        </div>
    `;

    container.appendChild(div);
}

async function sendMessage(type, file = null, orderData = null) {
    if (!state.currentUser && sessionStorage.getItem('isAdmin') !== 'true') return;

    const textInput = document.getElementById('chatTextInput');
    const content = textInput.value.trim();
    
    if (type === 'text' && !content) return;

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const senderId = isAdmin ? 'admin' : state.currentUser.uid;
    // If admin, sending TO activeChatUserId. If user, sending TO 'admin' (but doc is their own ID)
    const docId = isAdmin ? activeChatUserId : state.currentUser.uid;

    // Prepare Message Data
    const messageData = {
        senderId: senderId,
        receiverId: isAdmin ? activeChatUserId : 'admin',
        type: type,
        content: type === 'text' ? content : '',
        timestamp: serverTimestamp(),
        isRead: false
    };

    try {
        // Clear Input immediately for UX
        if (type === 'text') {
            textInput.value = '';
            document.getElementById('chatSendBtn').style.display = 'none';
            document.getElementById('chatVoiceBtn').style.display = 'flex';
        }

        // Handle File Uploads
        if (file) {
            showNotification('...Uploading', 'success');
            const storageRef = ref(storage, `chats/${docId}/${Date.now()}_${file.name || 'audio.webm'}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            messageData.fileUrl = downloadURL;
        }

        // Handle Orders
        if (type === 'order') {
            messageData.orderDetails = orderData;
        }

        // 1. Add Message to Subcollection
        const messagesRef = collection(db, "chats", docId, "messages");
        await addDoc(messagesRef, messageData);

        // 2. Update Main Chat Document (For Conversation List)
        const chatDocRef = doc(db, "chats", docId);
        const chatUpdateData = {
            lastMessage: type === 'text' ? content : (type === 'image' ? '📷 Image' : (type === 'audio' ? '🎤 Audio' : '📦 Order')),
            lastMessageTime: serverTimestamp(),
            isReadByAdmin: isAdmin, // If admin sent it, it's read by admin
            isReadByUser: !isAdmin  // If user sent it, it's read by user
        };

        // If user sending, make sure we have their profile info in the chat doc
        if (!isAdmin) {
            chatUpdateData.userInfo = {
                displayName: state.currentUser.displayName || 'Unknown',
                email: state.currentUser.email,
                uid: state.currentUser.uid
            };
            // Increment unread count for Admin
            // We need a way to increment strictly. For now, just update flag.
        }

        await setDoc(chatDocRef, chatUpdateData, { merge: true });

    } catch (error) {
        console.error("Send Message Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

// --- VOICE RECORDING ---

async function handleVoiceRecording() {
    const btn = document.getElementById('chatVoiceBtn');
    
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendMessage('audio', audioBlob);
                btn.classList.remove('recording');
            };

            mediaRecorder.start();
            btn.classList.add('recording');
            showNotification(t('recording'), 'success');

        } catch (err) {
            console.error("Mic Error:", err);
            showNotification('دەسەڵاتی مایکڕۆفۆن نەدراوە', 'error');
        }
    } else {
        // Stop Recording
        mediaRecorder.stop();
    }
}

// --- DIRECT ORDERS ---

async function handleDirectOrder() {
    if (!state.currentUser) {
        showNotification('تکایە سەرەتا بچۆ ژوورەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    if (state.cart.length === 0) {
        showNotification(t('cart_empty'), 'error');
        return;
    }

    const confirmOrder = confirm("دڵنیایت دەتەوێت داواکارییەکەت بنێریت؟");
    if (!confirmOrder) return;

    closeCurrentPopup(); // Close Cart Sheet

    // Prepare Order Data
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderData = {
        userId: state.currentUser.uid,
        userName: state.userProfile.name || state.currentUser.displayName,
        userPhone: state.userProfile.phone || '',
        userAddress: state.userProfile.address || '',
        items: state.cart,
        total: total,
        status: 'pending', // pending, accepted, rejected, delivered
        createdAt: serverTimestamp()
    };

    try {
        // 1. Save to 'orders' collection
        await addDoc(ordersCollection, orderData);

        // 2. Send 'order' message to chat
        await sendMessage('order', null, orderData);

        // 3. Clear Cart
        state.cart = [];
        saveCart();
        // Update UI
        if (window.globalAdminTools && window.globalAdminTools.updateCartCountUI) {
             // This function isn't exported globally, so we trigger a reload or specific UI update
             // Better: Dispatch an event or manually update
             document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        }

        // 4. Navigate to Chat
        openChatPage();
        showNotification(t('order_submitted'), 'success');

    } catch (error) {
        console.error("Order Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

// --- ADMIN CONVERSATION LIST ---

function subscribeToAllConversations() {
    if (conversationsUnsubscribe) conversationsUnsubscribe();

    const q = query(chatsCollection, orderBy("lastMessageTime", "desc"));
    const container = document.getElementById('adminConversationList');

    conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<p class="text-center p-4">No conversations yet.</p>`;
            return;
        }

        let unreadTotal = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const isUnread = !data.isReadByAdmin;
            if(isUnread) unreadTotal++;

            const date = data.lastMessageTime ? new Date(data.lastMessageTime.toDate()) : new Date();
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const div = document.createElement('div');
            div.className = `conversation-item ${isUnread ? 'unread' : ''}`;
            div.innerHTML = `
                <div class="conversation-avatar"><i class="fas fa-user"></i></div>
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${data.userInfo?.displayName || 'User'}
                        <span class="conversation-time">${timeStr}</span>
                    </div>
                    <div class="conversation-last-msg">
                        ${isUnread ? `<span class="unread-count">New</span>` : ''}
                        ${data.lastMessage}
                    </div>
                </div>
            `;
            div.onclick = () => {
                openChatPage(doc.id);
            };
            container.appendChild(div);
        });

        // Update Admin Badge in Settings
        const badge = document.getElementById('adminUnreadBadge');
        if(badge) {
            badge.textContent = unreadTotal;
            badge.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
        }
    });
}

// --- HELPER: Read Receipts ---

async function markMessagesAsRead(msgDocs, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const batch = writeBatch(db);
    let hasUpdates = false;

    msgDocs.forEach(docSnap => {
        const msg = docSnap.data();
        // If I am the receiver AND it is not read yet
        const amIReceiver = (isAdmin && msg.receiverId === 'admin') || (!isAdmin && msg.receiverId === state.currentUser?.uid);
        
        if (amIReceiver && !msg.isRead) {
            batch.update(docSnap.ref, { isRead: true });
            hasUpdates = true;
        }
    });

    // Also update main chat doc read status
    if (hasUpdates) {
        const chatDocRef = doc(db, "chats", chatUserId);
        const fieldToUpdate = isAdmin ? { isReadByAdmin: true } : { isReadByUser: true };
        batch.update(chatDocRef, fieldToUpdate);
        
        await batch.commit();
    }
}

// --- HELPER: Check Unread for Main Nav Badge ---
function checkUnreadMessages() {
    if (sessionStorage.getItem('isAdmin') === 'true') return; // Admin handled in list
    
    auth.onAuthStateChanged(user => {
        if (user) {
            // Listen to my chat doc
            onSnapshot(doc(db, "chats", user.uid), (docSnap) => {
                const badge = document.getElementById('chatBadge');
                if (docSnap.exists() && !docSnap.data().isReadByUser) {
                    // Simple dot badge
                    badge.classList.add('has-unread');
                } else {
                    badge.classList.remove('has-unread');
                }
            });
        }
    });
}

// Global Audio Player helper
window.playAudio = function(btn, url) {
    const audio = new Audio(url);
    const player = btn.closest('.audio-player');
    const progressBar = player.querySelector('.audio-progress-bar');
    const icon = btn.querySelector('i');

    if (window.currentAudio && window.currentAudio !== audio) {
        window.currentAudio.pause();
        // Reset icons would be complex without ID, simplified for now
    }
    window.currentAudio = audio;

    icon.className = 'fas fa-pause';
    audio.play();

    audio.ontimeupdate = () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
    };

    audio.onended = () => {
        icon.className = 'fas fa-play';
        progressBar.style.width = '0%';
    };
};

// Navigation helper for app-ui.js to use
function updateActiveNav(activeBtnId) {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Helper for UI to switch pages
function showPage(pageId) {
    // This duplicates some logic from app-ui but needed for independence or we export showPage from app-ui
    // Since we can't easily export showPage due to circular dependency risk, we toggle classes manually here
    // OR better: Use window.globalAdminTools or simple DOM manipulation
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });
}