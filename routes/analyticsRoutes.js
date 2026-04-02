const router = require("express").Router();
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const User = require("../models/User");
const adminMiddleware = require("../middleware/admin");

// Admin only — DASHBOARD STATS
router.get("/dashboard", adminMiddleware, async (_req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: "active" });
    const completedStudents = await Student.countDocuments({ status: "completed" });
    const inactiveStudents = await Student.countDocuments({ status: "inactive" });

    const totalFees = await Fee.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const paidFees = await Fee.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const pendingFees = await Fee.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const overdueFees = await Fee.aggregate([
      { $match: { status: "overdue" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: "admin" });
    const studentUsers = await User.countDocuments({ role: "student" });

    // Get recently created users (last 5)
    const recentlyCreatedUsers = await User.find({ role: "student" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("studentId", "name")
      .select("username createdAt studentId");

    res.json({
      students: {
        total: totalStudents,
        active: activeStudents,
        completed: completedStudents,
        inactive: inactiveStudents
      },
      fees: {
        total: totalFees[0]?.total || 0,
        paid: paidFees[0]?.total || 0,
        pending: pendingFees[0]?.total || 0,
        overdue: overdueFees[0]?.total || 0
      },
      users: {
        total: totalUsers,
        admin: adminUsers,
        student: studentUsers
      },
      recentlyCreatedUsers: recentlyCreatedUsers.map(user => ({
        _id: user._id,
        username: user.username,
        studentName: user.studentId?.name || "Unknown",
        createdAt: user.createdAt
      }))
    });
  } catch (err) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

// Admin only — STUDENT STATUS BREAKDOWN
router.get("/student-status", adminMiddleware, async (_req, res) => {
  try {
    const statusBreakdown = await Student.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ statusBreakdown });
  } catch (err) {
    console.error("Student status error:", err.message);
    res.status(500).json({ message: "Failed to fetch student status breakdown" });
  }
});

// Admin only — FEE SUMMARY
router.get("/fee-summary", adminMiddleware, async (_req, res) => {
  try {
    const feeSummary = await Fee.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const feeByMonth = await Fee.aggregate([
      {
        $match: { status: "paid" }
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidDate" },
            month: { $month: "$paidDate" }
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 }
      },
      {
        $limit: 12
      }
    ]);

    res.json({
      summary: feeSummary,
      byMonth: feeByMonth
    });
  } catch (err) {
    console.error("Fee summary error:", err.message);
    res.status(500).json({ message: "Failed to fetch fee summary" });
  }
});

// Admin only — RECENT ACTIVITIES
router.get("/recent-activity", adminMiddleware, async (_req, res) => {
  try {
    const recentStudents = await Student.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt status");

    const recentFees = await Fee.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("studentId", "name");

    res.json({
      recentStudents,
      recentFees
    });
  } catch (err) {
    console.error("Recent activity error:", err.message);
    res.status(500).json({ message: "Failed to fetch recent activity" });
  }
});

module.exports = router;
