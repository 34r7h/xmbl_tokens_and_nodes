# XMBL Token Activation Dashboard

A live simulation dashboard for the XMBL cross-chain token activation platform. This dashboard provides real-time visualization of token activations, price changes, cost accounting, and BTC pool allocations.

## Features

### 🚀 Live Simulation
- **Real-time Updates**: Dashboard updates every 2 seconds with new data
- **Automatic Activations**: Random token activations based on realistic parameters
- **Price Algorithm**: Implements the golden ratio pricing formula `x / (Phi * y)`
- **Cost Accounting**: Tracks oracle costs, contract costs, and network fees
- **Pool Allocations**: Logarithmic curve for development vs liquidity pool splits

### 📊 Dashboard Components

#### Statistics Cards
- **Total Activations**: Number of completed token activations
- **Current Price**: Current XMBL token price in satoshis
- **Total BTC**: Total BTC in the system
- **Total Costs**: Cumulative costs in satoshis
- **Liquidity Pool %**: Percentage allocated to liquidity pool
- **Development Pool %**: Percentage allocated to development pool

#### Data Tables
- **Recent Activations**: Latest 10 token activations with user, amount, price, and status
- **Cost Breakdown**: Detailed cost analysis by type (oracle, contract, network fees)
- **BTC Pool Allocations**: Current pool distributions and percentages
- **Price History**: Historical price changes with increases and token minting

### 🎮 Interactive Controls
- **Start/Stop Simulation**: Control the live simulation
- **Add Activation**: Manually trigger a random activation
- **Clear Data**: Reset all simulation data
- **Real-time Status**: Live connection indicator

## Quick Start

### Option 1: Standalone HTML Dashboard
```bash
# Open the standalone dashboard
open dashboard/index.html
```

### Option 2: API-Powered Dashboard
```bash
# Install dependencies
cd dashboard
npm install

# Start the server
npm start

# Open the API dashboard
open http://localhost:3001/dashboard-api.html
```

## API Endpoints

The dashboard server provides the following REST API endpoints:

### State Management
- `GET /api/state` - Get current simulation state
- `POST /api/start` - Start the simulation
- `POST /api/stop` - Stop the simulation
- `POST /api/activate` - Add a random activation
- `POST /api/clear` - Clear all data

### Data Retrieval
- `GET /api/pools` - Get BTC pool allocations
- `GET /api/costs` - Get cost breakdown

## Simulation Algorithm

### Token Pricing
The dashboard implements the XMBL token economics:
- **Starting Price**: 1 satoshi
- **Formula**: `x / (Phi * y)` where:
  - `x` = Token Price
  - `y` = Tokens Minted
  - `Phi` = Golden Ratio (1.618...)
- **Price Updates**: Increases on activation, decreases on deactivation
- **Rounding**: All prices rounded up to nearest satoshi

### Cost Accounting
- **Oracle Costs**: 1,000 satoshis base cost
- **Contract Costs**: 2,000 satoshis base cost
- **Network Fees**: 3% of BTC amount (rounded up)
- **Net BTC**: Only net BTC (after costs) counts towards activation

### Pool Allocation
- **Logarithmic Curve**: Uses exponential decay formula
- **Starting**: 10% liquidity, 90% development
- **Target**: 95% liquidity at 100 BTC in system
- **Formula**: `min + (max - min) * (1 - e^(-k * btcAmount))`

## Technical Implementation

### Frontend
- **Pure HTML/CSS/JavaScript**: No frameworks required
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Automatic data refresh
- **Interactive UI**: Smooth animations and transitions

### Backend
- **Express.js**: REST API server
- **CORS Enabled**: Cross-origin requests supported
- **State Management**: In-memory simulation state
- **Error Handling**: Comprehensive error responses

### Data Flow
1. **User Interaction** → API Call
2. **Server Processing** → State Update
3. **Data Response** → Frontend Update
4. **UI Refresh** → Visual Update

## Customization

### Styling
The dashboard uses CSS custom properties for easy theming:
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #38a169;
  --error-color: #e53e3e;
}
```

### Simulation Parameters
Modify the simulation behavior in `server.js`:
```javascript
const ORACLE_COST = 1000;        // Base oracle cost
const CONTRACT_COST = 2000;      // Base contract cost
const NETWORK_FEE_PERCENT = 3;   // Network fee percentage
```

### Update Frequency
Change the update interval in the frontend:
```javascript
updateInterval = setInterval(updateDashboard, 2000); // 2 seconds
```

## Browser Support

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start with auto-reload
npm run dev

# Start production server
npm start
```

### API Testing
```bash
# Test API endpoints
curl http://localhost:3001/api/state
curl -X POST http://localhost:3001/api/start
curl -X POST http://localhost:3001/api/activate
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Simulation    │
│   Dashboard     │◄──►│   API Server    │◄──►│   Engine        │
│   (HTML/JS)     │    │   (Express)     │    │   (State Mgmt)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Performance

- **Update Frequency**: 2 seconds
- **Data Retention**: Last 50 activations
- **Memory Usage**: ~1MB for full simulation
- **CPU Usage**: Minimal (single-threaded)

## Security

- **CORS**: Configured for localhost development
- **Input Validation**: Server-side validation
- **Error Handling**: Graceful error responses
- **No Persistence**: In-memory only (resets on restart)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the API documentation
- Review the simulation algorithm
- Test with the standalone HTML version
