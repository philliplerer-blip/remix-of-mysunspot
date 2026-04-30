import { useEffect, useState } from "react";

const favoriteStorageKey = "sunny-bars-favorites";

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(favoriteStorageKey);
    if (stored) setFavorites(JSON.parse(stored));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const toggleFavorite = (id: number) =>
    setFavorites((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));

  return { favorites, toggleFavorite };
};