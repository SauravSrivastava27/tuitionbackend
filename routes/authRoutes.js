const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twoFactor = require("node-2fa");
const QRCode = require("qrcode");
const { publicKey, decrypt } = require("../utils/encryption");
const { sendLoginCredentials } = require("../utils/emailService");
const User = require("../models/User");
const AdminCode = require("../models/AdminCode");

// GET /api/auth/public-key  — frontend fetches this to encrypt passwords
router.get("/public-key", (_req, res) => {
  res.json({ publicKey });
});

// POST /api/auth/register - Step 1: Generate 2FA and return QR code
router.post("/register", async (req, res) => {
  try {
    const { username, phone, adminCode } = req.body;
    const password = decrypt(req.body.password);
    if (!username || !password || !phone)
      return res.status(400).json({ message: "Username, password and phone are required" });

    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ message: "Phone must be a 10-digit number" });

    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username already exists" });

    // Determine user role based on admin code
    let userRole = "student";
    let usedAdminCode = null;
    let adminCodeDaysRemaining = null;

    if (adminCode) {
      const adminCodeRecord = await AdminCode.findOne({
        code: adminCode,
        isActive: true,
        usedBy: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
      });

      if (!adminCodeRecord) {
        return res.status(400).json({ message: "Invalid or expired admin registration code" });
      }

      userRole = "admin";
      usedAdminCode = adminCodeRecord._id;
      if (adminCodeRecord.expiresAt) {
        adminCodeDaysRemaining = Math.ceil((adminCodeRecord.expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      }
    }

    // Generate 2FA secret (MANDATORY)
    const twoFactorResult = twoFactor.generateSecret({ name: `Tuition (${username})`, issuer: "Tuition" });
    const tempSecret = twoFactorResult.secret;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(twoFactorResult.uri);

    // Hash password now so it never needs to travel back to the server again
    const hashedPassword = await bcrypt.hash(password, 10);

    res.status(200).json({
      message: "Scan the QR code with Google Authenticator or Authy to complete registration",
      qrCode,
      tempSecret,
      daysRemaining: adminCodeDaysRemaining,
      registrationData: {
        username,
        password: hashedPassword,
        phone,
        adminCode,
        userRole
      }
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// POST /api/auth/register/verify-2fa - Step 2: Verify 2FA and create user
router.post("/register/verify-2fa", async (req, res) => {
  try {
    const { otp, tempSecret, registrationData } = req.body;

    if (!otp || !tempSecret || !registrationData) {
      return res.status(400).json({ message: "Missing verification data" });
    }

    const { username, password: hashedPassword, phone, adminCode, userRole } = registrationData;

    // Verify OTP
    const verified = twoFactor.verifyToken(tempSecret, otp);
    if (!verified) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    // Create user with 2FA secret (password already hashed in step 1)
    const user = await User.create({
      username,
      password: hashedPassword,
      phone,
      twoFactorSecret: tempSecret,
      twoFactorEnabled: true,
      role: userRole,
      studentId: null
    });

    // Mark admin code as used if it was an admin registration
    if (adminCode) {
      const adminCodeRecord = await AdminCode.findOne({
        code: adminCode,
        isActive: true
      });

      if (adminCodeRecord) {
        await AdminCode.findByIdAndUpdate(adminCodeRecord._id, {
          usedBy: user._id,
          usedAt: new Date(),
        });
      }
    }

    res.status(201).json({
      message: "Registration successful! You can now login with your credentials.",
      role: userRole,
      twoFactorEnabled: true
    });
  } catch (err) {
    console.error("2FA verification error:", err.message);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// POST /api/auth/login  — Step 1: verify credentials
router.post("/login", async (req, res) => {
  try {
    const { username } = req.body;
    const password = decrypt(req.body.password);
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    let needsFirstTimeSetup = false;

    // Auto-generate 2FA for old accounts missing it
    if (!user.twoFactorSecret) {
      const twoFactorResult = twoFactor.generateSecret({
        name: `Tuition (${user.username})`,
        issuer: "Tuition"
      });
      user.twoFactorSecret = twoFactorResult.secret;
      user.twoFactorEnabled = true;
      await user.save();
      needsFirstTimeSetup = true;
    }

    // 2FA is mandatory for all users
    res.json({
      message: needsFirstTimeSetup
        ? "Please set up two-factor authentication first"
        : "Enter the code from your authenticator app",
      userId: user._id,
      requiresOtp: !needsFirstTimeSetup,
      needsFirstTimeSetup: needsFirstTimeSetup,
      username: user.username
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

// POST /api/auth/verify-otp  — Step 2: verify TOTP code, issue JWT
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp)
      return res.status(400).json({ message: "userId and otp are required" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const result = twoFactor.verifyToken(user.twoFactorSecret, otp);
    if (!result || result.delta !== 0)
      return res.status(400).json({ message: "Invalid or expired code. Try again." });

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, studentId: user.studentId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      token,
      username: user.username,
      role: user.role,
      studentId: user.studentId,
      expiresIn: 900,
      loginAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
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

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset code to user
    user.resetToken = resetCode;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    res.json({
      message: "Password reset code generated",
      resetCode, // Display to user (no email available)
      expiresIn: "15 minutes",
      userPhone: user.phone.slice(-4) // Show last 4 digits for verification
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ message: "Failed to process request" });
  }
});

// POST /api/auth/setup-first-2fa - For old accounts without 2FA to set it up
router.post("/setup-first-2fa", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ message: "Username is required" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // Only allow if user doesn't have 2FA yet
    if (user.twoFactorSecret) {
      return res.status(400).json({ message: "This account already has 2FA set up" });
    }

    const twoFactorResult = twoFactor.generateSecret({
      name: `Tuition (${user.username})`,
      issuer: "Tuition"
    });

    const qrCode = await QRCode.toDataURL(twoFactorResult.uri);

    // Store temp secret in user document temporarily
    user.twoFactorSecret = twoFactorResult.secret;
    await user.save();

    res.json({
      message: "Scan this QR code to set up 2FA on your authenticator app",
      qrCode,
      tempSecret: twoFactorResult.secret,
      username
    });
  } catch (err) {
    console.error("Setup 2FA error:", err.message);
    res.status(500).json({ message: "Failed to setup 2FA" });
  }
});

// POST /api/auth/verify-first-2fa - Verify the first 2FA setup
router.post("/verify-first-2fa", async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp)
      return res.status(400).json({ message: "Username and OTP are required" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const result = twoFactor.verifyToken(user.twoFactorSecret, otp);
    if (!result || result.delta !== 0)
      return res.status(400).json({ message: "Invalid OTP. Try again." });

    // 2FA is now confirmed
    user.twoFactorEnabled = true;
    await user.save();

    res.json({
      message: "2FA setup successful! You can now login with your credentials.",
      twoFactorEnabled: true
    });
  } catch (err) {
    console.error("Verify first 2FA error:", err.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

// POST /api/auth/reset-password - Verify reset code and set new password
router.post("/reset-password", async (req, res) => {
  try {
    const { username, resetToken, newPassword } = req.body;
    if (!username || !resetToken || !newPassword)
      return res.status(400).json({ message: "Username, reset code, and new password are required" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (!user.resetToken || user.resetToken !== resetToken)
      return res.status(400).json({ message: "Invalid reset code" });

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Reset code has expired" });

    const password = decrypt(newPassword);
    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful! You can now login with your new password." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

// POST /api/auth/regenerate-2fa — regenerate 2FA secret for logged-in user
router.post("/regenerate-2fa", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "No token provided" });

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const twoFactorResult = twoFactor.generateSecret({
      name: `Tuition (${user.username})`,
      issuer: "Tuition",
    });

    const qrCode = await QRCode.toDataURL(twoFactorResult.uri);

    user.twoFactorSecret = twoFactorResult.secret;
    await user.save();

    res.json({
      message: "2FA regenerated successfully. Scan the new QR code.",
      qrCode,
      secret: twoFactorResult.secret,
    });
  } catch (err) {
    console.error("Regenerate 2FA error:", err.message);
    res.status(500).json({ message: "Failed to regenerate 2FA" });
  }
});

module.exports = router;
