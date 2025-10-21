const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Global state for simulation
let simulationState = {
    running: false,
    activations: [],
    currentPrice: 1,
    totalBtcInSystem: 0,
    totalCosts: 0,
    costs: {
        oracle: 0,
        contract: 0,
        network: 0,
        total: 0
    },
    priceHistory: [],
    activationId: 1
};

// Constants
const PHI = 1.618033988749895;
const ORACLE_COST = 1000;
const CONTRACT_COST = 2000;
const NETWORK_FEE_PERCENT = 3;

// Calculate liquidity percentage using logarithmic curve
function calculateLiquidityPercentage(btcAmount) {
    const minLiquidity = 10;
    const maxLiquidity = 95;
    const targetBTC = 100;

    if (btcAmount >= targetBTC) return maxLiquidity;

    const k = -Math.log(0.1) / targetBTC;
    const curveValue = 1 - Math.exp(-k * btcAmount);
    const percentage = minLiquidity + (maxLiquidity - minLiquidity) * curveValue;

    return Math.min(Math.max(percentage, minLiquidity), maxLiquidity);
}

// Generate random user address
function generateUserAddress() {
    const users = [
        '0x1234...5678', '0x2345...6789', '0x3456...7890',
        '0x4567...8901', '0x5678...9012', '0x6789...0123',
        '0x7890...1234', '0x8901...2345', '0x9012...3456',
        '0x0123...4567', '0x1357...2468', '0x2468...1357'
    ];
    return users[Math.floor(Math.random() * users.length)];
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get current simulation state
app.get('/api/state', (req, res) => {
    const liquidityPercentage = calculateLiquidityPercentage(simulationState.totalBtcInSystem);
    const developmentPercentage = 100 - liquidityPercentage;

    res.json({
        running: simulationState.running,
        totalActivations: simulationState.activations.length,
        currentPrice: simulationState.currentPrice,
        totalBtc: simulationState.totalBtcInSystem,
        totalCosts: simulationState.totalCosts,
        liquidityPool: liquidityPercentage,
        developmentPool: developmentPercentage,
        activations: simulationState.activations.slice(0, 10),
        costs: simulationState.costs,
        priceHistory: simulationState.priceHistory.slice(0, 10)
    });
});

// Start simulation
app.post('/api/start', (req, res) => {
    simulationState.running = true;
    res.json({ message: 'Simulation started', running: true });
});

// Stop simulation
app.post('/api/stop', (req, res) => {
    simulationState.running = false;
    res.json({ message: 'Simulation stopped', running: false });
});

// Add random activation
app.post('/api/activate', (req, res) => {
    const btcAmount = Math.random() * 10 + 0.1; // 0.1 to 10.1 BTC
    const btcAmountSats = Math.floor(btcAmount * 1e8);

    // Calculate costs
    const oracleCost = ORACLE_COST;
    const contractCost = CONTRACT_COST;
    const networkFee = Math.ceil((btcAmountSats * NETWORK_FEE_PERCENT) / 100);
    const totalCost = oracleCost + contractCost + networkFee;
    const netBtc = btcAmountSats - totalCost;

    if (netBtc <= 0) {
        return res.status(400).json({ error: 'Insufficient BTC after costs' });
    }

// Calculate new price using golden ratio formula
// Price increases as more tokens are activated (inverse of the original formula)
const tokensMinted = Math.floor(netBtc / simulationState.currentPrice);
const newPrice = Math.ceil(simulationState.currentPrice * (1 + (tokensMinted / (PHI * 1000))));
    const priceIncrease = newPrice - simulationState.currentPrice;

    // Create activation
    const activation = {
        id: simulationState.activationId++,
        user: generateUserAddress(),
        btcAmount: btcAmount,
        btcAmountSats: btcAmountSats,
        netBtc: netBtc,
        costs: totalCost,
        price: simulationState.currentPrice,
        newPrice: newPrice,
        tokensMinted: tokensMinted,
        status: 'active',
        timestamp: new Date().toISOString()
    };

    // Update system state
    simulationState.currentPrice = newPrice;
    simulationState.totalBtcInSystem += netBtc / 1e8;
    simulationState.totalCosts += totalCost;
    simulationState.costs.oracle += oracleCost;
    simulationState.costs.contract += contractCost;
    simulationState.costs.network += networkFee;
    simulationState.costs.total += totalCost;

    // Add to arrays
    simulationState.activations.unshift(activation);
    simulationState.priceHistory.unshift({
        activation: simulationState.activationId - 1,
        previousPrice: simulationState.currentPrice - priceIncrease,
        newPrice: simulationState.currentPrice,
        increase: priceIncrease,
        tokensMinted: tokensMinted,
        timestamp: new Date().toISOString()
    });

    // Keep only last 50 activations and price history
    if (simulationState.activations.length > 50) simulationState.activations.pop();
    if (simulationState.priceHistory.length > 50) simulationState.priceHistory.pop();

    res.json({
        message: `Activation ${activation.id} added`,
        activation: activation
    });
});

// Clear all data
app.post('/api/clear', (req, res) => {
    simulationState.activations = [];
    simulationState.priceHistory = [];
    simulationState.activationId = 1;
    simulationState.currentPrice = 1;
    simulationState.totalBtcInSystem = 0;
    simulationState.totalCosts = 0;
    simulationState.costs = { oracle: 0, contract: 0, network: 0, total: 0 };

    res.json({ message: 'All data cleared' });
});

// Get pool allocations
app.get('/api/pools', (req, res) => {
    const liquidityPercentage = calculateLiquidityPercentage(simulationState.totalBtcInSystem);
    const developmentPercentage = 100 - liquidityPercentage;

    const liquidityBtc = (simulationState.totalBtcInSystem * liquidityPercentage) / 100;
    const developmentBtc = (simulationState.totalBtcInSystem * developmentPercentage) / 100;

    res.json({
        liquidity: {
            percentage: liquidityPercentage,
            btcAmount: liquidityBtc,
            allocation: `${liquidityBtc.toFixed(8)} BTC`
        },
        development: {
            percentage: developmentPercentage,
            btcAmount: developmentBtc,
            allocation: `${developmentBtc.toFixed(8)} BTC`
        },
        total: simulationState.totalBtcInSystem
    });
});

// Get cost breakdown
app.get('/api/costs', (req, res) => {
    const costTypes = [
        { type: 'Oracle Costs', amount: simulationState.costs.oracle, percentage: ((simulationState.costs.oracle / simulationState.costs.total) * 100).toFixed(2) },
        { type: 'Contract Costs', amount: simulationState.costs.contract, percentage: ((simulationState.costs.contract / simulationState.costs.total) * 100).toFixed(2) },
        { type: 'Network Fees', amount: simulationState.costs.network, percentage: ((simulationState.costs.network / simulationState.costs.total) * 100).toFixed(2) },
        { type: 'Total Costs', amount: simulationState.costs.total, percentage: '100.00' }
    ];

    res.json({ costs: costTypes });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 XMBL Dashboard Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔗 API endpoints:`);
    console.log(`   GET  /api/state - Get current simulation state`);
    console.log(`   POST /api/start - Start simulation`);
    console.log(`   POST /api/stop - Stop simulation`);
    console.log(`   POST /api/activate - Add random activation`);
    console.log(`   POST /api/clear - Clear all data`);
    console.log(`   GET  /api/pools - Get pool allocations`);
    console.log(`   GET  /api/costs - Get cost breakdown`);
});

module.exports = app;
