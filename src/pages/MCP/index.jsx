import { useState, useCallback } from "react";
import { MCPS } from "../../constants/mock-data.js";
import Stat from "../../components/ui/Stat.jsx";
import ChartCarousel from "../../components/ui/ChartCarousel.jsx";
import McpDetail from "./McpDetail.jsx";
import McpDeskRow from "./McpDeskRow.jsx";
import McpBrowse from "./McpBrowse.jsx";
import CallTrend from "./charts/CallTrend.jsx";
import SuccessRate from "./charts/SuccessRate.jsx";
import DependencyMap from "./charts/DependencyMap.jsx";

const CHART_TABS = [
  { id: "calls", label: "调用趋势", content: <CallTrend /> },
  { id: "success", label: "成功率", content: <SuccessRate /> },
  { id: "deps", label: "依赖关系", content: <DependencyMap /> },
];

// 排名：按调用量排序
const ranked = [...MCPS].filter(m => m.calls > 0).sort((a, b) => b.calls - a.calls);
const planned = MCPS.filter(m => m.status === "planned");

export default function SpellBook() {
  const [sel, setSel] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseS, setBrowseS] = useState(null);

  const openDet = useCallback(m => { setSel(m); setTimeout(() => setShowDet(true), 30); }, []);
  const closeDet = useCallback(() => { setShowDet(false); setTimeout(() => setSel(null), 350); }, []);

  const totalCalls = MCPS.reduce((a, m) => a + m.calls, 0);
  const avgSuccess = MCPS.filter(m => m.calls > 0).reduce((a, m) => a + m.successRate, 0) / (MCPS.filter(m => m.calls > 0).length || 1);
  const activeCount = MCPS.filter(m => m.status !== "planned").length;

  if (browseS) {
    const mcps = browseS === "ranked" ? ranked : planned;
    return (<>
      <McpBrowse status={browseS} mcps={mcps} onBack={() => setBrowseS(null)} onSelect={openDet} />
      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </>);
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* 指标栏 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Stat label="MCP 总数" value={MCPS.length} color="#6a8aaa" />
        <Stat label="已上线" value={activeCount} color="#5a4a30" />
        <Stat label="总调用" value={totalCalls.toLocaleString()} color="#b85c1a" />
        <Stat label="平均成功率" value={avgSuccess.toFixed(1) + "%"} color={avgSuccess >= 95 ? "#4a8a4a" : "#b8861a"} />
      </div>

      {/* 图表轮播 */}
      <ChartCarousel tabs={CHART_TABS} minHeight={240} />

      {/* 高频调用 */}
      {ranked.length > 0 && (
        <McpDeskRow
          label="高频调用" labelColor="#b85c1a"
          mcps={ranked}
          onSelect={openDet}
          onViewAll={() => setBrowseS("ranked")}
        />
      )}

      {/* 规划中 */}
      {planned.length > 0 && (
        <McpDeskRow
          label="规划中" labelColor="#3a6a3a"
          mcps={planned}
          onSelect={openDet}
          onViewAll={() => setBrowseS("planned")}
        />
      )}

      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </div>
  );
}
