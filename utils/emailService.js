const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendLoginCredentials = async (email, username, password, role = "student") => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your ${role.charAt(0).toUpperCase() + role.slice(1)} Account Created - Tuition Management`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #4f46e5;">Welcome to Tuition Management System!</h2>

          <p>Your ${role} account has been created. Here are your login credentials:</p>

          <div style="background-color: #f5f6fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Username:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 4px;">${username}</code></p>
            <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 4px;">${password}</code></p>
            <p style="margin: 10px 0;"><strong>Role:</strong> ${role}</p>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Visit the login page</li>
            <li>Enter your username and password</li>
            <li>Complete 2FA setup with Google Authenticator</li>
            <li>Start using the system</li>
          </ol>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            For security reasons, please change your password after your first login.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">
            If you did not request this account, please contact your administrator.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Credentials sent to email" };
  } catch (err) {
    console.error("Email sending error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendLoginCredentials };
