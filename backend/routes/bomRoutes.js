const express = require('express');
const router = express.Router();
const {
  getBoms,
  getBom,
  createBom,
  updateBom,
  deleteBom
} = require('../controllers/bomController');

router.route('/')
  .get(getBoms)
  .post(createBom);

router.route('/:id')
  .get(getBom)
  .put(updateBom)
  .delete(deleteBom);

module.exports = router;
