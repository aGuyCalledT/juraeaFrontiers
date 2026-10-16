package com.frontiers;

import java.util.*;

public class Display {
    public static final String RESET = "\u001B[0m";
    public static final String GREEN = "\u001B[32m";
    public static final int BOX_WIDTH = 51;

    public enum BoxStyle {
        NORMAL('─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴'),
        ROUND ('─', '│', '╭', '╮', '╰', '╯', '├', '┤', '┬', '┴'),
        DOUBLE('═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩');

        public final char h, v, tl, tr, bl, br, lt, rt, tt, bt;

        BoxStyle(char h, char v, char tl, char tr, char bl, char br, char lt, char rt, char tt, char bt) {
            this.h = h; this.v = v;
            this.tl = tl; this.tr = tr;
            this.bl = bl; this.br = br;
            this.lt = lt; this.rt = rt;
            this.tt = tt; this.bt = bt;
        }

        public static BoxStyle fromString(String style) {
            if (style == null) return NORMAL;
            switch (style.toLowerCase()) {
                case "round":
                case "rounded": return ROUND;
                case "double": return DOUBLE;
                default: return NORMAL;
            }
        }
    }

    public static void textBox(String text) {
        textBox(text, "normal", "");
    }

    public static void textBox(String text, String title) {
        textBox(text, "normal", title);
    }

    public static void textBox(String text, String styleName, String title) {
        List<String> wrappedLines = new ArrayList<>();
        String[] paragraphs = text.split("\r?\n", -1);
        String activeColor = "";
        java.util.regex.Pattern colorPattern = java.util.regex.Pattern.compile("\u001B\\[[;\\d]*m");

        for (String paragraph : paragraphs) {
            if (paragraph.isEmpty()) {
                wrappedLines.add("");
                continue;
            }

            String[] words = paragraph.split("\\s+");
            StringBuilder currentLine = new StringBuilder();
            int currentLength = 0;

            for (String word : words) {
                if (word.isEmpty()) continue;

                int wordLength = getVisibleLength(word);

                if (currentLength == 0 || currentLength + 1 + wordLength <= BOX_WIDTH) {
                    if (currentLength > 0) {
                        currentLine.append(" ");
                        currentLength += 1;
                    }
                    currentLine.append(word);
                    currentLength += wordLength;
                } else {
                    wrappedLines.add(currentLine.toString() + RESET);
                    currentLine = new StringBuilder();
                    if (!activeColor.isEmpty() && !activeColor.equals(RESET)) {
                        currentLine.append(activeColor);
                    }
                    currentLine.append(word);
                    currentLength = wordLength;
                }

                java.util.regex.Matcher m = colorPattern.matcher(word);
                while (m.find()) {
                    activeColor = m.group();
                }
            }

            if (currentLine.length() > 0) {
                wrappedLines.add(currentLine.toString() + RESET);
            }
        }

        drawBox(title, "", BOX_WIDTH, null, styleName, wrappedLines.toArray(new String[0]));
    }

    public static void drawBox(String titleLeft, String titleRight, int innerWidth, String customBottom, String styleName, String... lines) {
        BoxStyle style = BoxStyle.fromString(styleName);

        int leftLen = getVisibleLength(titleLeft);
        int rightLen = getVisibleLength(titleRight);
        int dashCount = Math.max(0, innerWidth - leftLen - rightLen);
        String hLine = String.valueOf(style.h);

        StringBuilder top = new StringBuilder()
                .append(style.tl)
                .append(style.h)
                .append(titleLeft)
                .append(hLine.repeat(dashCount));

        if (titleRight != null && !titleRight.isEmpty()) {
            top.append(titleRight);
        }

        top.append(style.h).append(style.tr);
        System.out.println(top.toString());

        for (String line : lines) {
            if (line.equals("DIVIDER")) {
                System.out.println(style.lt + hLine.repeat(innerWidth + 2) + style.rt);
            } else if (line.startsWith("RAW:")) {
                System.out.println(line.substring(4));
            } else {
                int pad = Math.max(0, innerWidth - getVisibleLength(line));
                System.out.println(style.v + " " + line + " ".repeat(pad) + " " + style.v);
            }
        }

        if (customBottom != null && !customBottom.isEmpty()) {
            System.out.println(customBottom);
        } else {
            System.out.println(style.bl + hLine.repeat(innerWidth + 2) + style.br);
        }
    }

    private static int getVisibleLength(String str) {
        if (str == null) return 0;
        return str.replaceAll("\u001B\\[[;\\d]*m", "").length();
    }

