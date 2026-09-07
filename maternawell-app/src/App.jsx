import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScreeningProvider } from './context/ScreeningContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MotherInfoForm from './pages/MotherInfoForm';
import ScreeningQuestion from './pages/ScreeningQuestion';
import Results from './pages/Results';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-screening"
        element={
          <ProtectedRoute>
            <MotherInfoForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/screening/:id"
        element={
          <ProtectedRoute>
            <ScreeningQuestion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/results/:id"
        element={
          <ProtectedRoute>
            <Results />
          </ProtectedRoute>
        }
      />
      <Route
        path="/screenings"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScreeningProvider>
          <AppRoutes />
        </ScreeningProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
