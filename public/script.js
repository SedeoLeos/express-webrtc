const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Serveur STUN gratuit de Google
    ],
};

async function startCall() {
    try {
        // Vérifiez si le navigateur supporte getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Votre navigateur ne supporte pas WebRTC. Veuillez utiliser un navigateur récent.");
            return;
        }

        // Demander la permission pour la caméra et le micro
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Associer le flux vidéo local à l'élément vidéo
        const localVideo = document.getElementById("localVideo");
        localVideo.srcObject = localStream;

        // Configuration de la connexion WebRTC
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById("remoteVideo");
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("candidate", event.candidate);
            }
        };

        // Créer une offre et l'envoyer via Socket.IO
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", offer);

    } catch (error) {
        console.error("Erreur lors de la capture du média ou de la configuration WebRTC :", error);
        alert("Impossible de démarrer l'appel : " + error.message);
    }
}

socket.on("offer", async (offer) => {
    if (!peerConnection) startCall();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
});

socket.on("answer", async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async (candidate) => {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

document.getElementById("startCall").addEventListener("click", startCall);