    public static void displayMap(HexMap map, String strTL, String strTR, String strBL, String strBR) {
        int radius = map.getRadius();
        int tileWidth = 6;
        int maxContentWidth = (2 * radius + 1) * tileWidth;
        int totalLines = (2 * radius + 1) * 2;

        // Gesamtes Rastermaß inklusive linkem/rechtem Rand (+2) und oben/unten (+2)
        int gridW = maxContentWidth + 2;
        int gridH = totalLines + 2;

        // 1. UI-BOXEN GENERIEREN
        UIBox tl = new UIBox(strTL, "TL", gridW, gridH);
        UIBox tr = new UIBox(strTR, "TR", gridW, gridH);
        UIBox bl = new UIBox(strBL, "BL", gridW, gridH);
        UIBox br = new UIBox(strBR, "BR", gridW, gridH);

        int currentMapY = 0;

        // 2. ZEILE FÜR ZEILE RENDERN (inklusive Rahmen)
        for (int y = 0; y < gridH; y++) {
            if (y == 0 || y == gridH - 1) {
                // Oberster und unterster Karten-Rand
                for (int x = 0; x < gridW; x++) {
                    System.out.print(getGridChar(x, y, gridW, gridH, tl, tr, bl, br));
                }
                System.out.println();
            } else {
                // Karten-Inhalt
                int r = -radius + (currentMapY / 2);
                int line = currentMapY % 2;

                int leadingSpaces = Math.abs(r) * 3;
                int qStart = Math.max(-radius, -r - radius);
                int qEnd = Math.min(radius, -r + radius);

                // A) Linker Rand
                System.out.print(getGridChar(0, y, gridW, gridH, tl, tr, bl, br));
                int currentX = 1;

                // B) Einrückung links (wird UI-Ecke oder Ozean)
                for (int i = 0; i < leadingSpaces; i++) {
                    System.out.print(getGridChar(currentX, y, gridW, gridH, tl, tr, bl, br));
                    currentX++;
                }

                // C) HexTiles rendern
                for (int q = qStart; q <= qEnd; q++) {
                    // *** HIER IST DIE WICHTIGSTE ÄNDERUNG ***
                    HexTile tile = map.getTile(q, r);
                    if (tile == null) {
                        for (int i = 0; i < tileWidth; i++) {
                            System.out.print(getGridChar(currentX, y, gridW, gridH, tl, tr, bl, br));
                            currentX++;
                        }
                    } else {
                        System.out.print(tile.getRenderedTile(line));
                        currentX += tileWidth;
                    }
                }

                // D) Auffüllung rechts (wird UI-Ecke oder Ozean)
                int rightPadding = (gridW - 1) - currentX;
                for (int i = 0; i < rightPadding; i++) {
                    System.out.print(getGridChar(currentX, y, gridW, gridH, tl, tr, bl, br));
                    currentX++;
                }

                // E) Rechter Rand
                System.out.print(getGridChar(gridW - 1, y, gridW, gridH, tl, tr, bl, br));
                System.out.println();

                currentMapY++;
            }
        }
    }

    // ZENTRALE PIXEL-LOGIK: Gibt das richtige Zeichen (als String, falls du ANSI brauchst) zurück
    private static String getGridChar(int x, int y, int gridW, int gridH, UIBox tl, UIBox tr, UIBox bl, UIBox br) {
        if (tl.contains(x, y)) return String.valueOf(tl.getChar(x, y));
        if (tr.contains(x, y)) return String.valueOf(tr.getChar(x, y));
        if (bl.contains(x, y)) return String.valueOf(bl.getChar(x, y));
        if (br.contains(x, y)) return String.valueOf(br.getChar(x, y));

        // Wenn keine Box da ist, zeichnen wir den normalen Map-Rahmen
        if (y == 0 && x == 0) return "╭";
        if (y == 0 && x == gridW - 1) return "╮";
        if (y == gridH - 1 && x == 0) return "╰";
        if (y == gridH - 1 && x == gridW - 1) return "╯";
        if (y == 0 || y == gridH - 1) return "─";
        if (x == 0 || x == gridW - 1) return "│";

        // *** HIER IST DIE FARB-ANPASSUNG ***
        return "\u001b[38;2;138;173;244m~\u001b[0m"; // Catppuccin Macchiato Blau
    }

    // HILFSKLASSE: Berechnet ihre eigenen Rahmen- und T-Stücke perfekt passend zum Rest!
    private static class UIBox {
        int startX, startY, width, height;
        char[][] content;

