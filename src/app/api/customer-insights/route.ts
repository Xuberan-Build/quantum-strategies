import { NextRequest, NextResponse } from 'next/server';
import { storeCustomerInsights, CustomerInsightData } from '@/lib/google-sheets/customer-sync';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * API endpoint to receive and store customer insights from GPT product experiences
 *
 * POST /api/customer-insights
 *
 * Body: CustomerInsightData
 *
 * This endpoint is called when:
 * 1. User completes the GPT product experience
 * 2. We extract insights from their chat transcript/responses
 * 3. We submit the structured data here for storage
 */
export async function POST(request: NextRequest) {
  console.log('📊 Customer insights submission received');

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.email && body.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate required fields
    if (!body.email || !body.product) {
      return NextResponse.json(
        { error: 'Missing required fields: email, product' },
        { status: 400 }
      );
    }

    const insightData: CustomerInsightData = {
      email: body.email,
      product: body.product,
      completionDate: body.completionDate,
      completionStatus: body.completionStatus || 'completed',

      // Astrological
      sunSign: body.sunSign,
      moonSign: body.moonSign,
      risingSign: body.risingSign,

      // Human Design
      hdType: body.hdType,
      hdStrategy: body.hdStrategy,
      hdAuthority: body.hdAuthority,
      hdProfile: body.hdProfile,

      // Business
      businessModel: body.businessModel,
      currentOffers: body.currentOffers,
      currentPricing: body.currentPricing,
      idealClient: body.idealClient,
      revenueGoal: body.revenueGoal,
      painPoints: body.painPoints,

      // AI Insights
      whatToSell: body.whatToSell,
      howToSell: body.howToSell,
      pricingModel: body.pricingModel,
      keyStrengths: body.keyStrengths,
      nextSteps: body.nextSteps,

      // Segmentation
      segmentTags: body.segmentTags,
      notes: body.notes,
    };

    console.log(`📝 Storing insights for: ${insightData.email}`);
    console.log(`   Product: ${insightData.product}`);
    console.log(`   HD Type: ${insightData.hdType || 'N/A'}`);
    console.log(`   Sun Sign: ${insightData.sunSign || 'N/A'}`);
    console.log(`   Moon Sign: ${insightData.moonSign || 'N/A'}`);

    // Store insights in Google Sheets
    await storeCustomerInsights(insightData);

    console.log('✅ Customer insights stored successfully');

    return NextResponse.json({
      success: true,
      message: 'Insights stored successfully',
      email: insightData.email,
      segmentTags: insightData.segmentTags,
    });
  } catch (error: any) {
    console.error('❌ Failed to store customer insights:', error);
    return NextResponse.json(
      {
        error: 'Failed to store insights',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Disable static generation
export const dynamic = 'force-dynamic';
