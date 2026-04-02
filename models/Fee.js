const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date, default: null },
  status: { type: String, enum: ["pending", "paid", "overdue"], default: "pending" },
  paymentMethod: { type: String, enum: ["cash", "cheque", "online", "other"], default: "cash" },
  notes: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Fee", feeSchema);
