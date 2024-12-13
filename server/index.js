const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // Servez les fichiers frontend

let clients = [];

io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté :', socket.id);

    // Ajouter l'utilisateur à la liste des clients
    clients.push(socket);

    // Lorsque l'utilisateur envoie une offre
    socket.on('offer', (data) => {
        console.log('Offre reçue de', socket.id);
        // Émettre l'offre à tous les autres utilisateurs
        clients.forEach((client) => {
            if (client.id !== socket.id) {
                client.emit('offer', data);
            }
        });
    });

    // Lorsque l'utilisateur répond à une offre
    socket.on('answer', (data) => {
        console.log('Réponse reçue de', socket.id);
        // Émettre la réponse à l'utilisateur qui a fait l'offre
        clients.forEach((client) => {
            if (client.id === data.targetId) {
                client.emit('answer', data);
            }
        });
    });

    // Lorsqu'un utilisateur envoie un candidat ICE
    socket.on('candidate', (data) => {
        console.log('Candidat ICE reçu de', socket.id);
        // Émettre le candidat à tous les autres utilisateurs
        clients.forEach((client) => {
            if (client.id !== socket.id) {
                client.emit('candidate', data);
            }
        });
    });

    // Lorsque l'utilisateur se déconnecte
    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté :', socket.id);
        // Retirer l'utilisateur de la liste
        clients = clients.filter(client => client.id !== socket.id);
    });
});

server.listen(3000, () => console.log("Serveur en écoute sur http://localhost:3000"));
