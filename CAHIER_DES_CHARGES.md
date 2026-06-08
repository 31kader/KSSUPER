# CAHIER DES CHARGES : NEXUS POS PRO

Ce document présente l'ensemble des spécifications techniques et fonctionnelles du système **Nexus POS Pro**, conçu comme une application de point de vente (POS) omnichannel, de gestion d'inventaire, de ressources humaines, de comptabilité et de CRM de niveau entreprise.

---

## 1. VISION GÉNÉRALE & ARCHITECTURE RECENTE

**Nexus POS Pro** est une application hybride (Web PWA, Serveur Express et conteneurisation Cloud) et autonome (prête pour Electron) structurée pour le commerce de détail et de gros (Wholesale). Elle offre un fonctionnement résilient et ultra-rapide hors-ligne (Offline-First) grâce à une mise en cache active et un fallback intelligent de synchronisation.

### 1.1 Stack Technique Cœur
- **Frontend** : React 19, TypeScript (mode strict), TailwindCSS v4 (compilé via `@tailwindcss/vite` pour des performances optimales).
- **Transitions & Animations** : Framer Motion (`motion/react`) pour une interface fluide et sans latence.
- **Visualisations & Graphiques** : D3.js et Recharts (gestion des rapports de ventes, pertes, invendus, et marges bénéficiaires).
- **Stockage & Temps Réel d'Origine** : Firebase Multi-base (Firestore + Firebase Realtime Database pour synchronisation instantanée du scanner et du portail caméra).
- **Réseau & Notifications** : Connexions WebSocket bidirectionnelles (Socket.io) pour intégrer les périphériques de caisse locaux, TPE ou imprimantes thermiques de reçus.

---

## 2. MODÈLE DE DONNÉES DE L'APPLICATION (SCHÉMAS CŒUR)

Le système manipule 24 entités de données rigoureusement typées dans `/src/types.ts`.

### 2.1 Produits & Inventaire (`Product`)
- Identifiants uniques, codes-barres (EAN-13, UPC), SKU personnalisé, et liens parentaux pour le fractionnement automatique de cartons de gros (`autoUnpack`, `unitsPerParent`).
- Prix de revient (`costPrice`), Prix de vente standard (`price`), Prix de vente en ligne (`onlinePrice`), et Prix de gros (`wholesalePrice`).
- Grilles de remises sur volume (`quantityDiscounts`) et articles groupés (`isBundle`, `bundleItems`).
- Suivi du stock, stock minimum d'alerte (`minStock`), rebuts (`damagedStock`), et historique de fluctuation des prix (`priceHistory`).

### 2.2 Transactions & Ventes (`Transaction`)
- Panier d'achat avec remises unitaires en lignes (`lineDiscount`), recalcul de taxes (`taxRate`), et cumul de points fidélité.
- Canaux de livraison configurables (`in_store`, `delivery`, `pickup`).
- Modes de règlement multiples : Cash, Carte de crédit, déduction de points fidélité, solde prépayé client (`balanceUsed`), ou code coupon (`voucherDiscount`).
- Statut d'audit de sécurité (`auditStatus` : *verified*, *suspicious*, *pending*) pour traquer les fraudes de caisse.

### 2.3 Clients & Fidélité (`Customer`)
- Profils avec email, téléphone, coordonnées, mot de passe chiffré (pour accès espace client).
- Balance financière dynamique permettant les ventes à crédit (solde négatif / *dette*) ou l'utilisation de comptes prépayés.
- Taux multiplicateur de points par paliers de fidélité (`loyaltyTiers`).
- Notes annotées par les caissiers avec horodatage et auteur unique pour l'historique client.

