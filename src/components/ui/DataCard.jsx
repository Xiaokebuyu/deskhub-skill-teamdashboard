import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";

/** 数据指标小卡片 — 可复用 */
export default function DataCard({ label, value, trend, warn }) {
  return (
    <div style={{
      flex: 1, minWidth: 60, borderRadius: 8, padding: "8px 10px",
      background: warn ? "rgba(184,58,42,0.06)" : "rgba(0,0,0,0.03)",
    }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: warn ? "#b83a2a" : "#3a2a18", fontWeight: 500 }}>{value}</span>
        {trend === "up" && <TrendingUp size={12} color="#4a8a4a" />}
        {trend === "down" && <TrendingDown size={12} color="#b83a2a" />}
        {trend === "flat" && <Minus size={12} color="#a09888" />}
      </div>
    </div>
  );
}
