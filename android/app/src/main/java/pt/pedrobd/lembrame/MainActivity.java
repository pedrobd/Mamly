package pt.pedrobd.lembrame;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.os.Handler;
import android.os.Looper;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.ArrayList;

/** Mostra a interface (a mesma da versão web) e liga-a à voz, ao microfone e aos alarmes do Android. */
public class MainActivity extends Activity {
    private static final int REQ_SPEECH = 7;
    private static final String START = "https://appassets.androidplatform.net/assets/www/index.html";
    private static WeakReference<MainActivity> current = new WeakReference<>(null);

    WebView web;
    Speech speech;
    Dictation dictation;
    static final int REQ_MIC = 2;
    static final int REQ_CAL = 3;
    private String pendingListenMode = null;
    private String pendingSharedLink = null;
    private boolean pageReady = false;
    private boolean overLock = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable lockTimeout = this::alertClosed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notif.channels(this);
        speech = newSpeech();
        dictation = new Dictation(this, new Dictation.Out() {
            @Override public void partial(String text) {
                js("window.__native && __native.onPartial && __native.onPartial(" + JSONObject.quote(text) + ")");
            }
            @Override public void done(String text, String error) {
                js("window.__native && __native.onListen(" + (text == null || text.isEmpty() ? "null" : JSONObject.quote(text))
                        + "," + (error == null ? "null" : JSONObject.quote(error)) + ")");
            }
        });

