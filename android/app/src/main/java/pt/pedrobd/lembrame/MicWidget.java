package pt.pedrobd.lembrame;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget do ecrã principal com o botão do microfone: abre o Mamly já a ouvir. */
public class MicWidget extends AppWidgetProvider {
    protected int layout() { return R.layout.widget_mic; }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Intent open = new Intent(c, MainActivity.class).setAction(MainActivity.ACTION_LISTEN)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 5, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), layout());
            v.setOnClickPendingIntent(R.id.widget_root, pi);
            v.setOnClickPendingIntent(R.id.widget_btn, pi);
            m.updateAppWidget(id, v);
        }
    }
}
