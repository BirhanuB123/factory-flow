const Notification = require('../models/Notification');
const { byTenant } = require('../utils/tenantQuery');

function scopedRecipientQuery(req) {
  return {
    $or: [
      { userId: req.user?._id || null },
      { userId: null },
      { userId: { $exists: false } },
    ],
  };
}

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const match = byTenant(req, scopedRecipientQuery(req));
    if (req.query.isRead !== undefined) {
      match.isRead = req.query.isRead === 'true';
    }

    const notifications = await Notification.find(match).sort({ createdAt: -1 });

    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne(
      byTenant(req, { _id: req.params.id, ...scopedRecipientQuery(req) })
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Mark all unread notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      byTenant(req, { isRead: false, ...scopedRecipientQuery(req) }),
      { isRead: true }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Create a new notification (useful for internal use or triggering)
// @route   POST /api/notifications
// @access  Private
const createNotification = async (req, res) => {
  try {
    const { title, description, type, userId } = req.body;

    const notification = await Notification.create({
      tenantId: req.tenantId,
      title,
      description,
      type,
      userId,
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
};
