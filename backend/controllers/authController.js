const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, employeeId, password } = req.body;

  // Allow login by either email or employeeId
  const user = await Employee.findOne({
    $or: [{ email }, { employeeId }]
  });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
});


const getMe = asyncHandler(async (req, res) => {
  const user = await Employee.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = {
  loginUser,
  getMe,
};
