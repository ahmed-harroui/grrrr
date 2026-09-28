import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function MoreScreenNew({ navigation }: any) {
  const { user, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <View style={[styles.item, { backgroundColor: colors.card }]}>
          <View>
            <Text style={[styles.itemLabel, { color: colors.text }]}>Email</Text>
            <Text style={[styles.itemValue, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: colors.primary }}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>Notifications</Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>Privacy</Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Help Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Help & Support</Text>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>Knowledge Base</Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>Contact Support</Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card }]}>
          <Text style={[styles.itemLabel, { color: colors.text }]}>About</Text>
          <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.card }]}
          onPress={async () => {
            await signOut();
            navigation.replace('Auth');
          }}
        >
          <Text style={[styles.logoutText, { color: colors.primary }]}>Sign Out</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 12,
    marginTop: 4,
  },
  arrow: {
    fontSize: 16,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 100,
  },
});
