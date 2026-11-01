const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, immutable: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  image: { type: String, required: true, trim: true },
  images: { type: [String], default: [], validate: (values) => values.length <= 5 },
  photoCredit: { type: String, default: '' },
  flavors: { type: [String], required: true, validate: (values) => values.length > 0 },
  sizes: [{ name: { type: String, required: true }, price: { type: Number, required: true, min: 1 } }],
  allergens: { type: [String], default: [] },
  // These filters appear only after staff have checked and confirmed the recipe.
  dietaryTags: { type: [{ type: String, enum: ['eggless', 'vegan', 'gluten-free', 'nut-free'] }], default: [] },
  available: { type: Boolean, default: true, index: true },
  seasonal: { type: Boolean, default: false },
  stock: { type: Number, default: 20, min: 0 },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
}, { timestamps: true });

productSchema.index({ available: 1, category: 1 });
productSchema.index({ available: 1, 'sizes.0.price': 1 });
productSchema.index({ name: 'text', description: 'text', flavors: 'text' });

module.exports = mongoose.model('Product', productSchema);
