# Zipp Call Pricing System

This document describes the pricing system implemented for Zipp Call, a Twilio-based international calling app.

## Overview

The pricing system is designed to fetch rates from Twilio's API, apply markup rules, and calculate the final price for calls. It includes components for displaying pricing information to users and an admin dashboard for managing pricing settings.

## Key Features

- **Real-time pricing**: Display accurate call rates to users before and during calls
- **Markup management**: Configure default and country-specific markup percentages
- **Price monitoring**: Track pricing changes and receive alerts for significant changes
- **Admin dashboard**: View and manage all pricing-related settings in one place

## Components

### 1. Pricing Data Management

- **Twilio API Integration**: Fetches current pricing data from Twilio's API
- **Pricing Cache**: Stores pricing data in Firestore for quick access
- **Scheduled Updates**: Automatically refreshes pricing data at regular intervals

### 2. Pricing Engine

- **Markup Application**: Applies configured markup rules to base prices
- **Price Calculation**: Determines the final price for calls based on destination
- **Minimum Price Enforcement**: Ensures prices meet minimum profitability thresholds

### 3. User-Facing Components

- **Call Pricing Display**: Shows users the rate for their current call
- **Real-time Cost Tracking**: Updates the current cost during an active call
- **Pricing Information**: Provides clear pricing details before initiating a call

### 4. Admin Dashboard

- **Pricing Overview**: Displays all country rates in a sortable, searchable table
- **Markup Settings**: Interface for configuring markup rules
- **Price Change Alerts**: Monitors and displays significant price changes
- **Manual Refresh**: Allows admins to manually update pricing data

## API Endpoints

- `/api/twilio-pricing/voice/route.ts`: Get pricing for a specific country
- `/api/twilio-pricing/voice/countries/route.ts`: Get pricing for all countries
- `/api/admin/pricing/update/route.ts`: Trigger a pricing data update
- `/api/webhooks/pricing-events/route.ts`: Receive notifications about pricing changes

## Data Models

- **CountryPricingCache**: Stores pricing data for all countries
- **MarkupConfig**: Configures markup rules and minimum prices
- **PriceUpdateRecord**: Tracks historical price changes
- **TwilioPriceData**: Structured format for Twilio pricing information

## Implementation Notes

1. The pricing cache is updated daily through a scheduled API call to ensure data freshness
2. Significant price changes (>5%) are flagged for review
3. Markup rules include:
   - Default markup percentage (applied to all countries)
   - Country-specific markup percentages (overrides the default)
   - Minimum markup percentage (ensures minimum profit margin)
   - Minimum final price (ensures minimum per-minute rate)
4. Pricing is displayed per minute but Twilio bills in smaller increments (typically per second)

## Future Enhancements

- Implement automatic notifications for significant price changes
- Add support for SMS pricing in addition to voice
- Create historical pricing charts and trends
- Implement automated testing for pricing calculations
- Add support for additional currencies beyond USD 