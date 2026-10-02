import { Alert, Platform, type AlertButton } from "react-native";

// react-native-web's Alert.alert does nothing at all, so on the website every confirmation
// (remove a waiting family, delete a pet, sign out...) silently failed. There, it now uses the
// browser's own dialogs: one button → alert(), then that button; several → confirm(), then the
// first non-cancel button on OK, the cancel one otherwise. Imported once, from App.tsx.
if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const cancel = buttons?.find((button) => button.style === "cancel");
    const actions = (buttons ?? []).filter((button) => button !== cancel);
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    if (window.confirm(text)) actions[0]?.onPress?.();
    else cancel?.onPress?.();
  };
}
