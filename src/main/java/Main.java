public class Main {
    public static void main(String[] args) {
        HexMap juraeaMap = new HexMap();
        juraeaMap.generateHexagonalMap(5);

        juraeaMap.display();

        Troop ravenBanner = new Troop("Raven Banner", Faction.NECROMANCERS, 0,0);
        ravenBanner.recruit(UnitType.INFANTRY);
        ravenBanner.recruit(UnitType.INFANTRY);
        ravenBanner.recruit(UnitType.INFANTRY);
        ravenBanner.recruit(UnitType.CAVALRY, 5);
        Unit lonelySkeleton = UnitCreator.create(Faction.NECROMANCERS, UnitType.INFANTRY);

        ravenBanner.addUnit(lonelySkeleton);

        Display.displayTroup(ravenBanner);
    }
}
