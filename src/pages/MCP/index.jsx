import { useState, useCallback, useEffect, useMemo } from "react";
import { MCPS } from "../../constants/mock-data.js";
import { COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { getMCPData } from "../../services/mcpService.js";
import { McpSkeleton, ErrorRetry } from "../../components/ui/Skeleton.jsx";

const USE_API = import.meta.env.VITE_USE_API !== 'false';
import Stat from "../../components/ui/Stat.jsx";
import ChartCarousel from "../../components/ui/ChartCarousel.jsx";
import McpDetail from "./McpDetail.jsx";
import McpDeskRow from "./McpDeskRow.jsx";
import McpBrowse from "./McpBrowse.jsx";
import CallTrend from "./charts/CallTrend.jsx";
import SuccessRate from "./charts/SuccessRate.jsx";
import DependencyMap from "./charts/DependencyMap.jsx";

export default function SpellBook() {
  const [mcps, setMcps] = useState(USE_API ? [] : MCPS);
  const [mcpInfo, setMcpInfo] = useState(null);
  const [mcpHealth, setMcpHealth] = useState(null);
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(USE_API);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [sel, setSel] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseS, setBrowseS] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMCPData()
      .then(res => {
        if (cancelled) return;
        setMcps(res.mcps);
        setMcpInfo(res.info);
        setMcpHealth(res.health);
        setIsReal(res.isReal);
      })
      .catch(err => {
        if (!cancelled) {
          if (!USE_API) setMcps(MCPS);
          setError(err.message);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  const ranked = useMemo(() =>
    [...mcps].filter(m => m.calls > 0).sort((a, b) => b.calls - a.calls),
    [mcps]
  );
  const planned = useMemo(() => mcps.filter(m => m.status === "planned"), [mcps]);
  const allTools = useMemo(() => isReal ? mcps : [], [mcps, isReal]);

  const openDet = useCallback(m => { setSel(m); setTimeout(() => setShowDet(true), 30); }, []);
  const closeDet = useCallback(() => { setShowDet(false); setTimeout(() => setSel(null), 350); }, []);

  // 运维统计——真实 API 无此数据时显示"暂无"
  const hasOps = mcps.some(m => m.calls > 0);
  const totalCalls = hasOps ? mcps.reduce((a, m) => a + (m.calls || 0), 0) : null;
  const avgSuccess = hasOps
    ? mcps.filter(m => m.calls > 0).reduce((a, m) => a + m.successRate, 0) / (mcps.filter(m => m.calls > 0).length || 1)
    : null;
  const activeCount = mcps.filter(m => m.status !== "planned").length;

  const chartTabs = useMemo(() => [
    { id: "calls", label: "调用趋势", content: <CallTrend mcps={mcps} /> },
    { id: "success", label: "成功率", content: <SuccessRate mcps={mcps} /> },
    { id: "deps", label: "依赖关系", content: <DependencyMap mcps={mcps} /> },
  ], [mcps]);

  if (browseS) {
    const list = browseS === "ranked" ? ranked : browseS === "all" ? allTools : planned;
    return (<>
      <McpBrowse status={browseS} mcps={list} onBack={() => setBrowseS(null)} onSelect={openDet} />
      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </>);
  }

  return (
    <div style={{ padding: `0 0 ${GAP.page}px` }}>
      {loading && <McpSkeleton />}
      {!loading && error && mcps.length === 0 && (
        <ErrorRetry message={`MCP 数据加载失败: ${error}`} onRetry={() => setRetryKey(k => k + 1)} />
      )}
      {(loading || (!loading && error && mcps.length === 0)) ? null : <>

      {/* 服务器信息（真实数据时显示）*/}
      {isReal && mcpInfo && (
        <div style={{ fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.base }}>
          DeskClaw <span style={{ fontWeight: 600 }}>v{mcpInfo.version}</span>
          {mcpHealth && <span style={{ marginLeft: GAP.md, color: mcpHealth.status === 'ok' ? COLOR.success : COLOR.error }}>
            {mcpHealth.status === 'ok' ? '● 运行中' : '● 异常'}
          </span>}
          <span style={{ marginLeft: GAP.md, color: '#aaa' }}>{mcps.length} 个工具</span>
        </div>
      )}

      {/* 指标栏 */}
      <div style={{ display: "flex", gap: GAP.md, marginBottom: GAP.lg, flexWrap: "wrap" }}>
        <Stat label="MCP 工具" value={mcps.length} color="#6a8aaa" />
        <Stat label="已上线" value={activeCount} color="#5a4a30" />
        <Stat label="总调用" value={totalCalls != null ? totalCalls.toLocaleString() : "暂无数据"} color={totalCalls != null ? COLOR.warn : "#aaa"} />
        <Stat label="平均成功率" value={avgSuccess != null ? avgSuccess.toFixed(1) + "%" : "暂无数据"} color={avgSuccess != null ? (avgSuccess >= 95 ? COLOR.success : "#b8861a") : "#aaa"} />
      </div>

      {/* 图表轮播 */}
      <ChartCarousel tabs={chartTabs} minHeight={240} />

      {/* 真实数据：所有工具列表 */}
      {isReal && allTools.length > 0 && (
        <McpDeskRow
          label="全部工具" labelColor="#6a8aaa"
          mcps={allTools.slice(0, 7)}
          onSelect={openDet}
          onViewAll={() => setBrowseS("all")}
        />
      )}

      {/* Mock 数据：高频调用 */}
      {!isReal && ranked.length > 0 && (
        <McpDeskRow
          label="高频调用" labelColor={COLOR.warn}
          mcps={ranked}
          onSelect={openDet}
          onViewAll={() => setBrowseS("ranked")}
        />
      )}

      {/* 规划中 */}
      {planned.length > 0 && (
        <McpDeskRow
          label="规划中" labelColor={COLOR.plan}
          mcps={planned}
          onSelect={openDet}
          onViewAll={() => setBrowseS("planned")}
        />
      )}

      <McpDetail m={sel} onClose={closeDet} show={showDet} />
      </>}
    </div>
  );
}
