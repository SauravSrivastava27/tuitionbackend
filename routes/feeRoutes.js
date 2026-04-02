const router = require("express").Router();
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const adminMiddleware = require("../middleware/admin");

// Admin only — CREATE FEE RECORD
router.post("/", adminMiddleware, async (req, res) => {
  try {
    const { studentId, amount, dueDate, paymentMethod, notes } = req.body;
    if (!studentId || !amount || !dueDate)
      return res.status(400).json({ message: "studentId, amount, and dueDate are required" });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const fee = await Fee.create({
      studentId,
      amount,
      dueDate,
      paymentMethod: paymentMethod || "cash",
      notes: notes || ""
    });

    res.status(201).json(fee);
  } catch (err) {
    console.error("Create fee error:", err.message);
    res.status(500).json({ message: "Failed to create fee record" });
  }
});

// Admin only — GET FEES with filters
router.get("/", adminMiddleware, async (req, res) => {
  try {
    const { studentId, status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;

    const fees = await Fee.find(query)
      .populate("studentId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Fee.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      fees,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages }
    });
  } catch (err) {
    console.error("Get fees error:", err.message);
    res.status(500).json({ message: "Failed to fetch fees" });
  }
});

// Admin only — GET FEE SUMMARY
router.get("/summary", adminMiddleware, async (_req, res) => {
  try {
    const summary = await Fee.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalCollected = await Fee.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      summary,
      totalCollected: totalCollected[0]?.total || 0
    });
  } catch (err) {
    console.error("Get fee summary error:", err.message);
    res.status(500).json({ message: "Failed to fetch fee summary" });
  }
});

// Admin only — UPDATE FEE RECORD
router.put("/:id", adminMiddleware, async (req, res) => {
  try {
    const { status, paidDate, paymentMethod, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (paidDate) update.paidDate = paidDate;
    if (paymentMethod) update.paymentMethod = paymentMethod;
    if (notes) update.notes = notes;

    const fee = await Fee.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });

    res.json(fee);
  } catch (err) {
    console.error("Update fee error:", err.message);
    res.status(500).json({ message: "Failed to update fee record" });
  }
});

// Admin only — DELETE FEE RECORD
router.delete("/:id", adminMiddleware, async (req, res) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) return res.status(404).json({ message: "Fee record not found" });

    res.json({ message: "Fee record deleted" });
  } catch (err) {
    console.error("Delete fee error:", err.message);
    res.status(500).json({ message: "Failed to delete fee record" });
  }
});

module.exports = router;
