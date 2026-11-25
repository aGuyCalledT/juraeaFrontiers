# Juräa Frontiers – Rules v2.1

These are the rules the game implements. Points marked *(assumption)* were not specified and were decided during implementation; change them if you want something else.

## Turn
- Free order: recruit, build, move and attack with each army in any order, then **End turn**.
- Every army has **3 movement points** per turn.
- Entering a hex costs: plains 1, desert 1, forest 2, mountains 3. If a friendly army stands there: −1 (minimum 1).
- About a third of all mountains are **high peaks**: impassable for everyone (the map always stays connected).
- Armies may enter and stand in their **own cities**. Enemy cities can only be taken by siege.
- **Attacking costs 1 movement.** Each army may attack **once per turn**. An attack has **two rounds**; after round 1 the attacker chooses to fight on or retreat.
- Attacking first and moving afterwards is allowed if movement is left.
- An army that destroys an enemy but has no movement left does not move onto the hex.
- A hex belongs to whoever stood on it last. Armies may leave a hex empty.

## Armies
- An army is a group of units and moves as one. Up to **8 units are free**; every unit above 8 costs **1 gold per turn** upkeep (shown on the army). If the player cannot pay, the army gets **low morale: −1 attack and −1 defence** until upkeep is paid again.
- Units can be **dismissed** at any time for a third of their price (rounded down).
- At most **2 armies** of the same player per hex.
- **Split**: an army can split into two on its hex, only if no second army stands there.
- **Merge**: with two armies on one hex the Split button becomes Merge. The merged army keeps the **lower** remaining movement *(assumption: and counts as having attacked if either had)*.
- If a hex with two armies is attacked, both fight as one.

## Combat
1. Every attacking unit rolls **1d6 + attack**.
2. Every defending unit rolls **1d6 + defence + terrain bonus**.
3. Both sides sort their results highest first and compare in pairs (highest against highest, …).
   - Attack > defence: the defender takes 1 hit.
   - Attack ≤ defence: the attacker takes 1 hit.
   - **Spare dice are lost** (as in Risk).
4. Hits remove HP from the weakest units first: tier 1, then tier 2, then tier 3 *(assumption: within a tier, the most wounded first)*.
5. An attack has **two** such rounds; units killed in round 1 do not roll in round 2. The attacker may retreat after round 1.
6. Killing a **tier-3 unit or a Wildling gives 1 gold**; tier 1 and 2 give nothing.

**Defence bonus:** mountains +1, standing in your own city +1, everything else +0 (plus the elves' forest bonuses). It is shown as a shield with a number next to each army.

**HP:** damage stays after the fight. Units next to one of their own cities heal 1 HP at the start of their turn.

## Gold, cities and sieges
- Everything is paid in **gold**. Income per turn:
  - plains +1, mountains +1, forest +½ (every 2 forests +1), desert 0;
  - city +3, city next to the sea +4;
  - each improvement level +1.
- **Improving a hex**: any own hex except cities, twice. Level 1 costs 3 gold, level 2 costs 6 (the same for every faction). Ready after 1 turn. When another player takes the hex, the improvement is destroyed and the conqueror gets 1 gold (2 for level 2).
- Unit costs: tier 1 = **3**, tier 2 = **6**, tier 3 = **9** gold. **Giants pay double.**
- **Recruiting** only happens in cities. Recruits join the garrison inside the city.
- **Building a city**: an army on your own hex gives the order. Cost: 3 base units of your faction (9 gold, 18 for the Giants). Ready after 2 turns. *(Assumption: at least 2 hexes between cities, i.e. a distance of 3 or more.)*
- **Upgrading a city**: costs 2 base units, takes 1 turn, max. level 3. Each level adds 1 round to sieges.
- **Siege**: a city is captured once enemy armies have stood next to it for **3 rounds** (+1 per upgrade level).
  - Counted at the start of the besieger's turn.
  - The count continues as long as any army of that faction stands next to the city.
  - If the last besieging army leaves or is destroyed, the siege ends.
  - A garrison inside the city does **not** stop the count; besiegers may attack it. When the city falls, a garrison still inside is lost.
  - Captured cities belong to the conqueror.

## Victory
- A faction is out when it has **no units** left and cannot recruit any (no city or not enough gold) *(assumption: a faction with a city and gold can still rebuild)*.
- A faction is out after **3 rounds without a city**, or as soon as it can no longer get a city in time (no building site will finish, no siege will succeed, and it cannot afford and place a new city).
- The last faction standing wins.

## Start
- Capitals are placed randomly, as far apart as possible (no preferred terrain). Each faction starts with 1 city, an army next to it (3 base units and 1 tier-2 unit) and **10 gold**.
- About every 4th hex (random, not next to a capital) holds a neutral army of **1–3 Wildlings** (attack +0, defence +1, 1 HP), one more in the mountains. Neutrals never attack.

## Factions

### Death Cults (Necromancers)
**Passive:** after every fight they take part in, they roll 1d6 for each unit that died (friend or foe). Every 6 raises a skeleton in their army. Never more skeletons than units died.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Skeleton | +0 | +0 | 1 | |
| 2 | Lich (undead mage) | +3 | +0 | 1 | |
| 3 | Death Priest (undead bishop) | +1 | +1 | 2 | +3 raising rolls per priest in the fight; if fewer than 3 units died, 1 extra roll per fallen unit. Rolls with bone dice. |

### Evergarden (Elves)
**Passive:** forest grows on every plains or desert hex they claim (mountains stay mountains). +1 defence in forests.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Elven Archer | +1 | +0 | 1 | |
| 2 | Druid (mage with a wooden staff) | +1 | +1 | 2 | Enchants the forest its army stands on (no movement cost). Enchanted forests give elves +1 defence; every 3 enchanted forests give +1 gold per turn. Lost when the hex is captured; the forest stays. |
| 3 | Treant (tree giant) | +2 | +4 | 2 | |

### Giants
**Passive:** stronger units, but everything costs twice as much.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Iron Gut (giant with a huge club) | +2 | +1 | 2 | |
| 2 | Lead Belcher (giant with a ship's cannon) | +2 | +1 | 2 | On a natural 6 he fires again: 4+ wounds the weakest enemy before the exchange (a unit killed this way loses its die). Another 6 fires once more. The first 6 still counts normally *(assumption)*. |
| 3 | Mammoth | +2 | +4 | 2 | At the start of its turn each mammoth heals 1 HP on the best wounded non-mammoth unit in its army. |

## Balance notes (AI against AI)
- 36 games: average **31.7 rounds** (target 25–35), 34 of 36 finished within 80 rounds.
- Wins: **Evergarden 61 %**, Giants 25 %, Death Cults 8 %.
- Experiments (30 games each):
  - Without the forest growth: Evergarden 43 %, Giants 33 %, Death Cults 23 %.
  - Without the elves' +1 in forests: no change (Evergarden 73 %). The forest growth itself is the strong part: forests cost 2 movement and slow every enemy down.
  - Without forest growth **and** skeletons rising on 5–6: Death Cults 43 %, Evergarden 27 %, Giants 27 %.
