import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Branding */}
          <div>
            <h3 className="mb-2 text-lg font-semibold">RubinOT Stats</h3>
            <p className="text-sm text-muted-foreground">
              Character tracking platform for RubinOT MMORPG
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Disclaimer</h4>
            <p className="text-sm text-muted-foreground">
              Not affiliated with RubinOT
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} RubinOT Stats. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
