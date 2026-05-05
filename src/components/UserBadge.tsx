// Single shared formatter for "user appears in UI". Renders status emoji
// (validated against the allowlist client-side) next to display_name / @handle.
// Per spec section 5: do not let any callsite skip the formatting.
import { isAllowedStatusEmoji } from "@/lib/profile-emoji";

interface UserBadgeProps {
  handle?: string | null;
  displayName?: string | null;
  statusEmoji?: string | null;
  className?: string;
}

export function UserBadge({ handle, displayName, statusEmoji, className }: UserBadgeProps) {
  const label = displayName?.trim() || (handle ? `@${handle}` : "user");
  const emoji = isAllowedStatusEmoji(statusEmoji) ? statusEmoji : null;
  return (
    <span className={className}>
      {emoji && <span aria-hidden className="mr-1">{emoji}</span>}
      <span>{label}</span>
      {handle && displayName && <span className="ml-1 text-secondary/50 text-xs">@{handle}</span>}
    </span>
  );
}