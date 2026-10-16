package com.frontiers;

import java.util.Arrays;
import java.util.Collections;
import java.util.Random;

public class GameInitializer {
    Random random = new Random();
    Faction[] factionList = new Faction[] { Faction.NECROMANCERS, Faction.ELVES, Faction.GIANTS };

    public void greeting() {
        Display.textBox("Greetings! Welcome to Juräa Frontiers");
    }

    public void characterSelection() {
        Display.textBox("How many players are playing?");
        int numberOfPlayers = Input.getInt(2, 3);
        Player[] players = new Player[numberOfPlayers];

        for (int i = 0; i <= numberOfPlayers - 1; i++) {
            players[i] = new Player();
            System.out.printf("What is the name of Player %d?%n", i + 1);
            String setPlayerName = Input.getString();
            players[i].setPlayerName(setPlayerName);
        }

        Collections.shuffle(Arrays.asList(players));

        for (Player player : players) {
            String[] factionNameList = new String[factionList.length];
            for (int i = 0; i < factionList.length; i++) {
                factionNameList[i] = factionList[i].getDisplayName();
            }

            System.out.printf("%s, what faction do you want to play?%n", player.getPlayerName());
            System.out.printf("You can choose the following: %s.%n", String.join(", ", factionNameList));

            String pickedFactionName = Input.getString(factionNameList);

            for (Faction faction : factionList) {
                if (faction.getDisplayName().equalsIgnoreCase(pickedFactionName)) {
                    player.setPlayerFaction(faction);
                    break;
                }
            }

            factionList = Arrays.stream(factionList)
                    .filter(faction -> !faction.getDisplayName().equalsIgnoreCase(pickedFactionName))
                    .toArray(Faction[]::new);
        }

        System.out.println("\n--- Final Player Setup ---");
        for (Player player : players) {
            String colorCode = player.getPlayerFaction().getBackgroundColor().code;
            String resetCode = "\u001B[0m";

            System.out.printf("%s%s spielt die Fraktion: %s%s%n",
                    colorCode, player.getPlayerName(), player.getPlayerFaction().getDisplayName(), resetCode);
        }
    }
}
