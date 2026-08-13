import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockKeep — Shop Inventory Alert System',
  description: 'Smart shop inventory stock tracking and low-stock alert system built with Next.js, Prisma, and Tailwind CSS.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f4f5f6] text-[#191c1d] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
