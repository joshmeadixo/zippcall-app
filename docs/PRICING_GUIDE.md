# Pricing Guide for ZippCall

## Understanding Twilio Pricing

The prices fetched from Twilio API represent the **base costs** that ZippCall pays to Twilio for each minute of call time. These costs vary by:

1. **Destination Country**: Each country has different rates
2. **Destination Type**: Within a country, there can be different rates for:
   - Standard numbers
   - Mobile numbers
   - Premium numbers
   - Toll-free numbers
   - Special service numbers

3. **Call Types**:
   - **Programmable Outbound Minute**: The standard rate Twilio charges for outbound calls
   - **Regional Variations**: Some countries have regional variations (e.g., Alaska vs. mainland US)
   - **Special Categories**: Some rates apply to specific number ranges

## Current Markup Strategy

ZippCall currently implements a high-margin pricing model with the following settings:

1. **Default Markup**: 100% markup on all calls regardless of destination
2. **Minimum Markup**: 100% (ensures we never charge less than double the base cost)
3. **Minimum Price**: $0.15 per minute (ensures very cheap calls still generate adequate revenue)
4. **No Country-Specific Overrides**: All countries use the same markup strategy

This aggressive pricing strategy ensures:
- High profit margins on every call
- Protection against unpredictable variations in Twilio's pricing
- Simple, predictable revenue calculation
- Buffer against calls to more expensive number types (mobile, premium services)

## Accounting for Special Numbers

The high default markup (100%) provides substantial protection against the varying costs of different number types within each country. For example:

- If a standard landline costs $0.05/min but a mobile number costs $0.08/min, our 100% markup ensures we still make profit even when customers call mobile numbers
- The $0.15/min floor price ensures that even calls to the cheapest destinations (which might be just pennies per minute from Twilio) generate meaningful revenue

## Monitoring and Optimization

Even with this high-margin approach, it's still important to:

1. **Monitor Actual Costs**: Regularly compare your Twilio bills with your predicted costs
2. **Track Call Patterns**: Identify which countries and number types your users call most frequently
3. **Consider Competitive Pricing**: If needed, you can introduce country-specific markups later for high-volume destinations where you want to be more competitive

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