/**
 * WeatherWidget — historical weather for a session date + track location
 *
 * Uses Open-Meteo archive API (free, no key required):
 * https://archive-api.open-meteo.com/v1/archive
 *
 * Shows: temp °F, humidity %, wind mph+dir, precip inches, condition icon
 * Helps correlate track conditions (grip, tire pressure, rubber) with performance.
 */
import { useEffect, useState } from 'react';
import { FF, FS, T, S } from '@/lib/chartTheme';

interface WeatherData {
  tempF: number;
  humidityPct: number;
  windMph: number;
  windDir: string;
  precipIn: number;
  conditionLabel: string;
  conditionIcon: string;
  trackTempEstF: number; // approx asphalt temp (air temp × 1.45 rule of thumb)
}

// WMO weather code → label + emoji
function decodeWMO(code: number): { label: string; icon: string } {
  if (code === 0)              return { label: 'Clear',       icon: '☀️' };
  if (code <= 2)               return { label: 'Partly Cloudy', icon: '⛅' };
  if (code <= 3)               return { label: 'Overcast',    icon: '☁️' };
  if (code <= 9)               return { label: 'Fog',         icon: '🌫️' };
  if (code <= 19)              return { label: 'Drizzle',     icon: '🌦️' };
  if (code <= 29)              return { label: 'Rain',        icon: '🌧️' };
  if (code <= 39)              return { label: 'Snow',        icon: '🌨️' };
  if (code <= 49)              return { label: 'Fog',         icon: '🌫️' };
  if (code <= 59)              return { label: 'Drizzle',     icon: '🌦️' };
  if (code <= 69)              return { label: 'Rain',        icon: '🌧️' };
  if (code <= 79)              return { label: 'Sleet',       icon: '🌨️' };
  if (code <= 82)              return { label: 'Rain Shower', icon: '🌧️' };
  if (code <= 86)              return { label: 'Snow Shower', icon: '🌨️' };
  if (code <= 99)              return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Unknown', icon: '❓' };
}

function degToCardinal(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

interface Props {
  date: string;         // YYYY-MM-DD
  lat: number;
  lon: number;
}

export function WeatherWidget({ date, lat, lon }: Props) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setData(null);

    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude',  lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date',   date);
    url.searchParams.set('hourly', [
      'temperature_2m',
      'relativehumidity_2m',
      'windspeed_10m',
      'winddirection_10m',
      'precipitation',
      'weathercode',
    ].join(','));
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('windspeed_unit', 'mph');
    url.searchParams.set('precipitation_unit', 'inch');
    url.searchParams.set('timezone', 'America/New_York');

    fetch(url.toString())
      .then(r => r.json())
      .then(json => {
        // Use hour 12 (noon) as representative of race-day conditions
        const h = json.hourly;
        const idx = 12;
        const tempF = h.temperature_2m?.[idx] ?? null;
        const humid = h.relativehumidity_2m?.[idx] ?? null;
        const wind  = h.windspeed_10m?.[idx] ?? null;
        const wDir  = h.winddirection_10m?.[idx] ?? 0;
        const precip = h.precipitation?.[idx] ?? 0;
        const wcode = h.weathercode?.[idx] ?? 0;

        if (tempF === null) { setError(true); return; }

        const { label, icon } = decodeWMO(wcode);
        setData({
          tempF,
          humidityPct: humid ?? 0,
          windMph: wind ?? 0,
          windDir: degToCardinal(wDir),
          precipIn: precip,
          conditionLabel: label,
          conditionIcon: icon,
          // Asphalt temp rule of thumb: air + (air × 0.45) on a clear day; less on cloudy
          trackTempEstF: Math.round(tempF + tempF * (wcode === 0 ? 0.45 : 0.25)),
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [date, lat, lon]);

  if (loading) return (
    <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, padding: '4px 0' }}>
      Fetching conditions…
    </div>
  );

  if (error || !data) return null; // fail silently — weather is supplementary

  const tiles = [
    { label: 'Conditions', value: `${data.conditionIcon} ${data.conditionLabel}`, color: T.fg },
    { label: 'Air Temp',   value: `${data.tempF.toFixed(0)}°F`,     color: data.tempF > 90 ? S.bad : data.tempF > 75 ? S.warn : S.good },
    { label: 'Track Est.', value: `~${data.trackTempEstF}°F`,       color: data.trackTempEstF > 120 ? S.bad : data.trackTempEstF > 100 ? S.warn : T.fg },
    { label: 'Humidity',   value: `${data.humidityPct.toFixed(0)}%`, color: T.fg },
    { label: 'Wind',       value: `${data.windMph.toFixed(0)} mph ${data.windDir}`, color: T.fg },
    ...(data.precipIn > 0 ? [{ label: 'Precip', value: `${data.precipIn.toFixed(2)}"`, color: S.bad }] : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tiles.map(t => (
          <div key={t.label} className="flex flex-col rounded px-2 py-1"
            style={{ background: '#0E0E1A', border: '1px solid #1E1E2E', minWidth: 72 }}>
            <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>
              {t.label}
            </span>
            <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 600, color: t.color, lineHeight: 1.4 }}>
              {t.value}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, marginTop: 4, letterSpacing: '0.06em' }}>
        Noon conditions · {date} · Open-Meteo archive · Track temp is an estimate
      </p>
    </div>
  );
}
