'use client';
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Shield, Rocket, ExternalLink, Terminal, Activity, Wifi } from 'lucide-react';

// --- CONFIGURATION ---
// Use a public RPC for the demo. 
// If it hits rate limits, you can swap this URL later in Acode.
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SOLANA_WSS = 'wss://api.mainnet-beta.solana.com';

const BPF_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const SQUADS_V4_ID = new PublicKey('SMPLecH2AezpSws9asubG7v6gde66S5S6p7J93rAnp7');

export default function Home() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Initializing...');
  const [logCount, setLogCount] = useState(0);
  
  // Refs to prevent duplicate listeners in React Strict Mode
  const connectionRef = useRef(null);
  const subscriptionIds = useRef([]);

  useEffect(() => {
    // 1. Setup Connection
    const connection = new Connection(SOLANA_RPC, { wsEndpoint: SOLANA_WSS });
    connectionRef.current = connection;
    setStatus('🟢 Scanning Mainnet...');

    // 2. Define the Handler Logic
    const handleLog = (logs, type) => {
      setLogCount(prev => prev + 1); // Visual heartbeat

      const signature = logs.signature;
      const logMessages = logs.logs || [];

      let newEvent = null;

      // CHECK: New Deployments
      if (type === 'DEPLOY' && logMessages.some(l => l.includes('DeployWithMaxDataLen'))) {
        newEvent = {
          type: 'NEW_DEPLOY',
          signature,
          timestamp: new Date(),
          message: '🚀 New Program Deployed',
          details: 'New Smart Contract detected on BPF Loader.'
        };
      }

      // CHECK: Squads Creation
      if (type === 'SQUADS' && logMessages.some(l => l.includes('Instruction: MultisigCreate'))) {
        newEvent = {
          type: 'NEW_SQUAD',
          signature,
          timestamp: new Date(),
          message: '🛡️ New Squad (DAO) Created',
          details: 'A new Treasury Multisig was initialized.'
        };
      }

      // If we found something, add it to the list
      if (newEvent) {
        setEvents(prev => [newEvent, ...prev]);
      }
    };

    // 3. Start Listening (Real-time Websockets)
    console.log("Starting listeners...");
    
    // Listen to BPF Loader
    const subId1 = connection.onLogs(
      BPF_LOADER_ID,
      (logs) => handleLog(logs, 'DEPLOY'),
      'finalized'
    );

    // Listen to Squads
    const subId2 = connection.onLogs(
      SQUADS_V4_ID,
      (logs) => handleLog(logs, 'SQUADS'),
      'confirmed'
    );

    subscriptionIds.current = [subId1, subId2];

    // Cleanup when you close the tab
    return () => {
      if (connectionRef.current) {
        subscriptionIds.current.forEach(id => connectionRef.current.removeOnLogsListener(id));
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-8">
      {/* HEADER */}
      <div className="max-w-5xl mx-auto border-b border-green-900 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3 text-white">
            <Terminal className="w-8 h-8 text-green-500" />
            BUILDER<span className="text-green-500">WATCH</span>
          </h1>
          <p className="text-green-800 mt-2 text-sm uppercase tracking-widest">
            Client-Side Mainnet Scanner
          </p>
        </div>
        
        <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-sm font-bold text-green-400 mb-1">
                <Wifi size={16} className={status.includes('Scanning') ? "animate-pulse" : ""} />
                {status}
            </div>
            <div className="text-xs text-green-800">
                Processed Logs: {logCount}
            </div>
        </div>
      </div>

      {/* FEED */}
      <div className="max-w-5xl mx-auto space-y-4">
        {events.length === 0 ? (
           <div className="text-center py-20 border border-dashed border-green-900 rounded-lg opacity-50">
             <Activity className="mx-auto mb-4 w-10 h-10 animate-bounce" />
             <p className="text-lg">Listening for on-chain events...</p>
             <p className="text-sm text-green-800 mt-2">
                (Keep this tab open. New deployments appear here in real-time)
             </p>
           </div>
        ) : (
          events.map((event, idx) => (
            <div 
              key={`${event.signature}-${idx}`} 
              className={`
                p-5 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between 
                transition-all duration-500 animate-in fade-in slide-in-from-top-2
                ${event.type === 'NEW_DEPLOY' 
                  ? 'border-blue-900/50 bg-blue-950/20 shadow-[0_0_15px_rgba(30,58,138,0.2)]' 
                  : 'border-green-900/50 bg-green-950/20'
                }
              `}
            >
              <div className="flex items-center gap-5 mb-4 md:mb-0">
                <div className={`p-3 rounded-md ${
                    event.type === 'NEW_DEPLOY' ? 'bg-blue-900/40 text-blue-400' : 'bg-green-900/40 text-green-400'
                }`}>
                  {event.type === 'NEW_DEPLOY' ? <Rocket size={24} /> : <Shield size={24} />}
                </div>
                
                <div>
                  <h3 className={`text-lg font-bold mb-1 ${
                      event.type === 'NEW_DEPLOY' ? 'text-blue-100' : 'text-green-100'
                  }`}>
                    {event.message}
                  </h3>
                  <div className="flex gap-3 text-xs md:text-sm text-gray-500 font-sans">
                     <span className="text-gray-400">{event.timestamp.toLocaleTimeString()}</span>
                     <span className="text-gray-700">|</span>
                     <span>{event.details}</span>
                  </div>
                </div>
              </div>

              <a 
                href={`https://solscan.io/tx/${event.signature}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded border border-gray-800 hover:border-green-500 hover:text-white text-gray-400 transition-colors text-sm"
              >
                View TX <ExternalLink size={14} />
              </a>
            </div>
          ))
        )}
      </div>
    </main>
  );
    }
        
