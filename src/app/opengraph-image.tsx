import { ImageResponse } from "next/og";

export const alt = "Melaré · Skin, but rarer. Skincare for melanin-rich skin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#EBCFC8", color: "#3B2418", fontFamily: "serif" }}>
        <div style={{ fontSize: 150, letterSpacing: 2 }}>melaré</div>
        <div style={{ fontSize: 46, fontStyle: "italic", marginTop: 10 }}>Skin, but rarer.</div>
        <div style={{ fontSize: 26, marginTop: 36, letterSpacing: 6, textTransform: "uppercase" }}>Skincare for melanin-rich skin</div>
      </div>
    ),
    size,
  );
}
