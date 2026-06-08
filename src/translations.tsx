import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

export type Language = 'fr' | 'ar';

export interface TranslationDict {
  [key: string]: {
    fr: string;
    ar: string;
  };
}

export const translations: TranslationDict = {
  // Navigation
  "Point de Vente": { fr: "Point de Vente", ar: "نقاط البيع" },
  "Caisse": { fr: "Caisse", ar: "صندوق العمليات" },
  "Inventaire": { fr: "Inventaire", ar: "إدارة المخزون" },
  "Suivi Péremption": { fr: "Suivi Péremption", ar: "متابعة تاريخ الصلاحية" },
  "Dépenses": { fr: "Dépenses", ar: "المصاريف والتكاليف" },
  "Tableau de bord": { fr: "Tableau de Bord", ar: "لوحة التحكم الرئيسية" },
  "Tableau de Bord": { fr: "Tableau de Bord", ar: "لوحة التحكم الرئيسية" },
  "Assistant IA": { fr: "Assistant IA", ar: "مساعد الذكاء الاصطناعي" },
  "Rapports": { fr: "Rapports & Statistiques", ar: "التقارير والإحصائيات" },
  "Clôture": { fr: "Clôture de Caisse", ar: "إغلاق الصندوق والوردية" },
  "Personnel & Accès": { fr: "Personnel & Accès", ar: "الموظفون والصلاحيات" },
  "Audit": { fr: "Audit & Sécurité", ar: "الأمان ومراجعة السجلات" },
  "Paramètres": { fr: "Paramètres Système", ar: "إعدادات النظام" },
  "Clôture de Mois": { fr: "Clôture de Mois", ar: "الإغلاق المحاسبي الشهري" },
  "Aide": { fr: "Centre d'Aide", ar: "مركز المساعدة والدعم" },
  "Clients": { fr: "Gestion Clients", ar: "قائمة العملاء والديون" },
  "Fournisseurs": { fr: "Fournisseurs", ar: "الموردون والحسابات" },
  "Promotions": { fr: "Promotions & Fidélité", ar: "العروض والترويج" },
  "Commandes": { fr: "Commandes en Ligne", ar: "الطلبات الإلكترونية" },
  "Retours": { fr: "Retours Articles", ar: "المرتجعات والمستردات" },
  "Achats": { fr: "Approvisionnements", ar: "إدارة المشتريات والطلبات" },
  "Historique": { fr: "Historique Ventes", ar: "سجل المبيعات اليومي" },
  "Audit Caméra": { fr: "Audit Caméra", ar: "المراقبة الذكية بالكاميرا" },
  "Général": { fr: "Général", ar: "عام" },
  "Ventes": { fr: "Ventes", ar: "المبيعات" },
  "Stock": { fr: "Stock", ar: "الـمخزون" },
  "Gestion": { fr: "Gestion", ar: "إدارة العمليات" },
  "Administration": { fr: "Administration", ar: "الإدارة والمراقبة" },

  // Header & Buttons
  "Début de service": { fr: "Début de service", ar: "تسجيل دخول الوردية" },
  "Fin de service": { fr: "Fin de service", ar: "إنهاء وقت الخدمة" },
  "Thème": { fr: "Thème", ar: "المظهر" },
  "Langue": { fr: "Langue", ar: "اللغة" },
  "Utiliser mon compte": { fr: "Utiliser mon compte", ar: "استخدام حسابي الشخصي" },
  "Recherche produit": { fr: "Rechercher par nom, SKU ou code-barre...", ar: "البحث بالاسم، الرمز أو الباركود..." },
  "Pas de notifications": { fr: "Pas de notifications", ar: "لا توجد إشعارات جديدة" },
  "Notification de péremption": { fr: "Alerte péremption de produits !", ar: "تنبيه بانتهاء صلاحية بعض المنتجات!" },

  // POS & Checkout Main Strings
  "Panier": { fr: "Panier d'Achat", ar: "سلة المشتروات الحالية" },
  "Total": { fr: "Total à Payer", ar: "المجموع الكلي المطلوب" },
  "Subtotal": { fr: "Sous-total", ar: "المجموع الفرعي" },
  "Taxes": { fr: "Taxes (TVA)", ar: "الضرائب المستحقة" },
  "Remise Générale": { fr: "Remise Générale", ar: "خصم إجمالي إضافي" },
  "Encaisser": { fr: "Encaisser", ar: "تأكيد واستلام الدفع" },
  "Vider le panier": { fr: "Vider", ar: "تفريغ السلة" },
  "Sélectionner Client": { fr: "Associer un Client", ar: "ربط الفاتورة بعميل" },
  "Client Anonyme": { fr: "Passant / Anonyme", ar: "زبون عابر / غير مسجل" },
  "Type Vente": { fr: "Type de tarification", ar: "نوع التسعير والعرض" },
  "Détail": { fr: "Tarif Détail (Standard)", ar: "سعر التجزئة العادي" },
  "Gros": { fr: "Tarif de Gros", ar: "سعر الجملة المخفض" },
  "Mode de Paiement": { fr: "Mode de Règlement", ar: "طريقة دفع العميل" },
  "Espèces": { fr: "Espèces (Cash)", ar: "نقداً / كاش" },
  "Carte Bancaire": { fr: "Carte Bancaire", ar: "بطاقة مصرفية" },
  "Mobile Money": { fr: "Mobile Money (Wave/Orange)", ar: "الدفع عبر الهاتف" },
  "Sur Compte / Dette": { fr: "Crédit / Sur Compte", ar: "على الحساب / دين" },
  "Remis": { fr: "Montant Reçu / Donné", ar: "المبلغ المستلم" },
  "Monnaie à rendre": { fr: "Monnaie à Rendre", ar: "المبلغ المتبقي للإرجاع" },
  "Imprimer": { fr: "Imprimer ticket", ar: "طباعة الفاتورة والوصل" },
  "Valider la vente": { fr: "Enregistrer la vente", ar: "اعتماد وتأكيد المبيعات" },
  
  // Dashboard & Stats
  "Chiffre d'Affaires": { fr: "Chiffre d'Affaires", ar: "إجمالي المبيعات" },
  "Transactions": { fr: "Nombre de Ventes", ar: "عدد المعاملات والعمليات" },
  "Bénéfice Net": { fr: "Bénéfice Estimé", ar: "الأرباح الصافية المقدرة" },
  "Panier Moyen": { fr: "Panier Moyen", ar: "متوسط قيمة السلة" },
  "Top Ventes": { fr: "Top des Ventes", ar: "الأكثر مبيعاً ورواجاً" },
  "Alertes Stock": { fr: "Alertes Rupture de Stock", ar: "تنبيهات نقص كمية المخزون" },
  "Ventes du Jour": { fr: "Performances du Jour", ar: "مؤشر حركة مبيعات اليوم" },

  // General Actions
  "Ajouter": { fr: "Ajouter", ar: "إضافة جديدة" },
  "Modifier": { fr: "Modifier", ar: "تعديل البيانات" },
  "Supprimer": { fr: "Supprimer", ar: "حذف" },
  "Enregistrer modifications": { fr: "Enregistrer", ar: "حفظ التغييرات" },
  "Annuler": { fr: "Annuler", ar: "إلغاء الأمر" },
  "Client depuis": { fr: "Client depuis", ar: "عميل منذ" },
  "Alertes": { fr: "Alertes", ar: "تنبيهات" },
  "Produits favoris": { fr: "Produits favoris", ar: "المنتجات المفضلة" },
  "Anniversaire": { fr: "Anniversaire", ar: "عيد ميلاد" },
  "jours": { fr: "jours", ar: "أيام" },
  "Notes caissier": { fr: "Notes caissier", ar: "ملاحظات الكاشير" },
  "Ajouter une note...": { fr: "Ajouter une note...", ar: "إضافة ملاحظة..." },
  "Succès": { fr: "Opération réussie", ar: "تمت العملية بنجاح" },
  "Revenu du jour": { fr: "Revenu du jour", ar: "إجمالي الإيرادات اليومية" },
  "Ventes totales": { fr: "Ventes totales", ar: "إجمالي المبيعات" },
  "Alertes stock": { fr: "Alertes stock", ar: "تنبيهات المخزون" },
  "Action requise": { fr: "Action requise", ar: "إجراء مطلوب" },
  "Tout est nominal": { fr: "Tout est nominal", ar: "الحالة طبيعية" },
  "Performance hebdomadaire": { fr: "Performance hebdomadaire", ar: "الأداء الأسبوعي" },
  "Auto-update": { fr: "Auto-update", ar: "تحديث تلقائي" },
  "Transactions Récentes": { fr: "Transactions Récentes", ar: "أحدث المعاملات" },
  "Actualiser": { fr: "Actualiser", ar: "تحديث" },
  "Retourné": { fr: "Retourné", ar: "مرتجع" },
  "Partiel": { fr: "Partiel", ar: "جُزئي" },
  "Voir tout l'historique": { fr: "Voir tout l'historique", ar: "عرض كامل السجل" },
  "Articles répertoriés": { fr: "articles répertoriés", ar: "منتج مسجل" },
  "Ajouter un produit": { fr: "Ajouter un produit", ar: "إضافة منتج جديد" },
  "Importer": { fr: "Importer", ar: "استيراد ملف" },
  "Exporter": { fr: "Exporter", ar: "تصدير الملف" },
  "Rechercher...": { fr: "Rechercher...", ar: "البحث..." },
  "Demander livreur Yassir": { fr: "Demander livreur Yassir", ar: "طلب مندوب ياسير" },
  "Commande assignée à Yassir Express. Veuillez finaliser la demande sur votre application Yassir.": { fr: "Commande assignée à Yassir Express. Veuillez finaliser la demande sur votre application Yassir.", ar: "تم تعيين الطلب لياسير. يرجى إتمام الطلب من تطبيق ياسير الخاص بك." },
  "Filtres": { fr: "Filtres", ar: "تصفية البنود" },
  "Toutes les catégories": { fr: "Toutes les catégories", ar: "كل التصنيفات" },
  "Sélectionner": { fr: "Sélectionner", ar: "اختيار" },
  "Réinitialiser": { fr: "Réinitialiser", ar: "إعادة ضبط" },
  "Supprimer la sélection": { fr: "Supprimer la sélection", ar: "حذف المحدد" },
  "Imprimer étiquettes": { fr: "Imprimer étiquettes", ar: "طباعة الملصقات" },
  "Mise à jour groupée": { fr: "Mise à jour groupée", ar: "تحديث جماعي" },
  "PRIX UNITAIRE": { fr: "PRIX UNITAIRE", ar: "سعر الوحدة" },
  "MARGE NETTE": { fr: "MARGE NETTE", ar: "صافي الربح" },
  "STOCK": { fr: "STOCK", ar: "المخزون" },
  "Aucun": { fr: "Aucun", ar: "لا يوجد" },
  "Inconnu": { fr: "Inconnu", ar: "غير معروف" },
  "Paramètres Système": { fr: "Paramètres Système", ar: "إعدادات النظام" },
  "Profil": { fr: "Profil", ar: "الملف الشخصي" },
  "Déconnexion": { fr: "Déconnexion", ar: "تسجيل الخروج" },
  "Configuration Système": { fr: "Configuration Système", ar: "إعدادات النظام" },
  "Gestion administrative et technique de l'infrastructure": { fr: "Gestion administrative et technique de l'infrastructure", ar: "الإدارة الفنية والإدارية للبنية التحتية" },
  "Permissions": { fr: "Permissions", ar: "الصلاحيات" },
  "RH": { fr: "RH", ar: "الموارد البشرية" },
  "Logistique": { fr: "Logistique", ar: "الخدمات اللوجستية" },
  "Finance": { fr: "Finance", ar: "المالية" },
  "APIs": { fr: "APIs", ar: "واجهات البرمجة" },
  "Outils": { fr: "Outils", ar: "الأدوات" },
  "Une nouvelle commande vient d'arriver pour vos livreurs.": { fr: "Une nouvelle commande vient d'arriver pour vos livreurs.", ar: "وصل طلب جديد لعمال التوصيل." },
  "🚨 Nouvelle commande en ligne !": { fr: "🚨 Nouvelle commande en ligne !", ar: "🚨 طلب جديد عبر الإنترنت!" },
  "Connexion réussie en mode hors ligne.": { fr: "Connexion réussie en mode hors ligne.", ar: "تم تسجيل الدخول بنجاح في وضع غير متصل." },
  "Connexion hors ligne échouée : Identifiant ou mot de passe incorrect pour le mode hors ligne.": { fr: "Connexion hors ligne échouée : Identifiant ou mot de passe incorrect pour le mode hors ligne.", ar: "فشل الاتصال في وضع غير متصل: اسم المستخدم أو كلمة المرور غير صحيحة." },
  "Veuillez entrer un identifiant et un mot de passe.": { fr: "Veuillez entrer un identifiant et un mot de passe.", ar: "يرجى إدخال اسم المستخدم وكلمة المرور." },
  "Utilisateur": { fr: "Utilisateur", ar: "مستخدم" },
  "Raffraichissez la page": { fr: "Raffraichissez la page", ar: "قم بتحديث الصفحة" },
  "La tentative de connexion a échoué. Veuillez réessayer.": { fr: "La tentative de connexion a échoué. Veuillez réessayer.", ar: "فشلت محاولة تسجيل الدخول. يرجى المحاولة مجدداً." },
  "Journal de bord": { fr: "Journal de bord", ar: "سجل النشاطات" },
  "Historique des achats": { fr: "Historique des achats", ar: "سجل المشتريات" },
  "Notes Internes": { fr: "Notes Internes", ar: "ملاحظات داخلية" },
  "Digital Card": { fr: "Digital Card", ar: "البطاقة الرقمية" },
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

export const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('nexus-pos-lang') as Language) || 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nexus-pos-lang', lang);
  };

  useEffect(() => {
    if (language === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'fr';
      document.documentElement.classList.remove('rtl');
    }
  }, [language]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language];
    }
    // Fallback if full sentence contains specific text
    for (const [dictKey, value] of Object.entries(translations)) {
      if (key.toLowerCase() === dictKey.toLowerCase()) {
        return value[language];
      }
    }
    return key;
  };

  const isRtl = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      <div dir={isRtl ? 'rtl' : 'ltr'} className={isRtl ? 'font-sans-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
