import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://internal-world.justinbuilds.mov"),
  title: "Internal World",
  description:
    "We asked AI models the height of 16,200 points on Earth, from memory alone. This is the planet they carry inside.",
  openGraph: { title: "Internal World", description: "What does the Earth look like inside an AI?", type: "website" },
  twitter: { card: "summary_large_image", title: "Internal World", description: "What does the Earth look like inside an AI?" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-[#05070c] text-[#e9edf3]">{children}</body>
    </html>
  );
}
