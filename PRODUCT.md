# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
TypeScript + Vite, built to a static folder the owner uploads to their own website. SVG board rendering, no game framework. Optional small Node.js WebSocket relay (`server/`) for online play. The original Java console prototype in `src/` stays untouched.

## Users
Visitors to the owner's personal website who want a quick, fun strategy match, on desktop or phone: solo against AI, several people passing one device (hotseat), or friends on separate devices (online room code).

## Product Purpose
Juräa Frontiers: a Risk-style conquest game on a hex map of the continent Juräa. Three factions land on the continent and fight for it. Success: a match is easy to start, readable at a glance, satisfying to play, and feels polished and fast on any device.

## Positioning
Risk's reinforce → attack → fortify loop on hexes, with terrain that matters (each faction draws its power from a terrain type) and three asymmetric factions from the owner's own lore.

## Capabilities and Constraints
- Factions (from the Java code, binding): Death Cults / Necromancers (resource: Souls), Evergarden / Elves (resource: Mana), Giants (resource: Ore). Neutral wildlands exist (Faction NONE).
- Units by faction (from `src/main/resources/data`): skeleton / death knight / death priest; warrior / eagle rider / wizard; iron gut / horn rider / shaman.
- Terrain: plains, forest, mountain, desert (from `LandType`), plus sea.
- Game modes: vs AI, hotseat, online multiplayer (relay server needed for online).
- English UI text.

## Brand Commitments
- Name: Juräa Frontiers. Lore and quotes from README.md (Solomon, Mammon, Sylvana, Adanthar, Maltur).
- Look pinned by the owner: like the board game "Siedler von Catan", cartoony and not too serious, Kingdom Rush as art-style reference.

## Evidence on Hand
No art assets exist (README has only placeholders). All art is authored in code as SVG.

## Product Principles
1. Every action animates, but never blocks reading the board.
2. One glance tells whose turn, what phase, and what to do next.
3. Works with one thumb on a phone as well as with a mouse.
4. Game rules are deterministic so online and saved games replay exactly.
