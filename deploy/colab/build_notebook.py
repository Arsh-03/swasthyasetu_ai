"""Builds carebridge_gpu_colab.ipynb with ai_gateway.py embedded. Run after editing ai_gateway.py."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
gateway = (HERE / "ai_gateway.py").read_text(encoding="utf-8")


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": text.strip("\n").splitlines(keepends=True)}


cells = [
    md("""
# CareBridge AI server on a free Colab T4

Runs the AI the CareBridge backend needs on a free Colab T4 GPU:
- **Speech-to-text:** Whisper, used for call minutes.
- **Language model:** Ollama, used for Tier 3 autocomplete and the minutes gap check.

Both sit behind **one token-protected ngrok address**.

**Before you start**
1. *Runtime → Change runtime type → T4 GPU*.
2. In the 🔑 **Secrets** panel (left sidebar), add the following and turn on notebook access for each:
   - `NGROK_AUTHTOKEN`: from https://dashboard.ngrok.com/get-started/your-authtoken
   - `NGROK_DOMAIN` (optional but recommended): your free static domain from https://dashboard.ngrok.com/domains. With it, the address stays the same every session.
   - `GATEWAY_TOKEN`: any long random string. If it is missing, one is generated for you.
3. *Runtime → Run all*. The first run takes about 5–8 minutes for downloads. At the end it prints the lines to paste into CareBridge's `.env`.

⚠️ Use **test or demo conversations only** on Colab. Google runs the GPU and ngrok carries the traffic, so this setup is not the sovereign production deployment.
"""),
    md("## 1 · Settings"),
    code("""
WHISPER_MODEL = "large-v3"          # best for Hindi/Kannada; "medium" is faster
LLM_MODEL = "qwen2.5:7b-instruct"   # fits next to Whisper on a T4; "qwen2.5:3b-instruct" is faster
GATEWAY_PORT = 8765                 # avoid 8080, which Colab itself may use
"""),
    md("## 2 · Check the GPU"),
    code("!nvidia-smi --query-gpu=name,memory.total --format=csv"),
    md("## 3 · Install Ollama and the gateway's Python packages"),
    code("""
!apt-get -qq update && apt-get -qq install -y zstd pciutils lshw > /dev/null
!curl -fsSL https://ollama.com/install.sh | sh > /dev/null
# av is pinned: PyAV 19 removed an option faster-whisper uses. The nvidia-* packages provide the CUDA 12
# libraries Whisper's engine (CTranslate2) needs, since newer Colab images ship a different CUDA version.
!pip -q install faster-whisper "av==18.1.0" "nvidia-cublas-cu12" "nvidia-cudnn-cu12==9.*" fastapi uvicorn httpx python-multipart pyngrok
"""),
    md("## 4 · Start Ollama and download the language model"),
    code("""
import os, subprocess, time, httpx

subprocess.run(["pkill", "-f", "ollama serve"]); time.sleep(1)   # safe to re-run this cell
env = dict(os.environ, OLLAMA_HOST="127.0.0.1:11434", OLLAMA_KEEP_ALIVE="-1", OLLAMA_NUM_PARALLEL="2")
ollama_proc = subprocess.Popen(["ollama", "serve"], env=env,
                               stdout=open("/content/ollama.log", "w"), stderr=subprocess.STDOUT)
for _ in range(30):
    try:
        httpx.get("http://127.0.0.1:11434/api/version", timeout=2); break
    except httpx.HTTPError:
        time.sleep(1)
!ollama pull {LLM_MODEL}
"""),
    md("## 5 · Write the gateway (speech-to-text + Ollama pass-through, token-protected)"),
    code("%%writefile /content/ai_gateway.py\n" + gateway),
    md("## 6 · Start the gateway (downloads the Whisper model on first run)"),
    code("""
import secrets
from google.colab import userdata

def secret(name):
    try:
        return userdata.get(name)
    except Exception:
        return ""

import socket
subprocess.run(["pkill", "-f", "uvicorn ai_gateway:app"]); time.sleep(2)   # stop a gateway from an earlier run

def port_free(port):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0

if not port_free(GATEWAY_PORT):                # something else holds the port: let the OS pick a free one
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); GATEWAY_PORT = s.getsockname()[1]
print("gateway port:", GATEWAY_PORT)
if not globals().get("GATEWAY_TOKEN"):
    GATEWAY_TOKEN = secret("GATEWAY_TOKEN") or secrets.token_urlsafe(32)
