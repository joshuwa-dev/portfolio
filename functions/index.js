const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const emailUser = defineSecret("EMAIL_USER");
const emailPassword = defineSecret("EMAIL_PASSWORD");

exports.sendMessageNotification = onDocumentCreated(
  {
    document: "airvery/{messageId}",
    secrets: [emailUser, emailPassword],
  },
  async (event) => {
    const message = event.data.data();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser.value(),
        pass: emailPassword.value(),
      },
    });

    const mailOptions = {
      from: emailUser.value(),
      to: "cobargram@gmail.com",
      subject: `New Message from ${message.name || "User"}`,
      html: `
        <h2>New Message Received</h2>
        <p><strong>From:</strong> ${message.name || "Anonymous"}</p>
        <p><strong>Email:</strong> ${message.email || "Not provided"}</p>
        <p><strong>Message:</strong></p>
        <p>${message.message}</p>
        <p><strong>Time:</strong> ${message.timestamp && message.timestamp.toDate ? new Date(message.timestamp.toDate()).toLocaleString() : message.timestamp ? new Date(message.timestamp).toLocaleString() : "N/A"}</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully!");
      return { success: true };
    } catch (error) {
      console.error("❌ Error sending email:", error);
      throw error;
    }
  },
);

exports.sendCollabNotification = onDocumentCreated(
  {
    document: "collab/{messageId}",
    secrets: [emailUser, emailPassword],
  },
  async (event) => {
    const message = event.data.data();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser.value(),
        pass: emailPassword.value(),
      },
    });

    const mailOptions = {
      from: emailUser.value(),
      to: "cobargram@gmail.com",
      subject: `New Collaboration Request from ${message.name || "User"}`,
      html: `
        <h2>New Collaboration Request</h2>
        <p><strong>From:</strong> ${message.name || "Anonymous"}</p>
        <p><strong>Email:</strong> ${message.email || "Not provided"}</p>
        <p><strong>Message:</strong></p>
        <p>${message.message}</p>
        <p><strong>Time:</strong> ${message.timestamp && message.timestamp.toDate ? new Date(message.timestamp.toDate()).toLocaleString() : message.timestamp ? new Date(message.timestamp).toLocaleString() : "N/A"}</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("✅ Collab email sent successfully!");
      return { success: true };
    } catch (error) {
      console.error("❌ Error sending collab email:", error);
      throw error;
    }
  },
);
