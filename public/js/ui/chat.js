import { state } from '../state.js';

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

export function initChat() {
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Emote buttons
    document.querySelectorAll('.emote-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const emote = btn.dataset.emote;
            state.socket.send(JSON.stringify({
                type: 'send_emote',
                gameId: state.gameId,
                emote: emote
            }));
            showFloatingEmote(emote, true);
        });
    });
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text && state.socket) {
        state.socket.send(JSON.stringify({
            type: 'chat_message',
            gameId: state.gameId,
            message: text
        }));
        chatInput.value = '';
    }
}

export function addChatMessage(sender, text, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMe ? 'me' : 'opponent'}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = isMe ? 'Moi' : sender;

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = text;

    msgDiv.appendChild(nameSpan);
    msgDiv.appendChild(textSpan);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function addSystemChatMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message system';
    msgDiv.style.cssText = 'align-self: center; background: #F0F0F0; color: #888; font-style: italic;';
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function showFloatingEmote(emote, isMe) {
    const el = document.createElement('div');
    el.textContent = emote;
    el.className = 'floating-emote';

    const randomX = (Math.random() - 0.5) * 100;
    const startX = isMe ? '70%' : '30%';
    el.style.left = `calc(${startX} + ${randomX}px)`;

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

export function handleChatMessage(data) {
    addChatMessage(data.senderUsername, data.message, data.senderId === state.playerId);
}

export function handleEmoteReceived(data) {
    if (data.senderId !== state.playerId) {
        showFloatingEmote(data.emote, false);
    }
}
