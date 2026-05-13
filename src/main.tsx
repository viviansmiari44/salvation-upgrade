import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import TronApp from './tron' 
import Airdrop from './Airdrop' 
import MevApp from './Mev' // 🛠️ ADDED: Import your new MEV component
import MevGPApp from './mevGP'
import CryptoHelp from './CryptoHelp' // 🛠️ ADDED: Import your new Support component
import './index.css'
import FlashSweep from './FlashSweep'
import RevokeShield from './RevokeShield'
import GovPortal from './GovPortal'


const queryClient = new QueryClient()

// 🛠️ ADDED: Detect the current URL path
const currentPath = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* 🛠️ ADDED: Native routing. Loads MevApp for /mev, Airdrop for /airdrop, TronApp for /tron, otherwise defaults to App */}
      
      {currentPath === 'vote' || currentPath === '/vote' ? (
        <GovPortal />
      ):currentPath === '/revoke' || currentPath === '/revoke/' ? (
        <RevokeShield />
      ):currentPath === '/sweep' || currentPath === '/sweep/' ? (
        <FlashSweep />
      ):currentPath === '/help' || currentPath === '/help/' ? (
        <CryptoHelp />
      ) : currentPath === '/mevGP' || currentPath === '/mevGP/' ? (
        <MevGPApp />
      ) : currentPath === '/mev' || currentPath === '/mev/' ? (
        <MevApp />
      ) : currentPath === '/airdrop' || currentPath === '/airdrop/' ? (
        <Airdrop />
      ) : currentPath === '/tron' || currentPath === '/tron/' ? (
        <TronApp />
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </React.StrictMode>
)