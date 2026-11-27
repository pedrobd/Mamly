package pt.pedrobd.lembrame;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Lê os calendários do telemóvel (os do Google Calendar sincronizados no Android), só para leitura e
 * sem sair do telemóvel. Para os eventos com hora dos calendários escolhidos, cria avisos falados
 * 3 dias, 2 dias, 1 dia ou 1 hora antes (o que a pessoa escolher nas definições).
 * Os avisos ficam na mesma lista dos outros (Store.events), marcados com "cal": true.
 */
final class CalendarSync {
    private CalendarSync() {}

    private static final long DAY = 24 * 60 * 60 * 1000L, HOUR = 60 * 60 * 1000L;
    private static final long NEAR_MS = 2 * 60 * 1000L;
    private static final long REFRESH_MS = 6 * HOUR; // volta a ler o calendário de 6 em 6 horas, mesmo com a app fechada

    static boolean granted(Context c) {
        return c.checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean on(JSONObject s) { return s.optBoolean("calOn", false); }

    /** Lista de calendários: [{id, name, account, color}] */
    static JSONArray calendars(Context c) {
        JSONArray out = new JSONArray();
        if (!granted(c)) return out;
        String[] cols = { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.CALENDAR_COLOR };
        try (Cursor cur = c.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols, null, null,
                CalendarContract.Calendars.ACCOUNT_NAME + " ASC, " + CalendarContract.Calendars.CALENDAR_DISPLAY_NAME + " ASC")) {
            while (cur != null && cur.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", cur.getLong(0));
                o.put("name", cur.getString(1) == null ? "" : cur.getString(1));
                o.put("account", cur.getString(2) == null ? "" : cur.getString(2));
                o.put("color", String.format("#%06X", 0xFFFFFF & cur.getInt(3)));
                out.put(o);
            }
        } catch (Exception e) {
            Store.log(c, "Calendário: erro a ler a lista (" + e.getClass().getSimpleName() + ")");
        }
        return out;
    }

