const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  phone:          { type: String, required: true },
  twoFactorSecret:{ type: String, required: true },
});

module.exports = mongoose.model("User", userSchema);
