package com.frontiers;

import java.util.Arrays;
import java.util.Collections;
import java.util.Random;

public class GameInitializer {
    Random random = new Random();
    Faction[] factionList = new Faction[]{Faction.NECROMANCERS, Faction.ELVES, Faction.GIANTS};

    public void greeting() {
        Display.textBox("Greetings! Welcome to Juräa Frontiers");

    }
    public void characterSelection() {
        Display.textBox("How many players are playing?");
        int numberOfPlayers = Input.getInt(2,3);
        Player[] players = new Player[numberOfPlayers];

        for (int i = 0; i <= numberOfPlayers - 1; i++) {
            players[i] = new Player();
            System.out.printf("What is the name of Player %d?%n", i + 1);
            String setPlayerName = Input.getString();
            System.out.println("input is in");
            Player tempPlayer = players[i];
            System.out.println("player is availiable");
            tempPlayer.setPlayerName(setPlayerName);
            System.out.println("name is set");
        }

        Collections.shuffle(Arrays.asList(players));

        for (Player player : players) {
            if (factionList.length != 1) {
                String[] factionNameList = new String[factionList.length];
                int i = 0;
                for (Faction faction : factionList) {
                    factionNameList[i] = faction.getDisplayName();
                    i++;
                }

                System.out.printf("%s what faction do you want to Play?%n", player);
                System.out.printf("You can choose the following: %s.%n", String.join(", ", factionNameList));
                String pickedFaction = Input.getString(factionNameList);
            }
        }

    }

}
