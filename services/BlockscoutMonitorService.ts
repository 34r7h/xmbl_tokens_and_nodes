import axios from 'axios';
import { ethers } from 'ethers';

/**
 * @title BlockscoutMonitorService
 * @dev Monitors blockchain events and pushes data to Autoscout instance
 * Interfaces with Blockscout REST/RPC APIs for transparency
 */
export class BlockscoutMonitorService {
  private apiUrl: string;
  private rpcUrl: string;
  private autoscoutUrl: string;
  private monitoredContracts: Map<string, string>;
  private eventIndex: Map<string, any[]>;

  constructor(
    apiUrl: string,
    rpcUrl: string,
    autoscoutUrl: string
  ) {
    this.apiUrl = apiUrl;
    this.rpcUrl = rpcUrl;
    this.autoscoutUrl = autoscoutUrl;
    this.monitoredContracts = new Map();
    this.eventIndex = new Map();
  }

  /**
   * @dev Add contract to monitoring
   */
  addContract(chainId: number, contractAddress: string, contractName: string): void {
    const key = `${chainId}_${contractAddress}`;
    this.monitoredContracts.set(key, contractName);
    this.eventIndex.set(key, []);
    console.log(`Added contract ${contractName} at ${contractAddress} on chain ${chainId}`);
  }

  /**
   * @dev Remove contract from monitoring
   */
  removeContract(chainId: number, contractAddress: string): void {
    const key = `${chainId}_${contractAddress}`;
    this.monitoredContracts.delete(key);
    this.eventIndex.delete(key);
    console.log(`Removed contract ${contractAddress} from chain ${chainId}`);
  }

  /**
   * @dev Index events from Avail intents
   */
  async indexAvailEvents(chainId: number, contractAddress: string, events: any[]): Promise<void> {
    const key = `${chainId}_${contractAddress}`;
    
    if (!this.monitoredContracts.has(key)) {
      throw new Error(`Contract ${contractAddress} not monitored on chain ${chainId}`);
    }

    const existingEvents = this.eventIndex.get(key) || [];
    const newEvents = [...existingEvents, ...events];
    this.eventIndex.set(key, newEvents);

    console.log(`Indexed ${events.length} events for contract ${contractAddress}`);
  }

  /**
   * @dev Track deposit/activation transactions
   */
  async trackTransaction(txHash: string, chainId: number): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/transactions/${txHash}`);
      const txData = response.data;
      
      // Store transaction data
      const key = `tx_${chainId}_${txHash}`;
      this.eventIndex.set(key, [txData]);
      
      console.log(`Tracked transaction ${txHash} on chain ${chainId}`);
      return txData;
    } catch (error) {
      console.error(`Error tracking transaction ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * @dev Push data to Autoscout instance
   */
  async pushToAutoscout(data: any): Promise<void> {
    try {
      // Skip API calls if URLs are not configured
      if (!this.apiUrl || !this.autoscoutUrl) {
        console.log(`Skipping API push - URLs not configured`);
        return;
      }
      
      // Push to Blockscout API for indexing
      const blockscoutResponse = await axios.post(`${this.apiUrl}/api/v2/events`, {
        chainId: data.chainId,
        contractAddress: data.contractAddress,
        events: data.events,
        timestamp: new Date().toISOString()
      });
      
      // Push to Autoscout instance for monitoring
      const autoscoutResponse = await axios.post(`${this.autoscoutUrl}/api/events`, data);
      
      console.log(`Pushed data to Blockscout: ${blockscoutResponse.status}`);
      console.log(`Pushed data to Autoscout: ${autoscoutResponse.status}`);
    } catch (error) {
      console.error('Error pushing to Autoscout:', error);
      throw error;
    }
  }

  /**
   * @dev Get transaction details from Blockscout
   */
  async getTransactionDetails(txHash: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/transactions/${txHash}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * @dev Get contract events from Blockscout API
   */
  async fetchContractEventsFromAPI(contractAddress: string, chainId: number): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/contracts/${contractAddress}/logs`, {
        params: {
          chain_id: chainId
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching events for contract ${contractAddress}:`, error);
      throw error;
    }
  }

  /**
   * @dev Get address information
   */
  async getAddressInfo(address: string, chainId: number): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/addresses/${address}`, {
        params: {
          chain_id: chainId
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching address info for ${address}:`, error);
      throw error;
    }
  }

  /**
   * @dev Get token holdings for address
   */
  async getTokenHoldings(address: string, chainId: number): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/addresses/${address}/token-balances`, {
        params: {
          chain_id: chainId
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching token holdings for ${address}:`, error);
      throw error;
    }
  }

  /**
   * @dev Get monitoring status
   */
  getMonitoringStatus(): {
    monitoredContracts: number;
    totalEvents: number;
    chains: number[];
  } {
    const chains = new Set<number>();
    let totalEvents = 0;
    
    for (const [key, events] of this.eventIndex) {
      if (key.startsWith('tx_')) {
        const chainId = parseInt(key.split('_')[1]);
        chains.add(chainId);
      } else {
        const chainId = parseInt(key.split('_')[0]);
        chains.add(chainId);
        totalEvents += events.length;
      }
    }
    
    return {
      monitoredContracts: this.monitoredContracts.size,
      totalEvents,
      chains: Array.from(chains)
    };
  }

  /**
   * @dev Get events for specific contract
   */
  getContractEvents(chainId: number, contractAddress: string): any[] {
    const key = `${chainId}_${contractAddress}`;
    return this.eventIndex.get(key) || [];
  }

  /**
   * @dev Clear events for contract
   */
  clearContractEvents(chainId: number, contractAddress: string): void {
    const key = `${chainId}_${contractAddress}`;
    this.eventIndex.set(key, []);
    console.log(`Cleared events for contract ${contractAddress} on chain ${chainId}`);
  }

  /**
   * @dev Export all events
   */
  exportAllEvents(): any {
    const exportData = {
      timestamp: Date.now(),
      monitoredContracts: Array.from(this.monitoredContracts.entries()),
      events: Array.from(this.eventIndex.entries())
    };
    
    return exportData;
  }

  /**
   * @dev Get service configuration
   */
  getServiceConfig(): {
    apiUrl: string;
    rpcUrl: string;
    autoscoutUrl: string;
    monitoredContracts: number;
  } {
    return {
      apiUrl: this.apiUrl,
      rpcUrl: this.rpcUrl,
      autoscoutUrl: this.autoscoutUrl,
      monitoredContracts: this.monitoredContracts.size
    };
  }
}
