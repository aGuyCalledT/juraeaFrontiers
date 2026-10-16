import java.util.HashMap;
import java.util.Map;

public class HexMap {
    public Map<String, HexTile> tileGrid = new HashMap<>();
    private int radius;

    public void generateMap(int radius) {
        this.radius = radius;

        // INIT AN EMPTY TILE
        for (int q = -radius; q <= radius; q++) {
            int r1 = Math.max(-radius, -q - radius);
            int r2 = Math.min(radius, -q + radius);
            for (int r = r1; r <= r2; r++) {
                HexTile tile = new HexTile(q, r, null, null, Color.WHITE, Color.BG_YELLOW);
                tileGrid.put(tile.getKey(), tile);
            }
        }

        // CONNECT ALL TILES
        for (HexTile tile : tileGrid.values()) {
            for (HexDirection dir : HexDirection.values()) {
                int neighborQ = tile.q + dir.dq;
                int neighborR = tile.r + dir.dr;
                HexTile neighborTile = tileGrid.get(neighborQ + "," + neighborR);

                if (neighborTile != null) {
                    tile.neighbors.put(dir, neighborTile);
                }
            }
        }

        // GENERATE RANDOM TERRAIN IN TILES
        MapGenerator generator = new MapGenerator();
        generator.generateMap(tileGrid);
    }

    public int getTileNumb() {
        int n = this.radius;
        // GAUSSIAN SUM
        return 1+ (n * (n + 1) / 2) * 6;
    }

    public void display(String strTL, String strTR, String strBL, String strBR){
        Display.displayMap(this, strTL, strTR, strBL, strBR);
    }

    public void display(){
        Display.displayMap(this, "", "", "", "");
    }
    // GETTER
    public HexTile getTile(int q, int r) {
        return tileGrid.get(q + "," + r);
    }

    public int getRadius(){
        return this.radius;
    }
    public Map<String, HexTile> getTileGrid(){
        return this.tileGrid;
    }
}
