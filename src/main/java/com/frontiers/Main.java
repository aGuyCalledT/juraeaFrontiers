package com.frontiers;

public class Main {
    public static void main(String[] args) {
        HexMap map = new HexMap();
        GameInitializer init = new GameInitializer();
        map.generateMap(5);

        map.display();
        init.greeting();
        init.characterSelection();
    }
}
