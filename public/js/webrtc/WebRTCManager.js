// WebRTC Manager - handles peer-to-peer audio/video connections
import { state } from '../state.js';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

class WebRTCManager {
    constructor() {
        this.peerConnections = {}; // { peerId: RTCPeerConnection }
        this.remoteStreams = {};   // { peerId: MediaStream }
        this.localStream = null;
        this.onRemoteStreamCallback = null;
        this.onRemoteStreamEndedCallback = null;
        this.isNegotiating = {};   // { peerId: boolean } - prevent negotiation loops
    }

    // Set callbacks for UI updates
    setCallbacks(onRemoteStream, onRemoteStreamEnded) {
        this.onRemoteStreamCallback = onRemoteStream;
        this.onRemoteStreamEndedCallback = onRemoteStreamEnded;
    }

    // Get local media stream (camera and/or microphone)
    async getLocalStream(video = true, audio = true) {
        try {
            const constraints = { video, audio };
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    // Enable camera
    async enableCamera() {
        if (!this.localStream) {
            await this.getLocalStream(true, false);
        } else if (!this.localStream.getVideoTracks().length) {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoStream.getVideoTracks().forEach(track => {
                this.localStream.addTrack(track);
            });
        }
        // Add video track to all existing connections
        this.addLocalTracksToConnections();
        return this.localStream;
    }

    // Enable microphone
    async enableMicrophone() {
        if (!this.localStream) {
            await this.getLocalStream(false, true);
        } else if (!this.localStream.getAudioTracks().length) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getAudioTracks().forEach(track => {
                this.localStream.addTrack(track);
            });
        }
        // Add audio track to all existing connections
        this.addLocalTracksToConnections();
        return this.localStream;
    }

    // Disable camera
    disableCamera() {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.stop();
                this.localStream.removeTrack(track);
            });
        }
    }

    // Disable microphone
    disableMicrophone() {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.stop();
                this.localStream.removeTrack(track);
            });
        }
    }

    // Add local tracks to all peer connections
    addLocalTracksToConnections() {
        if (!this.localStream) return;

        Object.entries(this.peerConnections).forEach(([peerId, pc]) => {
            const senders = pc.getSenders();
            this.localStream.getTracks().forEach(track => {
                const existingSender = senders.find(s => s.track?.kind === track.kind);
                if (existingSender) {
                    existingSender.replaceTrack(track);
                } else {
                    pc.addTrack(track, this.localStream);
                }
            });
        });
    }

    // Create a new peer connection
    createPeerConnection(peerId) {
        if (this.peerConnections[peerId]) {
            return this.peerConnections[peerId];
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        this.peerConnections[peerId] = pc;
        this.isNegotiating[peerId] = false;

        // Add local stream tracks if available
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Handle incoming tracks
        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream && this.onRemoteStreamCallback) {
                this.remoteStreams[peerId] = stream;
                this.onRemoteStreamCallback(peerId, stream);
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && state.socket) {
                state.socket.send(JSON.stringify({
                    type: 'webrtc_ice_candidate',
                    targetId: peerId,
                    payload: { candidate: event.candidate }
                }));
            }
        };

        // Handle renegotiation needed (when tracks are added after connection)
        pc.onnegotiationneeded = async () => {
            if (this.isNegotiating[peerId]) return;

            try {
                this.isNegotiating[peerId] = true;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                if (state.socket) {
                    state.socket.send(JSON.stringify({
                        type: 'webrtc_offer',
                        targetId: peerId,
                        payload: { sdp: pc.localDescription }
                    }));
                }
            } catch (error) {
                console.error('Error during renegotiation:', error);
            } finally {
                this.isNegotiating[peerId] = false;
            }
        };

        // Handle signaling state changes
        pc.onsignalingstatechange = () => {
            if (pc.signalingState === 'stable') {
                this.isNegotiating[peerId] = false;
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.handlePeerDisconnected(peerId);
            }
        };

        return pc;
    }

    // Initiate connection to a peer (send offer)
    async connectToPeer(peerId) {
        const pc = this.createPeerConnection(peerId);

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (state.socket) {
                state.socket.send(JSON.stringify({
                    type: 'webrtc_offer',
                    targetId: peerId,
                    payload: { sdp: pc.localDescription }
                }));
            }
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    // Handle incoming offer
    async handleOffer(peerId, offer) {
        let pc = this.peerConnections[peerId];

        // If no connection exists, create one
        if (!pc) {
            pc = this.createPeerConnection(peerId);
        }

        try {
            // Handle glare (both peers sending offers)
            const offerCollision = pc.signalingState !== 'stable';

            if (offerCollision) {
                // We're polite - we'll accept their offer and abandon ours
                await Promise.all([
                    pc.setLocalDescription({ type: 'rollback' }),
                    pc.setRemoteDescription(new RTCSessionDescription(offer))
                ]);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (state.socket) {
                state.socket.send(JSON.stringify({
                    type: 'webrtc_answer',
                    targetId: peerId,
                    payload: { sdp: pc.localDescription }
                }));
            }
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    // Handle incoming answer
    async handleAnswer(peerId, answer) {
        const pc = this.peerConnections[peerId];
        if (!pc) return;

        try {
            // Only set remote description if we're expecting an answer
            if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    // Handle incoming ICE candidate
    async handleIceCandidate(peerId, candidate) {
        const pc = this.peerConnections[peerId];
        if (!pc) return;

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    // Handle peer disconnection
    handlePeerDisconnected(peerId) {
        if (this.peerConnections[peerId]) {
            this.peerConnections[peerId].close();
            delete this.peerConnections[peerId];
        }

        if (this.remoteStreams[peerId]) {
            delete this.remoteStreams[peerId];
        }

        if (this.onRemoteStreamEndedCallback) {
            this.onRemoteStreamEndedCallback(peerId);
        }
    }

    // Disconnect from a specific peer
    disconnectFromPeer(peerId) {
        this.handlePeerDisconnected(peerId);
    }

    // Disconnect from all peers and cleanup
    disconnectAll() {
        Object.keys(this.peerConnections).forEach(peerId => {
            this.disconnectFromPeer(peerId);
        });

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    // Get list of connected peer IDs
    getConnectedPeers() {
        return Object.keys(this.peerConnections);
    }
}

// Singleton instance
export const webRTCManager = new WebRTCManager();
