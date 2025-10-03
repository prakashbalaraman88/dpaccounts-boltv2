import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Clear old demo user data that might have invalid UUIDs
const oldUser = localStorage.getItem('demo-auth-user')
if (oldUser) {
  try {
    const user = JSON.parse(oldUser)
    if (user.id && user.id.startsWith('demo-user-')) {
      console.log('[Cleanup] Removing old demo user data with invalid UUID')
      localStorage.removeItem('demo-auth-user')
    }
  } catch (e) {
    console.error('[Cleanup] Error checking demo user:', e)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
