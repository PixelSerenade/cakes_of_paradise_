const express = require('express');
const controller = require('../controllers/enquiryController');

const router = express.Router();
router.post('/', (req, res, next) => Promise.resolve(controller.createEnquiry(req, res, next)).catch(next));

module.exports = router;
