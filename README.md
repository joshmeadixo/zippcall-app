This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set up your environment variables:

1. Copy `.env.example` to `.env.local` and fill in your Firebase and Twilio credentials.

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Twilio Setup

To use the voice calling features, you'll need to set up a Twilio account and configure the following:

1. Create a Twilio account at [twilio.com](https://www.twilio.com)
2. Get your Account SID and Auth Token from the Twilio Console
3. Create an API Key and Secret in the Twilio Console under "API Keys & Tokens"
4. Create a TwiML App:
   - Go to the TwiML Apps page in the Twilio Console
   - Create a new TwiML App
   - Set the Voice Request URL to `https://your-app-domain.com/api/voice` (replace with your deployed app URL)
   - Save the TwiML App SID
5. Purchase a Twilio phone number to use as your caller ID
6. Add all these values to your `.env.local` file:

```
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_API_KEY=your-api-key
TWILIO_API_SECRET=your-api-secret
TWILIO_TWIML_APP_SID=your-twiml-app-sid
TWILIO_CALLER_ID=your-twilio-phone-number
```

## Features

- Firebase authentication
- Twilio Voice SDK integration
- Make and receive voice calls directly from the browser
- Responsive UI

## Documentation

Detailed setup and configuration guides are available in the `docs` directory:

- [Admin Access Setup](docs/ADMIN_ACCESS.md) - How to set up admin privileges
- [Firebase Setup](docs/FIREBASE_SETUP.md) - Firebase configuration and security rules
- [Twilio Configuration](docs/TWILIO_CONFIGURATION.md) - Detailed Twilio setup instructions
- [Environment Setup](docs/SETUP_ENV.md) - Environment variables configuration
- [Number Pool Management](docs/NUMBER_POOL.md) - Managing Twilio phone numbers
- [Pricing System](docs/PRICING_SYSTEM.md) - Understanding the call pricing system
- [Pricing Guide](docs/PRICING_GUIDE.md) - How to configure call pricing

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

To learn more about Twilio Voice JavaScript SDK:

- [Twilio Voice JavaScript SDK Documentation](https://www.twilio.com/docs/voice/sdks/javascript)
- [Twilio Voice Quickstart for JavaScript](https://www.twilio.com/docs/voice/quickstart/javascript)

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
