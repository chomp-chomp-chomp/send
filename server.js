const express = require('express');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ─── HEALTH CHECK (unauthenticated) ───────────────────────────────────────────
app.get('/health', (req, res) => res.send('ok'));

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Email Sender"');
      return res.status(401).send('Authentication required.');
    }
    const [user, pass] = Buffer.from(header.slice(6), 'base64').toString().split(':');
    if (user !== AUTH_USER || pass !== AUTH_PASS) {
      res.set('WWW-Authenticate', 'Basic realm="Email Sender"');
      return res.status(401).send('Invalid credentials.');
    }
    next();
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([DEFAULT_TEMPLATE], null, 2));
  }
}

function readHistory() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function writeHistory(h) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));
}

function readTemplates() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8')); } catch { return [DEFAULT_TEMPLATE]; }
}

function writeTemplates(t) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(t, null, 2));
}

// ─── TEMPLATE RENDERING ───────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTemplate(html, data) {
  const {
    title = '', subtitle = '', date = '', time = '',
    location = '', rsvpLink = '', rsvpText = '',
    bodyParagraphs = [], contactName = '', contactEmail = '',
    subject = '',
  } = data;

  const locationFormatted = location
    .split('|')
    .map(s => escapeHtml(s.trim()))
    .filter(Boolean)
    .join(' &bull; ');

  const paragraphsHtml = (Array.isArray(bodyParagraphs) ? bodyParagraphs : [])
    .filter(p => p && p.trim())
    .map(p => `<p style="margin:0 0 1em;">${escapeHtml(p)}</p>`)
    .join('\n');

  return html
    .replace(/\{\{title\}\}/g, escapeHtml(title))
    .replace(/\{\{subtitle\}\}/g, escapeHtml(subtitle))
    .replace(/\{\{date\}\}/g, escapeHtml(date))
    .replace(/\{\{time\}\}/g, escapeHtml(time))
    .replace(/\{\{location\}\}/g, locationFormatted)
    .replace(/\{\{rsvpLink\}\}/g, escapeHtml(rsvpLink))
    .replace(/\{\{rsvpText\}\}/g, escapeHtml(rsvpText))
    .replace(/\{\{bodyParagraphs\}\}/g, paragraphsHtml)
    .replace(/\{\{contactName\}\}/g, escapeHtml(contactName))
    .replace(/\{\{contactEmail\}\}/g, escapeHtml(contactEmail))
    .replace(/\{\{subject\}\}/g, escapeHtml(subject));
}

