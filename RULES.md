# Juräa Frontiers – Rules v3

These are the rules the game implements. Points marked *(assumption)* were not specified and were decided during implementation; change them if you want something else.

## Regions (v3)
- The map is split into **regions of 2–4 connected hexes**, mostly of one biome. Every hex of a region has the same terrain and owner.
- As in Risk, a region is **one field**: armies stand in, move between, attack and own whole regions. Regions touching along any hex edge are neighbours.
- Every region has a name (shown in the tooltip).

## Turn
- Free order: recruit, build, move and attack with each army in any order, then **End turn**.
- **Drag an army** onto a region to march, or onto an enemy region to attack. The arrow is red with crossed swords for an attack and grey with an X where the army cannot go. Tapping only selects; tapping another army selects that one (a rival army shows a read-only panel).
- Every army has **3 movement points** per turn.
- Entering a region costs: plains 1, desert 1, forest 2, mountains 3. If a friendly army stands there: −1 (minimum 1).
- About a third of all mountain regions are **high peaks**: impassable for everyone (the map always stays connected).
- Armies may enter and stand in their **own cities**. Enemy cities must be attacked.
- **Attacking costs 1 movement.** Each army may attack **once per turn**.
- Attacking first and moving afterwards is allowed if movement is left.
- A region belongs to whoever stood on it last. Armies may leave a region empty.

## Armies
- An army is a group of units and moves as one. Up to **8 units are free**; every unit above 8 costs **1 gold per turn** upkeep (shown on the army). If the player cannot pay, the army gets **low morale: −1 attack and −1 defence** until upkeep is paid again.
- Units can be **dismissed** at any time for a third of their price (rounded down).
- At most **2 armies** of the same player per region.
- **Split** and **Merge** as before. The merged army keeps the **lower** remaining movement and counts as having attacked if either had.
- If a region with two armies is attacked, both fight as one.

## Combat
1. Every attacking unit rolls **1d6 + attack**.
2. Every defending unit rolls **1d6 + defence + terrain bonus**.
3. Both sides sort their results highest first and compare in pairs. Attack > defence: the defender takes 1 hit; otherwise the attacker takes 1 hit. **Spare dice are lost** (as in Risk).
4. Hits land on the weakest units first: **tier 1, then siege engines, then tier 2, then tier 3**; within a group, the most wounded first.
5. **Unlimited rounds (v3):** after every round the attacker chooses to **fight on** or **retreat**. The **Auto-fight** switch fights on until one side is gone (it stays on for later fights; switch it off at any time).
6. Killing a **tier-3 unit or a Wildling gives 1 gold**.

**Defence bonus:** mountains +1, own city +1, **own capital +2**, plus the elves' forest bonuses. A siege engine in the attacking army lowers the defenders' bonus by 1. It is shown as a shield next to each army.

**HP:** damage stays after the fight. Units next to one of their own cities heal 1 HP at the start of their turn.

## Siege engines (v3)
- Every faction can build them in its cities: **4 gold** (Giants **8**, as all their units cost double).
- They travel with an army. When that army attacks, the defenders get **−1 defence** (several engines do not stack).
- They never roll a die, have **1 HP**, no attack and no defence. They take hits **after all tier-1 units** and before tier 2. A side with only siege engines left takes a hit for every enemy die.

## Gold and cities
- Income per turn, **per region**: plains +1, mountains +1, forest +½ (every 2 forest regions +1), desert 0; city +3, city by the sea +4; each improvement level +1.
  - **Evergarden:** only cities (+3/+4) and **+2 per enchanted forest region**. Elves cannot improve land.
- **Tier-3 limit:** at most **2 tier-3 units + 1 per city** (Bone Colossi count).
- **Improving** works on a **whole region** (v3): any own region without a city, twice. Level 1 costs 3 gold, level 2 costs 6. Ready after 1 turn. When another player takes the region, the improvement is destroyed and the conqueror gets 1 gold (2 for level 2).
- Unit costs: tier 1 = **3**, tier 2 = **6**, tier 3 = **9** gold. **Giants pay double.**
- **Recruiting** only happens in cities. Recruits join the garrison inside the city.
- **Building a city**: an army on your own region gives the order. Cost: 3 base units (9 gold, 18 for the Giants). Ready after 2 turns, at least 2 regions away from other cities. New cities start at **level 1**.
- **Upgrading a city**: costs 2 base units, takes 1 turn, max. level 3.