        public UIBox(String text, String position, int gridW, int gridH) {
            if (text == null || text.trim().isEmpty()) {
                this.width = 0; this.height = 0; return;
            }

            String[] lines = text.replace("\r", "").split("\n");
            int actualLines = Math.min(lines.length, 4); // Max 4 Zeilen
            int maxLineLen = 0;

            for (int i = 0; i < actualLines; i++) {
                if (lines[i].length() > 10) lines[i] = lines[i].substring(0, 10); // Max 10 Zeichen
                maxLineLen = Math.max(maxLineLen, lines[i].length());
            }

            this.width = maxLineLen + 2; // +2 für linken/rechten Box-Rand
            this.height = actualLines + 2; // +2 für oberen/unteren Box-Rand
            this.content = new char[height][width];

            // Startposition berechnen
            if (position.equals("TL")) { startX = 0; startY = 0; }
            else if (position.equals("TR")) { startX = gridW - width; startY = 0; }
            else if (position.equals("BL")) { startX = 0; startY = gridH - height; }
            else if (position.equals("BR")) { startX = gridW - width; startY = gridH - height; }

            // Nahtlose Ecken und T-Kreuzungen berechnen!
            char cTL = '╭', cTR = '╮', cBL = '╰', cBR = '╯';
            if (position.equals("TL")) { cTR = '┬'; cBL = '├'; cBR = '╯'; } // Innere Ecke ist ╯
            if (position.equals("TR")) { cTL = '┬'; cBR = '┤'; cBL = '╰'; } // Innere Ecke ist ╰
            if (position.equals("BL")) { cTL = '├'; cTR = '╮'; cBR = '┴'; } // Innere Ecke ist ╮
            if (position.equals("BR")) { cTL = '╭'; cTR = '┤'; cBL = '┴'; } // Innere Ecke ist ╭

            // Box zeichnen
            for (int r = 0; r < height; r++) {
                for (int c = 0; c < width; c++) {
                    if (r == 0 && c == 0) content[r][c] = cTL;
                    else if (r == 0 && c == width - 1) content[r][c] = cTR;
                    else if (r == height - 1 && c == 0) content[r][c] = cBL;
                    else if (r == height - 1 && c == width - 1) content[r][c] = cBR;
                    else if (r == 0 || r == height - 1) content[r][c] = '─';
                    else if (c == 0 || c == width - 1) content[r][c] = '│';
                    else {
                        String line = lines[r - 1];
                        int charIdx = c - 1;
                        if (charIdx < line.length()) {
                            content[r][c] = line.charAt(charIdx);
                        } else {
                            content[r][c] = ' ';
                        }
                    }
                }
            }
        }

        public boolean contains(int x, int y) {
            return width > 0 && x >= startX && x < startX + width && y >= startY && y < startY + height;
        }

        public char getChar(int x, int y) {
            return content[y - startY][x - startX];
        }
    }

    public static void displayTroup(Troop troop) {
        int unitNumber = troop.getUnitNumber();
        int totalMaxHp = 0;
        int totalCurrentHp = 0;

        Map<String, Integer> groupedUnits = new LinkedHashMap<>();

        for (Unit unit : troop.getUnits()) {
            String unitString = String.format("%-21s %d|%d",
                    capitalize(unit.getName()), unit.getCurrentHp(), unit.getMaxHp());
            totalMaxHp += unit.getMaxHp();
            totalCurrentHp += unit.getCurrentHp();

            groupedUnits.put(unitString, groupedUnits.getOrDefault(unitString, 0) + 1);
        }

        String rightTitle = String.format("%3d|%-3d", totalCurrentHp, totalMaxHp);

        String[] lines = new String[groupedUnits.size()];
        int i = 0;

        for (Map.Entry<String, Integer> entry : groupedUnits.entrySet()) {
            int count = entry.getValue();
            String unitString = entry.getKey();

            String prefix = (count > 1) ? String.format("%dx ", count) : "   ";

            lines[i] = String.format("%s%s", prefix, unitString);
            i++;
        }

        drawBox(troop.getTroopName(), rightTitle, 30, "", "normal", lines);
    }

    public static String capitalize(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;

        for (char c : text.toCharArray()) {
            if (Character.isWhitespace(c)) {
                capitalizeNext = true;
                result.append(c);
            } else if (capitalizeNext) {
                result.append(Character.toUpperCase(c));
                capitalizeNext = false;
            } else {
                result.append(c);
            }
        }

        return result.toString();
    }
}
