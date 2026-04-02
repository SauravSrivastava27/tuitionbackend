const router = require("express").Router();
const crypto = require("crypto");
const AdminCode = require("../models/AdminCode");
const adminMiddleware = require("../middleware/admin");

// All routes are admin only
router.use(adminMiddleware);

// GET all admin codes
router.get("/", async (_req, res) => {
  try {
    const codes = await AdminCode.find()
      .populate("createdBy", "username")
      .populate("usedBy", "username")
      .sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admin codes" });
  }
});

// POST generate a new admin code
router.post("/", async (req, res) => {
  try {
    const { expiresAt, notes } = req.body;

    const code = crypto.randomBytes(16).toString("hex"); // random 32-char hex code

    const adminCode = await AdminCode.create({
      code,
      createdBy: req.user.userId,
      isActive: true,
      expiresAt: expiresAt || null,
      notes: notes || "",
    });

    res.status(201).json(adminCode);
  } catch (err) {
    res.status(500).json({ message: "Failed to generate admin code" });
  }
});

// PATCH deactivate a code
router.patch("/:id/deactivate", async (req, res) => {
  try {
    const code = await AdminCode.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!code) return res.status(404).json({ message: "Admin code not found" });
    res.json(code);
  } catch (err) {
    res.status(500).json({ message: "Failed to deactivate code" });
  }
});

// DELETE a code
router.delete("/:id", async (req, res) => {
  try {
    const code = await AdminCode.findByIdAndDelete(req.params.id);
    if (!code) return res.status(404).json({ message: "Admin code not found" });
    res.json({ message: "Admin code deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete admin code" });
  }
});

module.exports = router;