        web = new WebView(this);
        // O Android 15+ desenha a app por baixo das barras do sistema (ecrã de ponta a ponta).
        // A WebView fica dentro de um contentor com margens iguais às barras e ao teclado.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.bg));
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            });
        }
        applyBarIcons();
        // Botão "voltar": no Android 13+ (e obrigatório a partir do 16) usa-se o "voltar preditivo".
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) { pageReady = true; }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");
        web.loadUrl(START);
        captureSharedLink(getIntent());
        handleAlertIntent(getIntent());

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    private Speech newSpeech() {
        return new Speech(this, false, (ok, info) -> {
            Store.log(this, "Voz da app: " + info);
            js("window.__native && __native.onVoiceReady && __native.onVoiceReady()");
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (captureSharedLink(intent) && pageReady) js("window.__native && __native.onSharedLink && __native.onSharedLink()");
        handleAlertIntent(intent);
    }

    /** Aberto pelo aviso (ecrã bloqueado): mostra a app por cima do bloqueio, com o ecrã aceso, durante o aviso. */
    private void handleAlertIntent(Intent i) {
        if (i == null || i.getStringExtra("alert") == null) return;
        i.removeExtra("alert");
        showOverLock(true);
        wakeScreen();
        handler.removeCallbacks(lockTimeout);
        handler.postDelayed(lockTimeout, 90_000); // se ninguém responder, volta ao ecrã de bloqueio
        Store.log(this, "Aviso aberto no ecrã de bloqueio");
    }

    @SuppressWarnings("deprecation")
    private void wakeScreen() {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null || pm.isInteractive()) return;
            android.os.PowerManager.WakeLock wl = pm.newWakeLock(android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                    | android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP | android.os.PowerManager.ON_AFTER_RELEASE, "lembrame:alert");
            wl.acquire(10_000);
        } catch (Exception e) { Store.log(this, "Não consegui acender o ecrã: " + e.getMessage()); }
    }

    private void showOverLock(boolean on) {
        overLock = on;
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(on); setTurnScreenOn(on); }
        else {
            int f = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (on) getWindow().addFlags(f); else getWindow().clearFlags(f);
        }
        if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /** O aviso fechou (feito, adiado, fechado ou sem resposta): volta ao ecrã de bloqueio, para ninguém ver a app sem desbloquear. */
    void alertClosed() {
        runOnUiThread(() -> {
            AlertState.clear();
            handler.removeCallbacks(lockTimeout);
            if (!overLock) return;
            // dá tempo à voz para dizer «Muito bem!» / «Volto a lembrar…»
            handler.postDelayed(() -> {
                if (!overLock) return;
                showOverLock(false);
                KeyguardManager km = getSystemService(KeyguardManager.class);
                if (km != null && km.isKeyguardLocked()) moveTaskToBack(true);
            }, 2500);
        });
    }

    // Nota: o modo "por cima do bloqueio" não se desliga no onStop. Com o ecrã apagado, o Android pára a
    // atividade logo a seguir a abri-la; desligar aí impedia o ecrã de acender. Sai em alertClosed() ou ao fim de 90 s.

    /** Guarda o link de um lembrete partilhado (mamly://add#r=…) até a interface o ir buscar. */
    private boolean captureSharedLink(Intent intent) {
        if (intent == null || intent.getData() == null) return false;
        Uri u = intent.getData();
        if (!"mamly".equals(u.getScheme())) return false;
        pendingSharedLink = u.toString();
        Store.log(this, "Recebi um lembrete partilhado");
        return true;
    }

    synchronized String takeSharedLink() {
        String s = pendingSharedLink;
        pendingSharedLink = null;
        return s == null ? "" : s;
    }

    /** Se a língua mudou (definições), volta a criar a voz da interface na língua nova. */
    void ensureSpeechLang() {
        if (speech != null && speech.isEnglish() != Lang.en(this)) { speech.shutdown(); speech = newSpeech(); }
    }

    @Override
    protected void onResume() {
        super.onResume();
        current = new WeakReference<>(this);
        // a pessoa pode ter acabado de instalar a voz portuguesa: volta a verificar
        if (speech != null && speech.noPortuguese()) { speech.shutdown(); speech = newSpeech(); }
        if (pageReady) js("window.__native && __native.onResume()");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_MIC) {
            String mode = pendingListenMode;
            pendingListenMode = null;
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (mode != null) { if (ok) listen(mode); else startListening(); }
            return;
        }
        js("window.__native && __native.onResume()");
    }

    /** "dictation": ouve até 3,5 s de silêncio ou até tocar de novo. "answer": uma frase curta. */
    void listen(String mode) {
        if (!Dictation.available(this)) { startListening(); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingListenMode = mode;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            return;
        }
        dictation.setLanguage(Lang.speechTag(this));
        if ("answer".equals(mode)) dictation.start(false, 10000);
        else dictation.start(true, 0);
    }

    void stopListening() {
        if (dictation != null && dictation.isActive()) dictation.finish();
    }

    @Override
    protected void onDestroy() {
        if (current.get() == this) current = new WeakReference<>(null);
        if (speech != null) speech.shutdown();
        if (dictation != null) dictation.destroy();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Ícones das barras do sistema escuros no modo claro e claros no modo escuro. */
    private void applyBarIcons() {
        if (Build.VERSION.SDK_INT < 30 || getWindow().getInsetsController() == null) return;
        boolean night = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        int light = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
        getWindow().getInsetsController().setSystemBarsAppearance(night ? 0 : light, light);
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyBarIcons();
        View root = (View) web.getParent();
        if (root != null) root.setBackgroundColor(getColor(R.color.bg));
    }

    @Override
    public void onBackPressed() {
        handleBack();   // Android 12 e anteriores
    }

    /** Primeiro fecha o que estiver aberto na interface (aviso, definições, edição).
     *  Se não houver nada, a app vai para segundo plano: os alarmes continuam marcados. */
    private void handleBack() {
        if (web == null || !pageReady) { moveTaskToBack(true); return; }
        web.evaluateJavascript("(window.__native && __native.onBack()) ? 'closed' : 'none'", result -> {
            if (result == null || !result.contains("closed")) moveTaskToBack(true);
        });
    }

    void js(final String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    /** Chama window.__native.<fn>(args...) na interface, se a app estiver aberta. */
    static void dispatch(String fn, String... args) {
        MainActivity a = current.get();
        if (a == null) return;
        StringBuilder sb = new StringBuilder("window.__native && __native.").append(fn).append('(');
        for (int i = 0; i < args.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(JSONObject.quote(args[i]));
        }
        a.js(sb.append(')').toString());
    }

    void startListening() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        String tag = Lang.speechTag(this);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, tag);
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, Lang.t(this, "Diz o que tens de fazer", "Say what you need to do"));
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(i, REQ_SPEECH);
        } catch (ActivityNotFoundException e) {
            js("window.__native && __native.onListen(null,'unsupported')");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SPEECH) return;
        String text = null;
        if (resultCode == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty()) text = r.get(0);
        }
        js("window.__native && __native.onListen(" + (text == null ? "null" : JSONObject.quote(text)) + ",null)");
    }

    void keepScreenOn(boolean on) {
        runOnUiThread(() -> {
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }
}
