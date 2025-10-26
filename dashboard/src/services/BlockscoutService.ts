import axios from 'axios';

export class BlockscoutService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async checkApiStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/api?module=stats&action=ethsupply`);
      return response.status === 200 && response.data.status === '1';
    } catch (error) {
      console.error('Error checking Blockscout API status:', error);
      return false;
    }
  }

  async getAddressInfo(address: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api?module=account&action=balance&address=${address}`);
      if (response.data.status === '1') {
        return response.data.result;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(`Error fetching info for address ${address}:`, error);
      throw error;
    }
  }

  async getTransactionInfo(txHash: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api?module=transaction&action=gettxinfo&txhash=${txHash}`);
      if (response.data.status === '1') {
        return response.data.result;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(`Error fetching transaction ${txHash}:`, error);
      throw error;
    }
  }

  async getContractInfo(address: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api?module=contract&action=getsourcecode&address=${address}`);
      if (response.data.status === '1') {
        return response.data.result[0];
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(`Error fetching contract info for ${address}:`, error);
      throw error;
    }
  }
}