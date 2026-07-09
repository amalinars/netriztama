import { BrowserRouter, Navigate, Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Orders from '@/pages/Orders'
import Accounts from '@/pages/Accounts'
import Logs from '@/pages/Logs'
import Testimonials from '@/pages/Testimonials'
import AdminTestimonials from '@/pages/AdminTestimonials'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
        <Route path="/accounts" element={<Navigate to="/admin/accounts" replace />} />
        <Route path="/logs" element={<Navigate to="/admin/logs" replace />} />
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="logs" element={<Logs />} />
          <Route path="testimonials" element={<AdminTestimonials />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
