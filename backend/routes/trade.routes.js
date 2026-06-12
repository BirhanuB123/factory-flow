const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/tradeShipment.controller');
const { protect, authorizePerm, P } = require('../middleware/authMiddleware');

router.use(protect, authorizePerm(P.SHIPMENTS_VIEW));

router.get('/', tradeController.getTradeShipments);
router.get('/:id', tradeController.getTradeShipmentById);
router.post('/', authorizePerm(P.SHIPMENTS_MANAGE), tradeController.createTradeShipment);
router.put('/:id', authorizePerm(P.SHIPMENTS_MANAGE), tradeController.updateTradeShipment);
router.delete('/:id', authorizePerm(P.SHIPMENTS_MANAGE), tradeController.deleteTradeShipment);
router.post('/:id/expenses', authorizePerm(P.SHIPMENTS_MANAGE), tradeController.logExpense);

module.exports = router;