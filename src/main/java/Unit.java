import java.util.EnumSet;
import java.util.Set;

public class Unit {
    private String name;
    private UnitType type;
    private Faction faction;

    private int maxHealthPoints;
    private int currentHealthPoints;
    private int armorClass;
    private int attackRoll;
    private int attackDamage;
    private int mana;

    private int baseMovement;
    private int baseMoral;

    private Set<Effect> activeEffects = EnumSet.noneOf(Effect.class);

    public Unit(String name, UnitType type, Faction faction, int healthPoints,
                int armorClass, int attackRoll, int attackDamage, int movement, int moral, int mana) {
        this.name = name;
        this.type = type;
        this.faction = faction;
        this.maxHealthPoints = healthPoints;
        this.currentHealthPoints = healthPoints;
        this.armorClass = armorClass;
        this.attackRoll = attackRoll;
        this.attackDamage = attackDamage;
        this.baseMovement = movement;
        this.baseMoral = moral;
        this.mana = mana;
    }

    // FIGHT
    public void takeDamage(int amount) {
        this.currentHealthPoints -= amount;
        if (this.currentHealthPoints < 0) this.currentHealthPoints = 0;
    }

    public boolean isDead() {
        return this.currentHealthPoints <= 0;
    }

    // EFFECTS
    public void addEffect(Effect effect) { activeEffects.add(effect); }
    public void removeEffect(Effect effect) { activeEffects.remove(effect); }
    public boolean hasEffect(Effect effect) { return activeEffects.contains(effect); }

    // GETTER
    public String getName() { return name; }
    public UnitType getType() { return type; }
    public Faction getFaction() { return faction; }
    public int getCurrentHp() { return currentHealthPoints; }
    public int getMaxHp() { return  maxHealthPoints; }
    public int getArmorClass() { return armorClass; }
    public int getAttackRoll() { return attackRoll; }
    public int getAttackDamage() { return attackDamage; }
    public int getMana() { return mana; }

    public int getMovement() {
        if (hasEffect(Effect.ROOTED) || hasEffect(Effect.STUNNED)) return 0;
        if (hasEffect(Effect.EXHAUSTED)) return baseMovement / 2;
        return baseMovement;
    }

    public int getMoral() {
        int currentMoral = baseMoral;
        if (hasEffect(Effect.BLESSED)) currentMoral += 2;
        if (hasEffect(Effect.POISONED)) currentMoral -= 1;
        return currentMoral;
    }
}