/**
 * notificationService.js
 * Firebase Cloud Messaging (FCM) utility for Android push notifications.
 *
 * SETUP: Add your Firebase service account JSON path to .env:
 *   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
 *
 * Download the service account from:
 * Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

let messaging = null;

const initFirebase = () => {
  if (messaging) return messaging;

  try {
    const admin = require('firebase-admin');

    if (admin.apps.length > 0) {
      messaging = admin.messaging();
      return messaging;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountPath) {
      console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT not set in .env — push notifications disabled');
      return null;
    }

    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    messaging = admin.messaging();
    console.log('[FCM] Firebase Admin initialized successfully');
    return messaging;
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase Admin:', err.message);
    return null;
  }
};

/**
 * Send a push notification to a single FCM token.
 * @param {string} fcmToken - The device FCM token
 * @param {string} title    - Notification title
 * @param {string} body     - Notification body
 * @param {object} data     - Optional key-value data payload
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) {
    console.log('[FCM] No FCM token provided, skipping notification');
    return { success: false, reason: 'no_token' };
  }

  const msg = initFirebase();
  if (!msg) {
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'attendance_channel'
        }
      }
    };

    const response = await msg.send(message);
    console.log(`[FCM] Notification sent to ${fcmToken.slice(0, 20)}… — ${response}`);
    return { success: true, response };
  } catch (err) {
    console.error('[FCM] Send error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send push notifications to multiple FCM tokens at once.
 * @param {string[]} fcmTokens
 * @param {string}   title
 * @param {string}   body
 * @param {object}   data
 */
const sendMulticastNotification = async (fcmTokens, title, body, data = {}) => {
  const validTokens = fcmTokens.filter(Boolean);
  if (validTokens.length === 0) {
    return { success: false, reason: 'no_valid_tokens' };
  }

  const msg = initFirebase();
  if (!msg) return { success: false, reason: 'firebase_not_initialized' };

  try {
    const message = {
      tokens: validTokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'attendance_channel' }
      }
    };

    const response = await msg.sendEachForMulticast(message);
    console.log(`[FCM] Multicast: ${response.successCount} sent, ${response.failureCount} failed`);
    return { success: true, response };
  } catch (err) {
    console.error('[FCM] Multicast error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendPushNotification, sendMulticastNotification };