// ─── DEFAULT TEMPLATE ─────────────────────────────────────────────────────────
const DEFAULT_TEMPLATE = {
  id: 'baking-experience',
  name: 'The Baking Experience',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{title}}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  body { margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .outer-td { padding: 16px 8px !important; }
    .header-pad { padding: 36px 24px 28px !important; }
    .body-pad { padding: 28px 24px !important; }
    .footer-pad { padding: 24px 20px !important; }
    .main-title { font-size: 32px !important; }
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
            <p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:400;color:#a08878;letter-spacing:0.06em;">{{subtitle}}</p>
            <h1 class="main-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:40px;font-weight:normal;color:#3d2e24;line-height:1.15;letter-spacing:-0.01em;">{{title}}</h1>
          </td>
        </tr>
        <!-- EVENT DETAILS -->
        <tr>
          <td align="center" style="padding:28px 40px 20px;background-color:#fffdf9;">
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#4a3a30;line-height:1.9;">{{date}} &nbsp;&bull;&nbsp; {{time}}<br>{{location}}</p>
          </td>
        </tr>
        <!-- RSVP LINK -->
        <tr>
          <td align="center" style="padding:8px 40px 32px;background-color:#fffdf9;">
            <a href="{{rsvpLink}}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#e8956d;text-decoration:none;letter-spacing:0.04em;">{{rsvpText}}</a>
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
          <td class="body-pad" style="padding:32px 44px 24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;color:#4a3a30;">
            {{bodyParagraphs}}
            <p style="margin:0;font-size:13px;color:#a08878;">Questions? Reach out to <a href="mailto:{{contactEmail}}" style="color:#e8956d;text-decoration:none;font-weight:600;">{{contactName}}</a>.</p>
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
</html>`,
};

// ─── TEMPLATE ROUTES ──────────────────────────────────────────────────────────
app.get('/api/templates', (req, res) => {
  const templates = readTemplates();
  res.json(templates.map(({ id, name }) => ({ id, name })));
});

app.get('/api/templates/:id', (req, res) => {
  const t = readTemplates().find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

app.post('/api/templates', (req, res) => {
  const { name, html } = req.body;
  if (!name || !html) return res.status(400).json({ error: 'name and html required' });
  const templates = readTemplates();
  const t = { id: randomUUID(), name, html };
  templates.push(t);
  writeTemplates(templates);
  res.json(t);
});

app.put('/api/templates/:id', (req, res) => {
  const templates = readTemplates();
  const i = templates.findIndex(t => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  if (req.body.name !== undefined) templates[i].name = req.body.name;
  if (req.body.html !== undefined) templates[i].html = req.body.html;
  writeTemplates(templates);
  res.json(templates[i]);
});

app.delete('/api/templates/:id', (req, res) => {
  let templates = readTemplates();
  if (templates.length === 1) return res.status(400).json({ error: 'Cannot delete the last template' });
  const before = templates.length;
  templates = templates.filter(t => t.id !== req.params.id);
  if (templates.length === before) return res.status(404).json({ error: 'Not found' });
  writeTemplates(templates);
  res.json({ ok: true });
});

// ─── PREVIEW ──────────────────────────────────────────────────────────────────
// Accepts either { templateId, emailData } or { templateHtml, emailData }
app.post('/api/preview', (req, res) => {
  const { templateId, templateHtml, emailData } = req.body;
  let html;
  if (templateHtml) {
    html = renderTemplate(templateHtml, emailData || {});
  } else {
    const templates = readTemplates();
    const t = templates.find(t => t.id === templateId) || templates[0];
    if (!t) return res.status(404).send('No template found');
    html = renderTemplate(t.html, emailData || {});
  }
  res.send(html);
});

// ─── CSV PARSING ──────────────────────────────────────────────────────────────
app.post('/api/parse-csv', upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const text = req.file.buffer.toString('utf8');
  const emails = [...new Set(text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])];
  res.json({ emails });
});

// ─── SEND ─────────────────────────────────────────────────────────────────────
app.post('/api/send', async (req, res) => {
  const { templateId, emailData, recipients, apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Resend API key required' });
  if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'No recipients' });

  const templates = readTemplates();
  const t = templates.find(t => t.id === templateId) || templates[0];
  if (!t) return res.status(404).json({ error: 'Template not found' });

  const resend = new Resend(apiKey);
  const html = renderTemplate(t.html, emailData || {});
  const subject = (emailData && (emailData.subject || emailData.title)) || '(no subject)';
  const fromAddress = (emailData && emailData.fromAddress) || 'onboarding@resend.dev';
  const fromName = emailData && emailData.fromName;
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
  const replyTo = emailData && emailData.replyTo;

  const errors = [];
  const sent = [];

  for (const to of recipients) {
    try {
      const msg = { from, to, subject, html };
      if (replyTo) msg.reply_to = replyTo;
      const result = await resend.emails.send(msg);
      if (result.error) {
        errors.push({ to, error: result.error.message });
      } else {
        sent.push(to);
      }
    } catch (err) {
      errors.push({ to, error: err.message });
    }
  }

  const history = readHistory();
  history.unshift({
    id: Date.now(),
    sentAt: new Date().toISOString(),
    subject,
    templateName: t.name,
    recipientCount: sent.length,
    recipients: sent,
    errors,
  });
  writeHistory(history.slice(0, 100));

  res.json({ sent: sent.length, errors, total: recipients.length });
});

// ─── HISTORY ─────────────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
