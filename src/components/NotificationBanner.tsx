import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NotificationCard from "@/components/NotificationCard";
import { useLocalization } from "@/context/LocalizationContext";
import type { AppNotification, NotificationActor } from "@/data/api/notifications";
import { describeNotification } from "@/utils/notificationText";

interface Props {
  notification: AppNotification | null;
  actor?: NotificationActor;
  myPetName: string;
  onPress: () => void;
  onClose: () => void;
}

const VISIBLE_MS = 5000;

// Slides down from the top of the screen when a notification arrives, on any screen.
export default function NotificationBanner({ notification, actor, myPetName, onPress, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { language } = useLocalization();
  const slide = useRef(new Animated.Value(0)).current;
  // Kept while sliding out, after the notification itself is gone.
  const [shown, setShown] = useState<{ notification: AppNotification; actor?: NotificationActor } | null>(null);

  useEffect(() => {
    if (!notification) {
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShown(null));
      return;
    }
    setShown({ notification, actor });
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9 }).start();
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  if (!shown) return null;
  const text = describeNotification(shown.notification, language, myPetName);

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }] }]}
      pointerEvents={notification ? "box-none" : "none"}
    >
      <NotificationCard floating photo={shown.actor?.photo} species={shown.actor?.species} icon={text.icon} title={text.title} body={text.body} onPress={onPress} onClose={onClose} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 50, elevation: 12, maxWidth: 520, alignSelf: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
});
