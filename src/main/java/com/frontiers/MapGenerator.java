package com.frontiers;

import java.util.*;
import java.util.stream.Collectors;

public class MapGenerator {
    private final Random random = new Random();

    public record BiomeConfig(LandType type, float minPct, float maxPct) {
        public int getTargetSize(int totalTiles) {
            return (int) (totalTiles * ((minPct + maxPct) / 2.0f));
        }

        public int getMin(int totalTiles) { return (int) (totalTiles * minPct); }
        public int getMax(int totalTiles) { return (int) (totalTiles * maxPct); }
    }

    public void generateMap(Map<HexCoordinate, HexTile> grid) {
        int totalTiles = grid.size();
        boolean isValidMap = false;

        // DEFINE MINIMUM AND MAXIMUM NUMBER OF BIOME TILES
        float maximumDesert = 0.2f;
        float minimumDesert = 0.1f;
        BiomeConfig desertCfg = new BiomeConfig(
                LandType.DESERT, minimumDesert, maximumDesert);

        float minimumMountain = 0.2f;
        float maximumMountain = 0.3f;
        BiomeConfig mountainCfg = new BiomeConfig(
                LandType.MOUNTAIN, minimumMountain, maximumMountain);

        float minimumForest = 0.2f;
        float maximumForest = 0.3f;
        BiomeConfig forestCfg = new BiomeConfig(
                LandType.FOREST, minimumForest, maximumForest);

        int attempts = 0;

        // LOOPS UNTIL VALID MAP OCCURS
        while (!isValidMap) {
            attempts++;
            resetGridToPlains(grid);

            generateOceans(grid);

            // BIOME GROWER (DESERT ALWAYS CENTERED)
            growBiomeFromSeed(grid, desertCfg.type, desertCfg.getTargetSize(totalTiles), getCenterTile(grid));
            growBiomeRandomly(grid, mountainCfg.type, mountainCfg.getTargetSize(totalTiles), 2);
            growBiomeRandomly(grid, forestCfg.type, forestCfg.getTargetSize(totalTiles), 3);

            fixOrphanTiles(grid);

            isValidMap = validateMap(grid, totalTiles, desertCfg, mountainCfg, forestCfg);
        }
    }


    private void resetGridToPlains(Map<HexCoordinate, HexTile> grid) {
        for (HexTile tile : grid.values()) {
            setTerrain(tile, LandType.PLANE);
        }
    }

    private void generateOceans(Map<HexCoordinate, HexTile> grid) {
        int OCEAN_PROBABILITY = 3;

        // PLACE EDGE OCEAN
        for (HexTile tile : grid.values()) {
            if (tile.isOuterTile() && random.nextInt(OCEAN_PROBABILITY) == 0) setTerrain(tile, LandType.OCEAN);
        }

        // FIND NEIGHBORS OF OCEAN
        List<HexTile> nextToOcean = new ArrayList<>();
        for (HexTile tile : grid.values()) {
            if (tile.getLandType() != LandType.OCEAN && hasNeighborOfType(tile, LandType.OCEAN)) {
                nextToOcean.add(tile);
            }
        }
        for (HexTile tile : nextToOcean) {
            if (random.nextInt(OCEAN_PROBABILITY * 2) == 0) {
                setTerrain(tile, LandType.OCEAN);
            }
        }
    }

    private void growBiomeRandomly(Map<HexCoordinate, HexTile> grid, LandType biomeType, int targetSize, int numSeeds) {
        List<HexTile> allTiles = new ArrayList<>(grid.values());
        List<HexTile> frontier = new ArrayList<>();
        int currentSize = 0;

        for (int i = 0; i < numSeeds; i++) {
            HexTile seed = findRandomValidSeed(allTiles, biomeType);
            if (seed != null) {
                setTerrain(seed, biomeType);
                currentSize++;
                addValidNeighborsToFrontier(seed, frontier, biomeType);
            }
        }

        expandFrontier(frontier, biomeType, currentSize, targetSize);
    }

    private void growBiomeFromSeed(Map<HexCoordinate, HexTile> grid, LandType biomeType, int targetSize, HexTile seed) {
        if (seed == null || seed.getLandType() != LandType.PLANE) return;

        List<HexTile> frontier = new ArrayList<>();
        setTerrain(seed, biomeType);
        addValidNeighborsToFrontier(seed, frontier, biomeType);

        expandFrontier(frontier, biomeType, 1, targetSize);
    }

