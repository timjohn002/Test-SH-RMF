import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { RobotsPage } from './pages/RobotsPage'
import { SetupPage } from './pages/SetupPage'
import { UsersPage } from './pages/UsersPage'
import { VendorConfigPage, VendorsPage } from './pages/VendorsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<MapPage />} />
        <Route path="robots" element={<RobotsPage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route
          path="vendors"
          element={
            <RequireAdmin>
              <VendorsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="vendors/:vendorId"
          element={
            <RequireAdmin>
              <VendorConfigPage />
            </RequireAdmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
