import { NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import { openai } from '@/lib/openai/client';
import { chartAnalysisModel } from '@/lib/ai/models';
// @ts-ignore
import pdfParse from 'pdf-parse';

export async function POST(req: Request) {
  console.log('=== PROFILE EXTRACTION API CALLED ===');
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { storagePaths = [] } = body || {};

    console.log('Storage paths received:', storagePaths);

    if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
      console.error('No files provided for extraction');
      return NextResponse.json({ error: 'No files provided for extraction' }, { status: 400 });
    }

    // Separate astro vs HD inputs, sign URLs for images, extract text from PDFs
    const astroImages: string[] = [];
    const hdImages: string[] = [];
    const astroPdfTexts: string[] = [];
    const hdPdfTexts: string[] = [];

    const isAstro = (path: string) => {
      const lower = path.toLowerCase();
      return lower.includes('astro') ||
             lower.includes('birth') ||
             lower.includes('chart') ||
             lower.includes('natal');
    };

    const isHD = (path: string) => {
      const lower = path.toLowerCase();
      return lower.includes('humandesign') ||
             lower.includes('human-design') ||
             lower.includes('myhumandesign') ||
             lower.includes('human_design') ||
             lower.includes('bodygraph');
    };

    console.log('Processing files from user-uploads bucket...');

    for (const path of storagePaths.slice(0, 6)) {
      const lower = path.toLowerCase();
      const isPdf = lower.endsWith('.pdf');

      console.log(`Processing file: ${path}, isPdf: ${isPdf}`);

      if (isPdf) {
        console.log(`Downloading PDF: ${path}`);
        const { data, error } = await supabaseAdmin.storage.from('user-uploads').download(path);
        if (error || !data) {
          console.error('PDF download error:', error);
          throw new Error(`Could not download PDF: ${path}`);
        }
        console.log(`PDF downloaded successfully, parsing...`);
        const buffer = Buffer.from(await data.arrayBuffer());
        const parsed = await pdfParse(buffer);
        if (parsed?.text) {
          console.log(`PDF text extracted: ${parsed.text.length} characters`);
          const textSlice = parsed.text.slice(0, 8000);
          if (isHD(path)) {
            console.log('  - Categorized PDF text as Human Design');
            hdPdfTexts.push(textSlice);
          } else {
            console.log('  - Categorized PDF text as Astrology (default)');
            astroPdfTexts.push(textSlice);
          }
        }
      } else {
        console.log(`Creating signed URL for image: ${path}`);
        const { data, error } = await supabaseAdmin.storage
          .from('user-uploads')
          .createSignedUrl(path, 60 * 10); // 10 minutes
        if (error || !data?.signedUrl) {
          console.error('File signing error:', error);
          throw new Error(`Could not sign file: ${path}`);
        }
        console.log(`Signed URL created: ${data.signedUrl.substring(0, 50)}...`);

        const matchesHD = isHD(path);
        const matchesAstro = isAstro(path);

        if (matchesHD) {
          console.log('  - Categorized as Human Design');
          hdImages.push(data.signedUrl);
        } else if (matchesAstro) {
          console.log('  - Categorized as Astrology');
          astroImages.push(data.signedUrl);
        } else {
          console.log('  - Filename unclear - will attempt both Astrology AND Human Design extraction');
          astroImages.push(data.signedUrl);
          hdImages.push(data.signedUrl);
        }
      }
    }

    console.log(`File processing complete. Astro images: ${astroImages.length}, HD images: ${hdImages.length}, Astro PDF texts: ${astroPdfTexts.length}, HD PDF texts: ${hdPdfTexts.length}`);

    const astroPrompt = `
You are an expert astrologer. You will receive birth chart data either as images (signed URLs) or as extracted PDF text. Extract ONLY visible placements from the chart wheel, planet/house tables, or text data. Ignore narrative descriptions. If unclear, set "UNKNOWN". Never guess.

Return JSON ONLY, in this exact shape:
{
  "astrology": {
    "sun": "",
    "moon": "",
    "rising": "",
    "mercury": "",
    "venus": "",
    "mars": "",
    "jupiter": "",
    "saturn": "",
    "uranus": "",
    "neptune": "",
    "pluto": "",
    "houses": ""
  }
}

Rules:
- For planets, include sign and house if visible (e.g., "Sun: Taurus 12th house" or "UNKNOWN").
- For rising, include sign (and house if shown).
- For houses: summarize any visible house info. If money houses are visible, list them explicitly (2nd/8th/11th/10th).
- Do NOT invent data. Use "UNKNOWN" for anything not clearly visible.
`;

    const hdPrompt = `
You are an expert Human Design analyst. You will receive Human Design chart data either as images or as extracted PDF text.

IMPORTANT: Human Design centers CANNOT be reliably read from a bodygraph image alone — the color fill is ambiguous at low resolution. Prioritize any TEXT summary in the PDF (e.g. "Defined Centers: Sacral, Throat") over the image. If only an image is provided and centers are unclear, set them to "UNKNOWN".

Extract ONLY what is clearly visible or explicitly stated. Never guess. Return JSON only:
{
  "human_design": {
    "type": "",
    "strategy": "",
    "authority": "",
    "profile": "",
    "centers": {
      "head": "",
      "ajna": "",
      "throat": "",
      "g_identity": "",
      "heart_ego": "",
      "solar_plexus": "",
      "sacral": "",
      "spleen": "",
      "root": ""
    },
    "channels": "",
    "incarnation_cross": ""
  }
}

For each center, set "defined", "undefined", or "UNKNOWN".
For channels: list any visible channel numbers/names as a comma-separated string, or "UNKNOWN".
For incarnation_cross: include the full name if visible in text, or "UNKNOWN".
`;

    const callExtraction = async (type: string, promptText: string, images: string[], pdfText: string | null) => {
      console.log(`\n=== Calling ${type} extraction ===`);
      console.log(`Model: ${chartAnalysisModel}`);
      console.log(`Images: ${images.length}`);
      console.log(`PDF text: ${pdfText ? 'Yes' : 'No'}`);

      const content: any[] = [{ type: 'text', text: promptText }];
      if (pdfText) {
        content.push({ type: 'text', text: `PDF extracted text:\n${pdfText.slice(0, 8000)}` });
      }
      if (images.length) {
        content.push(...images.map((url) => ({ type: 'image_url', image_url: { url } })));
      }

      console.log(`Calling OpenAI with ${content.length} content items...`);

      try {
        const completion = await openai.chat.completions.create({
          model: chartAnalysisModel,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_completion_tokens: 1500,
          response_format: { type: 'json_object' },
        });

        console.log(`OpenAI response received for ${type}`);
        console.log(`Response content: ${completion.choices[0].message.content?.substring(0, 200)}...`);

        const parsed = JSON.parse(completion.choices[0].message.content || '{}');
        console.log(`Parsed ${type} result:`, JSON.stringify(parsed, null, 2));
        return parsed;
      } catch (error: any) {
        console.error(`OpenAI API error for ${type}:`, error);
        console.error(`Error details:`, {
          message: error.message,
          status: error.status,
          code: error.code,
          type: error.type
        });
        throw error;
      }
    };

    // Astro extraction with astrology PDF text
    console.log('\n--- Starting Astrology extraction ---');
    const astroResult = await callExtraction('Astrology', astroPrompt, astroImages.slice(0, 3), astroPdfTexts.join('\n\n---\n\n') || null);

    // HD extraction with HD PDF text
    console.log('\n--- Starting Human Design extraction ---');
    const hdResult = await callExtraction('Human Design', hdPrompt, hdImages.slice(0, 3), hdPdfTexts.join('\n\n---\n\n') || null);

    const merged = {
      astrology: astroResult?.astrology || {
        sun: 'UNKNOWN',
        moon: 'UNKNOWN',
        rising: 'UNKNOWN',
        mercury: 'UNKNOWN',
        venus: 'UNKNOWN',
        mars: 'UNKNOWN',
        jupiter: 'UNKNOWN',
        saturn: 'UNKNOWN',
        uranus: 'UNKNOWN',
        neptune: 'UNKNOWN',
        pluto: 'UNKNOWN',
        houses: 'UNKNOWN',
      },
      human_design: hdResult?.human_design || {
        type: 'UNKNOWN',
        strategy: 'UNKNOWN',
        authority: 'UNKNOWN',
        profile: 'UNKNOWN',
        centers: {
          head: 'UNKNOWN',
          ajna: 'UNKNOWN',
          throat: 'UNKNOWN',
          g_identity: 'UNKNOWN',
          heart_ego: 'UNKNOWN',
          solar_plexus: 'UNKNOWN',
          sacral: 'UNKNOWN',
          spleen: 'UNKNOWN',
          root: 'UNKNOWN',
        },
        channels: 'UNKNOWN',
        incarnation_cross: 'UNKNOWN',
      },
    };

    console.log('\n=== Final merged result ===');
    console.log(JSON.stringify(merged, null, 2));
    console.log('=== PROFILE EXTRACTION COMPLETE ===\n');

    // Return placements without saving (user will review first)
    return NextResponse.json({ placements: merged });
  } catch (err: any) {
    console.error('\n=== PROFILE EXTRACTION API ERROR ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    console.error('=== END ERROR LOG ===\n');

    return NextResponse.json({
      error: err?.message || 'Extraction failed',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}
