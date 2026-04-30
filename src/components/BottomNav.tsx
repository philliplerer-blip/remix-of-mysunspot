import { Compass, Heart } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  favoritesCount: number;
}

const items = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/favorites", label: "Favorites", icon: Heart },
];

export const BottomNav = ({ favoritesCount }: BottomNavProps) => (
  <nav className="sticky bottom-0 z-20 mt-auto border-t border-butter/40 bg-espresso/95 px-4 py-2 backdrop-blur" aria-label="Primary">
    <ul className="flex items-stretch justify-around gap-2">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            end
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[0.7rem] font-semibold transition-colors",
                isActive ? "bg-sun-gradient text-espresso shadow-sun" : "text-secondary/80 hover:text-secondary",
              )
            }
          >
            <Icon className="size-5" />
            <span>{label}</span>
            {label === "Favorites" && favoritesCount > 0 && (
              <span className="absolute right-3 top-1 grid size-4 place-items-center rounded-full bg-flame text-[0.6rem] font-bold text-primary-foreground">
                {favoritesCount}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);