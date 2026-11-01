const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');

const cleanInput = (body = {}) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = String(body.category || '').toLowerCase();
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const detail = typeof body.detail === 'string' ? body.detail.trim() : '';
  const stock = Number(body.stock);
  const lowStockThreshold = Number(body.lowStockThreshold);
  if (!name || name.length > 100) return { error: 'Enter an item name up to 100 characters.' };
  if (!['ingredients', 'supplies'].includes(category)) return { error: 'Choose Ingredients or Supplies.' };
  if (!unit || unit.length > 24) return { error: 'Enter a unit, such as kg, L, or roll.' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { error: 'Stock must be a whole number from 0 to 100,000.' };
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000) return { error: 'The low-stock threshold must be a whole number from 0 to 100,000.' };
  if (detail.length > 100) return { error: 'Item details must be 100 characters or fewer.' };
  const image = typeof body.image === 'string' && body.image.startsWith('/') ? body.image.slice(0, 500) : '';
  return { value: { name, category, unit, detail, stock, lowStockThreshold, image } };
};

const listItems = async (req, res) => {
  const items = await InventoryItem.find().sort({ category: 1, name: 1 }).lean();
  res.json({ items });
};

const createItem = async (req, res) => {
  const { value, error } = cleanInput(req.body);
  if (error) return res.status(400).json({ message: error });
  const item = await InventoryItem.create(value);
  res.status(201).json({ message: 'Inventory item added.', item });
};

const updateItem = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) return res.status(400).json({ message: 'Invalid inventory item.' });
  const { value, error } = cleanInput(req.body);
  if (error) return res.status(400).json({ message: error });
  const item = await InventoryItem.findByIdAndUpdate(req.params.itemId, { $set: value }, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
  res.json({ message: 'Inventory item updated.', item });
};

const deleteItem = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) return res.status(400).json({ message: 'Invalid inventory item.' });
  const item = await InventoryItem.findByIdAndDelete(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
  res.json({ message: 'Inventory item removed.' });
};

module.exports = { listItems, createItem, updateItem, deleteItem };
