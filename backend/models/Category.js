const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  normalizedName: { type: String, required: true, unique: true, trim: true, lowercase: true },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
