const mongoose = require('mongoose');

const deliveryRateSchema = new mongoose.Schema({
  minKm: { type: Number, required: true, min: 0 },
  maxKm: { type: Number, required: true, min: 0.1 },
  fee: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

deliveryRateSchema.index({ minKm: 1, maxKm: 1, active: 1 });
module.exports = mongoose.model('DeliveryRate', deliveryRateSchema);
