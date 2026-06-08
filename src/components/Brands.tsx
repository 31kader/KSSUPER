import React, { useRef, useState } from 'react';
import { Award, Edit2, Trash2, Plus, Download, Upload } from 'lucide-react';
import { Brand } from '../types';
import { Card, Button } from './ui';
import { exportToCSV } from '../lib/utils';
import Papa from 'papaparse';
import { supabase } from '../supabase';

interface BrandsProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
  onAdd: () => void;
}

export function Brands({ brands, onEdit, onDelete, onAdd }: BrandsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const handleExport = () => {
    const dataToExport = brands.map(brand => ({
      id: brand.id,
      Nom: brand.name,
      Description: brand.description || '',
      Logo_Url: brand.logoUrl || ''
    }));
    exportToCSV(dataToExport, 'marques_export');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          let successCount = 0;
          let failCount = 0;

          for (const row of data) {
            const nom = row['Nom']?.trim();
            if (!nom) {
              failCount++;
              continue;
            }

            // Eviter les doublons par nom
            const { data: existing, error: fetchError } = await supabase
              .from('brands')
              .select('id')
              .eq('name', nom)
              .maybeSingle();

            if (fetchError || existing) {
                failCount++;
                continue;
            }

            const newId = Math.random().toString(36).substring(2, 10);
            const { error: insertError } = await supabase.from('brands').insert({
              id: newId,
              name: nom,
              description: row['Description']?.trim() || '',
              logo_url: row['Logo_Url']?.trim() || ''
            });

            if (insertError) {
              failCount++;
              continue;
            }

            successCount++;
          }
          
          setImportSummary(successCount + ' marque(s) importée(s) avec succès. ' + (failCount > 0 ? failCount + ' ignorée(s).' : ''));
        } catch (error) {
          console.error("Erreur d'importation:", error);
          alert("Une erreur s'est produite lors de l'importation.");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error) => {
        setIsImporting(false);
        alert("Erreur de lecture du fichier CSV: " + error.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Marques</h3>
          <p className="text-sm text-white/40">Gérez les marques de vos produits</p>
          {importSummary && <p className="text-sm text-emerald-400 font-medium mt-1">{importSummary}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload size={20} className={isImporting ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">{isImporting ? 'Import...' : 'Importer'}</span>
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={brands.length === 0}>
            <Download size={20} />
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button onClick={() => onAdd()}>
            <Plus size={20} /> <span className="hidden sm:inline">Nouvelle Marque</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map((brand: Brand) => (
          <Card key={brand.id} className="p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                {brand.logoUrl ? (
                  <img 
                    src={brand.logoUrl} 
                    alt={brand.name} 
                    className="w-full h-full object-contain" 
                    onError={(e) => { 
                      e.currentTarget.onerror = null; 
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(brand.name)}&background=random`; 
                    }} 
                  />
                ) : (
                  <Award size={20} />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white">{brand.name}</h4>
                {brand.description && <p className="text-xs text-white/40 truncate w-40">{brand.description}</p>}
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(brand)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={() => onDelete(brand)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
        
        {brands.length === 0 && (
          <div className="col-span-full p-8 text-center text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
            Aucune marque n'a été créée.
          </div>
        )}
      </div>
    </div>
  );
}
