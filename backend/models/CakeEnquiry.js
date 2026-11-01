const mongoose = require('mongoose');

const cakeEnquirySchema = new mongoose.Schema({
  type: { type: String, enum: ['custom-cake', 'contact'], default: 'custom-cake', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },
  occasion: { type: String, required: true, default: 'General enquiry', trim: true, maxlength: 60 },
  cakeSize: { type: String, required: true, default: 'Not specified', trim: true, maxlength: 30 },
  details: { type: String, trim: true, maxlength: 2000, default: '' },
  referenceImage: { type: String, default: '', maxlength: 1500000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  emailSent: { type: Boolean, default: false },
  customerEmailSent: { type: Boolean, default: false },
  emailStatus: { type: String, enum: ['not_configured', 'sent', 'failed'], default: 'not_configured' },
}, { timestamps: true });

module.exports = mongoose.model('CakeEnquiry', cakeEnquirySchema);
