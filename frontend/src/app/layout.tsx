import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cinema Ticket Booking',
  description: 'Cinema ticket booking frontend',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
