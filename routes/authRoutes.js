const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { publicKey, decrypt } = require("../utils/encryption");
const { sendOTP, sendPasswordReset } = require("../utils/emailService");
const User = require("../models/User");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,16}$/;
const validatePassword = (pw) => PASSWORD_REGEX.test(pw) ? null : "Password must be 8–16 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.";

// GET /api/auth/public-key
router.get("/public-key", (_req, res) => {
  res.json({ publicKey });
});

// GET /api/auth/setup-status — check if first admin setup is needed
router.get("/setup-status", async (_req, res) => {
  const adminExists = await User.findOne({ role: "admin" });
  res.json({ setupRequired: !adminExists });
});

// POST /api/auth/register — creates a student account
router.post("/register", async (req, res) => {
  try {
    const { email, phone, name } = req.body;

    if (!email || !req.body.password || !phone || !name)
      return res.status(400).json({ message: "Name, email, password and phone are required" });

    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: "Invalid email address" });

    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ message: "Phone must be a 10-digit number" });

    const password = decrypt(req.body.password);

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.googleId && !existing.password)
        return res.status(400).json({ message: "This email is already linked to a Google account. Please sign in with Google." });
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, phone, role: "student" });

    res.status(201).json({ message: "Account created successfully! You can now login." });
  } catch (err) {
    console.error("Register error:", err.message, err.stack);
    res.status(500).json({ message: err.message || "Registration failed. Please try again." });
  }
});

// POST /api/auth/setup — creates first admin (only works when no admin exists)
router.post("/setup", async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: "admin" });
    if (adminExists)
      return res.status(403).json({ message: "Setup already complete. An admin account already exists." });

    const { email, phone, name } = req.body;

    if (!email || !req.body.password || !phone || !name)
      return res.status(400).json({ message: "Name, email, password and phone are required" });

    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: "Invalid email address" });

    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ message: "Phone must be a 10-digit number" });

    const password = decrypt(req.body.password);

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, phone, role: "admin" });

    res.status(201).json({ message: "Admin account created successfully! You can now login." });
  } catch (err) {
    console.error("Setup error:", err.message, err.stack);
    res.status(500).json({ message: err.message || "Setup failed. Please try again." });
  }
});

// POST /api/auth/login — step 1: verify credentials, send OTP to email
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    const password = decrypt(req.body.password);

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    // Support legacy username login during migration
    const user = await User.findOne(
      email.includes("@") ? { email } : { username: email }
    );
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.password)
      return res.status(401).json({ message: "This account uses Google sign-in. Please use Sign in with Google." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const userEmail = user.email;
    if (!userEmail)
      return res.status(400).json({ message: "No email on this account. Please contact your administrator." });

    const otp = generateOTP();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTP(userEmail, otp);

    res.json({
      message: `OTP sent to ${userEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}`,
      userId: user._id,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

// POST /api/auth/verify-otp — step 2: verify email OTP, issue JWT
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp)
      return res.status(400).json({ message: "userId and otp are required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.otpCode || !user.otpExpiry)
      return res.status(400).json({ message: "No OTP requested. Please login again." });

    if (new Date() > user.otpExpiry)
      return res.status(400).json({ message: "OTP has expired. Please login again." });

    if (user.otpCode !== otp)
      return res.status(400).json({ message: "Invalid OTP. Please try again." });

    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.email, role: user.role, studentId: user.studentId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      token,
      username: user.email,
      name: user.name,
      role: user.role,
      studentId: user.studentId,
      expiresIn: 900,
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

// POST /api/auth/forgot-password — send reset OTP to email
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne(
      email.includes("@") ? { email } : { username: email }
    );
    if (!user) return res.status(404).json({ message: "No account found with that email" });

    const otp = generateOTP();
    user.resetToken = otp;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendPasswordReset(user.email, otp);

    res.json({ message: `Reset code sent to ${user.email.replace(/(.{2}).*(@.*)/, "$1***$2")}` });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ message: "Failed to process request" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword)
      return res.status(400).json({ message: "Email, reset code, and new password are required" });

    const user = await User.findOne(
      email.includes("@") ? { email } : { username: email }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.resetToken || user.resetToken !== resetToken)
      return res.status(400).json({ message: "Invalid reset code" });

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Reset code has expired" });

    const password = decrypt(newPassword);
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful! You can now login." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

module.exports = router;
