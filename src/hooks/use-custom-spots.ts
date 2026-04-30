import { useEffect, useState } from "react";
import type { CustomSpot } from "@/lib/spots";

const storageKey = "sunny-bars-custom-spots";
const changeEvent = "sunny-bars-custom-spots-change";

const readSpots = (): CustomSpot[] => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as CustomSpot[]) : [];
  } catch {
    return [];
  }
};

export const useCustomSpots = () => {
  const [spots, setSpots] = useState<CustomSpot[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSpots(readSpots());
    setHydrated(true);

    const sync = () => setSpots(readSpots());
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(changeEvent, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changeEvent, sync);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(spots));
    window.dispatchEvent(new Event(changeEvent));
  }, [spots, hydrated]);

  const addSpot = (spot: Omit<CustomSpot, "id" | "createdAt">) => {
    const created: CustomSpot = {
      ...spot,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `spot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    setSpots((current) => [created, ...current]);
    return created;
  };

  const removeSpot = (id: string) =>
    setSpots((current) => current.filter((spot) => spot.id !== id));

  const updateSpot = (
    id: string,
    updates: Partial<Pick<CustomSpot, "name" | "note" | "icon">>,
  ) =>
    setSpots((current) =>
      current.map((spot) => (spot.id === id ? { ...spot, ...updates } : spot)),
    );

  return { spots, addSpot, removeSpot, updateSpot };
};