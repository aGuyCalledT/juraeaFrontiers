public class UnitCreator {

    public static Unit create(Faction faction, UnitType type) {
        String name = faction.getDisplayName() + " " + type.name();

        int hitPoints = 0, armorClass = 0, attackRoll = 0, attackDamage = 0, movement = 0, moral = 0, mana = 0;

        switch (type) {
            case INFANTRY:
                hitPoints = 1;
                armorClass = 10;
                attackRoll = 2;
                attackDamage = 1;
                movement = 1;
                moral = 1;
                switch (faction) {
                    case Faction.GIANTS:
                        name = "iron gut";
                        hitPoints = 2;
                        armorClass = 12;
                        attackDamage = 2;
                        break;
                    case Faction.ELVES:
                        name = "warrior";
                        moral = 2;
                        break;
                    case Faction.NECROMANCERS:
                        name = "skeleton";
                        armorClass = 8;
                        break;
                }
                break;
            case CAVALRY:
                switch (faction) {
                    case Faction.GIANTS:
                        name = "horn rider";
                        armorClass = 15;
                        attackDamage = 4;
                        movement = 2;
                        break;
                    case Faction.ELVES:
                        name = "eagle rider";
                        moral = 4;
                        break;
                    case Faction.NECROMANCERS:
                        name = "death knight";
                        break;
                }
                break;
            case SPECIAL:
                switch (faction) {
                    case Faction.GIANTS:
                        name = "shaman";
                        break;
                    case Faction.ELVES:
                        name = "wizzard";
                        break;
                    case Faction.NECROMANCERS:
                        name = "death priest";
                        break;
                }
                break;
        }

        return new Unit(name, type, faction, hitPoints, armorClass, attackRoll, attackDamage, movement, moral, mana);
    }
}