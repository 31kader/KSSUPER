import React, { useState } from 'react';
import { Modal, Button } from './ui';
import { Sparkles, Upload } from 'lucide-react';
import { callGeminiAI } from '../services/geminiService';

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  name: string;
  setName: (name: string) => void;
  logo: string;
  setLogo: (logo: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  editingBrand: any;
}

export function BrandModal({ 
  isOpen, onClose, onSave, 
  name, setName, logo, setLogo, 
  description, setDescription, 
  editingBrand
}: BrandModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAIInfo = async () => {
    if (!name) {
      alert("Veuillez d'abord saisir le nom de la marque.");
      return;
    }
    setIsGenerating(true);
    try {
      const systemPrompt = `Génère des informations professionnelles pour la marque de superrette/commerce: "${name}". 
      Je veux:
      1. Une description vendeuse et courte (max 150 caractères).
      2. Une suggestion d'URL de logo (priorise Clearbit logo API: https://logo.clearbit.com/domain.com si tu connais le domaine, sinon cherche une URL publique stable ou laisse vide si inconnu).
      Réponds UNIQUEMENT en format JSON: {"description": "...", "logoUrl": "..."}`;

      const responseText = await callGeminiAI({}, "Génère le JSON pour cette marque.", systemPrompt);
      
      const data = JSON.parse(responseText.replace(/```json|```/g, '').trim());
      
      if (data.description) setDescription(data.description);
      if (data.logoUrl) setLogo(data.logoUrl);
    } catch (error: any) {
      console.error("AI Generation failed:", error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("Quota atteint") || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("credits")) {
        alert("Génération IA impossible : Votre quota d'utilisation de l'IA (ou vos crédits Google AI Studio) est épuisé.");
      } else {
        alert(`La génération IA a échoué : ${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingBrand ? "Modifier la Marque" : "Nouvelle Marque"}>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 flex justify-between">
            Nom de la marque
            <button 
              type="button" 
              onClick={generateAIInfo}
              disabled={isGenerating || !name}
              className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              <Sparkles size={12} className={isGenerating ? "animate-pulse" : ""} />
              {isGenerating ? "Génération..." : "Magie IA"}
            </button>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ex: Coca-Cola, Danone..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Logo de la marque (URL ou Fichier)</label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com/logo.png"
              />
              {logo && (
                <div className="w-10 h-10 border border-slate-200 rounded-lg overflow-hidden bg-white flex items-center justify-center p-1 shrink-0">
                  <img 
                    src={logo} 
                    alt="Preview" 
                    className="w-full h-full object-contain" 
                    onError={(e) => { 
                      e.currentTarget.onerror = null; 
                      e.currentTarget.src = 'https://ui-avatars.com/api/?name=Brand&background=random'; 
                    }} 
                  />
                </div>
              )}
            </div>
            <label className="flex items-center justify-center gap-2 p-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-600">
              <Upload size={16} /> Télécharger une image
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
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
                      
                      // Convert to WebP with 0.5 quality, fallback to JPEG if needed
                      let dataUrl = canvas.toDataURL('image/webp', 0.5);
                      if (!dataUrl.startsWith('data:image/webp')) {
                        dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                      }
                      setLogo(dataUrl);
                    };
                    img.src = reader.result as string;
                  };
                  reader.readAsDataURL(file);
                }} 
              />
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24"
            placeholder="Description de la marque..."
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
