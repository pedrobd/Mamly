package pt.pedrobd.lembrame;

import org.json.JSONObject;

import java.util.Calendar;

/** As mesmas frases da versão web, montadas na hora do aviso (para o "faltam X minutos" estar certo). */
final class Msg {
    private Msg() {}

    /** A língua vem das definições sincronizadas pela interface ("lang"); se faltar, a do telemóvel. */
    static boolean isEn(JSONObject s) {
        String l = s.optString("lang", "");
        if ("en".equals(l)) return true;
        if ("pt".equals(l)) return false;
        return !"pt".equals(java.util.Locale.getDefault().getLanguage());
    }

    static String build(JSONObject e, JSONObject s, long now) {
        boolean en = isEn(s);
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
        String[] list = (en ? (mom ? MOM_EN : PHRASES_EN) : (mom ? MOM : PHRASES)).get(key);
        String out = list[RANDOM.nextInt(list.length)];
        if ("snooze".equals(kind) && dl && end > now2) out += en ? " You have until {time}." : " Tens até às {time}.";
        out = out.replace("{name}", name.isEmpty() ? (en ? "sweetheart" : "meu amor") : name)
                .replace("{who}", who)
                .replace("{hey}", name.isEmpty() ? (en ? "Hey! " : "Ei! ") : (en ? "Hey, " : "Ei, ") + name + "! ")
                .replace("{task}", softLower(task))
                .replace("{Task}", task.isEmpty() ? task : Character.toUpperCase(task.charAt(0)) + task.substring(1))
                .replace("{time}", end > 0 ? time(end, en) : "")
                .replace("{Left}", end > 0 ? capFirst(duration(end - now2, en)) : "")
                .replace("{left}", end > 0 ? duration(end - now2, en) : "");
        return out.isEmpty() ? out : Character.toUpperCase(out.charAt(0)) + out.substring(1);
    }

    /** Vários lembretes no mesmo aviso: «Pedro, tens dois eventos: ir à padaria, até às 15 horas; e ir ao mecânico, até às 17 horas.» */
    static String group(java.util.List<JSONObject> items, JSONObject s, long now) {
        boolean en = isEn(s), mom = s.optBoolean("momMode", false);
        String name = s.optString("name", "").trim();
        int n = items.size();
        boolean shortForm = n > 2; // com 3 ou mais, só os nomes (sem horas), para não ficar comprido
        java.util.List<String> parts = new java.util.ArrayList<>();
        boolean suffix = false;
        for (JSONObject e : items) {
            String say = e.optString("say", "").trim();
            String t = softLower((say.isEmpty() ? e.optString("task", "") : say).replaceAll("[.!?]+$", ""));
            String kind = e.optString("kind", "regular");
            long end = e.optLong("end", 0);
            boolean dl = e.optBoolean("hasDeadline", false) && end > now;
            if ("final".equals(kind) && end > now) { t += en ? ", last call, " + duration(end - now, true) + " left" : ", último aviso, faltam " + duration(end - now, false); suffix = true; }
            else if ("deadline".equals(kind)) { t += en ? ", time's up" : ", chegou a hora limite"; suffix = true; }
            else if (!shortForm && dl) { t += (en ? ", until " : ", até às ") + time(end, en); suffix = true; }
            parts.add(t);
        }
        String sep = suffix ? "; " : ", ";
        String lastSep = suffix ? (en ? "; and " : "; e ") : (en ? " and " : " e ");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) { if (i > 0) sb.append(i == n - 1 ? lastSep : sep); sb.append(parts.get(i)); }
        String[] num = en ? new String[]{"", "one", "two", "three", "four", "five", "six"} : new String[]{"", "um", "dois", "três", "quatro", "cinco", "seis"};
        String nn = n < num.length ? num[n] : String.valueOf(n);
        String intro;
        if (mom) {
            String nm = name.isEmpty() ? (en ? "sweetheart" : "meu amor") : name;
            intro = en ? nm + ", you have " + nn + " events, honey: " : nm + ", tens " + nn + " eventos, coração: ";
        } else intro = (name.isEmpty() ? "" : name + ", ") + (en ? "you have " + nn + " events: " : "tens " + nn + " eventos: ");
        String out = intro + sb + ".";
        return Character.toUpperCase(out.charAt(0)) + out.substring(1);
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

