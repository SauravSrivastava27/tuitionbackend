const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendOTP = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP - Tuition Management",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color: #4f46e5;">Login Verification</h2>
          <p>Your one-time password is:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; background: #f5f6fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("OTP email error:", err.message);
    return { success: false, error: err.message };
  }
};

const sendPasswordReset = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Code - Tuition Management",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color: #4f46e5;">Password Reset</h2>
          <p>Your password reset code is:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; background: #f5f6fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 13px;">This code expires in <strong>15 minutes</strong>.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Password reset email error:", err.message);
    return { success: false, error: err.message };
  }
};

const sendLoginCredentials = async (email, username, password, role = "student") => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your ${role.charAt(0).toUpperCase() + role.slice(1)} Account Created - Tuition Management`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #4f46e5;">Welcome to Tuition Management System!</h2>
          <p>Your ${role} account has been created. Here are your login credentials:</p>
          <div style="background-color: #f5f6fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 4px;">${password}</code></p>
          </div>
          <p style="color: #666; font-size: 12px;">Please change your password after first login.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Email error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendOTP, sendPasswordReset, sendLoginCredentials };
