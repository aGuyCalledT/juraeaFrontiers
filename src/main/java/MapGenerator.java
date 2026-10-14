import java.util.*;

public class MapGenerator {
    private Random random = new Random();

    public void generateBiomes(Map<String, HexTile> grid, int totalTiles) {
        // 1. Initialisiere alles mit Ebenen
        for (HexTile tile : grid.values()) {
            setTerrain(tile, LandType.PLANE);
        }

        int targetDesert = (int) (totalTiles * 0.15);
        int targetMountain = (int) (totalTiles * 0.25);
        int targetForest = (int) (totalTiles * 0.25);

        growBiome(grid, LandType.MOUNTAIN, 2, targetMountain);
        growBiome(grid, LandType.DESERT, 1, targetDesert);
        growBiome(grid, LandType.FOREST, 3, targetForest);
    }

    private void growBiome(Map<String, HexTile> grid, LandType biomeType, int numSeeds, int targetSize) {
        List<HexTile> biomeTiles = new ArrayList<>();
        List<HexTile> expansionFrontier = new ArrayList<>();

        List<HexTile> allTiles = new ArrayList<>(grid.values());
        for (int i = 0; i < numSeeds; i++) {
            HexTile seed = findValidSeed(allTiles, biomeType);
            if (seed != null) {
                setTerrain(seed, biomeType);
                biomeTiles.add(seed);
                addValidNeighborsToFrontier(seed, expansionFrontier, biomeType);
            }
        }

        while (biomeTiles.size() < targetSize && !expansionFrontier.isEmpty()) {
            int index = random.nextInt(expansionFrontier.size());
            HexTile nextTile = expansionFrontier.remove(index);

            if (isValidExpansion(nextTile, biomeType)) {
                setTerrain(nextTile, biomeType);
                biomeTiles.add(nextTile);
                addValidNeighborsToFrontier(nextTile, expansionFrontier, biomeType);
            }
        }
    }

    private HexTile findValidSeed(List<HexTile> tiles, LandType biomeType) {
        Collections.shuffle(tiles, random);
        for (HexTile tile : tiles) {
            if (tile.landType != LandType.PLANE) continue;

            if (biomeType == LandType.DESERT && !hasNeighborOfType(tile, LandType.MOUNTAIN)) {
                continue;
            }
            return tile;
        }
        return tiles.stream().filter(t -> t.landType == LandType.PLANE).findFirst().orElse(null);
    }

    private boolean isValidExpansion(HexTile tile, LandType biomeType) {
        if (tile.landType != LandType.PLANE) return false;

        if (biomeType == LandType.FOREST && hasNeighborOfType(tile, LandType.DESERT)) return false;
        if (biomeType == LandType.DESERT && hasNeighborOfType(tile, LandType.FOREST)) return false;

        int sameTypeNeighbors = countNeighborsOfType(tile, biomeType);
        if (sameTypeNeighbors < 2) {
            if (random.nextInt(100) < 60) return false;
        }
        return true;
    }

    private void addValidNeighborsToFrontier(HexTile tile, List<HexTile> frontier, LandType biomeType) {
        for (HexTile neighbor : tile.neighbors.values()) {
            if (neighbor.landType == LandType.PLANE && !frontier.contains(neighbor)) {
                frontier.add(neighbor);
            }
        }
    }

    private void setTerrain(HexTile tile, LandType landType) {
        tile.landType = landType;
        // Farbe zurücksetzen, falls die Basis modifiziert wurde
        if (tile.occupiedBy == Faction.NONE || tile.occupiedBy == null) {
            tile.displayColor = landType.getDefaultDisplayColor();
            tile.backgroundColor = landType.getDefaultBackgroundColor();
        }
    }

    private boolean hasNeighborOfType(HexTile tile, LandType terrainType) {
        return tile.neighbors.values().stream().anyMatch(n -> n.landType == terrainType);
    }

    private int countNeighborsOfType(HexTile tile, LandType terrainType) {
        return (int) tile.neighbors.values().stream().filter(n -> n.landType == terrainType).count();
    }
}
