import React, { useRef, useState } from 'react';
import { Modal, Button } from './ui';
import { Category } from '../types';
import { getHierarchicalCategories } from '../lib/utils';
import { Image as ImageIcon, Upload, Link as LinkIcon, Trash2 } from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  name: string;
  setName: (name: string) => void;
  parentId: string;
  setParentId: (id: string) => void;
  imageUrl?: string;
  setImageUrl?: (url: string) => void;
  categories: Category[];
  editingCategory: Category | null;
}

export function CategoryModal({ 
  isOpen, onClose, onSave, onDelete, 
  name, setName, parentId, setParentId, 
  imageUrl, setImageUrl,
  categories, editingCategory 
}: CategoryModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingCategory ? "Modifier la Catégorie" : "Nouvelle Catégorie"}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Catégorie Parent</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg"
          >
            <option value="">Aucune (Racine)</option>
            {getHierarchicalCategories(categories.filter((c: Category) => c.id !== editingCategory?.id)).map((c: any) => (
              <option key={c.id} value={c.id}>
                {'—'.repeat(c.level)} {c.name}
              </option>
            ))}
          </select>
        </div>
        
        {setImageUrl && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Image de la Catégorie</label>
            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 rounded-lg bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 relative group">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Aperçu" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setImageUrl('')}
                      className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </>
                ) : (
                  <ImageIcon size={32} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                  <button 
                    onClick={() => setActiveTab('url')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'url' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                  >
                    <LinkIcon size={14} /> URL
                  </button>
                  <button 
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'upload' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                  >
                    <Upload size={14} /> Fichier
                  </button>
                </div>
                
                {activeTab === 'url' ? (
                  <input
                    type="url"
                    value={imageUrl || ''}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const img = document.createElement('img');
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 400;
                              const MAX_HEIGHT = 400;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                                }
                              }
                              
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);
                              
                              // Convert to WebP with 0.5 quality for maximum compression, fallback to JPEG if needed
                              let dataUrl = canvas.toDataURL('image/webp', 0.5);
                              if (!dataUrl.startsWith('data:image/webp')) {
                                dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                              } 
                              
                              if (setImageUrl) {
                                setImageUrl(dataUrl);
                              }
                            };
                            img.src = reader.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-full p-2 border border-slate-300 rounded-lg text-sm text-slate-500 flex justify-center items-center gap-2 bg-white hover:bg-slate-50 transition-colors">
                      <Upload size={14} /> 
                      Choisir une image
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button onClick={onSave} className="flex-1">Enregistrer</Button>
          {editingCategory && (
            <Button onClick={onDelete} variant="danger" className="flex-1">Supprimer</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
