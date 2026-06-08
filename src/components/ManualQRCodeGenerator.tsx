import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, MessageSquare } from 'lucide-react';

export function ManualQRCodeGenerator() {
  const [inputValue, setInputValue] = useState('');
  const [qrValue, setQrValue] = useState('');

  const handleGenerate = () => {
    setQrValue(inputValue);
  };

  const handlePrint = () => {
    if (!qrValue) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${qrValue}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
            img { width: 300px; height: 300px; }
            p { margin-top: 20px; font-weight: bold; font-size: 18px; }
          </style>
        </head>
        <body>
          <div id="qr-container"></div>
          <p>${qrValue}</p>
          <script>
            window.onload = () => {
              const canvas = opener.document.querySelector('canvas');
              const container = document.getElementById('qr-container');
              const img = document.createElement('img');
              img.src = canvas.toDataURL();
              container.appendChild(img);
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Générateur de QR Code</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Entrez le texte ou l'URL"
          className="flex-grow px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={handleGenerate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
        >
          Générer
        </button>
      </div>
      {qrValue && (
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <QRCodeCanvas value={qrValue} size={200} />
          </div>
          <div className="flex gap-2 w-full">
            <button 
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
            >
              <Printer size={18} /> Imprimer
            </button>
            <button 
              onClick={() => {
                const message = encodeURIComponent(`Bonjour, voici votre code QR : ${qrValue}`);
                window.open(`https://wa.me/?text=${message}`, '_blank');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
            >
              <MessageSquare size={18} /> WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
