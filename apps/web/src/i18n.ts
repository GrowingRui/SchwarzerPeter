/**
 * English and German for the whole site.
 *
 * Static pages (index.html, deck.html) are written in English. Elements with
 * data-i18n="key" get their German text from here, and data-i18n-attr="attr:key;…"
 * translates attributes. The game (React) calls t() directly.
 *
 * The language is chosen once per page load: ?lang= in the URL, then the saved
 * choice, then the browser's language. Switching saves the choice and reloads.
 */
export type Lang = 'en' | 'de';
export const LANGS: Record<Lang, string> = { en: 'English', de: 'Deutsch' };

const STORAGE_KEY = 'sp.lang';
type Vars = Record<string, string | number>;

export const lang: Lang = detectLang();

function detectLang(): Lang {
  const isLang = (v: unknown): v is Lang => v === 'en' || v === 'de';
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (isLang(fromUrl)) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function setLang(next: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage blocked: only this load changes */
  }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  if (next !== lang) location.replace(url.toString());
}

export function t(key: string, vars?: Vars): string {
  const text = messages[lang][key] ?? messages.en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}

/** Singular or plural: looks up `key.one` or `key.other`, with {n} filled in. */
export function tn(key: string, n: number, vars?: Vars): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

/** 1st, 2nd, 3rd… in English; 1., 2., 3. in German. */
export function ordinal(n: number): string {
  if (lang === 'de') return `${n}.`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** Translate a static page and wire up its language switches. */
export function applyStatic(root: ParentNode = document) {
  document.documentElement.lang = lang;
  if (lang !== 'en') {
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n!);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr!.split(';')) {
        const [attr, key] = pair.split(':');
        if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
      }
    });
  }
  wireLangSwitches(root);
  document.documentElement.classList.remove('i18n-pending');
}

export function wireLangSwitches(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-set-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
    btn.addEventListener('click', () => setLang(btn.dataset.setLang as Lang));
  });
  root.querySelectorAll<HTMLSelectElement>('select[data-lang-select]').forEach((select) => {
    select.value = lang;
    select.addEventListener('change', () => setLang(select.value as Lang));
  });
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

