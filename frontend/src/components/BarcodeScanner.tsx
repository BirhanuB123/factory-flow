import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

export function BarcodeScanner({ onScanSuccess, onScanError }: BarcodeScannerProps) {
  const scannerContainerId = 'reader';
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Prevent multiple initializations in React strict mode
    if (!scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        scannerContainerId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
        },
        false
      );
      
      scanner.render(
        (decodedText) => {
          scanner.pause(true); // Pause scanning on success to prevent rapid re-scans
          onScanSuccess(decodedText);
        },
        (error) => {
          if (onScanError) {
            onScanError(error);
          }
        }
      );
      
      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <div id={scannerContainerId} className="w-full" />
    </div>
  );
}
