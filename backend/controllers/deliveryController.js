const DeliveryRate = require('../models/DeliveryRate');
const { drivingDistanceKm } = require('../services/mappls');

exports.resolveDelivery = async (deliveryType, area, city, postalCode) => {
  if (deliveryType === 'pickup') return { deliveryType, zone: 'Bakery pickup', distanceBand: '', fee: 0 };
  if (deliveryType !== 'delivery' || !String(area || '').trim() || String(area).trim().length > 80 || !String(city || '').trim() || String(city).trim().length > 80 || !/^\d{6}$/.test(String(postalCode || '').trim())) throw new Error('Choose delivery or pickup and enter your area, city, and valid 6-digit postal code.');
  const normalizedArea = String(area).trim().toLowerCase();
  const normalizedCity = String(city).trim().toLowerCase();
  if (String(postalCode).trim() === (process.env.BAKERY_PINCODE || '575014') && ['mangalore', 'mangaluru'].includes(normalizedCity)) return { deliveryType, zone: 'Surathkal, Mangaluru', distanceBand: '', distanceKm: 0, fee: 0 };
  const originPin = String(process.env.BAKERY_PINCODE || '575014').trim();
  if (!/^\d{6}$/.test(originPin)) throw new Error('The bakery PIN code is not configured correctly. Please contact the bakery.');
  const distanceKm = await drivingDistanceKm(originPin, String(postalCode).trim());
  const rates = await DeliveryRate.find({ active: true }).sort({ minKm: 1 });
  const rate = rates.find((candidate, index) => distanceKm >= candidate.minKm && (distanceKm < candidate.maxKm || (index === rates.length - 1 && distanceKm <= candidate.maxKm)));
  if (!rate) throw new Error(`The estimated delivery distance is ${distanceKm} km, outside the bakery's configured delivery range. Please contact the bakery or choose pickup.`);
  return { deliveryType, zone: String(area).trim(), distanceBand: `${distanceKm} km`, distanceKm, fee: rate.fee };
};
exports.quoteDelivery = async (req, res) => {
  try { return res.json(await exports.resolveDelivery(String(req.query.type || 'delivery'), req.query.area, req.query.city, req.query.postalCode)); }
  catch (error) { return res.status(400).json({ message: error.message }); }
};

exports.listZones = async (req, res) => res.json({ zones: await DeliveryRate.find().sort({ minKm: 1 }) });
exports.listActiveRates = async (req, res) => res.json({ rates: await DeliveryRate.find({ active: true }).sort({ minKm: 1 }).select('minKm maxKm fee') });
exports.createZone = async (req, res) => {
  const minKm = Number(req.body.minKm);
  const maxKm = Number(req.body.maxKm);
  const fee = Number(req.body.fee);
  if (!Number.isFinite(minKm) || !Number.isFinite(maxKm) || minKm < 0 || maxKm <= minKm || maxKm > 500 || !Number.isSafeInteger(fee) || fee < 0 || fee > 100000) return res.status(400).json({ message: 'Enter a valid distance range and a non-negative whole-rupee fee.' });
  const overlap = await DeliveryRate.exists({ active: true, minKm: { $lt: maxKm }, maxKm: { $gt: minKm } });
  if (overlap) return res.status(409).json({ message: 'This distance range overlaps another active fee band. Adjust one of the ranges.' });
  const zone = await DeliveryRate.create({ minKm, maxKm, fee });
  return res.status(201).json({ zone });
};
exports.updateZone = async (req, res) => {
  const updates = {};
  if (req.body.active !== undefined) updates.active = req.body.active === true;
  if (req.body.fee !== undefined) {
    const fee = Number(req.body.fee);
    if (!Number.isSafeInteger(fee) || fee < 0 || fee > 100000) return res.status(400).json({ message: 'Enter a valid whole-rupee delivery fee.' });
    updates.fee = fee;
  }
  if (updates.active) {
    const current = await DeliveryRate.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Delivery fee band not found.' });
    const overlap = await DeliveryRate.exists({ _id: { $ne: current._id }, active: true, minKm: { $lt: current.maxKm }, maxKm: { $gt: current.minKm } });
    if (overlap) return res.status(409).json({ message: 'This distance band overlaps another active fee band.' });
  }
  const zone = await DeliveryRate.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!zone) return res.status(404).json({ message: 'Delivery zone not found.' });
  return res.json({ zone });
};
