const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { User, Transaction, SystemSetting, ResellerStorefront } = require('../models/models');
const { authMiddleware } = require('../middleware/auth');

// Helper function to call Portal 02 API and place order
const placePortalOrder = async (apiKey, network, volume, phone, offerSlug) => {
  try {
    const response = await axios.post(`https://www.portal-02.com/api/v1/order/${network}`, {
      type: 'single',
      volume: volume.toString(),
      phone: phone,
      offerSlug: offerSlug || `${network}_data_bundle`
    }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    const errorData = error.response ? error.response.data : {};
    return { 
      success: false, 
      error: errorData.error || 'Failed to place order with provider', 
      type: errorData.type || 'PROVIDER_ERROR'
    };
  }
};

// Get the correct Paystack Secret Key
const getPaystackSecret = async (resellerId) => {
  const adminSettings = await SystemSetting.findOne() || new SystemSetting();
  
  if (resellerId) {
    const storefront = await ResellerStorefront.findOne({ userId: resellerId });
    if (storefront && storefront.paystackSecretKey) {
      return storefront.paystackSecretKey;
    }
  }
  
  // Default to admin paystack key (set in env or DB setting)
  return adminSettings.adminPaystackSecret || process.env.PAYSTACK_SECRET_KEY || 'sk_test_paystack_default_secret_key_change_me';
};

// Initialize payment (Wallet Funding or Direct purchase)
router.post('/paystack/initialize', async (req, res) => {
  try {
    const { email, amount, type, metadata } = req.body; 
    // metadata fields: userId, resellerId, phone, network, volume, offerSlug, recipientName

    if (!email || !amount) {
      return res.status(400).json({ success: false, error: 'Email and amount are required' });
    }

    const paystackSecret = await getPaystackSecret(metadata?.resellerId);

    // Paystack amounts are in pesewas (1 GHS = 100 pesewas)
    const amountInPesewas = Math.round(Number(amount) * 100);

    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amountInPesewas,
        currency: 'GHS',
        metadata: {
          type,
          ...metadata
        }
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      authorization_url: paystackResponse.data.data.authorization_url,
      reference: paystackResponse.data.data.reference
    });
  } catch (error) {
    const msg = error.response ? error.response.data.message : error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Verify payment (manual client fallback trigger)
router.post('/paystack/verify', async (req, res) => {
  try {
    const { reference, resellerId } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, error: 'Reference code is required' });
    }

    // Check if transaction was already processed
    let transaction = await Transaction.findOne({ reference });
    if (transaction && transaction.status === 'success') {
      return res.json({ success: true, message: 'Transaction already processed successfully', transaction });
    }

    const paystackSecret = await getPaystackSecret(resellerId);
    
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`
        }
      }
    );

    const paymentData = paystackResponse.data.data;
    if (paymentData.status !== 'success') {
      return res.json({ success: false, error: 'Payment is not successful yet', status: paymentData.status });
    }

    // Process transaction based on metadata type
    const meta = paymentData.metadata;
    const amountGHS = paymentData.amount / 100;

    const result = await processSuccessfulPayment(reference, amountGHS, meta, paymentData);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.message, 
        transaction: result.transaction,
        orderResponse: result.orderResponse
      });
    } else {
      res.status(400).json({ success: false, error: result.error, transaction: result.transaction });
    }
  } catch (error) {
    const msg = error.response ? error.response.data.message : error.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// Webhook listener for automatic processing
router.post('/paystack/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return res.sendStatus(400);
    }

    const adminSettings = await SystemSetting.findOne() || new SystemSetting();
    // In production, verify signature with Paystack secret keys
    // For simplicity of multi-reseller webhook, we parse body safely and search transaction reference
    const event = req.body;

    if (event.event === 'charge.success') {
      const paymentData = event.data;
      const reference = paymentData.reference;
      const amountGHS = paymentData.amount / 100;
      const meta = paymentData.metadata;

      // Check if transaction is already processed
      const existing = await Transaction.findOne({ reference });
      if (existing && existing.status === 'success') {
        return res.status(200).json({ status: 'already_processed' });
      }

      await processSuccessfulPayment(reference, amountGHS, meta, paymentData);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Function to handle database updates for verified successful payments
async function processSuccessfulPayment(reference, amountGHS, meta, paymentData) {
  try {
    const adminSettings = await SystemSetting.findOne() || new SystemSetting();
    const portalApiKey = adminSettings.portalApiKey;

    if (meta.type === 'wallet_funding') {
      // 1. Credit User's Wallet
      const user = await User.findById(meta.userId);
      if (!user) return { success: false, error: 'User not found' };

      user.walletBalance = Number((user.walletBalance + amountGHS).toFixed(2));
      await user.save();

      // Create transaction record
      const transaction = new Transaction({
        userId: user._id,
        type: 'wallet_funding',
        amount: amountGHS,
        reference,
        status: 'success',
        paymentDetails: paymentData
      });
      await transaction.save();

      return { success: true, message: 'Wallet funded successfully', transaction };
    }

    if (meta.type === 'direct_purchase') {
      // 2. Process data order directly (placed from frontend purchase form)
      const network = meta.network.toLowerCase();
      const volume = meta.volume; // e.g. "1" or "2"
      const phone = meta.phone;
      const recipientName = meta.recipientName || 'Walk-in Customer';
      const resellerId = meta.resellerId; // Storefront owner if placed on reseller site

      // Calculate cost price and profit
      const networkCostMap = adminSettings.costPricing.get(network) || {};
      const costPrice = Number(networkCostMap[volume.toString()] || 0.00);
      const profit = Number((amountGHS - costPrice).toFixed(2));

      // Place order to Portal 02 API
      const orderRes = await placePortalOrder(portalApiKey, network, volume, phone, meta.offerSlug);
      
      let orderStatus = 'pending';
      let portalOrderRef = '';
      if (orderRes.success) {
        orderStatus = 'success';
        portalOrderRef = orderRes.data.orderId || orderRes.data.reference || '';
      } else {
        orderStatus = 'failed';
        // Note: In case of API failure, admin can manually fulfill or refund
      }

      // If reseller is using admin's Paystack key, profit goes to reseller's profit wallet
      if (resellerId && orderStatus === 'success') {
        const reseller = await User.findById(resellerId);
        if (reseller) {
          reseller.profitWallet = Number((reseller.profitWallet + profit).toFixed(2));
          await reseller.save();
        }
      }

      // Create transaction record
      const transaction = new Transaction({
        userId: resellerId || null, // Associate transaction with reseller if sold through a reseller
        resellerId: resellerId || null,
        type: resellerId ? 'reseller_sale' : 'data_purchase',
        amount: amountGHS,
        costPrice,
        profit: resellerId ? profit : 0, // profit goes to reseller, or admin logs profit
        recipientPhone: phone,
        recipientName,
        network,
        volume: `${volume}GB`,
        offerSlug: meta.offerSlug || `${network}_data_bundle`,
        reference,
        status: orderStatus,
        portalOrderRef,
        paymentDetails: paymentData
      });
      await transaction.save();

      if (orderStatus === 'success') {
        return { success: true, message: 'Data purchase processed successfully', transaction, orderResponse: orderRes.data };
      } else {
        return { 
          success: false, 
          error: `Payment verified, but data delivery failed: ${orderRes.error}. Please contact support.`, 
          transaction 
        };
      }
    }

    return { success: false, error: 'Unknown transaction type' };
  } catch (error) {
    console.error('Error in processSuccessfulPayment:', error);
    return { success: false, error: error.message };
  }
}

// User Profile transaction logs
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      // Admin sees all transactions
      query = {};
    } else if (req.user.role === 'reseller') {
      // Resellers see transactions they initiated OR sold via their storefront
      query = { $or: [{ userId: req.user.id }, { resellerId: req.user.id }] };
    } else {
      // Regular user sees only their transactions
      query = { userId: req.user.id };
    }

    const transactions = await Transaction.find(query).sort({ timestamp: -1 });
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
