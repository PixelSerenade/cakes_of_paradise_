const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, enum: ['ingredients', 'supplies'], index: true },
  detail: { type: String, default: '', trim: true, maxlength: 100 },
  unit: { type: String, required: true, trim: true, maxlength: 24, default: 'unit' },
  stock: { type: Number, required: true, min: 0, max: 100000 },
  lowStockThreshold: { type: Number, required: true, min: 0, max: 100000, default: 5 },
  image: { type: String, default: '', trim: true, maxlength: 500 },
}, { timestamps: true });

inventoryItemSchema.index({ category: 1, name: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
