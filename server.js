const express = require('express');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');
}

function readHistory() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeHistory(history) {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function buildEmailHtml(data) {
  const {
    title,
    subtitle,
    date,
    time,
    location,
    rsvpLink,
    rsvpText,
    bodyParagraphs,
    contactName,
    contactEmail,
  } = data;

  const paragraphsHtml = (bodyParagraphs || [])
    .filter(p => p.trim())
    .map(p => `<p class="body-text" style="margin:0 0 18px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#4a3a30;">${escapeHtml(p)}</p>`)
    .join('\n');

  const locationParts = location ? escapeHtml(location).split('|').join('&nbsp;&bull;&nbsp;') : '';
  const eventLine = [
    date ? escapeHtml(date) : '',
    time ? escapeHtml(time) : '',
  ].filter(Boolean).join(' &nbsp;&bull;&nbsp; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(title)}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  body { margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .outer-td { text-align: center; }
  .email-container { margin: 0 auto; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; margin: 0 auto !important; }
    .outer-td { padding: 16px 8px !important; }
    .header-pad { padding: 36px 24px 28px !important; }
    .body-pad { padding: 28px 24px !important; }
    .footer-pad { padding: 24px 20px !important; }
    .main-title { font-size: 32px !important; }
    .eyebrow { font-size: 12px !important; }
    .tagline { font-size: 15px !important; }
    .event-detail { font-size: 15px !important; }
    .body-text { font-size: 15px !important; line-height: 1.7 !important; }
    .detail-label { font-size: 10px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f7f3ee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f3ee;">
  <tr>
    <td class="outer-td" align="center" style="padding:32px 16px;">
      <table class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin:0 auto;background-color:#fffdf9;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <!-- HEADER -->
        <tr>
          <td class="header-pad" align="center" style="background-color:#fffdf9;padding:28px 40px 32px;border-bottom:1px solid #f0e8de;">
            <img src="https://ik.imagekit.io/chompchomp/Baking%20Experience%20logo" alt="The Baking Experience" width="480" style="display:block;margin:0 auto 8px;width:480px;max-width:100%;height:auto;">
            <p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:400;color:#a08878;letter-spacing:0.06em;">${escapeHtml(subtitle)}</p>
            <h1 class="main-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:40px;font-weight:normal;color:#3d2e24;line-height:1.15;letter-spacing:-0.01em;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <!-- EVENT DETAILS -->
        <tr>
          <td align="center" style="padding:28px 40px 20px;background-color:#fffdf9;">
            <p class="event-detail" style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#4a3a30;line-height:1.9;">${eventLine}${locationParts ? '<br>' + locationParts : ''}</p>
          </td>
        </tr>
        <!-- RSVP LINK -->
        <tr>
          <td align="center" style="padding:8px 40px 32px;background-color:#fffdf9;">
            <a href="${escapeHtml(rsvpLink)}"
               style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#e8956d;text-decoration:none;letter-spacing:0.04em;">
              ${escapeHtml(rsvpText || 'Count me in →')}
            </a>
          </td>
        </tr>
        <!-- DIVIDER -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:1px;background-color:#f0e8de;font-size:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <!-- BODY COPY -->
        <tr>
          <td class="body-pad" style="padding:32px 44px 24px;">
            ${paragraphsHtml}
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#a08878;">Questions? Reach out to <a href="mailto:${escapeHtml(contactEmail)}?subject=${encodeURIComponent(title)}" style="color:#e8956d;text-decoration:none;font-weight:600;">${escapeHtml(contactName)}</a>.</p>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td class="footer-pad" align="center" style="padding:20px 40px 28px;background-color:#fdf6ef;border-top:1px solid #f0e8de;">
            <p style="margin:0 0 4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#c4a898;letter-spacing:0.08em;">Stories &bull; Recipes &bull; Culture &bull; Tradition</p>
            <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:#c4a898;">The Baking Experience, a Skadden Experience Employee Group</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="padding:0 12px 0 0;">
                  <img src="https://ik.imagekit.io/chompchomp/Skadden%20Experience.png" alt="Skadden Experience" height="48" style="display:block;height:48px;width:auto;max-width:160px;">
                </td>
                <td style="padding:0 0 0 12px;">
                  <img src="https://ik.imagekit.io/chompchomp/Employee%20Groups.png" alt="Employee Groups" height="48" style="display:block;height:48px;width:auto;max-width:160px;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Preview endpoint
app.post('/api/preview', (req, res) => {
  const html = buildEmailHtml(req.body);
  res.send(html);
});

// Parse CSV from upload
app.post('/api/parse-csv', upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const text = req.file.buffer.toString('utf8');
  const emails = parseEmailsFromText(text);
  res.json({ emails });
});

function parseEmailsFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = text.match(emailRegex) || [];
  return [...new Set(found)];
}

// Send emails
app.post('/api/send', async (req, res) => {
  const { emailData, recipients, apiKey } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'Resend API key required' });
  if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'No recipients' });
  if (!emailData) return res.status(400).json({ error: 'No email data' });

  const resend = new Resend(apiKey);
  const html = buildEmailHtml(emailData);
  const subject = emailData.subject || emailData.title;

  const errors = [];
  const sent = [];

  for (const to of recipients) {
    try {
      const result = await resend.emails.send({
        from: emailData.fromAddress || 'onboarding@resend.dev',
        to,
        subject,
        html,
      });
      if (result.error) {
        errors.push({ to, error: result.error.message });
      } else {
        sent.push(to);
      }
    } catch (err) {
      errors.push({ to, error: err.message });
    }
  }

  // Save to history
  const history = readHistory();
  history.unshift({
    id: Date.now(),
    sentAt: new Date().toISOString(),
    subject,
    recipientCount: sent.length,
    recipients: sent,
    errors,
    emailData: { ...emailData, apiKey: undefined },
  });
  // Keep last 100 entries
  writeHistory(history.slice(0, 100));

  res.json({ sent: sent.length, errors, total: recipients.length });
});

// History
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
