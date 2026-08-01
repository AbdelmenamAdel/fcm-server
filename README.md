# FCM Server for Azkary

This is a standalone, serverless Node.js backend designed to be deployed on [Vercel](https://vercel.com). It listens for HTTP POST requests and uses the Firebase Admin SDK to push FCM notifications to all users subscribed to the `new_posts` topic.

## 1. Installation

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

Clone or navigate to this folder in your terminal:
```bash
cd fcm-server
```

## 2. npm install

Install the required dependencies (firebase-admin):
```bash
npm install
```

## 3. Local testing

To test the Vercel server locally, you can use the Vercel CLI.

1. Install Vercel CLI globally (if you haven't already):
   ```bash
   npm i -g vercel
   ```
2. Create a `.env` file based on `.env.example` and fill in your Firebase credentials.
3. Start the local development server:
   ```bash
   vercel dev
   ```
4. The server will run at `http://localhost:3000/api/notify`.

## 4. Deploy to Vercel

1. Log into Vercel using the CLI:
   ```bash
   vercel login
   ```
2. Deploy the project:
   ```bash
   vercel
   ```
3. Follow the prompts. Say "Y" to set up and deploy, select your default scope, and link to an existing project (No) to create a new one.
4. For production deployment:
   ```bash
   vercel --prod
   ```

## 5. Environment Variables (SECURITY WARNING)

**⚠️ NEVER commit your `serviceAccountKey.json` to GitHub or include it in this project folder directly.**

Instead, go to your Firebase Console:
1. Project Settings -> Service Accounts -> Generate New Private Key.
2. Open the downloaded JSON file.
3. Go to your Vercel Dashboard -> Your Project -> Settings -> Environment Variables.
4. Add the following variables exactly as they appear in the JSON:

- `FIREBASE_PROJECT_ID`: e.g., `azkary-app-12345`
- `FIREBASE_CLIENT_EMAIL`: e.g., `firebase-adminsdk-xxxxx@azkary-app-12345.iam.gserviceaccount.com`
- `FIREBASE_PRIVATE_KEY`: Copy the **entire** private key string (including `-----BEGIN PRIVATE KEY-----` and `\n` characters). Vercel will handle the string, and our code `replace(/\\n/g, '\n')` ensures it is parsed correctly.

## 6. How Flutter should call the API

In your Flutter app (usually from an Admin screen), you can trigger the notification by making an HTTP POST request to your Vercel URL.

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> sendPostNotification(String title, String body, String postId) async {
  final url = Uri.parse('https://your-vercel-project.vercel.app/api/notify');
  
  try {
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'title': title,
        'body': body,
        'postId': postId,
      }),
    );

    if (response.statusCode == 200) {
      print('Notification sent successfully');
    } else {
      print('Error sending notification: ${response.body}');
    }
  } catch (e) {
    print('HTTP Request failed: $e');
  }
}
```

## 7. Example Request (cURL)

```bash
curl -X POST https://your-vercel-project.vercel.app/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "title": "منشور جديد",
    "body": "تم إضافة أذكار الصباح بصوت الشيخ محمد",
    "postId": "post_789"
  }'
```

## 8. Example Response

**Success (200 OK):**
```json
{
  "success": true,
  "messageId": "projects/azkary/messages/0:1234567890",
  "message": "Notification sent successfully to topic: new_posts"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Bad Request: Missing \"title\" or \"body\"."
}
```

## 9. Common Deployment Errors

- **`Firebase Admin initialization error: Error: Failed to parse private key`**
  - **Reason:** Vercel environment variables sometimes escape `\n` characters.
  - **Fix:** Ensure you copy the private key exactly. Our code already uses `.replace(/\\n/g, '\n')` to fix this.
- **`500 Internal Server Error`**
  - **Reason:** The API couldn't reach Firebase or authentication failed.
  - **Fix:** Check Vercel Logs (Functions tab) to see the exact error thrown by `admin.messaging().send()`.

## 10. Troubleshooting

- **Check Vercel Logs:** Go to Vercel Dashboard -> Project -> Logs to see runtime `console.log` and `console.error` output.
- **Test locally first:** Run `vercel dev` and test with Postman before pushing to production.
- **Protect your Endpoint:** By default, this endpoint is public. For production, uncomment the `API_SECRET_TOKEN` block in `api/notify.js` to require an Authorization header, preventing malicious users from sending fake notifications.
# fcm-server
