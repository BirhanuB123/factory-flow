const express = require('express');
const { getCurrentAnnouncement } = require('../controllers/announcementController');

const router = express.Router();

router.get('/current', getCurrentAnnouncement);

module.exports = router;
