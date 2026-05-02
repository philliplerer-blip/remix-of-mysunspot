import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { supabase } from "@/integrations/supabase/client";
import { bars, stateCopy, type Bar } from "@/lib/bars";
import { spotEmoji, type CustomSpot, MAP_CENTER } from "@/lib/spots";

interface MapViewProps {
  visibleBars: Bar[];
  spots: CustomSpot[];
  selectedBarId: number;
  onSelectBar: (id: number) => void;
  onEditSpot: (spot: CustomSpot) => void;
  onLongPress: (latLng: { lat: number; lng: number }) => void;
}

let cachedKey: string | null = null;
let keyPromise: Promise<string> | null = null;

const fetchApiKey = async (): Promise<string> => {
  if (cachedKey) return cachedKey;
  if (!keyPromise) {
    keyPromise = supabase.functions.invoke("maps-config").then(({ data, error }) => {
      if (error) throw error;
      cachedKey = (data as { apiKey: string })?.apiKey ?? "";
      return cachedKey;
    });
  }
  return keyPromise;
};

const stateColor: Record<Bar["state"], string> = {
  sun: "#F5B544",
  soon: "#E97A48",
  shade: "#D9695C",
};

export const MapView = ({
  visibleBars,
  spots,
  selectedBarId,
  onSelectBar,
  onEditSpot,
  onLongPress,
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const barMarkersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const spotMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const pressTimer = useRef<number | null>(null);
  const pressMoved = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  const onSelectBarRef = useRef(onSelectBar);
  const onEditSpotRef = useRef(onEditSpot);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  onLongPressRef.current = onLongPress;
  onSelectBarRef.current = onSelectBar;
  onEditSpotRef.current = onEditSpot;

  // Init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiKey = await fetchApiKey();
        if (!apiKey) {
          setError("Google Maps API key not configured");
          return;
        }
        setOptions({ key: apiKey, v: "weekly" });
        const { Map } = await importLibrary("maps");
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: MAP_CENTER,
          zoom: 16,
          tilt: 45,
          heading: 0,
          mapTypeId: "satellite",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          rotateControl: true,
        });
        mapRef.current = map;
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load map");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Long-press detection on the map container
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready) return;
    const onDown = (event: PointerEvent) => {
      pressMoved.current = false;
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      pressTimer.current = window.setTimeout(() => {
        if (pressMoved.current || !mapRef.current) return;
        const projection = mapRef.current.getProjection();
        const bounds = mapRef.current.getBounds();
        if (!projection || !bounds) return;
        // Use pixel → latLng via overlay-less approximation: rely on bounds + size
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const lng = sw.lng() + (px / rect.width) * (ne.lng() - sw.lng());
        const lat = ne.lat() - (py / rect.height) * (ne.lat() - sw.lat());
        onLongPressRef.current({ lat, lng });
      }, 550);
    };
    const cancel = () => {
      if (pressTimer.current) {
        window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };
    const onMove = () => {
      pressMoved.current = true;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", cancel);
      el.removeEventListener("pointerleave", cancel);
      el.removeEventListener("pointermove", onMove);
    };
  }, [ready]);

  // Sync bar markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const existing = barMarkersRef.current;
    const visibleIds = new Set(visibleBars.map((b) => b.id));
    // remove
    for (const [id, marker] of existing) {
      if (!visibleIds.has(id)) {
        marker.setMap(null);
        existing.delete(id);
      }
    }
    // add/update
    for (const bar of visibleBars) {
      const isSelected = bar.id === selectedBarId;
      const color = stateColor[bar.state];
      const scale = isSelected ? 11 : 8;
      let marker = existing.get(bar.id);
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#1F1410",
        strokeWeight: 3,
        scale,
      };
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: bar.lat, lng: bar.lng },
          map,
          title: bar.name,
          icon,
        });
        marker.addListener("click", () => onSelectBarRef.current(bar.id));
        existing.set(bar.id, marker);
      } else {
        marker.setIcon(icon);
        marker.setPosition({ lat: bar.lat, lng: bar.lng });
      }
    }
  }, [visibleBars, selectedBarId, ready]);

  // Sync custom spot markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const existing = spotMarkersRef.current;
    const ids = new Set(spots.map((s) => s.id));
    for (const [id, marker] of existing) {
      if (!ids.has(id)) {
        marker.setMap(null);
        existing.delete(id);
      }
    }
    for (const spot of spots) {
      const emoji = spotEmoji(spot.icon);
      const svg = `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><circle cx='17' cy='17' r='14' fill='%23FBE7C0' stroke='%231F1410' stroke-width='2'/><text x='17' y='22' text-anchor='middle' font-size='16'>${emoji}</text></svg>`,
      )}`;
      let marker = existing.get(spot.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: spot.lat, lng: spot.lng },
          map,
          title: spot.name,
          icon: { url: svg, scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) },
        });
        marker.addListener("click", () => onEditSpotRef.current(spot));
        existing.set(spot.id, marker);
      } else {
        marker.setPosition({ lat: spot.lat, lng: spot.lng });
      }
    }
  }, [spots, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-espresso/80 p-6 text-center text-sm text-secondary">
          <div>
            <p className="font-semibold">Map unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};