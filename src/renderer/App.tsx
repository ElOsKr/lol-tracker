import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { PageLoading } from "./components/PageState";
import MatchHistory from "./pages/MatchHistory";
import { CARD_ROUTE } from "../shared/card";
import { MATCH_DETAIL_PATH } from "../shared/match-detail";
import { NOTICE_ROUTE } from "../shared/notice";

// Every page but the history arrives when it is opened.
//
// The renderer was one 1.4 MB file that the window parsed in full before
// drawing anything, however little of it the first screen needed — and the
// two little windows that carry no interface at all, the shareable card and
// the end-of-game notice, were parsing the whole application to draw one box.
//
// The history stays eager because it is the default route and the one the
// app opens on; everything else is a navigation away, where the page's own
// loading state is the same one it would show while its data arrived.
const Home = lazy(() => import("./pages/Home"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const LiveGame = lazy(() => import("./pages/LiveGame"));
const Champions = lazy(() => import("./pages/Champions"));
const ChampionSheet = lazy(() => import("./pages/ChampionSheet"));
const Augments = lazy(() => import("./pages/Augments"));
const Items = lazy(() => import("./pages/Items"));
const Friends = lazy(() => import("./pages/Friends"));
const FriendDetail = lazy(() => import("./pages/FriendDetail"));
const Trends = lazy(() => import("./pages/Trends"));
const Skills = lazy(() => import("./pages/Skills"));
const Records = lazy(() => import("./pages/Records"));
const Challenges = lazy(() => import("./pages/Challenges"));
const GlobalStats = lazy(() => import("./pages/GlobalStats"));
const GlobalChampionDetail = lazy(() => import("./pages/GlobalChampionDetail"));
const WidgetSettings = lazy(() => import("./pages/WidgetSettings"));
const Settings = lazy(() => import("./pages/Settings"));
const GameCard = lazy(() => import("./pages/GameCard"));
const GameNotice = lazy(() => import("./pages/GameNotice"));

export default function App() {
  return (
    <HashRouter>
      {/* One boundary around the routes rather than one per page: the pages
          are files on disk, so the wait is a frame or two, and the sidebar is
          redrawn by the layout either way. */}
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<MatchHistory />} />
            <Route path={`${MATCH_DETAIL_PATH}/:gameId`} element={<MatchDetail />} />
            <Route path="/home" element={<Home />} />
            <Route path="/live" element={<LiveGame />} />
            <Route path="/champions" element={<Champions />} />
            <Route path="/champion/:championId" element={<ChampionSheet />} />
            <Route path="/augments" element={<Augments />} />
            <Route path="/items" element={<Items />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/:key" element={<FriendDetail />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/records" element={<Records />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/global" element={<GlobalStats />} />
            <Route path="/global/champion/:championId" element={<GlobalChampionDetail />} />
            <Route path="/widget" element={<WidgetSettings />} />
            <Route path="/settings" element={<Settings />} />
            {/* A path nothing matches used to render an empty window: the layout
                route is pathless, so with no child matching, the sidebar went too
                and there was no way back except restarting. A bad link should cost
                a redirect, not the app. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Outside the layout: this one is drawn to be captured as an image,
              not to be navigated to, so it carries no sidebar or title bar. */}
          <Route path={`${CARD_ROUTE}/:gameId`} element={<GameCard />} />
          {/* Also outside the layout: the end-of-game card is its own little
              window in the corner of the screen, with nothing around it. */}
          <Route path={`${NOTICE_ROUTE}/:gameId`} element={<GameNotice />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
