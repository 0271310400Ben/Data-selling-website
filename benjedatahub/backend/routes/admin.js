const express = require('express');
const router = express.Router();
const { User, Transaction, SystemSetting, ResellerStorefront } = require('../models/models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get overall stats for Admin dashboard
router.get('/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalResellers = await User.countDocuments({ role: 'reseller' });
    const totalStorefronts = await ResellerStorefront.countDocuments();
    
    // Aggregate financial stats
    const transactions = await Transaction.find({ status: 'success' });
    let totalSalesVolume = 0;
    let totalProfit = 0;

    transactions.forEach(tx => {
      if (tx.type === 'data_purchase' || tx.type === 'reseller_sale') {
        totalSalesVolume += tx.amount;
        totalProfit += tx.profit || 0;
      }
    });

    const recentTransactions = await Transaction.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'name email');

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalResellers,
        totalStorefronts,
        totalSalesVolume: Number(totalSalesVolume.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2))
      },
      recentTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of all users
router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adjust user wallet balance
router.post('/admin/wallet/adjust', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, amount, action } = req.body; // action: 'credit' or 'debit'

    if (!userId || !amount) {
      return res.status(400).json({ success: false, error: 'User ID and amount are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const adjustVal = Number(amount);
    if (action === 'credit') {
      user.walletBalance = Number((user.walletBalance + adjustVal).toFixed(2));
    } else if (action === 'debit') {
      if (user.walletBalance < adjustVal) {
        return res.status(400).json({ success: false, error: 'Insufficient balance to deduct' });
      }
      user.walletBalance = Number((user.walletBalance - adjustVal).toFixed(2));
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be credit or debit' });
    }

    await user.save();

    // Log the transaction
    const reference = 'ADJ-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const transaction = new Transaction({
      userId: user._id,
      type: 'wallet_funding',
      amount: action === 'credit' ? adjustVal : -adjustVal,
      reference,
      status: 'success',
      paymentDetails: { admin_adjustment: true, adjusted_by: req.user.email }
    });
    await transaction.save();

    res.json({
      success: true,
      message: `User wallet successfully ${action}ed by ${adjustVal} GHS`,
      user: {
        id: user._id,
        name: user.name,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system settings
router.get('/admin/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = new SystemSetting();
      await settings.save();
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update system settings
router.post('/admin/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { portalApiKey, adminPaystackSecret, adminPaystackPublic, basePricing, costPricing } = req.body;

    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = new SystemSetting();
    }

    if (portalApiKey) settings.portalApiKey = portalApiKey;
    if (adminPaystackSecret !== undefined) settings.adminPaystackSecret = adminPaystackSecret;
    if (adminPaystackPublic !== undefined) settings.adminPaystackPublic = adminPaystackPublic;
    
    if (basePricing) {
      settings.basePricing = basePricing;
    }
    if (costPricing) {
      settings.costPricing = costPricing;
    }

    await settings.save();
    res.json({ success: true, message: 'Settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
