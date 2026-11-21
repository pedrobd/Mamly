package pt.pedrobd.lembrame;

import org.json.JSONException;
import org.json.JSONObject;

/** O último aviso que tocou: a interface usa-o para mostrar o aviso e ouvir a resposta (mesmo se abrir depois). */
final class AlertState {
    private AlertState() {}
    private static final long MAX_AGE_MS = 3 * 60 * 1000L;
    private static String rid, kind;
    private static long at;
    private static boolean spoken;

    static synchronized void fired(String r, String k) { rid = r; kind = k; at = System.currentTimeMillis(); spoken = false; }
    static synchronized void spoken(String r) { if (r != null && r.equals(rid)) spoken = true; }
    static synchronized void clear() { rid = null; }

    static synchronized String json() {
        if (rid == null || System.currentTimeMillis() - at > MAX_AGE_MS) return "";
        try { return new JSONObject().put("rid", rid).put("kind", kind).put("at", at).put("spoken", spoken).toString(); }
        catch (JSONException e) { return ""; }
    }
}