    private void expandFrontier(List<HexTile> frontier, LandType biomeType, int currentSize, int targetSize) {
        while (currentSize < targetSize && !frontier.isEmpty()) {
            int index = random.nextInt(frontier.size());
            HexTile nextTile = frontier.remove(index);

            if (isValidExpansion(nextTile, biomeType)) {
                setTerrain(nextTile, biomeType);
                currentSize++;
                addValidNeighborsToFrontier(nextTile, frontier, biomeType);
            }
        }
    }

    private void fixOrphanTiles(Map<HexCoordinate, HexTile> grid) {
        boolean changed;
        do {
            changed = false;
            for (HexTile tile : grid.values()) {
                // Ozeane lassen wir hier in Ruhe, falls sie isoliert sein dürfen
                if (tile.getLandType() == LandType.OCEAN) continue;

                if (countNeighborsOfType(tile, tile.getLandType()) == 0) {
                    LandType majorityNeighborType = getMostCommonNeighborType(tile);
                    if (majorityNeighborType != null && majorityNeighborType != tile.getLandType()) {
                        setTerrain(tile, majorityNeighborType);
                        changed = true;
                    }
                }
            }
        } while (changed); // Wiederholen, bis keine Orphans mehr existieren
    }

    /* --- HILFSMETHODEN & VALIDIERUNG --- */

    private boolean validateMap(Map<HexCoordinate, HexTile> grid, int totalTiles, BiomeConfig... configs) {
        Map<LandType, Integer> counts = new EnumMap<>(LandType.class);
        for (HexTile tile : grid.values()) {
            counts.merge(tile.getLandType(), 1, Integer::sum);
        }

        for (BiomeConfig config : configs) {
            int count = counts.getOrDefault(config.type, 0);
            if (count < config.getMin(totalTiles) || count > config.getMax(totalTiles)) {
                return false; // Ein Biome ist out-of-bounds -> Karte verwerfen
            }
        }
        return true;
    }

    private HexTile getCenterTile(Map<HexCoordinate, HexTile> grid) {
        return grid.get(new HexCoordinate(0, 0));
    }

    private HexTile findRandomValidSeed(List<HexTile> tiles, LandType biomeType) {
        Collections.shuffle(tiles, random);
        for (HexTile tile : tiles) {
            if (tile.getLandType() != LandType.PLANE) continue;

            // Verhindern, dass Wälder neben Wüsten spawnen und umgekehrt
            if (biomeType == LandType.DESERT && hasNeighborOfType(tile, LandType.FOREST)) continue;
            if (biomeType == LandType.FOREST && hasNeighborOfType(tile, LandType.DESERT)) continue;

            return tile;
        }
        return null;
    }

    private boolean isValidExpansion(HexTile tile, LandType biomeType) {
        if (tile.getLandType() != LandType.PLANE) return false;
        if (biomeType == LandType.FOREST && hasNeighborOfType(tile, LandType.DESERT)) return false;
        if (biomeType == LandType.DESERT && hasNeighborOfType(tile, LandType.FOREST)) return false;

        int sameTypeNeighbors = countNeighborsOfType(tile, biomeType);
        if (sameTypeNeighbors < 2 && random.nextInt(100) < 60) {
            return false; // Erzeugt natürlichere, zusammenhängende Formen
        }
        return true;
    }

    private void addValidNeighborsToFrontier(HexTile tile, List<HexTile> frontier, LandType biomeType) {
        for (HexTile neighbor : tile.neighbors.values()) {
            if (neighbor.getLandType() == LandType.PLANE && !frontier.contains(neighbor)) {
                frontier.add(neighbor);
            }
        }
    }

    private LandType getMostCommonNeighborType(HexTile tile) {
        return tile.neighbors.values().stream()
                .map(n -> n.getLandType())
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(LandType.PLANE);
    }

    private boolean hasNeighborOfType(HexTile tile, LandType terrainType) {
        return tile.neighbors.values().stream().anyMatch(n -> n.getLandType() == terrainType);
    }

    private int countNeighborsOfType(HexTile tile, LandType terrainType) {
        return (int) tile.neighbors.values().stream().filter(n -> n.getLandType() == terrainType).count();
    }

    public void setTerrain(HexTile tile, LandType landType) {
        tile.setLandType(landType);

        // Farben resetten
        if (tile.occupiedBy == null || tile.occupiedBy == Faction.NONE) {
            tile.displayColor = landType.getDefaultDisplayColor();
            tile.backgroundColor = landType.getDefaultBackgroundColor();
        }
    }
}
