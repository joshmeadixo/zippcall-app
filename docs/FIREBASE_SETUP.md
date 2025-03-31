# Firebase Setup Guide for ZippCall

This guide will help you properly set up Firebase for your ZippCall application, including setting the correct Firestore security rules and creating a service account for server-side operations.

## 1. Firestore Security Rules

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `zippcall-2f7b9`
3. Navigate to Firestore Database
4. Click on the "Rules" tab
5. Replace the existing rules with the content from `docs/firebase-rules.txt` in this repository
6. Click "Publish"

These rules allow:
- Anyone to read pricing data (since this needs to be publicly accessible)
- Only admin users to write to pricing data
- Authenticated users to read/write their own data

## 2. Create a Firebase Admin Service Account

For server-side operations, you need a service account with admin privileges:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `zippcall-2f7b9`
3. Click on the gear icon (⚙️) near the top left, then "Project settings"
4. Click on the "Service accounts" tab
5. Click "Generate new private key"
6. Save the JSON file securely (never commit this to your repository)

## 3. Update Environment Variables

Add the following to your `.env.local` file:

```
# Firebase Admin SDK credentials
FIREBASE_ADMIN_PROJECT_ID=zippcall-2f7b9
FIREBASE_ADMIN_CLIENT_EMAIL=[email from the service account JSON]
FIREBASE_ADMIN_PRIVATE_KEY=[private_key from the service account JSON]
```

Notes for the `FIREBASE_ADMIN_PRIVATE_KEY`:
- The private key in the JSON file contains newlines represented as "\n"
- When copying to your .env file, you need to preserve these
- Wrap the key in double quotes
- Example: `FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...truncated...==\n-----END PRIVATE KEY-----\n"`

## 4. Set up an Admin User

To make yourself an admin user:

1. Go to the Firebase Console > Authentication
2. Find your user
3. Copy your user ID
4. Go to Firestore Database
5. Create a document in the "users" collection with your user ID
6. Add a field `isAdmin` set to `true`

## 5. Testing Permissions

After updating the security rules and setting up your admin user:

1. Restart your Next.js dev server
2. Log in to the application
3. Try to refresh pricing data from the admin dashboard
4. If you've configured everything correctly, you should be able to update and save pricing data

## Troubleshooting

If you encounter permissions errors:

1. Check that your Firebase security rules have been published
2. Verify your admin user has the `isAdmin: true` property in Firestore
3. Make sure you're logged in to the application
4. Check that your service account has the necessary permissions (generally, service accounts have full admin access by default)
5. Ensure the Firebase Admin SDK environment variables are correctly set

For server-side operations, the application first tries to use the Firebase Admin SDK. If that fails, it falls back to the client SDK, which is subject to the security rules you've configured. 