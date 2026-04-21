const router = require("express").Router();
const User = require("../models/User");
const Student = require("../models/Student");
const adminMiddleware = require("../middleware/admin");

// Admin only — Get student and check if user exists
router.get("/student/:studentId/user-status", adminMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const user = await User.findOne({ studentId });

    res.json({
      student: {
        _id: student._id,
        name: student.name
      },
      hasUser: !!user,
      user: user ? {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      } : null
    });
  } catch (err) {
    console.error("Get user status error:", err.message);
    res.status(500).json({ message: "Failed to fetch user status" });
  }
});

// Admin only — Link a user account to a student profile
router.put("/link", adminMiddleware, async (req, res) => {
  try {
    const { userId, studentId } = req.body;
    if (!userId || !studentId)
      return res.status(400).json({ message: "userId and studentId are required" });

    const student = await Student.findById(studentId);
    if (!student)
      return res.status(404).json({ message: "Student not found" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // Prevent linking a student that's already linked to another user
    const existing = await User.findOne({ studentId, _id: { $ne: userId } });
    if (existing)
      return res.status(400).json({ message: `Student is already linked to user: ${existing.username}` });

    user.studentId = studentId;
    user.role = "student";
    await user.save();

    student.email = user.email;
    await student.save();

    res.json({
      message: `User linked to student "${student.name}"`,
      user: { _id: user._id, email: user.email, name: user.name, role: user.role, studentId: user.studentId }
    });
  } catch (err) {
    console.error("Link user error:", err.message);
    res.status(500).json({ message: "Failed to link user to student" });
  }
});

// Admin only — Unlink a user from a student profile
router.put("/unlink/:userId", adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.studentId) {
      await Student.findByIdAndUpdate(user.studentId, { email: null });
    }

    user.studentId = null;
    await user.save();

    res.json({ message: "User unlinked from student" });
  } catch (err) {
    console.error("Unlink user error:", err.message);
    res.status(500).json({ message: "Failed to unlink user" });
  }
});

// Admin only — List all users with their linked student (if any)
router.get("/all", adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: "student" })
      .populate("studentId", "name className school status")
      .select("username role studentId createdAt");

    res.json(users);
  } catch (err) {
    console.error("List users error:", err.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;
