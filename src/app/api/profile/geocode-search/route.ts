import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface GeocodeSuggestion {
  displayName: string
  lat: number
  lng: number
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuantumStrategies/1.0 (santos.93.aus@gmail.com)' },
    signal: AbortSignal.timeout(4000),
  })

  if (!res.ok) return NextResponse.json({ results: [] })

  const raw = await res.json() as Array<{ display_name: string; lat: string; lon: string }>
  const results: GeocodeSuggestion[] = raw.map(r => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }))

  return NextResponse.json({ results })
}
