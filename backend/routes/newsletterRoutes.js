const express = require('express');
const controller = require('../controllers/newsletterController');

const router = express.Router();
router.post('/subscribe', (req, res, next) => Promise.resolve(controller.subscribe(req, res)).catch(next));
router.get('/unsubscribe/:token', (req, res, next) => Promise.resolve(controller.unsubscribePage(req, res)).catch(next));
router.post('/unsubscribe/:token', (req, res, next) => Promise.resolve(controller.unsubscribe(req, res)).catch(next));

module.exports = router;
