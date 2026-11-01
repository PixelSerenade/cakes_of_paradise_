const express = require('express');
const controller = require('../controllers/catalogController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncRoute(controller.listProducts));
router.get('/:productId', asyncRoute(controller.getProductDetail));
router.get('/admin/products', protect, requireRole('admin'), asyncRoute(controller.listAdminProducts));
router.get('/admin/products/:productId', protect, requireRole('admin'), asyncRoute(controller.getAdminProduct));
router.get('/admin/categories', protect, requireRole('admin'), asyncRoute(controller.listAdminCategories));
router.post('/admin/categories', protect, requireRole('admin'), asyncRoute(controller.createAdminCategory));
router.post('/admin/products', protect, requireRole('admin'), asyncRoute(controller.createProduct));
router.put('/admin/products/:productId', protect, requireRole('admin'), asyncRoute(controller.updateProduct));
router.patch('/admin/products/:productId/stock', protect, requireRole('admin'), asyncRoute(controller.updateProductStock));
router.get('/:productId/reviews', asyncRoute(controller.listReviews));
router.post('/:productId/reviews', protect, asyncRoute(controller.createReview));

module.exports = router;
