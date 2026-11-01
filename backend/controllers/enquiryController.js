const CakeEnquiry = require('../models/CakeEnquiry');
const { sendEnquiryNotification } = require('../services/enquiryEmail');

const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

exports.createEnquiry = async (req, res) => {
  const { name, email, phone = '', occasion = 'General enquiry', cakeSize = 'Not specified', details = '', referenceImage = '' } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) return res.status(400).json({ message: 'Please enter your name and email address.' });
  if (!validEmail(email.trim())) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (typeof phone !== 'string' || typeof occasion !== 'string' || typeof cakeSize !== 'string' || name.trim().length > 120 || phone.trim().length > 30 || !occasion.trim() || occasion.trim().length > 60 || !cakeSize.trim() || cakeSize.trim().length > 30 || typeof details !== 'string' || details.trim().length > 2000 || typeof referenceImage !== 'string' || referenceImage.length > 1400000 || (referenceImage && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(referenceImage))) {
    return res.status(400).json({ message: 'One or more enquiry fields are too long.' });
  }

  const enquiry = await CakeEnquiry.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    occasion: occasion.trim(),
    cakeSize: cakeSize.trim(),
    details: details.trim(),
    referenceImage,
  });
  const emailResult = await sendEnquiryNotification(enquiry);
  await CakeEnquiry.updateOne({ _id: enquiry._id }, { $set: { emailSent: emailResult.sent, customerEmailSent: emailResult.customerEmailSent, emailStatus: emailResult.status } });
  return res.status(201).json({
    message: 'Your enquiry has been submitted.',
    enquiry: { id: enquiry.id, createdAt: enquiry.createdAt },
    emailSent: emailResult.sent,
    emailStatus: emailResult.status,
    customerEmailSent: emailResult.customerEmailSent,
  });
};
