# Pricing Guide for ZippCall

## Understanding Pricing

The prices charged to ZippCall users for outbound calls are determined directly from a CSV file uploaded in the admin section.

This CSV file contains the final per-minute price for calls to each destination country.

## Pricing Mechanism

1.  **Source**: Pricing data originates from a CSV file.
2.  **Required Columns**: The CSV must contain at least the following columns:
    *   `ISO`: The 2-letter ISO country code (e.g., `US`, `GB`).
    *   `Country`: The full country name (e.g., `United States`, `United Kingdom`).
    *   `Our Price`: The final per-minute price (in USD) that will be charged to the user for calls to this country.
3.  **Import Process**: When the CSV is uploaded via the admin panel (`/admin/pricing`):
    *   The system reads the `ISO` and `Our Price` columns.
    *   The `Our Price` value for each country ISO code is stored in the system's pricing database.
    *   If the CSV contains multiple rows for the same country, the price from the *last* row encountered for that country in the file will be used.
4.  **Call Cost Calculation**: When a user makes a call:
    *   The system identifies the destination country based on the dialed number.
    *   It retrieves the stored `Our Price` for that country.
    *   The total call cost is calculated based on this price, the call duration, and a standard per-minute (60-second) billing increment (calls are rounded up to the nearest minute).

## Key Points

*   **No Markups Applied**: Unlike the previous system, there are no automatic markups, minimum prices, or complex calculations applied *after* the CSV import. The price in the `Our Price` column is the final price used for billing.
*   **USD Currency**: All prices in the `Our Price` column must be specified in US Dollars (USD).
*   **Updating Prices**: To update pricing, simply prepare a new CSV file with the desired `Our Price` values and upload it through the admin interface. This will overwrite the previously stored prices.
*   **Unsupported Countries**: Calls to countries not present in the uploaded CSV or explicitly marked as unsupported by Twilio may not be possible or will have a zero cost applied.

## Monitoring and Optimization

It is important to regularly review and update the pricing CSV to ensure:

1.  **Competitiveness**: Prices remain competitive in the market.
2.  **Profitability**: Prices cover the underlying costs from the provider (e.g., Twilio) and provide the desired profit margin.
3.  **Accuracy**: The CSV reflects the intended pricing for all supported destinations.

## Currency Considerations

All prices are automatically converted from GBP (Twilio's default currency for your account) to USD for consistent pricing across the platform. The system uses a fixed exchange rate of 1.27 to perform this conversion.

## Technical Implementation

The markup is applied in the pricing engine:

```typescript
// Markup calculation with 100% markup
// If base price is $0.05, final price will be $0.10
const markup = 100; // 100% markup
const markupAmount = basePrice * (markup / 100);
let finalPrice = basePrice + markupAmount;

// Ensure minimum final price of $0.15
finalPrice = Math.max(finalPrice, 0.15);
``` 