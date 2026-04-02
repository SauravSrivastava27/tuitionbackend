const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username:          { type: String, required: true, unique: true },
  email:             { type: String, default: null },
  password:          { type: String, required: true },
  phone:             { type: String, required: true },
  twoFactorSecret:   { type: String, required: true },
  twoFactorEnabled:  { type: Boolean, default: true },
  role:              { type: String, enum: ["admin", "student"], default: "student" },
  studentId:         { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  resetToken:        { type: String, default: null },
  resetTokenExpiry:  { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
