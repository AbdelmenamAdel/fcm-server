const admin = require('firebase-admin');

const DEFAULT_TOPIC = 'new_posts';
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 180;
const MAX_POST_ID_LENGTH = 200;
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const rateLimitStore = new Map();

function getAllowedOrigin(req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.origin;

  if (!allowedOrigins.length) {
    return '*';
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0];
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      throw new Error('Request body must be valid JSON.');
    }
  }

  return {};
}

function ensureFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return admin.app();
}

function isRateLimited(req) {
  const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || DEFAULT_RATE_LIMIT);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULT_RATE_LIMIT_WINDOW_MS);
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return true;
  }

  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  const apiSecretToken = process.env.API_SECRET_TOKEN;
  if (apiSecretToken) {
    const authHeader = req.headers.authorization;
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!providedToken || providedToken !== apiSecretToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
  }

  try {
    const payload = parseRequestBody(req);
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const bodyText = typeof payload.body === 'string' ? payload.body.trim() : '';
    const postId = payload.postId;
    const topic = typeof payload.topic === 'string' && payload.topic.trim() ? payload.topic.trim() : DEFAULT_TOPIC;

    if (!title || !bodyText) {
      return res.status(400).json({ success: false, error: 'Missing required fields: title and body.' });
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ success: false, error: `Title exceeds ${MAX_TITLE_LENGTH} characters.` });
    }

    if (bodyText.length > MAX_BODY_LENGTH) {
      return res.status(400).json({ success: false, error: `Body exceeds ${MAX_BODY_LENGTH} characters.` });
    }

    if (postId !== undefined && postId !== null && typeof postId !== 'string' && typeof postId !== 'number') {
      return res.status(400).json({ success: false, error: 'postId must be a string or number.' });
    }

    if (typeof postId === 'string' && postId.length > MAX_POST_ID_LENGTH) {
      return res.status(400).json({ success: false, error: `postId exceeds ${MAX_POST_ID_LENGTH} characters.` });
    }

    const firebaseApp = ensureFirebaseApp();
    const message = {
      topic,
      notification: {
        title,
        body: bodyText,
      },
      data: {
        postId: postId ? String(postId) : '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            'content-available': 1,
          },
        },
      },
    };

    const response = await firebaseApp.messaging().send(message);

    return res.status(200).json({
      success: true,
      messageId: response,
      message: `Notification sent successfully to topic: ${topic}`,
    });
  } catch (error) {
    console.error('FCM notification failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to send notification.',
      details: error.message,
    });
  }
};
