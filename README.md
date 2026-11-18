# Relembra-me

Lembretes **falados** para quem se esquece de tudo (feito a pensar em PHDA).
Dizes ao microfone o que tens de fazer — *"relembra-me de hora a hora de ir à InPost até às 16h"* — e a app
lembra-te em voz alta à hora certa, mesmo com o telemóvel bloqueado.

## Instalar (Android)

Abre no telemóvel: **https://github.com/pedrobd/relembra-me/releases/download/relembra-me/Relembra-me.apk**
e instala (o Android avisa que é de fontes desconhecidas porque não está na Play Store).

## Estrutura

- `web/` — a interface (HTML/CSS/JS). Também funciona como versão web, mas aí só toca com a página aberta.
- `android/` — a app Android: abre a interface e junta-lhe alarmes do sistema, a voz do Android e o reconhecimento de voz.
- `.github/workflows/android.yml` — compila o APK a cada alteração e publica-o na release `relembra-me`.
  A chave de assinatura está encriptada (`android/app/release.keystore.enc`); o GitHub Actions desencripta-a com o
  segredo `KEYSTORE_PASSWORD`.

## Privacidade

Os lembretes ficam só no telemóvel. Sem contas, sem publicidade, sem envio de dados. O reconhecimento de voz usa o
serviço de voz do Android.

## Licença

Todos os direitos reservados — ver [LICENCA.md](LICENCA.md).
