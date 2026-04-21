const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:             { type: String, default: null },
  email:            { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  username:         { type: String, default: null },
  password:         { type: String, default: null },
  phone:            { type: String, default: null },
  googleId:         { type: String, unique: true, sparse: true },
  role:             { type: String, enum: ["admin", "student"], default: "student" },
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  otpCode:          { type: String, default: null },
  otpExpiry:        { type: Date, default: null },
  resetToken:       { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  twoFactorSecret:  { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
