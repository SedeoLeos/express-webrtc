const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Initialisation de l'application Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques (HTML, JS, CSS)
app.use(express.static('public'));

// Quand un utilisateur se connecte
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté', socket.id);

    // Lorsqu'un utilisateur envoie une offre, la diffuser à tous les autres utilisateurs
    socket.on('offer', (data) => {
        socket.broadcast.emit('offer', data.offer, socket.id);
    });

    // Lorsqu'un utilisateur envoie une réponse, la diffuser à l'utilisateur cible
    socket.on('answer', (data) => {
        io.to(data.targetId).emit('answer', data.answer);
    });

    // Lorsqu'un utilisateur envoie un candidat ICE, le diffuser à tous les autres
    socket.on('candidate', (data) => {
        socket.broadcast.emit('candidate', data.candidate, data.targetId);
    });

    // Quand un utilisateur se déconnecte
    socket.on('disconnect', () => {
        console.log('Un utilisateur est déconnecté', socket.id);
    });
});

// Démarre le serveur
server.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
