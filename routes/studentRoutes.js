const router = require("express").Router();
const Student = require("../models/Student");
const adminMiddleware = require("../middleware/admin");

// Admin only — CREATE
router.post("/", adminMiddleware, async (req, res) => {
  const student = await Student.create(req.body);
  res.status(201).json(student);
});

// Admin only — READ ALL
router.get("/", adminMiddleware, async (_req, res) => {
  const students = await Student.find().sort({ createdAt: -1 });
  res.json(students);
});

// Admin or the linked student — READ ONE
router.get("/:id", async (req, res) => {
  if (req.user.role !== "admin" && String(req.user.studentId) !== req.params.id)
    return res.status(403).json({ message: "Access denied" });

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json(student);
});

// Admin only — UPDATE
router.put("/:id", adminMiddleware, async (req, res) => {
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(student);
});

// Admin only — DELETE
router.delete("/:id", adminMiddleware, async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ message: "Student deleted" });
});

// Admin or linked student — ADD NOTE
router.post("/:id/notes", async (req, res) => {
  if (req.user.role !== "admin" && String(req.user.studentId) !== req.params.id)
    return res.status(403).json({ message: "Access denied" });

  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "Note text is required" });

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { $push: { notes: { text } } },
    { new: true }
  );
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json(student);
});

module.exports = router;
