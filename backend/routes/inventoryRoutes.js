const express = require('express');
const controller = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(protect, requireRole('admin'));
router.get('/items', asyncRoute(controller.listItems));
router.post('/items', asyncRoute(controller.createItem));
router.put('/items/:itemId', asyncRoute(controller.updateItem));
router.delete('/items/:itemId', asyncRoute(controller.deleteItem));

module.exports = router;