const en: Record<string, string> = {
  // Shared
  'lang.label': 'Language',
  'home.aria': 'Schwarzer Peter home',
  you: 'You',
  player: 'Player',
  'card.aria': '{name} card',
  'card.ariaNumbered': '{name}, card {n} of 18 pairs',
  'card.peterAria': 'Schwarzer Peter, the black cat',
  'meta.playTitle': 'Practise against bots: Schwarzer Peter',

  // Homepage hand demo
  'hero.handCard': 'Card {i} of {n}',
  'hero.drewCat': 'You drew the cat.',
  'hero.passItOn': 'Better pass it on.',
  'hero.drewSafe': 'You drew the {name}. Safe, this time.',

  // Setup (practice)
  'setup.title': 'Practise against bots',
  'setup.lead': 'Play a full round with the Alpine deck. The bots pick their cards at random, so it’s all down to luck.',
  'setup.howMany': 'How many bots?',
  'setup.summary.one': 'You and 1 bot, 2 players at the table.',
  'setup.summary.other': 'You and {n} bots, {total} players at the table.',
  'setup.name': 'Your name',
  'setup.deal': 'Deal the cards',
  'setup.friends': 'Play with friends instead',

  // Table
  'table.aria': 'Game table',
  'table.others': 'Other players',
  'table.yourHand': 'Your hand',
  'table.pairsDown': 'of {total} pairs down',
  'table.leave': 'Leave game',
  'table.shuffling': 'Shuffling the deck…',
  'table.dealing': 'Dealing the cards…',
  'table.dealtPairs.one': 'You were dealt a pair. Down it goes.',
  'table.dealtPairs.other': 'You were dealt {n} pairs. Down they go.',
  'table.othersLayDown': 'Everyone lays down the pairs they were dealt.',
  'table.youOut': 'You’re out of cards. Safe!',
  'table.playerOut': '{name} is out of cards and safe.',
  'table.youLost': 'You’re left with the Schwarzer Peter.',
  'table.playerLost': '{name} is left with the Schwarzer Peter.',
  'table.yourTurn': 'Your turn. Draw a card from {name}.',
  'table.drawsFrom': '{drawer} draws from {offerer}.',
  'table.drawsFromYou': '{drawer} draws from you.',
  'table.choosing': '{name} is choosing one of your cards…',
  'status.offeringBluff': 'You’re holding out your cards. Drag or shuffle them to bluff.',
  'bluff.shuffle': 'Shuffle',
  'bluff.shuffleAria': 'Shuffle your cards',
  'bluff.cardAria': '{card}. Drag it, or use the arrow keys, to move it.',
  'bluff.rearranged': '{name} shuffled their cards.',
  'react.bar': 'Reactions',
  'react.grin': 'Sly grin',
  'react.gasp': 'Gasp',
  'react.laugh': 'Laugh',
  'react.sweat': 'Phew',
  'react.shrug': 'Shrug',
  'react.clap': 'Applause',
  'react.announce': '{name}: {label}',
  'timer.you.one': '1 second left, then a card is picked for you.',
  'timer.you.other': '{n} seconds left, then a card is picked for you.',
  'timer.seat': '{n} s left',
  'soot.title': 'Soot on the nose: kept the cat last round',
  'soot.you': 'You still have soot on your nose from last round.',
  'soot.start': '{name} starts this round with soot on the nose.',
  'draw.youPeter': 'You drew the Schwarzer Peter!',
  'draw.youPair': 'You drew the {card}. That’s a pair!',
  'draw.you': 'You drew the {card}.',
  'draw.tookPeter': '{name} took the Schwarzer Peter from you!',
  'draw.tookYourPair': '{name} took your {card} and made a pair.',
  'draw.tookYour': '{name} took your {card}.',
  'draw.otherPair': '{name} drew from {other} and made a pair: {card}.',
  'draw.other': '{name} drew a card from {other}.',
  'status.out': 'You’re out and safe, {ord} to finish',
  'status.keptCat': 'You kept the cat',
  'status.dealing': 'Your cards',
  'status.drawing': 'Your turn to draw',
  'status.offering': 'You’re holding out your cards',
  'status.hold.one': 'You hold 1 card',
  'status.hold.other': 'You hold {n} cards',
  'seat.keptCat': 'kept the cat',
  'seat.safe': 'safe, {ord} out',
  'seat.offline': 'offline, cards drawn for them',
  'seat.drawing': 'drawing',
  'seat.offering': 'holding out cards',
  'seat.cards.one': '1 card',
  'seat.cards.other': '{n} cards',
  'pile.aria': '{n} pairs on the table',
  'pile.down.one': '1 pair down',
  'pile.down.other': '{n} pairs down',
  'pile.none': 'No pairs yet',
  'offer.aria': '{name}’s cards, face down',
  'offer.card': 'Card {i} of {n} from {name}',
  'result.lostTitle': 'You kept the cat',
  'result.wonTitle': 'You’re safe!',
  'result.lostText': 'The Schwarzer Peter stayed with you this round. By tradition, that earns you a smudge of soot on the nose.',
  'result.wonText': '{loser} is left holding the Schwarzer Peter. You were {ord} out of cards.',
  'result.someone': 'Someone',
  'result.safe': 'safe',
  'result.keptCat': 'kept the cat',
  'result.home': 'Back to the homepage',
  'result.changePlayers': 'Change players',
  'leave.title': 'Leave this game?',
  'leave.practiceNote': 'The round ends and can’t be picked up again.',
  'leave.onlineNote': 'A bot takes your seat for the rest of this round.',
  'leave.stay': 'Keep playing',

  // Online
  'create.title': 'Play with friends',
  'create.lead': 'Create a room, then send the link. Everyone joins from their own phone or computer.',
  'create.error': 'The game server didn’t answer. Check your connection and try again.',
  'create.busy': 'Creating room…',
  'create.button': 'Create room',
  'create.practise': 'Practise against bots instead',
  'room.docTitle': 'Room {code}: Schwarzer Peter',
  'room.joining': 'Joining room {code}…',
  'rematch.button': 'Rematch',
  'rematch.asked': 'Ready for a rematch',
  'rematch.waitingFor': 'Waiting for {names}.',
  'rematch.wants.one': '{names} wants a rematch.',
  'rematch.wants.other': '{names} want a rematch.',
  'create.tooMany.one': 'You’ve opened a lot of rooms just now. Try again in a second.',
  'create.tooMany.other': 'You’ve opened a lot of rooms just now. Try again in {n} seconds.',
  'room.theHost': 'the host',
  'join.invited': 'You’re invited to room',
  'join.lead': 'Pick a name so the others know who you are.',
  'join.button': 'Join room',
  'join.rules': 'How to play',
  'lobby.code': 'Room code',
  'lobby.lead': 'Send this link to your friends. Up to {n} players can sit at the table.',
  'lobby.link': 'Room link',
  'lobby.copied': 'Link copied',
  'lobby.copy': 'Copy link',
  'lobby.share': 'Share',
  'lobby.shareText': 'Join my game of Schwarzer Peter: room {code}',
  'lobby.table': 'At the table',
  'lobby.seats': '{n} of {max} seats',
  'lobby.tagYou': 'you',
  'lobby.tagHost': 'host',
  'lobby.tagAway': 'away',
  'lobby.bot': 'Bot',
  'lobby.botJoins': 'joins at the start',
  'lobby.fillBots': 'Fill empty seats with bots',
  'lobby.fewer': 'One bot fewer',
  'lobby.more': 'One bot more',
  'lobby.start': 'Start the game',
  'lobby.needTwo': 'Invite a friend or add a bot to start.',
  'lobby.waiting': 'Waiting for {name} to start the game.',
  'lobby.leave': 'Leave room',
  'problem.ROOM_NOT_FOUND.title': 'This room doesn’t exist',
  'problem.ROOM_NOT_FOUND.text': 'Check the code you were sent, or create a new room.',
  'problem.ROOM_FULL.title': 'This room is full',
  'problem.ROOM_FULL.text': 'A game has at most 6 players. Ask the host for a new room, or create your own.',
  'problem.GAME_IN_PROGRESS.title': 'This game has already started',
  'problem.GAME_IN_PROGRESS.text': 'You can join the next round once the host takes everyone back to the room, or create your own room.',
  'problem.create': 'Create a new room',
  'problem.practise': 'Practise against bots',
  'conn.reconnecting': 'Connection lost. Reconnecting…',
  'quick.docTitle': 'Quick match: Schwarzer Peter',
  'quick.heading': 'Quick match',
  'quick.lead': 'Sit down at an open table with other players. If nobody else turns up, bots take the empty seats.',
  'quick.find': 'Find a table',
  'quick.finding': 'Finding a table…',
  'quick.waitTitle': 'Finding players',
  'quick.waitLead': 'The game starts as soon as {seats} players are here, or when the countdown runs out. Bots take any empty seats.',
  'quick.seconds.one': 'second',
  'quick.seconds.other': 'seconds',
  'quick.starting': 'Starting…',
  'quick.openSeat': 'Open seat',
  'quick.openSeatNote': 'a bot if nobody comes',
  'quick.leave': 'Leave table',
  'quick.another': 'Find another table',
  'quick.requeue': 'That table just started. Finding you another one…',
  'quick.friends': 'Play with friends instead',
  'error.NOT_HOST': 'Only the host can do that.',
  'error.NOT_ENOUGH_PLAYERS': 'Invite a friend or add a bot to start.',
  'error.NOT_YOUR_TURN': 'It’s not your turn to draw.',
  'error.INVALID_SLOT': 'That card isn’t there any more.',
  'error.default': 'That didn’t work. Try again.',
};

