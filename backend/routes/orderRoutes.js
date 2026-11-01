const express = require('express');
const controller = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/', protect, asyncRoute(controller.createOrder));
router.get('/mine', protect, asyncRoute(controller.listMyOrders));
router.get('/track/:orderNumber', protect, asyncRoute(controller.getOrder));
router.post('/:orderNumber/cancel', protect, asyncRoute(controller.cancelMyOrder));
router.post('/:orderNumber/payment/verify', protect, asyncRoute(controller.verifyPayment));
router.post('/:orderNumber/payment/retry', protect, asyncRoute(controller.retryPayment));
router.post('/:orderNumber/payment/method', protect, asyncRoute(controller.changeUnpaidOrderPaymentMethod));
router.get('/admin/all', protect, requireRole('admin'), asyncRoute(controller.listAllOrders));
router.get('/admin/completed', protect, requireRole('admin'), asyncRoute(controller.listCompletedOrders));
router.patch('/admin/:orderNumber/payment/paid', protect, requireRole('admin'), asyncRoute(controller.markOfflinePaid));
router.patch('/admin/:orderNumber/status', protect, requireRole('admin'), asyncRoute(controller.updateOrderStatus));
router.post('/admin/:orderNumber/refund', protect, requireRole('admin'), asyncRoute(controller.refundOrder));

module.exports = router;
