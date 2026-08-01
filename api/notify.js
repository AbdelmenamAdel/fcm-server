const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle escaped newlines in Vercel env vars properly
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

module.exports = async (req, res) => {
  // 1. Setup CORS headers for preflight requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Validate HTTP Method
  if (req.method !== 'POST') {
    console.warn(`Invalid request method: ${req.method}`);
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // 3. Optional: Add a simple secret token check (highly recommended for production)
  // Uncomment the lines below and set API_SECRET_TOKEN in Vercel to protect your endpoint
  /*
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  */

  try {
    // 4. Extract data from request body
    const { title, body, postId } = req.body || {};

    // 5. Validate required fields
    if (!title || !body) {
      console.warn('Missing title or body in request body:', req.body);
      return res.status(400).json({ error: 'Bad Request: Missing "title" or "body".' });
    }

    console.log(`Preparing notification - Title: "${title}", Body: "${body}", PostId: "${postId}"`);

    // 6. Build the FCM message payload
    const message = {
      topic: 'new_posts',
      notification: {
        title: title,
        body: body,
      },
      data: {
        postId: postId ? String(postId) : '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      apns: {
        payload: {
          aps: {
            sound: 'post_sound.mp3', // Trigger custom iOS sound
            'content-available': 1,
          },
        },
      },
    };

    // 7. Send the notification via Firebase Admin
    const response = await admin.messaging().send(message);
    console.log('FCM message successfully sent:', response);

    // 8. Return success response
    return res.status(200).json({
      success: true,
      messageId: response,
      message: 'Notification sent successfully to topic: new_posts',
    });

  } catch (error) {
    // 9. Handle errors gracefully
    console.error('Failed to send FCM notification:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message,
    });
  }
};
