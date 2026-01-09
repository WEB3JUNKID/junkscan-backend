'use client';
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Shield, Rocket, Terminal, History, Wifi, WifiOff } from 'lucide-react';

// ✅ Using your Helius API Key
const HELIUS_KEY = '7a3aa154-e9bb-42de-86c2-dc3bcbe453df';
const SOLANA_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const SOLANA_WSS = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

const BPF_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const SQUADS_V4_ID = new PublicKey('SMPLecH2AezpSws9asubG7v6gde66S5S6p7J93rAnp7');

export default function Home() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isScanningHistory, setIsScanningHistory] = useState(false);
  const connectionRef = useRef(null);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchHistory = async (connection) => {
    if (isScanningHistory) return;
    setIsScanningHistory(true);
    setStatus('📚 Scanning History...');
    
    const twoWeeksAgo = Math.floor(Date.now() / 1000) - (14 * 24 * 60 * 60);
    const historyEvents = [];
    const targets = [
      { id: BPF_LOADER_ID, type: 'DEPLOY', label: 'Program' },
      { id: SQUADS_V4_ID, type: 'SQUADS', label: 'Squad' }
    ];

    for (const target of targets) {
      try {
        const signatures = await connection.getSignaturesForAddress(target.id, { limit: 25 });
        
        for (const sigInfo of signatures) {
          if (sigInfo.blockTime && sigInfo.blockTime > twoWeeksAgo) {
            // Helius is fast, but we still sleep a bit to be safe
            await sleep(100); 
            const tx = await connection.getParsedTransaction(sigInfo.signature, { 
              maxSupportedTransactionVersion: 0 
            });
            
            const logs = tx?.meta?.logMessages || [];
            if (target.type === 'DEPLOY' && logs.some(l => l.includes('DeployWithMaxDataLen'))) {
              historyEvents.push({
                signature: sigInfo.signature,
                type: 'NEW_DEPLOY',
                timestamp: new Date(sigInfo.blockTime * 1000),
                message: '🚀 Historical Program Deploy',
              });
            }
            if (target.type === 'SQUADS' && logs.some(l => l.includes('Instruction: MultisigCreate'))) {
              historyEvents.push({
                signature: sigInfo.signature,
                type: 'NEW_SQUAD',
                timestamp: new Date(sigInfo.blockTime * 1000),
                message: '🛡️ Historical Squad Created',
              });
            }
          }
        }
      } catch (err) {
        console.error(`History error:`, err);
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

    // Setup Live Listeners with Connection State Tracking
    let subId;
    try {
      subId = connection.onLogs(BPF_LOADER_ID, (logs) => {
        setIsWsConnected(true);
        if (logs.logs.some(l => l.includes('DeployWithMaxDataLen'))) {
          setEvents(prev => [{
            signature: logs.signature,
            type: 'NEW_DEPLOY',
            timestamp: new Date(),
            message: '🚀 LIVE: New Program',
          }, ...prev]);
        }
      }, 'confirmed');
      setIsWsConnected(true);
    } catch (e) {
      setIsWsConnected(false);
      setStatus('⚠️ Live Socket Failed');
    }

    return () => {
      if (subId) connection.removeOnLogs(subId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-8">
      <div className="max-w-5xl mx-auto border-b border-green-900 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-white flex gap-3 items-center">
            <Terminal /> BUILDERWATCH <span className="text-[10px] bg-green-900 px-2 py-1 rounded text-green-300">HELIUS-EDITION</span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-green-800 text-xs uppercase tracking-widest">{status}</p>
            {isWsConnected ? 
              <Wifi size={14} className="text-green-500 animate-pulse" /> : 
              <WifiOff size={14} className="text-red-500" />
            }
          </div>
        </div>
        {isScanningHistory && <div className="animate-spin text-green-500"><History size={20} /></div>}
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.signature} className="p-4 border border-green-900 bg-green-950/5 hover:border-green-400 transition-all rounded flex justify-between items-center group">
            <div className="flex gap-4 items-center">
              {event.type === 'NEW_DEPLOY' ? <Rocket className="text-blue-400"/> : <Shield className="text-purple-400"/>}
              <div>
                <div className="font-bold text-gray-100 group-hover:text-green-400 transition-colors">{event.message}</div>
                <div className="text-[10px] text-green-700 uppercase">
                  {event.timestamp.toLocaleString()}
                </div>
              </div>
            </div>
            <a 
              href={`https://solscan.io/tx/${event.signature}`} 
              target="_blank" 
              className="text-[10px] border border-green-800 px-3 py-1 hover:bg-green-400 hover:text-black transition-all"
            >
              EXPLORE_TX
            </a>
          </div>
        ))}
      </div>
    </main>
  );
          }
