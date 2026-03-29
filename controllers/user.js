const jwt = require("jsonwebtoken");
// User model now comes from req.models (tenant-specific)

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      msg: "Bad request. Please add username and password in the request body",
    });
  }

  const User = req.models.User;
  let foundUser = await User.findOne({ username: new RegExp('^' + req.body.username + '$', 'i') });
  if (foundUser) {
    const isMatch = await foundUser.comparePassword(password);

    if (isMatch) {
      const token = jwt.sign(
        { id: foundUser._id, name: foundUser.name, role: foundUser.role },
        process.env.JWT_SECRET,
        {
          expiresIn: "365d",
        }
      );

      return res.status(200).json({ msg: "user logged in", token, role: foundUser.role, name: foundUser.name });
    } else {
      return res.status(400).json({ msg: "Incorrect password. Please verify your credentials." });
    }
  } else {
    return res.status(400).json({ msg: "User not found. Please verify your credentials and ensure you have selected the correct Organization." });
  }
};

const dashboard = async (req, res) => {
  const luckyNumber = Math.floor(Math.random() * 100);

  res.status(200).json({
    msg: `Hello, ${req.user.name}`,
    secret: `Here is your authorized data, your lucky number is ${luckyNumber}`,
  });
};

const getAllUsers = async (req, res) => {
  try {
    const User = req.models.User;
    const { search, page = 1, limit = 10, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }
    
    if (status === 'deactivated') {
      query.isActive = false;
    } else if (status === 'all') {
      // no filter
    } else {
      query.isActive = { $ne: false }; // active
    }

    const users = await User.find(query)
      .select("-password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(query);

    return res.status(200).json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalUsers: count,
    });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const User = req.models.User;
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const User = req.models.User;
    const { name, username, email, password, role, mobileNumber, dateOfBirth, employeeId, isActive } = req.body;
    if (!name || !username || !email || !password || !mobileNumber || !dateOfBirth) {
      return res.status(400).json({ msg: "Please provide all fields including username, mobile, and DOB" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "Email already in use" });
    }

    const userExists2 = await User.findOne({ username });
    if (userExists2) {
      return res.status(400).json({ msg: "Username already in use" });
    }

    const user = await User.create({ name, username, email, password, mobileNumber, dateOfBirth, role: role || "user", employeeId: employeeId || "", isActive: isActive !== undefined ? isActive : true });
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'A unique field';
      const formattedField = field === 'mobileNumber' ? 'Mobile Number' : (field.charAt(0).toUpperCase() + field.slice(1));
      return res.status(400).json({ msg: `${formattedField} is already in use. Please select a different one.` });
    }
    res.status(500).json({ msg: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const User = req.models.User;
    const { name, username, email, password, role, mobileNumber, dateOfBirth, employeeId, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.name = name || user.name;
    user.username = username || user.username;
    user.email = email || user.email;
    user.role = role || user.role;
    user.mobileNumber = mobileNumber || user.mobileNumber;
    user.dateOfBirth = dateOfBirth || user.dateOfBirth;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) {
      user.password = password; // Will be hashed by pre-save hook
    }

    await user.save();
    res.status(200).json({ user });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'A unique field';
      const formattedField = field === 'mobileNumber' ? 'Mobile Number' : (field.charAt(0).toUpperCase() + field.slice(1));
      return res.status(400).json({ msg: `${formattedField} is already in use. Please select a different one.` });
    }
    res.status(500).json({ msg: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const User = req.models.User;
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.status(200).json({ msg: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const { sendEmail } = require("../utils/emailService");

const register = async (req, res) => {
  const User = req.models.User;
  let { name, username, email, password, role, mobileNumber, dateOfBirth } = req.body;

  if (!name || !username || !email || !password || !mobileNumber || !dateOfBirth) {
    return res.status(400).json({ msg: "Please add all values in the request body" });
  }

  let foundEmail = await User.findOne({ email });
  if (foundEmail) {
    return res.status(400).json({ msg: "Email already in use" });
  }

  let foundUsername = await User.findOne({ username });
  if (foundUsername) {
    return res.status(400).json({ msg: "Username already in use" });
  }

  const person = new User({
    name,
    username,
    email,
    password,
    role: role || "user",
    mobileNumber,
    dateOfBirth
  });
  
  try {
    await person.save();
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'A unique field';
      const formattedField = field === 'mobileNumber' ? 'Mobile Number' : (field.charAt(0).toUpperCase() + field.slice(1));
      return res.status(400).json({ msg: `${formattedField} is already in use. Please select a different one.` });
    }
    return res.status(500).json({ msg: error.message });
  }

  // Send Welcome Email
  try {
    const subject = "Welcome to Attendance Management System";
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Welcome, ${name}!</h2>
        <p>Thank you for registering with our Attendance Management System.</p>
        <p>Your account has been successfully created.</p>
        <p>You can now login to mark your attendance and view reports.</p>
        <br>
        <p>Best Regards,</p>
        <p><strong>Attendance Team</strong></p>
      </div>
    `;
    await sendEmail(email, subject, html);
    console.log(`Welcome email sent to ${email}`);
  } catch (emailError) {
    console.error("Failed to send welcome email:", emailError);
    // Don't fail registration if email fails
  }

  return res.status(201).json({ person });
};

module.exports = {
  login,
  register,
  dashboard,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getProfile: async (req, res) => {
    try {
      console.log("getProfile called. User:", req.user);
      if (!req.user || !req.user.id) {
        console.error("User ID missing in request");
        return res.status(400).json({ msg: "User ID missing" });
      }
      const User = req.models.User;
      const user = await User.findById(req.user.id).select("-password");
      if (!user) {
        console.error("User not found in DB for ID:", req.user.id);
        return res.status(404).json({ msg: "User not found" });
      }
      res.status(200).json(user);
    } catch (error) {
      console.error("getProfile error:", error);
      res.status(500).json({ msg: error.message });
    }
  },
  updateProfile: async (req, res) => {
    try {
      const User = req.models.User;
      const { name, password } = req.body;
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      user.name = name || user.name;
      if (password) {
        user.password = password;
      }

      await user.save();
      res.status(200).json({ msg: "Profile updated successfully", user });
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0] || 'A unique field';
        const formattedField = field === 'mobileNumber' ? 'Mobile Number' : (field.charAt(0).toUpperCase() + field.slice(1));
        return res.status(400).json({ msg: `${formattedField} is already in use. Please select a different one.` });
      }
      res.status(500).json({ msg: error.message });
    }
  },
  resetDevice: async (req, res) => {
    try {
      const User = req.models.User;
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }
      user.deviceId = null;
      await user.save();
      res.status(200).json({ msg: "Device ID reset successfully" });
    } catch (error) {
      res.status(500).json({ msg: error.message });
    }
  }
};
