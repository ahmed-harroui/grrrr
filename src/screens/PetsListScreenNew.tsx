import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { usePetSelector } from '../context/PetSelectorContext';
import { grrrCareApi } from '../lib/grrrr-care-api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function PetsListScreenNew({ navigation }: any) {
  const { user } = useAuth();
  const { selectedPetId, selectPet } = usePetSelector();
  const { colors } = useTheme();
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadPets();
    }
  }, [user?.id]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const petsList = await grrrCareApi.getPets(user!.id);
      setPets(petsList);
      if (petsList.length > 0 && !selectedPetId) {
        selectPet(petsList[0].id);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>My Pets</Text>

      {pets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pets yet</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {}}
          >
            <Text style={styles.addButtonText}>+ Add Pet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.petsList}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={[
                styles.petCard,
                {
                  backgroundColor: selectedPetId === pet.id ? colors.primary : colors.card,
                },
              ]}
              onPress={() => selectPet(pet.id)}
            >
              <View style={styles.petInfo}>
                <Text
                  style={[
                    styles.petName,
                    {
                      color: selectedPetId === pet.id ? 'white' : colors.text,
                    },
                  ]}
                >
                  {pet.name}
                </Text>
                <Text
                  style={[
                    styles.petBreed,
                    {
                      color:
                        selectedPetId === pet.id
                          ? 'rgba(255,255,255,0.8)'
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {pet.breed} • {pet.species}
                </Text>
              </View>
              {selectedPetId === pet.id && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16,
  },
  addButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  petsList: {
    gap: 12,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 12,
  },
  checkmark: {
    fontSize: 20,
    marginLeft: 12,
  },
  spacer: {
    height: 100,
  },
});
