const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { connectClient, disconnectClient, getSessionStatus } = require('../services/whatsappManager');

// Connect a client (generate QR)
router.post('/connect/:clientId', auth, async (req, res) => {
  try {
    const result = await connectClient(req.params.clientId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect a client
router.post('/disconnect/:clientId', auth, async (req, res) => {
  try {
    await disconnectClient(req.params.clientId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session status
router.get('/status/:clientId', auth, async (req, res) => {
  try {
    const status = getSessionStatus(req.params.clientId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
