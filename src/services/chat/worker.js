import { AutoModelForCausalLM, AutoTokenizer, TextStreamer, env } from "@huggingface/transformers";

// Environment config
env.allowLocalModels = false;
env.useBrowserCache = true;

let model = null;
let tokenizer = null;
let currentModelId = null;

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'load':
      await loadModel(payload);
      break;

    case 'generate':
      await generate(payload);
      break;

    case 'dispose':
      model = null;
      tokenizer = null;
      currentModelId = null;
      console.log('[Chat Worker] Model resources released');
      break;
  }
};

async function loadModel({ modelId = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX", dtype = "q4", device = "webgpu" }) {
  try {
    if (model && currentModelId === modelId) {
      self.postMessage({ type: 'loaded', payload: { modelId } });
      return;
    }

    self.postMessage({ type: 'progress', progress: 0.1, message: `Loading ${modelId}...` });

    tokenizer = await AutoTokenizer.from_pretrained(modelId);
    self.postMessage({ type: 'progress', progress: 0.2, message: 'Tokenizer loaded' });

    model = await AutoModelForCausalLM.from_pretrained(modelId, {
      device,
      dtype,
      progress_callback: (p) => {
        if (p.status === 'progress' && p.progress) {
          self.postMessage({
            type: 'progress',
            progress: 0.2 + (p.progress * 0.8), // Scale progress from 20% to 100%
            message: `Downloading model... ${Math.round(p.progress)}%`
          });
        }
      }
    });

    currentModelId = modelId;
    self.postMessage({ type: 'loaded', payload: { modelId } });
    console.log(`[Chat Worker] Model ${modelId} loaded`);

  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
}

async function generate({ prompt, max_new_tokens = 512, temperature = 0.7 }) {
  try {
    if (!model || !tokenizer) {
      throw new Error('Model not loaded');
    }

    // 1. Prepare messages with System Prompt (Best for Instruct models)
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ];

    // 2. Apply Chat Template
    // This adds the special <|user|> and <|assistant|> tokens the model expects
    const inputs = await tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
      tokenize: true,
    });

    // 3. Create Streamer
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true, // IMPORTANT: Prevents the prompt from being echoed back
      skip_special_tokens: true,
      callback_function: (text) => {
        console.log('[Worker] Streamer token callback:', text);
        self.postMessage({ type: 'token', token: text });
      }
    });

    // 4. Generate
    console.log('[Worker] Starting model.generate...');
    // We spread ...inputs to pass both input_ids and attention_mask
    const output = await model.generate({
      ...inputs,
      max_new_tokens,
      do_sample: temperature > 0, // Only sample if temp > 0
      temperature,
      streamer,
    });

    console.log('[Worker] Generation complete');

    // 5. Final Decode (Cleaner)
    const fullText = tokenizer.decode(output[0], { skip_special_tokens: true });

    // Safety cleanup: Remove the prompt if it somehow leaked into the output
    const decodedInput = tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
    let cleanOutput = fullText;
    if (cleanOutput.startsWith(decodedInput)) {
      cleanOutput = cleanOutput.slice(decodedInput.length).trim();
    }

    self.postMessage({ type: 'complete', output: cleanOutput });

  } catch (error) {
    console.error('Generation error:', error);
    self.postMessage({ type: 'error', error: error.message });
  }
}