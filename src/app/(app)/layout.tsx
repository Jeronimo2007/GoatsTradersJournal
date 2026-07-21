import { Sidebar } from "@/components/Sidebar";
import { AccountsProvider } from "@/components/AccountsProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AccountsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 md:pl-60">
          <div className="mx-auto max-w-6xl px-4 pt-20 pb-6 md:px-8 md:pt-8 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </AccountsProvider>
  );
}
