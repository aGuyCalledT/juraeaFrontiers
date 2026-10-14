import java.util.HashMap;
import java.util.Map;

public class HexMap {
    private Map<String, HexTile> grid = new HashMap<>();
    private int radius;

    public void generateHexagonalMap(int radius) {
        this.radius = radius;

        // INIT AN EMPTY TILE
        for (int q = -radius; q <= radius; q++) {
            int r1 = Math.max(-radius, -q - radius);
            int r2 = Math.min(radius, -q + radius);
            for (int r = r1; r <= r2; r++) {
                HexTile tile = new HexTile(q, r, LandType.DESERT, Color.WHITE, Color.BG_YELLOW);
                grid.put(tile.getKey(), tile);
            }
        }

        // CONNECT ALL TILES
        for (HexTile tile : grid.values()) {
            for (HexDirection dir : HexDirection.values()) {
                int neighborQ = tile.q + dir.dq;
                int neighborR = tile.r + dir.dr;
                HexTile neighborTile = grid.get(neighborQ + "," + neighborR);

                if (neighborTile != null) {
                    tile.neighbors.put(dir, neighborTile);
                }
            }
        }

        // GENERATE RANDOM TERRAIN IN TILES
        MapGenerator generator = new MapGenerator();
        generator.generateBiomes(grid, grid.size());
    }


    public void display(){
        Display.displayMap(this);
    }
    // GETTER
    public HexTile getTile(int q, int r) {
        return grid.get(q + "," + r);
    }

    public int getRadius(){
        return this.radius;
    }
    public Map<String, HexTile> getGrid (){
        return this.grid;
    }
}
