import type { Metadata } from "next";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import Nav from "@/components/Nav";
import UserBox from "@/components/UserBox";
import { authDisabled } from "@/lib/gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leads CRM",
  description: "Holy Insights Leads CRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <div className="app-shell">
            <header className="topbar">
              <span className="brand">Leads CRM</span>
              <Nav />
              <UserBox authDisabled={authDisabled} />
            </header>
            <main className="content">{children}</main>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
