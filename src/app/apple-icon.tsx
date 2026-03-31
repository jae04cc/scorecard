import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: "#0e0e18",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Card body */}
      <div
        style={{
          width: 108,
          height: 128,
          background: "#1e1e30",
          borderRadius: 16,
          border: "2px solid #525252",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#525252",
            height: 34,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            paddingRight: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ width: 52, height: 6, background: "white", borderRadius: 3, opacity: 0.9 }} />
        </div>
        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
          {/* Winner row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: "#16a34a", borderRadius: 3, opacity: 0.9 }} />
            <div style={{ width: 22, height: 6, background: "#16a34a", borderRadius: 3 }} />
          </div>
          {/* Row 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: "#3d3d3d", borderRadius: 3, width: "80%" }} />
            <div style={{ width: 22, height: 6, background: "#3d3d3d", borderRadius: 3 }} />
          </div>
          {/* Row 3 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: "#3d3d3d", borderRadius: 3, width: "65%" }} />
            <div style={{ width: 22, height: 6, background: "#3d3d3d", borderRadius: 3 }} />
          </div>
          {/* Row 4 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: "#3d3d3d", borderRadius: 3, width: "75%" }} />
            <div style={{ width: 22, height: 6, background: "#3d3d3d", borderRadius: 3 }} />
          </div>
        </div>
      </div>
    </div>,
    size
  );
}
