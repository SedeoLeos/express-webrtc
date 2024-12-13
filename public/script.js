const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideosContainer = document.getElementById("remoteVideosContainer");

let localStream;
let peerConnections = {};  // Stockage des connexions pour chaque utilisateur
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
        
        // Vérification que le flux local est bien récupéré
        if (!localStream) {
            alert("Impossible d'obtenir le flux vidéo et audio.");
            return;
        }

        // Afficher le flux local dans l'élément vidéo local
        localVideo.srcObject = localStream;

        // Informer le serveur qu'un nouvel utilisateur s'est connecté
        socket.emit('new-user', socket.id);
    } catch (error) {
        console.error('Erreur de capture du média ou de WebRTC', error);
        alert('Erreur: ' + error.message);
    }
}

// Fonction pour créer une connexion WebRTC pour un nouvel utilisateur
async function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(config);

    // Vérification du flux local
    if (!localStream) {
        console.error("Flux local non défini. Impossible de créer la connexion.");
        return;
    }

    // Ajouter les pistes locales à la connexion
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Lorsque le flux distant est reçu, l'ajouter à l'élément vidéo
    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];

        // Vérification que le flux distant est valide
        if (remoteStream) {
            let remoteVideo = document.getElementById(targetId);
            if (!remoteVideo) {
                remoteVideo = document.createElement('video');
                remoteVideo.id = targetId;
                remoteVideo.autoplay = true;
                remoteVideo.playsinline = true;
                remoteVideosContainer.appendChild(remoteVideo);
            }
            remoteVideo.srcObject = remoteStream;
        } else {
            console.error("Flux vidéo distant introuvable.");
        }
    };

    // Gestion des candidats ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, targetId });
        }
    };

    return peerConnection;
}

// Lorsqu'un utilisateur se connecte, envoyer une offre à l'autre utilisateur
socket.on('new-user', async (targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Envoyer l'offre à l'autre utilisateur
    socket.emit('offer', { offer, targetId });
    peerConnections[targetId] = peerConnection;  // Stocker la connexion pour cet utilisateur
});

// Lorsqu'une offre est reçue, créer une réponse
socket.on('offer', async (offer, targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Envoyer la réponse à l'utilisateur qui a envoyé l'offre
    socket.emit('answer', { answer, targetId });
    peerConnections[targetId] = peerConnection;  // Stocker la connexion pour cet utilisateur
});

// Lorsqu'une réponse est reçue, la définir comme description distante
socket.on('answer', async ({ answer, targetId }) => {
    const peerConnection = peerConnections[targetId];
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
        console.error(`Peer connection pour ${targetId} non trouvé`);
    }
});

// Ajouter un candidat ICE à la connexion WebRTC
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

// Démarrer l'appel lorsque l'utilisateur clique sur le bouton
document.getElementById("startCall").addEventListener("click", startCall);
