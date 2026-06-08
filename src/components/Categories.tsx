import React, { useRef, useState } from 'react';
import { FolderTree, ChevronRight, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { Category } from '../types';
import { cn, exportToCSV } from '../lib/utils';
import { Button, Card, Modal, SafeImage } from './ui';
import Papa from 'papaparse';
import { supabase } from '../supabase';

interface CategoriesProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAdd: (parentId?: string) => void;
}

export function Categories({ categories, onEdit, onDelete, onAdd }: CategoriesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const rootCategories = categories.filter((c: any) => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter((c: any) => c.parentId === parentId);

  const handleExport = () => {
    const dataToExport = categories.map(cat => {
      const parent = categories.find(c => c.id === cat.parentId);
      return {
        id: cat.id,
        Nom: cat.name,
        Niveau: cat.level || 0,
        Parent_Id: cat.parentId || '',
        Parent_Nom: parent ? parent.name : ''
      };
    });
    exportToCSV(dataToExport, 'categories_export');
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

          // Pour gerer les relations parent/enfant on importe en deux passes ou on map les noms
          for (const row of data) {
            const nom = row['Nom']?.trim();
            if (!nom) {
              failCount++;
              continue;
            }

            const parentId = row['Parent_Id']?.trim();
            const parentNom = row['Parent_Nom']?.trim();
            
            // Check if category already exists by Name to avoid duplicates?
            const { data: existing, error: fetchError } = await supabase
              .from('categories')
              .select('id')
              .eq('name', nom)
              .maybeSingle();

            if (fetchError || existing) {
                failCount++;
                continue; // Skip existing categories
            }

            let resolvedParentId = parentId || null;

            // Si on a un parent_Nom mais pas de parent_Id, on cherche l'ID du parent
            if (!resolvedParentId && parentNom) {
              const { data: pData } = await supabase
                .from('categories')
                .select('id')
                .eq('name', parentNom)
                .maybeSingle();

              if (pData) {
                resolvedParentId = pData.id;
              }
            }

            const newId = Math.random().toString(36).substring(2, 10);
            const { error: insertError } = await supabase.from('categories').insert({
              id: newId,
              name: nom,
              parent_id: resolvedParentId
            });

            if (insertError) {
              failCount++;
              continue;
            }

            successCount++;
          }
          
          setImportSummary(successCount + ' catégorie(s) importée(s) avec succès. ' + (failCount > 0 ? failCount + ' ignorée(s) (doublons ou erreurs).' : ''));
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

  const renderCategory = (category: any, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    return (
      <div key={category.id} className="space-y-2">
        <Card className={cn("p-4 flex items-center justify-between group", level > 0 ? "ml-8 border-l-4 border-l-indigo-200" : "")}>
          <div className="flex items-center gap-3">
            {category.imageUrl ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                <SafeImage 
                  src={category.imageUrl} 
                  alt={category.name} 
                  className="w-full h-full object-cover" 
                  fallback={<FolderTree size={32} className="text-industrial-500 opacity-20" />}
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                {level === 0 ? <FolderTree size={20} /> : <ChevronRight size={20} />}
              </div>
            )}
            <div>
              <h4 className="font-bold text-white uppercase tracking-widest text-sm">{category.name}</h4>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                {subcategories.length} sous-catégorie(s)
              </p>
            </div>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onAdd(category.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Ajouter une sous-catégorie">
              <Plus size={16} />
            </button>
            <button onClick={() => onEdit(category)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Modifier">
              <Edit2 size={16} />
            </button>
            <button onClick={() => onDelete(category)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Supprimer">
              <Trash2 size={16} />
            </button>
          </div>
        </Card>
        {subcategories.length > 0 && (
          <div className="space-y-2 mt-2">
            {subcategories.map((sub: any) => renderCategory(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Catégories</h3>
          <p className="text-sm text-white/40">Gérez l'arborescence de vos produits</p>
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
          <Button variant="secondary" onClick={handleExport} disabled={categories.length === 0}>
            <Download size={20} />
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button onClick={() => onAdd()}>
            <Plus size={20} /> <span className="hidden sm:inline">Nouvelle Catégorie</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {rootCategories.map((category: any) => renderCategory(category))}
        
        {categories.length === 0 && (
          <div className="p-8 text-center text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
            Aucune catégorie n'a été créée.
          </div>
        )}
      </div>
    </div>
  );
}
