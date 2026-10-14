import java.util.Arrays;

public enum Faction {
    NECROMANCERS(
            "NECRO",
            "Nekromanten",
            "[N]",
            Color.WHITE,
            Color.BG_VOID_PURPLE,
            Color.WHITE,
            "Seelen",
            1.20,
            "Untote Armee: Besiegte Gegner werden zu Untoten"
    ),
    ELVES(
            "ELF",
            "Elfen",
            "[E]",
            Color.YELLOW,
            Color.BG_DARK_GREEN,
            Color.YELLOW,
            "Mana",
            0.90,
            "Waldläufer: Keine Bewegungsabzüge in Wäldern"
    ),
    GIANTS(
            "GIANT",
            "Riesen",
            "[G]",
            Color.RED,
            Color.BG_YELLOW,
            Color.RED,
            "Erz",
            1.50,
            "Kolosse: Erhöhte Lebenspunkte und Bonusschaden im Gebirge"
    ),
    NONE(
            "NONE",
            "Neutral",
            "  ",
            Color.GRAY,
            Color.BG_WHITE,
            Color.BLACK,
            "Gold",
            1.00,
            "Keine Fraktionsboni"
    );

    private final String code;
    private final String displayName;
    private final String unitSymbol;
    private final Color primaryColor;
    private final Color backgroundColor;
    private final Color unitColor;

    // Beispielhafte Variablen für spätere Gameplay-Mechaniken:
    private final String primaryResource;
    private final double healthMultiplier;
    private final String passiveAbility;

    Faction(String code, String displayName, String unitSymbol,
            Color primaryColor, Color backgroundColor, Color unitColor,
            String primaryResource, double healthMultiplier, String passiveAbility) {
        this.code = code;
        this.displayName = displayName;
        this.unitSymbol = unitSymbol;
        this.primaryColor = primaryColor;
        this.backgroundColor = backgroundColor;
        this.unitColor = unitColor;
        this.primaryResource = primaryResource;
        this.healthMultiplier = healthMultiplier;
        this.passiveAbility = passiveAbility;
    }

    // --- GETTER ---
    public String getCode() { return code; }
    public String getDisplayName() { return displayName; }
    public String getUnitSymbol() { return unitSymbol; }
    public Color getPrimaryColor() { return primaryColor; }
    public Color getBackgroundColor() { return backgroundColor; }
    public Color getUnitColor() { return unitColor; }
    public String getPrimaryResource() { return primaryResource; }
    public double getHealthMultiplier() { return healthMultiplier; }
    public String getPassiveAbility() { return passiveAbility; }

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
