/**
 * @title Mock NexusSDK
 * @dev Mock implementation of Avail Nexus SDK for development
 * In production, this would be replaced with the actual @avail-project/nexus-core
 */

export interface NexusConfig {
  rpcUrl: string;
  chainId: number;
  apiKey?: string;
}

export interface Intent {
  id: string;
  chainId: number;
  depositId: number;
  user: string;
  amount: string;
  btcEquivalent: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: number;
}

export interface Allowance {
  token: string;
  spender: string;
  amount: string;
  chainId: number;
}

export class NexusSDK {
  private config: NexusConfig;
  private intentHook?: (intent: Intent) => Promise<boolean>;
  private allowanceHook?: (allowance: Allowance) => Promise<void>;
  private eventListeners: Map<string, Array<(data: any) => void>>;

  constructor(config: NexusConfig) {
    this.config = config;
    this.eventListeners = new Map();
  }

  /**
   * @dev Set intent hook for approval/denial
   */
  setOnIntentHook(hook: (intent: Intent) => Promise<boolean>): void {
    this.intentHook = hook;
  }

  /**
   * @dev Set allowance hook for token permissions
   */
  setOnAllowanceHook(hook: (allowance: Allowance) => Promise<void>): void {
    this.allowanceHook = hook;
  }

  /**
   * @dev Subscribe to nexus events
   */
  subscribe(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * @dev Emit event to all listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * @dev Create cross-chain intent
   */
  async createIntent(intent: Intent): Promise<string> {
    console.log('Creating intent:', intent);
    
    // Simulate intent processing
    setTimeout(() => {
      this.emit('EXPECTED_STEPS', {
        intentId: intent.id,
        steps: ['bridge', 'execute', 'settle']
      });
    }, 1000);

    setTimeout(() => {
      this.emit('STEP_COMPLETE', {
        intentId: intent.id,
        step: 'bridge',
        status: 'completed'
      });
    }, 2000);

    setTimeout(() => {
      this.emit('STEP_COMPLETE', {
        intentId: intent.id,
        step: 'execute',
        status: 'completed'
      });
    }, 3000);

    setTimeout(() => {
      this.emit('STEP_COMPLETE', {
        intentId: intent.id,
        step: 'settle',
        status: 'completed'
      });
    }, 4000);

    return intent.id;
  }

  /**
   * @dev Get intent status
   */
  async getIntentStatus(intentId: string): Promise<Intent | null> {
    // Mock implementation
    return null;
  }

  /**
   * @dev Cancel intent
   */
  async cancelIntent(intentId: string): Promise<boolean> {
    console.log('Cancelling intent:', intentId);
    this.emit('INTENT_FAILED', { intentId, reason: 'cancelled' });
    return true;
  }
}
