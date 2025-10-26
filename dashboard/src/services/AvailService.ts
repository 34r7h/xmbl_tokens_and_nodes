import { ethers, Signer } from 'ethers';
import { NexusSDK } from '@avail-project/nexus-core';

export class AvailService {
  private nexus: NexusSDK;
  private rpcUrl: string;
  private chainId: string;
  private signer: Signer | null;

  constructor(rpcUrl: string, chainId: string, signer: Signer | null) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.signer = signer;
    this.nexus = new NexusSDK({
      network: 'testnet',
      rpcUrl: this.rpcUrl,
      wsUrl: 'wss://nexus-ws.avail.tools',
    });
  }

  async initializeNexus(): Promise<boolean> {
    try {
      // Test connection to Avail RPC
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonrpc: '2.0', 
          method: 'eth_chainId', 
          params: [], 
          id: 1 
        })
      });
      
      if (response.ok) {
        console.log('Avail Nexus SDK initialized successfully');
        return true;
      }
      throw new Error('Failed to connect to Avail RPC');
    } catch (error) {
      console.error('Avail initialization failed:', error);
      throw error;
    }
  }

  async createIntent(
    sourceChainId: number,
    destinationChainId: number,
    sender: string,
    amount: string,
    asset: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not connected for Avail intent creation.');
    }

    try {
      // Create cross-chain intent using Avail Nexus SDK
      const intentData = {
        sourceChain: sourceChainId,
        destinationChain: destinationChainId,
        sender,
        amount,
        asset,
        timestamp: Date.now()
      };

      // Use Avail SDK to create intent
      const intentId = await this.nexus.createIntent(intentData);
      console.log(`Avail Intent Created: ${intentId}`);
      return intentId;
    } catch (error) {
      console.error('Failed to create Avail intent:', error);
      throw error;
    }
  }

  async processIntent(intentId: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      // Process the intent using Avail SDK
      const result = await this.nexus.processIntent(intentId);
      
      if (result.success) {
        console.log(`Intent ${intentId} processed successfully: ${result.transactionHash}`);
        return {
          success: true,
          transactionHash: result.transactionHash
        };
      } else {
        throw new Error(result.error || 'Intent processing failed');
      }
    } catch (error) {
      console.error(`Failed to process intent ${intentId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}