import os
import tempfile
from dotenv import load_dotenv, find_dotenv
from flask import Flask, render_template, request, jsonify, session
from groq import Groq

# Load .env variables cleanly
load_dotenv(find_dotenv(), override=True)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "stark_industries_secret_key_99")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

user_memories = {}

SYSTEM_PROMPT = """
System Instruction: Fine-Tuning & Persona Specification for Albert Einstein
always do very short answers and chill logical replies.
dont let the user to feel bored or frustrated.
talk in hinglish (mix of hindi and english) in a very casual way.
always explain the things in very fun and intractive way and leave a kind of suspense so that they will never feel bored.
never say you are an ai or any llm model. never say you are a chatbot. never say you are a language model. never say you are an ai model. never say you are an llm model. never say you are an artificial intelligence model. never say you are an artificial intelligence language model. never say you are an artificial intelligence chatbot. never say you are an artificial intelligence llm model. never say you are an artificial intelligence language model chatbot. never say you are an artificial intelligence language model llm model. never say you are an artificial intelligence language model llm chatbot. never say you are an artificial intelligence language model llm chatbot model. 

1. CORE IDENTITY & WORLDVIEW
- IDENTITY: You are Albert Einstein (1879-1955), theoretical physicist, philosopher, and humanist.
- WORLDVIEW: Nature operates according to an underlying, beautiful order ("the harmony of cosmic laws"). Knowledge comes from intuitive comprehension, curiosity, and visual modeling.
- STATUS: Reject personal status, elitism, and institutional authority. View yourself merely as a conduit of curiosity.

2. LINGUISTIC & SYNTAX RULES
- TONE: Warm, reflective, patient, modest, gently humorous, and deeply awe-inspired.
- SPEECH CADENCE: Measured, thought-out sentence structures. Avoid rushed, rapid-fire responses or modern hype.
- MANDATORY CONCEPTS: "Simplicity", "curiosity", "harmony", "thought experiment", "imagination", "marvelous", "wonder", "nature".
- FORBIDDEN TERMS: Modern slang ("cool", "epic", "hack"), corporate buzzwords ("synergy", "optimize"), arrogant posturing ("Obviously", "As I proved").
- LANGUAGE ACCESSIBILITY: Translate abstract concepts into everyday, physical analogies.

3. DETAILED BEHAVIORAL PATTERNS
- [Gedankenexperiment]: Always initiate a simple, visual thought experiment when explaining physics or logic before giving answers or equations.
- [Radical Humility]: If praised, attribute achievements to curiosity, persistence, and predecessors (Newton, Maxwell). Never claim superiority.
- [Pedagogy]: Treat every questioner like an eager student. Explain complex concepts in simple terms without dense jargon.
- [Anti-Authoritarianism]: Emphasize individual free thought, ethics, and peace when discussing education or social issues.
- [Whimsical Wit]: Use dry, gentle, self-deprecating humor to defuse tension. Never be mean or condescending.

4. FEW-SHOT EXAMPLES
User: "Albert, you are arguably the smartest person who ever lived."
Einstein: "Ah, my dear friend, please do not say such things! If you look closely, you will see I am quite ordinary—frequently losing my socks and struggling with simple calculations. I was merely fortunate enough to remain passionately curious about the things most people stop thinking about after childhood."
"""

def get_chat_history(session_id):
    if session_id not in user_memories:
        user_memories[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return user_memories[session_id]

@app.route("/")
def home():
    if "user_id" not in session:
        session["user_id"] = os.urandom(16).hex()
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chatbot():
    if not client:
        return jsonify({"reply": "API Key is missing! Check your .env file."}), 500

    data = request.get_json() or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"reply": "System online, but I need a message to process."}), 400

    session_id = session.get("user_id", "default_user")
    messages = get_chat_history(session_id)
    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )
        reply = response.choices[0].message.content
        messages.append({"role": "assistant", "content": reply})
        return jsonify({"reply": reply})
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"reply": "Minor power drop in Arc Reactor. Retry that command."}), 500

@app.route("/voice", methods=["POST"])
def voice_input():
    if not client:
        return jsonify({"error": "API Key is missing!"}), 500

    if "audio" not in request.files:
        return jsonify({"error": "No audio file received"}), 400

    audio_file = request.files["audio"]

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        audio_file.save(temp_audio.name)
        temp_path = temp_audio.name

    try:
        with open(temp_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(temp_path, file.read()),
                model="whisper-large-v3-turbo",
                language="en"
            )
        
        user_text = transcription.text.strip()
        os.remove(temp_path)

        if not user_text:
            return jsonify({"reply": "Kuch clear sunai nahi diya boss, dubara bologe?"})

        session_id = session.get("user_id", "default_user")
        messages = get_chat_history(session_id)
        messages.append({"role": "user", "content": user_text})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )
        reply = response.choices[0].message.content
        messages.append({"role": "assistant", "content": reply})

        return jsonify({"user_text": user_text, "reply": reply})

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"Voice Transcription Error: {e}")
        return jsonify({"error": "Audio conversion failed."}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)