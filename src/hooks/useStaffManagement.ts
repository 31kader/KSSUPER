import { useState } from 'react';
import { auth, rtdb, ref, get, set, push, child, rtdbQuery, orderByChild, equalTo, handleFirestoreError, OperationType } from '../database';
import { Employee } from '../types';

export function useStaffManagement() {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);

  const handleAddStaffManual = async (name: string, email: string, role: string, phone?: string, password?: string) => {
    try {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail) {
        const emailQuery = rtdbQuery(ref(rtdb, 'users'), orderByChild('email'), equalTo(cleanEmail));
        const snap = await get(emailQuery);
        if (snap.exists()) {
          alert("Un utilisateur avec cet email existe déjà dans les comptes.");
          return;
        }
      }

      if (phone) {
        const phoneQuery = rtdbQuery(ref(rtdb, 'users'), orderByChild('phone'), equalTo(phone));
        const snapPhone = await get(phoneQuery);
        if (snapPhone.exists()) {
          alert("Un utilisateur avec ce numéro de téléphone existe déjà.");
          return;
        }
      }

      // 1. Create Employee record first to get an ID
      const employeeData: Omit<Employee, 'id'> = {
        name,
        email: cleanEmail,
        role: role as any,
        phone: phone || '',
        status: 'active',
        isClockedIn: false,
        hireDate: new Date().toISOString()
      };
      
      const empRef = push(ref(rtdb, 'employees'));
      const employeeId = empRef.key as string;
      await set(empRef, { ...employeeData, id: employeeId });

      // 2. Create actual Auth account via backend
      if (password || email || phone) {
        try {
          const idToken = auth.currentUser?.getIdToken ? await auth.currentUser.getIdToken() : 'mock-token';
          const syncResponse = await fetch('/api/employees/sync-auth', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              phone,
              password,
              email: cleanEmail,
              displayName: name
            })
          });
          
          if (!syncResponse.ok) {
            const errData = await syncResponse.json();
            console.error("Sync Auth failed:", errData);
            const errorMsg = errData.error || "Erreur inconnue";
            if (errorMsg.includes('Identity Toolkit')) {
              alert("ATTENTION : L'API Identity Toolkit est désactivée sur votre projet Google Cloud. \n\nVeuillez l'activer ici pour permettre la connexion par mot de passe : https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=247663396085");
            } else {
              alert(`Note: Le compte d'accès n'a pas pu être créé automatiquement (${errorMsg}). L'employé pourra se connecter via Google s'il utilise son email.`);
            }
          }
        } catch (syncErr) {
          console.error("Sync Auth connection error:", syncErr);
        }
      }

      // 3. Create User profile in RTDB (pre-authorized)
      const userRef = push(ref(rtdb, 'users'));
      await set(userRef, {
        id: userRef.key,
        uid: `auth-${Date.now()}`, // Placeholder until they log in or sync works
        displayName: name,
        email: cleanEmail,
        phone: phone || '',
        password: password || '',
        role: role as any,
        employeeId: employeeId,
        createdAt: new Date().toISOString()
      });

      alert(`Membre "${name}" ajouté avec succès.`);
      setIsAddUserModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  return {
    isAddUserModalOpen, setIsAddUserModalOpen,
    activeStaffId, setActiveStaffId,
    handleAddStaffManual
  };
}
