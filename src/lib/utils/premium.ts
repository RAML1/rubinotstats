/**
 * Check if a user has an active premium subscription.
 */
export function isPremium(user: {
  premiumTier: string;
  premiumUntil: Date | string | null;
}): boolean {
  if (user.premiumTier === "legacy") return true;
  if (user.premiumTier === "subscriber") {
    if (!user.premiumUntil) return false;
    return new Date(user.premiumUntil) > new Date();
  }
  return false;
}
