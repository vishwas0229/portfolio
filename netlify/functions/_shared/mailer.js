const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USERNAME || "").trim();
  const pass = String(process.env.SMTP_PASSWORD || "").trim();

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number.isInteger(port) ? port : 587,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465,
    auth: { user, pass },
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || "").toLowerCase() === "true"
  });

  return transporter;
}

async function sendContactNotification(message) {
  const transport = getTransporter();
  if (!transport) return { status: "skipped" };

  const to = String(process.env.CONTACT_NOTIFICATION_EMAIL || "").trim();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USERNAME || "").trim();
  if (!to || !from) return { status: "skipped" };

  const cleanSubject = String(message.subject || "New portfolio contact").replace(/[\r\n]+/g, " ").slice(0, 180);
  await transport.sendMail({
    from,
    to,
    replyTo: message.email,
    subject: cleanSubject,
    text: [
      `New portfolio message from ${message.name}`,
      `Email: ${message.email}`,
      `Subject: ${message.subject || "(none)"}`,
      `Page: ${message.page_url || "(not provided)"}`,
      "",
      message.message
    ].join("\n")
  });

  return { status: "sent" };
}

module.exports = { sendContactNotification };
