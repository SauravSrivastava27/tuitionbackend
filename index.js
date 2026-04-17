const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.ALLOWED_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/students", authMiddleware, require("./routes/studentRoutes"));
app.use("/api/student-users", authMiddleware, require("./routes/studentUserRoutes"));
app.use("/api/users", authMiddleware, require("./routes/userRoutes"));
app.use("/api/admin-codes", authMiddleware, require("./routes/adminCodeRoutes"));
app.use("/api/fees", authMiddleware, require("./routes/feeRoutes"));
app.use("/api/analytics", authMiddleware, require("./routes/analyticsRoutes"));

// TEMPORARY: one-time seed route — remove after use
app.get("/api/seed-admin-code", async (req, res) => {
  if (req.query.token !== "seed-mai-hu-admin-2024") return res.status(403).json({ message: "Forbidden" });
  const AdminCode = require("./models/AdminCode");
  const existing = await AdminCode.findOne({ code: "MaiHuAdmin" });
  if (existing) return res.json({ message: "Already exists", code: existing });
  const record = await AdminCode.create({ code: "MaiHuAdmin", createdBy: null, isActive: true, expiresAt: null, notes: "Permanent admin registration code" });
  res.json({ message: "Seeded successfully", code: record });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
