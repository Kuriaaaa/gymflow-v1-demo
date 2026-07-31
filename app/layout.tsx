import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  return {
    title: "GymFlow V1 · Every role, one flow",
    description: "Interactive public demo of GymFlow gym operations for owners, receptionists, trainers and members.",
    metadataBase: new URL(origin),
    openGraph: {
      title: "GymFlow V1 · Every role, one flow",
      description: "Explore a complete four-role gym management workflow.",
      type: "website",
      images: ["/og.png"],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
