const router = require("express").Router();
const User = require("../models/User");
const adminMiddleware = require("../middleware/admin");

// All routes here are admin only
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

// PATCH update role (and optionally studentId) of a user
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

module.exports = router;
