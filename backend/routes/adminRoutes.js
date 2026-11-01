const express = require('express');
const controller = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(protect, requireRole('admin'));
router.get('/customers', asyncRoute(controller.listCustomers));
router.post('/customers', asyncRoute(controller.createCustomer));
router.get('/enquiries', asyncRoute(controller.listEnquiries));
router.delete('/customers/:userId', asyncRoute(controller.deleteCustomer));
router.get('/reviews', asyncRoute(controller.listReviews));
router.patch('/reviews/:id/status', asyncRoute(controller.updateReviewStatus));
router.patch('/reviews/:id', asyncRoute(controller.updateReview));
router.delete('/reviews/:id', asyncRoute(controller.deleteReview));
router.post('/reviews/manual', asyncRoute(controller.addManualReview));
router.patch('/reviews/:id/manual', asyncRoute(controller.updateManualReview));

module.exports = router;
