#!/usr/bin/env ts-node

/**
 * Lightning Network Deposit Handler
 * Integrates with Lightning Network payment processors for BTC deposits
 * Converts Lightning payments to Stacks contract minting
 */

import axios from 'axios';
import { TransactionVersion, broadcastTransaction, makeContractCall, AnchorMode, PostConditionMode, getAddressFromPrivateKey, StacksNetwork, StacksTestnet, StacksMainnet } from '@stacks/transactions';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface LightningConfig {
  apiUrl: string;
  apiKey?: string;
  webhookSecret: string;
  network: 'mainnet' | 'testnet';
}

interface InvoiceRequest {
  amount: number; // Amount in satoshis
  memo?: string;
  recipient: string; // Stacks address that will receive the NFT
}

interface InvoiceResponse {
  paymentRequest: string; // BOLT11 invoice
  paymentHash: string;
  expiresAt: number;
}

class LightningDepositService {
  private config: LightningConfig;
  private stacksNetwork: StacksNetwork;
  private contractAddress: string;
  private privateKey: string;
  private pendingInvoices: Map<string, InvoiceRequest> = new Map();

  constructor(config: LightningConfig, stacksNetwork: StacksNetwork, contractAddress: string, privateKey: string) {
    this.config = config;
    this.stacksNetwork = stacksNetwork;
    this.contractAddress = contractAddress;
    this.privateKey = privateKey;
  }

  /**
   * Create Lightning Network invoice for payment
   */
  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    try {
      // For BTCPay Server integration
      const response = await axios.post(
        `${this.config.apiUrl}/api/v1/invoices`,
        {
          amount: request.amount,
          currency: 'BTC',
          metadata: {
            recipient: request.recipient,
            memo: request.memo || `XMBL Token Mint - ${request.recipient}`
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `token ${this.config.apiKey}` })
          }
        }
      );

      const invoice = response.data;
      const paymentHash = invoice.id || createHash('sha256').update(invoice.bolt11).digest('hex');

      // Store pending invoice
      this.pendingInvoices.set(paymentHash, request);

      return {
        paymentRequest: invoice.bolt11 || invoice.paymentRequest,
        paymentHash,
        expiresAt: invoice.expiresAt || Date.now() + 3600000 // 1 hour default
      };
    } catch (error) {
      console.error('Error creating Lightning invoice:', error);
      throw error;
    }
  }

  /**
   * Handle webhook from Lightning Network payment processor
   * Called when a payment is received
   */
  async handlePaymentWebhook(webhookData: any): Promise<void> {
    try {
      // Verify webhook signature if provided
      if (this.config.webhookSecret) {
        const signature = webhookData.signature || webhookData.headers?.['btcpay-signature'];
        if (!this.verifyWebhookSignature(webhookData, signature)) {
          throw new Error('Invalid webhook signature');
        }
      }

      const paymentHash = webhookData.id || webhookData.paymentHash || webhookData.invoice?.id;
      const invoice = this.pendingInvoices.get(paymentHash);

      if (!invoice) {
        console.warn(`Unknown payment hash: ${paymentHash}`);
        return;
      }

      // Payment confirmed, mint NFT on Stacks
      await this.mintNFT(invoice.recipient, webhookData.amount || invoice.amount);

      // Remove from pending
      this.pendingInvoices.delete(paymentHash);
    } catch (error) {
      console.error('Error handling payment webhook:', error);
      throw error;
    }
  }

  /**
   * Mint NFT on Stacks contract after Lightning payment
   */
  private async mintNFT(recipient: string, amountSats: number): Promise<string> {
    try {
      const address = getAddressFromPrivateKey(this.privateKey, this.stacksNetwork.version);
      
      // Get current price from contract (would need contract call)
      // For now, we'll pass the amount as payment
      const amountMicrostacks = amountSats; // 1 sat = 1 microstack for simplicity

      const txOptions = {
        contractAddress: this.contractAddress,
        contractName: 'xmbl-token',
        functionName: 'mint',
        functionArgs: [
          recipient,
          amountMicrostacks
        ],
        senderKey: this.privateKey,
        network: this.stacksNetwork,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 1000, // Minimum fee
      };

      const transaction = await makeContractCall(txOptions);
      const broadcastResponse = await broadcastTransaction(transaction, this.stacksNetwork);

      console.log(`Minted NFT for ${recipient}, tx: ${broadcastResponse.txid}`);
      return broadcastResponse.txid;
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(data: any, signature: string): boolean {
    // Implementation depends on payment processor
    // BTCPay Server uses HMAC-SHA256
    if (!signature) return false;
    
    const hmac = createHash('sha256')
      .update(this.config.webhookSecret)
      .update(JSON.stringify(data))
      .digest('hex');
    
    return hmac === signature;
  }

  /**
   * Start webhook server
   */
  startWebhookServer(port: number = 3000): void {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    app.post('/webhook/lightning', async (req, res) => {
      try {
        await this.handlePaymentWebhook(req.body);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });
    
    app.listen(port, () => {
      console.log(`Lightning webhook server listening on port ${port}`);
    });
  }
}

// Export for use in other scripts
export { LightningDepositService, InvoiceRequest, InvoiceResponse, LightningConfig };

// CLI usage
if (require.main === module) {
  const configPath = path.join(__dirname, '../config/lightning.json');
  const stacksConfigPath = path.join(__dirname, '../config/stacks.json');
  
  if (!fs.existsSync(configPath) || !fs.existsSync(stacksConfigPath)) {
    console.error('Configuration files not found. Please create config/lightning.json and config/stacks.json');
    process.exit(1);
  }
  
  const lightningConfig: LightningConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const stacksConfig = JSON.parse(fs.readFileSync(stacksConfigPath, 'utf-8'));
  
  const network = lightningConfig.network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
  const service = new LightningDepositService(
    lightningConfig,
    network,
    stacksConfig.contractAddress,
    process.env.PRIVATE_KEY || stacksConfig.privateKey
  );
  
  service.startWebhookServer(parseInt(process.env.WEBHOOK_PORT || '3000'));
}