    /** Frases em inglês (iguais às da versão web: PHRASES_EN / MOM_PHRASES_EN em app.js). */
    private static final java.util.Map<String, String[]> PHRASES_EN = new java.util.HashMap<>();
    private static final java.util.Map<String, String[]> MOM_EN = new java.util.HashMap<>();
    static {
        PHRASES_EN.put("regularDl", new String[]{
                "{who}don't forget: {task}. You have until {time}, {left} left.",
                "{who}just a reminder: {task}. {Left} left until {time}.",
                "{hey}{Task}. You still have {left}, until {time}."});
        PHRASES_EN.put("regular", new String[]{"{who}don't forget: {task}.", "{who}just a reminder: {task}.", "{hey}{Task}."});
        PHRASES_EN.put("final", new String[]{"{who}last call! {Task}. Only {left} left.", "{who}heads up, it's almost time: {task}. You have until {time}."});
        PHRASES_EN.put("deadline", new String[]{"{who}it's time: {task}. Did you manage?", "{who}time's up: {task}. Is it done?"});
        PHRASES_EN.put("once", new String[]{"{who}it's time: {task}.", "{hey}It's time: {task}.", "{who}now is the moment: {task}."});
        PHRASES_EN.put("snooze", new String[]{"{who}I'm back, as promised: {task}.", "{who}me again: {task}."});
        MOM_EN.put("regularDl", new String[]{
                "{name}, don't forget: {task}. You still have {left}, until {time}.",
                "So, {name}? Have you done this yet? {Task}. You only have until {time}.",
                "{name}, look at the time: {task}. {Left} left, don't leave it to the last minute, honey!"});
        MOM_EN.put("regular", new String[]{"{name}, don't forget: {task}.", "Have you done this yet, {name}? {Task}.",
                "{name}, just reminding you: {task}. Do it now, honey, it'll only take a minute."});
        MOM_EN.put("final", new String[]{"{name}! Last call: {task}. Only {left} left, hurry up!", "Come on, {name}, it's almost time: {task}. You have until {time}."});
        MOM_EN.put("deadline", new String[]{"{name}, it's time: {task}. Did you manage, honey?", "So, {name}? It was now: {task}. Is it done?"});
        MOM_EN.put("once", new String[]{"{name}, it's time: {task}.", "Come on, {name}, now's the moment: {task}.", "Honey, it's time: {task}."});
        MOM_EN.put("snooze", new String[]{"I said I'd be back, {name}: {task}.", "{name}, it's mom again: {task}. Don't forget!"});
    }

    private static String capFirst(String t) { return t.isEmpty() ? t : Character.toUpperCase(t.charAt(0)) + t.substring(1); }

    /** "Ir à InPost" → "ir à InPost", mas "IKEA" fica igual. */
    private static String softLower(String t) {
        if (t.length() > 1 && Character.isUpperCase(t.charAt(0)) && Character.isLowerCase(t.charAt(1)))
            return Character.toLowerCase(t.charAt(0)) + t.substring(1);
        return t;
    }

    static String title(String kind, boolean en) {
        if (en) {
            switch (kind) {
                case "final": return "Last call";
                case "deadline": return "Time's up";
                case "once": return "It's time";
                case "snooze": return "Again";
                default: return "Reminder";
            }
        }
        switch (kind) {
            case "final": return "Último aviso";
            case "deadline": return "Hora limite";
            case "once": return "Está na hora";
            case "snooze": return "Outra vez";
            default: return "Lembrete";
        }
    }

    static String time(long t, boolean en) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(t);
        int h = c.get(Calendar.HOUR_OF_DAY), m = c.get(Calendar.MINUTE);
        if (en) {
            if (h == 12 && m == 0) return "noon";
            if (h == 23 && m == 59) return "midnight";
            int h12 = h % 12 == 0 ? 12 : h % 12;
            String ap = h < 12 ? "AM" : "PM";
            return m == 0 ? h12 + " " + ap : String.format(java.util.Locale.ROOT, "%d:%02d %s", h12, m, ap);
        }
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

    static String duration(long ms, boolean en) {
        if (ms < 59500) {
            long sec = Math.max(1, Math.round(ms / 1000.0));
            return sec + (sec == 1 ? (en ? " second" : " segundo") : (en ? " seconds" : " segundos"));
        }
        long total = Math.max(1, Math.round(ms / 60000.0));
        long h = total / 60, m = total % 60;
        String hs = h == 0 ? "" : h + (h == 1 ? (en ? " hour" : " hora") : (en ? " hours" : " horas"));
        String mins = m == 0 ? "" : m + (m == 1 ? (en ? " minute" : " minuto") : (en ? " minutes" : " minutos"));
        if (!hs.isEmpty() && !mins.isEmpty()) return hs + (en ? " and " : " e ") + mins;
        return hs + mins;
    }
}
