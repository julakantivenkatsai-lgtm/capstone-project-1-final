import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let datasetCollection = null;
let mongoConnection = null;
let datasetStoreError = process.env.MONGODB_URI
  ? 'MongoDB is connecting. Retry shortly.'
  : 'MongoDB is not configured. Set MONGODB_URI in web/.env.';

if (process.env.MONGODB_URI) {
  const mongoClient = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  });
  mongoConnection = mongoClient.connect()
    .then(() => {
      const database = mongoClient.db(process.env.MONGODB_DATABASE || 'maintiq');
      datasetCollection = database.collection('uploaded_datasets');
      datasetStoreError = null;
      console.log('[MaintIQ] MongoDB connected.');
    })
    .catch(() => {
      datasetStoreError = 'MongoDB connection failed. Check MONGODB_URI and Atlas network access.';
      console.error('[MaintIQ] MongoDB connection failed. Check MONGODB_URI and Atlas network access.');
    });
}

// Trust the first proxy (required when behind localtunnel / ngrok / Cloud Run)
app.set('trust proxy', 1);

// ── Environment variable validation ─────────────────────────────────────────
const REQUIRED_ENV = ['MAINTIQ_USERNAME', 'MAINTIQ_PASSWORD', 'MAINTIQ_SESSION_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[MaintIQ] Missing required env vars:', missing.join(', '));
  console.error('[MaintIQ] Create a .env file and restart.');
  process.exit(1);
}

// In-memory OTP store: { token -> { contact, expiresAt } }
const otpStore = new Map();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '12mb' }));

app.use(session({
  secret: process.env.MAINTIQ_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// ── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many recovery attempts, please try again later.' }
});

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (
    username === process.env.MAINTIQ_USERNAME &&
    password === process.env.MAINTIQ_PASSWORD
  ) {
    req.session.user = { username };
    req.session.save(err => {
      if (err) {
        console.error('[MaintIQ] Session save error:', err);
        return res.status(500).json({ error: 'Session could not be saved.' });
      }
      return res.json({ success: true, username });
    });
  } else {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
};

const validateDataset = body => {
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255) {
    return { error: 'A dataset filename is required (maximum 255 characters).' };
  }
  if (typeof body.hasTarget !== 'boolean' || !Array.isArray(body.records) || body.records.length === 0) {
    return { error: 'A non-empty, validated dataset is required.' };
  }
  if (body.records.length > 50000) {
    return { error: 'A dataset cannot contain more than 50,000 records.' };
  }

  const recordFields = [
    'UDI',
    'Product_ID',
    'Type',
    'Air_temperature_K',
    'Process_temperature_K',
    'Rotational_speed_rpm',
    'Torque_Nm',
    'Tool_wear_min',
    'Machine_failure'
  ];
  const records = [];
  for (const record of body.records) {
    if (
      !record ||
      !Number.isSafeInteger(record.UDI) ||
      typeof record.Product_ID !== 'string' ||
      !['L', 'M', 'H'].includes(record.Type) ||
      ![record.Air_temperature_K, record.Process_temperature_K, record.Rotational_speed_rpm, record.Torque_Nm, record.Tool_wear_min]
        .every(value => Number.isFinite(value) && value >= 0) ||
      record.Air_temperature_K === 0 ||
      record.Process_temperature_K === 0 ||
      (record.Machine_failure !== 0 && record.Machine_failure !== 1)
    ) {
      return { error: 'Dataset contains an invalid telemetry record.' };
    }

    records.push(Object.fromEntries(recordFields.map(field => [field, record[field]])));
  }

  const dataset = {
    _id: 'active',
    name: body.name.trim(),
    hasTarget: body.hasTarget,
    records,
    updatedAt: new Date()
  };
  if (Buffer.byteLength(JSON.stringify(dataset), 'utf8') > 12 * 1024 * 1024) {
    return { error: 'Dataset is too large to store. The maximum size is 12 MB.' };
  }

  return { dataset };
};

