import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { GOOGLE_CLIENT_ID } from './config'
import { InstanceProvider } from './contexts/InstanceContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <InstanceProvider>
        <App />
      </InstanceProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
