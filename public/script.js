const socket = io();
const localVideo = document.getElementById("localVideo");

let localStream;
let peerConnections = {}; // Pour gérer les connexions WebRTC de chaque utilisateur
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Serveur STUN gratuit de Google
    ],
};

// Fonction pour démarrer l'appel
async function startCall() {
    try {
        // Vérifiez si le navigateur supporte getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Votre navigateur ne supporte pas WebRTC. Veuillez utiliser un navigateur récent.");
            return;
        }

        // Demander la permission pour la caméra et le micro
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Associer le flux vidéo local à l'élément vidéo
        localVideo.srcObject = localStream;

        // Signaler au serveur qu'un utilisateur se connecte
        socket.emit("new-user", socket.id);

    } catch (error) {
        console.error("Erreur lors de la capture du média ou de la configuration WebRTC :", error);
        alert("Impossible de démarrer l'appel : " + error.message);
    }
}

// Fonction pour créer une nouvelle connexion WebRTC
async function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(config);

    // Ajouter les pistes locales à la connexion
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Lorsqu'un flux distant arrive, l'afficher dans un nouveau <video> élément
    peerConnection.ontrack = (event) => {
        let remoteVideo = document.getElementById(targetId);
        if (!remoteVideo) {
            console.log('new flux')
            remoteVideo = document.createElement("video");
            remoteVideo.id = targetId;
            remoteVideo.autoplay = true;
            remoteVideo.playsinline = true;
            document.getElementById("remoteVideosContainer").appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
        console.log('new flux')
    };

    // Gérer les ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("candidate", { candidate: event.candidate, targetId });
        }
    };

    return peerConnection;
}

// Quand l'utilisateur reçoit une offre, il doit y répondre
socket.on("offer", async (offer, targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", { answer, targetId });
    peerConnections[targetId] = peerConnection;
});

// Quand l'utilisateur reçoit une réponse à son offre
socket.on("answer", async ({ answer, targetId }) => {
    const peerConnection = peerConnections[targetId];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Quand l'utilisateur reçoit un candidat ICE
socket.on("candidate", async ({ candidate, targetId }) => {
    const peerConnection = peerConnections[targetId];
    if (candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// Quand un nouvel utilisateur se connecte, on crée une connexion WebRTC pour lui
socket.on("new-user", async (targetId) => {
    const peerConnection = await createPeerConnection(targetId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", { offer, targetId });
    peerConnections[targetId] = peerConnection;
});

document.getElementById("startCall").addEventListener("click", startCall);
