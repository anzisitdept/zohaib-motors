import { NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Fetch active installment plans
    const q = query(collection(db, "installmentPlans"), where("status", "==", "active"));
    const snapshot = await getDocs(q);
    const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const today = new Date().toISOString().split("T")[0];
    const emailsToSend = [];

    // 2. Identify due installments
    for (const plan of plans) {
      // Find the first unpaid installment
      const nextInstallment = plan.installmentSchedule?.find((inst: any) => !inst.paid);
      
      if (nextInstallment && nextInstallment.dueDate === today) {
        emailsToSend.push({
          planId: plan.id,
          vehicleName: plan.vehicleName,
          clientName: plan.clientName,
          amount: nextInstallment.amount,
          clientEmail: plan.clientEmail,
          ownerEmail: plan.ownerEmail
        });
      }
    }

    if (emailsToSend.length === 0) {
      return NextResponse.json({ success: true, message: "No installments due today." });
    }

    // 3. Configure Nodemailer (Requires SMTP_USER and SMTP_PASS in .env.local)
    const port = Number(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    let sentCount = 0;

    // 4. Send Emails
    for (const data of emailsToSend) {
      // Send to Client
      if (data.clientEmail) {
        const clientHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Installment Payment Reminder</h2>
            <p>Dear ${data.clientName},</p>
            <p>This is a polite reminder that your monthly installment for the <strong>${data.vehicleName}</strong> is due today.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; font-size: 16px;"><strong>Amount Due:</strong> Rs. ${data.amount.toLocaleString()}</p>
            </div>
            <p>Please arrange for the payment at your earliest convenience to avoid any late fees.</p>
            <p>Thank you,<br/>Zohaib Motors</p>
          </div>
        `;
        
        await transporter.sendMail({
          from: `"Zohaib Motors" <${process.env.SMTP_USER}>`,
          to: data.clientEmail,
          subject: `Payment Reminder: ${data.vehicleName} Installment`,
          html: clientHtml
        });
      }

      // Send to Owner/Admin
      if (data.ownerEmail) {
        const ownerHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #b4232f;">Payment Recovery Alert</h2>
            <p>Hello Admin,</p>
            <p>An installment payment is due today and needs to be recovered.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Client:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.clientName}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vehicle:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.vehicleName}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount to Recover:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">Rs. ${data.amount.toLocaleString()}</td></tr>
            </table>
            <p style="margin-top: 20px;">Please follow up with the client.</p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Zohaib Motors System" <${process.env.SMTP_USER}>`,
          to: data.ownerEmail,
          subject: `Recovery Action Required: ${data.clientName}`,
          html: ownerHtml
        });
      }
      
      sentCount++;
    }

    return NextResponse.json({ success: true, message: `Reminders processed. Processed ${sentCount} plans.` });
  } catch (error: any) {
    console.error("Cron email error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