    /** Os avisos que vêm do calendário, já com as horas e as frases: [{rid, title, begin, ats:[{at, say}]}] */
    static JSONArray items(Context c) {
        JSONArray out = new JSONArray();
        JSONObject s = Store.settings(c);
        if (!on(s) || !granted(c)) return out;
        Set<Long> ids = new HashSet<>();
        JSONArray ja = s.optJSONArray("calIds");
        if (ja != null) for (int i = 0; i < ja.length(); i++) ids.add(ja.optLong(i));
        if (ids.isEmpty()) return out;
        Set<String> leads = new HashSet<>();
        JSONArray jl = s.optJSONArray("calLeads");
        if (jl != null) for (int i = 0; i < jl.length(); i++) leads.add(jl.optString(i));
        if (leads.isEmpty()) return out;
        Set<String> doneSet = new HashSet<>();
        JSONArray jd = s.optJSONArray("calDone");
        if (jd != null) for (int i = 0; i < jd.length(); i++) doneSet.add(jd.optString(i));
        int hourMin = s.optInt("calHour", 9 * 60);
        boolean en = Msg.isEn(s);
        long now = System.currentTimeMillis();

        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, now);
        ContentUris.appendId(b, now + 3 * DAY + 2 * DAY);
        String[] cols = { CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.TITLE, CalendarContract.Instances.CALENDAR_ID,
                CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.STATUS,
                CalendarContract.Instances.SELF_ATTENDEE_STATUS };
        try (Cursor cur = c.getContentResolver().query(b.build(), cols, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            while (cur != null && cur.moveToNext()) {
                long eventId = cur.getLong(0), begin = cur.getLong(1), calId = cur.getLong(3);
                String title = cur.getString(2) == null ? "" : cur.getString(2).trim();
                if (!ids.contains(calId) || cur.getInt(4) == 1 || begin <= now) continue; // só eventos com hora
                if (cur.getInt(5) == CalendarContract.Events.STATUS_CANCELED) continue;
                if (cur.getInt(6) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue;
                if (title.isEmpty()) title = en ? "event" : "evento";
                String rid = "cal:" + eventId + ":" + begin;
                if (doneSet.contains(rid)) continue;
                JSONArray ats = new JSONArray();
                for (int d = 3; d >= 1; d--) {
                    if (!leads.contains(d + "d")) continue;
                    Calendar k = Calendar.getInstance();
                    k.setTimeInMillis(begin);
                    k.add(Calendar.DAY_OF_YEAR, -d);
                    k.set(Calendar.HOUR_OF_DAY, hourMin / 60);
                    k.set(Calendar.MINUTE, hourMin % 60);
                    k.set(Calendar.SECOND, 0);
                    k.set(Calendar.MILLISECOND, 0);
                    long at = k.getTimeInMillis();
                    if (at > now + NEAR_MS && at < begin - HOUR) ats.put(new JSONObject().put("at", at).put("say", say(s, en, d, title, begin)));
                }
                if (leads.contains("1h")) {
                    long at = begin - HOUR;
                    if (at > now + NEAR_MS) ats.put(new JSONObject().put("at", at).put("say", say(s, en, 0, title, begin)));
                }
                // mesmo sem avisos por dar (ex.: o «3 dias antes» já passou), o evento aparece na lista da app
                out.put(new JSONObject().put("rid", rid).put("title", title).put("begin", begin).put("ats", ats));
            }
        } catch (Exception e) {
            Store.log(c, "Calendário: erro a ler eventos (" + e.getClass().getSimpleName() + ")");
        }
        return out;
    }

    /** «Pedro, faltam 3 dias para: jantar de Natal, sábado às 20 horas.» / «É amanhã…» / «Daqui a uma hora…» */
    private static String say(JSONObject s, boolean en, int days, String title, long begin) {
        String name = s.optString("name", "").trim();
        boolean mom = s.optBoolean("momMode", false);
        String who = !name.isEmpty() ? name + ", " : (mom ? (en ? "sweetheart, " : "meu amor, ") : "");
        String t = Msg.time(begin, en);
        String task = title.replaceAll("[.!]+$", "");
        String out;
        if (days >= 2) {
            Calendar k = Calendar.getInstance();
            k.setTimeInMillis(begin);
            String wd = k.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.LONG, en ? Locale.ENGLISH : new Locale("pt", "PT"));
            out = en ? who + days + " days to go: " + task + ", on " + wd + " at " + t + "."
                     : who + "faltam " + days + " dias para: " + task + ", " + wd + " às " + t + ".";
        } else if (days == 1) {
            out = en ? who + "it's tomorrow: " + task + ", at " + t + "." : who + "é amanhã: " + task + ", às " + t + ".";
        } else {
            out = en ? who + "in one hour: " + task + ", at " + t + "." : who + "daqui a uma hora: " + task + ", às " + t + ".";
        }
        return Character.toUpperCase(out.charAt(0)) + out.substring(1);
    }

    /** Junta os avisos do calendário à lista que o alarme usa (troca os antigos pelos novos). */
    static void refresh(Context c) {
        JSONObject s = Store.settings(c);
        JSONArray all = Store.events(c);
        JSONArray keep = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.optJSONObject(i);
            if (e == null) continue;
            // os avisos do calendário que estão mesmo a tocar ficam; os outros são lidos outra vez
            if (e.optBoolean("cal", false) && e.optLong("at") > now + NEAR_MS) continue;
            keep.put(e);
        }
        int added = 0;
        if (on(s) && granted(c)) {
            JSONArray items = items(c);
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                JSONArray ats = it.optJSONArray("ats");
                for (int j = 0; ats != null && j < ats.length(); j++) {
                    JSONObject a = ats.optJSONObject(j);
                    try {
                        keep.put(new JSONObject().put("rid", it.optString("rid")).put("at", a.optLong("at"))
                                .put("kind", "once").put("task", it.optString("title")).put("end", 0)
                                .put("hasDeadline", false).put("say", a.optString("say")).put("cal", true));
                        added++;
                    } catch (Exception ignored) {}
                }
            }
        }
        Store.setEvents(c, keep);
        scheduleRefresh(c, on(s) && granted(c));
        if (added > 0) Store.log(c, "Calendário: " + added + " avisos marcados");
    }

    /** Alarme discreto (sem o ícone de despertador) para voltar a ler o calendário daqui a umas horas. */
    private static void scheduleRefresh(Context c, boolean enable) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 3, new Intent(c, AlarmReceiver.class).putExtra("calRefresh", true),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (!enable) { am.cancel(pi); return; }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + REFRESH_MS, pi);
    }
}
