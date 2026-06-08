import React, { useState, useEffect } from 'react';
import { 
  auth, googleProvider, handleFirestoreError, OperationType, db, collection, 
  getDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, firestoreQuery as query, where,
  onAuthStateChanged, signInWithPopup, User 
} from '../database';
import { UserProfile, Employee } from '../types';
import bcrypt from 'bcryptjs';

export function useAuthUser(appMode: string, setLoading: (loading: boolean) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<React.ReactNode | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    // 1. Initial check: Try to restore offline session immediately if present
    const cachedOfflineSession = localStorage.getItem('nexus_active_offline_session');
    if (cachedOfflineSession) {
      try {
        const session = JSON.parse(cachedOfflineSession);
        setUser({
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
          isOffline: true
        } as any);
        setProfile({
          uid: session.uid,
          displayName: session.displayName,
          email: session.email,
          role: session.role,
          employeeId: session.employeeId
        });
        setIsUnauthorized(false);
        setLoading(false);
      } catch (e) {
        console.error("Failed to restore offline session", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          // If we have an active offline session, preserve it and skip setting to null
          const activeOffline = localStorage.getItem('nexus_active_offline_session');
          if (activeOffline) {
            try {
              const session = JSON.parse(activeOffline);
              setUser({
                uid: session.uid,
                email: session.email,
                displayName: session.displayName,
                isOffline: true
              } as any);
              setProfile({
                uid: session.uid,
                displayName: session.displayName,
                email: session.email,
                role: session.role,
                employeeId: session.employeeId
              });
              setIsUnauthorized(false);
              setLoading(false);
              return;
            } catch (err) {}
          }
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        setIsUnauthorized(false);
        const mainEmail = currentUser.email?.toLowerCase();
        const providerEmail = currentUser.providerData?.[0]?.email?.toLowerCase();
        const matchEmail = (mainEmail || providerEmail || '').trim();
        const isOwnerLocally = matchEmail === 'hrskader305@gmail.com' || currentUser.uid === 'FaQiBWkg8uTxZ2np7BQjDINTyQc2';

        if (isOwnerLocally) {
          setIsUnauthorized(false);
        }
        
        let matchPhone = null;
        if (matchEmail && matchEmail.endsWith('@nexus-pos.internal')) {
          matchPhone = matchEmail.replace('@nexus-pos.internal', '');
        }

        // Define variables needed in both paths
        let employee: Employee | undefined;
        let employeeId: string | undefined;

        // Check if user is an employee (for non-owners or to get additional info)
        try {
          const employeesSnap = await getDocs(collection(db, 'employees'));
          const employeeDoc = employeesSnap.docs.find(d => {
              const data = d.data() as Employee;
              return (data.email && data.email.toLowerCase() === matchEmail) || 
                     (matchPhone && data.phone === matchPhone);
          });
          if (employeeDoc) {
             employee = { id: employeeDoc.id, ...employeeDoc.data() } as Employee;
             employeeId = employeeDoc.id;
          }
        } catch (ee) {
          console.warn("Could not fetch employee status", ee);
        }

        if (!isOwnerLocally && (appMode === 'pos' || appMode === 'price_checker')) {
          if (!employee || employee.status !== 'active') {
            setIsUnauthorized(true);
            setProfile(null);
            setLoading(false);
            return;
          }
        }

        // Try to fix missing profile doc if created from AddStaff
        let userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        let userData = userSnap.exists() ? userSnap.data() : null;
        
        if (!userData) {
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const oldUserDoc = usersSnap.docs.find(d => {
                const data = d.data();
                return (data.email && data.email.toLowerCase() === matchEmail) || 
                       (matchPhone && data.phone === matchPhone);
            });
            
            if (oldUserDoc) {
               userData = { ...oldUserDoc.data(), uid: currentUser.uid };
               await setDoc(doc(db, 'users', currentUser.uid), userData);
               
               // Migrer les transactions de l'ancien ID utilisateur vers le nouvel ID réel pour respecter les contraintes de clés étrangères
               try {
                 const txsSnap = await getDocs(collection(db, 'transactions'));
                 const txsToMigrate = txsSnap.docs.filter((d: any) => d.data() && d.data().userId === oldUserDoc.id);
                 for (const txDoc of txsToMigrate) {
                   await updateDoc(doc(db, 'transactions', txDoc.id), { userId: currentUser.uid });
                 }
               } catch (migrationErr) {
                 console.warn("Erreur lors de la migration des transactions vers le nouvel ID utilisateur :", migrationErr);
               }

               await deleteDoc(doc(db, 'users', oldUserDoc.id));
            } else if (employee) {
               // Create it from employee data
               userData = {
                  uid: currentUser.uid,
                  displayName: employee.name,
                  email: employee.email || matchEmail || '',
                  phone: employee.phone || matchPhone || '',
                  role: employee.role,
                  employeeId: employeeId
               };
               await setDoc(doc(db, 'users', currentUser.uid), userData);
            }
          } catch (profileErr) {
            console.warn("Error fixing missing profile doc:", profileErr);
          }
        }
        
        if (isOwnerLocally) {
          setIsUnauthorized(false);
        }
 
        // Force unauthorized FALSE if it's the owner email (Double check)
        if (isOwnerLocally) setIsUnauthorized(false);
 
        // Aggressive role override for owner
        const currentRole = isOwnerLocally ? 'admin' : (employee?.role || (userData ? (userData as UserProfile).role : 'cashier'));
        
        if (userData) {
          const existingProfile = userData as UserProfile;
          const currentEmployeeId = isOwnerLocally ? null : (employeeId || null);
          
          // Force role update if owner is not admin
          const needsUpdate = existingProfile.role !== currentRole || 
                             existingProfile.employeeId !== currentEmployeeId || 
                             (isOwnerLocally && existingProfile.role !== 'admin');
 
          if (needsUpdate) {
            try {
              await updateDoc(doc(db, 'users', currentUser.uid), {
                role: currentRole as any,
                employeeId: currentEmployeeId 
              });
              const updatedProfile = { 
                ...existingProfile, 
                role: currentRole as any, 
                employeeId: currentEmployeeId 
              };
              setProfile(updatedProfile);
            } catch (error: any) {
              if (error?.message?.includes('Quota') || error?.message?.includes('PERMISSION_DENIED') || error?.message?.includes('resource-exhausted')) {
                console.warn("[Quota/Permission] Fallback profile update due to limits:", error.message);
              } else {
                console.error("Error updating user profile:", error);
              }
              try {
                handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
              } catch (e) {}
              setProfile({                
                ...existingProfile, 
                role: currentRole as any, 
                employeeId: currentEmployeeId 
              });
            }
         } else {
            setProfile({
              ...existingProfile,
              employeeId: existingProfile.employeeId || null
            });
         }
       } else {
         const isOwner = matchEmail === 'hrskader305@gmail.com';
         let defaultRole = isOwner ? 'admin' : 'cashier';
         if (appMode === 'customer') defaultRole = 'customer';
         if (appMode === 'supplier') defaultRole = 'supplier';
         
         const newProfile: UserProfile = {
           uid: currentUser.uid,
           displayName: currentUser.displayName || 'Utilisateur',
           email: currentUser.email || '',
           role: (employee?.role || defaultRole) as any,
           employeeId: employeeId || null
         };
         try {
           await setDoc(doc(db, 'users', currentUser.uid), newProfile);
           setProfile(newProfile);
         } catch (error: any) {
           if (error?.message?.includes('Quota') || error?.message?.includes('PERMISSION_DENIED') || error?.message?.includes('resource-exhausted')) {
             console.warn("[Quota/Permission] Fallback profile creation due to limits:", error.message);
           } else {
             console.error("Error creating user profile:", error);
           }
           try {
             handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`);
           } catch (e) {}
           setProfile(newProfile);
         }
       }
      } catch (e: any) {
        console.warn("Auth state change error (possibly offline or quota):", e.message);
        // Fallback for quota limit exceeded when owner logs in
        if (currentUser && (e?.message?.includes("Quota") || e?.code === 'resource-exhausted')) {
           const isOwner = currentUser.email?.toLowerCase().trim() === 'hrskader305@gmail.com' || currentUser.uid === 'FaQiBWkg8uTxZ2np7BQjDINTyQc2';
           if (isOwner) setIsUnauthorized(false);
           setProfile({
             uid: currentUser.uid,
             displayName: currentUser.displayName || 'Utilisateur Hors Ligne',
             email: currentUser.email || '',
             role: isOwner ? 'admin' : 'cashier',
             employeeId: null
           });
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [appMode, setLoading]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuthError = (error: any, windowHref: string = window.location.href, hostname: string = window.location.hostname) => {
    const errorCode = error?.code || (error?.message && error.message.includes('auth/') ? error.message.match(/auth\/[a-z0-9-]+/)?.[0] : null);
    
    const errorMsgString = error?.message || error?.msg || (typeof error === 'string' ? error : JSON.stringify(error || ''));
    if (errorMsgString.includes('already registered') || errorMsgString.includes('already exists') || errorMsgString.includes('user_already_exists')) {
      setAuthError(
        <>
          <div className="font-bold mb-1 text-amber-200">Cet e-mail est déjà enregistré.</div>
          <div className="space-y-2 text-[10px] opacity-90 leading-tight">
            <p>• Cet e-mail est déjà associé à un compte existant.</p>
            <p>• <b>Que faire ?</b> Utilisez le formulaire pour vous connecter en utilisant cet e-mail et le mot de passe associé, ou cliquez sur "Se Connecter" ci-dessous.</p>
          </div>
        </>
      );
    } else if (errorMsgString.includes('Signups not allowed for this instance') || errorMsgString.includes('signup_disabled')) {
      setAuthError(
        <>
          <div className="font-bold mb-1 text-amber-200">Inscriptions désactivées sur votre projet Supabase</div>
          <div className="space-y-2 text-[10px] opacity-90 leading-tight">
            <p>• <b>Problème :</b> L'inscription de nouveaux comptes par e-mail/mot de passe est bloquée par votre projet Supabase.</p>
            <p>• <b>Comment régler cela dans Supabase :</b></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Accédez à votre <b>Tableau de bord Supabase</b> (Authentication).</li>
              <li>Allez dans <b>Authentication → Providers → Email</b>.</li>
              <li>Cochez ou activez la case <b>"Allow new users to sign up"</b> (Autoriser les nouveaux utilisateurs à s'inscrire).</li>
              <li><i>Conseil pratique :</i> Décochez également <b>"Confirm email"</b> si vous souhaitez que la validation de l'e-mail ne soit pas obligatoire lors de la création du compte.</li>
              <li>Cliquez sur <b>Save</b> (Enregistrer) pour appliquer le changement.</li>
            </ul>
            <p className="mt-1 text-green-300">• <b>Solution de secours immédiate :</b> Utilisez le bouton de connexion <b>"Google Administrateur"</b>, qui est déjà fonctionnel et configuré pour votre projet !</p>
          </div>
        </>
      );
    } else if (errorMsgString.includes('provider is not enabled') || errorMsgString.includes('Unsupported provider')) {
      setAuthError(
        <>
          <div className="font-bold mb-1">Fournisseur d'authentification désactivé (Bouton Google)</div>
          <div className="space-y-2 text-[10px] opacity-90 leading-tight">
            <p>• <b>Problème :</b> L'authentification par Google est bloquée car le fournisseur de connexion Google (OAuth) n'est pas activé dans votre tableau de bord Supabase.</p>
            <p>• <b>Action :</b> Veuillez activer le fournisseur Google dans la console Supabase (<b>Authentication → Providers → Google</b>).</p>
            <p>• <b>Solution de secours :</b> Pour vous connecter dès maintenant, vous pouvez utiliser le formulaire standard en créant un compte par e-mail/mot de passe à l'aide du lien en bas de la carte.</p>
          </div>
        </>
      );
    } else if (errorCode === 'auth/network-request-failed') {
      setAuthError(
        <>
          <div className="font-bold mb-1">Erreur réseau lors de la connexion.</div>
          <div className="space-y-2 text-[10px] opacity-90 leading-tight">
            <p>• <b>Cookies Tiers Bloqués :</b> Votre navigateur (ex: Brave, Safari, Chrome Incognito) bloque probablement l'authentification. <b>Veuillez autoriser les cookies tiers ou désactiver les "Shields" / bloqueurs de publicités pour cette page.</b></p>
            <p>• <b>Nouvel Onglet :</b> Si vous êtes dans un aperçu (iframe), essayez d'ouvrir l'application dans un <a href={windowHref} target="_blank" rel="noopener noreferrer" className="underline text-indigo-200">nouvel onglet</a>.</p>
            <p>• Vérifiez également votre connexion Internet.</p>
          </div>
        </>
      );
    } else if (errorCode === 'auth/cancelled-popup-request' || errorCode === 'auth/popup-closed-by-user') {
      console.log("Popup closed or cancelled by user.");
    } else if (errorCode === 'auth/visibility-check-was-unavailable') {
      setAuthError("La connexion a échoué car la fenêtre a perdu le focus ou a été bloquée. Veuillez réessayer. Si le problème persiste, essayez d'autoriser les cookies tiers.");
    } else if (errorCode === 'auth/popup-blocked') {
      setAuthError("Le popup de connexion a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.");
    } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorMsgString.toLowerCase().includes('invalid login credentials') || errorMsgString.toLowerCase().includes('invalid_credentials')) {
      setAuthError(
        <>
          <div className="font-bold mb-1">Identifiant ou mot de passe incorrect.</div>
          <div className="space-y-2 text-[10px] opacity-90 leading-tight">
            <p>• Veuillez vérifier votre adresse e-mail (ou numéro de téléphone) et votre mot de passe.</p>
            <p>• Si vous êtes l'administrateur, vous pouvez également vous connecter en utilisant le bouton <b>"Google Administrateur"</b>.</p>
            <p>• Les comptes d'employés doivent être créés et configurés par le manager depuis le panneau d'administration.</p>
          </div>
        </>
      );
    } else {
      setAuthError(
        <>
          Erreur de connexion: {error.message || "Une erreur inconnue est survenue."}
          <br />
          <span className="mt-1 block text-[10px] opacity-80 font-bold">
            Code d'erreur: {errorCode || 'unknown'}
          </span>
          <br />
          <span className="mt-1 block text-[10px] opacity-80">
            Astuce: Si le problème persiste, essayez d'ouvrir l'application dans un nouvel onglet ou de vérifier votre configuration Firebase.
          </span>
        </>
      );
    }
  };

  return {
    user, setUser, profile, setProfile, authError, setAuthError, isLoggingIn, setIsLoggingIn, isUnauthorized, setIsUnauthorized, handleLogin, handleAuthError
  };
}
