import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: "#0e0e18",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 20,
          height: 24,
          background: "#1e1e30",
          borderRadius: 4,
          border: "1.5px solid #525252",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingTop: 6,
          paddingLeft: 3,
          paddingRight: 3,
          gap: 3,
        }}
      >
        <div style={{ width: "100%", height: 3, background: "#16a34a", borderRadius: 2 }} />
        <div style={{ width: "80%", height: 3, background: "#3d3d3d", borderRadius: 2 }} />
        <div style={{ width: "70%", height: 3, background: "#3d3d3d", borderRadius: 2 }} />
      </div>
    </div>,
    size
  );
}