import nvidia.cublas.lib, nvidia.cudnn.lib
cuda12_libs = ":".join([list(nvidia.cublas.lib.__path__)[0], list(nvidia.cudnn.lib.__path__)[0]])
genv = dict(os.environ, GATEWAY_TOKEN=GATEWAY_TOKEN, WHISPER_MODEL=WHISPER_MODEL,
            WHISPER_DEVICE="cuda", OLLAMA_URL="http://127.0.0.1:11434",
            LD_LIBRARY_PATH=cuda12_libs + ":" + os.environ.get("LD_LIBRARY_PATH", ""))
gw_proc = subprocess.Popen(
    ["python", "-m", "uvicorn", "ai_gateway:app", "--host", "127.0.0.1", "--port", str(GATEWAY_PORT)],
    cwd="/content", env=genv, stdout=open("/content/gateway.log", "w"), stderr=subprocess.STDOUT)

for i in range(180):
    try:
        h = httpx.get(f"http://127.0.0.1:{GATEWAY_PORT}/health", timeout=2).json()
        print("gateway ready:", h)
        if not h["whisper"]:
            print("⚠️ Whisper failed its self-test; see /content/gateway.log")
        break
    except Exception:
        if gw_proc.poll() is not None:
            raise RuntimeError(open("/content/gateway.log").read()[-3000:])
        time.sleep(5)
else:
    print(open("/content/gateway.log").read()[-3000:])
"""),
    md("## 7 · Warm up the language model"),
    code("""
r = httpx.post(f"http://127.0.0.1:{GATEWAY_PORT}/api/generate",
               headers={"Authorization": f"Bearer {GATEWAY_TOKEN}"},
               json={"model": LLM_MODEL, "prompt": "Patient complains of", "stream": False,
                     "options": {"num_predict": 12}}, timeout=300)
print(r.status_code, r.json().get("response"))
"""),
    md("## 8 · Open the ngrok tunnel"),
    code("""
from pyngrok import ngrok, conf

ngrok.kill()   # close a tunnel from an earlier run, so the cell can be re-run
conf.get_default().auth_token = secret("NGROK_AUTHTOKEN")
domain = secret("NGROK_DOMAIN")
options = {"domain": domain} if domain else {}
tunnel = ngrok.connect(str(GATEWAY_PORT), "http", **options)
PUBLIC_URL = tunnel.public_url.replace("http://", "https://")

print("Public URL:", PUBLIC_URL)
print("Unauthenticated request is refused:", httpx.get(PUBLIC_URL + "/api/tags", timeout=20).status_code)
"""),
    md("## 9 · Paste these lines into CareBridge's `.env`, then restart the backend"),
    code("""
print(f'''# --- Colab GPU ({time.strftime("%Y-%m-%d")}) ---
AI_GATEWAY_TOKEN={GATEWAY_TOKEN}
SCRIBE_ASR_PROVIDER=http
SCRIBE_ASR_URL={PUBLIC_URL}
SCRIBE_ASR_MODEL={WHISPER_MODEL}
SCRIBE_ASR_TRANSLATE=true
SCRIBE_ASR_TIMEOUT_S=90
SCRIBE_LLM_PROVIDER=local
SCRIBE_LLM_MODEL={LLM_MODEL}
INTELLISENSE_LLM_PROVIDER=local
INTELLISENSE_LOCAL_URL={PUBLIC_URL}
INTELLISENSE_LOCAL_MODEL={LLM_MODEL}
INTELLISENSE_LOCAL_KEEP_ALIVE=24h
INTELLISENSE_LLM_TIMEOUT_S=8
INTELLISENSE_HEALTH_INTERVAL_S=300''')
if not secret("GATEWAY_TOKEN"):
    print("\\n# Tip: save this GATEWAY_TOKEN as a Colab secret so it stays the same next session.")
"""),
    md("## 10 · Keep running (stop this cell to see logs; closing the tab ends the session)"),
    code("""
try:
    while True:
        h = httpx.get(f"http://127.0.0.1:{GATEWAY_PORT}/health", timeout=5).json()
        print(time.strftime("%H:%M:%S"), h, end="\\r")
        time.sleep(60)
except KeyboardInterrupt:
    print("\\n--- gateway.log (last lines) ---")
    print(open("/content/gateway.log").read()[-2000:])
"""),
]

nb = {
    "cells": cells,
    "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4", "provenance": []},
                 "kernelspec": {"display_name": "Python 3", "name": "python3"},
                 "language_info": {"name": "python"}},
    "nbformat": 4, "nbformat_minor": 0,
}
(HERE / "carebridge_gpu_colab.ipynb").write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote carebridge_gpu_colab.ipynb")
