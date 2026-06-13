import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, Clock, Calendar, Phone, Mail, UserCog, UserPlus, 
  TrendingUp, Trash2, Edit, Lock, Eye, EyeOff, Shield, ShieldCheck,
  Search, Award, ShoppingBag, Quote, Smartphone, CreditCard as CardIcon,
  LogOut, LogIn, Check, X, DollarSign, History, FileSpreadsheet, Printer, Share2, Send,
  Camera, FileText, Image, CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase';
import { auth, handleFirestoreError, OperationType, convertKeysToSnake } from '../database';
import { 
  Employee, Transaction, AttendanceRecord, AdvanceRecord, 
  CompanySettings, UserProfile, RolePermissions 
} from '../types';
import { Button, Card, Modal, ConfirmDialog, SortableHeader } from './ui';
import { cn, formatSafe } from '../lib/utils';
import { DEFAULT_PERMISSIONS } from '../constants';
import { getApiUrl } from '../lib/api';

export const AttendanceTab = memo(function AttendanceTab({ 
  attendance, 
  employees, 
  users, 
  advances = [], 
  settings 
}: { 
  attendance: AttendanceRecord[], 
  employees: Employee[], 
  users: UserProfile[], 
  advances?: AdvanceRecord[], 
  settings: CompanySettings 
}) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');

  // Payslip module state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [salaryEmployeeId, setSalaryEmployeeId] = useState('');
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [bonusReason, setBonusReason] = useState<string>('');
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [penaltyReason, setPenaltyReason] = useState<string>('');

  useEffect(() => {
    if (employees.length > 0 && !salaryEmployeeId) {
      setSalaryEmployeeId(employees[0].id);
    }
  }, [employees, salaryEmployeeId]);

  const handleClockOut = async (id: string) => {
    try {
      const { error } = await supabase.from('attendance').update({
        clock_out: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const handleExpressClockIn = async (employeeId: string) => {
    try {
      const targetUser = users.find(u => u.employeeId === employeeId);
      const targetEmp = employees.find(e => e.id === employeeId);
      const now = new Date();
      const newId = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase.from('attendance').insert({
        id: newId,
        user_id: targetUser?.uid || null,
        employee_id: employeeId,
        employee_name: targetEmp?.name || 'Inconnu',
        date: format(now, 'yyyy-MM-dd'),
        clock_in: now.toISOString(),
        status: 'present'
      });
      if (error) throw error;
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayRecords = attendance.filter(r => r.date === todayStr);

  const filteredAttendance = attendance
    .filter(record => {
      const recordMonth = record.date.substring(0, 7);
      if (recordMonth !== selectedMonth) return false;
      if (selectedEmployeeFilter !== 'all' && record.employeeId !== selectedEmployeeFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Dynamic Payroll calculation engine
  const computedPayroll = useMemo(() => {
    const targetEmpId = salaryEmployeeId || (employees[0]?.id || '');
    if (!targetEmpId) return null;

    const emp = employees.find(e => e.id === targetEmpId);
    if (!emp) return null;

    const empAttendance = attendance.filter(r => r.employeeId === targetEmpId && r.date.substring(0, 7) === selectedMonth);
    const workedDays = empAttendance.length;
    const latenessCount = empAttendance.filter(r => r.status === 'late').length;

    const totalHoursWorked = empAttendance.reduce((acc, r) => {
      if (r.clockIn && r.clockOut) {
        const dur = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / (1000 * 60 * 60);
        return acc + (dur > 0 ? dur : 0);
      }
      return acc;
    }, 0);

    const empAdvances = advances.filter(a => a.employeeId === targetEmpId && a.date.substring(0, 7) === selectedMonth && (a.status === 'approved' || a.status === 'paid'));
    const advancesTotal = empAdvances.reduce((acc, a) => acc + (a.amount || 0), 0);

    let calculatedSalary = emp.baseSalary !== undefined ? emp.baseSalary : 3000;
    let salaryTypeLabel = 'Mensuel Fixe';
    let salaryBasisText = `Fixe`;

    if (emp.salaryType === 'hourly') {
      const rate = emp.hourlyRate !== undefined ? emp.hourlyRate : 15;
      calculatedSalary = totalHoursWorked * rate;
      salaryTypeLabel = 'Taux Horaire';
      salaryBasisText = `${totalHoursWorked.toFixed(2)}h @ ${rate.toFixed(2)} ${settings.currency}/h`;
    } else if (emp.salaryType === 'daily') {
      const rate = emp.dailyRate !== undefined ? emp.dailyRate : 120;
      calculatedSalary = workedDays * rate;
      salaryTypeLabel = 'Taux Journalier';
      salaryBasisText = `${workedDays} j @ ${rate.toFixed(2)} ${settings.currency}/j`;
    } else {
      salaryBasisText = `Fixe ${calculatedSalary.toFixed(2)} ${settings.currency}/m`;
    }

    return {
      employee: emp,
      role: emp.role || 'Personnel',
      salaryTypeLabel,
      salaryBasisText,
      calculatedSalary,
      workedDays,
      totalHoursWorked,
      latenessCount,
      advancesTotal,
      empAdvances
    };
  }, [salaryEmployeeId, selectedMonth, attendance, employees, advances, settings]);

  const handleExportCSV = () => {
    if (filteredAttendance.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const headers = ["Employe", "Email", "Date", "Heure Arrivee", "Heure Depart", "Duree (heures)", "Statut"];
    const csvContent = [
      headers.join(","),
      ...filteredAttendance.map(record => {
        const emp = employees.find(e => e.id === record.employeeId);
        let durationStr = '0';
        if (record.clockIn && record.clockOut) {
          const durationMs = new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime();
          durationStr = (durationMs / (1000 * 60 * 60)).toFixed(2);
        }

        const empName = emp?.name || record.employeeName || 'Inconnu';
        const empEmail = emp?.email || 'N/A';
        const arrTime = record.clockIn ? formatSafe(record.clockIn, 'HH:mm') : '-';
        const depTime = record.clockOut ? formatSafe(record.clockOut, 'HH:mm') : '-';
        const statusStr = record.status === 'present' ? 'PRESENT' : record.status === 'late' ? 'RETARD' : 'ABSENT';

        return [
          `"${empName.replace(/"/g, '""')}"`,
          `"${empEmail.replace(/"/g, '""')}"`,
          `"${record.date}"`,
          `"${arrTime}"`,
          `"${depTime}"`,
          durationStr,
          statusStr
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexus_pointage_${selectedMonth}_${selectedEmployeeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPayslip = () => {
    if (!computedPayroll) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles pour imprimer la fiche de paie.");
      return;
    }
    const empName = computedPayroll.employee.name;
    const netAmount = (computedPayroll.calculatedSalary + bonusAmount - (computedPayroll.advancesTotal + penaltyAmount)).toFixed(2);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Fiche de Paie - ${empName.toUpperCase()}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px; color: #222; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 45px; border-bottom: 2px solid #111; padding-bottom: 25px; }
            .header h1 { margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; }
            .header p { margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
            .details-table td { padding: 10px 8px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
            .details-table td.label { font-weight: 800; text-transform: uppercase; color: #555; width: 160px; }
            .salary-table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
            .salary-table th { background-color: #111; color: #fff; border-bottom: 1px solid #111; padding: 14px 12px; font-size: 11px; text-transform: uppercase; text-align: left; letter-spacing: 1px; }
            .salary-table td { padding: 14px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
            .salary-table td.number { text-align: right; font-family: monospace; font-size: 13px; font-weight: bold; }
            .salary-table th.number { text-align: right; }
            .total-row { font-weight: bold; background-color: #fafafa; font-size: 14px; }
            .total-row td { border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 18px 12px; }
            .footer { margin-top: 80px; display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; color: #666; }
            .signature-box { border-top: 1px solid #aaa; width: 220px; text-align: center; padding-top: 12px; margin-top: 60px; font-weight: bold; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BULLETIN DE PAIE</h1>
            <p>${settings.name || 'NEXUS AUTOMATION'} - SYSTEME DE POINTAGE & PAIE</p>
          </div>
          
          <table class="details-table">
            <tr>
              <td class="label">Bénéficiaire</td>
              <td><strong>${empName.toUpperCase()}</strong></td>
              <td class="label">Période de Paie</td>
              <td><strong>${selectedMonth}</strong></td>
            </tr>
            <tr>
              <td class="label">Rôle / Poste</td>
              <td>${computedPayroll.role.toUpperCase()}</td>
              <td class="label">Date d'édition</td>
              <td>${new Date().toLocaleDateString('fr-FR')}</td>
            </tr>
            <tr>
              <td class="label">Mode Contrat</td>
              <td>${computedPayroll.salaryTypeLabel.toUpperCase()}</td>
              <td class="label">Devise de compte</td>
              <td>${settings.currency.toUpperCase()}</td>
            </tr>
            <tr>
              <td class="label">Mail / Contact</td>
              <td>${computedPayroll.employee.email || 'N/A'}</td>
              <td class="label">Téléphone</td>
              <td>${computedPayroll.employee.phone || 'N/A'}</td>
            </tr>
          </table>

          <table class="salary-table">
            <thead>
              <tr>
                <th>Rubrique de Paie</th>
                <th class="number" style="width: 140px;">Gains / Brut (${settings.currency})</th>
                <th class="number" style="width: 140px;">Retenues (${settings.currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Salaire de base (${computedPayroll.salaryBasisText})</td>
                <td class="number">${computedPayroll.calculatedSalary.toFixed(2)}</td>
                <td class="number">-</td>
              </tr>
              ${bonusAmount > 0 ? `
              <tr>
                <td>Primes & Indemnités (${bonusReason || 'Bonus Exceptionnel'})</td>
                <td class="number">${bonusAmount.toFixed(2)}</td>
                <td class="number">-</td>
              </tr>
              ` : ''}
              ${computedPayroll.advancesTotal > 0 ? `
              <tr>
                <td>Acompte perçu déduit (Avance sur salaire)</td>
                <td class="number">-</td>
                <td class="number">${computedPayroll.advancesTotal.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${penaltyAmount > 0 ? `
              <tr>
                <td>Retenue sur salaire (${penaltyReason || 'Pénalité / Heures manquantes'})</td>
                <td class="number">-</td>
                <td class="number">${penaltyAmount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td>NET À PAYER TOTAL (VIREMENT NET)</td>
                <td class="number" colspan="2" style="text-align: right; color: #111; font-size: 18px; font-family: monospace;">${netAmount} ${settings.currency}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 40px; font-size: 11px; color: #444; font-style: italic; background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 3px solid #111;">
            <strong>MÉTRIQUES DE POINTAGE ARCHIVÉES :</strong><br/>
            • Total heures travaillées : <strong>${computedPayroll.totalHoursWorked.toFixed(2)} Heures</strong><br/>
            • Jours de présence enregistrés : <strong>${computedPayroll.workedDays} Jours</strong><br/>
            • Retards cumulés de la période : <strong>${computedPayroll.latenessCount} Fois</strong>
          </div>

          <div class="footer">
            <div class="signature-box">Signature du Salarié<br/><span style="font-size:9px; font-weight:normal; color:#777;">(Précédé de la mention "Lu et approuvé")</span></div>
            <div class="signature-box">Cachet de l'Employeur</div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppShare = () => {
    if (!computedPayroll) return;
    const empName = computedPayroll.employee.name;
    const netAmount = (computedPayroll.calculatedSalary + bonusAmount - (computedPayroll.advancesTotal + penaltyAmount)).toFixed(2);
    
    const message = `*NEXUS POS - BULLETIN DE PAIE* 🧾\n` +
      `*Employé(e) :* ${empName.toUpperCase()}\n` +
      `*Période :* ${selectedMonth}\n` +
      `----------------------------------------\n` +
      `*Contrat :* ${computedPayroll.salaryTypeLabel}\n` +
      `*Présences :* ${computedPayroll.workedDays} jours (${computedPayroll.totalHoursWorked.toFixed(2)}h)\n` +
      `*Retards cumulés :* ${computedPayroll.latenessCount} fois\n\n` +
      `*COMPOSITION DU SALAIRE :*\n` +
      `• Salaire de base : ${computedPayroll.calculatedSalary.toFixed(2)} ${settings.currency}\n` +
      (bonusAmount > 0 ? `• Prime / Indemnité : +${bonusAmount.toFixed(2)} ${settings.currency} (${bonusReason || 'Bonus'})\n` : '') +
      (computedPayroll.advancesTotal > 0 ? `• Acomptes reçus : -${computedPayroll.advancesTotal.toFixed(2)} ${settings.currency}\n` : '') +
      (penaltyAmount > 0 ? `• Retenues sur paie : -${penaltyAmount.toFixed(2)} ${settings.currency} (${penaltyReason || 'Retenue'})\n` : '') +
      `----------------------------------------\n` +
      `*SOLDE NET À PAYER :* *${netAmount} ${settings.currency}*\n` +
      `----------------------------------------\n` +
      `_Généré par le système Nexus POS Pro_ ⚡`;

    const encodedText = encodeURIComponent(message);
    const phone = computedPayroll.employee.phone ? computedPayroll.employee.phone.replace(/\s+/g, '') : '';
    
    let whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    if (phone) {
      whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
    }
    window.open(whatsappUrl, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Pointage Express Section */}
      <Card className="border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
           <Clock size={160} className="text-indigo-400 rotate-12" />
        </div>
        
        <div className="flex items-center gap-6 mb-10 relative z-10">
          <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-neon-indigo/20">
            <Clock size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Pointage Digital<span className="text-indigo-500">.nexus</span></h3>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mt-1">Real-time attendance tracking</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 relative z-10">
          {employees.map(emp => {
            const activeRecord = todayRecords.find(r => r.employeeId === emp.id && !r.clockOut);
            const isClockedIn = !!activeRecord;

            return (
              <motion.button
                key={emp.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => isClockedIn ? handleClockOut(activeRecord!.id) : handleExpressClockIn(emp.id)}
                className={cn(
                  "p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all border group shadow-xl",
                  isClockedIn 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 shadow-rose-500/5"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-emerald-500/5"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all border shadow-lg",
                  isClockedIn ? "bg-rose-500/20 border-rose-400/20 text-rose-300" : "bg-emerald-500/20 border-emerald-400/20 text-emerald-300"
                )}>
                  {isClockedIn ? <LogOut size={28} /> : <LogIn size={28} />}
                </div>
                <div className="text-center w-full">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{isClockedIn ? 'Sortie' : 'Entrée'}</p>
                  <p className="text-[11px] font-black uppercase tracking-widest truncate w-full">{emp.name}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col xl:flex-row justify-between items-end gap-6 mt-12 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
        <div>
          <h4 className="font-black text-white italic uppercase tracking-wider flex items-center gap-2">
            <History size={18} className="text-indigo-400" />
            Historique de Pointage
          </h4>
          <p className="text-[10px] font-black text-white/30 tracking-[0.2em] mt-1 uppercase">ARCHIVE & VERIFIED RECORDS</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Période</label>
            <input 
              type="month" 
              className="px-6 py-3 bg-black/40 border border-white/10 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Employé</label>
            <select
              className="px-6 py-3 bg-black/40 border border-white/10 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={selectedEmployeeFilter}
              onChange={e => setSelectedEmployeeFilter(e.target.value)}
            >
              <option value="all">TOUS LES EMPLOYÉS</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 items-center pt-5 sm:pt-0">
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-indigo-500/20"
              title="Exporter l'historique en format tableur CSV"
            >
              <FileSpreadsheet size={14} /> EXPORTER CSV
            </button>
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
              title="Générer les bulletins de paie et les rapports mensuels"
            >
              <DollarSign size={14} /> BULLETIN & PAIE
            </button>
          </div>
        </div>
      </div>
      
      <Card className="overflow-hidden border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-white/30 uppercase border-b border-white/5">
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">EMPLOYÉ</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">DATE</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">ARRIVÉE</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">DÉPART</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">DURÉE</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">STATUT</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAttendance.map((record, idx) => {
                const emp = employees.find(e => e.id === record.employeeId);
                let hoursWorked = '-';
                if (record.clockIn && record.clockOut) {
                   const durationMs = new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime();
                   const hours = durationMs / (1000 * 60 * 60);
                   hoursWorked = hours > 0 ? hours.toFixed(2) + 'h' : '-';
                }
                return (
                  <motion.tr 
                    key={record.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="p-6 font-black text-[11px] text-white">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-xs text-indigo-400 font-black uppercase border border-white/10 shadow-lg group-hover:border-indigo-500 transition-colors">
                          {(emp?.name || record.employeeName || '?').charAt(0)}
                        </div>
                        <div className="flex flex-col">
                           <span className="uppercase tracking-widest">{emp?.name || record.employeeName || 'Inconnu'}</span>
                           <span className="text-[9px] text-white/20 tracking-[0.2em]">ID: {record.employeeId.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-[11px] text-white/60 font-black tracking-[0.1em]">{format(new Date(record.date), 'dd MMMM yyyy', { locale: fr }).toUpperCase()}</td>
                    <td className="p-6">
                       <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-black text-sm tracking-tighter border border-emerald-500/10">
                          {formatSafe(record.clockIn, 'HH:mm')}
                       </span>
                    </td>
                    <td className="p-6">
                       {record.clockOut ? (
                         <span className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 font-black text-sm tracking-tighter border border-rose-500/10">
                            {formatSafe(record.clockOut, 'HH:mm')}
                         </span>
                       ) : (
                         <span className="text-[10px] font-black text-white/20 uppercase tracking-widest italic animate-pulse">Running...</span>
                       )}
                    </td>
                    <td className="p-6 text-base font-black text-indigo-400 tracking-tighter">{hoursWorked}</td>
                    <td className="p-6">
                      <span className={cn("px-4 py-1.5 text-[9px] font-black rounded-full uppercase tracking-[0.2em] border shadow-xl flex items-center gap-2 w-fit", 
                        record.status === 'present' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        record.status === 'late' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", record.status === 'present' ? "bg-emerald-400" : record.status === 'late' ? "bg-amber-400" : "bg-rose-400")} />
                        {record.status === 'present' ? 'PRÉSENT' : record.status === 'late' ? 'EN RETARD' : record.status === 'absent' ? 'ABSENT' : 'PRÉSENT'}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {!record.clockOut && record.status !== 'absent' && (
                        <button 
                          onClick={() => handleClockOut(record.id)} 
                          className="px-6 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"
                        >
                          POINTER SORTIE
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20 mb-4">
                        <Calendar size={32} />
                      </div>
                      <p className="font-black text-white uppercase tracking-widest">Aucun pointage archivé</p>
                      <p className="text-[10px] font-black text-white/30 uppercase mt-2 tracking-widest italic">Nexus pointage system v4.0</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modern Payroll & Bulletins Report Modal */}
      {isReportModalOpen && (
        <Modal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          title="RAPPORT DU PERSONNEL & BULLETIN DE PAIE"
        >
          <div className="p-2 space-y-6">
            <div className="p-6 bg-white/5 rounded-[1.8rem] border border-white/10 space-y-4">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Configuration du Salarié</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Salarié à auditer</label>
                  <select 
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[11px] font-black text-white uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                    value={salaryEmployeeId}
                    onChange={e => {
                      setSalaryEmployeeId(e.target.value);
                      setBonusAmount(0);
                      setBonusReason('');
                      setPenaltyAmount(0);
                      setPenaltyReason('');
                    }}
                  >
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Mois audité</label>
                  <input 
                    type="month"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-[11px] font-black text-white uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {computedPayroll ? (
              <div className="space-y-6">
                {/* Statistics bento grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mb-1">Présences</p>
                    <p className="text-lg font-black text-emerald-400 tracking-tighter">{computedPayroll.workedDays} <span className="text-[9px] text-white/30 font-bold">Jours</span></p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mb-1">Heures Travaillées</p>
                    <p className="text-lg font-black text-indigo-400 tracking-tighter">{computedPayroll.totalHoursWorked.toFixed(1)} <span className="text-[9px] text-white/30 font-bold">H</span></p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.15em] mb-1">Retards Enregistrés</p>
                    <p className="text-lg font-black text-rose-500 tracking-tighter">{computedPayroll.latenessCount} <span className="text-[9px] text-white/30 font-bold">Retard(s)</span></p>
                  </div>
                </div>

                {/* Adjustments: Adds custom prime and deduction */}
                <div className="p-6 bg-white/[0.02] rounded-[1.8rem] border border-white/5 space-y-4">
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 font-black leading-none">Ajustements Manuels Éphémères</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bonus Column */}
                    <div className="space-y-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Ajouter un Gain +</p>
                      <input 
                        type="number"
                        placeholder="Montant prime"
                        min="0"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] font-black text-white uppercase outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                        value={bonusAmount || ''}
                        onChange={e => setBonusAmount(parseFloat(e.target.value) || 0)}
                      />
                      <input 
                        type="text"
                        placeholder="Motif (ex: Prime de nuit)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] font-medium text-white/80 outline-none focus:ring-1 focus:ring-emerald-500 transition-all uppercase placeholder:text-white/20"
                        value={bonusReason}
                        onChange={e => setBonusReason(e.target.value)}
                      />
                    </div>
                    
                    {/* Penalty Column */}
                    <div className="space-y-3 p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Appliquer une Retenue -</p>
                      <input 
                        type="number"
                        placeholder="Montant retenue"
                        min="0"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] font-black text-white uppercase outline-none focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                        value={penaltyAmount || ''}
                        onChange={e => setPenaltyAmount(parseFloat(e.target.value) || 0)}
                      />
                      <input 
                        type="text"
                        placeholder="Motif (ex: Retenue absence)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] font-medium text-white/80 outline-none focus:ring-1 focus:ring-rose-500 transition-all uppercase placeholder:text-white/20"
                        value={penaltyReason}
                        onChange={e => setPenaltyReason(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Salary breakdown card */}
                <div className="p-6 bg-black/60 rounded-[1.8rem] border border-white/10 space-y-4">
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Calculateur de Paie en direct</p>
                  
                  <div className="space-y-3 text-[11px] font-black uppercase tracking-widest">
                    <div className="flex justify-between text-white/50">
                      <span>Salaire de base calculé :</span>
                      <span className="font-mono text-white">{computedPayroll.calculatedSalary.toFixed(2)} {settings.currency}</span>
                    </div>
                    {bonusAmount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>(+) Primes & Bonus :</span>
                        <span className="font-mono">{bonusAmount.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {computedPayroll.advancesTotal > 0 && (
                      <div className="flex justify-between text-rose-400/80">
                        <span>(-) Acomptes perçus (Automatique) :</span>
                        <span className="font-mono">-{computedPayroll.advancesTotal.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {penaltyAmount > 0 && (
                      <div className="flex justify-between text-rose-500">
                        <span>(-) Retenues diverses :</span>
                        <span className="font-mono">-{penaltyAmount.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
                      <span className="text-indigo-300 text-[10px]">SOLDE NET A RETIRER :</span>
                      <span className="text-xl font-black text-indigo-400 tracking-tighter font-mono">
                        {(computedPayroll.calculatedSalary + bonusAmount - (computedPayroll.advancesTotal + penaltyAmount)).toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Print and WhatsApp trigger controls */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handlePrintPayslip}
                    className="flex items-center justify-center gap-3 py-5 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-[0.98] shadow-lg"
                  >
                    <Printer size={16} /> IMPRIMER RAPPORT (PDF)
                  </button>

                  <button 
                    onClick={handleWhatsAppShare}
                    className="flex items-center justify-center gap-3 py-5 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 border border-emerald-500/20"
                  >
                    <Send size={16} /> PARTAGER WHATSAPP
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center font-black text-white/30 text-[11px] uppercase py-8 tracking-widest">Échec du chargement du bulletin de paie.</p>
            )}

            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="w-full py-4 text-white/40 hover:text-white text-[10px] uppercase font-black tracking-widest bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
            >
              Fermer le Panneau
            </button>
          </div>
        </Modal>
      )}
    </motion.div>
  );
});

export const AdvancesTab = memo(function AdvancesTab({ advances, employees, settings }: { advances: AdvanceRecord[], employees: Employee[], settings: CompanySettings }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newId = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase.from('advances').insert({
        id: newId,
        employee_id: formData.employeeId,
        amount: formData.amount,
        date: formData.date,
        reason: formData.reason,
        status: 'pending'
      });
      if (error) throw error;
      setIsModalOpen(false);
      setFormData({ employeeId: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), reason: '' });
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'paid') => {
    try {
      const { error } = await supabase.from('advances').update({ status }).eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
        <div>
          <h4 className="font-black text-white italic uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-400" />
            Gestion des Acomptes
          </h4>
          <p className="text-[10px] font-black text-white/30 tracking-[0.2em] mt-1 uppercase">EMPLOYEE ADVANCE PAYMENTS</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] hover:bg-emerald-600 transition-all shadow-neon-emerald/20 active:scale-95 group"
        >
          <Plus size={18} /> NOUVELLE DEMANDE
        </button>
      </div>

      <Card className="overflow-hidden border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-white/30 uppercase border-b border-white/5">
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">EMPLOYÉ</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">DATE</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em] text-right">MONTANT</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">MOTIF</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em]">STATUT</th>
                <th className="p-6 text-[10px] font-black tracking-[0.2em] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {advances.map((record, idx) => {
                const emp = employees.find(e => e.id === record.employeeId);
                return (
                  <motion.tr 
                    key={record.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="p-6 font-black text-[11px] text-white uppercase tracking-widest">{emp?.name || 'Inconnu'}</td>
                    <td className="p-6 text-[11px] text-white/60 font-black tracking-widest">{record.date}</td>
                    <td className="p-6 text-right">
                      <span className="text-lg font-black text-white tracking-tighter">{record.amount.toFixed(2)}</span>
                       <span className="text-[10px] font-black text-white/20 ml-1 uppercase">{settings.currency}</span>
                    </td>
                    <td className="p-6 text-[11px] text-white/60 max-w-[200px] truncate font-black tracking-widest italic opacity-40 uppercase">{record.reason || 'SANS MOTIF'}</td>
                    <td className="p-6">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-xl flex items-center gap-2 w-fit",
                        record.status === 'paid' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        record.status === 'approved' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", record.status === 'paid' ? "bg-emerald-400" : record.status === 'approved' ? "bg-indigo-400" : "bg-amber-400")} />
                        {record.status === 'approved' ? 'APPROUVÉ' : record.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {record.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                           <button onClick={() => updateStatus(record.id, 'approved')} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all shadow-lg active:scale-95"><Check size={18} /></button>
                           <button onClick={() => updateStatus(record.id, 'rejected' as any)} className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all shadow-lg active:scale-95"><X size={18} /></button>
                        </div>
                      )}
                      {record.status === 'approved' && (
                        <div className="flex justify-end gap-2">
                           <button 
                              onClick={() => updateStatus(record.id, 'paid')}
                              className="px-6 py-2 rounded-xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
                           >
                              MARQUER PAYÉ
                           </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
              {advances.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-20 text-center text-white/20">
                      <DollarSign size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="font-black text-sm uppercase tracking-widest">Aucun acompte enregistré</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Demander un Acompte">
        <form onSubmit={handleSubmit} className="p-2 space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Employé Bénéficiaire *</label>
            <select required className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})}>
              <option value="">Sélectionner un employé</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Montant ({settings.currency}) *</label>
              <input type="number" required min="0" step="0.01" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={isNaN(formData.amount) ? '' : formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Date de Valeur</label>
              <input type="date" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Justification / Motif</label>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-32" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
          </div>
          <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-neon-indigo/20 hover:bg-indigo-500 transition-all active:scale-[0.98]">
            ENREGISTRER LA DEMANDE
          </button>
        </form>
      </Modal>
    </motion.div>
  );
});

export function TeamManagement({ users, employees, settings, setIsAddUserModalOpen, defaultSubTab = 'users' }: { users: UserProfile[], employees: Employee[], settings: CompanySettings, setIsAddUserModalOpen: (v: boolean) => void, defaultSubTab?: 'users' | 'permissions' }) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'permissions'>(defaultSubTab);

  useEffect(() => {
    setActiveSubTab(defaultSubTab);
  }, [defaultSubTab]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUserDeleteConfirmOpen, setIsUserDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const roles: ('admin' | 'manager' | 'cashier' | 'delivery' | 'picker')[] = ['admin', 'manager', 'cashier', 'delivery', 'picker'];
  const permissionKeys: (keyof RolePermissions)[] = [
    'canAccessInventory',
    'canAccessSales',
    'canAccessCustomers',
    'canAccessEmployees',
    'canAccessSuppliers',
    'canAccessSettings',
    'canAccessOnlineOrders',
    'canAccessExpenses',
    'canAccessReturns',
    'canAccessPurchases',
    'canAccessPromotions',
    'canAccessVouchers',
    'canAccessAnalytics',
    'canAccessShifts',
    'canAccessAuditLogs',
    'canModifyPrices',
    'canApplyDiscount',
    'canVoidTransaction',
    'canManageUsers'
  ];

  const permissionLabels: Record<keyof RolePermissions, string> = {
    canAccessInventory: 'Inventaire',
    canAccessSales: 'Ventes / Caisse',
    canAccessCustomers: 'Clients',
    canAccessEmployees: 'Employés & Équipe',
    canAccessSuppliers: 'Fournisseurs',
    canAccessSettings: 'Paramètres Système',
    canAccessOnlineOrders: 'Commandes en Ligne',
    canAccessExpenses: 'Dépenses',
    canAccessReturns: 'Retours Produits',
    canAccessPurchases: 'Achats / Entrées Stock',
    canAccessPromotions: 'Promotions',
    canAccessVouchers: 'Bons d\'Achat',
    canAccessAnalytics: 'Analytique & Rapports',
    canAccessShifts: 'Sessions de Caisse',
    canAccessAuditLogs: 'Journaux d\'Audit',
    canModifyPrices: 'Modifier les Prix',
    canApplyDiscount: 'Appliquer des Remises',
    canVoidTransaction: 'Annuler des Transactions',
    canManageUsers: 'Gérer les Utilisateurs'
  };

  const handleTogglePermission = async (role: 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker', permission: keyof RolePermissions) => {
    if (role === 'admin') return; // Admin always has all permissions
    
    setIsProcessing(true);
    try {
      const currentPermissions = settings.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role];
      const newPermissions = {
        ...currentPermissions,
        [permission]: !currentPermissions[permission]
      };

      const updatedRolePermissions = {
        ...(settings.rolePermissions || {}),
        [role]: newPermissions
      };

      await supabase.from('settings').update({ role_permissions: updatedRolePermissions }).eq('id', 'global');
    } catch (error: any) {
      alert("Erreur: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker') => {
    setIsProcessing(true);
    try {
      await supabase.from('users').update({ role: newRole }).eq('id', userId);
      
      // Also update employee record if linked
      const userProfile = users.find(u => u.id === userId);
      if (userProfile?.employeeId) {
        await supabase.from('employees').update({ role: newRole }).eq('id', userProfile.employeeId);
      }
    } catch (error: any) {
      alert("Erreur: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUserToDelete(userId);
    setIsUserDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsProcessing(true);
    try {
      const userProfile = users.find(u => u.id === userToDelete);
      await supabase.from('users').delete().eq('id', userToDelete);
      // Also delete employee record if linked
      if (userProfile?.employeeId) {
        await supabase.from('employees').delete().eq('id', userProfile.employeeId);
      }
      setIsUserDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Delete user error:", error);
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurgeAll = async () => {
    const confirmation = window.confirm("⚠️ ZONE DE DANGER : Voulez-vous vraiment supprimer TOUS les employés et comptes d'accès (sauf le vôtre) ? Cette action est irréversible.");
    if (!confirmation) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserUid = user?.id;
      const ownerEmail = 'hrskader305@gmail.com';

      // Delete users (except self)
      const userVictims = users.filter(u => u.uid !== currentUserUid && u.email !== ownerEmail);
      for (const u of userVictims) {
        if (u.id) {
          const profile = users.find(usr => usr.id === u.id);
          await supabase.from('users').delete().eq('id', u.id);
          if (profile?.employeeId) {
            await supabase.from('employees').delete().eq('id', profile.employeeId);
          }
        }
      }

      alert("Purge terminée avec succès.");
    } catch (error: any) {
      alert("Erreur lors de la purge: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
        <div>
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Gestion de l'Équipe<span className="text-indigo-500">.nexus</span></h3>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mt-1">Access Control & Role Allocation</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            <button 
              onClick={() => setActiveSubTab('users')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                activeSubTab === 'users' ? "bg-indigo-600 text-white shadow-neon-indigo" : "text-white/40 hover:text-white/70"
              )}
            >
              COMPTES
            </button>
            <button 
              onClick={() => setActiveSubTab('permissions')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                activeSubTab === 'permissions' ? "bg-indigo-600 text-white shadow-neon-indigo" : "text-white/40 hover:text-white/70"
              )}
            >
              PERMISSIONS
            </button>
          </div>
          
          {auth.currentUser?.email === 'hrskader305@gmail.com' && (
            <button 
              onClick={handlePurgeAll}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl hover:bg-rose-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95"
            >
              <Trash2 size={16} />
              PURGE TOTALE
            </button>
          )}

          <button 
            onClick={() => setIsAddUserModalOpen(true)}
            className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-2xl shadow-xl hover:bg-indigo-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            AJOUTER MEMBRE
          </button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 bg-indigo-500/5 border border-indigo-500/10 rounded-[2.5rem] flex gap-6 relative overflow-hidden group"
          >
            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-neon-indigo/20 shrink-0">
              <ShieldCheck size={28} />
            </div>
            <div className="text-[11px] font-black tracking-widest uppercase relative z-10">
              <p className="text-indigo-400 mb-2 italic">Différence entre "Personnel" et "Accès"</p>
              <p className="text-white/60 leading-relaxed max-w-2xl">
                L'onglet <span className="text-white">Personnel</span> gère l'aspect administratif, tandis que les <span className="text-white">Comptes</span> définissent qui peut s'authentifier et avec quel niveau de pouvoir.
              </p>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          </motion.div>

          <Card className="overflow-hidden bg-white/5 border-white/5 backdrop-blur-md rounded-[2.5rem] shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-white/30 uppercase border-b border-white/5">
                    <th className="p-6 text-[10px] font-black tracking-[0.2em]">UTILISATEUR</th>
                    <th className="p-6 text-[10px] font-black tracking-[0.2em]">IDENTIFIANTS</th>
                    <th className="p-6 text-[10px] font-black tracking-[0.2em]">MOT DE PASSE</th>
                    <th className="p-6 text-[10px] font-black tracking-[0.2em]">RÔLE & ACCÈS</th>
                    <th className="p-6 text-[10px] font-black tracking-[0.2em]">STATUT</th>
                    <th className="p-6 text-[10px] font-black tracking-[0.2em] text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u, idx) => {
                    const employee = employees.find(e => e.id === u.employeeId);
                    return (
                      <motion.tr 
                        key={u.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-black/40 border border-white/10 text-white rounded-2xl flex items-center justify-center font-black text-lg group-hover:border-indigo-400 transition-colors shadow-xl">
                              {u.displayName.charAt(0)}
                            </div>
                            <div>
                               <span className="font-black text-white uppercase tracking-widest block">{u.displayName}</span>
                               <span className="text-[9px] text-white/20 tracking-[0.2em]">UID: {u.uid?.slice(0, 12)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col gap-1">
                            {u.email && <span className="text-[11px] font-black text-white/60 tracking-widest">{u.email}</span>}
                            {u.phone && <span className="text-[10px] font-black text-indigo-400 tracking-[0.2em]">TEL: {u.phone}</span>}
                            {!u.email && !u.phone && <span className="text-[9px] text-white/20 italic tracking-widest font-black uppercase">Aucun identifiant</span>}
                          </div>
                        </td>
                        <td className="p-6">
                          {u.password ? (
                            <div className="flex items-center gap-3">
                              <code className="text-[10px] font-black tracking-[0.2em] bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 text-emerald-400 shadow-inner">
                                {u.password}
                              </code>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(u.password || '');
                                  alert("Mot de passe copié !");
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/20 hover:text-white transition-all border border-white/5"
                                title="Copier"
                              >
                                <CardIcon size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest italic">
                               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                               OAuth Google
                            </div>
                          )}
                        </td>
                        <td className="p-6">
                          <select 
                            value={u.role}
                            disabled={isProcessing}
                            onChange={(e) => handleUpdateUserRole(u.id!, e.target.value as any)}
                            className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-white uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                          >
                            {roles.map(r => (
                              <option key={r} value={r} className="bg-slate-900">{r.toUpperCase()}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-6">
                          <span className={cn(
                            "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-xl border",
                            employee?.status === 'inactive' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {employee?.status?.toUpperCase() || 'ACTIF'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-indigo-400 rounded-xl transition-all border border-white/5 shadow-lg" onClick={() => setViewedUser(u)}>
                              <Eye size={18} />
                            </button>
                            <button 
                              className={cn(
                                "p-3 rounded-xl transition-all border shadow-lg", 
                                u.uid === auth.currentUser?.uid 
                                  ? "bg-white/5 text-white/10 border-white/5 cursor-not-allowed" 
                                  : "bg-white/5 hover:bg-rose-500/10 text-white/40 hover:text-rose-500 border-white/5 hover:border-rose-500/30"
                              )}
                              onClick={() => u.uid !== auth.currentUser?.uid && handleDeleteUser(u.id!)}
                              disabled={u.uid === auth.currentUser?.uid}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
          {roles.map((role, idx) => {
            const permissions = settings.rolePermissions?.[role] || DEFAULT_PERMISSIONS[role];
            return (
              <motion.div
                key={role}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-8 border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-transform duration-500 group-hover:rotate-12",
                        role === 'admin' ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/20 shadow-neon-indigo/20" : 
                        role === 'manager' ? "bg-amber-500/20 text-amber-400 border-amber-500/20" : 
                        "bg-white/5 text-white/40 border-white/10"
                      )}>
                        <Shield size={28} />
                      </div>
                      <div>
                        <h4 className="font-black text-white uppercase tracking-widest text-lg">{role}</h4>
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.22em] mt-0.5 italic">Nexus Permission Profile</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {permissionKeys.map(key => (
                      <div key={key} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/[0.03] hover:border-white/10 transition-colors">
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{permissionLabels[key]}</span>
                        <button
                          disabled={role === 'admin' || isProcessing}
                          onClick={() => handleTogglePermission(role, key)}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none disabled:opacity-30 active:scale-90",
                            permissions[key] ? "bg-indigo-600 shadow-neon-indigo/40" : "bg-white/10 border border-white/10"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300",
                            permissions[key] ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {role === 'admin' && (
                    <div className="mt-8 p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                      <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-loose text-center italic">
                         ACCÈS NO-LIMIT : Le rôle Administrateur est protégé par le noyau Nexus System. Toutes les permissions sont actives nativement.
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 blur-[40px] pointer-events-none rounded-full -mb-12 -mr-12" />
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog 
        isOpen={isUserDeleteConfirmOpen}
        onClose={() => setIsUserDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteUser}
        title="SUPPRIMER ACCÈS"
        message="Cette action désactivera immédiatement la clé d'accès Nexus pour cet utilisateur. Les données de l'employé lié resteront en archive."
      />

      {viewedUser && (
        <Modal
          isOpen={!!viewedUser}
          onClose={() => setViewedUser(null)}
          title="IDENTITY PROFILE"
        >
          <div className="p-2 space-y-8">
             <div className="flex items-center gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
               <div className="w-20 h-20 bg-indigo-600 text-white rounded-[1.8rem] flex items-center justify-center font-black text-3xl shadow-neon-indigo/40 border border-indigo-400/30">
                 {viewedUser.displayName.charAt(0)}
               </div>
               <div>
                  <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">{viewedUser.displayName}</h4>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1">{viewedUser.role}</p>
               </div>
             </div>

             <div className="space-y-4">
               {[
                 { label: 'Nexus UID', value: viewedUser.uid || 'N/A', mono: true },
                 { label: 'Verified Email', value: viewedUser.email || 'N/A' },
                 { label: 'Last Authentication', value: viewedUser.lastLogin ? format(new Date(viewedUser.lastLogin), 'dd MMMM yyyy @ HH:mm', { locale: fr }).toUpperCase() : 'NEVER REGISTERED' }
               ].map((item, i) => (
                 <div key={i} className="p-5 bg-black/40 border border-white/10 rounded-[1.5rem] flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{item.label}</span>
                    <span className={cn("text-xs font-black text-white tracking-widest uppercase", item.mono && "font-mono text-indigo-400 tracking-normal")}>{item.value}</span>
                 </div>
               ))}
             </div>

             <button className="w-full py-5 rounded-[1.5rem] bg-white/10 text-white font-black text-[11px] uppercase tracking-[0.3em] hover:bg-white/20 transition-all border border-white/10 shadow-xl" onClick={() => setViewedUser(null)}>
               CLOSE PROFILE
             </button>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}

export const Employees = memo(function Employees({ employees, transactions, attendance, advances, settings, users, setIsAddUserModalOpen }: { employees: Employee[], transactions: Transaction[], attendance: AttendanceRecord[], advances: AdvanceRecord[], settings: CompanySettings, users: UserProfile[], setIsAddUserModalOpen: (v: boolean) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [hrTab, setHrTab] = useState<'info' | 'attendance' | 'advances' | 'team' | 'permissions'>('info');
  const [formData, setFormData] = useState({
    name: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier' | 'delivery' | 'picker' | 'camera_agent',
    phone: '',
    email: '',
    password: '', // New field for access
    hireDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'active' as 'active' | 'inactive',
    baseSalary: 3000,
    salaryType: 'monthly' as 'monthly' | 'hourly' | 'daily',
    hourlyRate: 15,
    dailyRate: 120,
    idCardRectoUrl: '',
    idCardVersoUrl: '',
    contractUrl: '',
    digitalSignatureUrl: ''
  });

  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        name: editingEmployee.name || '',
        role: editingEmployee.role || 'cashier',
        phone: editingEmployee.phone || '',
        email: editingEmployee.email || '',
        password: '', // Admin can set a new password
        hireDate: editingEmployee.hireDate || format(new Date(), 'yyyy-MM-dd'),
        status: editingEmployee.status || 'active',
        baseSalary: editingEmployee.baseSalary !== undefined ? editingEmployee.baseSalary : 3000,
        salaryType: editingEmployee.salaryType || 'monthly',
        hourlyRate: editingEmployee.hourlyRate !== undefined ? editingEmployee.hourlyRate : 15,
        dailyRate: editingEmployee.dailyRate !== undefined ? editingEmployee.dailyRate : 120,
        idCardRectoUrl: editingEmployee.idCardRectoUrl || '',
        idCardVersoUrl: editingEmployee.idCardVersoUrl || '',
        contractUrl: editingEmployee.contractUrl || '',
        digitalSignatureUrl: editingEmployee.digitalSignatureUrl || ''
      });
    } else {
      setFormData({ 
        name: '', 
        role: 'cashier', 
        phone: '', 
        email: '', 
        password: '', 
        hireDate: format(new Date(), 'yyyy-MM-dd'), 
        status: 'active',
        baseSalary: 3000,
        salaryType: 'monthly',
        hourlyRate: 15,
        dailyRate: 120,
        idCardRectoUrl: '',
        idCardVersoUrl: '',
        contractUrl: '',
        digitalSignatureUrl: ''
      });
    }
  }, [editingEmployee]);

  const [recruitmentTab, setRecruitmentTab] = useState<'info' | 'identity' | 'contract'>('info');
  const [cameraActiveSection, setCameraActiveSection] = useState<'recto' | 'verso' | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isSignDrawing, setIsSignDrawing] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      setRecruitmentTab('info');
      setCameraActiveSection(null);
      setSignatureSaved(false);
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.error("Error stopping camera track", e);
        }
      }
    }
  }, [isModalOpen]);

  // Camera stream controls
  const startCamera = async (section: 'recto' | 'verso') => {
    setCameraActiveSection(section);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Error playing video stream", e));
        }
      } catch (err) {
        console.error("Camera access failed", err);
        alert("Impossible d'activer la caméra. Veuillez sélectionner une image manuellement.");
        setCameraActiveSection(null);
      }
    }, 120);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.error("Error stopping camera", e);
      }
    }
    setCameraActiveSection(null);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      if (cameraActiveSection === 'recto') {
        setFormData(prev => ({ ...prev, idCardRectoUrl: dataUrl }));
      } else {
        setFormData(prev => ({ ...prev, idCardVersoUrl: dataUrl }));
      }
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, section: 'recto' | 'verso') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (section === 'recto') {
          setFormData(prev => ({ ...prev, idCardRectoUrl: base64String }));
        } else {
          setFormData(prev => ({ ...prev, idCardVersoUrl: base64String }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getCanvasCoords = (canvas: HTMLCanvasElement, e: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale coordinates accurately based on actual HTML dynamic width/height vs CSS bounding rect
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Canvas drawing controls
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable) {
      e.preventDefault();
    }
    
    ctx.beginPath();
    const coords = getCanvasCoords(canvas, e);
    ctx.moveTo(coords.x, coords.y);
    setIsSignDrawing(true);
  };

  const drawSign = (e: any) => {
    if (!isSignDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable) {
      e.preventDefault();
    }
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Use high-contrast ink color that is perfect for printing/viewing in both light and dark mode, but adaptive
    ctx.strokeStyle = document.documentElement.classList.contains('light') ? '#1e1b4b' : '#a5b4fc';
    
    const coords = getCanvasCoords(canvas, e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsSignDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData(prev => ({ ...prev, digitalSignatureUrl: '' }));
    setSignatureSaved(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setFormData(prev => ({ ...prev, digitalSignatureUrl: dataUrl }));
    setSignatureSaved(true);
  };

  const employeePerformance = useMemo(() => {
    const perfMap: Record<string, { totalSales: number, transactionCount: number }> = {};
    
    employees.forEach(emp => {
      perfMap[emp.id] = { totalSales: 0, transactionCount: 0 };
    });

    transactions.forEach(t => {
      if (t.employeeId && perfMap[t.employeeId]) {
        perfMap[t.employeeId].totalSales += t.total;
        perfMap[t.employeeId].transactionCount += 1;
      }
    });

    return perfMap;
  }, [employees, transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      alert("Tous les champs marqués d'une étoile (*) sont obligatoires.");
      return;
    }

    try {
      const { password, ...rawFirestoreData } = formData;
      
      const firestoreData = {
        ...rawFirestoreData,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone
      };
      
      const snakeData = convertKeysToSnake(firestoreData);
      // Remove any unwanted fields like password if they leaked
      delete snakeData.password;
      delete (snakeData as any).updated_at;

      let docId = editingEmployee?.id;
      
      if (editingEmployee) {
        await supabase.from('employees').update(snakeData).eq('id', editingEmployee.id);
      } else {
        const newId = Math.random().toString(36).substring(2, 10);
        await supabase.from('employees').insert({ id: newId, ...snakeData });
        docId = newId;
      }

      // 🤝 Sync profile to 'users' table so the database records the workspace account!
      try {
        const { data: allUsers } = await supabase.from('users').select('*');
        const matchedUser = allUsers?.find(u => u.employee_id === docId || (u.email && u.email.toLowerCase().trim() === trimmedEmail));
        
        const bcryptHash = password ? bcrypt.hashSync(password, 10) : undefined;
        
        if (matchedUser) {
          await supabase.from('users').update({
            display_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            role: formData.role,
            ...(password ? { password_hash: bcryptHash } : {})
          }).eq('id', matchedUser.id);
        } else {
          const newId = Math.random().toString(36).substring(2, 10);
          await supabase.from('users').insert({
            id: newId,
            uid: `auth-${Date.now()}`,
            display_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            password_hash: bcryptHash || '',
            role: formData.role,
            employee_id: docId,
            created_at: new Date().toISOString()
          });
        }
      } catch (userSyncErr) {
        console.error("Failed to sync user database profile:", userSyncErr);
      }

      // Sync Auth if password is provided
      if (password && docId) {
        // Cache credentials locally for offline fallback
        try {
          const bcryptHash = bcrypt.hashSync(password, 10);
          const offlineCreds = JSON.parse(localStorage.getItem('nexus_offline_credentials') || '{}');
          const trimmedPhone = formData.phone ? formData.phone.trim() : '';
          const credRecord = {
            displayName: formData.name,
            email: formData.email ? formData.email.trim() : '',
            phone: trimmedPhone,
            hash: bcryptHash,
            role: formData.role,
            employeeId: docId
          };
          if (formData.email) offlineCreds[formData.email.trim().toLowerCase()] = credRecord;
          if (trimmedPhone) offlineCreds[trimmedPhone] = credRecord;
          // Also set internal virtual email fallback
          const internalEmail = formData.email || `${trimmedPhone.replace(/\s+/g, '')}@nexus-pos.internal`;
          if (internalEmail) offlineCreds[internalEmail.toLowerCase()] = credRecord;

          localStorage.setItem('nexus_offline_credentials', JSON.stringify(offlineCreds));
        } catch (offlineErr) {
          console.error("Failed to store employee offline credentials", offlineErr);
        }

        try {
          const idToken = auth.currentUser?.getIdToken ? await auth.currentUser.getIdToken() : 'mock-token';
          const response = await fetch(getApiUrl('/api/employees/sync-auth'), {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              phone: formData.phone || formData.email || docId,
              password: password,
              displayName: formData.name,
              email: formData.email
            })
          });
          
          if (!response.ok) {
            const errData = await response.json();
            const errorMsg = errData.error || "Erreur de synchronisation du compte d'accès";
            if (errorMsg.includes('Identity Toolkit')) {
              alert("ERREUR CRITIQUE : L'API Identity Toolkit est désactivée. \n\nVeuillez l'activer ici : https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=247663396085\n\nL'employé est créé mais son mot de passe ne fonctionnera pas tant que l'API n'est pas activée.");
            } else {
              throw new Error(errorMsg);
            }
          }
        } catch (syncErr: any) {
          console.error("Auth sync failed", syncErr);
          alert("L'employé a été enregistré mais son compte d'accès n'a pas pu être créé: " + syncErr.message);
        }
      }

      setIsModalOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      handleFirestoreError(error, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      // API call to delete from Firebase Auth (legacy) - might need update in backend too
      try {
        const userEmail = employeeToDelete.email || `${employeeToDelete.phone?.replace(/\s+/g, '') || employeeToDelete.id}@nexus-pos.internal`;
        // Assuming we keep this part for now as it calls an API
        const { data: { session } } = await supabase.auth.getSession();
        const idToken = session?.access_token || 'mock-token';
        const res = await fetch('/api/employees/delete', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ email: userEmail })
        });
        if (!res.ok) {
          const data = await res.json();
          console.warn("Could not delete from Auth (might require Service Account):", data.error);
        }
      } catch (err) {
        console.error("Failed to delete auth account", err);
      }

      const { error } = await supabase.from('employees').delete().eq('id', employeeToDelete.id);
      if (error) throw error;
      
      setIsDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
    } catch (error: any) {
      alert("Erreur lors de la suppression: " + error.message);
    }
  };

  const sortedEmployeesPerformance = useMemo(() => {
    const raw = [...employees];
    if (sortConfig !== null) {
      raw.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        const perfA = employeePerformance[a.id] || { totalSales: 0, transactionCount: 0 };
        const perfB = employeePerformance[b.id] || { totalSales: 0, transactionCount: 0 };

        if (sortConfig.key === 'name') {
           aValue = a.name;
           bValue = b.name;
        } else if (sortConfig.key === 'transactions') {
           aValue = perfA.transactionCount;
           bValue = perfB.transactionCount;
        } else if (sortConfig.key === 'revenue') {
           aValue = perfA.totalSales;
           bValue = perfB.totalSales;
        } else if (sortConfig.key === 'average') {
           aValue = perfA.transactionCount > 0 ? perfA.totalSales / perfA.transactionCount : 0;
           bValue = perfB.transactionCount > 0 ? perfB.totalSales / perfB.transactionCount : 0;
        } else {
           aValue = a.name;
           bValue = b.name;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return raw;
  }, [employees, employeePerformance, sortConfig]);

  const handlePrintDossier = (employee: Employee) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles pour imprimer le dossier.");
      return;
    }
    const contractText = `CONTRAT DE TRAVAIL INDIVIDUEL (NEXUS POS PRO)

Entre l'employeur : ${settings.name || 'NEXUS AUTOMATION SAS'}
Et le salarié : ${employee.name ? employee.name.toUpperCase() : 'SALARIÉ'}

1. FONCTIONS ET ATTRIBUTIONS :
Le salarié est recruté en qualité de : ${employee.role?.toUpperCase() || 'COLLABORATEUR'}.

2. DATE D'ENTRÉE :
Le présent contrat prend effet à compter du : ${employee.hireDate || 'N/A'} pour une durée indéterminée.

3. SÉCURITÉ & CONNEXION :
Le salarié s'engage à respecter scrupuleusement la confidentialité des codes d'accès Nexus POS Pro générés au point de vente.

4. RÉMUNÉRATION :
Le type de rémunération convenu est : ${
      employee.salaryType === 'hourly' ? "TAUX HORAIRE" :
      employee.salaryType === 'daily' ? "TAUX JOURNALIER" : "MENSUEL FIXE"
    }.
La base de rémunération brute est fixée à : ${
      employee.salaryType === 'hourly' ? employee.hourlyRate :
      employee.salaryType === 'daily' ? employee.dailyRate : employee.baseSalary
    } ${settings.currency || 'DA'}.

Fait de manière numérique de plein accord des deux parties.`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Dossier Employé - ${employee.name.toUpperCase()}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 10px; color: #111; line-height: 1.6; }
            .badge { display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; }
            .header-title { font-size: 24px; font-weight: 950; letter-spacing: 1px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 30px; }
            .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 30px 0 15px 0; }
            .grid-docs { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .doc-box { border: 1px solid #eee; padding: 15px; text-align: center; background: #fafafa; border-radius: 12px; }
            .doc-box p { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin-top: 0; margin-bottom: 10px; }
            .doc-img { max-height: 200px; max-width: 100%; object-fit: contain; border-radius: 8px; border: 1px solid #ddd; background: #eee; }
            .contract-paper { font-family: monospace; white-space: pre-wrap; font-size: 11px; background: #fdfdfd; padding: 25px; border-left: 3px solid #6366f1; border-radius: 4px; border: 1px solid #eee; }
            .sig-grid { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; }
            .sig-box { border-top: 1px solid #aaa; width: 45%; text-align: center; font-size: 11px; text-transform: uppercase; padding-top: 10px; }
            .sig-img { max-height: 60px; object-fit: contain; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="badge">Dossier Numérique Certifié</div>
          <h1 class="header-title">Nexus Staff dossier : ${employee.name.toUpperCase()}</h1>
          
          <div class="section-title">Contrat de Travail Numérique</div>
          <div class="contract-paper">${contractText}</div>

          <div class="sig-grid">
            <div class="sig-box">
              <p>Signature de l'Employeur</p>
              <p style="font-style: italic; font-size: 12px; height: 40px; color: #777; display: flex; align-items: center; justify-content: center;">[Paraphe Électronique]</p>
            </div>
            <div class="sig-box">
              <p>Signature du Salarié</p>
              ${employee.digitalSignatureUrl ? `<img class="sig-img" src="${employee.digitalSignatureUrl}" />` : '<div style="height: 40px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">[NON SIGNÉ ENCORE]</div>'}
            </div>
          </div>

          <div class="section-title">Pièces Justificatives d'Identité</div>
          <div class="grid-docs">
            <div class="doc-box">
              <p>Pièce d'Identité (Recto)</p>
              ${employee.idCardRectoUrl ? `<img class="doc-img" src="${employee.idCardRectoUrl}" />` : '<div style="height: 120px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; border: 1px dashed #ccc; border-radius: 6px;">Image Non Fournie</div>'}
            </div>
            <div class="doc-box">
              <p>Pièce d'Identité (Verso)</p>
              ${employee.idCardVersoUrl ? `<img class="doc-img" src="${employee.idCardVersoUrl}" />` : '<div style="height: 120px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; border: 1px dashed #ccc; border-radius: 6px;">Image Non Fournie</div>'}
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
            Personnel<span className="text-indigo-500">.nexus</span>
          </h2>
          <p className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase mt-1">Management & Access Control</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white/5 p-1.5 rounded-[1.5rem] border border-white/10 backdrop-blur-md overflow-x-auto">
            {[
              { id: 'info', label: 'EMPLOYÉS' },
              { id: 'team', label: 'COMPTES' },
              { id: 'permissions', label: 'RÔLES' },
              { id: 'attendance', label: 'POINTAGE' },
              { id: 'advances', label: 'ACOMPTES' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setHrTab(tab.id as any)} 
                className={cn(
                  "px-6 py-2.5 rounded-[1.2rem] text-[10px] font-black tracking-widest transition-all whitespace-nowrap", 
                  hrTab === tab.id ? "bg-indigo-600 text-white shadow-neon-indigo" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button 
            onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" /> 
            NOUVEL EMPLOYÉ
          </button>
        </div>
      </div>

      {hrTab === 'info' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Performance Summary Section */}
          <Card className="overflow-hidden border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] shadow-2xl">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-neon-indigo/20">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h4 className="font-black text-white uppercase tracking-wider text-sm italic">Résumé des Performances</h4>
                  <p className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase mt-0.5">Sales Metrics & Efficiency</p>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <SortableHeader label="EMPLOYÉ" sortKey="name" currentSort={sortConfig} onSort={() => requestSort('name')} className="p-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]" />
                    <SortableHeader label="TRANSACTIONS" sortKey="transactions" currentSort={sortConfig} onSort={() => requestSort('transactions')} className="p-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center justify-center" />
                    <SortableHeader label="TOTAL VENTES" sortKey="revenue" currentSort={sortConfig} onSort={() => requestSort('revenue')} className="p-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right justify-end" />
                    <SortableHeader label="MOYENNE / VENTE" sortKey="average" currentSort={sortConfig} onSort={() => requestSort('average')} className="p-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right justify-end" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedEmployeesPerformance.map((employee: Employee, idx: number) => {
                    const perf = employeePerformance[employee.id] || { totalSales: 0, transactionCount: 0 };
                    const avgSale = perf.transactionCount > 0 ? perf.totalSales / perf.transactionCount : 0;
                    return (
                      <motion.tr 
                        key={`perf-row-${employee.id}`} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-white/5 transition-colors"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-black/40 border border-white/10 text-indigo-400 rounded-2xl flex items-center justify-center text-lg font-black group-hover:scale-110 group-hover:border-indigo-500/50 transition-all duration-500 shadow-xl">
                              {employee.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-white uppercase tracking-wider group-hover:text-indigo-400 transition-colors">{employee.name}</p>
                              <p className="text-[10px] text-white/30 font-black tracking-widest uppercase mt-0.5">{employee.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className="text-lg font-black text-white tracking-widest">{perf.transactionCount}</span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-emerald-400 tracking-tighter">{perf.totalSales.toFixed(2)}</span>
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{settings.currency}</span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex flex-col items-end">
                             <span className="text-base font-black text-white/60 tracking-tight">{avgSale.toFixed(2)}</span>
                             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">AVG PER ORDER</span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {employees.map((employee: Employee, idx: number) => {
              const perf = employeePerformance[employee.id] || { totalSales: 0, transactionCount: 0 };
              return (
                <motion.div
                  key={`emp-card-${employee.id}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="relative overflow-hidden group border-white/5 bg-white/5 backdrop-blur-md rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-white/10 transition-all duration-500">
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-black/60 rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-xl group-hover:scale-110 group-hover:border-indigo-500/50 transition-all duration-500">
                            <UserCog size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-white uppercase tracking-wider text-base">{employee.name}</h4>
                            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-0.5 italic">{employee.role}</p>
                          </div>
                        </div>
                        <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-xl", 
                          employee.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" : "bg-white/5 text-white/30 border-white/10")}>
                          {employee.status}
                        </span>
                      </div>

                      <div className="space-y-4 text-[11px] font-black tracking-widest uppercase mb-8">
                        <div className="flex items-center gap-3 text-white/60 group-hover:text-white transition-colors">
                          <div className="p-2 bg-white/5 rounded-xl"><Phone size={14} className="text-indigo-400" /></div>
                          <span>{employee.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/60 group-hover:text-white transition-colors">
                          <div className="p-2 bg-white/5 rounded-xl"><Mail size={14} className="text-indigo-400" /></div>
                          <span className="lowercase truncate">{employee.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/60 group-hover:text-white transition-colors">
                          <div className="p-2 bg-white/5 rounded-xl"><Calendar size={14} className="text-indigo-400" /></div>
                          <span>Recruté le: <span className="text-indigo-400">{employee.hireDate || 'N/A'}</span></span>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-[1.5rem] p-6 border border-white/5 space-y-4 mb-8">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Sales Performance Report</p>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Ventes</p>
                            <p className="text-xl font-black text-white tracking-tighter">{perf.totalSales.toFixed(2)} <span className="text-[10px] text-white/20">{settings.currency}</span></p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Transactions</p>
                            <p className="text-xl font-black text-white tracking-tighter">{perf.transactionCount}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 items-center mb-6">
                        <span className={cn(
                          "flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest text-center border",
                          employee.idCardRectoUrl && employee.idCardVersoUrl 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-white/5 text-white/20 border-white/5"
                        )}>
                          🪪 PIÈCE IDENTITY
                        </span>
                        <span className={cn(
                          "flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest text-center border",
                          employee.digitalSignatureUrl 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-white/5 text-white/20 border-white/5"
                        )}>
                          ✍️ CONTRAT SIGNÉ
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-6 border-t border-white/5">
                        <button 
                          onClick={() => handleDeleteEmployee(employee)}
                          className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all font-mono"
                        >
                          SUPPRIMER
                        </button>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handlePrintDossier(employee)}
                            className="px-4 py-3 rounded-2xl bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/10 flex items-center gap-1.5"
                            title="Imprimer le Contrat et le Dossier complet"
                          >
                            <Printer size={12} /> DOSSIER
                          </button>
                          <button 
                            onClick={() => { setEditingEmployee(employee); setIsModalOpen(true); }}
                            className="px-5 py-3 rounded-2xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all border border-white/5"
                          >
                            MODIFIER
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] pointer-events-none rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors" />
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {hrTab === 'attendance' && <AttendanceTab attendance={attendance} employees={employees} users={users} advances={advances} settings={settings} />}
      {hrTab === 'advances' && <AdvancesTab advances={advances} employees={employees} settings={settings} />}
      {hrTab === 'team' && <TeamManagement users={users} employees={employees} settings={settings} setIsAddUserModalOpen={setIsAddUserModalOpen} defaultSubTab="users" />}
      {hrTab === 'permissions' && <TeamManagement users={users} employees={employees} settings={settings} setIsAddUserModalOpen={setIsAddUserModalOpen} defaultSubTab="permissions" />}

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer l'employé"
        message={`Êtes-vous sûr de vouloir supprimer ${employeeToDelete?.name} ? Cette action supprimera son profil employé mais pas son compte d'accès s'il en a un.`}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmployee ? "MODIFIER L'EMPLOYÉ" : "RECRUTEMENT NEXUS"} maxWidth="max-w-5xl" maxHeight="max-h-[94vh]">
        <form onSubmit={handleSubmit} className="p-3 space-y-8">
          {/* Wizard Navigation Tab bar */}
          <div className="flex bg-industrial-800/80 p-1.5 rounded-[1.8rem] border border-industrial-700/80 backdrop-blur-md overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => { stopCamera(); setRecruitmentTab('info'); }}
              className={cn(
                "flex-1 px-4 py-3 rounded-[1.3rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                recruitmentTab === 'info' 
                  ? "bg-indigo-600 text-white shadow-neon-indigo border border-indigo-500/20" 
                  : "text-industrial-500 hover:text-industrial-400 hover:bg-industrial-800"
              )}
            >
              📋 Informations & Rôle *
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setRecruitmentTab('identity'); }}
              className={cn(
                "flex-1 px-4 py-3 rounded-[1.3rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                recruitmentTab === 'identity' 
                  ? "bg-indigo-600 text-white shadow-neon-indigo border border-indigo-500/20" 
                  : "text-industrial-500 hover:text-industrial-400 hover:bg-industrial-800"
              )}
            >
              🪪 Pièce d'Identité (Optionnel)
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setRecruitmentTab('contract'); }}
              className={cn(
                "flex-1 px-4 py-3 rounded-[1.3rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                recruitmentTab === 'contract' 
                  ? "bg-indigo-600 text-white shadow-neon-indigo border border-indigo-500/20" 
                  : "text-industrial-500 hover:text-industrial-400 hover:bg-industrial-800"
              )}
            >
              ✍️ Signature & Contrat (Optionnel)
            </button>
          </div>

          {/* TAB 1: General Info & Salary Settings */}
          {recruitmentTab === 'info' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Nom Complet *</label>
                  <input required className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all shadow-inner text-xs" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Rôle Système *</label>
                  <select className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all cursor-pointer text-xs" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                    <option value="cashier" className="bg-industrial-800 text-industrial-400">CAISSIER</option>
                    <option value="manager" className="bg-industrial-800 text-industrial-400">MANAGER</option>
                    <option value="admin" className="bg-industrial-800 text-industrial-400">ADMINISTRATEUR</option>
                    <option value="delivery" className="bg-industrial-800 text-industrial-400">LIVREUR</option>
                    <option value="picker" className="bg-industrial-800 text-industrial-400">RAMASSEUR</option>
                    <option value="camera_agent" className="bg-industrial-800 text-industrial-400">AGENT CAMÉRA</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Email Professionnel *</label>
                  <input required type="email" className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black lowercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all shadow-inner text-xs" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Téléphone *</label>
                  <input required className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all shadow-inner text-xs" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              
              <div className="p-8 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 space-y-4 relative overflow-hidden">
                 <div className="flex items-center gap-3 text-indigo-500 mb-2 relative z-10">
                    <Lock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sécurité & Connexion</span>
                 </div>
                 <div className="space-y-3 relative z-10">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Mot de passe {editingEmployee ? '(Laisser vide pour conserver)' : '*'}</label>
                  <input 
                    required={!editingEmployee} 
                    className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-mono tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all shadow-inner text-xs"
                    placeholder="Nexus Access Key"
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                  />
                  <p className="text-[9px] text-indigo-500/75 font-medium italic">L'employé utilisera ses identifiants Nexus pour se connecter à la caisse.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] pointer-events-none rounded-full -mr-16 -mt-16" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Date d'Arrivée</label>
                  <input type="date" className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all shadow-inner text-xs" value={formData.hireDate} onChange={e => setFormData({...formData, hireDate: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Statut Nexus</label>
                  <select className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-industrial-700 transition-all cursor-pointer text-xs" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="active" className="bg-industrial-900 text-white">ACTIF</option>
                    <option value="inactive" className="bg-industrial-900 text-white">INACTIF</option>
                  </select>
                </div>
              </div>

              <div className="p-8 bg-emerald-500/[0.02] rounded-[2rem] border border-emerald-500/10 space-y-6 relative overflow-hidden">
                 <div className="flex items-center gap-3 text-emerald-400 mb-2 relative z-10">
                    <DollarSign size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Rémunération & Contrat (Nexus Payroll)</span>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Type de Salaire</label>
                     <select 
                       className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 hover:border-industrial-700 transition-all cursor-pointer text-xs" 
                       value={formData.salaryType} 
                       onChange={e => setFormData({...formData, salaryType: e.target.value as any})}
                     >
                       <option value="monthly" className="bg-industrial-900 text-white">MENSUEL FIXE</option>
                       <option value="hourly" className="bg-industrial-900 text-white">TAUX HORAIRE</option>
                       <option value="daily" className="bg-industrial-900 text-white">TAUX JOURNALIER</option>
                     </select>
                   </div>
                   
                   {formData.salaryType === 'monthly' && (
                     <div className="space-y-3">
                       <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Salaire de Base Mensuel ({settings.currency})</label>
                       <input 
                         type="number" 
                         className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 hover:border-industrial-700 transition-all text-xs" 
                         value={formData.baseSalary} 
                         onChange={e => setFormData({...formData, baseSalary: parseFloat(e.target.value) || 0})} 
                       />
                     </div>
                   )}

                   {formData.salaryType === 'hourly' && (
                     <div className="space-y-3">
                       <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Taux Horaire ({settings.currency}/Heure)</label>
                       <input 
                         type="number" 
                         className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 hover:border-industrial-700 transition-all text-xs" 
                         value={formData.hourlyRate} 
                         onChange={e => setFormData({...formData, hourlyRate: parseFloat(e.target.value) || 0})} 
                       />
                     </div>
                   )}

                   {formData.salaryType === 'daily' && (
                     <div className="space-y-3">
                       <label className="text-[10px] font-black text-industrial-500 uppercase tracking-widest ml-2">Taux Journalier ({settings.currency}/Jour)</label>
                       <input 
                         type="number" 
                         className="w-full bg-industrial-800 border border-industrial-700 rounded-2xl p-4.5 text-white font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 hover:border-industrial-700 transition-all text-xs" 
                         value={formData.dailyRate} 
                         onChange={e => setFormData({...formData, dailyRate: parseFloat(e.target.value) || 0})} 
                       />
                     </div>
                   )}
                 </div>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] pointer-events-none rounded-full -mr-16 -mt-16" />
              </div>

               <div className="flex justify-between items-center pt-4 border-t border-industrial-800 gap-3">
                 <button
                   type="submit"
                   className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                 >
                   🤝 Enregistrer sans documents
                 </button>
                 <button
                   type="button"
                   onClick={() => setRecruitmentTab('identity')}
                   className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                 >
                   Suivant : Pièce d'Identité ➔
                 </button>
               </div>
            </motion.div>
          )}

          {/* TAB 2: Identify Card (Double Sided Recto / Verso Photo taking) */}
          {recruitmentTab === 'identity' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="p-4 bg-indigo-500/5 rounded-[1.5rem] border border-indigo-500/10 flex items-start gap-3">
                <ShieldCheck className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-white uppercase tracking-wider">Vérification de l'identité Légale</p>
                  <p className="text-[9px] text-industrial-500 leading-relaxed font-medium">Capturez ou chargez le scan recto et verso de la pièce d'identité du collaborateur pour certifier son dossier professionnel.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Recto Card Capture Slot */}
                <div className="space-y-4 p-6 bg-industrial-800 border border-industrial-700 rounded-[2rem]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Scan Recto (Face Avant)</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera('recto')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/10"
                      >
                        <Camera size={12} /> Caméra
                      </button>
                      <label className="px-3 py-1.5 bg-industrial-900 hover:bg-industrial-800 border border-industrial-700 rounded-xl text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer">
                        <Image size={12} /> Charger
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'recto')} />
                      </label>
                    </div>
                  </div>
                  
                  {cameraActiveSection === 'recto' ? (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-indigo-500 shadow-neon-indigo bg-black/95">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button type="button" onClick={takePhoto} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all">📸 Déclencher</button>
                        <button type="button" onClick={stopCamera} className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border border-dashed border-industrial-700 bg-industrial-900 flex flex-col items-center justify-center">
                      {formData.idCardRectoUrl ? (
                        <>
                          <img src={formData.idCardRectoUrl} className="w-full h-full object-cover" alt="ID Card Recto" />
                          <button type="button" onClick={() => setFormData(prev => ({...prev, idCardRectoUrl: ''}))} className="absolute top-3 right-3 p-2.5 bg-black/60 rounded-xl text-rose-500 hover:bg-rose-500/20 hover:text-white transition-all"><Trash2 size={14} /></button>
                        </>
                      ) : (
                        <div className="text-center p-6 space-y-2">
                          <Image size={24} className="mx-auto text-industrial-500/40" />
                          <p className="text-[9px] font-black tracking-widest text-industrial-500/50 uppercase">Aucune photo enregistrée</p>
                          <p className="text-[8px] text-industrial-500/30 italic">Utilisez l'appareil photo ou chargez un fichier scané</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Verso Card Capture Slot */}
                <div className="space-y-4 p-6 bg-industrial-800 border border-industrial-700 rounded-[2rem]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Scan Verso (Face Arrière)</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera('verso')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/10"
                      >
                        <Camera size={12} /> Caméra
                      </button>
                      <label className="px-3 py-1.5 bg-industrial-900 hover:bg-industrial-800 border border-industrial-700 rounded-xl text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer">
                        <Image size={12} /> Charger
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'verso')} />
                      </label>
                    </div>
                  </div>
                  
                  {cameraActiveSection === 'verso' ? (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-indigo-500 shadow-neon-indigo bg-black/95">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button type="button" onClick={takePhoto} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all">📸 Déclencher</button>
                        <button type="button" onClick={stopCamera} className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border border-dashed border-industrial-700 bg-industrial-900 flex flex-col items-center justify-center">
                      {formData.idCardVersoUrl ? (
                        <>
                          <img src={formData.idCardVersoUrl} className="w-full h-full object-cover" alt="ID Card Verso" />
                          <button type="button" onClick={() => setFormData(prev => ({...prev, idCardVersoUrl: ''}))} className="absolute top-3 right-3 p-2.5 bg-black/60 rounded-xl text-rose-500 hover:bg-rose-500/20 hover:text-white transition-all"><Trash2 size={14} /></button>
                        </>
                      ) : (
                        <div className="text-center p-6 space-y-2">
                          <Image size={24} className="mx-auto text-industrial-500/40" />
                          <p className="text-[9px] font-black tracking-widest text-industrial-500/50 uppercase">Aucune photo enregistrée</p>
                          <p className="text-[8px] text-industrial-500/30 italic">Utilisez l'appareil photo ou chargez un fichier scané</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-industrial-800 gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRecruitmentTab('info')}
                  className="px-6 py-4 bg-industrial-800 hover:bg-industrial-700 border border-industrial-700 text-industrial-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                >
                  Précédent
                </button>
                <button
                  type="submit"
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  🤝 Enregistrer sans signature
                </button>
                <button
                  type="button"
                  onClick={() => setRecruitmentTab('contract')}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  Suivant : Contrat-Travail ➔
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Contract Preview & Digital Signature Canvas */}
          {recruitmentTab === 'contract' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                  <FileText size={14} /> Prévisualisation Générée du Contrat de Travail
                </label>
                <div className="w-full bg-industrial-800 border border-industrial-700 rounded-[1.8rem] p-6 text-[11px] font-mono leading-relaxed text-industrial-400 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                  {`CONTRAT DE TRAVAIL INDIVIDUEL (NEXUS POS PRO)

Entre l'employeur : ${settings.name || 'NEXUS AUTOMATION SAS'}
Et le salarié : ${formData.name ? formData.name.toUpperCase() : '___________________'}

1. FONCTIONS ET ATTRIBUTIONS :
Le salarié est recruté en qualité de : ${formData.role ? formData.role.toUpperCase() : 'COLLABORATEUR'}.

2. DATE D'ENTRÉE :
Le présent contrat prend effet à compter du : ${formData.hireDate || format(new Date(), 'yyyy-MM-dd')} pour une durée indéterminée.

3. SÉCURITÉ & CONNEXION :
Le salarié s'engage à respecter scrupuleusement la confidentialité des codes d'accès Nexus POS Pro générés au point de vente.

4. RÉMUNÉRATION :
Le type de rémunération convenu est : ${
                    formData.salaryType === 'monthly' ? 'MENSUEL FIXE' : 
                    formData.salaryType === 'hourly' ? 'TAUX HORAIRE' : 'TAUX JOURNALIER'
                  }.
La base de rémunération brute est fixée à : ${
                    formData.salaryType === 'monthly' ? formData.baseSalary :
                    formData.salaryType === 'hourly' ? formData.hourlyRate : formData.dailyRate
                  } ${settings.currency || 'DA'}.

Fait de manière numérique de plein accord des deux parties.`}
                </div>
              </div>

              {/* Signature Canvas Pad Container */}
              <div className="p-6 bg-industrial-800 border border-industrial-700 rounded-[2rem] space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Signature Numérique de l'Employeur / Salarié</p>
                  <button type="button" onClick={clearCanvas} className="text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-wider">Effacer tout</button>
                </div>

                {formData.digitalSignatureUrl ? (
                  <div className="border border-emerald-500/20 bg-emerald-500/[0.02] rounded-2xl p-6 text-center space-y-3 flex flex-col items-center">
                    <CheckSquare className="text-emerald-400" size={24} />
                    <p className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Signature Sécurisée Connectée</p>
                    <img src={formData.digitalSignatureUrl} className="max-h-20 bg-white dark:bg-industrial-950 rounded-xl p-3 shadow-inner border border-industrial-700" alt="Signed" />
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, digitalSignatureUrl: '' }))} className="text-[9px] font-bold text-rose-500 underline uppercase tracking-widest">Effacer et refaire la signature</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <canvas
                      ref={canvasRef}
                      width={1000}
                      height={400}
                      onMouseDown={startDrawing}
                      onMouseMove={drawSign}
                      onMouseUp={endDrawing}
                      onMouseLeave={endDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={drawSign}
                      onTouchEnd={endDrawing}
                      className="w-full h-80 bg-industrial-950/85 rounded-2xl border border-dashed border-indigo-500/30 cursor-crosshair shadow-inner hover:border-indigo-500/50 transition-colors duration-200"
                    />
                    <div className="flex gap-2">
                       <button
                        type="button"
                        onClick={saveSignature}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[9px] font-black text-white uppercase tracking-widest transition-all"
                      >
                        ✍️ Enregistrer & Parapher le Contrat
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-industrial-800">
                <button
                  type="button"
                  onClick={() => setRecruitmentTab('identity')}
                  className="px-6 py-4 bg-industrial-800 hover:bg-industrial-700 border border-industrial-700 text-industrial-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                >
                  Précédent
                </button>
                
                <button type="submit" className="px-8 py-4 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-neon-indigo hover:bg-indigo-500 transition-all active:scale-[0.98]">
                  {editingEmployee ? "💾 Enregistrer le profil" : "🤝 Enregistrer & valider l'embauche"}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </Modal>
    </div>
  );
});
