public class Main {
    public static void main(String[] args) {
        HexMap map = new HexMap();
        map.generateHexagonalMap(5);

        map.getTile(1,1).changeOwner(Faction.NECROMANCERS);

        map.display();
    }
}


