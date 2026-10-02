import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerWidgetTaskHandler, requestWidgetUpdate, WidgetTaskHandlerProps } from "react-native-android-widget";
import { ANDROID_WIDGETS, renderAndroidWidget } from "@/widgets/AndroidWidgets";
import { WIDGET_SNAPSHOT_KEY, WidgetSnapshot } from "@/widgets/snapshot";
import { refreshSnapshot } from "@/widgets/liveRefresh";

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Called by Android when a widget is added, resized or refreshed (every 30 minutes), app closed or not.
async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED" || props.widgetAction === "WIDGET_CLICK") return;
  const saved = await readSnapshot();
  // Drawn at once with what was saved, then again with the latest numbers from the database.
  props.renderWidget(renderAndroidWidget(props.widgetInfo.widgetName, saved));
  if (!saved || props.widgetAction !== "WIDGET_UPDATE") return;
  try {
    const fresh = await refreshSnapshot(saved);
    if (fresh === saved) return;
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(fresh));
    props.renderWidget(renderAndroidWidget(props.widgetInfo.widgetName, fresh));
  } catch {
    // Offline or signed out: the saved numbers stay.
  }
}

export function registerWidgets() {
  registerWidgetTaskHandler(widgetTaskHandler);
}

/** Saves what the widgets show and redraws the ones on the home screen (null: signed out). */
export async function pushWidgets(snapshot: WidgetSnapshot | null) {
  if (snapshot) await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  else await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY);
  await Promise.all(ANDROID_WIDGETS.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => renderAndroidWidget(widgetName, snapshot), widgetNotFound: () => {} })));
}
