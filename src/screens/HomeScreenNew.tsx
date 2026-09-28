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
import { useTheme } from '../context/ThemeContext';

export function HomeScreenNew({ navigation }: any) {
  const { selectedPetId } = usePetSelector();
  const { colors } = useTheme();
  const [pet, setPet] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPetId) {
      loadData();
    }
  }, [selectedPetId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [petData, healthData] = await Promise.all([
        grrrCareApi.getPetById(selectedPetId!),
        grrrCareApi.getHealthSummary(selectedPetId!),
      ]);
      setPet(petData);
      setSummary(healthData);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedPetId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Select a pet to get started</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text }]}>Good morning,</Text>
        <Text style={[styles.petName, { color: colors.primary }]}>{pet?.name || 'Pet'}</Text>
      </View>

      {/* Health Summary Cards */}
      <View style={styles.cardsContainer}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('ChatList')}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Ask AI</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Health')}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Status</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>
            {summary?.status === 'healthy' ? '✓ Healthy' : 'Check Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Health')}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Vaccines</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>{summary?.vaccinations}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Health')}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Medications</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>{summary?.medications}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('ChatList')}
        >
          <Text style={styles.actionButtonText}>💬 Ask AI Assistant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Health')}
        >
          <Text style={[styles.actionButtonText, { color: colors.text }]}>📋 Health Records</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
    marginTop: 12,
  },
  greeting: {
    fontSize: 16,
    marginBottom: 4,
  },
  petName: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  spacer: {
    height: 100,
  },
});
