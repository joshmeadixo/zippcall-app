# Twilio Configuration Guide

## Configuring Twilio Phone Numbers for Incoming Call Rejection

For our app to properly reject incoming calls with a message, we need to configure each Twilio phone number to use our application's webhook URL. Follow these steps:

1. Log in to your [Twilio Console](https://console.twilio.com)

2. Navigate to **Phone Numbers** > **Manage** > **Active Numbers**

3. Select the phone number you want to configure

4. Under **Voice & Fax** section:
   - For **"A CALL COMES IN"** select "Webhook" from the dropdown
   - Enter your application's voice webhook URL: `https://your-app-domain.com/api/voice`
   - Make sure HTTP POST is selected

5. Save your changes

6. Repeat for all phone numbers in your pool

## Why This Configuration Is Necessary

When a Twilio number receives an incoming call, Twilio needs to know what to do with it. By configuring the webhook, we're telling Twilio to send the call information to our application's `/api/voice` endpoint.

Our application is programmed to respond with TwiML that:
1. Plays a message saying we don't accept incoming calls
2. Hangs up the call

Without this configuration, Twilio may simply reject the call without playing our custom message, or it might use a default handling method.

## Testing Your Configuration

To test if your configuration is working correctly:
1. Call one of your Twilio numbers from a different phone
2. You should hear our custom message before the call ends
3. If the call just hangs up without a message, check your webhook configuration

## Troubleshooting

If the message isn't playing:

1. Verify your webhook URL is correct and accessible publicly
2. Check the Twilio console logs for any errors
3. Ensure your app's `/api/voice` endpoint is functioning properly
4. Test your TwiML response using Twilio's TwiML Bin feature
5. Make sure there are no network issues preventing Twilio from reaching your webhook

Remember that any changes to your code related to call handling need to be deployed to your production environment for the webhook to access them. 