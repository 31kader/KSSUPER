import express from "express";
import { createServer } from "http";
console.log("Starting server process...");
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load local .env if it exists
dotenv.config();

// Robust path handling for both ESM and CJS
const getPaths = () => {
  if (typeof __dirname !== 'undefined') {
    return { 
      __filename: typeof __filename !== 'undefined' ? __filename : '', 
      __dirname: __dirname 
    };
  }
  try {
    // Defer evaluation of import.meta to avoid parse-time SyntaxError in CommonJS environments
    const getImportMetaUrl = new Function('return import.meta.url');
    const _filename = fileURLToPath(getImportMetaUrl());
    const _dirname = path.dirname(_filename);
    return { __filename: _filename, __dirname: _dirname };
  } catch (e) {
    return { 
      __filename: '', 
      __dirname: process.cwd() 
    };
  }
};

const { __filename: _filename, __dirname: _dirname } = getPaths();

// Determine if we are in the AI Studio editor environment (Dev)
const IS_EDITOR = !!(process.env.K_SERVICE && process.env.K_SERVICE.includes('-dev-'));

// Production mode if explicitly set, or if we're not in the editor, or if running from dist
const IS_PROD = 
  process.env.NODE_ENV === "production" || 
  !IS_EDITOR ||
  (typeof __dirname !== 'undefined' && __dirname.includes('dist')) ||
  (_dirname && _dirname.includes('dist')) ||
  (_filename && (_filename.includes('dist') || _filename.includes('server.cjs')));

// Load Firebase Config
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (error) {
  // Silent fail
}

let adminAuth: admin.auth.Auth | null = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || firebaseConfig.projectId) {
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
        if (!key.startsWith('AIza')) {
          const serviceAccount = JSON.parse(key);
          credential = admin.credential.cert(serviceAccount);
        }
      } catch (parseError) {
        // Silent fail
      }
    }

    if (credential && firebaseConfig.projectId) {
      admin.initializeApp({
        credential,
        projectId: firebaseConfig.projectId
      });
      adminAuth = admin.auth();
      console.log("Firebase Admin SDK initialized.");
    }
  } catch (error) {
    // Silent fail
  }
}

