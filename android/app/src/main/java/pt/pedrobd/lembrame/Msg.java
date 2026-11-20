package pt.pedrobd.lembrame;

import org.json.JSONObject;

import java.util.Calendar;

/** As mesmas frases da versão web, montadas na hora do aviso (para o "faltam X minutos" estar certo). */
final class Msg {
    private Msg() {}

    static String build(JSONObject e, JSONObject s, long now) {
        String name = s.optString("name", "").trim();
        String who = name.isEmpty() ? "" : name + ", ";
        String task = e.optString("task", "Lembrete").replaceAll("[.!]+$", "");
        long end = e.optLong("end", 0);
        boolean dl = e.optBoolean("hasDeadline", false) && end > 0;
        String kind = e.optString("kind", "regular");
        // "diz o meu nome": a voz diz exatamente o texto pedido
        String say = e.optString("say", "").trim();
        if (!say.isEmpty() && !"final".equals(kind) && !"deadline".equals(kind)) {
            String o = say.matches(".*[.!?]$") ? say : say + ".";
            return Character.toUpperCase(o.charAt(0)) + o.substring(1);
        }
        long now2 = now;
        String key;
        switch (kind) {
            case "final": case "deadline": case "once": case "snooze": key = kind; break;
            default: key = dl && end > now2 ? "regularDl" : "regular";
        }
        boolean mom = s.optBoolean("momMode", false);
        String[] list = (mom ? MOM : PHRASES).get(key);
        String out = list[RANDOM.nextInt(list.length)];
        if ("snooze".equals(kind) && dl && end > now2) out += " Tens até às {time}.";
        out = out.replace("{name}", name.isEmpty() ? "meu amor" : name)
                .replace("{who}", who)
                .replace("{hey}", name.isEmpty() ? "Ei! " : "Ei, " + name + "! ")
                .replace("{task}", softLower(task))
                .replace("{Task}", task.isEmpty() ? task : Character.toUpperCase(task.charAt(0)) + task.substring(1))
                .replace("{time}", end > 0 ? time(end) : "")
                .replace("{left}", end > 0 ? duration(end - now2) : "");
        return out.isEmpty() ? out : Character.toUpperCase(out.charAt(0)) + out.substring(1);
    }

    private static final java.util.Random RANDOM = new java.util.Random();
    private static final java.util.Map<String, String[]> PHRASES = new java.util.HashMap<>();
    static {
        PHRASES.put("regularDl", new String[]{
                "{who}não te esqueças: {task}. Tens até às {time}, ainda faltam {left}.",
                "{who}só para lembrar: {task}. Faltam {left} para as {time}.",
                "{hey}{Task}. Ainda tens {left}, até às {time}."});
        PHRASES.put("regular", new String[]{"{who}não te esqueças: {task}.", "{who}só para lembrar: {task}.", "{hey}{Task}."});
        PHRASES.put("final", new String[]{"{who}último aviso! {Task}. Só faltam {left}.", "{who}atenção, está quase na hora: {task}. Tens até às {time}."});
        PHRASES.put("deadline", new String[]{"{who}chegou a hora limite: {task}. Já conseguiste?", "{who}a hora chegou: {task}. Já está feito?"});
        PHRASES.put("once", new String[]{"{who}está na hora: {task}.", "{hey}Chegou a hora: {task}.", "{who}agora é a altura: {task}."});
        PHRASES.put("snooze", new String[]{"{who}voltei, como combinado: {task}.", "{who}outra vez eu: {task}."});
    }

    /** Modo mãe: as mesmas frases da versão web (MOM_PHRASES em app.js). */
    private static final java.util.Map<String, String[]> MOM = new java.util.HashMap<>();
    static {
        MOM.put("regularDl", new String[]{
                "{name}, não te esqueças: {task}. Ainda tens {left}, até às {time}.",
                "Então, {name}? Já trataste disto? {Task}. Só tens até às {time}.",
                "{name}, olha a hora: {task}. Faltam {left}, não deixes para a última, coração!"});
        MOM.put("regular", new String[]{"{name}, não te esqueças: {task}.", "Já trataste disto, {name}? {Task}.",
                "{name}, só para te lembrar: {task}. Faz isso agora, coração, que é rapidinho."});
        MOM.put("final", new String[]{"{name}! Último aviso: {task}. Só faltam {left}, despacha-te!", "Vá lá, {name}, está quase na hora: {task}. Tens até às {time}."});
        MOM.put("deadline", new String[]{"{name}, chegou a hora: {task}. Conseguiste, coração?", "Então, {name}? Era agora: {task}. Já está feito?"});
        MOM.put("once", new String[]{"{name}, está na hora: {task}.", "Vá, {name}, agora é a altura: {task}.", "Coração, chegou a hora: {task}."});
        MOM.put("snooze", new String[]{"Eu disse que voltava, {name}: {task}.", "{name}, é outra vez a mãe: {task}. Não te esqueças!"});
    }

    /** "Ir à InPost" → "ir à InPost", mas "IKEA" fica igual. */
    private static String softLower(String t) {
        if (t.length() > 1 && Character.isUpperCase(t.charAt(0)) && Character.isLowerCase(t.charAt(1)))
            return Character.toLowerCase(t.charAt(0)) + t.substring(1);
        return t;
    }

    static String title(String kind) {
        switch (kind) {
            case "final": return "Último aviso";
            case "deadline": return "Hora limite";
            case "once": return "Está na hora";
            case "snooze": return "Outra vez";
            default: return "Lembrete";
        }
    }

    static String time(long t) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(t);
        int h = c.get(Calendar.HOUR_OF_DAY), m = c.get(Calendar.MINUTE);
        if (h == 12 && m == 0) return "meio-dia";
        if (h == 23 && m == 59) return "meia-noite";
        if (m == 0) return h + (h == 1 ? " hora" : " horas");
        if (m == 30) return h + " e meia";
        return h + " e " + m;
    }

    static String hm(long t) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(t);
        return String.format(java.util.Locale.ROOT, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }

    static String duration(long ms) {
        if (ms < 59500) {
            long sec = Math.max(1, Math.round(ms / 1000.0));
            return sec + (sec == 1 ? " segundo" : " segundos");
        }
        long total = Math.max(1, Math.round(ms / 60000.0));
        long h = total / 60, m = total % 60;
        String hs = h == 0 ? "" : h + (h == 1 ? " hora" : " horas");
        String mins = m == 0 ? "" : m + (m == 1 ? " minuto" : " minutos");
        if (!hs.isEmpty() && !mins.isEmpty()) return hs + " e " + mins;
        return hs + mins;
    }
}
