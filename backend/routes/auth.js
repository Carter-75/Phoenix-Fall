const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcryptjs');

// --- Local Auth ---
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
    
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
        return res.status(400).json({ message: 'Email is already registered' });
    }

    const tempUser = {
        isTemp: true,
        isLocal: true,
        email: email.toLowerCase(),
        password: password
    };
    
    req.login(tempUser, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(tempUser);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message || 'Login failed' });
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(user);
    });
  })(req, res, next);
});

// --- Complete Google / Local Signup ---
router.post('/complete-signup', async (req, res) => {
    try {
        if (!req.isAuthenticated() || !req.user.isTemp) {
            return res.status(401).json({ message: 'Unauthorized or not in temp state' });
        }
        const { username } = req.body;
        if (!username) return res.status(400).json({ message: 'Username required' });
        
        let existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ message: 'Username is taken' });
        
        let newUserConfig = {
            username: username,
            email: req.user.email,
            acceptedLegalPolicies: true
        };

        if (req.user.isLocal) {
            newUserConfig.password = req.user.password;
        } else {
            newUserConfig.googleId = req.user.googleId;
        }

        const newUser = await User.create(newUserConfig);
        
        req.login(newUser, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(newUser);
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Google Auth ---

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    const frontendUrl = process.env.PROD_FRONTEND_URL || 'http://localhost:4200';
    if (err || !user) {
      return res.redirect(`${frontendUrl}?error=google`);
    }
    
    req.login(user, (err) => {
      if (err) return next(err);
      if (user.isTemp) {
          return res.redirect(`${frontendUrl}?mode=set-username`);
      }
      res.redirect(`${frontendUrl}`);
    });
  })(req, res, next);
});

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google/native', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'No ID token provided' });

        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: [
                process.env.GOOGLE_CLIENT_ID,
                '108585498879-o171u9a80ssqfkojpd8hohgq6dumk0iu.apps.googleusercontent.com'
            ],
        });
        const payload = ticket.getPayload();
        
        let user = await User.findOne({ googleId: payload.sub });
        if (!user) {
            user = await User.findOne({ email: payload.email });
        }
        
        if (!user) {
            const tempUser = {
                isTemp: true,
                googleId: payload.sub,
                email: payload.email,
            };
            req.login(tempUser, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                return res.json(tempUser);
            });
        } else {
            req.login(user, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                return res.json(user);
            });
        }
    } catch (err) {
        console.error('Native Google Auth Error:', err);
        res.status(500).json({ error: err.message });
    }
});


// --- Common ---
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) res.json(req.user);
  else res.status(401).json({ message: 'Not authenticated' });
});

router.post('/sync', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = req.user;
    if (req.body.coins !== undefined) user.coins = req.body.coins;
    if (req.body.gems !== undefined) user.gems = req.body.gems;
    if (req.body.level !== undefined) user.level = req.body.level;
    if (req.body.xp !== undefined) user.xp = req.body.xp;
    if (req.body.unlockedWorlds) user.unlockedWorlds = req.body.unlockedWorlds;
    if (req.body.trophies) user.trophies = req.body.trophies;
    if (req.body.unlockedEnemies) user.unlockedEnemies = req.body.unlockedEnemies;
    
    // Cosmetics & Premium
    if (req.body.hasCosmicTrail !== undefined) user.hasCosmicTrail = req.body.hasCosmicTrail;
    if (req.body.hasGoldenAura !== undefined) user.hasGoldenAura = req.body.hasGoldenAura;
    if (req.body.hasCelestialShield !== undefined) user.hasCelestialShield = req.body.hasCelestialShield;
    if (req.body.hasPurchasedGems !== undefined) user.hasPurchasedGems = req.body.hasPurchasedGems;
    if (req.body.toggleCosmicTrail !== undefined) user.toggleCosmicTrail = req.body.toggleCosmicTrail;
    if (req.body.toggleGoldenAura !== undefined) user.toggleGoldenAura = req.body.toggleGoldenAura;
    if (req.body.toggleCelestialShield !== undefined) user.toggleCelestialShield = req.body.toggleCelestialShield;

    // Progression & Deals
    if (req.body.upsellChance !== undefined) user.upsellChance = req.body.upsellChance;
    if (req.body.coinMultiplier !== undefined) user.coinMultiplier = req.body.coinMultiplier;
    if (req.body.xpMultiplier !== undefined) user.xpMultiplier = req.body.xpMultiplier;
    if (req.body.crazyDealExpiresAt !== undefined) user.crazyDealExpiresAt = req.body.crazyDealExpiresAt;
    
    if (req.body.acceptedLegalPolicies !== undefined) user.acceptedLegalPolicies = req.body.acceptedLegalPolicies;

    if (req.body.worldUpgrades) {
        user.worldUpgrades = req.body.worldUpgrades;
        user.markModified('worldUpgrades');
    }
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: 'Logged out' });
  });
});

router.post('/accept-policies', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
    try {
        req.user.acceptedLegalPolicies = true;
        await req.user.save();
        res.json({ message: 'Policies accepted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/user', async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
    try {
        await User.findByIdAndDelete(req.user._id);
        req.logout((err) => {
            if (err) return next(err);
            res.json({ message: 'Account deleted successfully' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
