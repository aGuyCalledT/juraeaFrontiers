package com.frontiers;

import java.util.EnumMap;
import java.util.Map;

/**
 * @author t.wiesehahn
 * Represents a single hexagonal tile within a 2D hexagonal grid.
 * <p>
 * It utilizes the coordinate system (q, r) to track its position.
 * It serves as a node in a larger graph, maintaining an {@link EnumMap} of its immediate
 * neighboring tiles.
 */
public class HexTile {
    public final int q;
    public final int r;
    public Faction occupiedBy;
    private LandType landType;
    public String domain;
    public Color displayColor;
    public Color backgroundColor;
    public Map<HexDirection, HexTile> neighbors = new EnumMap<>(HexDirection.class);

    /**
     * Constructs a new com.frontiers.HexTile
     * @param q               The axial column coordinate.
     * @param r               The axial row coordinate.
     * @param landType        The geographical terrain of the tile.
     * @param domain          The name of the region or territory.
     * @param displayColor    The primary foreground rendering color.
     * @param backgroundColor The secondary background rendering color.
     */
    public HexTile(int q, int r, LandType landType, String domain, Color displayColor, Color backgroundColor) {
        this.q = q;
        this.r = r;
        this.landType = landType;
        this.domain = domain;
        this.displayColor = displayColor;
        this.backgroundColor = backgroundColor;
        this.occupiedBy = Faction.NONE;
    }

    /**
     * @return The {@link HexCoordinate} of this tile.
     */
    public HexCoordinate getCoordinates() {
        return new HexCoordinate(this.q, this.r);
    }

    public LandType getLandType() {
        return landType;
    }

    public void setLandType(LandType landType) {
        this.landType = landType;
    }

    /**
     * Retrieves a specific horizontal line of the tile's visual ASCII/ANSI representation.
     * @param lineIndex The vertical row index of the tile graphic to retrieve.
     * @return A formatted string representing the specified line of the drawn tile.
     */
    public String getRenderedTile(int lineIndex) {
        return TileRenderer.renderTile(this, lineIndex);
    }

    /**
     * Transfers control of the tile to a new faction and automatically updates
     * @param faction The new {@link Faction} taking ownership of this tile.
     */
    public void changeOwner(Faction faction) {
        this.occupiedBy = faction;
        this.displayColor = faction.getPrimaryColor();
        this.backgroundColor = faction.getBackgroundColor();
    }

    /**
     * Determines whether this tile is located on the very edge of the generated map.
     * @return {@code true} if the tile is on the outer edge, else it returns {@code false}.
     */
    public boolean isOuterTile() {
        return 6 != neighbors.size();
    }

    /**
     * @return a concise text of the tiles information.
     */
    @Override
    public String toString() {
        return String.format("[%d,%d - %s]", q, r, getLandType().name());
    }
}
