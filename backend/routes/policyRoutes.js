const express = require('express');
const controller = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const router = express.Router();
router.get('/', (req, res, next) => Promise.resolve(controller.getPolicy(req, res)).catch(next));
router.put('/admin', protect, requireRole('admin'), (req, res, next) => Promise.resolve(controller.updatePolicy(req, res)).catch(next));
module.exports = router;
