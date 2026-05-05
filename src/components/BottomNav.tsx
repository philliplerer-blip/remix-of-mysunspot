import { Compass, Heart } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  favoritesCount: number;
  alertsCount?: number;
}

const items = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/favorites", label: "Favorites", icon: Heart },
];

export const BottomNav = ({ favoritesCount }: BottomNavProps) => (
  <nav
    className="sticky bottom-0 z-20 mt-auto border-t border-butter/40 bg-espresso/85 px-2 pt-1.5 pb-safe backdrop-blur-xl xs:px-4"
    style={{ minHeight: "calc(56px + env(safe-area-inset-bottom))" }}
    aria-label="Primary"
  >
    <ul className="flex items-stretch justify-around gap-1 pb-1 xs:gap-2">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            end
            style={{ touchAction: "manipulation" }}
            className={({ isActive }) =>
              cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.65rem] font-semibold transition-colors active:scale-[0.97] xs:px-3 xs:py-2 xs:text-[0.72rem]",
                isActive ? "bg-sun-gradient text-espresso shadow-sun" : "text-secondary/80 hover:text-secondary",
              )
            }
          >
            <Icon className="size-5" />
            <span className="whitespace-nowrap">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);