package pt.pedrobd.lembrame;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** O último aviso que tocou (um ou vários lembretes juntos): a interface usa-o para mostrar o aviso e ouvir a resposta. */
final class AlertState {
    private AlertState() {}
    private static final long MAX_AGE_MS = 3 * 60 * 1000L;
    private static List<String> rids = new ArrayList<>(), kinds = new ArrayList<>();
    private static long at;
    private static boolean spoken;

    static synchronized void fired(List<String> r, List<String> k) {
        rids = new ArrayList<>(r); kinds = new ArrayList<>(k);
        at = System.currentTimeMillis(); spoken = false;
    }
    static synchronized void spoken(String r) { if (r != null && rids.contains(r)) spoken = true; }
    static synchronized void clear() { rids = new ArrayList<>(); }

    static synchronized String json() {
        if (rids.isEmpty() || System.currentTimeMillis() - at > MAX_AGE_MS) return "";
        try {
            return new JSONObject().put("rid", rids.get(0)).put("kind", kinds.get(0))
                    .put("rids", new JSONArray(rids)).put("kinds", new JSONArray(kinds))
                    .put("at", at).put("spoken", spoken).toString();
        } catch (JSONException e) { return ""; }
    }
}
