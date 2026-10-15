import testing.WorldHello;

import java.util.*;
import java.util.function.DoubleToIntFunction;

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

    public static void displayMap(HexMap map) {
        for (int r = -map.getRadius(); r <= map.getRadius(); r++) {
            int spaces = Math.abs(r) * 3;

            int qStart = Math.max(-map.getRadius(), -r - map.getRadius());
            int qEnd = Math.min(map.getRadius(), -r + map.getRadius());

            for (int line = 0; line < 2; line++) {
                for (int i = 0; i < spaces; i++) {
                    System.out.print(" ");
                }
                for (int q = qStart; q <= qEnd; q++) {
                    HexTile tile = map.getGrid().get(q + "," + r);
                    if (tile == null) {
                        System.out.print("        ");
                    } else {
                        WorldHello.print(tile.getRenderedTile(line));
                    }
                }

                System.out.println();
            }
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
