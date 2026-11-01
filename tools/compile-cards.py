#!/usr/bin/env python3
"""Compiles Foundations Oracle text into ability data the engine can run.

A card becomes playable only when EVERY line of its rules text matches a known pattern,
so nothing is ever approximated. Unmatched cards are listed in the report with the line
that stopped them, which is how the next mechanic family gets chosen.

Input:  .tmp/fdn/fdn.json (Scryfall set data)
Output: src/game/cards.generated.json (playable cards), .tmp/compile-report.txt
"""
import json, re, sys, os
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import argparse
_ap = argparse.ArgumentParser()
_ap.add_argument("--input", default=".tmp/fdn/fdn.json")
_ap.add_argument("--output", default="src/game/cards.generated.json")
_ap.add_argument("--report", default=".tmp/compile-report.txt")
_ap.add_argument("--prefer", default="", help="a Scryfall set file whose printings win for cards of the same name (id, set, art, number)")
ARGS = _ap.parse_args()
data = json.load(open(os.path.join(ROOT, ARGS.input)))
PREFER = {}
if ARGS.prefer:
    _pf = json.load(open(os.path.join(ROOT, ARGS.prefer)))
    for _c in (_pf if isinstance(_pf, list) else _pf.get("data", _pf)):
        PREFER.setdefault(_c["name"], _c)

KEYWORDS = ["Flying", "Reach", "Haste", "Trample", "Deathtouch", "First strike", "Double strike", "Vigilance", "Lifelink", "Menace", "Defender", "Indestructible", "Hexproof", "Flash", "Prowess", "Changeling"]
KW_LOWER = {k.lower(): k for k in KEYWORDS}
COLORS = {"W": "white", "U": "blue", "B": "black", "R": "red", "G": "green"}
COLOR_WORD = {v: k for k, v in COLORS.items()}
NUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "X": "X"}

def num(s):
    s = s.strip()
    if s in NUM: return NUM[s]
    if s.isdigit(): return int(s)
    raise ValueError(s)

def strip_reminder(t):
    return re.sub(r"\s*\([^)]*\)", "", t)

def short_name(card):
    return card["name"].split(",")[0]

# ---------- targets ----------
TARGETS = [
    (r"any target", "any"),
    (r"target creature or planeswalker an opponent controls", "creatureOpp"),
    (r"target creature an opponent controls", "creatureOpp"),
    (r"target creature or planeswalker", "creature"),
    (r"target creature you control", "creatureYou"),
    (r"target attacking or blocking creature", "creatureCombat"),
    (r"target attacking creature", "creatureAttacking"),
    (r"target tapped creature", "creatureTapped"),
    (r"target nonland permanent", "nonlandPermanent"),
    (r"target artifact or enchantment", "artifactOrEnchantment"),
    (r"target artifact", "artifact"),
    (r"target enchantment", "enchantment"),
    (r"target creature", "creature"),
    (r"target opponent", "opponent"),
    (r"target player", "player"),
    (r"each opponent", "eachOpponent"),
    (r"each player", "eachPlayer"),
    (r"this creature", "self"),
    (r"up to one target creature", "creatureOptional"),
    (r"that creature", "that"),
    (r"target creature you control", "creatureYou"),
    (r"it", "self"),
    (r"another target creature you control", "otherCreatureYou"),
    (r"target player or planeswalker", "player"),
]
TARGET_RE = "|".join(t for t, _ in TARGETS)
def target_of(text):
    for pat, name in TARGETS:
        if re.fullmatch(pat, text.strip(), re.I): return name
    raise ValueError("target:" + text)

# ---------- effect sentences (one sentence -> one effect) ----------
def pump(m):
    p, t = m.group("p"), m.group("t")
    return {"op": "pump", "target": target_of(m.group("tgt")), "p": int(p), "t": int(t)}

