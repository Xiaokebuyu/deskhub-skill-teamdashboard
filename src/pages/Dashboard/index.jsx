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
import { rankByPopularity, rankByActivity } from "./skillRank.js";

const CHART_TABS = [
  { id: "trend", label: "迭代趋势", content: <TrendChart /> },
  { id: "download", label: "下载排行", content: <DownloadRank /> },
  { id: "scene", label: "分布概况", content: <SceneDistribution /> },
  { id: "search", label: "热门搜索", content: <HotSearch /> },
];

// 加权排序后取 Top 7
const popular = rankByPopularity(SKILLS).slice(0, 7);
const active = rankByActivity(SKILLS).slice(0, 7);

export default function Dashboard() {
  const [selSk, setSelSk] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseGroup, setBrowseGroup] = useState(null);

  const handleSel = useCallback(sk => { setSelSk(sk); setTimeout(() => setShowDet(true), 30); }, []);
  const handleCloseDet = useCallback(() => { setShowDet(false); setTimeout(() => setSelSk(null), 350); }, []);

  const activeCount = SKILLS.filter(sk => sk.status !== "stable").length;
  const doneCount = SKILLS.filter(sk => sk.status === "stable").length;

  if (browseGroup) {
    const skills = browseGroup === "popular"
      ? rankByPopularity(SKILLS)
      : rankByActivity(SKILLS);
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
        <Stat label="进行中" value={activeCount} color="#b85c1a" />
        <Stat label="已完成" value={doneCount} color="#4a7a4a" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="总下载" value={SKILLS.reduce((a, b) => a + b.dl, 0)} color="#6a5a42" />
        <Stat label="总查看" value={SKILLS.reduce((a, b) => a + b.views, 0)} color="#6a5a42" />
        <Stat label="PV (本周)" value="12.4k" color="#5a7a5a" />
        <Stat label="UV (本周)" value="3.2k" color="#5a7a5a" />
      </div>

      {/* 数据洞察 — 图表轮播（选择栏在内部） */}
      <ChartCarousel tabs={CHART_TABS} minHeight={240} />

      {/* 热门技能 — 加权综合排名 Top 7 */}
      <DeskRow
        label="热门技能" labelColor="#b85c1a"
        skills={popular}
        onSelect={handleSel}
        onViewAll={() => setBrowseGroup("popular")}
      />

      {/* 近期活跃 — 更新时间 + 迭代频率 Top 7 */}
      <DeskRow
        label="近期活跃" labelColor="#3a6a3a"
        skills={active}
        onSelect={handleSel}
        onViewAll={() => setBrowseGroup("active")}
      />

      <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
    </>
  );
}
