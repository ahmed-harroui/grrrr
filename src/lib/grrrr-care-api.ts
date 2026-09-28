import { supabase } from './supabase';

const API_BASE = 'http://192.168.56.1:3000/api';

export const grrrCareApi = {
  // Pets
  async getPets(userId: string) {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async getPetById(petId: string) {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();
    if (error) throw error;
    return data;
  },

  // Vaccinations
  async getVaccinations(petId: string) {
    const { data, error } = await supabase
      .from('vaccinations')
      .select('*')
      .eq('pet_id', petId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addVaccination(petId: string, vaccine: {
    name: string;
    date: string;
    nextDue: string;
  }) {
    const { data, error } = await supabase
      .from('vaccinations')
      .insert([{
        pet_id: petId,
        vaccine: vaccine.name,
        date: vaccine.date,
        next_due: vaccine.nextDue,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Medications
  async getMedications(petId: string) {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('pet_id', petId);
    if (error) throw error;
    return data || [];
  },

  async addMedication(petId: string, med: {
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('medications')
      .insert([{
        pet_id: petId,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        start_date: med.startDate,
        end_date: med.endDate || null,
        notes: med.notes || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Vet Visits
  async getVetVisits(petId: string) {
    const { data, error } = await supabase
      .from('vet_visits')
      .select('*')
      .eq('pet_id', petId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addVetVisit(petId: string, visit: {
    date: string;
    vetName: string;
    diagnosis: string;
    notes: string;
  }) {
    const { data, error } = await supabase
      .from('vet_visits')
      .insert([{
        pet_id: petId,
        date: visit.date,
        vet_name: visit.vetName,
        diagnosis: visit.diagnosis,
        notes: visit.notes,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // AI Chat
  async sendChatMessage(userId: string, petId: string | null, message: string, style: string = 'care') {
    const response = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        active_pet_id: petId,
        message,
        style,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    return response.json();
  },

  // Health Summary
  async getHealthSummary(petId: string) {
    const [vaccinations, medications, vetVisits] = await Promise.all([
      this.getVaccinations(petId),
      this.getMedications(petId),
      this.getVetVisits(petId),
    ]);

    return {
      status: 'healthy',
      vaccinations: vaccinations.length,
      medications: medications.length,
      lastVetVisit: vetVisits[0]?.date || null,
    };
  },
};
