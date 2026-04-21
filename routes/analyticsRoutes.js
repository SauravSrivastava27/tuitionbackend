const router = require("express").Router();
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const User = require("../models/User");
const adminMiddleware = require("../middleware/admin");

// Admin only — DASHBOARD STATS
router.get("/dashboard", adminMiddleware, async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStudents, activeStudents, completedStudents, inactiveStudents,
      totalUsers, adminUsers, studentUsers,
      feeTotals, feeStatusCounts,
      recentStudents, recentFees,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ status: "active" }),
      Student.countDocuments({ status: "completed" }),
      Student.countDocuments({ status: "inactive" }),
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "student" }),
      // Correct: sum amount billed vs paidAmount actually received
      Fee.aggregate([
        { $group: { _id: null, billed: { $sum: "$amount" }, collected: { $sum: { $ifNull: ["$paidAmount", 0] } } } }
      ]),
      Fee.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Student.find().sort({ createdAt: -1 }).limit(5).select("name status fee joinDate createdAt"),
      Fee.find().sort({ createdAt: -1 }).limit(5)
        .populate("studentId", "name")
        .select("amount paidAmount status paidDate dueDate studentId createdAt"),
    ]);

    const billed    = feeTotals[0]?.billed    || 0;
    const collected = feeTotals[0]?.collected || 0;
    const statusMap = {};
    feeStatusCounts.forEach(f => { statusMap[f._id] = f.count; });

    res.json({
      students: { total: totalStudents, active: activeStudents, completed: completedStudents, inactive: inactiveStudents },
      fees: {
        total: billed,
        paid: collected,
        remaining: billed - collected,
        overdueCount:  statusMap["overdue"]  || 0,
        pendingCount:  statusMap["pending"]  || 0,
        paidCount:     statusMap["paid"]     || 0,
        collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      },
      users: { total: totalUsers, admin: adminUsers, student: studentUsers },
      recentStudents: recentStudents.map(s => ({
        _id: s._id, name: s.name, status: s.status, fee: s.fee,
        joinDate: s.joinDate || s.createdAt,
      })),
      recentFees: recentFees.map(f => ({
        _id: f._id,
        studentName: f.studentId?.name || "Unknown",
        amount: f.amount,
        paidAmount: f.paidAmount || 0,
        status: f.status,
        dueDate: f.dueDate,
        paidDate: f.paidDate,
        createdAt: f.createdAt,
      })),
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
