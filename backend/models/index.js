const mongoose = require('mongoose');

// Agency Admin Model
const adminSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});

// Client Model (aapke clients)
const clientSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  businessName: String,
  whatsappNumber: String,
  sessionId: String,
  isConnected: { type: Boolean, default: false },
  aiPersonality: { type: String, default: 'helpful assistant' },
  businessContext: String, // client ka business kya hai
  plan: { type: String, default: 'basic' },
  createdAt: { type: Date, default: Date.now }
});

// Lead Model (client ke customers)
const leadSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  customerPhone: String,
  customerName: { type: String, default: 'Unknown' },
  score: { type: String, enum: ['hot', 'warm', 'cold'], default: 'cold' },
  scoreReason: String,
  totalMessages: { type: Number, default: 0 },
  lastMessage: String,
  lastActivity: { type: Date, default: Date.now },
  isResolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Conversation Model
const conversationSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  customerPhone: String,
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  Admin: mongoose.model('Admin', adminSchema),
  Client: mongoose.model('Client', clientSchema),
  Lead: mongoose.model('Lead', leadSchema),
  Conversation: mongoose.model('Conversation', conversationSchema)
};
