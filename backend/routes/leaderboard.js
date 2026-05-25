const express = require('express');
const router = express.Router();
const User = require('../models/user');

router.get('/', async (req, res) => {
    try {
        // Sort by level descending, then xp descending
        const topPlayers = await User.find({ username: { $exists: true } })
                                     .sort({ level: -1, xp: -1 })
                                     .limit(100)
                                     .select('username level xp trophies');
                                     
        res.json(topPlayers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
