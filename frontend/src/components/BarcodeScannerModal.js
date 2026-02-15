import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, X, Keyboard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// USB Barcode Scanner Hook - Detects fast keyboard input from barcode scanners
export function useUSBBarcodeScanner(onScan, enabled = true) {
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      // Scanner types very fast (< 50ms between chars)
      // Human typing is slower (> 100ms between chars)
      if (timeDiff > 100) {
        // Reset buffer if too slow (human typing)
        barcodeBuffer.current = '';
      }
      
      lastKeyTime.current = currentTime;
      
      // Enter key signals end of barcode
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          // Valid barcode scanned
          onScan(barcodeBuffer.current);
        }
        barcodeBuffer.current = '';
        return;
      }
      
      // Only accept printable characters
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        
        // Clear buffer after 200ms of no input
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          barcodeBuffer.current = '';
        }, 200);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(timeoutRef.current);
    };
  }, [onScan, enabled]);
}

// Combined Barcode Scanner Modal (Camera + Manual Entry)
export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [scanStatus, setScanStatus] = useState(null); // 'success', 'error', null
  const [mode, setMode] = useState('camera'); // 'camera', 'manual'

  useEffect(() => {
    if (isOpen && mode === 'camera' && !scannerRef.current) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, mode]);

  const startScanner = useCallback(() => {
    try {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const scannerElement = document.getElementById('barcode-reader');
        if (!scannerElement) {
          console.error('Scanner element not found');
          return;
        }

        const scanner = new Html5QrcodeScanner(
          'barcode-reader',
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.777778,
            formatsToSupport: [
              0,  // QR_CODE
              5,  // CODE_128
              6,  // CODE_39
              7,  // CODE_93
              8,  // EAN_8
              9,  // EAN_13
              10, // UPC_A
              11, // UPC_E
            ],
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true
          },
          false
        );

        scanner.render(onScanSuccess, onScanError);
        scannerRef.current = scanner;
        setScanning(true);
      }, 100);
    } catch (err) {
      console.error('Error starting scanner:', err);
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
        scannerRef.current = null;
        setScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  }, []);

  const onScanSuccess = (decodedText, decodedResult) => {
    console.log('Barcode detected:', decodedText);
    setLastScanned(decodedText);
    setScanStatus('success');
    
    // Call the parent callback
    if (onScan) {
      onScan(decodedText);
    }
    
    // Auto-close after successful scan
    setTimeout(() => {
      handleClose();
    }, 800);
  };

  const onScanError = (errorMessage) => {
    // Ignore continuous scan errors
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim().length >= 3) {
      setLastScanned(manualBarcode.trim());
      setScanStatus('success');
      
      if (onScan) {
        onScan(manualBarcode.trim());
      }
      
      setTimeout(() => {
        handleClose();
      }, 500);
    }
  };

  const handleClose = () => {
    stopScanner();
    setManualBarcode('');
    setLastScanned('');
    setScanStatus(null);
    onClose();
  };

  const switchMode = (newMode) => {
    if (mode === 'camera') {
      stopScanner();
    }
    setMode(newMode);
    if (newMode === 'camera') {
      setTimeout(startScanner, 100);
    }
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
            Scan using camera or enter barcode manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => switchMode('camera')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'camera' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              Camera Scan
            </button>
            <button
              onClick={() => switchMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'manual' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              Manual Entry
            </button>
          </div>

          {/* Camera Mode */}
          {mode === 'camera' && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden min-h-[250px]">
                <div id="barcode-reader" className="w-full"></div>
              </div>
              
              {/* Scanning indicator */}
              {scanning && !lastScanned && (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Scanning... Point camera at barcode</span>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Mode */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Enter Barcode / SKU
                </label>
                <Input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Scan with USB scanner or type barcode..."
                  className="text-lg font-mono"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 USB barcode scanners will automatically input here
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={manualBarcode.trim().length < 3}>
                Search Product
              </Button>
            </form>
          )}

          {/* Scan Status */}
          {lastScanned && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              scanStatus === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {scanStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <div className={`font-medium ${scanStatus === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {scanStatus === 'success' ? 'Barcode Detected!' : 'Product Not Found'}
                </div>
                <div className="text-sm text-gray-600 font-mono">{lastScanned}</div>
              </div>
            </div>
          )}

          {/* USB Scanner Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">🔌 USB Barcode Scanner</div>
              <p className="text-xs">
                If you have a USB barcode scanner, simply scan while this dialog is open. 
                The barcode will be detected automatically even in camera mode!
              </p>
            </div>
          </div>

          {/* Tips */}
          {mode === 'camera' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">📸 Camera Tips:</div>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
                  <li>Hold barcode steady within the frame</li>
                  <li>Ensure good lighting</li>
                  <li>Supports: EAN-13, UPC, QR codes, Code-128</li>
                </ul>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