app.get('/api/dataset', requireAuth, async (_req, res) => {
  if (mongoConnection && !datasetCollection) await mongoConnection;
  if (!datasetCollection) {
    return res.status(503).json({ error: datasetStoreError });
  }
  try {
    const stored = await datasetCollection.findOne({ _id: 'active' });
    if (!stored) return res.json({ dataset: null });
    const { _id, ...dataset } = stored;
    return res.json({ dataset });
  } catch (error) {
    console.error(
      '[MaintIQ] Could not load the uploaded dataset:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return res.status(500).json({ error: 'Could not load the uploaded dataset from MongoDB.' });
  }
});

app.put('/api/dataset', requireAuth, async (req, res) => {
  const { dataset, error } = validateDataset(req.body);
  if (error) return res.status(400).json({ error });
  if (mongoConnection && !datasetCollection) await mongoConnection;
  if (!datasetCollection) {
    return res.status(503).json({ error: datasetStoreError });
  }
  try {
    await datasetCollection.replaceOne({ _id: 'active' }, dataset, { upsert: true });
    const { _id, ...savedDataset } = dataset;
    return res.json({ dataset: savedDataset });
  } catch (saveError) {
    console.error(
      '[MaintIQ] Could not save the uploaded dataset:',
      saveError instanceof Error ? saveError.name : 'Unknown error'
    );
    return res.status(500).json({ error: 'Could not save the uploaded dataset to MongoDB.' });
  }
});

// ── Account Recovery routes ──────────────────────────────────────────────────

/**
 * Step 1 – Request recovery
 * Body: { contact: "email or phone" }
 * Checks if the contact matches MAINTIQ_RECOVERY_EMAIL or MAINTIQ_RECOVERY_PHONE.
 * Returns a one-time token (displayed in the response for demo; in production you'd email/SMS it).
 */
app.post('/api/recover/request', recoveryLimiter, (req, res) => {
  const { contact } = req.body || {};
  if (!contact) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  const normalised = contact.trim().toLowerCase();
  const recoveryEmail = (process.env.MAINTIQ_RECOVERY_EMAIL || '').toLowerCase();
  const recoveryPhone = (process.env.MAINTIQ_RECOVERY_PHONE || '').replace(/\s+/g, '');

  const matched =
    normalised === recoveryEmail ||
    normalised.replace(/\s+/g, '') === recoveryPhone;

  if (!matched) {
    // Always respond OK to prevent contact enumeration
    return res.json({
      success: true,
      message: 'If this contact is registered, a recovery code has been sent.'
    });
  }

  // Generate a 6-digit OTP + a secure token
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const token = crypto.randomBytes(24).toString('hex');
  otpStore.set(token, {
    otp,
    contact: normalised,
    expiresAt: Date.now() + 10 * 60 * 1000  // 10 minutes
  });

  // In a real app you'd send otp via email/SMS; here we return it in the response
  console.log(`[MaintIQ] Recovery OTP for ${normalised}: ${otp}`);

  return res.json({
    success: true,
    token,                // frontend stores this to use in Step 2
    otp,                  // ⚠️  demo only – remove in production; send via email/SMS instead
    message: `Recovery code: ${otp}  (valid for 10 minutes)`
  });
});

/**
 * Step 2 – Verify OTP and return credentials
 * Body: { token, otp }
 */
app.post('/api/recover/verify', recoveryLimiter, (req, res) => {
  const { token, otp } = req.body || {};
  if (!token || !otp) {
    return res.status(400).json({ error: 'Token and OTP are required.' });
  }

  const record = otpStore.get(token);
  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired recovery session.' });
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(token);
    return res.status(400).json({ error: 'Recovery code has expired. Please request a new one.' });
  }
  if (otp.trim() !== record.otp) {
    return res.status(400).json({ error: 'Incorrect recovery code.' });
  }

  otpStore.delete(token);  // one-time use

  return res.json({
    success: true,
    username: process.env.MAINTIQ_USERNAME,
    password: process.env.MAINTIQ_PASSWORD
  });
});

// ── Serve built React frontend ───────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`[MaintIQ] Server running → http://localhost:${PORT}`);
  console.log(`[MaintIQ] Login: username="${process.env.MAINTIQ_USERNAME}"`);
});
