import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendOtpEmail(to: string, name: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: `"GastroNeXia" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your GastroNeXia verification code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h2 style="color:#1e3a5f;margin:0.5rem 0 0;font-size:1.4rem;">Two-Factor Authentication</h2>
        </div>
        <p style="color:#374151;font-size:0.95rem;">Hello <strong>${name}</strong>,</p>
        <p style="color:#374151;font-size:0.95rem;">Use the code below to verify your account. It expires in <strong>10 minutes</strong>.</p>
        <div style="text-align:center;margin:2rem 0;">
          <span style="display:inline-block;background:#1e3a5f;color:#fff;font-size:2.2rem;font-weight:800;letter-spacing:0.45em;padding:0.8rem 2rem;border-radius:10px;font-family:monospace;">
            ${code}
          </span>
        </div>
        <p style="color:#6b7280;font-size:0.8rem;text-align:center;">If you did not request this code, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
        <p style="color:#9ca3af;font-size:0.75rem;text-align:center;">GastroNeXia · AI-Assisted Endoscopy Platform</p>
      </div>
    `,
  });
}

export async function sendAppointmentRequestAlert(
  adminEmail: string,
  adminName: string,
  data: {
    patientName: string; patientEmail: string; patientPhone: string;
    doctorName: string; doctorSpecialty: string; doctorHospital: string;
    scheduledDate: string; timeSlot: string; reason: string;
    appointmentId: string;
  },
): Promise<void> {
  await transporter.sendMail({
    from: `"GastroNeXia" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `📅 New appointment request — ${data.patientName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:2rem;background:#f8fafc;border-radius:12px;">
        <div style="background:linear-gradient(135deg,#0d6efd,#6366f1);border-radius:10px;padding:1.2rem 1.5rem;margin-bottom:1.5rem;">
          <h2 style="color:#fff;margin:0;font-size:1.2rem;font-weight:800;">📅 New Appointment Request</h2>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:0.85rem;">Action required — please confirm or reject</p>
        </div>

        <p style="color:#374151;font-size:0.95rem;">Hello <strong>${adminName}</strong>,</p>
        <p style="color:#374151;font-size:0.95rem;">A patient has requested an appointment. Please review and respond as soon as possible.</p>

        <table style="width:100%;border-collapse:collapse;margin:1rem 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr style="background:#eff6ff;">
            <td colspan="2" style="padding:0.6rem 1rem;font-size:0.8rem;font-weight:800;color:#1d4ed8;letter-spacing:0.05em;text-transform:uppercase;">Patient</td>
          </tr>
          <tr>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;width:38%;">Name</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">${data.patientName}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Email</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">${data.patientEmail}</td>
          </tr>
          <tr>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Phone</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">${data.patientPhone || "—"}</td>
          </tr>

          <tr style="background:#f0fdf4;">
            <td colspan="2" style="padding:0.6rem 1rem;font-size:0.8rem;font-weight:800;color:#15803d;letter-spacing:0.05em;text-transform:uppercase;">Appointment Details</td>
          </tr>
          <tr>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Doctor</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">Dr. ${data.doctorName} · ${data.doctorSpecialty}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Hospital</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">${data.doctorHospital}</td>
          </tr>
          <tr>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Date</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;font-weight:600;">${data.scheduledDate} at ${data.timeSlot}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Reason</td>
            <td style="padding:0.5rem 1rem;font-size:0.85rem;color:#0f172a;">${data.reason}</td>
          </tr>
        </table>

        <p style="color:#6b7280;font-size:0.85rem;margin-top:1rem;">
          Go to the <strong>Admin Dashboard → Appointments</strong> tab to confirm or reject this request.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
        <p style="color:#9ca3af;font-size:0.75rem;text-align:center;">GastroNeXia · AI-Assisted Endoscopy Platform</p>
      </div>
    `,
  });
}

export async function sendNewPatientAlert(
  adminEmail: string,
  adminName: string,
  patient: { firstName: string; lastName: string; email: string; phone: string },
): Promise<void> {
  await transporter.sendMail({
    from: `"GastroNeXia" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: "New patient registered — GastroNeXia",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#f8fafc;border-radius:12px;">
        <div style="background:linear-gradient(135deg,#0d6efd,#00c896);border-radius:10px;padding:1.2rem 1.5rem;margin-bottom:1.5rem;">
          <h2 style="color:#fff;margin:0;font-size:1.2rem;font-weight:800;">🆕 New Patient Registration</h2>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:0.85rem;">GastroNeXia Platform</p>
        </div>
        <p style="color:#374151;font-size:0.95rem;">Hello <strong>${adminName}</strong>,</p>
        <p style="color:#374151;font-size:0.95rem;">A new patient has just created an account on the platform:</p>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr style="background:#f1f5f9;">
            <td style="padding:0.6rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;width:35%;">Full Name</td>
            <td style="padding:0.6rem 1rem;font-size:0.85rem;color:#0f172a;font-weight:600;">${patient.firstName} ${patient.lastName}</td>
          </tr>
          <tr>
            <td style="padding:0.6rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Email</td>
            <td style="padding:0.6rem 1rem;font-size:0.85rem;color:#0f172a;">${patient.email}</td>
          </tr>
          <tr style="background:#f1f5f9;">
            <td style="padding:0.6rem 1rem;font-size:0.85rem;font-weight:700;color:#374151;">Phone</td>
            <td style="padding:0.6rem 1rem;font-size:0.85rem;color:#0f172a;">${patient.phone || "—"}</td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:0.85rem;">You can view and manage this patient from the Admin Dashboard.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
        <p style="color:#9ca3af;font-size:0.75rem;text-align:center;">GastroNeXia · AI-Assisted Endoscopy Platform</p>
      </div>
    `,
  });
}
