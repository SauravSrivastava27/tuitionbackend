const mongoose = require("mongoose");

const adminCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  notes: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("AdminCode", adminCodeSchema);
