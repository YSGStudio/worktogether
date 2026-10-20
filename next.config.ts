import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 로그인 세션을 매 요청 읽는 앱이라 Cache Components는 쓰지 않는다.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // proxy를 거치는 요청 본문 버퍼 한도(기본 10MB)도 첨부 크기에 맞춘다
    proxyClientMaxBodySize: "11mb",
    serverActions: {
      // 첨부 파일 10MB + multipart 여유분
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