## Attacking cities (v3)
- Cities can no longer be taken by standing next to them. They must be **attacked**.
- Each city can be attacked **at most 2 times per turn** (the counter resets at the start of every player's turn; a badge on the city shows it).
- Every city has a **guard**: one unit of the city's faction, **tier = city level** (level 1 → tier 1, 2 → tier 2, 3 → tier 3). **Capitals have a guard one tier higher** *(balance choice)*. The guard only appears in fights against the city (as "City guard" in the dice tray), defends with the city bonus and is back at full HP in every new fight.
- When the guard and all defending armies are beaten, the attacker chooses: **Take** the city (it changes hands) or **Raze** it for **3 gold per city level** *(assumption)*. Either way the attacking army moves into the region with no movement left.

## Victory
- A faction is out when it has **no units** left and cannot recruit any (no city or not enough gold).
- A faction is out after **3 rounds without a city**, or as soon as it can no longer get a city in time.
- The last faction standing wins.

## Start
- Capitals are placed as far apart as possible in region steps. Each faction starts with 1 city, an army next to it (3 base units and 1 tier-2 unit) and **10 gold**.
- Maps are a bit bigger than before (radius 7 / 8 / 9 hexes) so the regions have room.
- About every 4th free region (not next to a capital) holds a neutral army of **1–3 Wildlings** (attack +0, defence +1, 1 HP). Neutrals never attack.

## Factions

### Death Cults (Necromancers)
Any Death Cult army can **blight a forest** (own region or adjacent) instead of attacking: moving through it costs only 1, elves lose all forest bonuses there and its enchantment is gone.
**Passive:** after every fight they take part in, they roll 1d6 for each unit that died (friend or foe). Every **6** raises a skeleton in their army. **Two dead skeletons count as one fallen unit** (v3). Never more skeletons than counted deaths.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Skeleton | +0 | +0 | 1 | |
| 2 | Lich (undead mage) | +3 | +0 | 1 | |
| 3 | Bone Colossus | +3 | +1 | 3 | Only from the faction spell. |
| 3 | Death Priest (undead bishop) | +1 | +1 | 2 | +3 raising rolls per priest in the fight; if fewer than 3 units died, 1 extra roll per fallen unit. Rolls with bone dice. |

### Evergarden (Elves)
**Passive:** +1 defence in healthy forests.
**Growing forest (v3):** each Evergarden city can turn **one region per turn** into an **enchanted forest** (city panel → Grow enchanted forest). The region must be own land **next to that city's region** (range 1, a balance choice; range 2 made Evergarden win 48 %) and not next to a rival city. This also heals blighted forest. Forests no longer grow by themselves and druids no longer enchant.
**Treants** are bought in a city but awaken in **any enchanted elven forest**; that forest turns into plains.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Elven Archer | +1 | +0 | 1 | |
| 2 | Druid (mage with a wooden staff) | +1 | +1 | 2 | Each turn heals 1 HP on the best wounded unit in its army (v3). |
| 3 | Treant (tree giant) | +2 | +3 | 2 | v3: defence was +4. |

Enchanted forests give elves +1 defence and +2 gold per turn. The enchantment is lost when the region is captured; the forest stays.

### Giants
**Passive:** stronger units, but everything costs twice as much.

| Tier | Unit | Attack | Defence | HP | Special |
|---|---|---|---|---|---|
| 1 | Iron Gut (giant with a huge club) | +2 | +0 | 2 | v3: defence −1; attack back to +2 *(balance choice)*. |
| 2 | Lead Belcher (giant with a ship's cannon) | +2 | +0 | 2 | On a natural 6 he fires again: 4+ wounds the weakest enemy before the exchange (a unit killed this way loses its die). Another 6 fires once more. The first 6 still counts normally *(assumption)*. |
| 3 | Mammoth | +2 | +4 | 2 | At the start of its turn each mammoth heals 1 HP on the best wounded non-mammoth unit in its army. An army with a mammoth can **clear a forest** (own region or adjacent) into plains instead of attacking. |

## Terraforming and attacks
Clearing (mammoth) or blighting (Death Cults) uses the army's attack for the turn and costs 1 movement *(assumption)*. Targets: the army's own region or a neighbour, even if enemies stand there.

## Faction spells
Every faction has one spell. It is ready after 3 of its own turns and recharges for 3 turns after each use.

| Faction | Spell | Effect |
|---|---|---|
| Death Cults | Bone Colossus | 3 skeletons of one army fuse into a Bone Colossus (tier 3: +3 / +1 / 3 HP *(stats are my choice)*). |
| Evergarden | Arrow Rain | The archers of one army shoot an adjacent enemy army: every archer rolls, highest against highest, the enemy cannot hurt them. Does not use the army's attack *(assumption)*. |
| Giants | Stone Wall | A wall on an empty region next to a Giant army. Only Giants can enter it. Others can attack it: it rolls 1 die with +4, has **2 HP, +1 for every 10 rounds played** (3 HP from round 10, 4 from round 20…), never strikes back, and attacking it costs all remaining movement. |

## Dwarf fortresses
- Every map has **2 dwarf fortresses** on mountains, far from the capitals. Nobody can enter them.
- They are hidden until any army stands next to one; then everyone can see it.
- An army standing next to a fortress can hire dwarves. They join that army.
- Price: **6 gold** for the faction that discovered that fortress, **9 gold** for everyone else (v2.3).

| Unit | Tier | Attack | Defence | HP | Counters |
|---|---|---|---|---|---|
| Rune Priest | 2 | +1 | +1 | 2 | +2 / +2 against the Death Cults |
| Woodcutter | 2 | +1 | +1 | 2 | +2 / +2 against Evergarden |
| Giant Slayer | 2 | +1 | +1 | 2 | +2 / +2 against the Giants |

*(Stats and the +2 counter bonus are my choice.)*

## Balance notes (AI against AI, 60 games, rules v2.2)
- Average **28 rounds** (target 25–35).
- Wins: Evergarden 40 %, Giants 45 %, Death Cults 13 %.
- With **Iron Gut attack +1** (instead of +2): Evergarden 37 %, Giants 30 %, Death Cults 33 % (30 games).
- Enchanted forests at 1 gold instead of 2: Evergarden fell to about 10 %.

## Balance notes (AI against AI, 150 games, rules v2.3)
- Average **31 rounds**; 4 % of games hit the 80-round cap.
- Wins: Evergarden 38 %, Death Cults 37 %, Giants 21 %.
- Raising on 5–6 lifted the Death Cults from about 12 % to 37 %. With Iron Gut at +1 and dwarves dearer for non-finders, the Giants are now the weakest AI faction.

## Balance notes (AI against AI, 60 games, rules v3)
- First v3 runs (no city guard bonus, raising on 5–6, Iron Gut +1): Death Cults 53 %, Evergarden 23 %, Giants 20 %, only **17 rounds** on average; capitals often fell in the first 5 rounds.
- With capitals +2 defence and a guard one tier higher, raising on 6 only, Iron Gut attack +2, wiped-out sides no longer raising skeletons and forest growth range 1: **Death Cults 25 %, Evergarden 33 %, Giants 40 %**, about **21 rounds**.
- Games are still shorter than the 25–35 target, mostly because the AI rushes capitals. Watch this with human players.

## Playtesting (v2.3)
- The pause menu and the victory screen have a **Playtest report**: add notes, then copy it (or it downloads as a text file if the browser blocks the clipboard).
- The report lists, per faction: result, income, bounty and loot, upkeep, gold spent on units and buildings, recruits, dwarves hired, units slain and lost, spells cast, forests changed, and peak units, cities and hexes.
- Good things to watch with human players: does one tier-3 unit decide fights, are dwarves bought only as counters, does the stone wall stall games, do the Death Cults snowball? (v3: do capitals hold long enough, are siege engines worth 4 gold, is Auto-fight used?)
