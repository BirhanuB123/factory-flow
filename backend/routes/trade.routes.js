const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/tradeShipment.controller');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', tradeController.createTradeShipment);
router.get('/', tradeController.getTradeShipments);
router.get('/:id', tradeController.getTradeShipmentById);
router.put('/:id', tradeController.updateTradeShipment);
router.delete('/:id', tradeController.deleteTradeShipment);

module.exports = router;
