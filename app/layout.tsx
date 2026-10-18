import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reporting SaaS | Audit & Compliance Management",
  description: "Universal Digital Hygiene, Safety & Compliance Reporting System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined' && window.performance && typeof window.performance.measure === 'function') {
                  var _orig = window.performance.measure.bind(window.performance);
                  window.performance.measure = function(name, startOrOpts, endMark) {
                    try {
                      return _orig(name, startOrOpts, endMark);
                    } catch (e) {
                      // Prevent Next.js Turbopack dev-timing clock skew from throwing negative time stamp TypeErrors
                      return undefined;
                    }
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

