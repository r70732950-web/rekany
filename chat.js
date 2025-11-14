import {
    db, auth, storage,
    chatsCollection, ordersCollection, usersCollection,
    serverTimestamp,
    ref, uploadBytes, getDownloadURL,
    onAuthStateChanged, // [ 💡 زیادکرا ]
    getDoc, doc // [ 💡 زیادکرا ]
} from './app-setup.js';

import {
    state, t, saveCart,
    authReadyPromise // [ 💡 زیادکرا ]
} from './app-core.js';

import {
    showNotification, openPopup, closeCurrentPopup
} from './app-ui.js';

import {
    collection, addDoc, query, where, orderBy, onSnapshot,
    setDoc, updateDoc, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let activeChatUserId = null;

// --- [ 💡 بەشی نوێ بۆ تۆمارکردنی دەنگ ] ---
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = 0;
let recordTimerInterval = null;
let isRecording = false;
let isCancelled = false;
let startX = 0; // شوێنی دەستپێکی پەنجە
const CANCEL_THRESHOLD = -50; // چەندێک ڕایبکێشێت بۆ ڕەتکردنەوە (بۆ RTL)
// --- [ کۆتایی بەشی نوێ ] ---

export function initChatSystem() {
    setupChatUI();
    setupChatListeners();
    checkUnreadMessages();
}

function setupChatUI() {
    const cartActions = document.getElementById('cartActions');
    if (cartActions) {
        const existingBtn = cartActions.querySelector('.direct-order-btn');
        if (existingBtn) existingBtn.remove();

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

    const chatPage = document.getElementById('chatPage');

    if (chatPage && !chatPage.querySelector('.chat-container')) {
        chatPage.innerHTML = `
            <div class="chat-container">
                <div class="chat-header" id="chatPageHeader">
                    <div style="display:flex; align-items:center; gap:10px; width: 100%;">
                        <button id="chatBackBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--primary-color); padding: 5px;">
                            <i class="fas fa-arrow-right"></i>
                        </button>

                        <div class="conversation-avatar" id="chatHeaderAvatar"><i class="fas fa-user"></i></div>
                        <div style="flex: 1;">
                            <div class="conversation-name" id="chatHeaderName">User</div>
                            <div class="conversation-time" id="chatHeaderStatus"><span class="chat-status-dot online"></span> ${t('online')}</div>
                        </div>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessagesArea">
                    </div>
                <div class="typing-indicator" id="typingIndicator">${t('typing')}</div>

                <!-- [ 💡 گۆڕدرا ] : زیادکردنی نیشاندەری تۆمارکردن -->
                <div class="record-indicator" id="recordIndicator">
                    <i class="fas fa-trash-alt" id="recordCancelIcon"></i>
                    <span id="recordTimer">0:00</span>
                    <span><i class="fas fa-arrow-left"></i> ${t('slide_to_cancel')}</span>
                </div>

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

    const adminChatListPage = document.getElementById('adminChatListPage');
    if (adminChatListPage && !adminChatListPage.querySelector('.conversation-list')) {
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
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.onclick = () => {
            openChatPage();
        };
    }

    const adminChatsBtn = document.getElementById('adminChatsBtn');
    if (adminChatsBtn) {
        adminChatsBtn.onclick = () => {
            openAdminChatList();
        };
    }

    document.addEventListener('click', (e) => {
        const backBtn = e.target.closest('#chatBackBtn');
        if (backBtn) {
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';
            history.back();
        }
    });

    // [ 💡 گۆڕدرا ] : بەکارهێنانی setTimeout بۆ دڵنیابوونەوە لە بوونی دوگمەکان
    setTimeout(() => {
        const textInput = document.getElementById('chatTextInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const voiceBtn = document.getElementById('chatVoiceBtn');
        const imageBtn = document.getElementById('chatImageBtn');
        const imageInput = document.getElementById('chatImageInput');

        if (textInput) {
            textInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val.length > 0) {
                    if (sendBtn) sendBtn.style.display = 'flex';
                    if (voiceBtn) voiceBtn.style.display = 'none';
                } else {
                    if (sendBtn) sendBtn.style.display = 'none';
                    if (voiceBtn) voiceBtn.style.display = 'flex';
                }
            });

            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage('text');
            });
        }

        if (sendBtn) sendBtn.onclick = () => sendMessage('text');

        if (voiceBtn) {
            // [ 💡 گۆڕدرا ] : بەکارهێنانی touch events بۆ تۆمارکردن
            voiceBtn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // ڕێگری لە scroll
                startX = e.touches[0].clientX;
                isCancelled = false;
                startRecording();
            });
            voiceBtn.addEventListener('touchmove', (e) => {
                if (!isRecording) return;
                const currentX = e.touches[0].clientX;
                const deltaX = currentX - startX; // لە RTL دەبێت negative بێت بۆ cancel

                const indicator = document.getElementById('recordIndicator');
                if (deltaX < CANCEL_THRESHOLD) { // ئەگەر زیاتر لە 50px ڕاکێشرا
                    isCancelled = true;
                    indicator.classList.add('cancelled');
                } else {
                    isCancelled = false;
                    indicator.classList.remove('cancelled');
                }
            });
            voiceBtn.addEventListener('touchend', (e) => {
                stopRecording();
            });
            voiceBtn.addEventListener('touchcancel', (e) => {
                isCancelled = true; // ئەگەر شتێک ڕووبدات (وەک تەلەفۆن)
                stopRecording();
            });
        }

        if (imageBtn && imageInput) {
            imageBtn.onclick = () => imageInput.click();
            imageInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    sendMessage('image', e.target.files[0]);
                }
            };
        }
    }, 1000); // دواخستن بۆ دڵنیابوونەوە
}

// [ 💡 فەنکشنی نوێ ] : دەستپێکردنی تۆمار
async function startRecording() {
    if (isRecording) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        isCancelled = false;

        const inputArea = document.getElementById('chatInputArea');
        const indicator = document.getElementById('recordIndicator');
        const timerSpan = document.getElementById('recordTimer');
        const voiceBtn = document.getElementById('chatVoiceBtn');

        inputArea.classList.add('recording');
        indicator.classList.add('visible');
        voiceBtn.classList.add('recording');

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
        mediaRecorder.onstop = async () => {
            isRecording = false;
            inputArea.classList.remove('recording');
            indicator.classList.remove('visible', 'cancelled');
            voiceBtn.classList.remove('recording');
            clearInterval(recordTimerInterval);
            timerSpan.textContent = '0:00';

            // کوژاندنەوەی stream
            stream.getTracks().forEach(track => track.stop());

            if (isCancelled) {
                console.log("تۆمار ڕەتکرایەوە");
                return;
            }

            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendMessage('audio', audioBlob);
            }
        };

        mediaRecorder.start();
        recordStartTime = Date.now();
        recordTimerInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - recordStartTime) / 1000);
            timerSpan.textContent = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        }, 1000);

    } catch (err) {
        console.error("Mic Error:", err);
        showNotification('دەسەڵاتی مایکڕۆفۆن نەدراوە', 'error');
        isRecording = false;
    }
}

// [ 💡 فەنکشنی نوێ ] : وەستاندنی تۆمار
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}


export async function openChatPage(targetUserId = null, targetUserName = null) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // شاردنەوەی لیستی خوارەوە
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    // گۆڕینی URL
    if (window.location.hash !== '#chat' && !targetUserId) {
        history.pushState({ type: 'page', id: 'chatPage', title: t('chat_title') }, '', '#chat');
    }

    // نیشاندانی لاپەڕەی چات
    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'chatPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    // نیشاندانی لۆدەری کاتیی
    const msgArea = document.getElementById('chatMessagesArea');
    if (msgArea) {
        msgArea.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%; color:var(--dark-gray);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        msgArea.style.display = 'flex';
    }
    
    // [ 💡 چاککراوە ] : چاوەڕێی ئامادەبوونی Auth دەکەین
    await authReadyPromise;
    
    // 1. ئەگەر ئەدمینە و دیاری نەکراوە لەگەڵ کێ قسە دەکات
    if (isAdmin && !targetUserId) {
        openAdminChatList();
        return;
    }

    // 2. ئەگەر بەکارهێنەر نییە (lمەبەست state.currentUser) و ئەدمینیش نییە
    if (!state.currentUser && !isAdmin) {
        const loginReq = document.getElementById('chatLoginRequired');
        const inputArea = document.getElementById('chatInputArea');

        if (loginReq) loginReq.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'none';
        if (msgArea) msgArea.style.display = 'none';
        return;
    }

    // 3. ئەگەر لۆگین بووە
    const loginReq = document.getElementById('chatLoginRequired');
    const inputArea = document.getElementById('chatInputArea');

    if (loginReq) loginReq.style.display = 'none';
    if (inputArea) inputArea.style.display = 'flex';

    if (msgArea) {
        msgArea.innerHTML = '';
        msgArea.classList.add('hidden');
    }

    if (isAdmin) {
        activeChatUserId = targetUserId;
        const headerName = document.getElementById('chatHeaderName');
        if (headerName) {
            if (targetUserName) {
                headerName.textContent = targetUserName;
            } else {
                headerName.textContent = "...";
                getDoc(doc(db, "chats", targetUserId)).then(docSnap => {
                    if (docSnap.exists()) {
                        const chatData = docSnap.data();
                        headerName.textContent = chatData.userInfo?.displayName || "بەکارهێنەر";
                    } else {
                        headerName.textContent = "بەکارهێنەر";
                    }
                }).catch(() => {
                    headerName.textContent = "بەکارهێنەر";
                });
            }
        }
    } else {
        activeChatUserId = state.currentUser.uid;
        const headerName = document.getElementById('chatHeaderName');
        if (headerName) headerName.textContent = t('admin_badge');
    }

    subscribeToMessages(activeChatUserId);
}

function openAdminChatList() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';

    history.pushState({ type: 'page', id: 'adminChatListPage', title: t('conversations_title') }, '', '#admin-chats');

    document.querySelectorAll('.page').forEach(page => {
        const isActive = page.id === 'adminChatListPage';
        page.classList.toggle('page-active', isActive);
        page.classList.toggle('page-hidden', !isActive);
    });

    subscribeToAllConversations();
}

function subscribeToMessages(chatUserId) {
    if (messagesUnsubscribe) messagesUnsubscribe();

    const messagesRef = collection(db, "chats", chatUserId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const msgArea = document.getElementById('chatMessagesArea');

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (!msgArea) return;

        msgArea.innerHTML = '';

        if (snapshot.empty) {
            msgArea.innerHTML = `<div class="empty-chat-state"><i class="fas fa-comments"></i><p>${t('no_messages')}</p></div>`;
            msgArea.classList.remove('hidden');
            return;
        }

        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            renderSingleMessage(msg, msgArea, chatUserId);
        });

        msgArea.scrollTop = msgArea.scrollHeight;

        setTimeout(() => {
            msgArea.classList.remove('hidden');
        }, 50);

        markMessagesAsRead(snapshot.docs, chatUserId);
    });
}

function renderSingleMessage(msg, container, chatUserId) {
    // [ 💡 چاککراوە ] : دڵنیابوونەوە لەوەی senderId هەیە
    const currentUserId = state.currentUser ? state.currentUser.uid : null;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    let isMe;
    if (isAdmin) {
        isMe = msg.senderId === 'admin';
    } else {
        isMe = msg.senderId === currentUserId;
    }
    
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
        if(order && order.items) {
            contentHtml = `
                <div class="order-bubble">
                    <div class="order-bubble-header"><i class="fas fa-receipt"></i> ${t('order_notification_title')}</div>
                    <div class="order-bubble-content">
                        ${order.items.map(i => {
                            const shipping = i.shippingCost || 0;
                            const singleTotal = (i.price * i.quantity) + shipping;
                            
                            let priceDisplay = '';
                            if (shipping > 0) {
                                priceDisplay = `
                                    <div style="font-size:11px; color:#555;">
                                        (${i.price.toLocaleString()} x ${i.quantity}) + <span style="color:#e53e3e;">${shipping.toLocaleString()} (گەیاندن)</span>
                                    </div>
                                    <div style="font-weight:bold; color:var(--primary-color);">
                                        = ${singleTotal.toLocaleString()} د.ع
                                    </div>
                                `;
                            } else {
                                priceDisplay = `
                                    <div style="font-size:11px; color:#555;">
                                        (${i.price.toLocaleString()} x ${i.quantity}) + <span style="color:#38a169;">(بێ بەرامبەر)</span>
                                    </div>
                                    <div style="font-weight:bold; color:var(--primary-color);">
                                        = ${singleTotal.toLocaleString()} د.ع
                                    </div>
                                `;
                            }

                            return `
                            <div class="order-bubble-item" style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <img src="${i.image || 'https://placehold.co/50'}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid #eee;">
                                <div style="flex: 1; overflow: hidden;">
                                    <div style="font-weight: bold; font-size: 13px;">
                                        ${i.name && i.name[state.currentLanguage] ? i.name[state.currentLanguage] : (i.name.ku_sorani || i.name)}
                                    </div>
                                    
                                    ${priceDisplay}
                                    
                                    <div style="font-size: 12px; color: #666; margin-top:2px;">
                                        ژمارە: <span style="color:black; font-weight:bold;">${i.quantity}</span>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                        
                        <div class="order-bubble-total" style="margin-top: 10px; font-size: 16px; text-align:center; background:#f1f1f1; padding:5px; border-radius:4px;">
                            کۆی گشتی: ${order.total.toLocaleString()} د.ع
                        </div>

                        <div style="background-color: #fff; border:1px solid #eee; padding: 8px; border-radius: 6px; margin-top: 10px; font-size: 12px; color: #444;">
                            <div style="margin-bottom: 4px;"><i class="fas fa-user" style="width: 15px; text-align: center;"></i> ${order.userName || 'ناو نەنوسراوە'}</div>
                            <div style="margin-bottom: 4px;"><i class="fas fa-phone" style="width: 15px; text-align: center;"></i> <a href="tel:${order.userPhone}" style="color: inherit; text-decoration: none;">${order.userPhone || 'ژمارە نییە'}</a></div>
                            <div><i class="fas fa-map-marker-alt" style="width: 15px; text-align: center;"></i> ${order.userAddress || 'ناونیشان نییە'}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `<p>داواکاری (هەڵە لە داتا)</p>`;
        }
    }

    const date = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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
    let content = '';
    
    if (textInput) {
        content = textInput.value.trim();
    }
    
    if (type === 'text' && !content) return;

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const senderId = isAdmin ? 'admin' : state.currentUser.uid;
    const docId = isAdmin ? activeChatUserId : state.currentUser.uid;

    if (!docId) {
        console.error("No recipient ID found.");
        return;
    }

    const messageData = {
        senderId: senderId,
        receiverId: isAdmin ? activeChatUserId : 'admin',
        type: type,
        content: type === 'text' ? content : '',
        timestamp: serverTimestamp(),
        isRead: false
    };

    try {
        if (type === 'text' && textInput) {
            textInput.value = '';
            const sendBtn = document.getElementById('chatSendBtn');
            const voiceBtn = document.getElementById('chatVoiceBtn');
            if(sendBtn) sendBtn.style.display = 'none';
            if(voiceBtn) voiceBtn.style.display = 'flex';
        }

        if (file) {
            showNotification('...Uploading', 'success');
            const storageRef = ref(storage, `chats/${docId}/${Date.now()}_${file.name || 'audio.webm'}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            messageData.fileUrl = downloadURL;
        }

        if (type === 'order') {
            messageData.orderDetails = orderData;
        }

        const messagesRef = collection(db, "chats", docId, "messages");
        await addDoc(messagesRef, messageData);

        const chatDocRef = doc(db, "chats", docId);
        const chatUpdateData = {
            lastMessage: type === 'text' ? content : (type === 'image' ? '📷 Image' : (type === 'audio' ? '🎤 Audio' : '📦 Order')),
            lastMessageTime: serverTimestamp(),
            isReadByAdmin: isAdmin, 
            isReadByUser: !isAdmin  
        };

        if (!isAdmin) {
            chatUpdateData.userInfo = {
                displayName: state.currentUser.displayName || 'Unknown',
                email: state.currentUser.email,
                uid: state.currentUser.uid
            };
        }

        await setDoc(chatDocRef, chatUpdateData, { merge: true });

    } catch (error) {
        console.error("Send Message Error:", error);
        showNotification(t('error_generic'), 'error');
    }
}

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

    if (!state.userProfile.phone || !state.userProfile.address) {
        showNotification('تکایە سەرەتا زانیارییەکانت (ناونیشان و تەلەfۆن) لە پڕۆfایل پڕبکەرەوە', 'error');
        openPopup('profileSheet');
        return;
    }

    window.globalAdminTools.openPopup('orderConfirmationModal', 'modal');

    const confirmBtn = document.getElementById('confirmOrderBtn');
    const cancelBtn = document.getElementById('cancelOrderBtn');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.onclick = () => {
        window.globalAdminTools.closeCurrentPopup();
    };

    newConfirmBtn.onclick = async () => {
        history.go(-2);
        setTimeout(() => {
             processOrderSubmission();
        }, 150);
    };
}

async function processOrderSubmission() {
    const total = state.cart.reduce((sum, item) => {
        return sum + (item.price * item.quantity) + (item.shippingCost || 0);
    }, 0);
    
    const orderData = {
        userId: state.currentUser.uid,
        userName: state.userProfile.name || state.currentUser.displayName, 
        userPhone: state.userProfile.phone || '', 
        userAddress: state.userProfile.address || '', 
        items: state.cart,
        total: total,
        status: 'pending', 
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(ordersCollection, orderData);
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

function subscribeToAllConversations() {
    if (conversationsUnsubscribe) conversationsUnsubscribe();

    const q = query(chatsCollection, orderBy("lastMessageTime", "desc"));
    const container = document.getElementById('adminConversationList');

    conversationsUnsubscribe = onSnapshot(q, (snapshot) => {
        if(!container) return;
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

            const displayName = data.userInfo?.displayName || 'بەکارهێنەر';

            const div = document.createElement('div');
            div.className = `conversation-item ${isUnread ? 'unread' : ''}`;
            div.innerHTML = `
                <div class="conversation-avatar"><i class="fas fa-user"></i></div>
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${displayName}
                        <span class="conversation-time">${timeStr}</span>
                    </div>
                    <div class="conversation-last-msg">
                        ${isUnread ? `<span class="unread-count">New</span>` : ''}
                        ${data.lastMessage}
                    </div>
                </div>
            `;
            div.onclick = () => {
                openChatPage(doc.id, displayName);
            };
            container.appendChild(div);
        });

        const badge = document.getElementById('adminUnreadBadge');
        if(badge) {
            badge.textContent = unreadTotal;
            badge.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
        }
    });
}

async function markMessagesAsRead(msgDocs, chatUserId) {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const batch = writeBatch(db);
    let hasUpdates = false;

    msgDocs.forEach(docSnap => {
        const msg = docSnap.data();
        const amIReceiver = (isAdmin && msg.receiverId === 'admin') || (!isAdmin && state.currentUser && msg.receiverId === state.currentUser.uid);
        
        if (amIReceiver && !msg.isRead) {
            batch.update(docSnap.ref, { isRead: true });
            hasUpdates = true;
        }
    });

    if (hasUpdates) {
        const chatDocRef = doc(db, "chats", chatUserId);
        const fieldToUpdate = isAdmin ? { isReadByAdmin: true } : { isReadByUser: true };
        batch.update(chatDocRef, fieldToUpdate);
        
        await batch.commit();
    }
}

function checkUnreadMessages() {
    if (sessionStorage.getItem('isAdmin') === 'true') return; 
    
    // [ 💡 چاککراوە ] : گوێگرتن لە onAuthStateChanged
    onAuthStateChanged(auth, (user) => {
        if (user) {
            onSnapshot(doc(db, "chats", user.uid), (docSnap) => {
                const badge = document.getElementById('chatBadge');
                if (badge) {
                    if (docSnap.exists() && !docSnap.data().isReadByUser) {
                        badge.classList.add('has-unread');
                    } else {
                        badge.classList.remove('has-unread');
                    }
                }
            });
        } else {
            // ئەگەر لۆگ ئاوت بوو
            const badge = document.getElementById('chatBadge');
            if (badge) {
                badge.classList.remove('has-unread');
            }
        }
    });
}

window.playAudio = function(btn, url) {
    const audio = new Audio(url);
    const player = btn.closest('.audio-player');
    const progressBar = player.querySelector('.audio-progress-bar');
    const icon = btn.querySelector('i');

    if (window.currentAudio && window.currentAudio !== audio) {
        window.currentAudio.pause();
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