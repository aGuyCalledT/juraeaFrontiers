public class Main {
    public static void main(String[] args) {
        HexMap map = new HexMap();
        map.generateMap(5);
        Unit npc = UnitCreator.create(Faction.GIANTS, UnitType.INFANTRY);

        Troop troop = new Troop("Giant Boys", Faction.GIANTS, 0, 0);
        troop.addUnit(npc);

        String[] players = {
                "Necros",
                "Giants",
                "Elves"
        };

        for (int i = 0; i < players.length; i++ ) {
            map.display("top L", "top R", players[i], "Bottom R");
            String message = Input.getString();
            Display.textBox(message);
        }
    }
}