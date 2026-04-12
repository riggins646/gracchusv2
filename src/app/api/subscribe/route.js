import { google } from "googleapis";
import { NextResponse } from "next/server";

/* ───────────────────────────────────────────────
   POST /api/subscribe
   Appends an email + timestamp to a Google Sheet.

   Required env vars (set in Vercel):
     GOOGLE_SERVICE_ACCOUNT_EMAIL   – service-account e-mail
     GOOGLE_PRIVATE_KEY             – PEM private key (with \n)
     GOOGLE_SHEET_ID                – spreadsheet ID from the URL
   ─────────────────────────────────────────────── */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    SCOPES
  );
}

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Check for duplicate
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A:A",
    });

    const emails = (existing.data.values || []).flat().map((e) => e.toLowerCase());
    if (emails.includes(email.toLowerCase())) {
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    // Append new row: [email, ISO timestamp]
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:B",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[email, new Date().toISOString()]],
      },
    });

    return NextResponse.json({ ok: true, message: "Subscribed" });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Could not subscribe. Please try again." },
      { status: 500 }
    );
  }
}
