const express = require('express');
const router = express.Router();
const axios = require('axios');
const { User, Transaction, SystemSetting, ResellerStorefront } = require('../models/models');
const { authMiddleware } = require('../middleware/auth');

// Generate unique reference string
const generateRef = () => {
  return 'ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Purchase data bundle using Wallet Balance (For resellers and logged-in users)
router.post('/order/wallet-buy', authMiddleware, async (req, res) => {
  try {
    const { network, volume, phone, recipientName, resellerStorefrontId } = req.body;

    if (!network || !volume || !phone) {
      return res.status(400).json({ success: false, error: 'Network, volume, and recipient phone are required' });
    }

    const cleanNetwork = network.toLowerCase();
    const cleanVolume = volume.toString();
    const adminSettings = await SystemSetting.findOne() || new SystemSetting();
    const portalApiKey = adminSettings.portalApiKey;

    // Get pricing details for this network
    const netBaseObj = adminSettings.basePricing.get(cleanNetwork) || {};
    const netCostObj = adminSettings.costPricing.get(cleanNetwork) || {};

    let userPrice = Number(netBaseObj[cleanVolume] || 0.00);
    const costPrice = Number(netCostObj[cleanVolume] || 0.00);

    // If purchased by reseller or through a reseller storefront context
    let resellerId = null;
    let profit = 0;

    // Resolve pricing for resellers buying at cost or with margins
    if (req.user.role === 'reseller' || req.user.role === 'admin') {
      // If reseller is buying for themselves/their clients directly from their dashboard, they get a discounted price or cost price
      // Let's assume resellers get cost pricing directly, or they buy at retail and we calculate their margins
      // Usually, resellers buy at cost + small margin, and sell at retail.
      // Let's charge them the standard cost price directly (wholesale), so they make the maximum margin when reselling!
      userPrice = costPrice; 
    } else if (resellerStorefrontId) {
      // If a customer is buying on a reseller site (handled separately by Paystack direct payment mostly, but if using wallet on reseller site):
      const storefront = await ResellerStorefront.findById(resellerStorefrontId);
      if (storefront) {
        resellerId = storefront.userId;
        const customNetMap = storefront.customPricing.get(cleanNetwork) || {};
        if (customNetMap[cleanVolume] !== undefined) {
          userPrice = Number(customNetMap[cleanVolume]);
        } else {
          // Standard retail + markup
          const defaultPrice = Number(netBaseObj[cleanVolume] || 0.00);
          userPrice = Number((defaultPrice * (1 + storefront.markupPercentage / 100)).toFixed(2));
        }
        profit = Number((userPrice - costPrice).toFixed(2));
      }
    }

    // Check user's wallet balance
    const user = await User.findById(req.user.id);
    if (user.walletBalance < userPrice) {
      return res.status(402).json({ 
        success: false, 
        error: 'Insufficient wallet balance', 
        required: userPrice, 
        current: user.walletBalance 
      });
    }

    const reference = generateRef();

    // Place order to Portal 02 API
    const offerSlug = `${cleanNetwork}_data_bundle`;
    let orderStatus = 'pending';
    let portalOrderRef = '';
    let errorMessage = '';

    try {
      const response = await axios.post(`https://www.portal-02.com/api/v1/order/${cleanNetwork}`, {
        type: 'single',
        volume: cleanVolume,
        phone: phone,
        offerSlug: offerSlug
      }, {
        headers: {
          'x-api-key': portalApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        orderStatus = 'success';
        portalOrderRef = response.data.orderId || response.data.reference || '';
      }
    } catch (apiError) {
      orderStatus = 'failed';
      errorMessage = apiError.response ? apiError.response.data.error : apiError.message;
    }

    // If order succeeded, deduct wallet balance and save profit
    if (orderStatus === 'success') {
      user.walletBalance = Number((user.walletBalance - userPrice).toFixed(2));
      await user.save();

      // If purchased via reseller, credit reseller profit
      if (resellerId) {
        const reseller = await User.findById(resellerId);
        if (reseller) {
          reseller.profitWallet = Number((reseller.profitWallet + profit).toFixed(2));
          await reseller.save();
        }
      }
    }

    // Create transaction record
    const transaction = new Transaction({
      userId: user._id,
      resellerId: resellerId,
      type: resellerId ? 'reseller_sale' : 'data_purchase',
      amount: userPrice,
      costPrice,
      profit: resellerId ? profit : 0,
      recipientPhone: phone,
      recipientName: recipientName || 'Wallet Customer',
      network: cleanNetwork,
      volume: `${cleanVolume}GB`,
      offerSlug,
      reference,
      status: orderStatus,
      portalOrderRef,
      paymentDetails: { error: errorMessage }
    });
    await transaction.save();

    if (orderStatus === 'success') {
      res.json({
        success: true,
        message: 'Order placed successfully using wallet balance',
        transaction,
        walletBalance: user.walletBalance
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Order placement failed: ${errorMessage}. Wallet balance was NOT charged.`,
        transaction
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check balance on Portal 02 API directly (Used in admin panel)
router.get('/portal/balance', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized. Admin only.' });
    }

    const adminSettings = await SystemSetting.findOne() || new SystemSetting();
    const portalApiKey = adminSettings.portalApiKey;

    const response = await axios.get('https://www.portal-02.com/api/v1/balance', {
      headers: {
        'x-api-key': portalApiKey,
        'Accept': 'application/json'
      }
    });

    res.json({
      success: true,
      balance: response.data.balance,
      currency: response.data.currency,
      name: response.data.name,
      timestamp: response.data.timestamp
    });
  } catch (error) {
    const msg = error.response ? error.response.data.error : error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

module.exports = router;
