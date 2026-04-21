const mongoose = require("mongoose");
const studentSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, default: null },
  address:      { type: String, required: true },
  guardianName: { type: String, required: true },
  school:       { type: String, required: true },
  className:    { type: String, required: true },
  contactNo:    { type: String, required: true },
  fee:          { type: Number, required: true },
  joinDate:     { type: Date, default: Date.now },
  status:       { type: String, enum: ["active", "inactive", "completed"], default: "active" },
  feeStatus:    { type: String, enum: ["paid", "pending", "overdue"], default: "pending" },
  progress: {
    academicLevel: { type: String, default: "" },
    performanceGrade: { type: String, enum: ["A", "B", "C", "D", "F", ""], default: "" },
    lastReviewDate: { type: Date, default: null },
  },
  attendance: [
    {
      date: { type: Date, required: true },
      present: { type: Boolean, default: true },
    }
  ],
  subjects: [
    {
      name: { type: String, required: true },
      grade: { type: String, enum: ["A", "B", "C", "D", "F", ""], default: "" },
      marks: { type: Number, default: 0 },
    }
  ],
  notes: [
    {
      text:    { type: String, required: true },
      addedAt: { type: Date, default: Date.now },
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model("Student", studentSchema);