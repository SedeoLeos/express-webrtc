const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Initialisation du serveur Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static('public'));

// Liste des utilisateurs connectés
let users = [];

io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté :', socket.id);

    // Ajout de l'utilisateur dans la liste
    users.push(socket.id);

    // Notifier tous les autres utilisateurs qu'un nouvel utilisateur est connecté
    socket.broadcast.emit('new-user', socket.id);

    // Quand un utilisateur envoie une offre, l'émettre aux autres utilisateurs
    socket.on('offer', (data) => {
        socket.broadcast.emit('offer', data.offer, data.targetId);
    });

    // Quand un utilisateur envoie une réponse, l'envoyer à l'utilisateur cible
    socket.on('answer', (data) => {
        io.to(data.targetId).emit('answer', data.answer);
    });

    // Quand un utilisateur envoie un candidat ICE, l'envoyer aux autres
    socket.on('candidate', (data) => {
        socket.broadcast.emit('candidate', data.candidate, data.targetId);
    });

    // Quand un utilisateur se déconnecte, on le retire de la liste
    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté :', socket.id);
        users = users.filter((user) => user !== socket.id);
        socket.broadcast.emit('user-disconnected', socket.id);
    });
});

// Démarrage du serveur sur le port 3000
server.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
