package com.frontiers;

public class Player {
    private String playerName;
    private Faction playerFaction = Faction.NONE;
    private int turnPosition;

    public void setPlayerName (String name) {
        playerName = name;
    }

    public void setPlayerFaction(Faction playerFaction) {
        this.playerFaction = playerFaction;
    }

    public Faction getPlayerFaction() {
        return playerFaction;
    }

    public int getTurnPosition() {
        return turnPosition;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setTurnPosition(int turnPosition) {
        this.turnPosition = turnPosition;
    }

    @Override
    public String toString() {
        String color = playerFaction.getBackgroundColor().code + playerFaction.getPrimaryColor().code;
        String reset = Color.RESET.code;

        return color + getPlayerName() + reset;
    }
}
