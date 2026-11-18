import type { Config } from "tailwindcss";

/**
 * 双氛围色板（文档 §6.1）
 *  - zh*  ：底层「模拟知乎」—— 干净熟悉的社区信息流质感
 *  - cabin/ember/paper：陪伴层「毛茸茸小屋」—— 手绘绘本篝火夜色
 * 小屋色值参照 public/assets/images 绘本素材取样。
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zh: {
          blue: "#1772F6",
          text: "#1A1A1A",
          sub: "#8590A6",
          line: "#EBEDF0",
          bg: "#F6F6F6",
          card: "#FFFFFF",
        },
        cabin: {
          950: "#101A16",
          900: "#142126",
          800: "#1D2D35",
          700: "#2A3B2C",
          600: "#3A2A1F",
        },
        ember: {
          400: "#FFD27A",
          500: "#F59E0B",
          600: "#F07A22",
          glow: "#FFE08A",
        },
        paper: {
          50: "#FFF8EB",
          100: "#F2E4C0",
          200: "#D8C49A",
        },
        fur: {
          cat: "#E39A52",
          owl: "#9C7C55",
          shiba: "#D98B4A",
          kanshan: "#6E7FAE",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "PingFang SC",
          "Microsoft YaHei",
          "Hiragino Sans GB",
          "sans-serif",
        ],
      },
      keyframes: {
        emberFlicker: {
          "0%,100%": { opacity: "0.88", transform: "scale(1)" },
          "45%": { opacity: "1", transform: "scale(1.03)" },
          "70%": { opacity: "0.82", transform: "scale(0.99)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        firefly: {
          "0%,100%": { opacity: "0.2", transform: "translate(0,0)" },
          "50%": { opacity: "0.9", transform: "translate(6px,-10px)" },
        },
      },
      animation: {
        ember: "emberFlicker 3.4s ease-in-out infinite",
        float: "float 3.6s ease-in-out infinite",
        firefly: "firefly 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
