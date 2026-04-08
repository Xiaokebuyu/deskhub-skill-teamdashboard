import { useState, useCallback, useEffect, useMemo } from "react";
import { SKILLS } from "../../constants/mock-data.js";
import { getSkills, getRecentVersions } from "../../services/skillService.js";
import { getStats, getHotEvents } from "../../services/umamiService.js";
import { DashboardSkeleton, ErrorRetry } from "../../components/ui/Skeleton.jsx";

const USE_API = import.meta.env.VITE_USE_API !== 'false';
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

/** 14 天前的 ISO 日期 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** 版本发布记录按天聚合 → [{ date: "04-01", 发布: 5 }, ...] */
function aggregateVersionsByDay(versions) {
  const map = {};
  for (const v of versions) {
    const date = v.publishedAt?.slice(5, 10); // "2026-04-03T..." → "04-03"
    if (date) map[date] = (map[date] || 0) + 1;
  }
  return Object.entries(map)
    .map(([date, count]) => ({ date, 发布: count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmtK(n) {
  if (n == null) return "暂无数据";
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

export default function Dashboard() {
  const [skills, setSkills] = useState(USE_API ? [] : SKILLS);
  const [loading, setLoading] = useState(USE_API);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [trendData, setTrendData] = useState(null);
  const [searchData, setSearchData] = useState(null);
  const [umamiStats, setUmamiStats] = useState(null);
  const [selSk, setSelSk] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseGroup, setBrowseGroup] = useState(null);

  // --- 加载 skills + 版本趋势 + Umami 数据 ---
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const since14 = daysAgo(14);
    const since7 = daysAgo(7);

    Promise.allSettled([
      getSkills({
        pageSize: 100,
        onProgress: ({ items }) => { if (!cancelled) setSkills(items); },
      }),
      getRecentVersions({ since: since14, limit: 200 }),
      getHotEvents(since7),
      getStats(since7),
    ]).then(([skillsRes, versionsRes, searchRes, statsRes]) => {
      if (cancelled) return;

      // skills
      if (skillsRes.status === "fulfilled") {
        const val = skillsRes.value;
        setSkills(val.items || val);
        setError(null);
      } else {
        console.warn("[Dashboard] skills API 不可用:", skillsRes.reason?.message);
        if (!USE_API) setSkills(SKILLS); // 仅非 API 模式才 fallback mock
        setError(skillsRes.reason?.message);
      }

      // 版本趋势
      if (versionsRes.status === "fulfilled" && Array.isArray(versionsRes.value)) {
        setTrendData(aggregateVersionsByDay(versionsRes.value));
      }

      // 搜索热词
      if (searchRes.status === "fulfilled" && searchRes.value?.length > 0) {
        setSearchData(searchRes.value);
      }

      // PV/UV
      if (statsRes.status === "fulfilled" && statsRes.value) {
        setUmamiStats(statsRes.value);
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [retryKey]);

  const popular = rankByPopularity(skills).slice(0, 7);
  const active = rankByActivity(skills).slice(0, 7);
  const topSkills = useMemo(() =>
    [...skills].sort((a, b) => (b.dl || 0) - (a.dl || 0)).slice(0, 5),
    [skills]
  );

  const handleSel = useCallback(sk => { setSelSk(sk); setTimeout(() => setShowDet(true), 30); }, []);
  const handleCloseDet = useCallback(() => { setShowDet(false); setTimeout(() => setSelSk(null), 350); }, []);

  const activeCount = skills.filter(sk => sk.status && sk.status !== "stable").length;
  const doneCount = skills.filter(sk => sk.status === "stable").length;

  // --- 图表 tabs（动态传 props）---
  const chartTabs = useMemo(() => [
    { id: "trend", label: "版本趋势", content: <TrendChart data={trendData} /> },
    { id: "download", label: "下载排行", content: <DownloadRank skills={skills} /> },
    { id: "scene", label: "分布概况", content: <SceneDistribution skills={skills} /> },
    { id: "search", label: "用户行为", content: <HotSearch searches={searchData} topSkills={topSkills} /> },
  ], [trendData, skills, searchData, topSkills]);

  if (browseGroup) {
    const browseSkills = browseGroup === "popular"
      ? rankByPopularity(skills)
      : rankByActivity(skills);
    return (
      <div style={{ paddingTop: 16 }}>
        <CardBrowse
          status={browseGroup}
          skills={browseSkills}
          onBack={() => setBrowseGroup(null)}
          onSelect={handleSel}
        />
        <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
      </div>
    );
  }

  return (
    <>
      {/* 加载/错误 状态 */}
      {loading && <DashboardSkeleton />}
      {!loading && error && skills.length === 0 && (
        <ErrorRetry message={`数据加载失败: ${error}`} onRetry={() => setRetryKey(k => k + 1)} />
      )}
      {(loading || (!loading && error && skills.length === 0)) ? null : <>
      {error && <div style={{ color: '#b83a2a', fontSize: 12, marginBottom: 8 }}>部分数据加载失败</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Stat label="技能总数" value={skills.length} color="#6a5a42" />
        <Stat label="进行中" value={activeCount || "—"} color="#b85c1a" />
        <Stat label="已完成" value={doneCount || "—"} color="#4a7a4a" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="总下载" value={skills.reduce((a, b) => a + (b.dl || 0), 0)} color="#6a5a42" />
        <Stat label="总查看" value="暂无数据" color="#aaa" />
        <Stat label="PV (本周)" value={fmtK(umamiStats?.pageviews?.value ?? umamiStats?.pageviews)} color={umamiStats ? "#5a7a5a" : "#aaa"} />
        <Stat label="UV (本周)" value={fmtK(umamiStats?.visitors?.value ?? umamiStats?.uniques ?? umamiStats?.visitors)} color={umamiStats ? "#5a7a5a" : "#aaa"} />
      </div>

      {/* 数据洞察 — 图表轮播 */}
      <ChartCarousel tabs={chartTabs} minHeight={240} />

      {/* 热门技能 */}
      <DeskRow
        label="热门技能" labelColor="#b85c1a"
        skills={popular}
        onSelect={handleSel}
        onViewAll={() => setBrowseGroup("popular")}
      />

      {/* 近期活跃 */}
      <DeskRow
        label="近期活跃" labelColor="#3a6a3a"
        skills={active}
        onSelect={handleSel}
        onViewAll={() => setBrowseGroup("active")}
      />

      <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
      </>}
    </>
  );
}
