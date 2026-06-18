const express = require('express');
const router = express.Router();
const {
  openSession,
  getActiveSession,
  closeSession,
  processSale,
  getPosProducts,
  getSales,
  voidSale,
  getDailyReport,
  getSessionReport,
} = require('../../controllers/posController');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

router.post('/session/open', openSession);
router.get('/session/active', getActiveSession);
router.post('/session/close', closeSession);
router.post('/sale', processSale);
router.get('/sales', getSales);
router.post('/sale/:id/void', voidSale);
router.get('/reports/daily', getDailyReport);
router.get('/reports/session/:id', getSessionReport);
router.get('/products', getPosProducts);

module.exports = router;
