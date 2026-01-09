'use client';
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Shield, Rocket, Terminal, History, Wifi, WifiOff, Search, Activity } from 'lucide-react';

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

  // --- INDUSTRIAL DEEP SCAN (1,000 TXs) ---
  const fetchHistory = async (connection) => {
    if (isScanningHistory) return;
    setIsScanningHistory(true);
    setStatus('🔍 Industrial Scan (1,000 TXs)...');
    
    const historyEvents = [];
    const targets = [
      { id: BPF_LOADER_ID, type: 'DEPLOY', label: 'Programs' },
      { id: SQUADS_V4_ID, type: 'SQUADS', label: 'Squads' }
    ];

    for (const target of targets) {
      try {
        // Fetch up to 1,000 signatures
        const signatures = await connection.getSignaturesForAddress(target.id, { limit: 1000 });
        setScanProgress({ current: 0, total: signatures.length });

        // Batch process in chunks of 20 to avoid rate limits and UI lag
        const batchSize = 20;
        for (let i = 0; i < signatures.length; i += batchSize) {
          const chunk = signatures.slice(i, i + batchSize);
          setScanProgress(prev => ({ ...prev, current: i + chunk.length }));

          const txs = await connection.getParsedTransactions(
            chunk.map(s => s.signature), 
            { maxSupportedTransactionVersion: 0 }
          );

          txs.forEach((tx, idx) => {
            if (!tx || tx?.meta?.err) return;

            const logs = tx.meta.logMessages?.join(' ') || '';
            const sig = chunk[idx].signature;
            const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

            const isDeploy = logs.includes('DeployWithMaxDataLen') || logs.includes('Program upgraded');
            const isSquad = logs.includes('Instruction: MultisigCreate') || logs.includes('Instruction: CreateMultisig');

            if (target.type === 'DEPLOY' && isDeploy) {
              historyEvents.push({
                signature: sig,
                type: 'NEW_DEPLOY',
                timestamp: blockTime,
                message: logs.includes('upgraded') ? '🚀 Program Upgraded' : '🚀 New Program Deployed',
                details: 'BPF Loader'
              });
            }

            if (target.type === 'SQUADS' && isSquad) {
              historyEvents.push({
                signature: sig,
                type: 'NEW_SQUAD',
                timestamp: blockTime,
                message: '🛡️ New Squad Multisig',
                details: 'Squads V4'
              });
            }
          });

          // Throttle to stay within Helius free tier limits
          await sleep(250);
        }
      } catch (err) {
        console.error(`Error scanning ${target.label}:`, err);
      }
    }

    // Update state with unique events only
    setEvents(prev => {
      const combined = [...historyEvents, ...prev];
      const uniqueMap = new Map();
      combined.forEach(item => uniqueMap.set(item.signature, item));
      return Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
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
          setEvents(prev => {
            const newEvent = {
                signature: logs.signature,
                type: 'NEW_DEPLOY',
                timestamp: new Date(),
                message: logString.includes('upgraded') ? '🚀 LIVE: Program Upgrade' : '🚀 LIVE: New Program',
                details: 'Detected in real-time'
              };
            const combined = [newEvent, ...prev];
            const uniqueMap = new Map();
            combined.forEach(item => uniqueMap.set(item.signature, item));
            return Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
          });
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white flex gap-3 items-center italic">
              <Activity className="text-green-500 w-8 h-8 md:w-12 md:h-12" /> BUILDERWATCH
            </h1>
            <div className="flex items-center gap-4 mt-4">
              <div className="bg-green-950 border border-green-500/30 px-3 py-1 rounded flex items-center gap-2">
                {isWsConnected ? 
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" /> : 
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                }
                <p className="text-green-400 text-[10px] uppercase font-bold tracking-widest">{status}</p>
              </div>
              
              {isScanningHistory && (
                <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold">
                  <Search size={14} className="animate-spin" />
                  SCRAPING BLOCKCHAIN: {scanProgress.current} / {scanProgress.total}
                </div>
              )}
            </div>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-green-900 text-[10px] font-bold">NETWORK: SOLANA MAINNET</p>
            <p className="text-green-900 text-[10px] font-bold">PROVIDER: HELIUS RPC</p>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="max-w-5xl mx-auto space-y-4">
        {events.length === 0 && !isScanningHistory && (
          <div className="text-center py-32 border-2 border-dashed border-green-900/30 rounded-lg">
            <Rocket size={48} className="mx-auto text-green-900 mb-4 opacity-20" />
            <p className="text-green-900 font-bold tracking-widest">AWAITING ON-CHAIN DEPLOYMENTS...</p>
          </div>
        )}

        {events.map((event) => (
          <div 
            key={event.signature} 
            className="group relative overflow-hidden p-5 border border-green-900 bg-green-950/5 hover:border-green-400 transition-all duration-300 rounded-sm flex justify-between items-center"
          >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-green-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="flex gap-6 items-center relative z-10">
              <div className={`p-3 rounded-md border ${event.type === 'NEW_DEPLOY' ? 'border-blue-500/30 bg-blue-500/10' : 'border-purple-500/30 bg-purple-500/10'}`}>
                {event.type === 'NEW_DEPLOY' ? 
                  <Rocket size={24} className="text-blue-400 group-hover:scale-110 transition-transform"/> : 
                  <Shield size={24} className="text-purple-400 group-hover:scale-110 transition-transform"/>
                }
              </div>
              <div>
                <div className="text-xl font-bold text-gray-100 group-hover:text-white uppercase">
                  {event.message}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] bg-green-900/40 text-green-300 px-2 py-0.5 rounded font-bold">
                    {event.details}
                  </span>
                  <span className="text-[10px] text-green-800 font-medium">
                    {event.timestamp.toLocaleTimeString()} — {event.timestamp.toLocaleDateString()}
                  </span>
                </div>
                <div className="text-[9px] text-gray-600 mt-2 font-mono truncate max-w-[180px] md:max-w-md">
                  TX: {event.signature}
                </div>
              </div>
            </div>
            
            <a 
              href={`https://solscan.io/tx/${event.signature}`} 
              target="_blank" 
              rel="noreferrer"
              className="relative z-10 text-[11px] border-2 border-green-900 px-5 py-2 hover:bg-green-400 hover:text-black hover:border-green-400 transition-all font-black uppercase tracking-tighter"
            >
              EXPLORE
            </a>
          </div>
        ))}
      </div>
    </main>
  );
                  }
    
