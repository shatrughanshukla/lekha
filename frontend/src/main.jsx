import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import { LanguageProvider } from './i18n.jsx'
import './index.css'
import './styles/primitives.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>,
)
