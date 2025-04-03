/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Enable linting during builds to ensure code quality
    ignoreDuringBuilds: false,
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains', // 1 year; consider adding '; preload' after testing
      },
      {
        key: 'Content-Security-Policy',
        // STARTING POLICY: Adjust based on your needs (Firebase, Stripe, Twilio, inline scripts/styles, etc.)
        // Check browser console for errors after applying.
        value: `
          default-src 'self';
          script-src 'self' 'unsafe-eval' 'unsafe-inline' js.stripe.com vitals.vercel-insights.com *.googleapis.com va.vercel-scripts.com apis.google.com;
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: *.stripe.com;
          font-src 'self';
          connect-src 'self' *.googleapis.com *.firebaseio.com wss://*.firebaseio.com *.stripe.com vitals.vercel-insights.com *.twilio.com wss://*.twilio.com;
          frame-src 'self' js.stripe.com *.stripe.com zippcall-2f7b9.firebaseapp.com;
          object-src 'none';
          frame-ancestors 'self';
          form-action 'self';
          base-uri 'self';
        `.replace(/\s{2,}/g, ' ').trim(), // Format the CSP string
      }
    ];

    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
