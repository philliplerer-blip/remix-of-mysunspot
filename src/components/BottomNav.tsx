import { Compass, Heart } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  favoritesCount: number;
  alertsCount?: number;
}

const items = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/favorites", label: "Settings & Favorites", icon: Heart },
];

export const BottomNav = ({ favoritesCount }: BottomNavProps) => (
  <nav className="sticky bottom-0 z-20 mt-auto border-t border-butter/40 bg-espresso/80 px-4 pt-2 pb-safe backdrop-blur-xl" aria-label="Primary">
    <ul className="flex items-stretch justify-around gap-2 pb-2">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            end
            style={{ touchAction: "manipulation" }}
            className={({ isActive }) =>
              cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-[0.7rem] font-semibold transition-colors active:scale-[0.97]",
                isActive ? "bg-sun-gradient text-espresso shadow-sun" : "text-secondary/80 hover:text-secondary",
              )
            }
          >
            <Icon className="size-5" />
            <span>{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);