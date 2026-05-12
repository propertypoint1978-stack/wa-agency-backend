const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

// Register (first time setup)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await Admin.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Admin already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashed });
    const token = jwt.sign({ id: admin._id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, admin: { name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin._id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, admin: { name: admin.name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
