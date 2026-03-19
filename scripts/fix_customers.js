require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({});
    if (user) {
      await Customer.updateMany(
        { createdBy: { $exists: false } },
        { createdBy: user._id }
      );
      console.log('Fixed missing createdBy fields!', user._id);
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
})();
