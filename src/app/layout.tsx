import type { Metadata } from "next";
import localFont from 'next/font/local';
import "./globals.css";

const geistSans = localFont({
  src: [
    {
      path: '../../node_modules/geist/font/fonts/geist-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/geist/font/fonts/geist-medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/geist/font/fonts/geist-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-geist'
});

const geistMono = localFont({
  src: [
    {
      path: '../../node_modules/geist/font/fonts/geist-mono-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/geist/font/fonts/geist-mono-medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/geist/font/fonts/geist-mono-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-geist-mono'
});

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased font-[var(--font-geist)]">
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
