// Global ethers setup for browser compatibility
import { ethers } from 'ethers';

// Make ethers available globally for browser usage
declare global {
  interface Window {
    ethers: typeof ethers;
  }
}

// Set up global ethers
if (typeof window !== 'undefined') {
  window.ethers = ethers;
}

export default ethers;