const de: Record<string, string> = {
  // Shared
  'lang.label': 'Sprache',
  'home.aria': 'Schwarzer Peter Startseite',
  you: 'Du',
  player: 'Spieler',
  'card.aria': 'Karte {name}',
  'card.ariaNumbered': '{name}, Karte {n} von 18 Paaren',
  'card.peterAria': 'Schwarzer Peter, die schwarze Katze',

  // Page titles and descriptions
  'meta.homeTitle': 'Schwarzer Peter: das Kartenspiel, online',
  'meta.homeDescription': 'Spiel Schwarzer Peter online mit Freunden, anderen Spielern oder Bots. Ziehen, Paare ablegen und bloß nicht mit der Katze sitzen bleiben.',
  'meta.deckTitle': 'Die Alpenkarten: Schwarzer Peter',
  'meta.deckDescription': 'Alle Karten des Alpen-Kartenspiels von Schwarzer Peter: 18 Paare Bergtiere und eine schwarze Katze.',
  'meta.playTitle': 'Gegen Bots üben: Schwarzer Peter',

  // Navigation and footer
  'nav.main': 'Hauptmenü',
  'nav.play': 'Spielen',
  'nav.rules': 'So geht’s',
  'nav.deck': 'Die Karten',
  'nav.online': 'Online spielen',
  'nav.signin': 'Anmelden',
  'cta.playNow': 'Jetzt spielen',
  'cta.createRoom': 'Raum erstellen',
  'cta.practise': 'Gegen Bots üben',
  'footer.rules': 'Regeln',
  'footer.help': 'Hilfe',
  'footer.parents': 'Für Eltern',
  'footer.privacy': 'Datenschutz',
  'footer.contact': 'Kontakt',
  'footer.copyright': '© 2026 Schwarzer Peter. Gemacht in Sassland für Saskja.',

  // Homepage
  'hero.title': 'Wer die Katze behält, verliert.',
  'hero.lead': 'Das alte deutsche Kartenspiel, jetzt im Browser. Lege Paare ab, zieh beim Nachbarn und gib die schwarze Katze weiter, bevor die Runde endet.',
  'hero.invite': 'Freunde einladen',
  'hero.note': 'Kostenlos, 2 bis 6 Spieler. Nichts zu installieren.',
  'hero.prompt': 'Zieh eine Karte aus Peters Hand.',
  'hero.handAria': 'Peters Hand mit sieben verdeckten Karten',
  'hero.reset': 'Mischen und nochmal versuchen',
  'hero.handCard': 'Karte {i} von {n}',
  'hero.drewCat': 'Du hast die Katze gezogen.',
  'hero.passItOn': 'Gib sie lieber weiter.',
  'hero.drewSafe': 'Du ziehst: {name}. Diesmal Glück gehabt.',
  'play.title': 'Such dir einen Tisch aus',
  'play.lead': 'Spiel mit Leuten, die du kennst, setz dich zu anderen Spielern oder übe zuerst gegen den Computer.',
  'friends.title': 'Mit Freunden spielen',
  'friends.text': 'Erstelle einen privaten Raum und schick den Link an Familie oder Freunde. Alle spielen auf ihrem eigenen Handy oder Computer mit.',
  'joinForm.label': 'Hast du einen Code? Tritt einem Raum bei.',
  'joinForm.button': 'Beitreten',
  'joinForm.error': 'Raumcodes haben 5 Buchstaben, zum Beispiel KATZE.',
  'quick.title': 'Schnelles Spiel',
  'quick.text': 'Setz dich an einen offenen Tisch mit anderen Spielern. Kommt innerhalb von 15 Sekunden niemand dazu, übernehmen Bots die freien Plätze.',
  'quick.link': 'Tisch finden',
  'practice.title': 'Gegen Bots üben',
  'practice.text': 'Lerne die Regeln in deinem Tempo gegen einen bis fünf Computergegner.',
  'practice.link': 'Übungsspiel starten',
  'rules.title': 'So geht’s',
  'rules.lead': 'Lege so viele Paare ab wie möglich und halte am Ende bloß nicht den Schwarzen Peter in der Hand.',
  'rules.pairs.title': 'Die Paare',
  'rules.pairs.text': '15 bis 18 passende Paare, je nach Spiel 30 bis 36 Karten.',
  'rules.peter.title': 'Der Schwarze Peter',
  'rules.peter.text': 'Eine einzige Karte ohne Partner. In unserem Spiel ist es die schwarze Katze.',
  'rules.step1.title': 'Geben und sortieren',
  'rules.step1.text': 'Wer gibt, mischt und verteilt alle Karten. Dass manche eine Karte mehr bekommen, ist normal. Alle legen ihre Paare offen auf den Tisch und halten den Rest verdeckt.',
  'rules.step2.title': 'Ziehen, im Uhrzeigersinn',
  'rules.step2.text': 'Wer links vom Geber sitzt, fängt an und hält dem nächsten Spieler die Karten verdeckt hin. Dieser zieht eine davon. Passt sie, wird das Paar offen abgelegt. Sonst bleibt die Karte in seiner Hand.',
  'rules.step3.title': 'Weitergeben',
  'rules.step3.text': 'Wer gerade gezogen hat, hält nun die eigenen Karten dem nächsten Spieler hin. Die Hände werden kleiner, und wer keine Karten mehr hat, ist raus und in Sicherheit.',
  'rules.step4.title': 'Wer zuletzt die Katze hat, verliert',
  'rules.step4.text': 'Gespielt wird, bis nur noch der Schwarze Peter übrig ist. Wer ihn dann hält, hat als Einziger verloren.',
  'deck.title': 'Die Alpenkarten',
  'deck.lead': 'Unser erstes Kartenspiel kommt aus den Bergen: 18 Tierpaare, denen du beim Wandern begegnen könntest, und eine Katze, die niemand haben will.',
  'deck.all': 'Alle 37 Karten ansehen',
  'online.title': 'Bluffen klappt auch online',
  'online.lead': 'Am echten Tisch ist das Gesicht die halbe Miete, wenn jemand nach der Katze greift. Genau um diesen Moment herum haben wir die Online-Version gebaut.',
  'online.f1.title': 'Karten jederzeit umsortieren',
  'online.f1.text': 'Schieb oder misch deine Karten, während dein Nachbar aussucht. So weiß er nie, wo die Katze steckt.',
  'online.f2.title': 'Sehen, wohin die Hand wandert',
  'online.f2.text': 'Wenn dein Nachbar dran ist, siehst du, welche Karte er gleich nimmt.',
  'online.f3.title': 'Reagieren ohne Tippen',
  'online.f3.text': 'Schick ein Grinsen, ein Staunen oder ein Schulterzucken. Kein offener Chat, darum bleibt es kinderfreundlich.',
  'online.imgAlt': 'Ein laufendes Spiel: Lena sucht eine deiner Karten aus, und die Karte, auf die sie zeigt, hebt sich in deiner Hand.',
  'online.imgSrc': '/images/table-de.webp',
  'cta.title': 'Ich bin dabei',
  'cta.text': 'Erstelle in wenigen Sekunden einen Raum und schick den Link. Gäste brauchen kein Konto.',

  // Privacy page
  'meta.privacyTitle': 'Datenschutz und Kontakt: Schwarzer Peter',
  'meta.privacyDescription': 'Was Schwarzer Peter über dich speichert (sehr wenig), Infos für Eltern und wie du uns erreichst.',
  'privacy.title': 'Datenschutz und Kontakt',
  'privacy.lead': 'Schwarzer Peter ist ein privates Hobbyprojekt. Es gibt keine Konten, keine Werbung und kein Tracking, und es wird so wenig wie möglich über dich gespeichert.',
  'privacy.updated': 'Zuletzt aktualisiert am 29. Oktober 2026.',
  'privacy.browser.title': 'Was in deinem Browser bleibt',
  'privacy.browser.text': 'Die Seite speichert ein paar Dinge im lokalen Speicher deines Browsers, damit du sie nicht jedes Mal neu eingeben musst:',
  'privacy.browser.lang': 'die Sprache, die du gewählt hast,',
  'privacy.browser.name': 'den Namen, mit dem du zuletzt gespielt hast, und deine Einstellungen fürs Üben,',
  'privacy.browser.seat': 'für jeden Online-Raum einen zufälligen Code, mit dem du nach einem Neuladen wieder auf deinen Platz kommst.',
  'privacy.browser.clear': 'Es gibt keine Cookies. Du kannst das alles jederzeit löschen, indem du in deinem Browser die Daten dieser Seite entfernst.',
  'privacy.server.title': 'Was der Spielserver speichert',
  'privacy.server.text': 'Wenn du online spielst, werden der Name, den du eingibst, und der Spielstand auf dem Spielserver gespeichert, solange der Raum genutzt wird. Ein Raum wird 30 Minuten, nachdem alle gegangen sind, automatisch gelöscht. Das schnelle Spiel merkt sich nur, welcher Tisch sich gerade füllt und wie viele Plätze vergeben sind, nicht wer sich gesetzt hat. Dein Name ist nur für die Mitspieler an deinem Tisch sichtbar.',
  'privacy.hosts.title': 'Wer sonst beteiligt ist',
  'privacy.hosts.text': 'Die Website liegt bei Vercel, der Spielserver läuft bei Cloudflare. Wie jeder Webhoster verarbeiten sie technische Daten wie deine IP-Adresse, um die Seiten auszuliefern und den Dienst zu schützen. Diese Protokolle liegen bei ihnen; dieses Projekt sammelt oder speichert sie nicht. Schriften und Bilder kommen direkt von dieser Seite, es werden also keine weiteren Dienste kontaktiert.',
  'privacy.hosts.vercel': 'Datenschutzerklärung von Vercel',
  'privacy.hosts.cloudflare': 'Datenschutzerklärung von Cloudflare',
  'privacy.parents.title': 'Für Eltern',
  'privacy.parents.chat': 'Es gibt keinen Chat. Spieler können nur sechs feste Emotes schicken, zum Beispiel ein Grinsen oder einen Schreck.',
  'privacy.parents.nothing': 'Es gibt keine Konten, keine Werbung und nichts zu kaufen.',
  'privacy.parents.name': 'Andere Spieler sehen nur den Namen, den Ihr Kind eingibt. Ein Vorname oder Spitzname reicht.',
  'privacy.parents.who': 'Online spielt Ihr Kind entweder mit Leuten, denen Sie einen Raum-Link geschickt haben, oder mit anderen Spielern an einem offenen Tisch. Übungsspiele gegen Bots laufen komplett im Browser.',
  'privacy.contact.title': 'Kontakt',
  'privacy.contact.text': 'Fragen, Ideen oder ein Anliegen zu deinen Daten? Schreib an',

  // Deck page
  'deckPage.lead': 'Achtzehn Tiere aus den Schweizer Bergen, jedes doppelt, und dazu eine schwarze Katze ohne Partner. Das macht 37 Karten.',
  'deckPage.note': 'Passende Karten haben dieselbe Zahl in der Ecke, so erkennst du Paare auch auf einem kleinen Bildschirm.',
  'deckPage.back': 'Die Rückseite jeder Karte',
  'deckPage.avoid': 'Die, die keiner will',
  'deckPage.peterAria': 'Karte Schwarzer Peter',

  // Setup (practice)
  'setup.title': 'Gegen Bots üben',
  'setup.lead': 'Spiel eine ganze Runde mit den Alpenkarten. Die Bots ziehen zufällig, es ist also reine Glückssache.',
  'setup.howMany': 'Wie viele Bots?',
  'setup.summary.one': 'Du und 1 Bot, 2 Spieler am Tisch.',
  'setup.summary.other': 'Du und {n} Bots, {total} Spieler am Tisch.',
  'setup.name': 'Dein Name',
  'setup.deal': 'Karten austeilen',
  'setup.friends': 'Lieber mit Freunden spielen',

  // Table
  'table.aria': 'Spieltisch',
  'table.others': 'Mitspieler',
  'table.yourHand': 'Deine Hand',
  'table.pairsDown': 'von {total} Paaren abgelegt',
  'table.leave': 'Spiel verlassen',
  'table.shuffling': 'Die Karten werden gemischt…',
  'table.dealing': 'Die Karten werden ausgeteilt…',
  'table.dealtPairs.one': 'Du hast ein Paar bekommen. Ab auf den Tisch damit.',
  'table.dealtPairs.other': 'Du hast {n} Paare bekommen. Ab auf den Tisch damit.',
  'table.othersLayDown': 'Alle legen ihre ausgeteilten Paare ab.',
  'table.youOut': 'Du hast keine Karten mehr. In Sicherheit!',
  'table.playerOut': '{name} hat keine Karten mehr und ist in Sicherheit.',
  'table.youLost': 'Du bleibst auf dem Schwarzen Peter sitzen.',
  'table.playerLost': '{name} bleibt auf dem Schwarzen Peter sitzen.',
  'table.yourTurn': 'Du bist dran. Zieh eine Karte bei {name}.',
  'table.drawsFrom': '{drawer} zieht bei {offerer}.',
  'table.drawsFromYou': '{drawer} zieht bei dir.',
  'table.choosing': '{name} sucht eine deiner Karten aus…',
  'status.offeringBluff': 'Du hältst deine Karten hin. Verschieb oder misch sie, um zu bluffen.',
  'bluff.shuffle': 'Mischen',
  'bluff.shuffleAria': 'Deine Karten mischen',
  'bluff.cardAria': '{card}. Zum Verschieben ziehen oder die Pfeiltasten nutzen.',
  'bluff.rearranged': '{name} hat die Karten gemischt.',
  'react.bar': 'Reaktionen',
  'react.grin': 'Verschmitztes Grinsen',
  'react.gasp': 'Schreck',
  'react.laugh': 'Lachen',
  'react.sweat': 'Puh',
  'react.shrug': 'Schulterzucken',
  'react.clap': 'Applaus',
  'react.announce': '{name}: {label}',
  'timer.you.one': 'Noch 1 Sekunde, dann wird für dich gezogen.',
  'timer.you.other': 'Noch {n} Sekunden, dann wird für dich gezogen.',
  'timer.seat': 'noch {n} s',
  'soot.title': 'Rußfleck auf der Nase: hatte letzte Runde die Katze',
  'soot.you': 'Du hast noch einen Rußfleck von der letzten Runde.',
  'soot.start': '{name} startet diese Runde mit einem Rußfleck auf der Nase.',
  'draw.youPeter': 'Du hast den Schwarzen Peter gezogen!',
  'draw.youPair': 'Du ziehst: {card}. Ein Paar!',
  'draw.you': 'Du ziehst: {card}.',
  'draw.tookPeter': '{name} hat dir den Schwarzen Peter abgenommen!',
  'draw.tookYourPair': '{name} nimmt deine Karte {card} und legt ein Paar ab.',
  'draw.tookYour': '{name} nimmt deine Karte {card}.',
  'draw.otherPair': '{name} zieht bei {other} und legt ein Paar ab: {card}.',
  'draw.other': '{name} zieht eine Karte bei {other}.',
  'status.out': 'Du bist raus und in Sicherheit, auf Platz {n}',
  'status.keptCat': 'Du hast die Katze behalten',
  'status.dealing': 'Deine Karten',
  'status.drawing': 'Du bist dran mit Ziehen',
  'status.offering': 'Du hältst deine Karten hin',
  'status.hold.one': 'Du hast 1 Karte',
  'status.hold.other': 'Du hast {n} Karten',
  'seat.keptCat': 'hat die Katze behalten',
  'seat.safe': 'in Sicherheit, Platz {n}',
  'seat.offline': 'offline, es wird für sie gezogen',
  'seat.drawing': 'zieht',
  'seat.offering': 'hält Karten hin',
  'seat.cards.one': '1 Karte',
  'seat.cards.other': '{n} Karten',
  'pile.aria': '{n} Paare auf dem Tisch',
  'pile.down.one': '1 Paar abgelegt',
  'pile.down.other': '{n} Paare abgelegt',
  'pile.none': 'Noch keine Paare',
  'offer.aria': 'Karten von {name}, verdeckt',
  'offer.card': 'Karte {i} von {n} aus der Hand von {name}',
  'result.lostTitle': 'Du hast die Katze behalten',
  'result.wonTitle': 'Du bist in Sicherheit!',
  'result.lostText': 'Der Schwarze Peter ist diese Runde bei dir geblieben. Nach alter Tradition gibt es dafür einen Rußfleck auf die Nase.',
  'result.wonText': '{loser} bleibt auf dem Schwarzen Peter sitzen. Du warst auf Platz {n}.',
  'result.someone': 'Jemand',
  'result.safe': 'in Sicherheit',
  'result.keptCat': 'hat die Katze',
  'result.home': 'Zurück zur Startseite',
  'result.changePlayers': 'Mitspieler ändern',
  'leave.title': 'Spiel verlassen?',
  'leave.practiceNote': 'Die Runde endet und kann nicht fortgesetzt werden.',
  'leave.onlineNote': 'Ein Bot übernimmt deinen Platz für den Rest der Runde.',
  'leave.stay': 'Weiterspielen',

  // Online
  'create.title': 'Mit Freunden spielen',
  'create.lead': 'Erstelle einen Raum und schick den Link. Alle spielen auf ihrem eigenen Handy oder Computer mit.',
  'create.error': 'Der Spielserver hat nicht geantwortet. Prüfe deine Verbindung und versuch es nochmal.',
  'create.busy': 'Raum wird erstellt…',
  'create.button': 'Raum erstellen',
  'create.practise': 'Lieber gegen Bots üben',
  'room.docTitle': 'Raum {code}: Schwarzer Peter',
  'room.joining': 'Du betrittst Raum {code}…',
  'rematch.button': 'Revanche',
  'rematch.asked': 'Bereit für die Revanche',
  'rematch.waitingFor': 'Warte auf {names}.',
  'rematch.wants.one': '{names} möchte eine Revanche.',
  'rematch.wants.other': '{names} möchten eine Revanche.',
  'create.tooMany.one': 'Du hast gerade sehr viele Räume eröffnet. Versuch es in einer Sekunde nochmal.',
  'create.tooMany.other': 'Du hast gerade sehr viele Räume eröffnet. Versuch es in {n} Sekunden nochmal.',
  'room.theHost': 'der Gastgeber',
  'join.invited': 'Du bist eingeladen in Raum',
  'join.lead': 'Wähle einen Namen, damit die anderen wissen, wer du bist.',
  'join.button': 'Raum betreten',
  'join.rules': 'So geht’s',
  'lobby.code': 'Raumcode',
  'lobby.lead': 'Schick diesen Link an deine Freunde. Bis zu {n} Spieler haben am Tisch Platz.',
  'lobby.link': 'Link zum Raum',
  'lobby.copied': 'Link kopiert',
  'lobby.copy': 'Link kopieren',
  'lobby.share': 'Teilen',
  'lobby.shareText': 'Spiel mit mir Schwarzer Peter: Raum {code}',
  'lobby.table': 'Am Tisch',
  'lobby.seats': '{n} von {max} Plätzen',
  'lobby.tagYou': 'du',
  'lobby.tagHost': 'Gastgeber',
  'lobby.tagAway': 'abwesend',
  'lobby.bot': 'Bot',
  'lobby.botJoins': 'kommt zum Start dazu',
  'lobby.fillBots': 'Freie Plätze mit Bots füllen',
  'lobby.fewer': 'Ein Bot weniger',
  'lobby.more': 'Ein Bot mehr',
  'lobby.start': 'Spiel starten',
  'lobby.needTwo': 'Lade jemanden ein oder nimm einen Bot dazu.',
  'lobby.waiting': 'Warte, bis {name} das Spiel startet.',
  'lobby.leave': 'Raum verlassen',
  'problem.ROOM_NOT_FOUND.title': 'Diesen Raum gibt es nicht',
  'problem.ROOM_NOT_FOUND.text': 'Prüfe den Code, den du bekommen hast, oder erstelle einen neuen Raum.',
  'problem.ROOM_FULL.title': 'Dieser Raum ist voll',
  'problem.ROOM_FULL.text': 'Ein Spiel hat höchstens 6 Spieler. Frag nach einem neuen Raum oder erstelle deinen eigenen.',
  'problem.GAME_IN_PROGRESS.title': 'Dieses Spiel läuft schon',
  'problem.GAME_IN_PROGRESS.text': 'Du kannst bei der nächsten Runde mitspielen, sobald alle zurück im Raum sind, oder deinen eigenen Raum erstellen.',
  'problem.create': 'Neuen Raum erstellen',
  'problem.practise': 'Gegen Bots üben',
  'conn.reconnecting': 'Verbindung verloren. Neuer Versuch…',
  'quick.docTitle': 'Schnelles Spiel: Schwarzer Peter',
  'quick.heading': 'Schnelles Spiel',
  'quick.lead': 'Setz dich an einen offenen Tisch mit anderen Spielern. Kommt niemand dazu, übernehmen Bots die freien Plätze.',
  'quick.find': 'Tisch finden',
  'quick.finding': 'Tisch wird gesucht…',
  'quick.waitTitle': 'Mitspieler werden gesucht',
  'quick.waitLead': 'Das Spiel startet, sobald {seats} Spieler da sind oder der Countdown abläuft. Freie Plätze übernehmen Bots.',
  'quick.seconds.one': 'Sekunde',
  'quick.seconds.other': 'Sekunden',
  'quick.starting': 'Es geht los…',
  'quick.openSeat': 'Freier Platz',
  'quick.openSeatNote': 'ein Bot, falls niemand kommt',
  'quick.leave': 'Tisch verlassen',
  'quick.another': 'Neuen Tisch suchen',
  'quick.requeue': 'Dieser Tisch hat gerade angefangen. Wir suchen dir einen anderen…',
  'quick.friends': 'Lieber mit Freunden spielen',
  'error.NOT_HOST': 'Das kann nur der Gastgeber.',
  'error.NOT_ENOUGH_PLAYERS': 'Lade jemanden ein oder nimm einen Bot dazu.',
  'error.NOT_YOUR_TURN': 'Du bist gerade nicht dran.',
  'error.INVALID_SLOT': 'Diese Karte ist nicht mehr da.',
  'error.default': 'Das hat nicht geklappt. Versuch es nochmal.',
};

const messages: Record<Lang, Record<string, string>> = { en, de };
