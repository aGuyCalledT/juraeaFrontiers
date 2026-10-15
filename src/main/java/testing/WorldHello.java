package testing;

public class WorldHello {

    public static void main(String[] args) {
        helloWorld("System.out.println");
    }

























































































































    static void helloWorld(String r) {
        if (r.equals("System.out.println")) {
            System.out.println("Hello, World!");
        } else {
            System.out.println(r);
        }
    }
    static void print(String r){
        System.out.print(r);
    }
    static void printprint(String r){
        System.out.println(r);
    }
    static void printprintprint(String r){
        System.out.printf(r);
    }
}