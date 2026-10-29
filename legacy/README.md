# Planeswalker Quest

An interactive, ADHD-friendly way to learn to play **Magic: The Gathering**: by playing it, with a coach beside you.

Open `index.html` in any browser. It's one self-contained page, so there's nothing to install. Progress saves in your browser.

## The Practice Table (the main event)

Real games of Magic against the computer:

- **Guided first game.** The cards are set up so your first turns teach lands, mana, casting, attacking and blocking. The coach's move is always showing.
- **Free play with every major playing style.** Pick your deck and your opponent's:
  Red Aggro, Green Ramp, Blue Control (with counterspells and the stack), White Tokens (go wide), Black Midrange (removal and reanimation), plus two starter decks.
- **Puzzles: win this turn.** Five short challenges, each built around one rule (Haste, Trample, removal, anthems, Flying).

The coach:

- **What should I do?** shows the best next move and *why*.
- **Coach checks my moves.** Before a weak move happens (a bad attack, a pointless block, a wasted turn, a spell on the wrong target, a bad mulligan), the coach explains the problem. You choose *Change my move* or *Do it anyway*. Good moves get a note too.
- **Not allowed** messages explain the rule when you try something illegal (summoning sickness, one land per turn, Flying blockers, timing for instants and sorceries).
- Tap any card to see what it does.

The rules follow the real game: turn phases, mana and colours, the mana pool emptying, the stack and counterspells, combat with first strike, trample, deathtouch and lifelink, summoning sickness, tokens, and discarding to 7. A few simplifications (one blocker per attacker, fewer moments to cast instants) are listed on the Practice Table page.

## Rules levels

Fifteen short levels (1–5 minutes each) split into **Rules you need to play** and **Good to know, later**. They cover reading a card, card types, mana, the turn, combat, keywords, playing styles, colours, formats, deck building, slang and where to play. Most screens have something to try: card anatomy, a mana-payment puzzle, a combat simulator, land-count odds, mulligan practice and more.

## Designed for ADHD brains

- One idea per screen, with the **key idea first**
- No timers and no penalties. Wrong answers explain why, and you try again.
- XP, ranks and badges with no leaderboards
- **Calm mode** (no animation, pop-ups or confetti), plus text size, extra spacing and light/dark theme
- **Park a thought**: a notepad for stray thoughts
- Optional break timer after each level, **Read aloud** on every screen, and full keyboard support

## Files

- `mtg-quest.html`: the page source (published as a claude.ai artifact)
- `index.html`: the same page wrapped as a standalone document. Rebuild it with `./build.sh` after editing the source.

Content is adapted from The Gamers Lodge's *A Beginner's Guide to Magic: The Gathering*, with rules updated to the current game. Card names in the practice decks are made up.
