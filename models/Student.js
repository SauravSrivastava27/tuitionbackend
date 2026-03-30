const mongoose = require("mongoose");
const studentSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  address:      { type: String, required: true },
  guardianName: { type: String, required: true },
  school:       { type: String, required: true },
  className:    { type: String, required: true },
  contactNo:    { type: String, required: true },
  fee:          { type: Number, required: true },
  progress:     { type: String, default: "" },
  notes: [
    {
      text:    { type: String, required: true },
      addedAt: { type: Date, default: Date.now },
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model("Student", studentSchema);