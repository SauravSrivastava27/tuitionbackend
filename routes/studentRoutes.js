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
    if (search) query.name = { $regex: search, $options: "i" };
    if (status) query.status = status;

    const students = await Student.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Student.countDocuments(query);

    res.json({ students, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error("Get students error:", err.message);
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

// Admin or linked student — READ ONE
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

// Admin only — UPDATE PROGRESS
router.post("/:id/progress", adminMiddleware, async (req, res) => {
  try {
    const { academicLevel, performanceGrade } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { "progress.academicLevel": academicLevel || "", "progress.performanceGrade": performanceGrade || "", "progress.lastReviewDate": new Date() },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Update progress error:", err.message);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

// Admin only — MARK ATTENDANCE (upsert by date)
router.post("/:id/attendance", adminMiddleware, async (req, res) => {
  try {
    const { date, present } = req.body;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const targetDate = new Date(date);
    const dateStr = targetDate.toDateString();
    const idx = student.attendance.findIndex(a => new Date(a.date).toDateString() === dateStr);

    if (idx >= 0) {
      student.attendance[idx].present = present !== false;
    } else {
      student.attendance.push({ date: targetDate, present: present !== false });
    }

    await student.save();
    res.json(student);
  } catch (err) {
    console.error("Mark attendance error:", err.message);
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

// Student only — MARK TODAY'S ATTENDANCE (no Sundays, once per day)
router.post("/:id/attendance/today", async (req, res) => {
  try {
    if (String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today.getDay() === 0)
      return res.status(400).json({ message: "No attendance on Sundays" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const todayStr = today.toDateString();
    const alreadyMarked = student.attendance.find(a => new Date(a.date).toDateString() === todayStr);
    if (alreadyMarked)
      return res.status(400).json({ message: "Attendance already marked for today" });

    student.attendance.push({ date: today, present: true });
    await student.save();
    res.json(student);
  } catch (err) {
    console.error("Mark today attendance error:", err.message);
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

// Admin only — DELETE ATTENDANCE RECORD
router.delete("/:id/attendance/:attendanceId", adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $pull: { attendance: { _id: req.params.attendanceId } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Delete attendance error:", err.message);
    res.status(500).json({ message: "Failed to delete attendance record" });
  }
});

// Admin only — ADD/UPDATE SUBJECT
router.post("/:id/subjects", adminMiddleware, async (req, res) => {
  try {
    const { name, grade, marks } = req.body;
    if (!name) return res.status(400).json({ message: "Subject name is required" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const idx = student.subjects.findIndex(s => s.name === name);
    if (idx >= 0) {
      student.subjects[idx] = { name, grade: grade || "", marks: marks ?? 0 };
    } else {
      student.subjects.push({ name, grade: grade || "", marks: marks ?? 0 });
    }

    await student.save();
    res.json(student);
  } catch (err) {
    console.error("Update subject error:", err.message);
    res.status(500).json({ message: "Failed to update subject" });
  }
});

// Admin only — DELETE SUBJECT
router.delete("/:id/subjects/:subjectId", adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $pull: { subjects: { _id: req.params.subjectId } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error("Delete subject error:", err.message);
    res.status(500).json({ message: "Failed to delete subject" });
  }
});

// Student only — GET NOTES
router.get("/:id/notes", async (req, res) => {
  try {
    if (String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const student = await Student.findById(req.params.id).select("notes");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ notes: student.notes });
  } catch (err) {
    console.error("Get notes error:", err.message);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

// Student only — ADD NOTE
router.post("/:id/notes", async (req, res) => {
  try {
    if (String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Note text is required" });

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ notes: student.notes });
  } catch (err) {
    console.error("Add note error:", err.message);
    res.status(500).json({ message: "Failed to add note" });
  }
});

// Student only — EDIT NOTE
router.put("/:id/notes/:noteId", async (req, res) => {
  try {
    if (String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Note text is required" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const note = student.notes.id(req.params.noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });

    note.text = text.trim();
    await student.save();
    res.json({ notes: student.notes });
  } catch (err) {
    console.error("Edit note error:", err.message);
    res.status(500).json({ message: "Failed to edit note" });
  }
});

// Student only — DELETE NOTE
router.delete("/:id/notes/:noteId", async (req, res) => {
  try {
    if (String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $pull: { notes: { _id: req.params.noteId } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ notes: student.notes });
  } catch (err) {
    console.error("Delete note error:", err.message);
    res.status(500).json({ message: "Failed to delete note" });
  }
});

// Admin or linked student — GET PROGRESS
router.get("/:id/progress", async (req, res) => {
  try {
    if (req.user.role !== "admin" && String(req.user.studentId) !== req.params.id)
      return res.status(403).json({ message: "Access denied" });

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({ progress: student.progress, attendance: student.attendance, subjects: student.subjects });
  } catch (err) {
    console.error("Get progress error:", err.message);
    res.status(500).json({ message: "Failed to fetch progress" });
  }
});

module.exports = router;
