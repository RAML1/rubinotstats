import { NextIntlClientProvider } from "next-intl";
import { Header } from "@/components/layout/Header";
import { requireAdmin } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import enMessages from "../../../messages/en.json";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  if (!session) redirect("/");

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
