import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import LandingPage from './pages/dashboard/LandingPage.jsx';
import DatasetPage from './pages/dashboard/DatasetPage.jsx';
import RingsPage from './pages/rings/RingsPage.jsx';
import LonePage from './pages/lone/LonePage.jsx';

export default function App() {
  return (
    <div className="app">
      <TopNav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/rings" element={<RingsPage />} />
          <Route path="/lone" element={<LonePage />} />
          <Route path="/dataset" element={<DatasetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
