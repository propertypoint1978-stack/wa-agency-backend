const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Client, Lead, Conversation } = require('../models');
const { generateReply, scoreLead } = require('./aiService');

// Store active sessions
const sessions = {};

// Sessions folder
const SESSIONS_DIR = path.join(__dirname, '../sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

async function connectClient(clientId) {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found');

  // If already connected, return status
  if (sessions[clientId]?.connected) {
    return { status: 'already_connected' };
  }

  return new Promise(async (resolve) => {
    const sessionPath = path.join(SESSIONS_DIR, clientId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: require('pino')({ level: 'silent' })
    });

    sessions[clientId] = { sock, connected: false };

    // QR Code event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Generate QR and send to dashboard
        const qrImage = await QRCode.toDataURL(qr);
        global.io?.emit(`qr_${clientId}`, { qr: qrImage });
        resolve({ status: 'qr_generated', qr: qrImage });
      }

      if (connection === 'open') {
        sessions[clientId].connected = true;
        await Client.findByIdAndUpdate(clientId, { isConnected: true });
        global.io?.emit(`status_${clientId}`, { connected: true });
        console.log(`✅ Client ${client.name} WhatsApp connected`);
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true;

        sessions[clientId].connected = false;
        await Client.findByIdAndUpdate(clientId, { isConnected: false });
        global.io?.emit(`status_${clientId}`, { connected: false });

        if (shouldReconnect) {
          console.log(`🔄 Reconnecting client ${client.name}...`);
          setTimeout(() => connectClient(clientId), 5000);
        }
      }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue; // ignore own messages
        if (!msg.message) continue;

        const customerPhone = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
        if (!customerPhone) continue;

        // Get message text
        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || '';

        if (!text) continue;

        await handleIncomingMessage(clientId, client, customerPhone, text, sock);
      }
    });
  });
}

async function handleIncomingMessage(clientId, clientData, customerPhone, text, sock) {
  try {
    // Add delay to seem human (2-4 seconds)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    // Find or create lead
    let lead = await Lead.findOne({ clientId, customerPhone });
    if (!lead) {
      lead = await Lead.create({ clientId, customerPhone, totalMessages: 0 });
    }

    // Find or create conversation
    let conv = await Conversation.findOne({ clientId, leadId: lead._id });
    if (!conv) {
      conv = await Conversation.create({ clientId, leadId: lead._id, customerPhone, messages: [] });
    }

    // Add user message
    conv.messages.push({ role: 'user', content: text });
    conv.updatedAt = new Date();

    // Generate AI reply
    const reply = await generateReply(
      clientData.businessContext,
      clientData.aiPersonality,
      conv.messages,
      text
    );

    // Add assistant reply
    conv.messages.push({ role: 'assistant', content: reply });
    await conv.save();

    // Update lead
    lead.totalMessages += 1;
    lead.lastMessage = text;
    lead.lastActivity = new Date();

    // Score lead every 3 messages
    if (lead.totalMessages % 3 === 0 || lead.totalMessages === 1) {
      const { score, reason } = await scoreLead(conv.messages);
      lead.score = score;
      lead.scoreReason = reason;
    }

    await lead.save();

    // Send reply via WhatsApp
    await sock.sendMessage(`${customerPhone}@s.whatsapp.net`, { text: reply });

    // Notify dashboard
    global.io?.emit('new_message', {
      clientId,
      leadId: lead._id,
      customerPhone,
      score: lead.score,
      message: text,
      reply
    });

    console.log(`💬 [${clientData.name}] ${customerPhone}: ${text} → ${reply}`);
  } catch (err) {
    console.error('Message handling error:', err.message);
  }
}

async function disconnectClient(clientId) {
  if (sessions[clientId]?.sock) {
    await sessions[clientId].sock.logout();
    delete sessions[clientId];
    await Client.findByIdAndUpdate(clientId, { isConnected: false });
  }
}

function getSessionStatus(clientId) {
  return {
    connected: sessions[clientId]?.connected || false
  };
}

// On server start, reconnect all connected clients
async function initWhatsAppSessions() {
  const clients = await Client.find({ isConnected: true });
  console.log(`🔄 Restoring ${clients.length} WhatsApp sessions...`);
  for (const client of clients) {
    try {
      await connectClient(client._id.toString());
    } catch (err) {
      console.error(`Failed to restore session for ${client.name}:`, err.message);
    }
  }
}

module.exports = { connectClient, disconnectClient, getSessionStatus, initWhatsAppSessions };
