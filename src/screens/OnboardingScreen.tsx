import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, radii } from "@/theme/theme";

interface Props {
  onDone: () => void;
}

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "🐾",
    title: "Welcome to GRRRR",
    subtitle: "Find the perfect friend for your pet.",
  },
  {
    icon: "📸",
    title: "Create your pet's profile",
    subtitle: "Add photos, bio, breed and personality.",
  },
  {
    icon: "❤️",
    title: "What does your pet need?",
    subtitle: "Slide between the two moods to change what GRRRR looks for.",
    showModeDemo: true,
  },
  {
    icon: "🐶",
    title: "Let's find their perfect match!",
    subtitle: "Swipe, match, and set up playdates with new friends nearby.",
  },
];

export default function OnboardingScreen({ onDone }: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      onDone();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={onDone} hitSlop={10}>
        <Text style={styles.skipText}>Passer</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            {item.showModeDemo && (
              <View style={styles.modeDemo}>
                <View style={[styles.pill, { backgroundColor: "#E4F7F5" }]}>
                  <Text style={[styles.pillText, { color: colors.friend }]}>🐾 FRIEND</Text>
                </View>
                <Text style={styles.arrow}>←──────→</Text>
                <View style={[styles.pill, { backgroundColor: "#FFEEDC" }]}>
                  <Text style={[styles.pillText, { color: colors.hot }]}>🔥 HOT</Text>
                </View>
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextText}>{index === SLIDES.length - 1 ? "Get Started" : "Continue"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  skip: { alignSelf: "flex-end", marginTop: 18, marginRight: 20 },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.grey },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 34 },
  icon: { fontSize: 56, marginBottom: 22 },
  title: { fontFamily: fonts.display, fontSize: 23, color: colors.dark, marginBottom: 10, textAlign: "center" },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.grey, textAlign: "center", lineHeight: 21, maxWidth: 260 },
  modeDemo: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill },
  pillText: { fontFamily: fonts.displaySemi, fontSize: 13 },
  arrow: { color: colors.grey, fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingBottom: 26, paddingTop: 18 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { width: 20, backgroundColor: colors.coral },
  nextBtn: {
    backgroundColor: colors.coral,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: colors.coral,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  nextText: { fontFamily: fonts.displaySemi, fontSize: 14.5, color: "#fff" },
});
