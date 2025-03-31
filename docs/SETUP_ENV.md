# Setting Up Environment Variables

For the admin dashboard to work correctly, you need to set up the following environment variables in your `.env.local` file:

```
# Admin API
ADMIN_API_SECRET=your_admin_secret_here
NEXT_PUBLIC_ADMIN_TOKEN=your_admin_secret_here

# Twilio API
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Firebase Admin (optional if you're not using Firebase Admin SDK)
FIREBASE_ADMIN_PROJECT_ID=your_firebase_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_ADMIN_PRIVATE_KEY="your_firebase_private_key"
```

## Instructions

1. Create a `.env.local` file in the root of your project
2. Add the variables above with your actual values
3. For the admin token:
   - Generate a secure random value (you can use `openssl rand -base64 32` in terminal)
   - Set both `ADMIN_API_SECRET` and `NEXT_PUBLIC_ADMIN_TOKEN` to the same value
4. For Twilio credentials:
   - Log in to your Twilio dashboard at https://www.twilio.com/console
   - Find your Account SID and Auth Token on the main dashboard page
   - Copy these values exactly as they appear (they are case-sensitive)
   - The Account SID typically starts with "AC" followed by alphanumeric characters
   - Make sure there are no extra spaces before or after the values
   - Example format:
     ```
     TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     ```
5. Restart your development server after adding these variables

## Common Issues

If you encounter a 401 Unauthorized error when trying to refresh pricing data:

1. Double-check your Twilio credentials for typos or extra spaces
2. Make sure your Twilio account is active and in good standing
3. If you're using a trial account, ensure you have confirmed your email and phone number
4. Try regenerating your Auth Token in the Twilio console if you suspect it might be invalid

## Testing the Pricing Dashboard

1. After setting up the variables, visit the admin dashboard
2. Click the "Refresh Pricing" button to fetch initial pricing data from Twilio
3. This will populate your Firestore database with the latest pricing information
4. You should now see the pricing table populated with data 