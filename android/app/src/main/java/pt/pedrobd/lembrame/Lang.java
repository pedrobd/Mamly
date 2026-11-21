package pt.pedrobd.lembrame;

import android.content.Context;

import java.util.Locale;

/** Língua da app: a escolhida na interface ("pt"/"en"), ou a do telemóvel (português se pt-*, inglês nas outras). */
final class Lang {
    private Lang() {}

    static boolean en(Context c) {
        String l = Store.settings(c).optString("lang", "");
        if ("en".equals(l)) return true;
        if ("pt".equals(l)) return false;
        return !"pt".equals(Locale.getDefault().getLanguage());
    }

    static String t(Context c, String pt, String en) { return en(c) ? en : pt; }

    /** Língua para o reconhecimento de voz: pt-PT, ou o inglês do telemóvel (en-GB, en-US…). */
    static String speechTag(Context c) {
        if (!en(c)) return "pt-PT";
        Locale d = Locale.getDefault();
        return "en".equals(d.getLanguage()) ? d.toLanguageTag() : "en-US";
    }
}
