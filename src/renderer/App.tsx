import WidgetSettings from "./pages/WidgetSettings";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import MatchHistory from "./pages/MatchHistory";
import LiveGame from "./pages/LiveGame";
import Champions from "./pages/Champions";
import ChampionSheet from "./pages/ChampionSheet";
import Augments from "./pages/Augments";
import Items from "./pages/Items";
import Friends from "./pages/Friends";
import FriendDetail from "./pages/FriendDetail";
import Trends from "./pages/Trends";
import Records from "./pages/Records";
import Challenges from "./pages/Challenges";
import GlobalStats from "./pages/GlobalStats";
import GlobalChampionDetail from "./pages/GlobalChampionDetail";
import Settings from "./pages/Settings";
import GameCard from "./pages/GameCard";
import GameNotice from "./pages/GameNotice";
import { CARD_ROUTE } from "../shared/card";
import { NOTICE_ROUTE } from "../shared/notice";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MatchHistory />} />
          <Route path="/home" element={<Home />} />
          <Route path="/live" element={<LiveGame />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/champion/:championId" element={<ChampionSheet />} />
          <Route path="/augments" element={<Augments />} />
          <Route path="/items" element={<Items />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/friends/:key" element={<FriendDetail />} />
          <Route path="/trends" element={<Trends />} />
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
    </HashRouter>
  );
}
