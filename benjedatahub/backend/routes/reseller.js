const express = require('express');
const router = express.Router();
const { User, ResellerStorefront, SystemSetting } = require('../models/models');
const { authMiddleware } = require('../middleware/auth');

// Create or update reseller storefront settings
router.post('/storefront', authMiddleware, async (req, res) => {
  try {
    const { subdomain, siteName, contactPhone, paystackPublicKey, paystackSecretKey, markupPercentage } = req.body;

    if (!subdomain || !siteName) {
      return res.status(400).json({ success: false, error: 'Subdomain and site name are required' });
    }

    const cleanSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Check if subdomain is already taken by another reseller
    const existing = await ResellerStorefront.findOne({ subdomain: cleanSubdomain });
    if (existing && existing.userId.toString() !== req.user.id) {
      return res.status(400).json({ success: false, error: 'Subdomain is already taken by another reseller' });
    }

    // Check if user is a reseller, if not upgrade their role
    let user = await User.findById(req.user.id);
    if (user.role === 'user') {
      user.role = 'reseller';
      await user.save();
    }

    let storefront = await ResellerStorefront.findOne({ userId: req.user.id });
    if (storefront) {
      storefront.subdomain = cleanSubdomain;
      storefront.siteName = siteName;
      storefront.contactPhone = contactPhone || '';
      storefront.paystackPublicKey = paystackPublicKey || '';
      storefront.paystackSecretKey = paystackSecretKey || '';
      storefront.markupPercentage = markupPercentage !== undefined ? Number(markupPercentage) : storefront.markupPercentage;
      await storefront.save();
    } else {
      storefront = new ResellerStorefront({
        userId: req.user.id,
        subdomain: cleanSubdomain,
        siteName,
        contactPhone: contactPhone || '',
        paystackPublicKey: paystackPublicKey || '',
        paystackSecretKey: paystackSecretKey || '',
        markupPercentage: markupPercentage !== undefined ? Number(markupPercentage) : 10,
        customPricing: {}
      });
      await storefront.save();
    }

    res.json({
      success: true,
      message: 'Storefront updated successfully',
      storefront,
      userRole: user.role
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get logged-in reseller's storefront
router.get('/storefront/my', authMiddleware, async (req, res) => {
  try {
    const storefront = await ResellerStorefront.findOne({ userId: req.user.id });
    if (!storefront) {
      return res.json({ success: true, storefront: null });
    }
    res.json({ success: true, storefront });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public route to resolve storefront settings from subdomain
router.get('/storefront/details/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const cleanSub = subdomain.trim().toLowerCase();

    // Check if it's the main portal
    if (cleanSub === 'www' || cleanSub === 'benjedatahub' || !cleanSub) {
      const adminSettings = await SystemSetting.findOne() || new SystemSetting();
      return res.json({
        success: true,
        isMainPortal: true,
        siteName: 'BenjeDataHub',
        pricing: adminSettings.basePricing,
        paystackPublicKey: adminSettings.adminPaystackPublic || process.env.PAYSTACK_PUBLIC_KEY || ''
      });
    }

    const storefront = await ResellerStorefront.findOne({ subdomain: cleanSub, isActive: true });
    if (!storefront) {
      // Fallback to main portal if not found (or return 404)
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    // Load admin settings to fetch base/cost prices and apply markups
    const adminSettings = await SystemSetting.findOne() || new SystemSetting();
    const basePricing = adminSettings.basePricing;
    const resellerPricing = {};

    // Generate price list for this reseller storefront
    // Loop through networks: mtn, telecel, airteltigo
    const networks = ['mtn', 'telecel', 'airteltigo'];
    for (const net of networks) {
      resellerPricing[net] = {};
      const netBaseObj = basePricing.get(net) || {};
      const customNetMap = storefront.customPricing.get(net) || {};

      for (const [vol, defaultRetailPrice] of Object.entries(netBaseObj)) {
        if (customNetMap[vol] !== undefined) {
          // Use reseller's specifically defined price
          resellerPricing[net][vol] = Number(customNetMap[vol]);
        } else {
          // Fallback to applying reseller's percentage markup on admin's default retail price
          const defaultPrice = Number(defaultRetailPrice);
          const markupMultiplier = 1 + (storefront.markupPercentage / 100);
          resellerPricing[net][vol] = Number((defaultPrice * markupMultiplier).toFixed(2));
        }
      }
    }

    res.json({
      success: true,
      isMainPortal: false,
      siteName: storefront.siteName,
      contactPhone: storefront.contactPhone,
      paystackPublicKey: storefront.paystackPublicKey || adminSettings.adminPaystackPublic || process.env.PAYSTACK_PUBLIC_KEY || '',
      pricing: resellerPricing,
      resellerId: storefront.userId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update specific pricing sheet for a reseller storefront
router.post('/storefront/pricing', authMiddleware, async (req, res) => {
  try {
    const { pricing } = req.body; // Expecting: { mtn: { "1": 6.50 }, telecel: { "2": 11.00 } }
    if (!pricing) {
      return res.status(400).json({ success: false, error: 'Pricing schema required' });
    }

    const storefront = await ResellerStorefront.findOne({ userId: req.user.id });
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Reseller storefront not created yet' });
    }

    // Update custom pricing map
    for (const [network, packages] of Object.entries(pricing)) {
      if (!['mtn', 'telecel', 'airteltigo'].includes(network)) continue;
      
      const currentNetMap = storefront.customPricing.get(network) || new Map();
      for (const [vol, price] of Object.entries(packages)) {
        currentNetMap.set(vol, Number(price));
      }
      storefront.customPricing.set(network, currentNetMap);
    }

    // Force Mongoose to recognize changes in Maps
    storefront.markModified('customPricing');
    await storefront.save();

    res.json({
      success: true,
      message: 'Storefront custom pricing updated successfully',
      storefront
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
