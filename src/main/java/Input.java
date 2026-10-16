import java.util.Scanner;
import java.util.function.Function;

public class Input {
    private static final Scanner scanner = new Scanner(System.in);

    public static <T> T getInput(Function<String, T> parser) {
        while (true) {
            System.out.print("> ");
            String input = scanner.nextLine().trim();
            try {
                return parser.apply(input);
            } catch (NumberFormatException e) {
                System.out.println("ERROR: invalid number format -> " + input);
            } catch (IllegalArgumentException e) {
                System.out.println("ERROR: " + e.getMessage());
            } catch (Exception e) {
                System.out.println("ERROR: invalid input ->" + input);
            }
        }
    }

    private static String[] splitArray(String input) {
        if (input.isEmpty()) throw new IllegalArgumentException("ERROR: input may not be empty");
        return input.split("\\s*,\\s*");
    }

    // --- STRINGS, CHARS & BOOLEANS ---

    public static String getString() {
        return getInput(s -> {
            if (s.isEmpty()) throw new IllegalArgumentException("ERROR: input may not be empty");
            return s;
        });
    }

    public static char getChar() {
        return getInput(s -> {
            if (s.length() != 1) throw new IllegalArgumentException("ERROR: input must be one character");
            return s.charAt(0);
        });
    }

    public static boolean getBoolean() {
        return getInput(s -> {
            String lower = s.toLowerCase();
            if (lower.equals("true") || lower.equals("ja") || lower.equals("yes") || lower.equals("y") || lower.equals("1"))
                return true;
            if (lower.equals("false") || lower.equals("nein") || lower.equals("no") || lower.equals("n") || lower.equals("0"))
                return false;
            throw new IllegalArgumentException("ERROR: input must be 'yes' or 'no'");
        });
    }

    public static int getInt() {
        return getInput(Integer::parseInt);
    }

    public static int getInt(int min, int max) {
        return getInput(s -> {
            int val = Integer.parseInt(s);
            if (val < min || val > max) {
                throw new IllegalArgumentException("Value has to between " + min + " and " + max);
            }
            return val;
        });
    }

    public static int[] getIntArray() {
        return getInput(s -> {
            String[] parts = splitArray(s);
            int[] arr = new int[parts.length];
            for (int i = 0; i < parts.length; i++) {
                arr[i] = Integer.parseInt(parts[i]);
            }
            return arr;
        });
    }

    // --- DOUBLES ---

    public static double getDouble() {
        return getInput(Double::parseDouble);
    }

    public static double getDouble(double min, double max) {
        return getInput(s -> {
            double val = Double.parseDouble(s.replace(',', '.')); // Erlaubt auch deutsche Kommas
            if (val < min || val > max) {
                throw new IllegalArgumentException("Wert muss zwischen " + min + " und " + max + " liegen.");
            }
            return val;
        });
    }

    public static double[] getDoubleArray() {
        return getInput(s -> {
            String[] parts = splitArray(s);
            double[] arr = new double[parts.length];
            for (int i = 0; i < parts.length; i++) {
                arr[i] = Double.parseDouble(parts[i].replace(',', '.'));
            }
            return arr;
        });
    }

    // --- LONGS ---

    public static long getLong() {
        return getInput(Long::parseLong);
    }

    public static long getLong(long min, long max) {
        return getInput(s -> {
            long val = Long.parseLong(s);
            if (val < min || val > max) {
                throw new IllegalArgumentException("Wert muss zwischen " + min + " und " + max + " liegen.");
            }
            return val;
        });
    }

    public static long[] getLongArray() {
        return getInput(s -> {
            String[] parts = splitArray(s);
            long[] arr = new long[parts.length];
            for (int i = 0; i < parts.length; i++) {
                arr[i] = Long.parseLong(parts[i]);
            }
            return arr;
        });
    }

    // --- FLOATS ---

    public static float getFloat() {
        return getInput(s -> Float.parseFloat(s.replace(',', '.')));
    }

    public static float getFloat(float min, float max) {
        return getInput(s -> {
            float val = Float.parseFloat(s.replace(',', '.'));
            if (val < min || val > max) {
                throw new IllegalArgumentException("Wert muss zwischen " + min + " und " + max + " liegen.");
            }
            return val;
        });
    }

    public static float[] getFloatArray() {
        return getInput(s -> {
            String[] parts = splitArray(s);
            float[] arr = new float[parts.length];
            for (int i = 0; i < parts.length; i++) {
                arr[i] = Float.parseFloat(parts[i].replace(',', '.'));
            }
            return arr;
        });
    }
}