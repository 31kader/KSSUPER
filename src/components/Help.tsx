import React from 'react';
import { Card } from './ui';
import { ShoppingCart, Package, BarChart3, ShieldCheck } from 'lucide-react';

export function Help() {
  const sections = [
    {
      title: "Point de Vente (POS)",
      icon: <ShoppingCart size={24} className="text-indigo-500" />,
      content: "Utilisez le POS pour effectuer des ventes. Vous pouvez scanner des articles, appliquer des remises et choisir différents modes de paiement."
    },
    {
      title: "Gestion d'Inventaire",
      icon: <Package size={24} className="text-emerald-500" />,
      content: "Gérez vos produits, suivez les niveaux de stock et recevez des alertes de stock faible. Vous pouvez également importer/exporter vos données via CSV/Excel."
    },
    {
      title: "Rapports & Analyses",
      icon: <BarChart3 size={24} className="text-amber-500" />,
      content: "Consultez vos performances de vente, vos bénéfices et vos dépenses en temps réel grâce au tableau de bord analytique."
    },
    {
      title: "Sécurité & Audit",
      icon: <ShieldCheck size={24} className="text-rose-500" />,
      content: "Toutes les actions critiques sont enregistrées dans les journaux d'audit pour assurer la traçabilité et la sécurité de votre entreprise."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Centre d'Aide</h2>
        <p className="text-lg text-slate-500">Tout ce que vous devez savoir pour maîtriser votre portail de gestion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, idx) => (
          <Card key={`help-section-${idx}`} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-50 rounded-2xl">
                {section.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">{section.title}</h3>
                <p className="text-slate-600 leading-relaxed">{section.content}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-8 bg-indigo-600 text-white text-center space-y-4">
        <h3 className="text-2xl font-bold">Besoin d'assistance supplémentaire ?</h3>
        <p className="text-indigo-100">Notre équipe de support est disponible pour vous aider à configurer votre système.</p>
        <div className="flex justify-center gap-4 pt-4">
          <button className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors">
            Contactez le Support
          </button>
          <button className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-400 transition-colors">
            Documentation Complète
          </button>
        </div>
      </Card>
    </div>
  );
}
