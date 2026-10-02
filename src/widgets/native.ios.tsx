import React from "react";
import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { aspectRatio, clipShape, containerBackground, font, foregroundStyle, frame, padding, resizable, tint } from "@expo/ui/swift-ui/modifiers";
import { createWidget, widgetsDirectory } from "expo-widgets";
import { File } from "expo-file-system";
import type { WidgetSnapshot } from "@/widgets/snapshot";

// iOS home-screen widgets (names declared in app.json). Each layout is compiled on its own
// for the widget extension: it can only use its props and the SwiftUI components, nothing
// else from the app, which is why the colors are repeated inside each of them.

type Props = { snapshot: WidgetSnapshot | null };

const PetLayout = ({ snapshot }: Props) => {
  "widget";
  const background = containerBackground("#FFF7EF", "widget");
  if (!snapshot) {
    return (
      <VStack modifiers={[background]}>
        <Text modifiers={[font({ size: 20, weight: "bold", design: "rounded" }), foregroundStyle("#FF5D73")]}>GRRRR 🐾</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle("#8A8078")]}>Ouvre l'app pour réveiller ton compagnon</Text>
      </VStack>
    );
  }
  const { pet } = snapshot;
  return (
    <HStack spacing={12} modifiers={[background]}>
      {pet.photoFile ? (
        <Image uiImage={pet.photoFile} modifiers={[resizable(), aspectRatio({ contentMode: "fill" }), frame({ width: 64, height: 64 }), clipShape("circle")]} />
      ) : (
        <Text modifiers={[font({ size: 44 })]}>{pet.icon}</Text>
      )}
      <VStack alignment="leading" spacing={3}>
        <Text modifiers={[font({ size: 18, weight: "bold", design: "rounded" }), foregroundStyle("#2B2724")]}>{pet.name}</Text>
        <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(pet.rankColor)]}>{pet.rank}</Text>
        <ProgressView value={pet.progress} modifiers={[tint("#FF5D73")]} />
        <Text modifiers={[font({ size: 10 }), foregroundStyle("#8A8078")]}>{pet.xp}</Text>
        <Text modifiers={[font({ size: 11, weight: "bold" }), foregroundStyle("#2B2724")]}>{pet.treats}</Text>
        <Text modifiers={[font({ size: 11, weight: "bold" }), foregroundStyle("#E64863")]}>{`${pet.streak} · ${pet.mood}`}</Text>
      </VStack>
    </HStack>
  );
};

const MatchLayout = ({ snapshot }: Props) => {
  "widget";
  const background = containerBackground("#FF5D73", "widget");
  if (!snapshot) {
    return (
      <VStack modifiers={[background]}>
        <Text modifiers={[font({ size: 18, weight: "bold", design: "rounded" }), foregroundStyle("#FFFFFF")]}>GRRRR 💌</Text>
      </VStack>
    );
  }
  const { social } = snapshot;
  const stats = [[social.likes, social.likesLabel], [social.matches, social.matchesLabel], [social.unread, social.unreadLabel]] as const;
  return (
    <VStack alignment="leading" spacing={8} modifiers={[background]}>
      <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle("#FFFFFF")]}>{social.title}</Text>
      <HStack spacing={16}>
        {stats.map(([value, label]) => (
          <VStack key={label} spacing={0}>
            <Text modifiers={[font({ size: 24, weight: "bold", design: "rounded" }), foregroundStyle("#FFFFFF")]}>{String(value)}</Text>
            <Text modifiers={[font({ size: 10 }), foregroundStyle("#FFFFFF")]}>{label}</Text>
          </VStack>
        ))}
        <Spacer />
      </HStack>
      <Text modifiers={[font({ size: 12 }), foregroundStyle("#FFFFFF")]}>{social.headline}</Text>
    </VStack>
  );
};

const RankingLayout = ({ snapshot }: Props) => {
  "widget";
  const background = containerBackground("#FFF7EF", "widget");
  if (!snapshot) {
    return (
      <VStack modifiers={[background]}>
        <Text modifiers={[font({ size: 18, weight: "bold", design: "rounded" }), foregroundStyle("#FF5D73")]}>GRRRR 🏆</Text>
      </VStack>
    );
  }
  const { ranking } = snapshot;
  return (
    <VStack alignment="leading" spacing={5} modifiers={[background]}>
      <Text modifiers={[font({ size: 14, weight: "bold", design: "rounded" }), foregroundStyle("#2B2724")]}>{ranking.title}</Text>
      {ranking.rows.map((row) => (
        <HStack key={row.position}>
          <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(row.mine ? "#E64863" : "#2B2724")]}>{`${row.position} ${row.name}`}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 11 }), foregroundStyle("#8A8078")]}>{row.xp}</Text>
        </HStack>
      ))}
      <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle("#E64863")]}>{ranking.mine}</Text>
    </VStack>
  );
};

const DayLayout = ({ snapshot }: Props) => {
  "widget";
  const background = containerBackground("#FFEEE0", "widget");
  if (!snapshot) {
    return (
      <VStack modifiers={[background]}>
        <Text modifiers={[font({ size: 18, weight: "bold", design: "rounded" }), foregroundStyle("#FF5D73")]}>GRRRR 🧠</Text>
      </VStack>
    );
  }
  const { day } = snapshot;
  return (
    <HStack spacing={12} modifiers={[background]}>
      <Text modifiers={[font({ size: 36 })]}>{day.icon}</Text>
      <VStack alignment="leading" spacing={3}>
        <Text modifiers={[font({ size: 14, weight: "bold", design: "rounded" }), foregroundStyle("#E64863")]}>{day.title}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle("#2B2724"), padding({ trailing: 4 })]}>{day.body}</Text>
      </VStack>
      <Spacer />
    </HStack>
  );
};

const WIDGETS = [
  createWidget<Props>("PetWidget", PetLayout),
  createWidget<Props>("MatchWidget", MatchLayout),
  createWidget<Props>("RankingWidget", RankingLayout),
  createWidget<Props>("DayWidget", DayLayout),
];

export function registerWidgets() {}

// Widgets can't load a remote picture: the avatar is copied into the folder they share with the app.
async function copyAvatar(url: string): Promise<string | undefined> {
  if (!/^https?:\/\//.test(url) || !widgetsDirectory) return undefined;
  try {
    const name = `avatar-${Array.from(url).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7)}.jpg`;
    const file = new File(widgetsDirectory, name);
    if (!file.exists) await File.downloadFileAsync(url, file);
    return file.uri;
  } catch (error) {
    console.warn("Widget avatar not copied", error);
    return undefined;
  }
}

/** Hands the widgets what they show and redraws them (null: signed out). */
export async function pushWidgets(snapshot: WidgetSnapshot | null) {
  const props: Props = { snapshot: snapshot ? { ...snapshot, pet: { ...snapshot.pet, photoFile: await copyAvatar(snapshot.pet.photo) } } : null };
  WIDGETS.forEach((widget) => widget.updateSnapshot(props));
}
