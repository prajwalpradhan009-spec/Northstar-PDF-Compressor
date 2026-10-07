import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import CloudBackground from './components/CloudBackground';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastViewport from './components/ToastViewport';
import RequireAuth from './components/RequireAuth';

import Home from './pages/Home';
import PdfMerger from './pages/PdfMerger';
import ImageCompressor from './pages/ImageCompressor';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Account from './pages/Account';
import NotFound from './pages/NotFound';

/** Scroll to the top on navigation, but honour an in-page #hash link. */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <CloudBackground />
      <a className="skip-link" href="#main">Skip to main content</a>

      <ScrollManager />
      <Navbar />

      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/pdf-merger"
            element={(
              <RequireAuth tool="the PDF Merger">
                <PdfMerger />
              </RequireAuth>
            )}
          />
          <Route
            path="/image-compressor"
            element={(
              <RequireAuth tool="the Image Compressor">
                <ImageCompressor />
              </RequireAuth>
            )}
          />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
      <ToastViewport />
    </>
  );
}
