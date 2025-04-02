# ZippCall Landing Page Guide

## Introduction
ZippCall is a web application that allows users to make international calls directly from their browser. The app provides a simple, user-friendly interface for making affordable international calls without the need for additional software or hardware.

## Brand Identity

### Logo and Colors
- **Logo**: The app uses a distinctive logo located at `/public/images/zippcall-logo.png`
- **Brand Colors**:
  - Primary Blue (`#1A4971`): Used for text, outlines, and primary actions
  - Light Blue (`#55AADD`): Used for UI elements and backgrounds
  - Yellow (`#FFCC33`): Used for accent elements like the lightning bolt in the logo
  - Cream (`#FFF8E1`): Used for background and neutral elements
  - Neutral (`#2A303C`): Used for text and dark UI elements
  - Base-100 (`#FFFFFF`): Used for backgrounds and cards

### Typography
- The application uses the **Geist** font family as its primary typeface
  - **Geist Sans**: Used for general text content
  - **Geist Mono**: Used for monospaced content (like code or numbers)
- CSS variables:
  - `--font-geist-sans` for sans-serif text
  - `--font-geist-mono` for monospaced text

## Technology Stack

### Frontend Framework
- **Next.js**: The application is built using Next.js framework
- **React**: Uses React for component-based UI development
- **TypeScript**: The entire codebase is written in TypeScript

### UI Libraries and Styling
- **Tailwind CSS**: Used for styling with utility classes
- **DaisyUI**: Component library built on top of Tailwind
- Custom styling for specialized components like phone input

### Authentication
- **Firebase Authentication**: Used for user authentication
- Supports:
  - Email link (passwordless) authentication
  - Google Sign-in

### Database
- **Firebase Firestore**: Used for storing user data and call history

### Voice Calling
- **Twilio Voice SDK**: Integrated for making voice calls
- Features include:
  - Direct browser-to-phone calling
  - Call history tracking
  - Call pricing information

## Core Features

### User Authentication
- Passwordless email link authentication
- Google authentication
- User profile management

### Voice Calling
- Make international calls directly from the browser
- Real-time audio visualization
- Call controls (mute, hangup, keypad)
- Call timer

### Account Management
- View call history
- Add funds to account
- Check account balance
- View call pricing by country

### Admin Dashboard
- Admin-only access for managing users and system settings
- Admin functionality is restricted to authorized users

## UI Components

### Navigation
- Simple header with logo and sign-out button
- Footer with copyright information and conditional admin link

### Call Interface
- Dial pad with numeric keys and calling functionality
- Country selector for international calls
- Audio visualizer for call status feedback
- Call controls for managing active calls

### Account Interface
- Account details card showing balance and usage
- Call history listing with details on past calls
- Add funds modal for account top-up

## Page Structure

### Main Pages
- **Home/Landing Page**: Authentication and welcome screen
- **Dashboard**: Main interface after login with calling features
- **Admin Dashboard**: For system administration (restricted access)

### Layout
- Consistent layout with header and footer
- Responsive design that works on various device sizes

## Design Language

### UI Patterns
- Card-based interface for grouping related content
- Consistent button styling with hover effects
- Form inputs with clear labels and validation
- Loading indicators for asynchronous actions

### Color Usage
- Blue tones (`#1A4971`, `#55AADD`) for primary actions and branding
- Yellow (`#FFCC33`) for accent and attention-grabbing elements
- White (`#FFFFFF`) backgrounds for content areas
- Gray tones for secondary information

### Visual Hierarchy
- Clear headings and subheadings
- Consistent spacing and alignment
- Visual feedback for interactive elements

## CSS Classes and Styling Patterns

### Common Color Classes
- `text-zippcall-blue` - Text color using the primary blue (`#1A4971`)
- `bg-zippcall-blue` - Background color using primary blue
- `text-zippcall-light-blue` - Text color using light blue (`#55AADD`)
- `bg-zippcall-light-blue` - Background color using light blue
- `bg-gradient-to-b from-zippcall-light-blue/10 to-white` - Gradient background

### Button Styling
- Primary buttons: `btn btn-primary bg-zippcall-blue hover:bg-zippcall-blue/80`
- Outline buttons: `btn btn-outline hover:bg-gray-100 hover:text-current`

### Card Styling
- `bg-white rounded-lg shadow-xl p-8 border border-zippcall-light-blue/20`

## Landing Page Recommendations

### Key Elements to Include
1. **Hero Section**:
   - Prominent display of the ZippCall logo
   - Clear value proposition: "Make international calls from your browser"
   - Call-to-action button for sign-up/sign-in

2. **Feature Highlights**:
   - Browser-based calling (no downloads needed)
   - Affordable international rates
   - Simple, easy-to-use interface
   - Secure authentication

3. **How It Works** section:
   - Step-by-step explanation of the calling process
   - Visual illustrations of the interface

4. **Pricing Information**:
   - Highlight competitive calling rates
   - Transparent pricing structure

5. **Testimonials/Social Proof** (if available)

6. **FAQ Section** addressing common questions

7. **Call-to-Action** for registration/sign-up

8. **Footer** with legal information and links

### Design Recommendations
- Maintain the established color scheme (blues, yellow accents)
- Use the Geist font family for consistency
- Incorporate the ZippCall logo prominently
- Use clean, modern layouts with ample whitespace
- Ensure responsive design for all device sizes
- Include browser screenshots of the app in action

## Technical Integration

For seamless integration with the existing application:
- Use the same color variables defined in `tailwind.config.ts`
- Follow the component structure established in the application
- Maintain consistent styling with the rest of the application
- Ensure the landing page leads naturally to the authentication screen

## Example CSS Implementation

```css
/* Primary branding colors */
.zippcall-primary {
  color: #1A4971;
}
.zippcall-secondary {
  color: #55AADD;
}
.zippcall-accent {
  color: #FFCC33;
}
.zippcall-neutral {
  color: #FFF8E1;
}

/* Typography classes that match the app */
.zippcall-heading {
  font-family: var(--font-geist-sans);
  font-weight: 700;
  color: #1A4971;
}

.zippcall-body {
  font-family: var(--font-geist-sans);
  color: #2A303C;
}

.zippcall-mono {
  font-family: var(--font-geist-mono);
}
```

## Conclusion
ZippCall is a modern, web-based application for making international calls directly from the browser. The landing page should reflect its clean, user-friendly interface while highlighting the key value propositions of affordability, ease of use, and accessibility. 