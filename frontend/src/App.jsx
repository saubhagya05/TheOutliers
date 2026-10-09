import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import LandingPage from './pages/dashboard/LandingPage.jsx';
import DatasetPage from './pages/dashboard/DatasetPage.jsx';
import RingsPage from './pages/rings/RingsPage.jsx';
import LonePage from './pages/lone/LonePage.jsx';
import DatasetGate from './components/DatasetGate.jsx';

export default function App() {
  return (
    <div className="app">
      <TopNav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/rings" element={<DatasetGate><RingsPage /></DatasetGate>} />
          <Route path="/lone" element={<DatasetGate><LonePage /></DatasetGate>} />
          <Route path="/dataset" element={<DatasetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
