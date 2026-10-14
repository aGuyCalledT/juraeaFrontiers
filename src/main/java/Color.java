public enum Color {
    // --- RESET ---
    RESET("\033[0m"),

    // --- TEXT STILE ---
    BOLD("\033[1m"),
    DIM("\033[2m"),          // Für Fog of War / inaktive Felder
    ITALIC("\033[3m"),
    UNDERLINE("\033[4m"),
    BLINK("\033[5m"),        // Für aktiven Cursor / Animation
    REVERSE("\033[7m"),      // Invertiert FG und BG (gut für Cursor)

    // --- STANDARD FOREGROUND ---
    GREEN("\033[32m"),
    PURPLE("\033[35m"),
    GRAY("\033[90m"),
    YELLOW("\033[33m"),
    RED("\033[31m"),
    CYAN("\033[36m"),
    WHITE("\033[37m"),
    BLACK("\033[30m"),

    // --- ERWEITERTE 256-FARBEN FOR JURÄA (FG) ---
    FOREST_GREEN("\033[38;5;28m"),
    SAND_YELLOW("\033[38;5;214m"),
    ROCK_GRAY("\033[38;5;244m"),
    NECRO_PURPLE("\033[38;5;93m"),

    // --- STANDARD BACKGROUND ---
    BG_DEFAULT("\033[49m"),
    BG_RED("\033[41m"),
    BG_GREEN("\033[42m"),
    BG_YELLOW("\033[43m"),
    BG_BLUE("\033[44m"),
    BG_PURPLE("\033[45m"),
    BG_CYAN("\033[46m"),
    BG_WHITE("\033[47m"),
    BG_GRAY("\033[100m"),

    // --- ERWEITERTE 256-FARBEN HINTERGRÜNDE (BG) ---
    BG_DARK_GREEN("\033[48;5;22m"),
    BG_SAND("\033[48;5;137m"),
    BG_DARK_GRAY("\033[48;5;236m"),
    BG_VOID_PURPLE("\033[48;5;53m");

    public final String code;

    Color(String code) {
        this.code = code;
    }

    // Dynamic 24-Bit RGB Helper (Text)
    public static String rgb(int r, int g, int b) {
        return String.format("\033[38;2;%d;%d;%dm", r, g, b);
    }

    // Dynamic 24-Bit RGB Helper (Hintergrund)
    public static String bgRgb(int r, int g, int b) {
        return String.format("\033[48;2;%d;%d;%dm", r, g, b);
    }
}
