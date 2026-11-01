const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 600, trim: true },
  status: { type: String, enum: ['published', 'hidden', 'pending', 'approved', 'rejected'], default: 'published', index: true },
  source: { type: String, enum: ['customer', 'manual'], default: 'customer' },
  permissionGiven: { type: Boolean, default: false },
  reviewDate: { type: Date, default: Date.now },
}, { timestamps: true });

// Averages and counts filter by productId + status
reviewSchema.index({ productId: 1, status: 1 });
// Single review per customer per product
reviewSchema.index({ user: 1, productId: 1 }, { unique: true, partialFilterExpression: { source: 'customer' } });

module.exports = mongoose.model('Review', reviewSchema);