### 2.4 Fournisseurs & Réapprovisionnement (`Supplier` & `Purchase`)
- Fiches de fournisseurs avec notation de performance (Qualité, Délais, Prix).
- Planification logistique (`preSaleDays`, `deliveryDays`, `paymentDays`).
- Moteur de synchronisation automatique basé sur des flux JSON ou fichiers CSV externes (`SupplierSync`) avec mappage dynamique de colonnes.
- Commandes d'achat (`PurchaseOrder`) et réceptions de marchandises (`GRN`).

### 2.5 Ressources Humaines & Présences (`Employee` & `AttendanceRecord`)
- Gestion des effectifs par rôles de sécurité : Caissier (`cashier`), Manager (`manager`), Administrateur (`admin`), Livreur (`delivery`), Préparateur (`picker`), Caméra (`camera_agent`).
- Fiches contractuelles : Salaires de base (fixes, journaliers ou horaires), avec stockage des contrats, signatures électroniques, et cartes d'identité Nationales.
- Horodateur de pointage numérique (`AttendanceRecord`) pour calculer automatiquement les heures de travail mensuelles.

---

## 3. COMPOSANTS FONCTIONNELS MAJEURS

### 3.1 Écran de Caisse Enregistreuse (Checkout.tsx)
- **Interface Dual-Mode** : Grille visuelle de produits par catégories ou Mode Recherche hyper-optimisé pour les écrans tactiles industriels.
- **Moteur Scanner Code Barre** : Support de scanners matériels USB/Bluetooth natifs, caméra intégrée via ZXing.
- **Options de Vente** : Conversion directe d'une vente en "Vente en Gros" adaptant instantanément tous les prix de l'écran.
- **Encaissement Rapide** : Touches d'appoint en Cash par suggestions algorithmiques (billets de 5, 10, 20, 50, 100). Touche d'impression rapide et validation instantanée par touche physique programmable (`Enter`, `Ctrl+Enter`).
- **Impression Sophistiquée** : Modèles de reçus thermiques modulaires (Classic, Modern, Minimal, Standard) avec configuration de format de papier de caisse (80mm, 60mm, A4).

### 3.2 Contrôle de l'Inventaire & Approvisionnement Intelligent
- **Smart Purchase** : Algorithme prédisant le volume optimal de réapprovisionnement à passer auprès des fournisseurs basés sur l'usure de stock, délais de livraison (`defaultLeadTimeDays`), et ventes historiques.
- **Expiry Tracker & Expiration Alert** : Tableau de bord filtrant les lots de produits approchant de leur date limite pour mise en promotion agressive automatique ou réclamation fournisseurs.
- **Ajustement de Stock & Pertes** : Module permettant de réajuster les écarts physiques tout en traquant la cause exacte (vol, produit brisé, erreur système).

### 3.3 Gestion de Shifts & Clôtures de Caisse
- Verrouillage total de la session POS sous forme de Shifts (`CashShift`).
- Entrée du fonds de caisse initial à l'ouverture.
- Clôture avec calcul automatique des écarts de caisse entre l'espéré en base et le physique recompté (pour espèces et carte).
- Génération de rapports Z de clôture de caisse infalsifiables.

### 3.4 Intelligence Artificielle & Automatisation (AIAssistant.tsx)
- Assistant IA contextuel connecté en temps réel aux données de vente actuelles et à l'inventaire.
- Offre des analyses instantanées sur : les produits les plus rentables, la rotation de stock, les recommandations stratégiques d'achat, et la détection d'anomalies de ventes suspectes.

---

## 4. GUIDE D'INSTALLATION & EXÉCUTION DE COPINAGE

Pour cloner et démarrer ce projet dans un nouvel environnement :

1. Naviguer dans le dossier du projet :
   ```bash
   cd nexus-pos-pro
   ```
2. Installer l'intégralité des dépendances système :
   ```bash
   npm install
   ```
3. Exécuter le projet en mode développement (Vite + Express) :
   ```bash
   npm run dev
   ```
4. Générer le bundle optimisé de production :
   ```bash
   npm run build
   ```
5. Lancer le serveur de production compilé :
   ```bash
   npm run start
   ```
