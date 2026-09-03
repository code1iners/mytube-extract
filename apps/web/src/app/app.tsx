import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ROUTE_PATHS, ROUTE_SEGMENTS } from './constants/route-paths.constant';
import { AppLayout } from './components/app-layout';

/** 영상 추출 route 화면. */
const VideoExtractPage = lazy(() =>
  import('./pages/video-extract/page').then((module) => ({
    default: module.VideoExtractPage,
  })),
);
/** 자막 추출 route 화면. */
const SubtitlesExtractPage = lazy(() =>
  import('./pages/subtitles-extract/page').then((module) => ({
    default: module.SubtitlesExtractPage,
  })),
);
/** 요청 내역 route 화면. */
const RequestHistoryPage = lazy(() =>
  import('./pages/request-history/page').then((module) => ({
    default: module.RequestHistoryPage,
  })),
);
/** 설정 route 화면. */
const SettingsPage = lazy(() =>
  import('./pages/settings/page').then((module) => ({
    default: module.SettingsPage,
  })),
);

/** MyTube Extract web router shell. */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to={ROUTE_PATHS.video} />} />
          <Route element={<RequestHistoryPage />} path={ROUTE_SEGMENTS.history} />
          <Route element={<SettingsPage />} path={ROUTE_SEGMENTS.settings} />
          <Route element={<VideoExtractPage />} path={ROUTE_SEGMENTS.video} />
          <Route
            element={<SubtitlesExtractPage />}
            path={ROUTE_SEGMENTS.subtitles}
          />
          <Route
            element={<Navigate replace to={ROUTE_PATHS.video} />}
            path="*"
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
