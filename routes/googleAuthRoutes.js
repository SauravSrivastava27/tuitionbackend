const router = require("express").Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const { Strategy: GoogleStrategy } = require("passport-google-oauth20");

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleName = profile.displayName || profile.name?.givenName || email;

      let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
      if (user) {
        let changed = false;
        if (!user.googleId) { user.googleId = profile.id; changed = true; }
        if (!user.name)     { user.name = googleName;     changed = true; }
        if (changed) await user.save();
        return done(null, user);
      }
      user = await User.create({ email, name: googleName, googleId: profile.id, role: "student" });
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
}

// GET /api/auth/google
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: "Google OAuth not configured" });
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

// GET /api/auth/google/callback
router.get("/google/callback", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: "Google OAuth not configured" });
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
    failureMessage: true,
    session: false,
  }, (err, user, info) => {
    if (err) { console.error("Google OAuth error:", err); return next(err); }
    if (!user) { console.error("Google OAuth no user, info:", info); return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`); }
    req.user = user;
    next();
  })(req, res, next);
}, (req, res) => {
  const token = jwt.sign(
    { userId: req.user._id, username: req.user.email, role: req.user.role, studentId: req.user.studentId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
  const params = new URLSearchParams({
    token,
    username: req.user.email,
    name: req.user.name || req.user.email,
    role: req.user.role,
    studentId: req.user.studentId || "",
  });
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${params}`);
});

module.exports = router;
