import { useEffect, useState } from "react";

export interface GeoLocation {
  lat: number;
  lng: number;
  source: "gps" | "default";
  loading: boolean;
  error: string | null;
}

const DEFAULT: Omit<GeoLocation, "loading" | "error"> = {
  lat: 55.6761,
  lng: 12.5683,
  source: "default",
};

export const useGeolocation = (): GeoLocation => {
  const [state, setState] = useState<GeoLocation>({ ...DEFAULT, loading: true, error: null });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ ...DEFAULT, loading: false, error: "Geolocation unavailable" });
      return;
    }
    let cancelled = false;
    const onSuccess = (pos: GeolocationPosition) => {
        if (cancelled) return;
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
          loading: false,
          error: null,
        });
    };
    const onError = (err: GeolocationPositionError) => {
        if (cancelled) return;
        setState((prev) =>
          prev.source === "gps"
            ? { ...prev, error: err.message }
            : { ...DEFAULT, loading: false, error: err.message },
        );
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 5 * 60 * 1000,
    });
    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30_000,
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
};