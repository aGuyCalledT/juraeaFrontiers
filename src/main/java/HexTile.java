import java.util.EnumMap;
import java.util.Map;


public class HexTile {
    public final int q;
    public final int r;
    public String terrain; 
    public String occupiedBy;
    
    public Map<HexDirection, HexTile> neighbors = new EnumMap<>(HexDirection.class);

    public HexTile(int q, int r, String terrain) {
        this.q = q;
        this.r = r;
        this.terrain = terrain;
        this.occupiedBy = "None";
    }

    public String getKey() {
        return q + "," + r;
    }

    @Override
    public String toString() {
        return String.format("[%d,%d - %s]", q, r, terrain);
    }
}