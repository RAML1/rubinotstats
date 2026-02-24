import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      premiumTier: string;
      premiumUntil: Date | null;
      isAdmin: boolean;
    };
  }
}
