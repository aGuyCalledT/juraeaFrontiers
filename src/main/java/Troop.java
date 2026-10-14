import java.util.ArrayList;
import java.util.List;

public class Troop {
    private String troopName;
    private Faction faction;
    private List<Unit> units;
    
    private int q;
    private int r;

    public Troop(String troopName, Faction faction, int startQ, int startR) {
        this.troopName = troopName;
        this.faction = faction;
        this.units = new ArrayList<>();
        this.q = startQ;
        this.r = startR;
    }

    public void addUnit(Unit unit) {
        if (unit.getFaction() != this.faction) {
            throw new IllegalArgumentException("Fraktion der Einheit passt nicht zur Truppe!");
        }
        units.add(unit);
    }

    public void clearDeadUnits() {
        units.removeIf(Unit::isDead);
    }

    public int getUnitNumber() {
        return units.size();
    }

    public boolean isDefeated() {
        return units.isEmpty();
    }

    public int getMovement() {
        return units.stream()
                .mapToInt(Unit::getMovement)
                .min()
                .orElse(0);
    }

    public int getMoral() {
        return (int) units.stream()
                .mapToInt(Unit::getMoral)
                .average()
                .orElse(0.0);
    }

    public int getTotalHealth() {
        return units.stream()
                .mapToInt(Unit::getCurrentHp)
                .sum();
    }

    public int getQ() { return q; }
    public int getR() { return r; }

    public void setPosition(int q, int r) {
        this.q = q;
        this.r = r;
    }
    
    public String getTroopName() { return troopName; }
    public Faction getFaction() { return faction; }
    public List<Unit> getUnits() { return units; }

    public void recruit(UnitType type) {
        Unit newUnit = UnitCreator.create(this.faction, type);
        this.addUnit(newUnit);
    }

    public void recruit(UnitType type, int count) {
        for (int i = 0; i < count; i++) {
            recruit(type);
        }
    }

}