const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideosContainer = document.getElementById("remoteVideosContainer");

let localStream;
let peerConnections = {};  // Utilisation d'un dictionnaire pour stocker les connexions par utilisateur
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function startCall() {
    try {
        // Vérification de la compatibilité du navigateur
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Votre navigateur ne supporte pas WebRTC.");
            return;
        }

        // Demander l'accès au micro et à la caméra
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        socket.emit('new-user', socket.id);  // Informer les autres utilisateurs de la connexion du nouvel utilisateur
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
    peerConnections[targetId] = peerConnection;  // Stocker la connexion pour ce utilisateur
});

// Réception de l'offre d'un autre utilisateur
socket.on('offer', async (offer, targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetId });
    peerConnections[targetId] = peerConnection;  // Stocker la connexion pour ce utilisateur
});

// Réception de la réponse à l'offre
socket.on('answer', async ({ answer, targetId }) => {
    const peerConnection = peerConnections[targetId];
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
        console.error(`Peer connection pour ${targetId} non trouvé`);
    }
});

// Réception des candidats ICE
socket.on('candidate', async ({ candidate, targetId }) => {
    const peerConnection = peerConnections[targetId];
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        console.error(`Peer connection pour ${targetId} non trouvé`);
    }
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
