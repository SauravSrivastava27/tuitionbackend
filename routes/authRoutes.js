const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twoFactor = require("node-2fa");
const QRCode = require("qrcode");
const { publicKey, decrypt } = require("../utils/encryption");
const User = require("../models/User");

// GET /api/auth/public-key  — frontend fetches this to encrypt passwords
router.get("/public-key", (_req, res) => {
  res.json({ publicKey });
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, phone } = req.body;
    const password = decrypt(req.body.password);
    if (!username || !password || !phone)
      return res.status(400).json({ message: "Username, password and phone are required" });

    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ message: "Phone must be a 10-digit number" });

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: "Username already exists" });

    // Generate TOTP secret for this user
    const secret = twoFactor.generateSecret({ name: "Tuition Management", account: username });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed, phone, twoFactorSecret: secret.secret });

    // Generate QR code as base64 image from the otpauth URI
    const qrCode = await QRCode.toDataURL(secret.uri);

    res.status(201).json({
      message: "User created. Scan the QR code with Google Authenticator.",
      qrCode,
      secret: secret.secret,
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
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

    res.json({ message: "Enter the code from your authenticator app", userId: user._id });
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
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      token,
      username: user.username,
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

module.exports = router;
