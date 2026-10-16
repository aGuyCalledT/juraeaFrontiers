package com.frontiers;

public enum HexDirection {
    NORTH_WEST(-1, 0),
    NORTH_EAST(0, -1),
    EAST(1, -1),
    SOUTH_EAST(1, 0),
    SOUTH_WEST(0, 1),
    WEST(-1, 1);

    public final int dq;
    public final int dr;

    HexDirection(int dq, int dr) {
        this.dq = dq;
        this.dr = dr;
    }
}
