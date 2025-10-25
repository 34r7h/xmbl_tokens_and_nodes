import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  activationData: {
    chainId: number;
    amount: string;
    contractAddress: string;
    currentPrice: string;
    activationCost: string;
  };
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ activationData }) => {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [mobileUrl, setMobileUrl] = useState<string>('');

  useEffect(() => {
    generateQRCode();
  }, [activationData]);

  const generateQRCode = async () => {
    try {
      // Create mobile-friendly activation URL
      const baseUrl = window.location.origin;
      const mobileUrl = `${baseUrl}/mobile-activate?` + new URLSearchParams({
        chainId: activationData.chainId.toString(),
        amount: activationData.amount,
        contractAddress: activationData.contractAddress,
        currentPrice: activationData.currentPrice,
        activationCost: activationData.activationCost,
        timestamp: Date.now().toString()
      }).toString();

      setMobileUrl(mobileUrl);

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(mobileUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(qrCodeDataURL);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      alert('Mobile activation link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  return (
    <div className="qr-code-generator">
      <h3>📱 Mobile Activation</h3>
      <p>Scan this QR code with your phone to activate tokens on mobile:</p>
      
      <div className="qr-code-container">
        {qrCodeDataURL ? (
          <img 
            src={qrCodeDataURL} 
            alt="Mobile Activation QR Code" 
            className="qr-code-image"
          />
        ) : (
          <div className="qr-code-loading">Generating QR code...</div>
        )}
      </div>

      <div className="mobile-info">
        <h4>📋 Activation Details:</h4>
        <div className="activation-details">
          <div><strong>Chain:</strong> {activationData.chainId}</div>
          <div><strong>Amount:</strong> {activationData.amount} XMBL</div>
          <div><strong>Price:</strong> {activationData.currentPrice} BTC per token</div>
          <div><strong>Cost:</strong> {activationData.activationCost} ETH</div>
        </div>
      </div>

      <div className="mobile-actions">
        <button onClick={copyToClipboard} className="copy-link-btn">
          📋 Copy Mobile Link
        </button>
        <a 
          href={mobileUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="open-mobile-btn"
        >
          📱 Open on Mobile
        </a>
      </div>

      <div className="mobile-instructions">
        <h4>📖 How to use:</h4>
        <ol>
          <li>Open your mobile wallet (MetaMask, Trust Wallet, etc.)</li>
          <li>Scan the QR code above</li>
          <li>Review the activation details</li>
          <li>Connect your wallet and confirm the transaction</li>
          <li>Wait for transaction confirmation</li>
        </ol>
      </div>
    </div>
  );
};
