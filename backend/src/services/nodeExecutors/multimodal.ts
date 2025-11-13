import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiService } from '../aiService';
import axios from 'axios';
import { Readable } from 'stream';

// Image Generation Node
export async function executeImageGenerate(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'dalle';
  const prompt = (input.prompt as string) || '';
  const model = (nodeConfig.model as string) || 'dall-e-3';
  const size = (nodeConfig.size as string) || '1024x1024';
  const quality = (nodeConfig.quality as string) || 'standard';

  if (!prompt) {
    return {
      success: false,
      error: {
        message: 'Prompt is required for image generation',
        code: 'MISSING_PROMPT',
      },
    };
  }

  try {
    if (provider === 'dalle') {
      // DALL·E via OpenAI
      const openai = (aiService as any).openai;
      if (!openai) {
        return {
          success: false,
          error: {
            message: 'OpenAI API key not configured',
            code: 'OPENAI_NOT_CONFIGURED',
          },
        };
      }

      const response = await openai.images.generate({
        model: model === 'dall-e-3' ? 'dall-e-3' : 'dall-e-2',
        prompt,
        n: 1,
        size: size as '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024',
        quality: model === 'dall-e-3' ? (quality as 'standard' | 'hd') : undefined,
      });

      const imageUrl = response.data[0]?.url || '';

      // Optionally fetch and convert to base64
      let imageBase64 = '';
      if (imageUrl) {
        try {
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          imageBase64 = Buffer.from(imageResponse.data).toString('base64');
        } catch {
          // If base64 conversion fails, just return URL
        }
      }

      return {
        success: true,
        output: {
          imageUrl,
          imageBase64: imageBase64 ? `data:image/png;base64,${imageBase64}` : undefined,
        },
      };
    } else if (provider === 'stable-diffusion') {
      // Stable Diffusion would require Replicate API or local model
      return {
        success: false,
        error: {
          message: 'Stable Diffusion support requires Replicate API or local model setup',
          code: 'STABLE_DIFFUSION_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported image generation provider: ${provider}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Image generation failed',
        code: 'IMAGE_GENERATION_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

// Image Analysis Node
export async function executeImageAnalyze(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'vision';
  const provider = (nodeConfig.provider as string) || 'openai';
  const prompt = (nodeConfig.prompt as string) || 'Describe this image in detail.';
  const imageUrl = (input.imageUrl as string) || '';
  const imageBase64 = (input.imageBase64 as string) || '';

  if (!imageUrl && !imageBase64) {
    return {
      success: false,
      error: {
        message: 'Image URL or base64 is required',
        code: 'MISSING_IMAGE',
      },
    };
  }

  try {
    if (provider === 'openai' && operation === 'vision') {
      const openai = (aiService as any).openai;
      if (!openai) {
        return {
          success: false,
          error: {
            message: 'OpenAI API key not configured',
            code: 'OPENAI_NOT_CONFIGURED',
          },
        };
      }

      // Prepare image
      let imageContent: string;
      if (imageBase64) {
        // Remove data URL prefix if present
        imageContent = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      } else if (imageUrl) {
        // Fetch image and convert to base64
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        imageContent = Buffer.from(imageResponse.data).toString('base64');
      } else {
        throw new Error('No image provided');
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageContent}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const description = response.choices[0]?.message?.content || '';

      return {
        success: true,
        output: {
          description,
          text: operation === 'both' ? description : undefined,
          labels: [],
        },
      };
    } else if (operation === 'ocr') {
      // OCR would require Tesseract.js or Google Vision API
      return {
        success: false,
        error: {
          message: 'OCR support requires tesseract.js or Google Vision API',
          code: 'OCR_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported provider or operation: ${provider}/${operation}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Image analysis failed',
        code: 'IMAGE_ANALYSIS_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

// Audio Transcription Node
export async function executeAudioTranscribe(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'openai';
  const model = (nodeConfig.model as string) || 'whisper-1';
  const language = (nodeConfig.language as string) || undefined;
  const responseFormat = (nodeConfig.responseFormat as string) || 'text';

  const audioUrl = (input.audioUrl as string) || '';
  const audioBase64 = (input.audioBase64 as string) || '';

  if (!audioUrl && !audioBase64) {
    return {
      success: false,
      error: {
        message: 'Audio URL or base64 is required',
        code: 'MISSING_AUDIO',
      },
    };
  }

  try {
    if (provider === 'openai') {
      const openai = (aiService as any).openai;
      if (!openai) {
        return {
          success: false,
          error: {
            message: 'OpenAI API key not configured',
            code: 'OPENAI_NOT_CONFIGURED',
          },
        };
      }

      // Prepare audio file
      let audioFile: any;
      if (audioBase64) {
        // Convert base64 to buffer
        const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        audioFile = Buffer.from(base64Data, 'base64');
      } else if (audioUrl) {
        // Fetch audio file
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        audioFile = Buffer.from(audioResponse.data);
      } else {
        throw new Error('No audio provided');
      }

      // Create a ReadStream for OpenAI API (Node.js compatible)
      // OpenAI SDK accepts File, Blob, or ReadStream in Node.js
      const audioStream = Readable.from(audioFile);

      const response = await openai.audio.transcriptions.create({
        file: audioStream as any,
        model,
        language,
        response_format: responseFormat as 'json' | 'text' | 'srt' | 'verbose_json',
      });

      if (responseFormat === 'text') {
        return {
          success: true,
          output: {
            text: response as string,
            language: undefined,
            segments: [],
          },
        };
      } else {
        const jsonResponse = response as any;
        return {
          success: true,
          output: {
            text: jsonResponse.text || '',
            language: jsonResponse.language,
            segments: jsonResponse.segments || [],
          },
        };
      }
    } else if (provider === 'local') {
      // Local Whisper would require whisper.cpp or similar
      return {
        success: false,
        error: {
          message: 'Local Whisper support requires whisper.cpp or similar local setup',
          code: 'LOCAL_WHISPER_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported transcription provider: ${provider}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Audio transcription failed',
        code: 'TRANSCRIPTION_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

// Text to Speech Node
export async function executeTextToSpeech(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'openai';
  const text = (input.text as string) || '';
  const voice = (nodeConfig.voice as string) || 'alloy';
  const model = (nodeConfig.model as string) || 'tts-1';
  const speed = (nodeConfig.speed as number) || 1.0;

  if (!text) {
    return {
      success: false,
      error: {
        message: 'Text is required for text-to-speech',
        code: 'MISSING_TEXT',
      },
    };
  }

  try {
    if (provider === 'openai') {
      const openai = (aiService as any).openai;
      if (!openai) {
        return {
          success: false,
          error: {
            message: 'OpenAI API key not configured',
            code: 'OPENAI_NOT_CONFIGURED',
          },
        };
      }

      const response = await openai.audio.speech.create({
        model,
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: text,
        speed,
      });

      // Convert response to base64
      const arrayBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        success: true,
        output: {
          audioBase64: `data:audio/mpeg;base64,${audioBase64}`,
          audioUrl: undefined, // Could upload to storage and return URL
        },
      };
    } else if (provider === 'elevenlabs') {
      // ElevenLabs would require elevenlabs package
      return {
        success: false,
        error: {
          message: 'ElevenLabs support requires elevenlabs package. Please install it: npm install elevenlabs',
          code: 'ELEVENLABS_NOT_AVAILABLE',
        },
      };
    } else if (provider === 'coqui') {
      // Coqui TTS would require coqui-tts package
      return {
        success: false,
        error: {
          message: 'Coqui TTS support requires coqui-tts package',
          code: 'COQUI_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported TTS provider: ${provider}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Text-to-speech failed',
        code: 'TTS_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

