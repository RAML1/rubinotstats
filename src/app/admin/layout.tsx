import { NextIntlClientProvider } from "next-intl";
import { Header } from "@/components/layout/Header";
import enMessages from "../../../messages/en.json";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
