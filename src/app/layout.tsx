import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";

export const metadata: Metadata = {
  title: "番茄鐘 - 提升您的專注力和生產力",
  description: "一個優雅的番茄鐘應用，幫助您更好地管理時間和提高工作效率。支持雲端同步和數據備份。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
