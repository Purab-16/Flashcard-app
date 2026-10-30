import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // pdf-parse needs the native canvas package (it supplies DOMMatrix). Keep all three out of the bundle.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  // The canvas binary and the pdf worker are found at run time, so the host's file tracing cannot see them.
  // List them for the one route that reads PDFs. On Vercel only the Linux binary exists, so only that one is added.
  // The route key uses * and not [id]: in these keys square brackets are a pattern, not a literal.
  outputFileTracingIncludes: {
    "/api/documents/*/process": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/pdf-parse/dist/**/*",
      "./node_modules/pdfjs-dist/legacy/build/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
