import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    if (isOpen && !scannerRef.current) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = () => {
    try {
      const scanner = new Html5QrcodeScanner(
        'barcode-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778,
          formatsToSupport: [
            // Barcode formats
            0,  // QR_CODE
            5,  // CODE_128
            6,  // CODE_39
            7,  // CODE_93
            8,  // EAN_8
            9,  // EAN_13
            10, // UPC_A
            11, // UPC_E
          ]
        },
        false
      );

      scanner.render(onScanSuccess, onScanError);
      scannerRef.current = scanner;
      setScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
        scannerRef.current = null;
        setScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const onScanSuccess = (decodedText, decodedResult) => {
    console.log('Barcode detected:', decodedText);
    setLastScanned(decodedText);
    
    // Call the parent callback with scanned code
    if (onScan) {
      onScan(decodedText);
    }
    
    // Auto-close after successful scan
    setTimeout(() => {
      handleClose();
    }, 500);
  };

  const onScanError = (errorMessage) => {
    // Ignore continuous scan errors (they're normal)
    // console.log('Scan error:', errorMessage);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription>
            Position the barcode in front of your camera. It will be detected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner Container */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <div id="barcode-reader" className="w-full"></div>
          </div>

          {/* Last Scanned Code */}
          {lastScanned && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="text-sm text-green-800">
                <span className="font-medium">Last Scanned:</span> {lastScanned}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">📸 Tips for better scanning:</div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Hold the barcode steady in front of camera</li>
                <li>Ensure good lighting</li>
                <li>Keep the barcode within the scanning box</li>
                <li>Supports: QR codes, EAN, UPC, Code-128, Code-39</li>
              </ul>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Close Scanner
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
