// What keeps the widgets alive: they refresh every 30 minutes, and each refresh shows the next
// item of a pool instead of the same line all day. The order starts somewhere else each day, so
// nothing comes back the same day until the pool has gone round. Texts are [French, English];
// {n} is the pet's name.

type Text = [fr: string, en: string];
type Species = "dog" | "cat" | "other";

const SLOT_MS = 30 * 60 * 1000;

/** The item of `pool` for this half-hour (`salt` keeps two pools of the same size out of step). */
export function rotate<T>(pool: readonly T[], now: Date, salt = 0): T {
  const slot = Math.floor(now.getTime() / SLOT_MS);
  const day = Math.floor(now.getTime() / 864e5);
  // A different starting point each day, then one step per half-hour
  const start = Math.abs(Math.imul(day + salt * 7919, 2654435761)) % pool.length;
  return pool[(start + slot) % pool.length];
}

const fill = (text: string, name: string) => text.replace(/\{n\}/g, name);

/** Small things to do with the pet today */
const CHALLENGES: Record<Species, Text[]> = {
  dog: [
    ["Cache 3 croquettes dans la pièce et laisse {n} les trouver.", "Hide 3 treats in the room and let {n} find them."],
    ["Change l'itinéraire de la balade : nouvelles odeurs, cerveau ravi.", "Change the walk's route: new smells, happy brain."],
    ["Apprends-lui « touche » : son museau dans ta main, une récompense.", "Teach \"touch\": nose in your hand, a reward."],
    ["Tir à la corde, puis « lâche » contre une friandise.", "Tug of war, then \"drop it\" for a treat."],
    ["5 minutes de brossage : c'est aussi un câlin.", "5 minutes of brushing: it's a cuddle too."],
    ["Photo du jour : {n} dans sa position la plus drôle.", "Photo of the day: {n} in the funniest pose."],
    ["Un tapis de fouille avec ses croquettes : repas plus long, chien plus calme.", "A snuffle mat with the kibble: longer meal, calmer dog."],
    ["Vérifie ses coussinets au retour de balade.", "Check the paw pads after the walk."],
  ],
  cat: [
    ["Une plume au bout d'une ficelle : 10 minutes de chasse.", "A feather on a string: 10 minutes of hunting."],
    ["Un carton vide dans le salon. Observe.", "An empty box in the living room. Watch."],
    ["Cache sa friandise sous un gobelet : à {n} de trouver.", "Hide a treat under a cup: {n}'s turn to find it."],
    ["Un rebord de fenêtre dégagé = la meilleure télé du monde.", "A clear windowsill = the best TV in the world."],
    ["5 minutes de brossage, à son rythme.", "5 minutes of brushing, at its own pace."],
    ["Photo du jour : {n} dans sa sieste la plus improbable.", "Photo of the day: {n}'s most unlikely nap."],
    ["Change l'eau de sa fontaine : les chats aiment la fraîcheur.", "Change the fountain's water: cats like it fresh."],
    ["Une séance de jeu avant le dîner, puis le repas : comme à la chasse.", "Play before dinner, then the meal: like a hunt."],
  ],
  other: [
    ["Un nouvel objet à explorer dans son espace.", "A new object to explore in its space."],
    ["Quelques minutes au calme ensemble, sans écran.", "A few quiet minutes together, no screen."],
    ["Change l'eau et vérifie que tout est propre.", "Change the water and check all is clean."],
    ["Photo du jour : {n} sous son meilleur angle.", "Photo of the day: {n} at its best angle."],
    ["Une friandise adaptée à son espèce, juste pour le plaisir.", "A treat suited to its species, just for fun."],
  ],
};

