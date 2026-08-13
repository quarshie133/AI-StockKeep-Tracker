import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the bundled SQLite file is actually included in the serverless
  // function output on Vercel, so src/lib/prisma.ts has a source file to
  // copy into the writable /tmp directory at runtime. See
  // Technical_Debt_Plan.pdf, TD-08.
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/dev.db"],
  },
};

export default nextConfig;
