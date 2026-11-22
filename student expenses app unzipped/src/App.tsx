import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Join from './pages/Join';
import HouseholdLayout from './pages/HouseholdLayout';
import Overview from './pages/Overview';
import Activity from './pages/Activity';
import ExpenseForm from './pages/ExpenseForm';
import SettleForm from './pages/SettleForm';
import Members from './pages/Members';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/join/:code" element={<ProtectedRoute><Join /></ProtectedRoute>} />
            <Route path="/h/:householdId" element={<ProtectedRoute><HouseholdLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="activity" element={<Activity />} />
              <Route path="expenses/new" element={<ExpenseForm />} />
              <Route path="expenses/:expenseId" element={<ExpenseForm />} />
              <Route path="settle" element={<SettleForm />} />
              <Route path="members" element={<Members />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
