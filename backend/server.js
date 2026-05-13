require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const leadRoutes = require('./routes/leads');
const whatsappRoutes = require('./routes/whatsapp');
const { initWhatsAppSessions } = require('./services/whatsappManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

global.io = io;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'WhatsApp AI Agency Backend Running' });
});

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  socket.on('disconnect', () => console.log('Disconnected:', socket.id));
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    await initWhatsAppSessions();
    server.listen(process.env.PORT || 5000, () => {
      console.log('Server running on port', process.env.PORT || 5000);
    });
  })
  .catch(err => {
    console.error('MongoDB error:', err);
    process.exit(1);
  });
