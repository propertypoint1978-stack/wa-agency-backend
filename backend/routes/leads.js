const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Lead, Conversation } = require('../models');

// Get all leads (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const { clientId, score } = req.query;
    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (score) filter.score = score;

    const leads = await Lead.find(filter)
      .populate('clientId', 'name businessName')
      .sort({ lastActivity: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversation for a lead
router.get('/:leadId/conversation', auth, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ leadId: req.params.leadId });
    res.json(conv || { messages: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = clientId ? { clientId } : {};

    const [total, hot, warm, cold] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.countDocuments({ ...filter, score: 'hot' }),
      Lead.countDocuments({ ...filter, score: 'warm' }),
      Lead.countDocuments({ ...filter, score: 'cold' })
    ]);

    res.json({ total, hot, warm, cold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
