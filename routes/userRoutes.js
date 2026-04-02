const router = require("express").Router();
const User = require("../models/User");
const adminMiddleware = require("../middleware/admin");
const bcrypt = require("bcryptjs");

// GET own profile (any authenticated user)
router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId, "-password -twoFactorSecret");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// PUT change own password (any authenticated user)
router.put("/me/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Current and new password are required" });

    const { decrypt } = require("../utils/encryption");
    const bcrypt = require("bcryptjs");

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentPlain = decrypt(currentPassword);
    const match = await bcrypt.compare(currentPlain, user.password);
    if (!match) return res.status(400).json({ message: "Current password is incorrect" });

    const newPlain = decrypt(newPassword);
    if (newPlain.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters" });

    user.password = await bcrypt.hash(newPlain, 10);
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ message: "Failed to change password" });
  }
});

// All routes here are admin only (with exception of profile/password for self access)
router.use(adminMiddleware);

// GET all users with their roles
router.get("/", async (_req, res) => {
  try {
    const users = await User.find({}, "-password -twoFactorSecret").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET a specific user
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "-password -twoFactorSecret");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// PUT update user profile (username, phone)
router.put("/:id/profile", async (req, res) => {
  try {
    const { username, phone } = req.body;

    if (username || phone) {
      // Check if username is unique (if being updated)
      if (username && username !== (await User.findById(req.params.id)).username) {
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ message: "Username already exists" });
      }

      // Validate phone if provided
      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ message: "Phone must be a 10-digit number" });
      }

      const update = {};
      if (username) update.username = username;
      if (phone) update.phone = phone;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true, select: "-password -twoFactorSecret" }
      );

      return res.json(user);
    }

    res.status(400).json({ message: "No fields to update" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// PATCH update role (admin only on themselves or others)
router.patch("/:id/role", async (req, res) => {
  try {
    const { role, studentId } = req.body;
    if (!role || !["admin", "student"].includes(role))
      return res.status(400).json({ message: "role must be 'admin' or 'student'" });

    const update = { role };
    if (role === "student") update.studentId = studentId || null;
    if (role === "admin") update.studentId = null;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: "-password -twoFactorSecret" });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update role" });
  }
});

// DELETE a user (admin only)
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
