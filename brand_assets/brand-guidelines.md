# Schwarzer Peter: brand guidelines (v0.1)

The brand is taken from the logo: an old card box with a navy ground, cream lettering outlined in ember orange, brass ornaments and a black cat.

## Colour

| Name | Hex | Use |
|---|---|---|
| Kohle | `#1E2430` | Page background |
| Kohle raised | `#272F3D` | Panels and cards (elevated) |
| Kohle float | `#323B4C` | Floating surfaces, closing CTA |
| Russ | `#12151B` | Shadows, sunken bands, inputs |
| Pergament | `#F4E4C1` | Text, card faces |
| Pergament dim | `#CFC2A5` | Secondary text |
| Glut | `#E8622C` | Primary actions, the cat, "danger" moments |
| Messing | `#C6A15B` | Frames, ornaments, step numbers |

Glut is only for actions and the Schwarzer Peter card. Use Messing for decoration, never for buttons.

## Type
- **Gloock** for headings, letter-spacing −0.03em, tight leading.
- **Figtree** (400–700) for body and UI text, line-height 1.7.
- Use sentence case everywhere. No all-caps labels.

## Shapes and depth
- Brass double-line frames, echoing the logo border, go only on the most important surfaces.
- Three depth levels: base (Kohle), raised (soft dark shadow) and floating (deeper shadow with a faint ember glow).
- Card ratio is 5:7. Card backs use the logo. The Schwarzer Peter face is a navy card with the cat in a brass medallion.

## Motion
- Animate only `transform` and `opacity`, with spring easing `cubic-bezier(.34,1.56,.64,1)`.
- The page has one deliberate moment: dealing the hand. Everything else moves only when the user acts.
- Respect `prefers-reduced-motion`.

## Voice
Plain, warm and a little mischievous. Say what a button does ("Create a room", "Join"). Talk about the cat, not "the losing card".

## Deck
The first deck is Alpine, with 18 pairs plus the cat (37 cards). The art lives in `cards.js` as inline SVG:

1 Steinbock, 2 Murmeltier, 3 Gämse, 4 Bartgeier, 5 Fuchs, 6 Hirsch, 7 Adler, 8 Igel, 9 Eule, 10 Kuh, 11 Bernhardiner, 12 Wolf, 13 Bär, 14 Schneehase, 15 Eichhörnchen, 16 Dachs, 17 Forelle, 18 Alpensalamander.

- **Card style:** like a vintage Swiss travel poster. Each card is cream paper with a brass double frame and the pair number in two opposite corners. The animal sits in an arched window in front of an Alpine scene with the Matterhorn, a sun and a meadow, and the name is on a navy ribbon.
- **Animals:** flat shapes in Kohle with Glut and Messing accents.
- **Schwarzer Peter card:** the night version of the card, a black cat on a rooftop next to a chimney under a crescent moon, with an orange ribbon.
- No lynx or other cat-like animals, so nothing can be confused with the Schwarzer Peter.
- The artwork must be original. Never copy Carlit or Ravensburger illustrations.
