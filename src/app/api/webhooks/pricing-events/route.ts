import { NextRequest, NextResponse } from 'next/server';
import { PriceUpdateRecord } from '@/types/pricing';
import { savePriceUpdateRecord } from '@/lib/pricing/pricing-db-admin';

/**
 * POST handler for pricing webhook events
 * This endpoint receives notifications about pricing changes
 * and records them in the database for analysis
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret to ensure the request is legitimate
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    if (token !== process.env.PRICING_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook token' },
        { status: 403 }
      );
    }
    
    // Parse the request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.countryCode || typeof body.previousBasePrice !== 'number' || typeof body.newBasePrice !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Calculate percentage change
    const previousPrice = body.previousBasePrice;
    const newPrice = body.newBasePrice;
    const percentageChange = previousPrice > 0 
      ? ((newPrice - previousPrice) / previousPrice) * 100
      : 0;
    
    // Determine if the change is significant (more than 5% or from/to zero)
    const isSignificant = Math.abs(percentageChange) > 5 || 
                         previousPrice === 0 || 
                         newPrice === 0;
    
    // Create the price update record
    const priceUpdate: PriceUpdateRecord = {
      id: `${body.countryCode}-${Date.now()}`,
      timestamp: new Date(),
      countryCode: body.countryCode,
      previousBasePrice: previousPrice,
      newBasePrice: newPrice,
      percentageChange,
      isSignificant
    };
    
    // Save the update record to the database
    await savePriceUpdateRecord(priceUpdate);
    
    // Return success response
    return NextResponse.json({
      success: true,
      priceUpdate: {
        countryCode: priceUpdate.countryCode,
        percentageChange: priceUpdate.percentageChange.toFixed(2) + '%',
        isSignificant: priceUpdate.isSignificant
      }
    });
  } catch (error) {
    console.error('Error handling pricing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 