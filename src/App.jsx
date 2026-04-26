import { Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { OrderPage } from './pages/OrderPage'
import { BeforeAfterPage } from './pages/BeforeAfterPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/before-after" element={<BeforeAfterPage />} />
        <Route path="/order" element={<OrderPage />} />
      </Route>
    </Routes>
  )
}
