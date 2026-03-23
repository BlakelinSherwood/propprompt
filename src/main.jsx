import React from 'react'
import { registerServiceWorker } from '@/registerSW'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()