import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { find as tzFind } from 'geo-tz';

async function geocodeCity(city: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'QuantumStrategies/1.0 (info@quantumstrategies.io)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await supabase.from('users').select('birth_data').eq('id', user.id).single();
    return NextResponse.json({ birth_data: data?.birth_data ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { date, time, city } = body as { date?: string; time?: string; city?: string };

    if (!date || !time || !city) {
      return NextResponse.json({ error: 'date, time, and city are required' }, { status: 400 });
    }

    const geo = await geocodeCity(city);
    if (!geo) {
      return NextResponse.json({ error: `Could not geocode "${city}". Try a more specific city name.` }, { status: 422 });
    }

    const tzList = tzFind(geo.lat, geo.lng);
    const timezone = tzList[0] ?? 'UTC';

    const birth_data = { date, time, city, lat: geo.lat, lng: geo.lng, timezone };

    const { error: updateErr } = await supabase
      .from('users')
      .update({ birth_data })
      .eq('id', user.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ birth_data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase.from('users').update({ birth_data: null }).eq('id', user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
