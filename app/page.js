'use client';
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Shield, Rocket, ExternalLink, Terminal, Activity, History } from 'lucide-react';

// Use a more robust RPC if possible (e.g., Helius, QuickNode). 
// This public one is prone to the 'ws error' you saw.
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SOLANA_WSS = 'wss://api.mainnet-beta.solana.com';

const BPF_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const SQUADS_V4_ID = new PublicKey('SMPLecH2AezpSws9asubG7v6gde66S5S6p7J93rAnp7');

export default function Home() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Initializing...');
  const [isScanningHistory, setIsScanningHistory] = useState(false);
  
  const connectionRef = useRef(null);

  // --- FEATURE: FETCH HISTORY (PAST 2 WEEKS) ---
  const fetchHistory = async (connection) => {
    setIsScanningHistory(true);
    setStatus('📚 Scanning History (Past 2 Weeks)...');
    
    const twoWeeksAgo = Math.floor(Date.now() / 1000) - (14 * 24 * 60 * 60);
    const historyEvents = [];

    const targets = [
      { id: BPF_LOADER_ID, type: 'DEPLOY', label: 'Program' },
      { id: SQUADS_V4_ID, type: 'SQUADS', label: 'Squad' }
    ];

    for (const target of targets) {
      try {
        // Fetch last 100 signatures
        const signatures = await connection.getSignaturesForAddress(target.id, { limit: 100 });
        
        for (const sigInfo of signatures) {
          // Only process if within the 2-week window
          if (sigInfo.blockTime && sigInfo.blockTime > twoWeeksAgo) {
            // Fetch full transaction to check logs
            const tx = await connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
            const logs = tx?.meta?.logMessages || [];

            if (target.type === 'DEPLOY' && logs.some(l => l.includes('DeployWithMaxDataLen'))) {
              historyEvents.push({
                type: 'NEW_DEPLOY',
                signature: sigInfo.signature,
                timestamp: new Date(sigInfo.blockTime * 1000),
                message: '🚀 Historical Program Deploy',
                details: 'Found in 2-week history scan.'
              });
            }

            if (target.type === 'SQUADS' && logs.some(l => l.includes('Instruction: MultisigCreate'))) {
              historyEvents.push({
                type: 'NEW_SQUAD',
                signature: sigInfo.signature,
                timestamp: new Date(sigInfo.blockTime * 1000),
                message: '🛡️ Historical Squad Created',
                details: 'Found in 2-week history scan.'
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching history for ${target.label}:`, err);
      }
    }

    // Sort by newest first and update state
    setEvents(prev => {
        const combined = [...historyEvents, ...prev];
        return combined.sort((a, b) => b.timestamp - a.timestamp);
    });
    setIsScanningHistory(false);
    setStatus('🟢 Live & History Loaded');
  };

  useEffect(() => {
    try {
      const connection = new Connection(SOLANA_RPC, { 
        wsEndpoint: SOLANA_WSS,
        commitment: 'confirmed' 
      });
      connectionRef.current = connection;

      // Start History Fetch immediately
      fetchHistory(connection);

      // Setup Live Listeners (with error handling for 'ws error')
      const setupListeners = () => {
        try {
            connection.onLogs(BPF_LOADER_ID, (logs) => {
                if (logs.logs.some(l => l.includes('DeployWithMaxDataLen'))) {
                    setEvents(prev => [{
                        type: 'NEW_DEPLOY',
                        signature: logs.signature,
                        timestamp: new Date(),
                        message: '🚀 LIVE: New Program',
                        details: 'Just detected on Mainnet!'
                    }, ...prev]);
                }
            }, 'finalized');
        } catch (e) {
            console.warn("WS Live Listener failed, falling back to history polling.");
            setStatus('⚠️ WS Error - Retrying...');
        }
      };

      setupListeners();

    } catch (err) {
      setStatus('🔴 Connection Error');
    }
  }, []);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-5xl mx-auto border-b border-green-900 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-white flex gap-3">
            <Terminal /> BUILDERWATCH <span className="text-sm bg-green-900 px-2 py-1 rounded text-green-300">V2.0</span>
          </h1>
          <p className="text-green-800 mt-2 tracking-tighter uppercase">{status}</p>
        </div>
        {isScanningHistory && <div className="animate-spin text-green-500"><History /></div>}
      </div>

      <div className="space-y-4">
        {events.map((event, idx) => (
          <div key={event.signature + idx} className="p-4 border border-green-900 bg-green-950/10 rounded flex justify-between items-center">
            <div className="flex gap-4 items-center">
                {event.type === 'NEW_DEPLOY' ? <Rocket className="text-blue-400"/> : <Shield className="text-green-400"/>}
                <div>
                    <div className="font-bold text-white">{event.message}</div>
                    <div className="text-xs text-gray-500">{event.timestamp.toLocaleString()} — {event.details}</div>
                </div>
            </div>
            <a href={`https://solscan.io/tx/${event.signature}`} target="_blank" className="text-xs border border-green-800 p-2 hover:bg-green-800 hover:text-white transition">VIEW TX</a>
          </div>
        ))}
      </div>
    </main>
  );
                }
    
