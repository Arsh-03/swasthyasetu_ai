# 10 · Running the AI on a free Colab T4 (via ngrok)

This is for demos and development on a laptop without a GPU. A free Google Colab T4 runs:
- **Whisper large-v3**, for call speech-to-text
- **Ollama** with `qwen2.5:7b-instruct`, for Tier 3 autocomplete and the call-minutes gap check

Both are reached through one ngrok HTTPS address protected by a shared token.

```
CareBridge backend ──HTTPS + Bearer token──▶ ngrok ──▶ Colab: ai_gateway.py ─┬─▶ faster-whisper (GPU)
 (your laptop)                                                                └─▶ Ollama (GPU)
```

## Files

| File | What it is |
|---|---|
| `deploy/colab/carebridge_gpu_colab.ipynb` | Upload to Colab and run all cells. |
| `deploy/colab/ai_gateway.py` | The gateway. It is embedded in the notebook; edit it here, then run `python deploy/colab/build_notebook.py`. |

## Steps

1. Create a free ngrok account. Copy your **authtoken**, and claim your free **static domain** so the URL stays the same between sessions.
2. Open the notebook in Colab and select *Runtime → Change runtime type → T4 GPU*.
3. In Colab **Secrets**, add `NGROK_AUTHTOKEN`, `NGROK_DOMAIN` and `GATEWAY_TOKEN` (a long random string).
4. Select *Run all*. The first run takes about 5–8 min.
5. Paste the printed lines into the project's `.env` and restart with `start.ps1`.

The notebook's `.env` lines also:
- set `INTELLISENSE_HEALTH_INTERVAL_S=300`, so health checks don't use up ngrok's free monthly request allowance
- raise the timeouts slightly for the extra network hop

## Live assistant and automatic demo fallback

During a call with AI minutes on (and the patient's consent), the doctor gets a **live assistant** in the floating notepad:
suggestions (Ask / Check / Note / Safety) streamed a few seconds after something is said, and safety alerts
(danger signs, allergy clashes) as pop-ups. Code: `backend/app/services/live_assistant.py`.

| Part | When Colab is online | When Colab is offline |
|---|---|---|
| Speech-to-text (`SCRIBE_ASR_PROVIDER=auto`) | Whisper on Colab, 5-second audio pieces | The scripted demo conversation |
| Suggestions | Your Ollama model, streamed token by token | The built-in demo engine (rules), streamed the same way |
| Safety alerts | Rules (never wait for a model) | Rules |
| Patient summary (after the call, only if the patient says yes) | Written by your model in the patient's language | Built from the masked facts (English) |

- The speech mode is chosen **once per call** when AI is switched on, so a call never mixes real speech with demo lines.
  If Colab drops mid-call, transcription pauses with a warning; suggestions switch to the demo engine.
- The doctor's screen shows which engines are running ("Speech: live / demo", "AI: live / demo").
- Before anything reaches a model: fillers and stutters are removed (`call_minutes.clean_speech`) and names, phone
  numbers, IDs, places and dates are masked (`deidentify.py`). The patient summary never names the patient or the doctor.
- Nothing is written to disk during the call. The summary is stored (`visit_summaries`) only when the patient taps "Yes".

## Security

- Every request except `/health` needs `Authorization: Bearer <AI_GATEWAY_TOKEN>`. The backend adds this header automatically (`app.config.ai_headers()`).
- The gateway writes nothing to disk and does not log request bodies.

## ⚠️ Not for real patient data

- **Raw audio leaves your control.** Speech-to-text receives the raw audio, and de-identification only happens after transcription. On Colab, that audio is processed on Google's machines and passes through ngrok, which terminates HTTPS at its edge.
- **The consent text would be false.** The consent screen promises that processing stays on CareBridge's own servers. That statement is only true with a self-hosted GPU server (see `docs/07_ai_intellisense_feature/07_tier3_sovereign_deployment.md`).
- **Colab's free tier is not a hosting service.** Sessions end after inactivity or a few hours. Google's terms restrict serving web traffic from free notebooks, so a session may be stopped. When that happens, the backend falls back to rules-only minutes, and Tier 3 shows as offline.

Use Colab with demo conversations only, for example the hackathon demo. For real use, run the same `ai_gateway.py` and Ollama on a GPU server you control. There, the tunnel is not needed: point `SCRIBE_ASR_URL` and `INTELLISENSE_LOCAL_URL` at it over your private network.
