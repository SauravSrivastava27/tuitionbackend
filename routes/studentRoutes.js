const router = require("express").Router();
const Student = require("../models/Student");
const adminMiddleware = require("../middleware/admin");

// Admin only — CREATE
router.post("/", adminMiddleware, async (req, res) => {
  try {
    const { name, address, guardianName, school, className, contactNo, fee } = req.body;
    if (!name || !address || !guardianName || !school || !className || !contactNo || !fee)
      return res.status(400).json({ message: "All required fields must be provided" });

    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    console.error("Create student error:", err.message);
    res.status(500).json({ message: "Failed to create student" });
  }
});

// Admin only — READ ALL with filters and pagination
router.get("/", adminMiddleware, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (status) {
      query.status = status;
    }

    const students = await Student.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Student.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      students,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages }
    });
  } catch (err) {
    console.error("Get students error:", err.message);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// Admin or the linked student — READ ONE
router.get("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin" && String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Get student error:", err.message);
    res.status(500).json({ message: "Failed to fetch student" });
  }
});

// Admin only — UPDATE
router.put("/:id", adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Update student error:", err.message);
    res.status(500).json({ message: "Failed to update student" });
  }
});

// Admin only — DELETE
router.delete("/:id", adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted" });
  } catch (err) {
    console.error("Delete student error:", err.message);
    res.status(500).json({ message: "Failed to delete student" });
  }
});

// Admin or linked student — ADD NOTE
router.post("/:id/notes", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Add note error:", err.message);
    res.status(500).json({ message: "Failed to add note" });
  }
});

// Admin only — UPDATE PROGRESS
router.post("/:id/progress", adminMiddleware, async (req, res) => {
  try {
    const { academicLevel, performanceGrade } = req.body;
    const update = {
      "progress.academicLevel": academicLevel || "",
      "progress.performanceGrade": performanceGrade || "",
      "progress.lastReviewDate": new Date()
    };

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Update progress error:", err.message);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

// Admin only — MARK ATTENDANCE
router.post("/:id/attendance", adminMiddleware, async (req, res) => {
  try {
    const { date, present } = req.body;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $push: { attendance: { date: new Date(date), present: present !== false } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Mark attendance error:", err.message);
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

// Admin only — ADD/UPDATE SUBJECT
router.post("/:id/subjects", adminMiddleware, async (req, res) => {
  try {
    const { name, grade, marks } = req.body;
    if (!name) return res.status(400).json({ message: "Subject name is required" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const subjectIndex = student.subjects.findIndex(s => s.name === name);
    if (subjectIndex >= 0) {
      student.subjects[subjectIndex] = { name, grade: grade || "", marks: marks || 0 };
    } else {
      student.subjects.push({ name, grade: grade || "", marks: marks || 0 });
    }

    await student.save();
    res.json(student);
  } catch (err) {
    console.error("Update subject error:", err.message);
    res.status(500).json({ message: "Failed to update subject" });
  }
});

// Admin or linked student — GET PROGRESS
router.get("/:id/progress", async (req, res) => {
  try {
    if (req.user.role !== "admin" && String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({
      progress: student.progress,
      attendance: student.attendance,
      subjects: student.subjects
    });
  } catch (err) {
    console.error("Get progress error:", err.message);
    res.status(500).json({ message: "Failed to fetch progress" });
  }
});

module.exports = router;
