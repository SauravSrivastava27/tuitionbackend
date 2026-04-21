const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
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
  .then(async () => {
    console.log("MongoDB connected");
    try {
      await mongoose.connection.collection("users").dropIndexes();
      console.log("Dropped all legacy user indexes");
    } catch (_) {}
    const User = require("./models/User");
    await User.syncIndexes();
    console.log("User indexes recreated");
  })
  .catch(err => console.error(err));

const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

app.use(session({
  secret: process.env.JWT_SECRET || "tuition_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));
app.use(passport.initialize());
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auth", require("./routes/googleAuthRoutes"));
app.use("/api/students", authMiddleware, require("./routes/studentRoutes"));
app.use("/api/student-users", authMiddleware, require("./routes/studentUserRoutes"));
app.use("/api/users", authMiddleware, require("./routes/userRoutes"));
app.use("/api/fees", authMiddleware, require("./routes/feeRoutes"));
app.use("/api/analytics", authMiddleware, require("./routes/analyticsRoutes"));


// TEMP DEV: remove all admin users — delete after use
app.get("/api/dev/clear-admins", async (req, res) => {
  if (req.query.token !== "clear-admins-dev") return res.status(403).json({ message: "Forbidden" });
  const User = require("./models/User");
  const result = await User.deleteMany({ role: "admin" });
  res.json({ message: `Deleted ${result.deletedCount} admin user(s)` });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
