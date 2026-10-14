public enum LandType {
    PLANE("♣_ .", Color.GREEN, Color.BG_GRAY),
    FOREST("♠♣⇞↟", Color.GREEN, Color.BG_GRAY),
    MOUNTAIN("△▲", Color.BLACK, Color.BG_GRAY),
    DESERT("~.", Color.YELLOW, Color.BG_GRAY);

    private final String symbolPool;
    private final Color defaultDisplayColor;
    private final Color defaultBackgroundColor;

    LandType(String symbolPool, Color defaultDisplayColor, Color defaultBackgroundColor) {
        this.symbolPool = symbolPool;
        this.defaultDisplayColor = defaultDisplayColor;
        this.defaultBackgroundColor = defaultBackgroundColor;
    }

    public String getSymbolPool() { return symbolPool; }
    public Color getDefaultDisplayColor() { return defaultDisplayColor; }
    public Color getDefaultBackgroundColor() { return defaultBackgroundColor; }
}