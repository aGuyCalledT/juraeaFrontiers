package com.frontiers;

public enum Color {
    // --- RESET ---
    RESET("\033[0m"),

    // --- TEXT STILE ---
    BOLD("\033[1m"),
    ITALIC("\033[3m"),
    UNDERLINE("\033[4m"),
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
    INVISIBLE("\033[30m"),

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
    BG_BLACK("\033[40m");

    public final String code;

    Color(String code) {
        this.code = code;
    }

    public static String rgb(int r, int g, int b) {
        return String.format("\033[38;2;%d;%d;%dm", r, g, b);
    }

    public static String bgRgb(int r, int g, int b) {
        return String.format("\033[48;2;%d;%d;%dm", r, g, b);
    }
}
