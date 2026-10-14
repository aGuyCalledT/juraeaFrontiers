import java.util.EnumMap;
import java.util.Map;

public class HexTile {
    public final int q;
    public final int r;
    public Faction occupiedBy;

    public LandType landType;
    public Color displayColor;
    public Color backgroundColor;

    public Map<HexDirection, HexTile> neighbors = new EnumMap<>(HexDirection.class);

    public HexTile(int q, int r, LandType landType, Color displayColor, Color backgroundColor) {
        this.q = q;
        this.r = r;
        this.landType = landType;
        this.displayColor = displayColor;
        this.backgroundColor = backgroundColor;
        this.occupiedBy = Faction.NONE;
    }

    public String getKey() {
        return q + "," + r;
    }

    public String getRenderedTile(int lineIndex) {
        return TileRenderer.renderTile(this, lineIndex);
    }

    public void changeOwner(Faction faction) {
        this.occupiedBy = faction;
        this.displayColor = faction.getPrimaryColor();
        this.backgroundColor = faction.getBackgroundColor();
    }

    @Override
    public String toString() {
        return String.format("[%d,%d - %s]", q, r, landType.name());
    }
}
