// Video Chat UI - manages video bubbles and controls
import { state, updateState } from '../state.js';
import { webRTCManager } from '../webrtc/WebRTCManager.js';

// DOM elements
let videoContainer;
let localVideoBubble;
let localVideo;
let remoteVideosContainer;
let videoControls;
let toggleCameraBtn;
let toggleMicBtn;

// State
let cameraEnabled = false;
let micEnabled = false;

export function initVideoChat() {
    // Get DOM elements
    videoContainer = document.getElementById('video-container');
    localVideoBubble = document.getElementById('local-video-bubble');
    localVideo = document.getElementById('local-video');
    remoteVideosContainer = document.getElementById('remote-videos');
    videoControls = document.getElementById('video-controls');
    toggleCameraBtn = document.getElementById('toggle-camera');
    toggleMicBtn = document.getElementById('toggle-mic');

    if (!videoContainer || !videoControls) {
        console.warn('Video chat elements not found');
        return;
    }

    // Setup callbacks for WebRTC events
    webRTCManager.setCallbacks(onRemoteStream, onRemoteStreamEnded);

    // Setup button listeners
    toggleCameraBtn.addEventListener('click', toggleCamera);
    toggleMicBtn.addEventListener('click', toggleMic);

    // Initially hide local video bubble (shown when camera enabled)
    localVideoBubble.style.display = 'none';
}

export function showVideoControls() {
    if (videoControls) {
        videoControls.style.display = 'flex';
    }
}

export function hideVideoControls() {
    if (videoControls) {
        videoControls.style.display = 'none';
    }
}

async function toggleCamera() {
    try {
        if (!cameraEnabled) {
            const stream = await webRTCManager.enableCamera();
            localVideo.srcObject = stream;
            localVideoBubble.style.display = 'block';
            toggleCameraBtn.classList.add('active');
            toggleCameraBtn.innerHTML = '<span class="icon-camera"></span>';
            cameraEnabled = true;
            updateState({ cameraEnabled: true });
        } else {
            webRTCManager.disableCamera();
            // Check if we still have audio
            if (!micEnabled) {
                localVideo.srcObject = null;
                localVideoBubble.style.display = 'none';
            }
            toggleCameraBtn.classList.remove('active');
            toggleCameraBtn.innerHTML = '<span class="icon-camera-off"></span>';
            cameraEnabled = false;
            updateState({ cameraEnabled: false });
        }
    } catch (error) {
        console.error('Error toggling camera:', error);
        alert('Impossible d\'accéder à la caméra');
    }
}

async function toggleMic() {
    try {
        if (!micEnabled) {
            const stream = await webRTCManager.enableMicrophone();
            // Show local preview if camera is also on
            if (cameraEnabled) {
                localVideo.srcObject = stream;
            }
            toggleMicBtn.classList.add('active');
            toggleMicBtn.innerHTML = '<span class="icon-mic"></span>';
            micEnabled = true;
            updateState({ micEnabled: true });
        } else {
            webRTCManager.disableMicrophone();
            toggleMicBtn.classList.remove('active');
            toggleMicBtn.innerHTML = '<span class="icon-mic-off"></span>';
            micEnabled = false;
            updateState({ micEnabled: false });
        }
    } catch (error) {
        console.error('Error toggling microphone:', error);
        alert('Impossible d\'accéder au microphone');
    }
}

// Called when we receive a remote stream from a peer
function onRemoteStream(peerId, stream) {
    // Check if bubble already exists
    let bubble = document.getElementById(`video-bubble-${peerId}`);

    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = `video-bubble-${peerId}`;
        bubble.className = 'video-bubble remote-bubble';

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsinline = true;
        video.srcObject = stream;

        // Add username label
        const label = document.createElement('span');
        label.className = 'video-label';
        const username = state.sessionPlayers.find(p => p.id === peerId)?.username || 'Joueur';
        label.textContent = username;

        bubble.appendChild(video);
        bubble.appendChild(label);
        remoteVideosContainer.appendChild(bubble);
    } else {
        const video = bubble.querySelector('video');
        if (video) {
            video.srcObject = stream;
        }
    }
}

// Called when a remote stream ends
function onRemoteStreamEnded(peerId) {
    const bubble = document.getElementById(`video-bubble-${peerId}`);
    if (bubble) {
        bubble.remove();
    }
}

// Connect to all existing peers in the session
export function connectToSessionPeers(players) {
    players.forEach(player => {
        if (player.id !== state.playerId) {
            // Small delay to avoid race conditions
            setTimeout(() => {
                webRTCManager.connectToPeer(player.id);
            }, 100);
        }
    });
}

// Handle a new player joining - they will send us an offer
export function onNewPlayerJoined(playerId) {
    // The new player will initiate connection to us
    // We just need to be ready to respond to their offer
}

// Handle player leaving
export function onPlayerLeft(playerId) {
    webRTCManager.disconnectFromPeer(playerId);
}

// Cleanup when leaving session
export function cleanup() {
    webRTCManager.disconnectAll();

    // Reset UI
    if (localVideoBubble) {
        localVideoBubble.style.display = 'none';
    }
    if (localVideo) {
        localVideo.srcObject = null;
    }
    if (remoteVideosContainer) {
        remoteVideosContainer.innerHTML = '';
    }
    if (toggleCameraBtn) {
        toggleCameraBtn.classList.remove('active');
        toggleCameraBtn.innerHTML = '<span class="icon-camera-off"></span>';
    }
    if (toggleMicBtn) {
        toggleMicBtn.classList.remove('active');
        toggleMicBtn.innerHTML = '<span class="icon-mic-off"></span>';
    }

    cameraEnabled = false;
    micEnabled = false;
    updateState({ cameraEnabled: false, micEnabled: false });
}

// Handle WebRTC signaling messages
export function handleWebRTCMessage(data) {
    switch (data.type) {
        case 'webrtc_offer':
            webRTCManager.handleOffer(data.senderId, data.payload.sdp);
            break;
        case 'webrtc_answer':
            webRTCManager.handleAnswer(data.senderId, data.payload.sdp);
            break;
        case 'webrtc_ice_candidate':
            webRTCManager.handleIceCandidate(data.senderId, data.payload.candidate);
            break;
    }
}
