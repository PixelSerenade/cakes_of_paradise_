const express = require('express');
const { getSalesInsights } = require('../controllers/insightsController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const router = express.Router();
router.get('/', protect, requireRole('admin'), (req, res, next) => Promise.resolve(getSalesInsights(req, res)).catch(next));
module.exports = router;
