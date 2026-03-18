import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Assistant",
  description: "Flixhome AI Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