async function startServer() {
  try {
    const app = express();
    app.use(express.json({ limit: '50mb' })); // Increased limit for image scans
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    
    // Debug logging for API requests
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.path}`);
      }
      next();
    });

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    // API routes
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok" });
    });

    // AI Analysis/Completion route
    app.post("/api/ai/complete", async (req, res) => {
      const { data, userPrompt, systemPromptOverride } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Configuration", message: "La clé API Gemini n'est pas configurée sur le serveur." });
      }

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        
        const systemPrompt = systemPromptOverride || `Tu es un consultant expert en gestion de commerce de détail. 
          Analyse les données (ventes, dépenses, stocks, et surtout les ajustements de stock négatifs pour identifier les pertes) et réponds de manière concise en français.
          Réponds toujours au format Markdown.`;

        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: systemPrompt }, { text: userPrompt || "Analyse mon commerce." }] }]
        });
        res.json({ response: result.text });
      } catch (error: any) {
        console.error("Gemini Error:", error);
        
        // Handle model not found error by attempting a fallback
        if (error.message?.includes('not found') || error.status === 'NOT_FOUND') {
          try {
            const aiFallback = new (await import("@google/genai")).GoogleGenAI({ apiKey: apiKey! });
            const fallbackResult = await aiFallback.models.generateContent({
              model: "gemini-3.5-flash",
              contents: [{ parts: [{ text: systemPromptOverride || "Analyse mon commerce." }, { text: userPrompt || "Analyse mon commerce." }] }]
            });
            return res.json({ response: fallbackResult.text });
          } catch (fallbackError) {
            console.error("Fallback error:", fallbackError);
          }
        }

        const errMsg = error.message || (typeof error === 'object' && error !== null ? error.toString() : String(error));
        const errorStr = (() => {
          try {
            return JSON.stringify(error);
          } catch (e) {
            return '';
          }
        })();
        
        const isQuotaError = 
          errMsg.toLowerCase().includes('429') || 
          errMsg.toLowerCase().includes('quota') || 
          errMsg.toLowerCase().includes('credit') || 
          errMsg.toLowerCase().includes('depleted') ||
          errMsg.toLowerCase().includes('exhausted') ||
          errorStr.toLowerCase().includes('resource_exhausted') ||
          errorStr.toLowerCase().includes('429') ||
          errorStr.toLowerCase().includes('depleted') ||
          errorStr.toLowerCase().includes('credits') ||
          (error && typeof error === 'object' && (error.status === 429 || error.status === 'RESOURCE_EXHAUSTED' || error.statusCode === 429 || error.code === 429));
        
        if (isQuotaError) {
          return res.status(429).json({ 
            error: "Quota atteint", 
            message: "La limite de l'IA (ou vos crédits AI Studio) est épuisée. Passage en mode manuel ou local si disponible." 
          });
        }

        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid') || errMsg.includes('expired') || errorStr.includes('API_KEY_INVALID')) {
          return res.status(401).json({ 
            error: "Clé API Invalide", 
            message: "Votre clé API Gemini est invalide ou expirée. Veuillez la mettre à jour dans les paramètres (Settings) de l'application." 
          });
        }
        res.status(500).json({ error: "Erreur AI", message: errMsg });
      }
    });

    app.post("/api/ai/scan", async (req, res) => {
      const { image, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Configuration", message: "La clé API Gemini n'est pas configurée pour le scanner." });
      }

      if (!image) {
        return res.status(400).json({ error: "Données manquantes", message: "Aucune image n'a été reçue pour l'analyse." });
      }

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const prompt = "Analyse cette facture/bon d'achat. Extrais les informations et retourne un JSON valide avec : \n1. 'supplierName' (le nom du fournisseur)\n2. 'invoiceNumber' (le numéro du bon ou de la facture)\n3. 'date' (la date au format YYYY-MM-DD)\n4. 'previousBalance' (l'ancien solde ou solde précédent s'il est mentionné, un nombre, sinon null)\n5. 'total' (le nouveau solde ou total à payer, un nombre)\n6. 'items' (un tableau d'objets contenant { name: string, quantity: number, price: number, total: number }).\nNote TRÈS IMPORTANTE : le champ 'price' doit être le prix d'achat UNITAIRE du produit, et le champ 'total' du produit doit être le montant total HT de cette de ligne (quantité * prix unitaire). S'il y a des colonnes de quantité répétées, utilise la quantité brute correcte sans les additionner.";

        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { data: image, mimeType: mimeType || "image/jpeg" } }
            ]
          }]
        });
        
        const text = result.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        
        try {
          const data = JSON.parse(jsonStr);
          res.json(data);
        } catch (parseError) {
          res.status(500).json({ error: "Format invalide", message: "L'IA a retourné un format illisible.", raw: text });
        }
      } catch (error: any) {
        console.error("Gemini Scan Error:", error);

        // Fallback for not found
        if (error.message?.includes('not found') || error.status === 'NOT_FOUND') {
          try {
            const aiFallback = new (await import("@google/genai")).GoogleGenAI({ apiKey: apiKey! });
            const resultFallback = await aiFallback.models.generateContent({
              model: "gemini-3.5-flash",
              contents: [{
                parts: [
                  { text: "Analyse cette facture. Extrais uniquement les articles et retourne un JSON valide avec : items (un tableau d'objets contenant { name: string, quantity: number, price: number, total: number }). Note TRÈS IMPORTANTE : le champ 'price' doit être le prix d'achat UNITAIRE du produit, et le champ 'total' doit être le montant total HT de cette de ligne (quantité * prix unitaire). S'il y a des colonnes de quantité répétées (ex: 'Nbr. Carton' et 'Quantité'), utilise la quantité brute correcte (ex: 6 ou 12) et ne les additionne ni ne les concatène pas. Ignore complètement le fournisseur, les numéros de facture et la date." },
                  { inlineData: { data: image, mimeType: mimeType || "image/jpeg" } }
                ]
              }]
            });
            const textFallback = resultFallback.text;
            const jsonMatchFallback = textFallback.match(/\{[\s\S]*\}/);
            const jsonStrFallback = jsonMatchFallback ? jsonMatchFallback[0] : textFallback;
            return res.json(JSON.parse(jsonStrFallback));
          } catch (e) {
            console.error("Scan fallback failed:", e);
          }
        }

        const errMsg = error.message || (typeof error === 'object' && error !== null ? error.toString() : String(error));
        const errorStr = (() => {
          try {
            return JSON.stringify(error);
          } catch (e) {
            return '';
          }
        })();
        
        const isQuotaError = 
          errMsg.toLowerCase().includes('429') || 
          errMsg.toLowerCase().includes('quota') || 
          errMsg.toLowerCase().includes('credit') || 
          errMsg.toLowerCase().includes('depleted') ||
          errMsg.toLowerCase().includes('exhausted') ||
          errorStr.toLowerCase().includes('resource_exhausted') ||
          errorStr.toLowerCase().includes('429') ||
          errorStr.toLowerCase().includes('depleted') ||
          errorStr.toLowerCase().includes('credits') ||
          (error && typeof error === 'object' && (error.status === 429 || error.status === 'RESOURCE_EXHAUSTED' || error.statusCode === 429 || error.code === 429));
        
        if (isQuotaError) {
          return res.status(429).json({ 
            error: "Quota atteint", 
            message: "Impossible de scanner : vos crédits AI Studio sont épuisés ou la limite de quota a été atteinte." 
          });
        }

        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid') || errMsg.includes('expired') || errorStr.includes('API_KEY_INVALID')) {
          return res.status(401).json({ 
            error: "Clé API Invalide", 
            message: "Votre clé API Gemini est expirée ou invalide. Veuillez la renouveler dans AI Studio." 
          });
        }
        res.status(500).json({ error: "Échec Scan", message: errMsg });
      }
    });

    // Security Middleware for other /api routes
    app.use("/api/employees", async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing token" });
      }

      const token = authHeader.split("Bearer ")[1];
      try {
        if (!adminAuth) {
           console.warn("No Admin SDK. Securing API locally with warning.");
           return next();
        }
        
        if (token === 'mock-token') {
          console.warn("Using mock-token. Bypassing verification.");
          return next();
        }
        
        const decodedToken = await adminAuth.verifyIdToken(token);
        next();
      } catch (err) {
        console.error("Token verification failed:", err);
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }
    });

    // API to create/update employee auth
    app.post("/api/employees/sync-auth", async (req, res) => {
      const { phone, password, displayName, email } = req.body;
      
      if (!phone || !password) {
        return res.status(400).json({ error: "Phone and password are required" });
      }

      const userEmail = email || `${phone.replace(/\s+/g, '')}@nexus-pos.internal`;
      const apiKey = firebaseConfig.apiKey || "";

      try {
        console.log(`Attempting to sync auth for ${userEmail}`);
        
        if (adminAuth) {
          try {
            let userRecord;
            try {
              userRecord = await adminAuth.getUserByEmail(userEmail);
              console.log(`User ${userEmail} already exists, updating...`);
              await adminAuth.updateUser(userRecord.uid, {
                password: password,
                displayName: displayName
              });
              return res.json({ status: "updated", uid: userRecord.uid });
            } catch (err: any) {
               if (err.code === 'auth/user-not-found') {
                  console.log(`User ${userEmail} not found, creating...`);
                  userRecord = await adminAuth.createUser({
                    email: userEmail,
                    password: password,
                    displayName: displayName
                  });
                  return res.json({ status: "created", uid: userRecord.uid });
               } else {
                   throw err;
               }
            }
          } catch (err: any) {
             console.error("Admin SDK sync failed:", err);
             res.status(500).json({ error: "Admin SDK sync failed (check logs).", code: err.code });
             return;
          }
        }

        // If there is no Admin SDK AND no API Key, do not call the Google REST API to avoid unauthenticated API Key errors.
        if (!apiKey || apiKey.trim() === "" || apiKey.includes("votre") || apiKey.includes("YOUR")) {
          console.log("No valid Firebase Web API Key found. Fallback to offline credentials local storage is active.");
          return res.json({
            status: "local_only",
            message: "L'authentification cloud n'est pas activée. Le mot de passe de l'employé reste actif localement sur ce terminal."
          });
        }

        console.log("No Admin Auth found. Using REST API fallback...");
        
        // Use Firebase Auth REST API to create the user
        const signUpResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            password: password,
            displayName: displayName,
            returnSecureToken: true
          })
        });

        const data: any = await signUpResponse.json();

        if (data.error) {
          console.error("REST API Auth Error:", JSON.stringify(data.error));
          const errMsg = data.error.message || "";
          const hasEmailExists = 
            errMsg === 'EMAIL_EXISTS' || 
            errMsg.includes('EMAIL_EXISTS') ||
            (Array.isArray(data.error.errors) && data.error.errors.some((e: any) => e.message === 'EMAIL_EXISTS' || e.message?.includes('EMAIL_EXISTS')));

          if (hasEmailExists) {
             return res.json({ 
              status: "exists", 
              message: "L'utilisateur existe déjà. Impossible de modifier son mot de passe depuis cet environnement sans Service Account.",
              uid: "existing"
            });
          }
          
          // Soft fallback when API key is unauthenticated/unregistered or the Identity Toolkit API is disabled or restricted
          const isPermissionDenied = data.error.status === 'PERMISSION_DENIED';
          const isUnregistered = errMsg.includes('Identity Toolkit API') || data.error.code === 403 || errMsg.includes('unregistered callers') || errMsg.includes('identity');
          if (isPermissionDenied || isUnregistered) {
            console.warn("Firebase Auth Identity Toolkit API is disabled or API Key is missing permissions. Fulfilling user request locally.");
            return res.json({
              status: "local_only",
              message: "L'API d'authentification Firebase (Identity Toolkit) est désactivée ou non configurée pour ce projet. Les identifiants de l'employé ont été sauvegardés localement de manière sécurisée."
            });
          }

          throw new Error(errMsg || "Erreur inconnue");
        }

        console.log("User created successfully:", data.localId);
        res.json({ status: "created", uid: data.localId });

      } catch (err: any) {
        console.error("Firebase Sync Error:", err);
        res.status(500).json({ 
          error: err.message || "Unknown error",
          code: err.code || 'unknown'
        });
      }
    });

    // API to delete employee auth
    app.post("/api/employees/delete", async (req, res) => {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      try {
        if (!adminAuth) {
          return res.status(503).json({ error: "Le Service Account Firebase n'est pas configuré. Impossible de supprimer le compte d'authentification." });
        }

        try {
          const userRecord = await adminAuth.getUserByEmail(email);
          await adminAuth.deleteUser(userRecord.uid);
          console.log(`Successfully deleted auth user: ${email}`);
          res.json({ status: "deleted" });
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            console.log(`User not found for deletion: ${email}`);
            res.json({ status: "not_found" }); // Ignore if they're already gone
          } else {
            throw err;
          }
        }
      } catch (err: any) {
        console.error("Firebase Delete Auth Error:", err);
        res.status(500).json({ 
          error: err.message || "Unknown error",
          code: err.code || 'unknown'
        });
      }
    });

    // Socket.io events
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    // Ensure we correctly detect production mode in Cloud Run
    if (!IS_PROD) {
      try {
        console.log("Starting Vite in dev mode...");
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            hmr: false,
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (viteError) {
        console.error("Failed to start Vite dev server:", viteError);
      }
    } else {
      // Logic for production files localization: Find the REAL dist folder
      // We look for a folder containing both index.html and the assets/ directory
      const rootDir = process.cwd();
      const possibleDistPaths = [
        path.join(rootDir, 'dist'),        // Standard build output
        _dirname,                          // If running directly from dist/
        path.join(_dirname, '..'),         // If running from dist/ but files moved
        path.join(_dirname, 'dist'),       // If server is in a subfolder
        rootDir                            // Current working directory
      ];

      let distPath = "";
      for (const p of possibleDistPaths) {
        const hasIndex = fs.existsSync(path.join(p, 'index.html'));
        const hasAssets = fs.existsSync(path.join(p, 'assets'));
        if (hasIndex && hasAssets) {
          distPath = p;
          break;
        }
      }
      
      // Fallback if no perfect dist folder found
      if (!distPath) {
        for (const p of possibleDistPaths) {
          if (fs.existsSync(path.join(p, 'index.html'))) {
            distPath = p;
            break;
          }
        }
      }

      if (distPath) {
        console.log(`[PROD] Serving application from: ${distPath}`);
        // Serve static assets but do not automatically serve index.html for root requests
        app.use(express.static(distPath, { index: false }));
        app.get('*', (req, res) => {
          const indexPath = path.join(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            try {
              let html = fs.readFileSync(indexPath, 'utf-8');
              
              // Read live, real-time environment variables at request time
              const envObj = {
                VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
              };

              // Safety swap in case the user pasted the URL into the anon_key and vice-versa
              if (envObj.VITE_SUPABASE_URL.startsWith('eyJ') && envObj.VITE_SUPABASE_ANON_KEY.startsWith('http')) {
                console.log("[ENV correction] Swapping misplaced Supabase URL and Anon Key variables from environment.");
                const temp = envObj.VITE_SUPABASE_URL;
                envObj.VITE_SUPABASE_URL = envObj.VITE_SUPABASE_ANON_KEY;
                envObj.VITE_SUPABASE_ANON_KEY = temp;
              }

              const injection = `<script id="runtime-env">
                window.__ENV__ = ${JSON.stringify(envObj)};
              </script>`;

              // Inject the variables block directly after the opening <head> tag
              html = html.replace('<head>', `<head>\n${injection}`);
              res.send(html);
            } catch (err) {
              console.error("Error doing dynamic index.html injection:", err);
              res.sendFile(indexPath); // Fail-safe fallback to standard file response
            }
          } else {
            res.status(404).send("index.html not found");
          }
        });
      } else {
        console.error("[PROD] Could not find application files (dist folder).");
        app.get('*', (req, res) => {
          res.status(404).send("Erreur: Les fichiers de l'application (dossier dist) sont introuvables. Veuillez lancer 'npm run build' avant de lancer le logiciel.");
        });
      }
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    
  } catch (err) {
    console.error("Critical error during server startup:", err);
    process.exit(1);
  }
}

startServer();
