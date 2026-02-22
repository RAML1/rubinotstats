import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card/50">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Branding */}
          <div className="space-y-3">
            <Logo size="md" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Character tracking platform for RubinOT MMORPG.
              Auction intelligence, market data &amp; progression analytics.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/current-auctions" className="hover:text-primary">
                  Current Auctions
                </Link>
              </li>
              <li>
                <Link href="/market" className="hover:text-primary">
                  Market Analysis
                </Link>
              </li>
              <li>
                <Link href="/progression" className="hover:text-primary">
                  Progression Tracker
                </Link>
              </li>
              <li>
                <Link href="/calculator" className="hover:text-primary">
                  Calculator
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">About</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              RubinOT Stats is a community fan project.
              Not affiliated with or endorsed by RubinOT.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} RubinOT Stats</p>
        </div>
      </div>
    </footer>
  );
}
