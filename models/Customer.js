const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide customer name"],
  },
  number: {
    type: String,
    required: [true, "Please provide customer number"],
  },
  email: {
    type: String,
  },
  landmark: {
    type: String,
  },
  permissions: {
    editEmail: { type: Boolean, default: false },
    editNumber: { type: Boolean, default: false },
    editAddress: { type: Boolean, default: false }
  },
  visibleTo: {
    type: String,
    default: "All Staff"
  },
  address: {
    type: String,
    required: [true, "Please provide address"],
  },
  city: {
    type: String,
  },
  postalCode: {
    type: String,
  },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

module.exports = mongoose.model("Customer", CustomerSchema);
