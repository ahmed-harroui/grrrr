import React from "react";
import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";
import { WIDGET_LINKS, WidgetSnapshot } from "@/widgets/snapshot";

// Android home-screen widgets (names declared in app.json). They are drawn outside the app,
// so they only use the widget components and the snapshot the app saved.

export const ANDROID_WIDGETS = ["GrrrrPet", "GrrrrMatch", "GrrrrRanking", "GrrrrDay"] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGETS)[number];

const CORAL = "#FF5D73";
const CORAL_DARK = "#E64863";
const CREAM = "#FFF7EF";
const CREAM2 = "#FFEEE0";
const DARK = "#2B2724";
const GREY = "#8A8078";
const WHITE = "#FFFFFF";

const open = (uri: string) => ({ clickAction: "OPEN_URI" as const, clickActionData: { uri } });

// Shown until the app has been opened once (or after signing out).
function EmptyWidget() {
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: CREAM, borderRadius: 22, padding: 14, alignItems: "center", justifyContent: "center" }} clickAction="OPEN_APP">
      <TextWidget text="GRRRR 🐾" style={{ fontSize: 20, fontWeight: "bold", color: CORAL }} />
      <TextWidget text="Ouvre l'app pour réveiller ton compagnon" style={{ fontSize: 12, color: GREY, marginTop: 4, textAlign: "center" }} maxLines={2} />
    </FlexWidget>
  );
}

function PetWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { pet } = snapshot;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: CREAM, borderRadius: 22, padding: 12, flexDirection: "row", alignItems: "center", flexGap: 12 }} {...open(WIDGET_LINKS.pet)}>
      {pet.photo ? <ImageWidget image={pet.photo as `https:${string}`} imageWidth={68} imageHeight={68} radius={34} /> : <TextWidget text={pet.icon} style={{ fontSize: 44 }} />}
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}>
          <TextWidget text={`${pet.icon} ${pet.name}`} style={{ fontSize: 18, fontWeight: "bold", color: DARK }} maxLines={1} truncate="END" />
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", flexGap: 10, marginTop: 5 }}>
          <TextWidget text={pet.treats} style={{ fontSize: 11, fontWeight: "bold", color: DARK }} maxLines={1} />
          <TextWidget text={pet.streak} style={{ fontSize: 11, fontWeight: "bold", color: CORAL_DARK }} maxLines={1} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

// Each number opens where it leads: the likes, the conversations.
function Stat({ value, label, link }: { value: number; label: string; link: string }) {
  return (
    <FlexWidget style={{ flex: 1, alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.2)", borderRadius: 14, paddingVertical: 7 }} {...open(link)}>
      <TextWidget text={String(value)} style={{ fontSize: 22, fontWeight: "bold", color: WHITE }} />
      <TextWidget text={label} style={{ fontSize: 10, color: WHITE }} maxLines={1} />
    </FlexWidget>
  );
}

function MatchWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { social } = snapshot;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: CORAL, borderRadius: 22, padding: 12, flexDirection: "column", justifyContent: "space-between" }} {...open(WIDGET_LINKS.matches)}>
      <TextWidget text={social.title} style={{ fontSize: 13, fontWeight: "bold", color: WHITE }} maxLines={1} truncate="END" />
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", flexGap: 8 }}>
        <Stat value={social.likes} label={social.likesLabel} link={WIDGET_LINKS.matches} />
        <Stat value={social.matches} label={social.matchesLabel} link={WIDGET_LINKS.chat} />
        <Stat value={social.unread} label={social.unreadLabel} link={WIDGET_LINKS.chat} />
      </FlexWidget>
      <TextWidget text={social.headline} style={{ fontSize: 12, color: WHITE }} maxLines={2} truncate="END" {...open(social.unread > 0 ? WIDGET_LINKS.chat : social.likes > 0 ? WIDGET_LINKS.matches : WIDGET_LINKS.discover)} />
    </FlexWidget>
  );
}

function RankingWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { ranking } = snapshot;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: CREAM, borderRadius: 22, padding: 12, flexDirection: "column", justifyContent: "space-between" }} {...open(WIDGET_LINKS.matches)}>
      <TextWidget text={ranking.title} style={{ fontSize: 14, fontWeight: "bold", color: DARK }} />
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
        {ranking.rows.map((row) => (
          <FlexWidget key={row.position} style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: row.mine ? CREAM2 : WHITE, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
            <TextWidget text={`${row.position} ${row.name}`} style={{ fontSize: 13, fontWeight: "bold", color: row.mine ? CORAL_DARK : DARK }} maxLines={1} truncate="END" />
          </FlexWidget>
        ))}
      </FlexWidget>
      <TextWidget text={ranking.mine} style={{ fontSize: 12, fontWeight: "bold", color: CORAL_DARK }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}

function DayWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { day } = snapshot;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: CREAM2, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", flexGap: 12 }} {...open(day.icon === "📍" ? WIDGET_LINKS.explore : WIDGET_LINKS.pet)}>
      <TextWidget text={day.icon} style={{ fontSize: 38 }} />
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <TextWidget text={day.title} style={{ fontSize: 14, fontWeight: "bold", color: CORAL_DARK }} maxLines={1} truncate="END" />
        <TextWidget text={day.body} style={{ fontSize: 13, color: DARK, marginTop: 3 }} maxLines={3} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}

export function renderAndroidWidget(name: string, snapshot: WidgetSnapshot | null) {
  if (!snapshot) return <EmptyWidget />;
  switch (name as AndroidWidgetName) {
    case "GrrrrMatch":
      return <MatchWidget snapshot={snapshot} />;
    case "GrrrrRanking":
      return <RankingWidget snapshot={snapshot} />;
    case "GrrrrDay":
      return <DayWidget snapshot={snapshot} />;
    default:
      return <PetWidget snapshot={snapshot} />;
  }
}
