import React, { useState } from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  data: any[];
  onConfirm: (mapping: Record<string, string>) => void;
  isProcessing: boolean;
  progress: number;
  errors: { row: number, message: string }[];
}

const FIELD_LABELS: Record<string, { label: string; required: boolean }> = {
  name: { label: 'Nom du Produit', required: true },
  price: { label: 'Prix de Vente', required: true },
  sku: { label: 'SKU (Référence)', required: false },
  barcode: { label: 'Code-barres (EAN/UPC)', required: false },
  stock: { label: 'Stock Initial', required: false },
  costPrice: { label: 'Prix d\'Achat (Coût)', required: false },
  category: { label: 'Catégorie', required: false },
  unit: { label: 'Unité (Ex: kg, litre)', required: false },
};

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, headers, data, onConfirm, isProcessing, progress, errors }) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Auto-map headers and reset when file opens
  React.useEffect(() => {
    if (!isOpen) {
      setMapping({});
      return;
    }

    const tempMapping: Record<string, string> = {};
    
    // Auto map candidates
    const matches: Record<string, string[]> = {
      name: ['nom', 'name', 'désignation', 'designation', 'article', 'produit', 'product', 'libellé', 'libelle'],
      price: ['prix de vente', 'prix public', 'prix_vente', 'prix vt', 'prix_v', 'prix', 'price', 'vente', 'rate', 'tarif', 'sell'],
      sku: ['sku', 'ref', 'référence', 'reference', 'code table'],
      barcode: ['code-barres', 'code barres', 'code_barre', 'code_barres', 'code', 'barcode', 'barres', 'ean', 'upc'],
      stock: ['stock', 'quantité', 'quantite', 'qty', 'quantity', 'qte', 'qté', 'dispo', 'en_stock'],
      costPrice: ['prix d\'achat', 'prix_achat', 'achat', 'coût', 'cout', 'cost', 'buying', 'price_cost', 'prix_c'],
      category: ['catégorie', 'categorie', 'category', 'rayon', 'famille', 'groupe', 'group'],
      unit: ['unité', 'unite', 'unit', 'mesure', 'type', 'uom']
    };

    Object.entries(matches).forEach(([field, keywords]) => {
      const foundHeader = headers.find(h => {
        const lowerH = h.toLowerCase().trim();
        return keywords.some(kw => lowerH.includes(kw) || kw.includes(lowerH));
      });
      if (foundHeader) {
        tempMapping[field] = foundHeader;
      }
    });

    setMapping(tempMapping);
  }, [isOpen, headers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Importer depuis un fichier (CSV / Excel)</h3>
            <p className="text-xs text-slate-400 mt-1">Établissez la correspondance entre les colonnes de votre fichier et les champs système.</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase disabled:opacity-30"
          >
            Fermer
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <span>Importation en cours...</span>
                <span className="font-black font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center italic">Veuillez ne pas fermer cette fenêtre.</p>
            </div>
          )}

          {/* Mapping Grid */}
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">1. Correspondance des colonnes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(FIELD_LABELS).map(([field, info]) => (
                <div key={field} className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase tracking-wider">{info.label}</span>
                    {info.required ? (
                      <span className="text-[8px] font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Requis</span>
                    ) : (
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Optionnel</span>
                    )}
                  </div>
                  <select 
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={(e) => setMapping({...mapping, [field]: e.target.value})}
                    disabled={isProcessing}
                    value={mapping[field] || ''}
                  >
                    <option value="">-- Ignorer ou défaut --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Table Preview */}
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">2. Aperçu des données du fichier (50 premières lignes)</h4>
            <div className="max-h-56 overflow-auto border border-slate-800/80 rounded-2xl bg-slate-950 shadow-inner">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0 border-b border-slate-800">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="p-3 font-black text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {data.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      {headers.map(h => (
                        <td key={h} className="p-3 text-slate-300 font-mono truncate max-w-[150px]">{row[h]?.toString() || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Errors */}
          {errors.length > 0 && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 max-h-40 overflow-auto space-y-2">
              <h4 className="font-extrabold uppercase tracking-wide flex items-center gap-2">
                ⚠️ Erreurs détectées ({errors.length}) :
              </h4>
              <div className="space-y-1 font-mono text-[10px]">
                {errors.slice(0, 50).map((e, i) => (
                  <p key={i} className="leading-relaxed">
                    <span className="text-rose-300 font-extrabold">Ligne {e.row} :</span> {e.message}
                  </p>
                ))}
                {errors.length > 50 && <p className="italic text-slate-500">Et {errors.length - 50} autres erreurs...</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Total à importer : <span className="text-indigo-400 font-black">{data.length}</span> lignes
          </p>
          <div className="flex justify-end gap-3">
            {!isProcessing && (
              <button 
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer" 
                onClick={onClose}
              >
                Annuler
              </button>
            )}
            <button 
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
              onClick={() => onConfirm(mapping)} 
              disabled={isProcessing}
            >
              {isProcessing ? 'Importation...' : 'Confirmer l\'importation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
