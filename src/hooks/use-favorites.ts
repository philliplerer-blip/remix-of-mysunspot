import { useEffect, useState } from "react";

const favoriteStorageKey = "sunny-bars-favorites";
const favoritesChangeEvent = "sunny-bars-favorites-change";

const readFavorites = (): number[] => {
  try {
    const stored = window.localStorage.getItem(favoriteStorageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setHydrated(true);

    const sync = () => setFavorites(readFavorites());

    const onStorage = (event: StorageEvent) => {
      if (event.key === favoriteStorageKey) sync();
    };
    const onLocalChange = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener(favoritesChangeEvent, onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(favoritesChangeEvent, onLocalChange);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites));
    window.dispatchEvent(new Event(favoritesChangeEvent));
  }, [favorites, hydrated]);

  const toggleFavorite = (id: number) =>
    setFavorites((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));

  return { favorites, toggleFavorite };
};