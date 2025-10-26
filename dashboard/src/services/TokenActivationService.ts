import { ethers, Signer, Provider } from 'ethers';
import DepositManagerABI from '../../../artifacts/contracts/DepositManager.sol/DepositManager.json';
import ChainDepositContractABI from '../../../artifacts/contracts/ChainDepositContract.sol/ChainDepositContract.json';
import PriceOracleABI from '../../../artifacts/contracts/PriceOracle.sol/PriceOracle.json';

interface ChainContractAddresses {
  [chainName: string]: string;
}

export class TokenActivationService {
  private provider: Provider;
  private signer: Signer | null;
  private depositManagerAddress: string;
  private priceOracleAddress: string;
  private chainDepositContracts: ChainContractAddresses;
  private depositManagerContract: ethers.Contract | null;
  private priceOracleContract: ethers.Contract | null;

  constructor(
    provider: Provider,
    signer: Signer | null,
    depositManagerAddress: string,
    priceOracleAddress: string,
    chainDepositContracts: ChainContractAddresses
  ) {
    this.provider = provider;
    this.signer = signer;
    this.depositManagerAddress = depositManagerAddress;
    this.priceOracleAddress = priceOracleAddress;
    this.chainDepositContracts = chainDepositContracts;

    this.depositManagerContract = signer ? new ethers.Contract(this.depositManagerAddress, DepositManagerABI.abi, signer) : null;
    this.priceOracleContract = signer ? new ethers.Contract(this.priceOracleAddress, PriceOracleABI.abi, signer) : null;
  }

  private getChainDepositContract(chainName: string): ethers.Contract | null {
    const address = this.chainDepositContracts[chainName];
    if (!address) {
      throw new Error(`ChainDepositContract address not found for chain: ${chainName}`);
    }
    return this.signer ? new ethers.Contract(address, ChainDepositContractABI.abi, this.signer) : null;
  }

  async activateToken(chainName: string, userAddress: string, amount: number): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your wallet.');
    }

    const chainDepositContract = this.getChainDepositContract(chainName);
    if (!chainDepositContract) {
      throw new Error(`ChainDepositContract not initialized for ${chainName}.`);
    }

    try {
      const amountWei = ethers.parseEther(amount.toString());

      console.log(`Initiating deposit for ${amount} ETH on ${chainName} via ${chainDepositContract.target}`);

      // Send ETH to the chain deposit contract
      const tx = await chainDepositContract.deposit({ value: amountWei });
      await tx.wait();
      console.log(`Deposit transaction successful: ${tx.hash}`);

      return tx;
    } catch (error) {
      console.error(`Error activating token on ${chainName}:`, error);
      throw error;
    }
  }

  async getXMBLPrice(): Promise<bigint> {
    if (!this.priceOracleContract) {
      throw new Error('PriceOracle contract not initialized.');
    }
    
    try {
      const price = await this.priceOracleContract.getCurrentPrice();
      return price;
    } catch (error) {
      console.error('Error fetching XMBL price from PriceOracle:', error);
      throw error;
    }
  }

  async updateOraclePrice(newPrice: bigint): Promise<ethers.TransactionResponse> {
    if (!this.signer || !this.priceOracleContract) {
      throw new Error('Signer or PriceOracle contract not initialized.');
    }

    try {
      const tx = await this.priceOracleContract.updatePrice(newPrice);
      await tx.wait();
      console.log('Oracle price updated:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error updating oracle price:', error);
      throw error;
    }
  }
}