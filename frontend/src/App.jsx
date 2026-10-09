import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import LandingPage from './pages/dashboard/LandingPage.jsx';
import DatasetPage from './pages/dashboard/DatasetPage.jsx';
import RingsPage from './pages/rings/RingsPage.jsx';
import LonePage from './pages/lone/LonePage.jsx';
import RequireDataset from './components/DatasetGate.jsx';
import AnalysePage from './pages/dashboard/AnalysePage.jsx';

export default function App() {
  return (
    <div className="app">
      <TopNav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/analyse" element={<RequireDataset bar={false}><AnalysePage /></RequireDataset>} />
          <Route path="/rings" element={<RequireDataset><RingsPage /></RequireDataset>} />
          <Route path="/lone" element={<RequireDataset><LonePage /></RequireDataset>} />
          <Route path="/dataset" element={<DatasetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
