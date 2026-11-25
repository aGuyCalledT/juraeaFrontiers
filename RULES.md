# Juräa Frontiers – Regelwerk v2 (Entwurf)

Stand: Rückfragen vom 25.11.2026 beantwortet. Noch nicht im Spiel umgesetzt; das Spiel läuft aktuell nach Regelwerk v1 (Risiko-Stil).
Mit *Annahme* markierte Punkte sind meine Auslegung und noch nicht bestätigt.

## Zugablauf
- Freie Reihenfolge: rekrutieren, bauen, jede Armee beliebig bewegen und angreifen, dann „Zug beenden“.
- Jede Einheit hat **3 Bewegungspunkte** pro Runde.
- Ein Feld betreten kostet: Ebene 1, Wüste 1, Wald 2, Berg 3. Steht dort schon eine verbündete Armee: −1 (mindestens 1).
- **Angreifen kostet 1 Bewegung.** Pro Runde höchstens **ein Angriff** je Armee (ein Schlagabtausch), egal wie viel Bewegung übrig ist.
- Erst angreifen und danach weiterziehen ist erlaubt, wenn noch Bewegung übrig ist.
- Wer einen Gegner vernichtet, aber keine Bewegung mehr hat, zieht nicht auf das Feld.
- Ein Feld gehört immer dem Spieler, der zuletzt darauf stand. Armeen dürfen ein Feld komplett verlassen.

## Armeen
- Eine Armee ist eine Gruppe von Einheiten und wird als Ganzes bewegt. Es gibt keine Größengrenze.
- Auf einem Feld dürfen höchstens **2 Armeen** desselben Spielers stehen.
- **Teilen**: Eine Armee kann auf ihrem Feld in zwei Armeen geteilt werden. Das geht nur, wenn dort noch keine zweite Armee steht.
- **Zusammenführen**: Stehen zwei Armeen auf einem Feld, wird der Teilen-Button zum Zusammenführen-Button. Die vereinte Armee hat die **geringere** Restbewegung.
- Wird ein Feld mit zwei Armeen angegriffen, kämpfen beide als eine.

## Kampf
1. Jede angreifende Einheit würfelt **1 W6 + Angriffswert**.
2. Jede verteidigende Einheit würfelt **1 W6 + Verteidigungswert + Geländebonus**.
3. Beide Seiten sortieren ihre Ergebnisse absteigend und vergleichen paarweise (höchster gegen höchsten …).
   - Angriff > Verteidigung: der Verteidiger erhält 1 Treffer.
   - Angriff ≤ Verteidigung: der Angreifer erhält 1 Treffer.
   - **Überzählige Würfel verfallen** (wie bei Risiko).
4. Treffer ziehen HP ab: zuerst bei Stufe 1, dann Stufe 2, dann Stufe 3.
5. Ein Angriff ist genau **ein** Schlagabtausch.

**Geländebonus (Verteidigung):** Berg +2, Wald +1, Ebene und Wüste +0.

**HP:** Schaden bleibt nach dem Kampf bestehen. Einheiten neben einer eigenen Stadt heilen am Rundenbeginn 1 HP.

## Wirtschaft und Städte
- Bezahlt wird **nur mit Gold** aus den Feldern. Seelen, Mana und Erz entfallen.
- Einheitenkosten: Stufe 1 = **3**, Stufe 2 = **6**, Stufe 3 = **9** Gold. **Giants zahlen doppelt**.
- **Rekrutieren** geht nur in Städten. Die Einheit erscheint in der Stadt und muss **im selben Zug** heraus. In Städten dürfen keine Einheiten stehen bleiben.
- **Stadt bauen**: Eine Armee auf einem eigenen Feld gibt den Bauauftrag. Mindestens 2 Felder Abstand zur nächsten Stadt. Bauzeit 2 Züge. Kosten wie 3 Basiseinheiten (*Annahme*: der eigenen Fraktion, also 9 bzw. 18 Gold bei Giants).
- **Stadt ausbauen**: Kosten wie 2 Basiseinheiten, Bauzeit 1 Zug. Jede Ausbaustufe verlängert die Belagerungszeit um 1 Runde.
- **Belagerung**: Eine Stadt wird erobert, wenn feindliche Armeen insgesamt **3 Runden** (plus Ausbaustufen) neben ihr stehen.
  - Der Zähler läuft weiter, solange irgendeine feindliche Armee neben der Stadt steht.
  - Zieht die letzte belagernde Armee ab oder wird sie vernichtet, ist die Belagerung vorbei.
  - Eroberte Städte gehören dem Eroberer.

