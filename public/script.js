const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideosContainer = document.getElementById("remoteVideosContainer");

let localStream;
let peerConnections = {};  // Dictionnaire pour stocker les connexions des autres utilisateurs
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Démarrage de l'appel
async function startCall() {
    try {
        // Vérifiez la compatibilité du navigateur
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Votre navigateur ne supporte pas WebRTC.");
            return;
        }

        // Demander l'accès au micro et à la caméra
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        socket.emit('new-user', socket.id);

    } catch (error) {
        console.error('Erreur de capture du média ou de WebRTC', error);
        alert('Erreur: ' + error.message);
    }
}

// Création de la connexion WebRTC pour un nouvel utilisateur
async function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(config);

    // Ajouter les pistes locales à la connexion
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Lorsqu'un flux distant arrive, afficher la vidéo
    peerConnection.ontrack = (event) => {
        let remoteVideo = document.getElementById(targetId);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = targetId;
            remoteVideo.autoplay = true;
            remoteVideo.playsinline = true;
            remoteVideosContainer.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    // Gérer les candidats ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, targetId });
        }
    };

    return peerConnection;
}

// Lorsqu'un utilisateur se connecte à un autre, créer une offre
socket.on('new-user', async (targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', { offer, targetId });
    peerConnections[targetId] = peerConnection;
});

// Réception de l'offre d'un autre utilisateur
socket.on('offer', async (offer, targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetId });
    peerConnections[targetId] = peerConnection;
});

// Réception de la réponse à l'offre
socket.on('answer', async ({ answer, targetId }) => {
    const peerConnection = peerConnections[targetId];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Réception des candidats ICE
socket.on('candidate', async ({ candidate, targetId }) => {
    const peerConnection = peerConnections[targetId];
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Gestion de la déconnexion des utilisateurs
socket.on('user-disconnected', (targetId) => {
    const remoteVideo = document.getElementById(targetId);
    if (remoteVideo) {
        remoteVideo.remove();
    }

    const peerConnection = peerConnections[targetId];
    if (peerConnection) {
        peerConnection.close();
        delete peerConnections[targetId];
    }
});

// Démarrer l'appel quand l'utilisateur clique sur le bouton
document.getElementById("startCall").addEventListener("click", startCall);
