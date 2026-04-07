import { useState, useCallback } from "react";
import { SKILLS } from "../../constants/mock-data.js";
import Stat from "../../components/ui/Stat.jsx";
import ChartCarousel from "../../components/ui/ChartCarousel.jsx";
import DeskRow from "./DeskRow.jsx";
import CardBrowse from "./CardBrowse.jsx";
import SkillDetail from "./SkillDetail.jsx";
import TrendChart from "./charts/TrendChart.jsx";
import DownloadRank from "./charts/DownloadRank.jsx";
import SceneDistribution from "./charts/SceneDistribution.jsx";
import HotSearch from "./charts/HotSearch.jsx";

const CHART_TABS = [
  { id: "trend", label: "迭代趋势", content: <TrendChart /> },
  { id: "download", label: "下载排行", content: <DownloadRank /> },
  { id: "scene", label: "分布概况", content: <SceneDistribution /> },
  { id: "search", label: "热门搜索", content: <HotSearch /> },
];

export default function Dashboard() {
  const [selSk, setSelSk] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseGroup, setBrowseGroup] = useState(null);

  const handleSel = useCallback(sk => { setSelSk(sk); setTimeout(() => setShowDet(true), 30); }, []);
  const handleCloseDet = useCallback(() => { setShowDet(false); setTimeout(() => setSelSk(null), 350); }, []);

  // 两组：进行中 = iterating + testing + planned，已完成 = stable
  const active = SKILLS.filter(sk => sk.status !== "stable");
  const done = SKILLS.filter(sk => sk.status === "stable");

  if (browseGroup) {
    const skills = browseGroup === "active" ? active : done;
    return (
      <div style={{ paddingTop: 16 }}>
        <CardBrowse
          status={browseGroup}
          skills={skills}
          onBack={() => setBrowseGroup(null)}
          onSelect={handleSel}
        />
        <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
      </div>
    );
  }

  return (
    <>
      {/* 指标栏 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Stat label="技能总数" value={SKILLS.length} color="#6a5a42" />
        <Stat label="进行中" value={active.length} color="#b85c1a" />
        <Stat label="已完成" value={done.length} color="#4a7a4a" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="总下载" value={SKILLS.reduce((a, b) => a + b.dl, 0)} color="#6a5a42" />
        <Stat label="总查看" value={SKILLS.reduce((a, b) => a + b.views, 0)} color="#6a5a42" />
        <Stat label="PV (本周)" value="12.4k" color="#5a7a5a" />
        <Stat label="UV (本周)" value="3.2k" color="#5a7a5a" />
      </div>

      {/* 数据洞察 — 图表轮播 */}
      <ChartCarousel tabs={CHART_TABS} height={280} />

      {/* 最近更新 — 卡片行 */}
      {active.length > 0 && (
        <DeskRow label="进行中" labelColor="#b85c1a" skills={active} onSelect={handleSel} onViewAll={() => setBrowseGroup("active")} />
      )}
      {done.length > 0 && (
        <DeskRow label="已完成" labelColor="#5a4a30" skills={done} onSelect={handleSel} onViewAll={() => setBrowseGroup("done")} />
      )}
      <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
    </>
  );
}