## Sieg
- Wer **alle gegnerischen Einheiten vernichtet**, gewinnt.
- Ein Spieler verliert, wenn er **3 Runden ohne Stadt** ist. Kann er in der verbleibenden Zeit rechnerisch keine Stadt mehr bauen oder erobern, verliert er sofort.

## Start
- Jede Fraktion beginnt mit 1 Stadt und einer Armee daneben: 3 Basiseinheiten und 1 Stufe-2-Einheit. Dazu etwas Startgold.
- Etwa jedes 4. Feld (zufällig verteilt) hat eine neutrale Armee aus **1–3 Wildlingen** (Angriff +0, Verteidigung +1, 1 HP), im Gebirge 1 mehr. Neutrale greifen nie an.

## Fraktionen

### Necros (Death Cults)
**Passiv:** Nach jedem Kampf würfeln sie für jede gestorbene Einheit (Freund oder Feind) 1 W6. Jede 6 erweckt ein Skelett in ihrer am Kampf beteiligten Armee. Es werden nie mehr Skelette erweckt, als Einheiten gestorben sind.

| Stufe | Einheit | Angriff | Verteidigung | HP | Besonderes |
|---|---|---|---|---|---|
| 1 | Skelett | +0 | +0 | 1 | |
| 2 | Lich (untoter Magier) | +3 | +0 | 1 | |
| 3 | Death Priest (untoter Bischof) | +1 | +1 | 2 | +3 Erweckungswürfe pro Priester in diesem Kampf. Sind weniger als 3 Einheiten gestorben, nur 1 Zusatzwurf pro gefallener Einheit. Eigener Würfellook. |

### Elfen (Evergarden)
**Passiv:** Auf eroberten Feldern wächst immer Wald. Im Wald +1 Verteidigung.

| Stufe | Einheit | Angriff | Verteidigung | HP | Besonderes |
|---|---|---|---|---|---|
| 1 | Bogenschütze | +1 | +1 | 1 | |
| 2 | Druide (Magier mit Holzstab) | +1 | +1 | 2 | Verzaubert pro Runde das Waldfeld, auf dem er steht. Kostet keine Bewegung. Verzauberter Wald gibt +1 Verteidigung; je 3 verzauberte Wälder +1 Gold pro Runde. Wird das Feld erobert, geht der Zauber verloren, der Wald bleibt. |
| 3 | Treant (Baumriese) | +2 | +4 | 2 | |

### Giants
**Passiv:** Stärkere Einheiten, aber doppelte Kosten.

| Stufe | Einheit | Angriff | Verteidigung | HP | Besonderes |
|---|---|---|---|---|---|
| 1 | Iron Gut (Riese mit großer Keule) | +2 | +1 | 2 | |
| 2 | Lead Belcher (Riese mit Schiffskanone) | +2 | +1 | 2 | Bei einer 6 darf er nochmal würfeln: ab 4+ verliert die schwächste gegnerische Einheit 1 HP, bevor der Kampf ausgewertet wird. Bei einer weiteren 6 darf er erneut würfeln (Kettenreaktion). |
| 3 | Mammut | +2 | +4 | 2 | Zu Rundenbeginn heilt jedes Mammut 1 HP bei der besten verletzten Einheit seiner Armee (keine Mammuts). |

## Offene Punkte (*Annahmen* bis zur Klärung)
- Lead Belcher: Zählt die erste 6 trotzdem normal im Kampf? *Annahme: ja.*
- Necro-Erweckung bei Kämpfen zwischen Fremden: Nur Kämpfe, an denen Necros beteiligt sind. *Annahme.*
- Elfen-Wald bei Eroberung von Bergen: Wird aus einem Berg auch Wald? *Annahme: nur Ebene und Wüste werden Wald.*
- Gold-Einkommen pro Feld: *Annahme: wie bisher 1 Gold pro Ebene, +2 pro Stadt.*
