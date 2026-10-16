package com.frontiers;
import java.util.Arrays;

public enum Faction {
    NECROMANCERS(
            "NECRO",
            "Necromancers",
            "N",
            Color.BLACK,
            Color.BG_PURPLE,
            Color.BLACK
    ),
    ELVES(
            "ELF",
            "Elves",
            "E",
            Color.BLACK,
            Color.BG_GREEN,
            Color.BLACK
    ),
    GIANTS(
            "GIANT",
            "Giants",
            "G",
            Color.BLACK,
            Color.BG_YELLOW,
            Color.BLACK
    ),
    NONE(
            "NONE",
            "Neutral",
            "  ",
            Color.BLACK,
            Color.BG_WHITE,
            Color.BLACK
    );

    private final String code;
    private final String displayName;
    private final String unitSymbol;
    private final Color primaryColor;
    private final Color backgroundColor;
    private final Color unitColor;

    Faction(String code, String displayName, String unitSymbol,
            Color primaryColor, Color backgroundColor, Color unitColor) {
        this.code = code;
        this.displayName = displayName;
        this.unitSymbol = unitSymbol;
        this.primaryColor = primaryColor;
        this.backgroundColor = backgroundColor;
        this.unitColor = unitColor;
    }

    // --- GETTER ---
    public String getCode() { return code; }
    public String getDisplayName() { return displayName; }
    public String getUnitSymbol() { return unitSymbol; }
    public Color getPrimaryColor() { return primaryColor; }
    public Color getBackgroundColor() { return backgroundColor; }
    public Color getUnitColor() { return unitColor; }

    /**
     * Reicht als eleganter Ersatz für den switch-Block:
     * Wandelt einen String-Code (z.B. "NECRO") direkt in das Faction-Objekt um.
     */
    public static Faction fromCode(String code) {
        if (code == null) return NONE;
        return Arrays.stream(values())
                .filter(f -> f.code.equalsIgnoreCase(code) || f.name().equalsIgnoreCase(code))
                .findFirst()
                .orElse(NONE);
    }
}
