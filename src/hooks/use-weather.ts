import { useEffect, useState } from "react";

export interface WeatherHour {
  time: string; // "14"
  hour: number;
  cloudCover: number;
  sunPct: number;
  icon: string;
  temp: number;
}

export interface WeatherSummary {
  currentTemp: number;
  currentCloudCover: number;
  currentSunPct: number;
  hourly: WeatherHour[];
  loading: boolean;
  error: string | null;
}

const iconFor = (cloud: number, isDay: boolean) => {
  if (!isDay) return "🌙";
  if (cloud < 20) return "☀️";
  if (cloud < 50) return "🌤️";
  if (cloud < 80) return "⛅";
  return "🌥️";
};

export const useWeather = (lat: number, lng: number): WeatherSummary => {
  const [data, setData] = useState<WeatherSummary>({
    currentTemp: 0,
    currentCloudCover: 0,
    currentSunPct: 0,
    hourly: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,cloud_cover,is_day&hourly=temperature_2m,cloud_cover,is_day&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const now = new Date();
        const currentHour = now.getHours();

        const hourly: WeatherHour[] = (json.hourly?.time ?? []).map((t: string, i: number) => {
          const h = new Date(t).getHours();
          const cloud = json.hourly.cloud_cover[i] ?? 0;
          const isDay = (json.hourly.is_day?.[i] ?? 1) === 1;
          return {
            time: String(h).padStart(2, "0"),
            hour: h,
            cloudCover: cloud,
            sunPct: isDay ? Math.max(0, 100 - cloud) : 0,
            icon: iconFor(cloud, isDay),
            temp: Math.round(json.hourly.temperature_2m[i] ?? 0),
          };
        });

        const window = hourly.filter((h) => h.hour >= currentHour - 1 && h.hour <= currentHour + 6);

        setData({
          currentTemp: Math.round(json.current?.temperature_2m ?? 0),
          currentCloudCover: json.current?.cloud_cover ?? 0,
          currentSunPct:
            (json.current?.is_day ?? 1) === 1 ? Math.max(0, 100 - (json.current?.cloud_cover ?? 0)) : 0,
          hourly: window.length ? window : hourly.slice(0, 8),
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setData((d) => ({ ...d, loading: false, error: (e as Error).message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return data;
};