EFFECTS = [
    (rf"(?P<tgt>{TARGET_RE}) gets (?P<p>[+-]\d+)/(?P<t>[+-]\d+) until end of turn", pump),
    (rf"(?P<tgt>{TARGET_RE}) gets (?P<p>[+-]\d+)/(?P<t>[+-]\d+) and gains (?P<kw>[a-z ]+) until end of turn",
        lambda m: {"op": "pump", "target": target_of(m.group("tgt")), "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (rf"(?P<tgt>{TARGET_RE}) gains (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "grant", "target": target_of(m.group("tgt")), "keywords": kws(m.group("kw"))}),
    (rf"CARDNAME deals (?P<n>\d+) damage to (?P<tgt>{TARGET_RE})", lambda m: {"op": "damage", "target": target_of(m.group("tgt")), "n": int(m.group("n"))}),
    (rf"this (?:creature|enchantment|artifact) deals (?P<n>\d+) damage to (?P<tgt>{TARGET_RE})", lambda m: {"op": "damage", "target": target_of(m.group("tgt")), "n": int(m.group("n"))}),
    (rf"this creature deals (?P<n>\d+) damage to you", lambda m: {"op": "damage", "target": "self_player", "n": int(m.group("n"))}),
    (r"put (?P<n>a|two|three) \+1/\+1 counters? on (?:it|this creature|that creature|CARDNAME)", lambda m: {"op": "counters", "target": "self", "n": num(m.group("n"))}),
    (r"destroy all creatures", lambda m: {"op": "wipe", "what": "creatures"}),
    (r"destroy all tapped creatures", lambda m: {"op": "wipe", "what": "tappedCreatures"}),
    (r"destroy all artifacts", lambda m: {"op": "wipe", "what": "artifacts"}),
    (r"destroy all enchantments", lambda m: {"op": "wipe", "what": "enchantments"}),
    (r"destroy all creatures with mana value (?P<n>\d) or less", lambda m: {"op": "wipe", "what": "creatures", "maxMv": int(m.group("n"))}),
    (r"destroy all creatures with mana value (?P<n>\d) or greater", lambda m: {"op": "wipe", "what": "creatures", "minMv": int(m.group("n"))}),
    (r"they can't be regenerated", lambda m: {"op": "noop"}),
    (r"destroy target permanent", lambda m: {"op": "destroy", "target": "permanent"}),
    (r"exile (?P<tgt>another target nonland permanent|target nonland permanent|target creature|target artifact or creature|target nonland permanent an opponent controls|target creature an opponent controls) until this (?:permanent|creature|enchantment|artifact) leaves the battlefield", lambda m: {"op": "exileUntilLeaves", "target": {"another target nonland permanent": "otherNonlandPermanent", "target nonland permanent": "nonlandPermanent", "target creature": "creature", "target artifact or creature": "artifactOrCreature", "target nonland permanent an opponent controls": "nonlandPermanentOpp", "target creature an opponent controls": "creatureOpp"}[m.group("tgt")]}),
    (r"exile another target nonland permanent", lambda m: {"op": "exile", "target": "otherNonlandPermanent"}),
    (r"its controller gains life equal to its power", lambda m: {"op": "gainLife", "who": "thatController", "n": 0, "per": "thatPower"}),
    (r"its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped", "n": 1, "who": "thatController", "optional": True}),
    (r"its controller creates a (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+) creature token", lambda m: {"op": "token", "n": 1, "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": [], "who": "thatController"}),
    (r"you gain life equal to that creature's toughness", lambda m: {"op": "gainLife", "who": "you", "n": 0, "per": "thatToughness"}),
    (r"pay (?P<c>(\{[WUBRGC0-9]\})+)", lambda m: {"op": "pay", "cost": mana_cost_str(m.group("c"))}),
    (r"add one mana of any color in your commander's color identity", lambda m: {"op": "addMana", "colors": ["identity"]}),
    (r"add one mana of any color", lambda m: {"op": "addMana", "colors": ["W", "U", "B", "R", "G"]}),
    (r"add \{C\}\{C\}", lambda m: {"op": "addMana", "colors": ["C"], "n": 2}),
    (r"add \{C\}", lambda m: {"op": "addMana", "colors": ["C"]}),
    (r"gain (?P<n>\d+) life", lambda m: {"op": "gainLife", "who": "you", "n": int(m.group("n"))}),
    (r"put a \+1/\+1 counter on target creature for each 1 life you gained", lambda m: {"op": "counters", "target": "creature", "n": 0, "per": "lifeGained"}),
    (r"put a \+1/\+1 counter on each (?P<sub>[A-Z][a-z]+) you control", lambda m: {"op": "countersAll", "filter": "subtypeYou", "subtype": m.group("sub"), "n": 1}),
    (r"search your library for up to two basic (?P<sub>Plains|Island|Swamp|Mountain|Forest) cards, reveal them, put them into your hand, then shuffle", lambda m: {"op": "fetchLandToHand", "n": 2, "basic": True, "basicType": m.group("sub")}),
    (r"search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped", "n": 2, "sameType": True}),
    (r"you may put a land card from your hand onto the battlefield", lambda m: {"op": "putLandFromHand", "optional": True}),
    (r"look at the top card of your library\. If it's a creature card of the chosen type, you may reveal it and put it into your hand", lambda m: {"op": "topToHandIf", "chosenType": True}),
    (r"you become the monarch", lambda m: {"op": "monarch"}),
    (r"investigate", lambda m: {"op": "investigate", "n": 1}),
    (r"investigate once for each opponent who has more cards in hand than you", lambda m: {"op": "investigate", "n": 0, "per": "opponentsWithMoreCards"}),
    (r"create a (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+) creature token with (?P<kw>[a-z ]+)\. If you're the monarch, create a (?P<p2>\d)/(?P<t2>\d) (?P<col2>[a-z]+) (?P<sub2>[A-Z][a-z]+) creature token with (?P<kw2>[a-z ]+) instead", lambda m: {"op": "token", "n": 1, "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": kws(m.group("kw")), "monarchAlt": {"p": int(m.group("p2")), "t": int(m.group("t2")), "color": m.group("col2"), "subtype": m.group("sub2"), "keywords": kws(m.group("kw2"))}}),
    (r"until end of turn, this creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and gains (?P<kw>[a-z ]+)", lambda m: {"op": "pump", "target": "self", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),

    (r"target creature gains (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "grant", "target": "creature", "keywords": kws(m.group("kw"))}),
    (r"search your library for a basic land card, put (?:it|that card) onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped", "n": 1}),
    (r"search your library for up to two basic land cards(?: and/or Gate cards)?, put them onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped", "n": 2}),
    (r"search your library for a land card, reveal it, put it into your hand, then shuffle", lambda m: {"op": "fetchLandToHand"}),
    (r"search your library for a basic land card, reveal it, put it into your hand, then shuffle", lambda m: {"op": "fetchLandToHand", "basic": True}),
    (r"you draw a card and lose (?P<l>\d+) life", lambda m: {"op": "seq", "effects": [{"op": "draw", "who": "you", "n": 1}, {"op": "loseLife", "who": "you", "n": int(m.group("l"))}]}),
    (r"you draw (?P<n>a|two|three) cards?", lambda m: {"op": "draw", "who": "you", "n": num(m.group("n"))}),
    (r"draw a card for each creature you control with a \+1/\+1 counter on it", lambda m: {"op": "draw", "who": "you", "n": 0, "per": "counteredCreaturesYou"}),
    (r"draw a card for each different mana value among nonland permanents you control", lambda m: {"op": "draw", "who": "you", "n": 0, "per": "distinctMv"}),
    (r"those creatures gain (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "grantAll", "filter": "counteredCreaturesYou", "keywords": kws(m.group("kw"))}),
    (r"sacrifice another creature", lambda m: {"op": "sacrificeAnother"}),
    (r"sacrifice a land", lambda m: {"op": "sacrificeLand"}),
    (r"return CARDNAME to its owner's hand", lambda m: {"op": "bounce", "target": "self"}),
    (r"target creature can't be blocked this turn", lambda m: {"op": "grant", "target": "creature", "keywords": ["Unblockable"]}),
    (r"CARDNAME deals (?P<n>\d+) damage to you", lambda m: {"op": "damage", "target": "self_player", "n": int(m.group("n"))}),
    (r"add \{G\} for each Elf you control", lambda m: {"op": "addMana", "colors": ["G"], "per": "Elf"}),
    (r"you gain 1 life for each creature destroyed this way", lambda m: {"op": "gainLife", "who": "you", "n": 1, "per": "destroyedThisWay"}),
    (r"create (?P<n>four|five) (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+(?: [A-Z][a-z]+)?) creature tokens", lambda m: {"op": "token", "n": num(m.group("n")), "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": []}),
    (r"destroy target creature with toughness (?P<n>\d) or greater", lambda m: {"op": "destroy", "target": "creature", "cond": {"toughnessAtLeast": int(m.group("n"))}}),
    (r"destroy target creature with power (?P<n>\d) or greater", lambda m: {"op": "destroy", "target": "creature", "cond": {"powerAtLeast": int(m.group("n"))}}),
    (r"destroy target artifact, enchantment, or creature with power (?P<n>\d) or greater", lambda m: {"op": "destroy", "target": "artifactEnchantmentOrBigCreature", "cond": {"powerAtLeast": int(m.group("n"))}}),
    (r"exile target creature or planeswalker that's black or red", lambda m: {"op": "exile", "target": "creature", "cond": {"colors": "BR"}}),
    (r"exile target creature or planeswalker that's white or blue", lambda m: {"op": "exile", "target": "creature", "cond": {"colors": "WU"}}),
    (r"exile target player's graveyard", lambda m: {"op": "exileGraveyard", "who": "player"}),
    (r"you gain (?P<n>\d+) life for each Gate you control", lambda m: {"op": "gainLife", "who": "you", "n": int(m.group("n")), "per": "gates"}),
    (r"exile up to one target nonland permanent an opponent controls until this enchantment leaves the battlefield", lambda m: {"op": "exileUntilLeaves", "target": "nonlandPermanentOpp", "optional": True}),
    (r"its controller creates a (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+) creature token", lambda m: {"op": "token", "n": 1, "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": [], "who": "thatController"}),
    (r"put a \+1/\+1 counter on another target attacking creature you control", lambda m: {"op": "counters", "target": "otherAttackingCreatureYou", "n": 1}),
    (r"put a \+1/\+1 counter on each of up to two other target creatures you control", lambda m: {"op": "counters", "target": "upToTwoOtherCreaturesYou", "n": 1}),
    (r"put a \+1/\+1 counter on each creature you control", lambda m: {"op": "countersAll", "filter": "creaturesYou", "n": 1}),
    (r"return all creature cards with mana value (?P<n>\d) or less from your graveyard to the battlefield", lambda m: {"op": "reanimateAll", "maxMv": int(m.group("n"))}),
    (r"attacking creatures you control get \+X/\+X until end of turn, where X is the number of attacking creatures", lambda m: {"op": "pumpAll", "filter": "attackingYou", "p": 0, "t": 0, "perAttacking": True}),
    (r"return up to one other target permanent you control to its owner's hand", lambda m: {"op": "bounce", "target": "otherPermanentYou", "optional": True}),
    (r"destroy target nonland permanent", lambda m: {"op": "destroy", "target": "nonlandPermanent"}),
    (r"you gain (?P<n>\d+) life and draw a card", lambda m: {"op": "seq", "effects": [{"op": "gainLife", "who": "you", "n": int(m.group("n"))}, {"op": "draw", "who": "you", "n": 1}]}),
    (r"surveil (?P<n>\d)", lambda m: {"op": "surveil", "n": int(m.group("n"))}),
    (r"mill (?P<n>a|two|three|four) cards?", lambda m: {"op": "mill", "who": "you", "n": num(m.group("n"))}),
    (r"target player mills (?P<n>a|two|three|four) cards?", lambda m: {"op": "mill", "who": "player", "n": num(m.group("n"))}),
    (r"exile target creature or enchantment", lambda m: {"op": "exile", "target": "creatureOrEnchantment"}),
    (r"destroy target artifact, enchantment, or creature with flying", lambda m: {"op": "destroy", "target": "artifactEnchantmentOrFlyer"}),
    (r"destroy target artifact or enchantment", lambda m: {"op": "destroy", "target": "artifactOrEnchantment"}),
    (r"destroy target creature or planeswalker", lambda m: {"op": "destroy", "target": "creature"}),
    (r"destroy target creature with flying", lambda m: {"op": "destroy", "target": "flyer"}),
    (r"creatures you control gain (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "grantAll", "filter": "creaturesYou", "keywords": kws(m.group("kw"))}),
    (r"permanents you control gain indestructible until end of turn", lambda m: {"op": "grantAll", "filter": "permanentsYou", "keywords": ["Indestructible"]}),
    (r"return all attacking creatures to their owner's hand", lambda m: {"op": "bounceAll", "filter": "attacking"}),
    (r"equipped creature gets \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pump", "target": "equipped", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"have (?P<tgt>target creature|target creature you control) get \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pump", "target": target_of(m.group("tgt")), "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"exile target nonland permanent an opponent controls until this enchantment leaves the battlefield", lambda m: {"op": "exileUntilLeaves", "target": "nonlandPermanentOpp"}),
    (r"exile target creature an opponent controls until this (?:creature|enchantment|artifact) leaves the battlefield", lambda m: {"op": "exileUntilLeaves", "target": "creatureOpp"}),
    (r"you gain (?P<n>\d+) life for each attacking creature", lambda m: {"op": "gainLife", "who": "you", "n": int(m.group("n")), "per": "attacking"}),
    (r"you gain life equal to the sacrificed creature's toughness", lambda m: {"op": "gainLife", "who": "you", "n": 0, "per": "sacrificedToughness"}),
    (r"CARDNAME can't be blocked this turn", lambda m: {"op": "grant", "target": "self", "keywords": ["Unblockable"]}),
    (r"target creature can't block this turn", lambda m: {"op": "cantBlock", "target": "creature"}),
    (r"creatures your opponents control get -(?P<p>\d+)/-(?P<t>\d+) until end of turn", lambda m: {"op": "pumpAll", "filter": "creaturesOpp", "p": -int(m.group("p")), "t": -int(m.group("t"))}),
    (r"each opponent loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "eachOpponent", "n": int(m.group("n"))}),
    (r"each player loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "eachPlayer", "n": int(m.group("n"))}),
    (r"each opponent discards a card", lambda m: {"op": "discard", "who": "eachOpponent", "n": 1}),
    (r"target opponent discards (?P<n>a|two) cards?", lambda m: {"op": "discard", "who": "player", "n": num(m.group("n"))}),
    (r"return target creature card from your graveyard to your hand", lambda m: {"op": "regrow", "what": "creature"}),
    (r"return target creature card from your graveyard to the battlefield", lambda m: {"op": "reanimate", "what": "creature"}),
    (r"draw (?P<n>a|two|three) cards? and you lose (?P<l>\d+) life", lambda m: {"op": "seq", "effects": [{"op": "draw", "who": "you", "n": num(m.group("n"))}, {"op": "loseLife", "who": "you", "n": int(m.group("l"))}]}),
    (r"you lose (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "you", "n": int(m.group("n"))}),
    (r"creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pumpAll", "filter": "creaturesYou", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"untap (?P<tgt>target creature|target land|target permanent)", lambda m: {"op": "untap", "target": target_of(m.group("tgt")) if m.group("tgt") != "target permanent" else "permanent"}),
    (r"create a (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+)(?: and [a-z]+)? (?P<sub>[A-Z][a-z]+(?: [A-Z][a-z]+)?) creature token(?: with (?P<kw>[a-z ]+))?", lambda m: {"op": "token", "n": 1, "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": kws(m.group("kw")) if m.group("kw") else []}),
    (r"create (?P<n>two|three) (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+(?: [A-Z][a-z]+)?) creature tokens?(?: with (?P<kw>[a-z ]+))?", lambda m: {"op": "token", "n": num(m.group("n")), "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": kws(m.group("kw")) if m.group("kw") else []}),
    (r"each creature you control gets \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pumpAll", "filter": "creaturesYou", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"other creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pumpAll", "filter": "otherCreaturesYou", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"this creature gets \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pump", "target": "self", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"this creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and gains (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "pump", "target": "self", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"CARDNAME gets \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pump", "target": "self", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"this creature gains (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "grant", "target": "self", "keywords": kws(m.group("kw"))}),
    (r"this creature can't be blocked this turn", lambda m: {"op": "grant", "target": "self", "keywords": ["Unblockable"]}),
    (r"that player loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "that", "n": int(m.group("n"))}),
    (r"target player loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "player", "n": int(m.group("n"))}),
    (r"target player gains (?P<n>\d+) life", lambda m: {"op": "gainLife", "who": "player", "n": int(m.group("n"))}),
    (r"draw (?P<n>a|two|three) cards?, then discard (?:a|two) cards?", lambda m: {"op": "loot", "n": num(m.group("n"))}),
    (r"discard a card", lambda m: {"op": "discard", "who": "you", "n": 1}),
    (r"sacrifice a creature", lambda m: {"op": "sacrificeAny", "who": "you"}),
    (r"target player sacrifices a creature of their choice", lambda m: {"op": "sacrificeAny", "who": "player"}),
    (r"each opponent sacrifices a creature of their choice", lambda m: {"op": "sacrificeAny", "who": "eachOpponent"}),
    (rf"(?P<tgt>{TARGET_RE}) gets -(?P<p>\d+)/-(?P<t>\d+) until end of turn", lambda m: {"op": "pump", "target": target_of(m.group("tgt")), "p": -int(m.group("p")), "t": -int(m.group("t"))}),
    (r"exile (?P<tgt>target creature an opponent controls|target creature|target nonland permanent)", lambda m: {"op": "exile", "target": target_of(m.group("tgt"))}),
    (rf"it deals (?P<n>\d+) damage to (?P<tgt>{TARGET_RE})", lambda m: {"op": "damage", "target": target_of(m.group("tgt")), "n": int(m.group("n"))}),
    (rf"destroy (?P<tgt>{TARGET_RE})", lambda m: {"op": "destroy", "target": target_of(m.group("tgt"))}),
    (rf"exile (?P<tgt>{TARGET_RE})", lambda m: {"op": "exile", "target": target_of(m.group("tgt"))}),
    (rf"return (?P<tgt>{TARGET_RE}) to its owner's hand", lambda m: {"op": "bounce", "target": target_of(m.group("tgt"))}),
    (r"counter target spell", lambda m: {"op": "counter", "target": "spell"}),
    (r"counter target noncreature spell", lambda m: {"op": "counter", "target": "noncreatureSpell"}),
    (r"counter target creature spell", lambda m: {"op": "counter", "target": "creatureSpell"}),
    (r"you gain (?P<n>\d+) life", lambda m: {"op": "gainLife", "who": "you", "n": int(m.group("n"))}),
    (r"you lose (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "you", "n": int(m.group("n"))}),
    (r"each opponent loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "eachOpponent", "n": int(m.group("n"))}),
    (r"target opponent loses (?P<n>\d+) life", lambda m: {"op": "loseLife", "who": "opponent", "n": int(m.group("n"))}),
    (r"draw (?P<n>a|two|three|four) cards?", lambda m: {"op": "draw", "who": "you", "n": num(m.group("n"))}),
    (r"you draw a card and lose (?P<l>\d+) life", lambda m: {"op": "seq", "effects": [{"op": "draw", "who": "you", "n": 1}, {"op": "loseLife", "who": "you", "n": int(m.group("l"))}]}),
    (r"you draw (?P<n>a|two|three) cards?", lambda m: {"op": "draw", "who": "you", "n": num(m.group("n"))}),
    (r"target player draws (?P<n>a|two) cards?", lambda m: {"op": "draw", "who": "player", "n": num(m.group("n"))}),
    (r"target opponent discards (?P<n>a|two) cards?", lambda m: {"op": "discard", "who": "opponent", "n": num(m.group("n"))}),
    (r"each opponent discards (?P<n>a|two) cards?", lambda m: {"op": "discard", "who": "eachOpponent", "n": num(m.group("n"))}),
    (r"scry (?P<n>\d+)", lambda m: {"op": "scry", "n": int(m.group("n"))}),
    (r"surveil (?P<n>\d+)", lambda m: {"op": "surveil", "n": int(m.group("n"))}),
    (r"you may draw a card\. if you do, discard a card", lambda m: {"op": "loot"}),
    (r"draw a card, then discard a card", lambda m: {"op": "loot"}),
    (rf"put (?P<n>a|two|three) \+1/\+1 counters? on (?P<tgt>{TARGET_RE})", lambda m: {"op": "counters", "target": target_of(m.group("tgt")), "n": num(m.group("n"))}),
    (rf"put (?P<n>a|two|three) \+1/\+1 counters? on each creature you control", lambda m: {"op": "counters", "target": "eachCreatureYou", "n": num(m.group("n"))}),
    (r"create (?P<n>a|two|three) (?P<p>\d+)/(?P<t>\d+) (?P<col>white|blue|black|red|green|colorless) (?P<sub>[A-Z][a-z]+(?: [A-Z][a-z]+)?) (?:artifact )?creature tokens?(?: with (?P<kw>[a-z ]+))?",
        lambda m: {"op": "token", "n": num(m.group("n")), "p": int(m.group("p")), "t": int(m.group("t")), "color": COLOR_WORD.get(m.group("col"), "C"), "subtypes": m.group("sub").split(" "), "keywords": kws(m.group("kw")) if m.group("kw") else []}),
    (r"create a treasure token", lambda m: {"op": "token", "n": 1, "p": 0, "t": 0, "color": "C", "subtypes": ["Treasure"], "keywords": [], "artifact": "treasure"}),
    (r"create a food token", lambda m: {"op": "token", "n": 1, "p": 0, "t": 0, "color": "C", "subtypes": ["Food"], "keywords": [], "artifact": "food"}),
    (rf"tap (?P<tgt>{TARGET_RE})", lambda m: {"op": "tap", "target": target_of(m.group("tgt"))}),
    (rf"(?P<tgt>{TARGET_RE}) doesn't untap during its controller's next untap step", lambda m: {"op": "freeze", "target": target_of(m.group("tgt"))}),
    (rf"untap (?P<tgt>{TARGET_RE})", lambda m: {"op": "untap", "target": target_of(m.group("tgt"))}),
    (r"each player mills (?P<n>\d+) cards?", lambda m: {"op": "mill", "who": "eachPlayer", "n": int(m.group("n"))}),
    (r"mill (?P<n>\d+) cards?", lambda m: {"op": "mill", "who": "you", "n": int(m.group("n"))}),
    (r"target player mills (?P<n>\d+) cards?", lambda m: {"op": "mill", "who": "player", "n": int(m.group("n"))}),
    (rf"(?P<tgt>{TARGET_RE}) can't block this turn", lambda m: {"op": "cantBlock", "target": target_of(m.group("tgt"))}),
    (r"creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+) until end of turn", lambda m: {"op": "pumpAll", "filter": "creaturesYou", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+) and gain (?P<kw>[a-z ]+) until end of turn", lambda m: {"op": "pumpAll", "filter": "creaturesYou", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"add (?P<m>(?:\{[WUBRGC]\}(?: or )?)+)", lambda m: {"op": "addMana", "colors": re.findall(r"\{([WUBRG])\}", m.group("m")) or ["C"]}),
    (r"add one mana of any color", lambda m: {"op": "addMana", "colors": ["W", "U", "B", "R", "G"]}),
    (r"add (?P<n>two|three) mana of any one color", lambda m: {"op": "addMana", "colors": ["W", "U", "B", "R", "G"], "n": num(m.group("n"))}),
    (rf"(?P<tgt>{TARGET_RE}) fights (?P<tgt2>{TARGET_RE})", lambda m: {"op": "fight", "target": target_of(m.group("tgt")), "target2": target_of(m.group("tgt2"))}),
    (rf"(?P<tgt>{TARGET_RE}) deals damage equal to its power to (?P<tgt2>{TARGET_RE})", lambda m: {"op": "bite", "target": target_of(m.group("tgt")), "target2": target_of(m.group("tgt2"))}),
    (r"sacrifice this creature", lambda m: {"op": "sacrifice", "target": "self"}),
    (r"return this card from your graveyard to your hand", lambda m: {"op": "regrowSelf"}),
    (r"return target creature card from your graveyard to your hand", lambda m: {"op": "regrow", "what": "creature"}),
    (r"return target creature card from your graveyard to the battlefield", lambda m: {"op": "reanimate", "what": "creature"}),
    (r"search your library for a basic land card, put it onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped"}),
    (r"search your library for a basic land card, reveal it, put it into your hand, then shuffle", lambda m: {"op": "fetchLand"}),
    (r"search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle", lambda m: {"op": "rampTapped", "n": 2}),
]

def kws(text):
    out = []
    for k in re.split(r",\s*|\s+and\s+", text.strip()):
        k = k.strip()
        if not k: continue
        if k.lower() not in KW_LOWER: raise ValueError("keyword:" + k)
        out.append(KW_LOWER[k.lower()])
    return out

def compile_sentence(sent, cardname):
    s = sent.strip().rstrip(".").replace(cardname, "CARDNAME")
    s = s[0].lower() + s[1:] if s else s
    optional = False
    if s.startswith("you may "):
        s = s[8:]; optional = True
    cond = None
    m = re.match(r"if (?P<c>you control (?:a creature with power 4 or greater|another creature with power 4 or greater|three or more creatures|six or more lands|another Elf|two or more other creatures|an? [A-Z][a-z]+)|you attacked this turn|a creature died this turn|an opponent lost life this turn|you gained \d+ or more life this turn|that player controls more lands than you), (?P<rest>.+)", s, re.I)
    if m:
        cond = m.group("c").lower(); s = m.group("rest")
    for pat, fn in EFFECTS:
        mm = re.fullmatch(pat, s, re.I)
        if mm:
            e = fn(mm)
            if optional: e["optional"] = True
            if cond: e["if"] = cond
            return e
    # "A and B": both halves must parse on their own.
    if " and " in s:
        parts = re.split(r"\s+and\s+", s, maxsplit=1)
        try:
            a = compile_sentence(parts[0], cardname); b = compile_sentence(parts[1], cardname)
            out = {"op": "seq", "effects": [a, b]}
            if optional: out["optional"] = True
            if cond: out["if"] = cond
            return out
        except ValueError:
            pass
    raise ValueError("sentence:" + sent)

def compile_effects(text, cardname):
    # Sentences separated by ". " ; "Then " joins are fine as separate sentences.
    text = text.replace(". If you're the monarch, create", "\u2024 If you're the monarch, create").replace("look at the top card of your library. If it's a creature card", "look at the top card of your library\u2024 If it's a creature card")
    sents = [p.replace("\u2024", ".") for p in re.split(r"(?<=[^A-Z])\.\s+|\.$", text.strip()) if p.strip()]
    out = []
    for sent in sents:
        sent = re.sub(r"^(Then|then) ", "", sent.strip())
        if re.match(r"^[Ii]f you do, ", sent):
            if not out or not out[-1].get("optional"): raise ValueError("sentence:" + sent)
            out[-1]["then"] = compile_effects(sent[len("If you do, "):], cardname)
            continue
        m = re.fullmatch(r"(.+) unless (you attacked this turn)", sent.rstrip("."))
        if m:
            e = compile_sentence(m.group(1), cardname); e["ifNot"] = m.group(2); out.append(e); continue
        out.append(compile_sentence(sent, cardname))
    return out

TRIGGERS = [
    (r"When this creature enters or dies, (?P<e>.+)", "etbOrDies"),
    (r"Whenever an? (?P<sub>[A-Z][a-z]+) you control enters, (?P<e>.+)", "subtypeYouEnters"),
    (r"Whenever an? (?P<sub>[A-Z][a-z]+) you control dies, (?P<e>.+)", "subtypeYouDies"),
    (r"Whenever another (?P<sub>[A-Z][a-z]+) or (?P<sub2>[A-Z][a-z]+) you control enters, (?P<e>.+)", "anotherSubtypeEnters"),
    (r"At the beginning of each end step, (?P<e>.+)", "eachEndStep"),
    (r"At the beginning of your end step, (?P<e>.+)", "endStep"),
    (r"Whenever you attack with two or more creatures, (?P<e>.+)", "youAttack2"),
    (r"Whenever another player attacks with two or more creatures, they draw a card if none of those creatures attacked you\.?", "otherAttacks2NotMe"),
    (r"Whenever a land an opponent controls enters, (?P<e>.+)", "oppLandEnters"),
    (r"Whenever you cast a white spell, (?P<e>.+)", "castWhiteSpell"),
    (r"When this land enters, (?P<e>.+)", "etb"),
    (r"Whenever a nontoken creature you control dies, (?P<e>.+)", "nontokenCreatureYouDies"),
    (r"Whenever another nontoken creature dies, (?P<e>.+)", "anotherNontokenCreatureDies"),
    (r"Whenever a creature you control with power 4 or greater enters, (?P<e>.+)", "bigCreatureEnters"),
    (r"Whenever a Gate you control enters, (?P<e>.+)", "gateEnters"),
    (r"Whenever you cast a spell that targets this creature, (?P<e>.+)", "targetedByYourSpell"),
    (r"Whenever you put one or more \+1/\+1 counters on this creature, (?P<e>.+?)\. This ability triggers only once each turn\.?", "countersOnSelf:once"),
    (r"At the beginning of your upkeep, (?P<e>.+)", "upkeep"),
    (r"When this creature dies, (?P<e>.+)", "dies"),
    (r"Whenever this creature enters or attacks, (?P<e>.+)", "etbOrAttacks"),
    (r"Whenever this creature attacks while you control a creature with power 4 or greater, (?P<e>.+)", "attacks:power4"),
    (r"Whenever CARDNAME attacks while you control a creature with power 4 or greater, (?P<e>.+)", "attacks:power4"),
    (r"Whenever a white creature you control attacks, (?P<e>.+)", "whiteCreatureAttacks"),
    (r"Whenever (?:CARDNAME|this creature) or another creature you control dies, (?P<e>.+)", "selfOrAnotherDies"),
    (r"Whenever a creature you control enters, (?P<e>.+)", "creatureYouEnters"),
    (r"Whenever another (?P<sub>[A-Z][a-z]+) you control enters, (?P<e>.+)", "anotherSubtypeEnters"),
    (r"Whenever (?:CARDNAME|this creature) or another nontoken (?P<sub>[A-Z][a-z]+) you control enters, (?P<e>.+)", "selfOrAnotherSubtypeEnters"),
    (r"Whenever you cast a creature spell, (?P<e>.+)", "castCreature"),
    (r"Whenever you cast a spell, (?P<e>.+)", "castSpell"),
    (r"Whenever you draw a card, (?P<e>.+)", "drawCard"),
    (r"Whenever an opponent loses life, you gain that much life", "mirrorLifeLoss"),
    (r"When this (?:creature|artifact|enchantment|permanent) enters, (?P<e>.+)", "etb"),
    (r"When CARDNAME enters, (?P<e>.+)", "etb"),
    (r"When this land enters, (?P<e>.+)", "etb"),
    (r"When this creature dies, (?P<e>.+)", "dies"),
    (r"When CARDNAME dies, (?P<e>.+)", "dies"),
    (r"Whenever this creature attacks, (?P<e>.+)", "attacks"),
    (r"Whenever CARDNAME attacks, (?P<e>.+)", "attacks"),
    (r"Whenever this creature deals combat damage to a player, (?P<e>.+)", "combatDamageToPlayer"),
    (r"Whenever CARDNAME deals combat damage to a player, (?P<e>.+)", "combatDamageToPlayer"),
    (r"Whenever another creature you control enters, (?P<e>.+)", "anotherCreatureEnters"),
    (r"Whenever you gain life, (?P<e>.+)", "lifeGain"),
    (r"Whenever a creature you control dies, (?P<e>.+)", "creatureYouDies"),
    (r"Whenever another creature you control dies, (?P<e>.+)", "anotherCreatureYouDies"),
    (r"At the beginning of your upkeep, (?P<e>.+)", "upkeep"),
    (r"At the beginning of your end step, (?P<e>.+)", "endStep"),
    (r"At the beginning of combat on your turn, (?P<e>.+)", "beginCombat"),
    (r"Landfall — Whenever a land you control enters, (?P<e>.+)", "landfall"),
    (r"Whenever a land you control enters, (?P<e>.+)", "landfall"),
    (r"Whenever you cast a noncreature spell, (?P<e>.+)", "castNoncreature"),
    (r"Whenever you cast an instant or sorcery spell, (?P<e>.+)", "castInstantSorcery"),
    (r"Whenever this creature becomes blocked, (?P<e>.+)", "blocked"),
    (r"Whenever this creature blocks, (?P<e>.+)", "blocks"),
    (r"Raid — When this creature enters, if you attacked this turn, (?P<e>.+)", "etb:raid"),
    (r"Raid — At the beginning of your end step, if you attacked this turn, (?P<e>.+)", "endStep:raid"),
    (r"Morbid — When this creature enters, if a creature died this turn, (?P<e>.+)", "etb:morbid"),
    (r"Whenever one or more creatures you control attack, (?P<e>.+)", "youAttack"),
    (r"Whenever you attack, (?P<e>.+)", "youAttack"),
]

STATICS = [
    (r"This (?:artifact|creature|enchantment) enters tapped", lambda m: {"kind": "entersTapped"}),
    (r"This land enters tapped unless you control an? (?P<sub>Plains|Island|Swamp|Mountain|Forest)", lambda m: {"kind": "entersTapped", "unless": m.group("sub")}),
    (r"As this (?:artifact|enchantment|creature|land) enters, choose a creature type", lambda m: {"kind": "chooseType", "what": "creatureType"}),
    (r"As this creature enters, choose a card type", lambda m: {"kind": "chooseType", "what": "cardType"}),
    (r"Creature spells you cast of the chosen type cost \{(?P<n>\d)\} less to cast", lambda m: {"kind": "static", "op": "costLess", "what": "chosenType", "n": int(m.group("n"))}),
    (r"(?P<sub>[A-Z][a-z]+) spells you cast cost \{(?P<n>\d)\} less to cast", lambda m: {"kind": "static", "op": "costLess", "what": "subtype", "subtype": m.group("sub"), "n": int(m.group("n"))}),
    (r"Creatures you control of the chosen type get \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "static", "op": "anthem", "filter": {"subtype": "chosen"}, "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"This creature gets \+(?P<p>\d+)/\+(?P<t>\d+) as long as you have (?P<n>\d+) or more life", lambda m: {"kind": "static", "op": "selfBuffIf", "p": int(m.group("p")), "t": int(m.group("t")), "cond": f"life>={m.group('n')}"}),
    (r"As long as you have at least (?P<n>\d+) life more than your starting life total, creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "static", "op": "anthem", "filter": {}, "p": int(m.group("p")), "t": int(m.group("t")), "cond": f"lifeAboveStart>={m.group('n')}"}),
    (r"Lieutenant — As long as you control your commander, this creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and creatures you control have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "lieutenant", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"Other creatures you control with flying have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "grantAll", "filter": {"subtype": "creatures", "other": True, "flying": True}, "keywords": kws(m.group("kw"))}),
    (r"You and creatures you control have protection from the chosen card type", lambda m: {"kind": "static", "op": "protectionChosen"}),
    (r"If one or more creature tokens would be created under your control, that many (?P<p>\d)/(?P<t>\d) (?P<col>[a-z]+) (?P<sub>[A-Z][a-z]+) creature tokens with (?P<kw>[a-z ]+) are created instead", lambda m: {"kind": "static", "op": "tokenReplace", "p": int(m.group("p")), "t": int(m.group("t")), "color": m.group("col"), "subtype": m.group("sub"), "keywords": kws(m.group("kw"))}),
    (r"If an opponent would gain life, that player loses that much life instead", lambda m: {"kind": "static", "op": "oppLifeGainToLoss"}),
    (r"Your opponents can't gain life", lambda m: {"kind": "static", "op": "oppCantGainLife"}),
    (r"Creatures you control have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "grantAll", "filter": {"subtype": "creatures", "other": False}, "keywords": kws(m.group("kw"))}),
    (r"Other (?P<sub>[A-Z][a-z]+s) you control get \+(?P<p>\d+)/\+(?P<t>\d+) and have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "anthem", "filter": {"subtype": m.group("sub"), "other": True}, "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"As long as you have (?P<n>\d+) or more life, this creature has (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "selfKeywordIf", "keywords": kws(m.group("kw")), "cond": f"life>={m.group('n')}"}),
    (r"During your turn, this creature has (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "selfKeywordIf", "keywords": kws(m.group("kw")), "cond": "yourTurn"}),
    (r"Hexproof from (?P<col>black|white|blue|red|green)", lambda m: {"kind": "keyword", "name": "Hexproof from " + m.group("col")}),
    (r"You can't lose the game and your opponents can't win the game", lambda m: {"kind": "static", "op": "cantLose"}),
    (r"If you would gain life, you gain that much life plus 1 instead", lambda m: {"kind": "static", "op": "lifeGainPlusOne"}),
    (r"Whenever a creature an opponent controls enters, (?P<e>.+)", lambda m: {"kind": "triggered", "when": "oppCreatureEnters", "effects": compile_effects(m.group("e"), "CARDNAME")}),
    (r"Whenever you gain life for the first time (?:each turn|during each of your turns), (?P<e>.+)", lambda m: {"kind": "triggered", "when": "firstLifeGain", "effects": compile_effects(m.group("e"), "CARDNAME")}),
    (r"Whenever you attack with three or more creatures, (?P<e>.+)", lambda m: {"kind": "triggered", "when": "youAttack3", "effects": compile_effects(m.group("e"), "CARDNAME")}),
    (r"Whenever another creature you control with power 2 or less enters, you may pay \{1\}\. If you do, draw a card", lambda m: {"kind": "triggered", "when": "smallCreatureEnters", "effects": [{"op": "draw", "who": "you", "n": 1, "payOptional": "1"}]}),
    (r"Enchanted creature gets \+(?P<p>\d+)/\+(?P<t>\d+), has (?P<kw>[a-z ,]+?), and is an? [A-Z][a-z]+ in addition to its other types", lambda m: {"kind": "static", "op": "auraStatic", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"Enchanted creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and has (?P<kw>[a-z ,]+)", lambda m: {"kind": "static", "op": "auraStatic", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"Equipped creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and has (?P<kw>[a-z ,]+)", lambda m: {"kind": "static", "op": "equipStatic", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"You have hexproof", lambda m: {"kind": "static", "op": "playerHexproof"}),
    (r"Creatures your opponents control enter tapped", lambda m: {"kind": "static", "op": "oppEnterTapped"}),
    (r"At the beginning of the end step, sacrifice this creature", lambda m: {"kind": "triggered", "when": "endStep", "effects": [{"op": "sacrificeSelf"}]}),
    (r"This creature can't block", lambda m: {"kind": "static", "op": "cantBlock"}),
    (r"This creature attacks each combat if able", lambda m: {"kind": "static", "op": "mustAttack"}),
    (r"This creature can block only creatures with flying", lambda m: {"kind": "static", "op": "blockOnlyFlyers"}),
    (r"(?:CARDNAME|This creature) can't be blocked by creatures with power 2 or less", lambda m: {"kind": "static", "op": "evasion", "what": "power2"}),
    (r"(?:CARDNAME|This creature) can't be blocked by more than one creature", lambda m: {"kind": "static", "op": "evasion", "what": "one"}),
    (r"(?:CARDNAME|This creature) can't be blocked except by two or more creatures", lambda m: {"kind": "keyword", "name": "Menace"}),
    (r"Other (?P<sub>[A-Z][a-z]+)(?: creature)?s? you control get \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "static", "op": "anthem", "filter": {"subtype": m.group("sub"), "other": True}, "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Other creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "static", "op": "anthem", "filter": {"other": True}, "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Creatures you control get \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "static", "op": "anthem", "filter": {}, "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Other (?P<sub>[A-Z][a-z]+)s? you control have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "grantAll", "filter": {"subtype": m.group("sub"), "other": True}, "keywords": kws(m.group("kw"))}),
    (r"Creatures you control have (?P<kw>[a-z ]+)", lambda m: {"kind": "static", "op": "grantAll", "filter": {}, "keywords": kws(m.group("kw"))}),
    (r"This creature can't block", lambda m: {"kind": "static", "op": "cantBlock"}),
    (r"This creature attacks each combat if able", lambda m: {"kind": "static", "op": "mustAttack"}),
    (r"This creature can't be blocked by creatures with power (?P<n>\d+) or greater", lambda m: {"kind": "static", "op": "evasionPower", "n": int(m.group("n"))}),
    (r"This creature can't be blocked by more than one creature", lambda m: {"kind": "static", "op": "oneBlocker"}),
    (r"This spell can't be countered", lambda m: {"kind": "static", "op": "uncounterable"}),
    (r"Enchanted creature gets \+(?P<p>[+-]?\d+)/\+(?P<t>[+-]?\d+)", lambda m: {"kind": "auraStatic", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Enchanted creature gets (?P<p>[+-]\d+)/(?P<t>[+-]\d+)", lambda m: {"kind": "auraStatic", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Enchanted creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and has (?P<kw>[a-z ]+(?:(?:, | and )[a-z ]+)*)", lambda m: {"kind": "auraStatic", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"Enchanted creature has (?P<kw>[a-z ]+(?:(?:, | and )[a-z ]+)*)", lambda m: {"kind": "auraStatic", "p": 0, "t": 0, "keywords": kws(m.group("kw"))}),
    (r"Enchanted creature can't attack or block", lambda m: {"kind": "auraStatic", "p": 0, "t": 0, "pacify": True}),
    (r"Enchanted creature can't attack or block, and its activated abilities can't be activated", lambda m: {"kind": "auraStatic", "p": 0, "t": 0, "pacify": True}),
    (r"Equipped creature gets \+(?P<p>\d+)/\+(?P<t>\d+)", lambda m: {"kind": "equipStatic", "p": int(m.group("p")), "t": int(m.group("t"))}),
    (r"Equipped creature gets \+(?P<p>\d+)/\+(?P<t>\d+) and has (?P<kw>[a-z ]+(?:(?:, | and )[a-z ]+)*)", lambda m: {"kind": "equipStatic", "p": int(m.group("p")), "t": int(m.group("t")), "keywords": kws(m.group("kw"))}),
    (r"Equipped creature has (?P<kw>[a-z ]+(?:(?:, | and )[a-z ]+)*)", lambda m: {"kind": "equipStatic", "p": 0, "t": 0, "keywords": kws(m.group("kw"))}),
    (r"This land enters tapped", lambda m: {"kind": "entersTapped"}),
    (r"Enchant creature", lambda m: {"kind": "enchant", "what": "creature"}),
    (r"Enchant creature you control", lambda m: {"kind": "enchant", "what": "creatureYou"}),
    (r"Enchant creature an opponent controls", lambda m: {"kind": "enchant", "what": "creatureOpp"}),
    (r"Equip \{(?P<n>\d+)\}", lambda m: {"kind": "equip", "cost": m.group("n")}),
    (r"Flashback (?P<cost>(?:\{[^}]+\})+)", lambda m: {"kind": "flashback", "cost": m.group("cost")}),
    (r"Kicker (?P<cost>(?:\{[^}]+\})+)", lambda m: {"kind": "kicker", "cost": m.group("cost")}),
    (r"Ward (?P<cost>(?:\{[^}]+\})+)", lambda m: {"kind": "keyword", "name": "Ward", "cost": m.group("cost")}),
    (r"Ward—Pay (?P<n>\d+) life", lambda m: {"kind": "keyword", "name": "Ward", "life": int(m.group("n"))}),
    (r"Prowess", lambda m: {"kind": "keyword", "name": "Prowess"}),
    (r"Changeling", lambda m: {"kind": "keyword", "name": "Changeling"}),
    (r"Instant and sorcery spells you cast cost \{(?P<n>\d)\} less to cast", lambda m: {"kind": "static", "op": "costLess", "what": "instantSorcery", "n": int(m.group("n"))}),
    (r"You may play an additional land on each of your turns", lambda m: {"kind": "static", "op": "extraLand"}),
    (r"You have no maximum hand size", lambda m: {"kind": "static", "op": "noHandLimit"}),
    (r"This creature gets \+(?P<p>\d+)/\+(?P<t>\d+) as long as you control (?P<what>another (?P<sub>[A-Z][a-z]+)|an artifact|a creature with power 4 or greater|an Equipment)", lambda m: {"kind": "static", "op": "selfBuffIf", "p": int(m.group("p")), "t": int(m.group("t")), "cond": m.group("what").lower()}),
]

def mana_cost_str(cost):
    return "".join(re.findall(r"\{([^}]+)\}", cost)).replace("/", "")

def compile_line(line, card):
    name = short_name(card)
    line = line.strip()
    if not line: return None
    # keywords list: "Flying, vigilance" / "Flying" / "Trample, lifelink"
    parts = [p.strip() for p in line.rstrip(".").split(",")]
    def kw_item(p):
        if p.lower() in KW_LOWER: return {"kind": "keyword", "name": KW_LOWER[p.lower()]}
        m = re.fullmatch(r"protection from (?P<q>.+)", p, re.I)
        if m:
            quals = [q.strip() for q in re.split(r"\s+and from\s+|\s+and\s+", m.group("q"))]
            return {"kind": "protection", "from": quals}
        m = re.fullmatch(r"Cycling (?P<c>(\{[WUBRGC0-9]\})+)", p)
        if m: return {"kind": "cycling", "cost": mana_cost_str(m.group("c"))}
        return None
    items = [kw_item(p) for p in parts]
    if all(items):
        return items
    # statics / fixed lines
    for pat, fn in STATICS:
        m = re.fullmatch(pat, line.rstrip("."), re.I)
        if m:
            if fn is None: raise ValueError("static-unsupported:" + line)
            return [fn(m)]
    # triggers
    for pat, when in TRIGGERS:
        m = re.fullmatch(pat, line.replace(name, "CARDNAME"), re.I)
        if m:
            if when in ("mirrorLifeLoss", "otherAttacks2NotMe"): return [{"kind": "triggered", "when": when, "effects": []}]
            t = {"kind": "triggered", "when": when, "effects": compile_effects(m.group("e"), "CARDNAME")}
            if "sub" in m.groupdict() and m.group("sub"): t["subtype"] = m.group("sub")
            if "sub2" in m.groupdict() and m.group("sub2"): t["subtype2"] = m.group("sub2")
            return [t]
    # activated: "{cost}, {T}: effect" / "{T}: effect" / "{cost}: effect" / "{cost}, Sacrifice this creature: effect"
    m = re.fullmatch(r"(?P<cost>[^:]+): (?P<e>.+)", line)
    if m and ("{" in m.group("cost") or "Sacrifice" in m.group("cost")):
        costs = [c.strip() for c in m.group("cost").split(",")]
        cost = {}
        for c in costs:
            if c == "{T}": cost["tap"] = True
            elif re.fullmatch(r"(\{[WUBRGC0-9]\})+", c): cost["mana"] = mana_cost_str(c)
            elif c.lower() in ("sacrifice this creature", "sacrifice this artifact", "sacrifice this land", "sacrifice this enchantment", "sacrifice this permanent"): cost["sacrificeSelf"] = True
            elif c.lower() in ("sacrifice a creature", "sacrifice another creature"): cost["sacrificeCreature"] = "another" if "another" in c.lower() else "any"
            elif re.fullmatch(r"Pay (\d+) life", c): cost["life"] = int(re.fullmatch(r"Pay (\d+) life", c).group(1))
            elif re.fullmatch(r"Discard a card", c): cost["discard"] = 1
            else: raise ValueError("cost:" + c)
        eff = m.group("e")
        restriction = None
        if eff.endswith(" Activate only as a sorcery."): eff = eff[: -len(" Activate only as a sorcery.")]; restriction = "sorcery"
        if eff.endswith(" Activate only once each turn."): eff = eff[: -len(" Activate only once each turn.")]; restriction = "oncePerTurn"
        if eff.endswith(" Activate only if you control five or more lands."): eff = eff[: -len(" Activate only if you control five or more lands.")]; restriction = "lands>=5"
        out = {"kind": "activated", "cost": cost, "effects": compile_effects(eff, name)}
        if restriction: out["restriction"] = restriction
        return [out]
    # plain spell / ETB-less effect line for instants and sorceries
    if "Instant" in card["type_line"] or "Sorcery" in card["type_line"]:
        return [{"kind": "spell", "effects": compile_effects(line, name)}]
    raise ValueError("line:" + line)

def compile_card(card):
    face = card if "oracle_text" in card else (card.get("card_faces") or [{}])[0]
    if "card_faces" in card and "oracle_text" not in card: raise ValueError("double-faced")
    text = strip_reminder(face.get("oracle_text", "") or "")
    tl = card["type_line"]
    if "Planeswalker" in tl: raise ValueError("planeswalker")
    if "Battle" in tl: raise ValueError("battle")
    abilities = []
    lines = [l for l in text.split("\n") if l.strip()]
    # Modal spells: "Choose one —" followed by bullet lines.
    if lines and (lines[0].startswith("Choose one") or lines[0].startswith("Choose two")):
        n = 2 if "Choose two" in lines[0] else 1
        choices = []
        for l in lines[1:]:
            if not l.startswith("•"): raise ValueError("modal-tail:" + l)
            choices.append(compile_effects(l.lstrip("• ").strip(), short_name(card)))
        abilities.append({"kind": "modal", "n": n, "choices": choices})
        lines = []
    additional = None
    if any(l.strip() in ("When this enchantment leaves the battlefield, return the exiled card to the battlefield under its owner's control.", "When this creature leaves the battlefield, return the exiled card to the battlefield under its owner's control.", "When this artifact leaves the battlefield, return the exiled card to the battlefield under its owner's control.") for l in lines):
        lines = [l for l in lines if "return the exiled card to the battlefield" not in l]
        lines = [re.sub(r"exile (another target nonland permanent|target nonland permanent an opponent controls|target creature an opponent controls|target creature|target nonland permanent|target artifact or creature)(\.|$)", lambda mm: f"exile {mm.group(1)} until this creature leaves the battlefield{mm.group(2)}", l) for l in lines]
    for l in lines:
        if l.strip() == "As an additional cost to cast this spell, discard a card.": additional = {"discard": 1}; continue
        if l.strip() == "As an additional cost to cast this spell, sacrifice a creature.": additional = {"sacrificeCreature": "any"}; continue
        r = compile_line(l, card)
        if r: abilities.extend(r)
    if additional:
        spell = next((a for a in abilities if a.get("kind") == "spell"), None)
        if not spell: raise ValueError("line:additional-cost-without-spell")
        spell["additionalCost"] = additional
    kind = "land" if "Land" in tl else "creature" if "Creature" in tl else "instant" if "Instant" in tl else "sorcery" if "Sorcery" in tl else "artifact" if "Artifact" in tl else "enchantment" if "Enchantment" in tl else None
    if not kind: raise ValueError("kind:" + tl)
    # Lands need a mana ability (basic lands have an implicit one).
    out = {
        "id": card["id"], "name": card["name"], "kind": kind, "type": tl, "cost": mana_cost_str(face.get("mana_cost", card.get("mana_cost", "")) or ""),
        "colors": "".join(card.get("color_identity", [])), "text": text, "artist": card.get("artist", ""), "num": card["collector_number"], "rarity": card["rarity"],
        "legendary": tl.startswith("Legendary"), "abilities": abilities, "set": card.get("set", ""), "rank": card.get("edhrec_rank") or 0,
    }
    pref = PREFER.get(card["name"])
    if pref and (pref.get("oracle_text") or "") == (card.get("oracle_text") or ""):
        out["id"] = pref["id"]; out["set"] = pref.get("set", ""); out["num"] = pref["collector_number"]; out["artist"] = pref.get("artist", ""); out["rarity"] = pref["rarity"]
    if "power" in face: out["power"] = face["power"]; out["toughness"] = face["toughness"]
    if kind == "land" and "Basic" in tl:
        sub = (tl.split("— ")[1] if "— " in tl else "").replace("Snow ", "").strip()
        basics = {"Plains": "W", "Island": "U", "Swamp": "B", "Mountain": "R", "Forest": "G"}
        if sub not in basics: raise ValueError("land:" + tl)
        out["abilities"].append({"kind": "activated", "cost": {"tap": True}, "effects": [{"op": "addMana", "colors": [basics[sub]]}]})
    if "X" in out["cost"]: raise ValueError("x-cost")
    if not re.fullmatch(r"[0-9WUBRG]*", out["cost"]): raise ValueError("cost:symbol")
    for a in abilities:
        if a.get("kind") in ("flashback", "kicker"): raise ValueError("unsupported:" + a["kind"])
        if a.get("kind") == "keyword" and a.get("name") in ("Ward",): raise ValueError("unsupported:" + a["name"])
        if a.get("kind") == "modal" and a.get("n", 1) > 2: raise ValueError("unsupported:modal")
        if a.get("kind") == "enchant" and a.get("what") != "creature": raise ValueError("unsupported:enchant-" + a["what"])
    return out

ok, bad = [], []
reasons = Counter()
for c in data:
    if c.get("layout") in ("token", "emblem", "art_series"): continue
    try:
        ok.append(compile_card(c))
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as e:
        r = str(e) if isinstance(e, ValueError) else type(e).__name__ + ":" + str(e)[:40]
        bad.append((c["name"], r)); reasons[r.split(":")[0]] += 1

ok.sort(key=lambda c: (c["name"], c["set"]))
json.dump(ok, open(os.path.join(ROOT, ARGS.output), "w"), ensure_ascii=False, separators=(",", ":"))
by_kind = Counter(c["kind"] for c in ok)
by_color = Counter(c["colors"] or "C" for c in ok)
rep = [f"Playable: {len(ok)} of {len(ok) + len(bad)}", f"By kind: {dict(by_kind)}", f"By colour identity: {dict(sorted(by_color.items(), key=lambda x: -x[1]))}", "", "Blocked by reason:"]
rep += [f"  {n:4d}  {r}" for r, n in reasons.most_common()]
rep += ["", "Unplayable cards (first blocking line):"] + [f"  {n} :: {r[:120]}" for n, r in sorted(bad)]
open(os.path.join(ROOT, ARGS.report), "w").write("\n".join(rep))
print("\n".join(rep[:5 + len(reasons)]))
