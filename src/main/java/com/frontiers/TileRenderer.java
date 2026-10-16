package com.frontiers;

import java.util.Objects;
import java.util.Random;

public class TileRenderer {
    public static final int TILE_WIDTH = 6;
    public static final int TILE_HEIGHT = 2;
    private static final String DEFAULT_BG = "\u001B[49m";

    public static String renderTile(HexTile tile, int lineIndex) {
        if (tile.getLandType() == LandType.OCEAN) {
            String lineText = "";
            for (int i = 0; i < TILE_WIDTH; i ++) {
                lineText += LandType.OCEAN.getSymbolPool().charAt(0);
            }
            return LandType.OCEAN.getDefaultDisplayColor().code + lineText + Color.RESET.code;
        }

        String lineText = getBaseTerrainPattern(tile, lineIndex);

        if (lineIndex == 0 && tile.occupiedBy != null && tile.occupiedBy != Faction.NONE) {
            String unitSymbol = tile.occupiedBy.getUnitSymbol();
            lineText = overlayText(lineText, unitSymbol);
        }

        boolean isTop = (lineIndex == 0);
        boolean isBottom = (lineIndex == TILE_HEIGHT - 1);

        if (isTop || isBottom) {
            char leftCorner  = isTop ? '\uE0BA' : '\uE0BE';
            char rightCorner = isTop ? '\uE0B8' : '\uE0BC';

            if (tile.backgroundColor == Color.BG_DEFAULT) {
                leftCorner = ' ';
                rightCorner= ' ';

            }
            String bgAsFg = getForegroundFromBackground(tile.backgroundColor.code);
            String middleText = lineText.substring(1, TILE_WIDTH - 1);

            return DEFAULT_BG + bgAsFg + leftCorner
                    + tile.backgroundColor.code + tile.displayColor.code + middleText
                    + DEFAULT_BG + bgAsFg + rightCorner
                    + Color.RESET.code;
        }

        return tile.backgroundColor.code + tile.displayColor.code + lineText + Color.RESET.code;
    }

    private static String getForegroundFromBackground(String bgCode) {
        if (bgCode == null) return "";
        if (bgCode.contains("[4")) return bgCode.replace("[4", "[3");
        if (bgCode.contains("[10")) return bgCode.replace("[10", "[9");
        return bgCode;
    }

    private static String getBaseTerrainPattern(HexTile tile, int lineIndex) {
        String pool = tile.getLandType().getSymbolPool();
        if (pool == null || pool.isEmpty()) {
            pool = " ";
        }

        Random rand = new Random(Objects.hash(tile.q, tile.r, lineIndex));

        StringBuilder patternBuilder = new StringBuilder();
        for (int i = 0; i < TILE_WIDTH; i++) {
            int randomCharIndex = rand.nextInt(pool.length());
            patternBuilder.append(pool.charAt(randomCharIndex));
        }

        return patternBuilder.toString();
    }

    private static String overlayText(String background, String textToOverlay) {
        if (textToOverlay.length() > TILE_WIDTH) {
            textToOverlay = textToOverlay.substring(0, TILE_WIDTH);
        }

        int padNeeded = TILE_WIDTH - textToOverlay.length();
        int leftPad = padNeeded / 2;

        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append(background.substring(0, leftPad));
        stringBuilder.append(textToOverlay);
        stringBuilder.append(background.substring(leftPad + textToOverlay.length(), TILE_WIDTH));

        return stringBuilder.toString();
    }
}
