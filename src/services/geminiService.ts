
export const callGeminiAI = async (data: any, userPrompt: string, systemPromptOverride?: string) => {
  try {
    const response = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, userPrompt, systemPromptOverride }),
    });

    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch (e) {}
      
      const errMsg = errData.message || errData.error || 'Failed to call AI API';
      if (response.status === 429 || errMsg.includes("Quota") || errMsg.includes("credits") || errMsg.includes("exhausted") || errMsg.includes("dépassé")) {
        throw new Error("Quota atteint : Vos crédits de prépaiement ou limites d'utilisation de Google AI Studio sont épuisés. Veuillez recharger vos crédits ou mode de facturation dans la console Google AI Studio pour rétablir les fonctionnalités automatiques.");
      }
      throw new Error(errMsg);
    }

    const result = await response.json();
    return result.response;
  } catch (error) {
    console.error("AI Assistant Error:", error);
    throw error;
  }
};

export const scanInvoice = async (imageBase64: string, mimeType: string = 'image/jpeg') => {
  try {
    const response = await fetch('/api/ai/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64, mimeType }),
    });

    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch (e) {}
      
      const errMsg = errData.message || errData.error || 'Failed to scan invoice';
      if (response.status === 429 || errMsg.includes("Quota") || errMsg.includes("credits") || errMsg.includes("exhausted") || errMsg.includes("dépassé")) {
        throw new Error("Impossible de scanner la facture : Vos crédits de prépaiement Google AI Studio sont épuisés. Veuillez approvisionner votre compte de facturation Google Cloud.");
      }
      throw new Error(errMsg);
    }

    return await response.json();
  } catch (error) {
    console.error("Invoice Scan Error:", error);
    throw error;
  }
};

export const analyzeStoreData = async (data: {
  transactions: any[];
  products: any[];
  expenses: any[];
  settings: any;
  stockAdjustments?: any[];
}, userPrompt?: string) => {
  try {
    return await callGeminiAI(data, userPrompt || "Donne-moi un résumé de la santé de mon commerce aujourd'hui et 3 conseils actionnables.");
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    const msg = error.message || String(error);
    if (msg.includes("Quota") || msg.includes("crédits") || msg.includes("exhausted") || msg.includes("429") || msg.includes("dépassé")) {
      return `⚠️ **Quota d'utilisation atteint / Crédits épuisés**\n\nPour continuer à utiliser l'Assistant IA, veuillez **recharger vos crédits de prépaiement sur votre console de facturation Google AI Studio**.\n\nEn attendant, votre espace administrateur POS reste disponible et fonctionnel à 100% pour la gestion manuelle locale de votre inventaire, de vos factures et de votre point de vente !`;
    }
    return `Erreur: ${msg || "L'Assistant IA n'est pas disponible pour le moment."}`;
  }
};