/** What the pet would say */
const THOUGHTS: Record<Species, Text[]> = {
  dog: [
    ["J'ai entendu « balade ». Je ne pense plus qu'à ça.", "I heard \"walk\". It's all I can think about."],
    ["Le facteur est repassé. Je reste vigilant.", "The postman came again. I stay alert."],
    ["Ma gamelle est vide depuis 4 minutes. C'est long.", "My bowl has been empty for 4 minutes. That's long."],
    ["J'ai trouvé un bâton parfait. On le garde ?", "I found the perfect stick. Can we keep it?"],
    ["Je t'aime plus que les croquettes. Presque.", "I love you more than treats. Almost."],
    ["Le canapé ? Je ne vois pas de quoi tu parles.", "The sofa? No idea what you mean."],
  ],
  cat: [
    ["16 h de sommeil par jour : ce n'est pas de la paresse, c'est de l'entraînement.", "16 hours of sleep a day: not lazy, training."],
    ["Le carton est à moi. Le sac aussi.", "The box is mine. The bag too."],
    ["J'ai fait tomber un verre. Pour la science.", "I knocked over a glass. For science."],
    ["Je ronronne : tu peux continuer.", "I'm purring: you may continue."],
    ["3 h du matin : l'heure idéale pour un sprint.", "3 a.m.: the perfect time for a sprint."],
    ["Je t'ai apporté… rien. Mais j'y ai pensé.", "I brought you… nothing. But I thought about it."],
  ],
  other: [
    ["Un peu de calme et beaucoup d'amour, merci.", "A little calm and a lot of love, thanks."],
    ["J'observe. Je juge. Je t'aime quand même.", "I watch. I judge. I love you anyway."],
    ["Une bonne journée commence par de l'eau fraîche.", "A good day starts with fresh water."],
  ],
};

/** "Did you know?" — the facts the widget already had, with a few more */
const MORE_FACTS: Record<Species, Text[]> = {
  dog: [
    ["Un chien peut sentir le changement de ton humeur avant toi.", "A dog can sense your mood change before you do."],
    ["Les chiots naissent sourds et aveugles.", "Puppies are born deaf and blind."],
  ],
  cat: [
    ["Un chat passe jusqu'à un tiers de sa journée à faire sa toilette.", "A cat spends up to a third of its day grooming."],
    ["Les chats miaulent surtout pour parler aux humains.", "Cats meow mostly to talk to humans."],
  ],
  other: [["Chaque espèce a son rythme : l'observer, c'est déjà prendre soin.", "Each species has its rhythm: watching it is already caring."]],
};

const species = (value: string | null | undefined): Species => (value === "dog" || value === "cat" ? value : "other");

/** The light side of the word of the day: a fact, a challenge or a thought, by turns. */
export function funMessage(input: { language: "fr" | "en"; name: string; species: string | null | undefined; facts: Text[]; now: Date }) {
  const { language, name, now } = input;
  const t = (text: Text) => fill(language === "fr" ? text[0] : text[1], name);
  const kind = species(input.species);
  const hour = now.getHours();
  const when = hour < 12 ? ["Ce matin", "This morning"] : hour < 18 ? ["Cet après-midi", "This afternoon"] : ["Ce soir", "Tonight"];
  switch (Math.floor(now.getTime() / SLOT_MS) % 3) {
    case 0:
      return { icon: "🧠", title: language === "fr" ? "Le savais-tu ?" : "Did you know?", body: t(rotate([...input.facts, ...MORE_FACTS[kind]], now, 1)) };
    case 1:
      return { icon: "🎯", title: language === "fr" ? "Défi du jour" : "Today's challenge", body: t(rotate(CHALLENGES[kind], now, 2)) };
    default:
      return { icon: "💭", title: language === "fr" ? `${when[0]}, ${name} pense…` : `${when[1]}, ${name} thinks…`, body: t(rotate(THOUGHTS[kind], now, 3)) };
  }
}

/** The likes widget when nothing new is waiting */
const IDLE_HEADLINES: Text[] = [
  ["Swipe dans Discover pour de nouvelles rencontres 🐾", "Swipe in Discover to meet new friends 🐾"],
  ["Qui va croiser la route de {n} aujourd'hui ? 👀", "Who will cross {n}'s path today? 👀"],
  ["Un like peut devenir une amitié pour la vie 💛", "A like can become a lifelong friendship 💛"],
  ["{n} attend son prochain copain de balade 🐕", "{n} is waiting for a new walking buddy 🐕"],
  ["Et si aujourd'hui était le jour d'un match ? ✨", "What if today was a match day? ✨"],
  ["Un petit swipe, un grand pas pour {n} 🐾", "A small swipe, a giant leap for {n} 🐾"],
];

export function idleHeadline(language: "fr" | "en", name: string, now: Date) {
  const text = rotate(IDLE_HEADLINES, now, 4);
  return fill(language === "fr" ? text[0] : text[1], name);
}
