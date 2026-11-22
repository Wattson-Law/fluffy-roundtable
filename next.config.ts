import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Next 16 默认拦截非 localhost 的 dev 资源访问；本地预览/自动化需显式放行
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // 知乎 CDN 图片一律在 <img> 上用 referrerPolicy="no-referrer"，不走 next/image 优化
  images: { unoptimized: true },
};

export default nextConfig;
