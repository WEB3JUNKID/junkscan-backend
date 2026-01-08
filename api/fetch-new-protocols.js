const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

const CMC_API_KEY = process.env.CMC_API_KEY; // Your key, set in Vercel env vars
const CONFIG = { maxAgeDays: 30, minMarketCap: 10000 }; // Tweak as needed

router.get('/', async (req, res) => {
  try {
    const [cmcData, paprikaData] = await Promise.all([fetchCMC(), fetchPaprika()]);
    const combined = [...cmcData, ...paprikaData];

    // Dedupe by name/symbol (simple lowercase match)
    const unique = combined.filter((item, index, self) =>
      index === self.findIndex(t => t.title.toLowerCase() === item.title.toLowerCase())
    );

    // Sort by timestamp descending
    unique.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ signals: unique, count: unique.length });
  } catch (error) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

async function fetchCMC() {
  const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=200&sort=date_added&sort_dir=desc`;
  const response = await fetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY }
  });
  const json = await response.json();

  const cutoff = Date.now() - (CONFIG.maxAgeDays * 86400 * 1000);
  return json.data
    .filter(c => new Date(c.date_added).getTime() > cutoff && c.quote.USD.market_cap > CONFIG.minMarketCap)
    .filter(c => c.tags?.some(t => t.includes('defi') || t.includes('decentralized-finance')) || c.name.toLowerCase().includes('protocol') || c.platform?.name === 'Ethereum')
    .map(c => ({
      tag: 'PROTO',
      source: 'COINMARKETCAP',
      title: `\( {c.name} ( \){c.symbol})`,
      desc: `Added: ${c.date_added.slice(0,10)} • MC: \[ {fmt(c.quote.USD.market_cap || 0)} • Vol: \]{fmt(c.quote.USD.volume_24h || 0)}`,
      link: `https://coinmarketcap.com/currencies/${c.slug}/`,
      timestamp: new Date(c.date_added).getTime(),
      query: c.symbol
    }));
}

async function fetchPaprika() {
  const response = await fetch('https://api.coinpaprika.com/v1/coins');
  const coins = await response.json();

  return coins
    .filter(c => c.is_new && c.is_active)
    .map(c => ({
      tag: 'PROTO',
      source: 'COINPAPRIKA',
      title: `\( {c.name} ( \){c.symbol})`,
      desc: `Symbol: ${c.symbol} • Type: ${c.type} • Rank: ${c.rank || 'New'}`,
      link: `https://coinpaprika.com/coin/${c.id}/`,
      timestamp: Date.now(),
      query: c.symbol.toLowerCase()
    }));
}

function fmt(n) {
  if (n > 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n > 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

module.exports = router;
