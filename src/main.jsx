import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Aviso anti-golpe no console (visível ao abrir o F12)
console.log(
  '%cCalma aí!%c\n\nSe alguém te disse pra copiar e colar algo aqui, tem 110% de chance de ser uma furada.',
  'color:#3b82f6;font-size:72px;font-weight:100;font-family:Helvetica, Arial, sans-serif;-webkit-text-stroke:2px #000;',
  'color:#ffffff;font-size:16px;font-weight:400;font-family:Helvetica, Arial, sans-serif;'
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
