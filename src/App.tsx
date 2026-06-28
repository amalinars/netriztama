import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Orders from '@/pages/Orders'
import Accounts from '@/pages/Accounts'
import Logs from '@/pages/Logs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
