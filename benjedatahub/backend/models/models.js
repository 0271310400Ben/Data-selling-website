const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'reseller', 'user'], default: 'user' },
  walletBalance: { type: Number, default: 0.00 }, // Wallet balance in GHS
  profitWallet: { type: Number, default: 0.00 }, // Reseller profits earned
  createdAt: { type: Date, default: Date.now }
});

// Reseller Storefront Schema
const ResellerStorefrontSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subdomain: { type: String, required: true, unique: true, lowercase: true },
  siteName: { type: String, required: true },
  contactPhone: { type: String, default: '' },
  paystackPublicKey: { type: String, default: '' },
  paystackSecretKey: { type: String, default: '' },
  // Custom pricing object structure: { mtn: { "1": 6.00, "2": 11.50 }, telecel: { "1": 5.80 } }
  customPricing: { type: Map, of: Map, default: {} },
  // Default margin/markup to apply to cost if customPricing is empty
  markupPercentage: { type: Number, default: 10 }, // e.g. 10%
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The user who bought/reseller who purchased
  resellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Storefront owner if sold through reseller site
  type: { 
    type: String, 
    enum: ['wallet_funding', 'data_purchase', 'profit_withdrawal', 'reseller_sale'], 
    required: true 
  },
  amount: { type: Number, required: true }, // Amount charged to customer or added to wallet
  costPrice: { type: Number, default: 0.00 }, // API cost price
  profit: { type: Number, default: 0.00 }, // Reseller profit or admin profit
  recipientPhone: { type: String },
  recipientName: { type: String },
  network: { type: String },
  volume: { type: String }, // e.g. "1GB", "2GB"
  offerSlug: { type: String },
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  portalOrderRef: { type: String, default: '' }, // Reference from Portal 02 API
  paymentDetails: { type: Object }, // Store Paystack metadata if relevant
  timestamp: { type: Date, default: Date.now }
});

// System settings for Admin (prices & API configuration)
const SystemSettingSchema = new mongoose.Schema({
  portalApiKey: { type: String, default: 'dk_x1woJkOFzL3TPIyLrUrVz9bAjlUR316_' },
  adminPaystackSecret: { type: String, default: '' },
  adminPaystackPublic: { type: String, default: '' },
  // Admin prices for general users: { mtn: { "1": 5.00, "2": 10.00 } }
  basePricing: { 
    type: Map, 
    of: Map, 
    default: {
      mtn: { '1': 5.00, '2': 10.00, '5': 24.00, '10': 48.00 },
      telecel: { '1': 4.80, '2': 9.60, '5': 23.00, '10': 46.00 },
      airteltigo: { '1': 4.50, '2': 9.00, '5': 22.00, '10': 44.00 }
    } 
  },
  // Default cost prices of Portal 02 API for profit calculation
  costPricing: {
    type: Map,
    of: Map,
    default: {
      mtn: { '1': 4.20, '2': 8.40, '5': 20.00, '10': 40.00 },
      telecel: { '1': 4.00, '2': 8.00, '5': 19.00, '10': 38.00 },
      airteltigo: { '1': 3.80, '2': 7.60, '5': 18.00, '10': 36.00 }
    }
  }
});

const User = mongoose.model('User', UserSchema);
const ResellerStorefront = mongoose.model('ResellerStorefront', ResellerStorefrontSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const SystemSetting = mongoose.model('SystemSetting', SystemSettingSchema);

module.exports = { User, ResellerStorefront, Transaction, SystemSetting };
