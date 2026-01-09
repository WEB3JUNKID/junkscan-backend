'use client';
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Shield, Rocket, Terminal, History, Wifi, WifiOff, Search } from 'lucide-react';

// ✅ Helius RPC Configuration
const HELIUS_KEY = '7a3aa154-e9bb-42de-86c2-dc3bcbe453df';
const SOLANA_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const SOLANA_WSS = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// Constants for Monitoring
const BPF_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const SQUADS_V4_ID = new PublicKey('SMPLecH2AezpSws9asubG7v6gde66S5S6p7J93rAnp7');

export default function Home() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isScanningHistory, setIsScanningHistory] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  
  const connectionRef = useRef(null);
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // --- DEEP SCAN HISTORY ---
  const fetchHistory = async (connection) => {
    if (isScanningHistory) return;
    setIsScanningHistory(true);
    setStatus('📚 Deep Scanning History...');
    
    const historyEvents = [];
    const targets = [
      { id: BPF_LOADER_ID, type: 'DEPLOY', label: 'Program Deploys' },
      { id: SQUADS_V4_ID, type: 'SQUADS', label: 'Squad Creations' }
    ];

    for (const target of targets) {
      try {
        // Limit 100 ensures we go back far enough to find actual events
        const signatures = await connection.getSignaturesForAddress(target.id, { limit: 100 });
        setScanProgress({ current: 0, total: signatures.length });

        for (let i = 0; i < signatures.length; i++) {
          const sigInfo = signatures[i];
          setScanProgress(prev => ({ ...prev, current: i + 1 }));

          // Skip if transaction failed
          if (sigInfo.err) continue;

          // Throttle slightly for Helius rate limits
          await sleep(60); 

          const tx = await connection.getParsedTransaction(sigInfo.signature, { 
            maxSupportedTransactionVersion: 0 
          });
          
          const logs = tx?.meta?.logMessages?.join(' ') || '';

          // Broad matching for different types of deployments/upgrades
          const isDeploy = logs.includes('DeployWithMaxDataLen') || logs.includes('Program upgraded');
          const isSquad = logs.includes('Instruction: MultisigCreate') || logs.includes('Instruction: CreateMultisig');

          if (target.type === 'DEPLOY' && isDeploy) {
            historyEvents.push({
              signature: sigInfo.signature,
              type: 'NEW_DEPLOY',
              timestamp: new Date(sigInfo.blockTime * 1000),
              message: logs.includes('upgraded') ? '🚀 Program Upgraded' : '🚀 New Program Deployed',
              details: 'BPF Loader interaction detected'
            });
          }

          if (target.type === 'SQUADS' && isSquad) {
            historyEvents.push({
              signature: sigInfo.signature,
              type: 'NEW_SQUAD',
              timestamp: new Date(sigInfo.blockTime * 1000),
              message: '🛡️ New Squad Multisig',
              details: 'Governance structure created'
            });
          }
        }
      } catch (err) {
        console.error(`Error scanning ${target.label}:`, err);
      }
    }

    setEvents(prev => {
      const combined = [...historyEvents, ...prev];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.signature === v.signature) === i);
      return unique.sort((a, b) => b.timestamp - a.timestamp);
    });

    setIsScanningHistory(false);
    setStatus('🟢 Monitoring Live');
  };

  useEffect(() => {
    const connection = new Connection(SOLANA_RPC, { 
      wsEndpoint: SOLANA_WSS,
      commitment: 'confirmed' 
    });
    connectionRef.current = connection;

    fetchHistory(connection);

    // --- LIVE LISTENER ---
    let subId;
    try {
      subId = connection.onLogs(BPF_LOADER_ID, (logs) => {
        setIsWsConnected(true);
        const logString = logs.logs.join(' ');
        if (logString.includes('DeployWithMaxDataLen') || logString.includes('Program upgraded')) {
          setEvents(prev => [{
            signature: logs.signature,
            type: 'NEW_DEPLOY',
            timestamp: new Date(),
            message: '🚀 LIVE: Program Action',
            details: 'Real-time detection'
          }, ...prev]);
        }
      }, 'confirmed');
      setIsWsConnected(true);
    } catch (e) {
      setIsWsConnected(false);
      setStatus('⚠️ Live Feed Error');
    }

    return () => {
      if (subId) connection.removeOnLogs(subId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-8">
      {/* Header Section */}
      <div className="max-w-5xl mx-auto border-b border-green-900 pb-6 mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white flex gap-3 items-center">
              <Terminal className="text-green-500" /> BUILDERWATCH 
              <span className="text-[10px] bg-green-950 border border-green-500 px-2 py-1 rounded text-green-300">DEEP SCAN V2</span>
            </h1>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                {isWsConnected ? <Wifi size={14} className="text-green-500 animate-pulse" /> : <WifiOff size={14} className="text-red-500" />}
                <p className="text-green-800 text-[10px] uppercase tracking-[0.2em] font-bold">{status}</p>
              </div>
              {isScanningHistory && (
                <div className="text-[10px] text-blue-400 flex items-center gap-2">
                  <Search size={12} className="animate-bounce" />
                  ANALYZING TX {scanProgress.current}/{scanProgress.total}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="max-w-5xl mx-auto space-y-3">
        {events.length === 0 && !isScanningHistory && (
          <div className="text-center py-20 border border-dashed border-green-900 opacity-50">
            <p>NO RECENT DEPLOYMENTS FOUND IN LAST 100 TXs</p>
            <p className="text-[10px] mt-2">LISTENING FOR NEW ON-CHAIN ACTIVITY...</p>
          </div>
        )}

        {events.map((event) => (
          <div 
            key={event.signature} 
            className="p-4 border border-green-900 bg-green-950/5 hover:bg-green-900/10 hover:border-green-400 transition-all rounded-sm flex justify-between items-center group"
          >
            <div className="flex gap-5 items-center">
              <div className={`p-2 rounded-full ${event.type === 'NEW_DEPLOY' ? 'bg-blue-900/20' : 'bg-purple-900/20'}`}>
                {event.type === 'NEW_DEPLOY' ? <Rocket size={20} className="text-blue-400"/> : <Shield size={20} className="text-purple-400"/>}
              </div>
              <div>
                <div className="font-bold text-gray-100 group-hover:text-green-400 transition-colors uppercase tracking-tight">
                  {event.message}
                </div>
                <div className="text-[10px] text-green-800 font-bold mt-1">
                   {event.timestamp.toLocaleTimeString()} — {event.details}
                </div>
                <div className="text-[9px] text-gray-600 mt-1 font-light truncate max-w-[200px] md:max-w-md">
                  SIG: {event.signature}
                </div>
              </div>
            </div>
            
            <a 
              href={`https://solscan.io/tx/${event.signature}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] border border-green-900 px-4 py-2 hover:bg-green-400 hover:text-black transition-all font-bold"
            >
              VIEW_TX
            </a>
          </div>
        ))}
      </div>
    </main>
  );
                  }
                 
